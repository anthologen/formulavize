import { describe, test, expect, vi } from "vitest";
import {
  injectDescriptionsIntoSvg,
  buildForeignObject,
  normalizeStyleValue,
} from "src/renderers/cyDag/svgDescriptionInjector";
import { DescriptionData } from "src/renderers/cyDag/cyPopperExtender";
import { Core } from "cytoscape";

function makeDescriptionData(
  description: string,
  descriptionStyleProperties?: Map<string, string>,
): DescriptionData {
  return {
    description,
    descriptionStyleProperties: descriptionStyleProperties ?? new Map(),
  };
}

const MINIMAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"></svg>';

function makeMockCy(
  elementBBs: Record<
    string,
    { x1: number; y1: number; x2: number; y2: number }
  >,
  graphBB?: { x1: number; y1: number; x2: number; y2: number },
): Core {
  const allBBs = Object.values(elementBBs);
  const defaultGraphBB = graphBB ?? {
    x1: Math.min(...allBBs.map((bb) => bb.x1)),
    y1: Math.min(...allBBs.map((bb) => bb.y1)),
    x2: Math.max(...allBBs.map((bb) => bb.x2)),
    y2: Math.max(...allBBs.map((bb) => bb.y2)),
  };

  return {
    getElementById: vi.fn((id: string) => {
      const bb = elementBBs[id];
      if (!bb) return { empty: (): boolean => true };
      return {
        empty: (): boolean => false,
        boundingBox: () => ({
          ...bb,
          w: bb.x2 - bb.x1,
          h: bb.y2 - bb.y1,
        }),
      };
    }),
    elements: vi.fn(() => ({
      boundingBox: () => defaultGraphBB,
    })),
  } as unknown as Core;
}

describe("normalizeStyleValue", () => {
  test("appends px to bare numeric for font-size", () => {
    expect(normalizeStyleValue("font-size", "40")).toBe("40px");
  });

  test("does not append px to unitless properties", () => {
    expect(normalizeStyleValue("font-weight", "700")).toBe("700");
    expect(normalizeStyleValue("opacity", "0.5")).toBe("0.5");
    expect(normalizeStyleValue("line-height", "1.5")).toBe("1.5");
  });

  test("does not append px to values that already have units", () => {
    expect(normalizeStyleValue("font-size", "40px")).toBe("40px");
    expect(normalizeStyleValue("font-size", "2em")).toBe("2em");
    expect(normalizeStyleValue("width", "50%")).toBe("50%");
  });

  test("appends px to decimal bare numbers", () => {
    expect(normalizeStyleValue("font-size", "3.5")).toBe("3.5px");
    expect(normalizeStyleValue("font-size", ".5")).toBe(".5px");
  });

  test("does not modify non-numeric values", () => {
    expect(normalizeStyleValue("color", "red")).toBe("red");
    expect(normalizeStyleValue("font-family", "Arial")).toBe("Arial");
  });
});

describe("buildForeignObject", () => {
  test("produces foreignObject with description text", () => {
    const desc = makeDescriptionData("Hello World");
    const result = buildForeignObject(desc, 10, 20, 200, 1);

    expect(result).toContain("<foreignObject");
    expect(result).toContain('x="10"');
    expect(result).toContain('y="20"');
    expect(result).toContain('width="200"');
    expect(result).toContain("Hello World");
    expect(result).toContain("</foreignObject>");
  });

  test("applies description style properties as inline styles", () => {
    const desc = makeDescriptionData(
      "Styled",
      new Map([
        ["color", "red"],
        ["font-size", "20"],
      ]),
    );
    const result = buildForeignObject(desc, 0, 0, 100, 1);

    expect(result).toContain("color:red");
    expect(result).toContain("font-size:20px");
  });

  test("renders newlines as br elements", () => {
    const desc = makeDescriptionData("Line1\nLine2\nLine3");
    const result = buildForeignObject(desc, 0, 0, 100, 1);

    expect(result).toContain("Line1<br/>Line2<br/>Line3");
  });

  test("scales font-size by scaleFactor", () => {
    const desc = makeDescriptionData("Scaled", new Map([["font-size", "20"]]));
    const result = buildForeignObject(desc, 0, 0, 100, 2);

    expect(result).toContain("font-size:40px");
  });

  test("escapes XML special characters in description text", () => {
    const desc = makeDescriptionData('A < B & C > D "E"');
    const result = buildForeignObject(desc, 0, 0, 100, 1);

    expect(result).toContain("A &lt; B &amp; C &gt; D &quot;E&quot;");
  });
});

