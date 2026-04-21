<template>
  <div class="cytoscape-wrapper">
    <div ref="container" class="cytoscape-renderer" />
    <div ref="popperContainer" class="popper-overlay" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { match } from "ts-pattern";
import cytoscape, {
  Core,
  ElementsDefinition,
  LayoutOptions,
  NodeSingular,
  StylesheetCSS,
} from "cytoscape";
import dagre from "cytoscape-dagre";
import cytoscapePopper, {
  PopperFactory,
  PopperInstance,
  PopperOptions,
} from "cytoscape-popper";
import {
  computePosition,
  ReferenceElement,
  FloatingElement,
} from "@floating-ui/dom";
// @ts-expect-error: missing types
import svg from "cytoscape-svg";
import { makeCyElements } from "./cyGraphFactory";
import { makeCyStylesheets } from "./cyStyleSheetsFactory";
import {
  setupCyPoppers,
  collectDescriptions,
  PopperCleanup,
} from "./cyPopperExtender";
import { injectDescriptionsIntoSvg } from "./svgDescriptionInjector";
import { diffCyElements, applyDiff } from "./cyDiffer";
import { Dag } from "../../compiler/dag";
import { ExportFormat } from "../../compiler/constants";
import { saveAs } from "file-saver";
import {
  FileExportOptions,
  RendererComponent,
} from "../../compiler/rendererTypes";

declare module "cytoscape-popper" {
  // PopperOptions extends ComputePositionConfig from @floating-ui/dom
  interface PopperInstance {
    update(): void;
  }
}

