export type DocumintLeafPlacement = "inline" | "side-column";

export type DocumintSideColumnOptions = {
  gap?: number;
  minTextWidth?: number;
  width?: number;
};

export type ResolvedSideColumn = {
  gap: number;
  left: number;
  outerLeft: number;
  outerWidth: number;
  placement: DocumintLeafPlacement;
  textWidth: number;
  width: number;
};

const DEFAULT_SIDE_COLUMN_GAP = 16;
const DEFAULT_SIDE_COLUMN_MIN_TEXT_WIDTH = 360;
const DEFAULT_SIDE_COLUMN_WIDTH = 320;

export function resolveSideColumnLayout({
  placement = "inline",
  sideColumn,
  surfaceWidth,
}: {
  placement?: DocumintLeafPlacement;
  sideColumn?: DocumintSideColumnOptions;
  surfaceWidth: number;
}): ResolvedSideColumn {
  const width = resolvePositiveNumber(sideColumn?.width, DEFAULT_SIDE_COLUMN_WIDTH);
  const gap = resolveNonNegativeNumber(sideColumn?.gap, DEFAULT_SIDE_COLUMN_GAP);
  const minTextWidth = resolvePositiveNumber(
    sideColumn?.minTextWidth,
    DEFAULT_SIDE_COLUMN_MIN_TEXT_WIDTH,
  );
  const textWidth = Math.max(0, Math.floor(surfaceWidth - width - gap));

  if (placement !== "side-column" || textWidth < minTextWidth) {
    return {
      gap: 0,
      left: surfaceWidth,
      outerLeft: surfaceWidth,
      outerWidth: 0,
      placement: "inline",
      textWidth: surfaceWidth,
      width: 0,
    };
  }

  return {
    gap,
    left: textWidth + gap,
    outerLeft: textWidth,
    outerWidth: gap + width,
    placement: "side-column",
    textWidth,
    width,
  };
}

function resolvePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function resolveNonNegativeNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}