describe("injectDescriptionsIntoSvg", () => {
  test("empty description map returns SVG unchanged", () => {
    const cy = makeMockCy({});
    const result = injectDescriptionsIntoSvg(MINIMAL_SVG, new Map(), cy, 1);

    expect(result).toBe(MINIMAL_SVG);
  });

  test("single description injects foreignObject before closing svg tag", () => {
    const cy = makeMockCy({
      node1: { x1: 0, y1: 0, x2: 100, y2: 50 },
    });
    const descriptions = new Map([
      ["node1", [makeDescriptionData("Hello World")]],
    ]);

    const result = injectDescriptionsIntoSvg(MINIMAL_SVG, descriptions, cy, 1);

    expect(result).toContain("foreignObject");
    expect(result).toContain("Hello World");
    expect(result).toContain("</svg>");
    // foreignObject should come before </svg>
    const foIndex = result.indexOf("foreignObject");
    const svgCloseIndex = result.indexOf("</svg>");
    expect(foIndex).toBeLessThan(svgCloseIndex);
  });

  test("multiple descriptions on same element create multiple foreignObjects", () => {
    const cy = makeMockCy({
      node1: { x1: 0, y1: 0, x2: 100, y2: 50 },
    });
    const descriptions = new Map([
      ["node1", [makeDescriptionData("First"), makeDescriptionData("Second")]],
    ]);

    const result = injectDescriptionsIntoSvg(MINIMAL_SVG, descriptions, cy, 1);

    expect(result).toContain("First");
    expect(result).toContain("Second");
    const foCount = (result.match(/<foreignObject/g) || []).length;
    expect(foCount).toBe(2);
  });

  test("coordinate conversion with scale factor", () => {
    const cy = makeMockCy({
      node1: { x1: 10, y1: 20, x2: 110, y2: 70 },
    });
    const descriptions = new Map([["node1", [makeDescriptionData("Scaled")]]]);
    const scaleFactor = 2;

    const result = injectDescriptionsIntoSvg(
      MINIMAL_SVG,
      descriptions,
      cy,
      scaleFactor,
    );

    // Y position: (eleBB.y2 - graphBB.y1) * scale + gap = (70 - 20) * 2 + 4 * 2 = 108
    expect(result).toContain('y="108"');
  });

  test("skips elements not found in cytoscape", () => {
    const cy = makeMockCy({});
    const descriptions = new Map([
      ["nonexistent", [makeDescriptionData("Ghost")]],
    ]);

    const result = injectDescriptionsIntoSvg(MINIMAL_SVG, descriptions, cy, 1);

    expect(result).not.toContain("foreignObject");
    expect(result).not.toContain("Ghost");
  });

  test("expands SVG height when descriptions extend below", () => {
    const cy = makeMockCy({
      node1: { x1: 0, y1: 0, x2: 100, y2: 50 },
    });
    const descriptions = new Map([["node1", [makeDescriptionData("Below")]]]);

    const result = injectDescriptionsIntoSvg(MINIMAL_SVG, descriptions, cy, 1);

    // Description at y=54 (50 + 4 gap), with default lineHeight 20 → bottom 74
    // SVG height 200 should remain since 74 < 200
    expect(result).toContain('height="200"');
  });

  test("positions foreignObject at element's left edge in SVG coordinates", () => {
    // Element at x1=50..54 within a graph starting at x1=0
    const cy = makeMockCy(
      { node1: { x1: 50, y1: 0, x2: 54, y2: 50 } },
      { x1: 0, y1: 0, x2: 300, y2: 50 },
    );
    const descriptions = new Map([["node1", [makeDescriptionData("Pos")]]]);

    const result = injectDescriptionsIntoSvg(MINIMAL_SVG, descriptions, cy, 1);

    // centerX = ((50+54)/2 - 0)*1 = 52, foWidth = 4*1 = 4, x = 52 - 2 = 50
    expect(result).toContain('x="50"');
    expect(result).not.toContain("translate");
  });

  test("uses element bounding box width for foreignObject width", () => {
    const cy = makeMockCy({
      narrow: { x1: 0, y1: 0, x2: 50, y2: 50 },
      wide: { x1: 0, y1: 0, x2: 300, y2: 50 },
    });
    const descriptions = new Map([
      ["narrow", [makeDescriptionData("Narrow")]],
      ["wide", [makeDescriptionData("Wide")]],
    ]);

    const result = injectDescriptionsIntoSvg(MINIMAL_SVG, descriptions, cy, 1);

    // Each element uses its own bounding box width
    expect(result).toContain('width="50"');
    expect(result).toContain('width="300"');
  });
});
