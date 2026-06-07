import { describe, expect, test } from "bun:test";
import { resolveDocumentLeafResolution } from "@/component/overlays/leaves/core/placement";
import type { ResolvedSideColumn } from "@/component/lib/side-column";

const sideColumn: ResolvedSideColumn = {
  gap: 16,
  left: 580,
  outerLeft: 564,
  outerWidth: 336,
  placement: "side-column",
  textWidth: 564,
  width: 320,
};

const baseContext = {
  hostScrollX: 3,
  hostScrollY: 5,
  scrollContainerLeft: 10,
  scrollContainerTop: 20,
  sideColumn,
  viewportHeight: 300,
  viewportTop: 40,
};

const leaf = {
  anchor: { regionId: "r1", offset: 4 },
};

const measured = {
  height: 18,
  left: 120,
  top: 80,
};

describe("resolveDocumentLeafResolution", () => {
  test("keeps inline leaves near their measured document anchor", () => {
    expect(
      resolveDocumentLeafResolution({
        context: baseContext,
        isHoverLeaf: false,
        leaf,
        measured,
        placement: "inline",
      }),
    ).toMatchObject({
      anchorHeight: 18,
      bridge: false,
      left: 133,
      paddingY: 0,
      placement: "inline",
      top: 83,
      width: undefined,
    });
  });

  test("pins side-column leaves into the rail while preserving vertical alignment", () => {
    expect(
      resolveDocumentLeafResolution({
        context: baseContext,
        isHoverLeaf: true,
        leaf,
        measured,
        placement: "side-column",
      }),
    ).toMatchObject({
      anchorHeight: 18,
      bridge: true,
      left: 593,
      paddingY: 0,
      placement: "side-column",
      top: 65,
      width: 320,
    });
  });

  test("hides inline leaves outside the visible viewport", () => {
    expect(
      resolveDocumentLeafResolution({
        context: baseContext,
        isHoverLeaf: false,
        leaf,
        measured: { height: 18, left: 120, top: 340 },
        placement: "inline",
      }),
    ).toBeNull();
  });

  test("keeps side-column leaves resolvable for anchor clamping", () => {
    expect(
      resolveDocumentLeafResolution({
        context: baseContext,
        isHoverLeaf: false,
        leaf,
        measured: { height: 18, left: 120, top: 340 },
        placement: "side-column",
      }),
    ).toMatchObject({
      left: 593,
      placement: "side-column",
      top: 325,
      width: 320,
    });
  });
});