const popperFactory: PopperFactory = (
  ref: ReferenceElement,
  content: FloatingElement,
  opts?: PopperOptions,
): PopperInstance => {
  const popperOptions = {
    // see https://floating-ui.com/docs/computePosition#options
    ...opts,
  };

  function update() {
    computePosition(ref, content, popperOptions).then(({ x, y }) => {
      Object.assign(content.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  }
  update();
  return { update };
};

cytoscape.use(dagre);
cytoscape.use(cytoscapePopper(popperFactory));
cytoscape.use(svg);

// Dagre layout options type - refer to dagre documentation and cytoscape-dagre typings
// https://github.com/cytoscape/cytoscape.js-dagre?tab=readme-ov-file#api
type DagreLayoutOptions = LayoutOptions & {
  name: "dagre";
  sort: (a: NodeSingular, b: NodeSingular) => number;
};

// We define a custom sort function to encourage the layout manager
// to follow the insertion order of nodes in the DAG.
// However, Dagre's crossing minimization may still rearrange nodes in a way
// that doesn't preserve the insertion order.
const layoutOptions = {
  name: "dagre",
  sort: (A: NodeSingular, B: NodeSingular) => {
    const orderA: number[] = A.data("order") ?? [];
    const orderB: number[] = B.data("order") ?? [];
    for (let i = 0; i < Math.min(orderA.length, orderB.length); i++) {
      if (orderA[i] !== orderB[i]) return orderA[i] - orderB[i];
    }
    return orderA.length - orderB.length;
  },
} satisfies DagreLayoutOptions;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

interface DescriptionPosition {
  lines: string[];
  centerX: number;
  topY: number;
  bottomY: number;
  font: string;
  fillStyle: string;
  textAlign: string;
  lineHeight: number;
}

function computeDescriptionPositions(
  descriptions: Map<string, import("./cyPopperExtender").DescriptionData[]>,
  cy: cytoscape.Core,
  graphBB: { x1: number; y1: number },
  effectiveScale: number,
): DescriptionPosition[] {
  const result: DescriptionPosition[] = [];

  for (const [id, descList] of descriptions) {
    const ele = cy.getElementById(id);
    if (ele.empty()) continue;

    const eleBB = ele.boundingBox({ includeLabels: true });
    const centerX = ((eleBB.x1 + eleBB.x2) / 2 - graphBB.x1) * effectiveScale;
    // Small gap between the label and the first description line
    const gap = 4 * effectiveScale;
    let nextY = (eleBB.y2 - graphBB.y1) * effectiveScale + gap;

    for (const desc of descList) {
      const props = desc.descriptionStyleProperties;
      const rawSize = props.get("font-size") ?? "14";
      const parsedSize = parseFloat(rawSize);
      const scaledFontSize = parsedSize * effectiveScale;
      const fontWeight = props.get("font-weight") ?? "normal";
      const fontStyle = props.get("font-style") ?? "normal";
      const fontFamily = props.get("font-family") ?? "sans-serif";
      const color = props.get("color") ?? "black";
      const textAlign = props.get("text-align") ?? "center";

      const font = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${fontFamily}`;
      const lineHeight = parsedSize * 1.4 * effectiveScale;
      const lines = desc.description.split(/\r\n|\r|\n/);
      const blockHeight = lines.length * lineHeight;

      result.push({
        lines,
        centerX,
        topY: nextY,
        bottomY: nextY + blockHeight,
        font,
        fillStyle: color,
        textAlign,
        lineHeight,
      });

      nextY += blockHeight;
    }
  }

  return result;
}

/**
 * Draw a description block on the canvas.
 *
 * CSS text-align aligns lines within a block container (the widest line
 * determines the block width).  The block itself is centered below the
 * parent element.  We replicate this by measuring all line widths, computing
 * a per-line x based on the alignment, then drawing.
 */
function drawDescription(
  ctx: CanvasRenderingContext2D,
  dp: DescriptionPosition,
  xOffset: number = 0,
): void {
  ctx.save();
  ctx.font = dp.font;
  ctx.fillStyle = dp.fillStyle;
  ctx.textBaseline = "top";

  // Measure the widest line to get the block width
  const lineWidths = dp.lines.map((line) => ctx.measureText(line).width);
  const blockWidth = Math.max(...lineWidths, 0);

  // The block is centered at centerX
  const blockLeft = dp.centerX + xOffset - blockWidth / 2;
  const blockRight = dp.centerX + xOffset + blockWidth / 2;

  let y = dp.topY;
  for (let i = 0; i < dp.lines.length; i++) {
    let x: number;
    if (dp.textAlign === "right") {
      // Right-align: right edge of each line matches block right edge
      ctx.textAlign = "right";
      x = blockRight;
    } else if (dp.textAlign === "left") {
      // Left-align: left edge of each line matches block left edge
      ctx.textAlign = "left";
      x = blockLeft;
    } else {
      // Center: each line centered within the block
      ctx.textAlign = "center";
      x = dp.centerX + xOffset;
    }
    ctx.fillText(dp.lines[i], x, y);
    y += dp.lineHeight;
  }
  ctx.restore();
}

/**
 * CytoscapeRenderer - A renderer using Cytoscape.js for DAG visualization.
 */
const CytoscapeRenderer = defineComponent({
  name: "CytoscapeRenderer",
  props: {
    dag: {
      type: Object as PropType<Dag>,
      required: true,
    },
    lockPositions: {
      type: Boolean,
      default: true,
    },
    isDark: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      cy: null as Core | null,
      previousElements: null as ElementsDefinition | null,
      previousStylesheetsJson: null as string | null,
      popperCleanup: null as PopperCleanup | null,
    };
  },
  watch: {
    dag() {
      this.updateDag(this.dag);
    },
    isDark() {
      this.applyThemeStyles();
    },
    lockPositions(newValue: boolean) {
      if (this.cy) {
        this.cy.autoungrabify(newValue);
      }
    },
  },
  mounted(): void {
    this.initializeCytoscape();
  },
  beforeUnmount(): void {
    if (this.cy) {
      this.cy.destroy();
    }
  },
  methods: {
    initializeCytoscape(): void {
      this.cy = cytoscape({
        container: this.$refs.container as HTMLElement,
      });
      this.cy.autoungrabify(this.lockPositions);
      this.updateDag(this.dag);
    },

    // Layout is an expensive operation regardless of a change's size.
    runLayout(): void {
      Promise.resolve().then(() => {
        if (this.cy) {
          this.cy.layout(layoutOptions).run();
        }
      });
    },

    applyStyles(newStylesheets: StylesheetCSS[]): void {
      if (!this.cy) return;
      const stylesheetsJson = JSON.stringify(newStylesheets);
      if (stylesheetsJson !== this.previousStylesheetsJson) {
        this.cy.style(newStylesheets).update();
        this.cy.forceRender();
        this.previousStylesheetsJson = stylesheetsJson;
      }
    },

    applyThemeStyles(): void {
      if (!this.cy) return;
      const newStylesheets = makeCyStylesheets(this.dag, this.isDark);
      this.applyStyles(newStylesheets);
    },

    updateDag(dag: Dag): void {
      if (!this.cy) return;

      const newElements = makeCyElements(dag);
      const newStylesheets = makeCyStylesheets(dag, this.isDark);

      if (!this.previousElements) {
        // First render: full build
        this.cy.add(newElements);
        this.applyStyles(newStylesheets);
        this.popperCleanup?.();
        this.popperCleanup = setupCyPoppers(
          this.cy,
          dag,
          this.$refs.popperContainer as HTMLElement,
        );
        this.runLayout();
      } else {
        const diff = diffCyElements(this.previousElements, newElements);
        applyDiff(this.cy, diff);

        this.applyStyles(newStylesheets);
        this.popperCleanup?.();
        this.popperCleanup = setupCyPoppers(
          this.cy,
          dag,
          this.$refs.popperContainer as HTMLElement,
        );

        // Avoid unnecessary layout runs by checking if the topology has changed
        if (diff.topologyChanged) {
          this.runLayout();
        }
      }

      this.previousElements = newElements;
    },

    async export(exportOptions: FileExportOptions): Promise<void> {
      if (!this.cy) {
        console.error("Cytoscape instance not initialized");
        return;
      }

      const scaleFactor = exportOptions.scalingFactor;
      const fileName = exportOptions.fileName + "." + exportOptions.fileType;

      const imgBlob = await match(exportOptions.fileType)
        .with(ExportFormat.PNG, ExportFormat.JPG, async () => {
          return this.exportRaster(exportOptions.fileType, scaleFactor);
        })
        .with(ExportFormat.SVG, async () => {
          return this.exportSvg(scaleFactor);
        })
        .otherwise((format) => {
          console.error(`Unsupported export format: ${format}`);
          return null;
        });

      if (!imgBlob) return;
      saveAs(imgBlob, fileName);
    },

    /**
     * Export raster image by compositing Cytoscape's canvas export with
     * descriptions drawn via the Canvas 2D API.
     */
    async exportRaster(
      fileType: ExportFormat,
      scaleFactor: number,
    ): Promise<Blob | null> {
      if (!this.cy) return null;

      const descriptions = collectDescriptions(this.cy, this.dag);

      // Fast path: no descriptions — use Cytoscape's built-in export directly
      if (descriptions.size === 0) {
        if (fileType === ExportFormat.PNG) {
          return this.cy.png({
            full: true,
            scale: scaleFactor,
            output: "blob",
          });
        }
        return this.cy.jpg({
          full: true,
          scale: scaleFactor,
          output: "blob",
        });
      }

      // Get base image from Cytoscape's canvas exporter
      const cyDataUrl: string = this.cy.png({
        full: true,
        scale: scaleFactor,
      });
      const baseImg = await loadImage(cyDataUrl);

      // cy.png() internally scales by scaleFactor * devicePixelRatio
      const effectiveScale = scaleFactor * window.devicePixelRatio;
      const graphBB = this.cy.elements().boundingBox({ includeLabels: true });
      let maxBottom = baseImg.height;
      const descPositions = computeDescriptionPositions(
        descriptions,
        this.cy,
        graphBB,
        effectiveScale,
      );
      for (const dp of descPositions) {
        maxBottom = Math.max(maxBottom, dp.bottomY);
      }

      // Measure text widths to determine if canvas needs to be wider
      const measureCanvas = document.createElement("canvas");
      const measureCtx = measureCanvas.getContext("2d")!;
      let maxRight = baseImg.width;
      let minLeft = 0;
      for (const dp of descPositions) {
        measureCtx.font = dp.font;
        for (const line of dp.lines) {
          const halfWidth = measureCtx.measureText(line).width / 2;
          maxRight = Math.max(maxRight, dp.centerX + halfWidth);
          minLeft = Math.min(minLeft, dp.centerX - halfWidth);
        }
      }

      // If descriptions extend left of the graph, shift everything right
      const leftPad = minLeft < 0 ? Math.ceil(-minLeft) : 0;
      const canvasWidth = Math.ceil(maxRight) + leftPad;

      // Create offscreen canvas and draw base image
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = maxBottom;
      const ctx = canvas.getContext("2d")!;

      if (fileType === ExportFormat.JPG) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(baseImg, leftPad, 0);

      // Draw each description (shifted right by leftPad if needed)
      for (const dp of descPositions) {
        drawDescription(ctx, dp, leftPad);
      }

      const mimeType =
        fileType === ExportFormat.PNG ? "image/png" : "image/jpeg";
      return new Promise((resolve) => canvas.toBlob(resolve, mimeType));
    },

    /**
     * Export SVG with foreignObject-injected descriptions for full CSS styling.
     */
    exportSvg(scaleFactor: number): Blob | null {
      if (!this.cy) return null;

      // @ts-expect-error: missing types
      const baseSvg: string = this.cy.svg({ full: true, scale: scaleFactor });
      const descriptions = collectDescriptions(this.cy, this.dag);
      // cytoscape-svg multiplies scale by pixelRatio (see convert-to-svg.js:60-63)
      const effectiveScale = scaleFactor * window.devicePixelRatio;
      const enrichedSvg = injectDescriptionsIntoSvg(
        baseSvg,
        descriptions,
        this.cy,
        effectiveScale,
      );
      return new Blob([enrichedSvg], {
        type: "image/svg+xml;charset=utf-8",
      });
    },
  },
});

export default Object.assign(CytoscapeRenderer, {
  displayName: "Cytoscape Renderer",
  supportedExportFormats: [
    ExportFormat.PNG,
    ExportFormat.JPG,
    ExportFormat.SVG,
  ],
}) as RendererComponent;
</script>

<style scoped>
.cytoscape-wrapper {
  position: relative;
  height: 100%;
  width: 100%;
}

.cytoscape-renderer {
  height: 100%;
  width: 100%;
  background-color: var(--fviz-bg);
  border: solid 1px var(--fviz-border);
  box-sizing: border-box;
}

.popper-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
</style>
