import cytoscape from "cytoscape";
import { DescriptionData } from "./cyPopperExtender";

const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * CSS properties whose bare-numeric values are intentionally unitless.
 * Everything else gets "px" appended when the value is a plain number.
 */
const UNITLESS_CSS_PROPERTIES = new Set([
  "font-weight",
  "opacity",
  "text-opacity",
  "line-height",
  "z-index",
  "order",
  "flex-grow",
  "flex-shrink",
  "orphans",
  "widows",
]);

/**
 * If a CSS value is a bare number (e.g. "40") and the property expects a unit,
 * append "px" so the style renders correctly outside a Cytoscape context.
 */
export function normalizeStyleValue(property: string, value: string): string {
  if (UNITLESS_CSS_PROPERTIES.has(property)) return value;
  // Matches values like "40", "3.5", ".5" — but not "40px", "1em", "50%", etc.
  if (/^-?\d*\.?\d+$/.test(value)) return value + "px";
  return value;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build a foreignObject XML string for a single description.
 * Font sizes and other length properties are scaled to match the SVG
 * coordinate space which is already multiplied by effectiveScale.
 */
export function buildForeignObject(
  desc: DescriptionData,
  x: number,
  y: number,
  width: number,
  scaleFactor: number,
): string {
  let inlineStyle = "margin:0;";
  desc.descriptionStyleProperties.forEach((value, property) => {
    const normalized = normalizeStyleValue(property, value);
    // Scale font-size to match the SVG coordinate space
    if (property === "font-size") {
      const parsed = parseFloat(normalized);
      inlineStyle += `${property}:${parsed * scaleFactor}px;`;
    } else {
      inlineStyle += `${property}:${normalized};`;
    }
  });

  const parts = desc.description.split(/\r\n|\r|\n/);
  const textContent = parts.map((part) => escapeXml(part)).join("<br/>");

  return (
    `<foreignObject x="${x}" y="${y}" width="${width}" height="1000" overflow="visible">` +
    `<div xmlns="${XHTML_NS}" style="display:inline-block;text-align:center;width:100%;">` +
    `<p style="${escapeXml(inlineStyle)}">${textContent}</p>` +
    `</div>` +
    `</foreignObject>`
  );
}

interface ForeignObjectPosition {
  desc: DescriptionData;
  x: number;
  y: number;
  width: number;
  estimatedBottom: number;
}

/**
 * Parse width and height from the opening <svg> tag.
 */
function parseSvgDimensions(svgString: string): {
  width: number;
  height: number;
} {
  const wMatch = svgString.match(/<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"/);
  const hMatch = svgString.match(/<svg[^>]*\bheight="(\d+(?:\.\d+)?)"/);
  return {
    width: wMatch ? parseFloat(wMatch[1]) : 0,
    height: hMatch ? parseFloat(hMatch[1]) : 0,
  };
}

/**
 * Update width and height attributes on the opening <svg> tag.
 */
function updateSvgDimensions(
  svgString: string,
  width: number,
  height: number,
): string {
  return svgString
    .replace(
      /(<svg[^>]*\bwidth=")(\d+(?:\.\d+)?)(")/,
      `$1${Math.ceil(width)}$3`,
    )
    .replace(
      /(<svg[^>]*\bheight=")(\d+(?:\.\d+)?)(")/,
      `$1${Math.ceil(height)}$3`,
    );
}

/**
 * Inject styled description HTML into an SVG string using <foreignObject>.
 *
 * For each Cytoscape element that has descriptions, a <foreignObject> is
 * positioned just below the element's label bounding box.  The inner HTML
 * mirrors the structure created by `makePopperDiv` in cyPopperExtender.ts.
 *
 * The SVG's width/height are expanded if foreignObjects extend beyond
 * the original bounds.  If descriptions extend to the left of the graph,
 * all existing SVG content is shifted right via a wrapping <g> translate.
 */
export function injectDescriptionsIntoSvg(
  svgString: string,
  descriptions: Map<string, DescriptionData[]>,
  cy: cytoscape.Core,
  scaleFactor: number,
): string {
  if (descriptions.size === 0) return svgString;

  const graphBB = cy.elements().boundingBox({ includeLabels: true });
  const foPositions: ForeignObjectPosition[] = [];

  for (const [id, descList] of descriptions) {
    const ele = cy.getElementById(id);
    if (ele.empty()) continue;

    const eleBB = ele.boundingBox({ includeLabels: true });

    // X position: center of the element, relative to graph origin
    const centerX = ((eleBB.x1 + eleBB.x2) / 2 - graphBB.x1) * scaleFactor;
    // Y position: just below the element's label bounding box, with a small gap
    const gap = 4 * scaleFactor;
    let nextY = (eleBB.y2 - graphBB.y1) * scaleFactor + gap;

    for (const desc of descList) {
      const foWidth = eleBB.w * scaleFactor;
      const x = centerX - foWidth / 2;

      // Estimate line height from font-size if available, else use a default.
      const fontSize = desc.descriptionStyleProperties.get("font-size");
      const lineHeight = fontSize ? parseFloat(fontSize) * 1.4 : 20;
      const lineCount = desc.description.split(/\r\n|\r|\n/).length;
      const blockHeight = lineCount * lineHeight * scaleFactor;

      foPositions.push({
        desc,
        x,
        y: nextY,
        width: foWidth,
        estimatedBottom: nextY + blockHeight,
      });

      nextY += blockHeight;
    }
  }

  if (foPositions.length === 0) return svgString;

  // Calculate how much the SVG needs to expand
  const svgDims = parseSvgDimensions(svgString);
  let minX = 0;
  let maxRight = svgDims.width;
  let maxBottom = svgDims.height;
  for (const fo of foPositions) {
    minX = Math.min(minX, fo.x);
    maxRight = Math.max(maxRight, fo.x + fo.width);
    maxBottom = Math.max(maxBottom, fo.estimatedBottom);
  }

  const leftPad = minX < 0 ? Math.ceil(-minX) : 0;
  const newWidth = Math.ceil(maxRight) + leftPad;
  const newHeight = Math.ceil(maxBottom);

  // Build foreignObject fragments with adjusted x positions
  const fragments = foPositions.map((fo) =>
    buildForeignObject(fo.desc, fo.x + leftPad, fo.y, fo.width, scaleFactor),
  );

  // Update SVG dimensions
  const result = updateSvgDimensions(svgString, newWidth, newHeight);

  // If leftPad > 0, wrap existing SVG content in a <g> to shift it right
  if (leftPad > 0) {
    const openTagEnd = result.indexOf(">") + 1;
    const closingTagIndex = result.lastIndexOf("</svg>");
    if (closingTagIndex === -1) return svgString;

    const before = result.slice(0, openTagEnd);
    const content = result.slice(openTagEnd, closingTagIndex);
    const after = result.slice(closingTagIndex);

    return (
      before +
      `<g transform="translate(${leftPad},0)">` +
      content +
      "</g>" +
      fragments.join("") +
      after
    );
  }

  // No leftPad needed — just insert foreignObjects before </svg>
  const closingTagIndex = result.lastIndexOf("</svg>");
  if (closingTagIndex === -1) return svgString;

  return (
    result.slice(0, closingTagIndex) +
    fragments.join("") +
    result.slice(closingTagIndex)
  );
}
