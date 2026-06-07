import type { PointerEventHandler } from "react";
import type { DocumentLeafBase, DocumentLeafResolution } from "./shared";
import type { DocumintLeafPlacement, ResolvedSideColumn } from "../../../lib/side-column";

export type MeasuredLeafTarget = {
  height: number;
  left: number;
  top: number;
};

export type LeafPlacementContext = {
  hostScrollX: number;
  hostScrollY: number;
  scrollContainerLeft: number;
  scrollContainerTop: number;
  sideColumn: ResolvedSideColumn;
  viewportHeight: number;
  viewportTop: number;
};

export function resolveDocumentLeafResolution({
  context,
  isHoverLeaf,
  leaf,
  measured,
  onPointerEnter,
  onPointerLeave,
  placement,
}: {
  context: LeafPlacementContext;
  isHoverLeaf: boolean;
  leaf: DocumentLeafBase;
  measured: MeasuredLeafTarget;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
  placement: DocumintLeafPlacement;
}): DocumentLeafResolution | null {
  const inlineBottom = measured.top + measured.height;
  const viewportBottom = context.viewportTop + context.viewportHeight;

  if (
    placement === "inline" &&
    (inlineBottom <= context.viewportTop || inlineBottom >= viewportBottom)
  ) {
    return null;
  }

  return {
    anchorHeight: measured.height,
    bridge: isHoverLeaf,
    left:
      context.scrollContainerLeft +
      context.hostScrollX +
      (placement === "side-column"
        ? context.sideColumn.left
        : (leaf.leftOverride ?? measured.left)),
    onPointerEnter: isHoverLeaf ? onPointerEnter : undefined,
    onPointerLeave: isHoverLeaf ? onPointerLeave : undefined,
    paddingY: leaf.paddingY ?? 0,
    placement,
    top:
      context.scrollContainerTop +
      context.hostScrollY +
      (placement === "side-column" ? measured.top : inlineBottom) -
      context.viewportTop,
    width: placement === "side-column" ? context.sideColumn.width : undefined,
  };
}
