// Owns large-document layout virtualization: whole-document height estimates,
// viewport slice selection, exact slice measurement, and deterministic
// rebuild of cached estimates from newly measured container heights.

import type { DocumentResources } from "@/types";
import { type DocumentIndex, type EditorState } from "../../state";
import { type LayoutCache } from "../state/cache";
import type { DocumentLayoutOptions } from "../lib/options";
import { measureLayoutSlice, type DocumentLayout } from "../measure";
import {
  expandViewportSliceToBlockBoundaries,
  findVirtualLayoutEntryIndexAtOrAfter,
  updateMeasuredContainerHeights,
} from "./viewport-slice";
import { getOrCreateVirtualLayout } from "./virtual-layout";

type VirtualizedViewport = {
  height: number;
  overscan: number;
  top: number;
};

export type VirtualizedLayoutSlice = {
  estimateRegionBounds: (regionId: string) => { bottom: number; top: number } | null;
  layout: DocumentLayout;
  totalHeight: number;
};

export function createVirtualizedLayoutSlice({
  cache,
  documentIndex,
  options,
  resources,
  state,
  viewport,
}: {
  cache: LayoutCache;
  documentIndex: DocumentIndex;
  options: DocumentLayoutOptions;
  resources: DocumentResources;
  state: EditorState;
  viewport: VirtualizedViewport;
}): VirtualizedLayoutSlice {
  const expandedTop = Math.max(0, viewport.top - viewport.overscan);
  const expandedBottom = viewport.top + viewport.height + viewport.overscan;
  const virtualLayout = getOrCreateVirtualLayout(cache, documentIndex, options, resources);
  let sliceStartIndex = findVirtualLayoutEntryIndexAtOrAfter(virtualLayout, expandedTop);
  let sliceEndIndex = findVirtualLayoutEntryIndexAtOrAfter(virtualLayout, expandedBottom);

  if (sliceStartIndex > 0) {
    const previous = virtualLayout.entries[sliceStartIndex - 1];

    if (previous && previous.bottom > expandedTop) {
      sliceStartIndex -= 1;
    }
  }

  if (sliceEndIndex < virtualLayout.entries.length) {
    const next = virtualLayout.entries[sliceEndIndex];

    if (next && next.top < expandedBottom) {
      sliceEndIndex += 1;
    }
  }

  const pinTop = Math.max(0, expandedTop - viewport.overscan);
  const pinBottom = expandedBottom + viewport.overscan;
  const pinned = new Set([state.selection.anchor.regionId, state.selection.focus.regionId]);

  for (const regionId of pinned) {
    const index = virtualLayout.containerIndices.get(regionId);
    const bounds = virtualLayout.estimateRegionBounds(regionId);

    if (index === undefined || !bounds) {
      continue;
    }

    if (bounds.bottom < pinTop || bounds.top > pinBottom) {
      continue;
    }

    sliceStartIndex = Math.min(sliceStartIndex, index);
    sliceEndIndex = Math.max(sliceEndIndex, index + 1);
  }

  let layout: DocumentLayout;
  let activeVirtualLayout = virtualLayout;

  if (!Number.isFinite(sliceStartIndex) || !Number.isFinite(sliceEndIndex)) {
    layout = measureLayoutSlice(
      {
        ...documentIndex,
        regions: [],
      },
      options,
      cache,
      resources,
    );
  } else {
    const expandedSlice = expandViewportSliceToBlockBoundaries(
      documentIndex,
      virtualLayout.containerIndices,
      sliceStartIndex,
      sliceEndIndex,
    );
    const sliceTop = virtualLayout.entries[expandedSlice.startIndex]?.top ?? options.paddingY;
    // Seed measurement at the slice's document-space top so geometry is
    // produced directly in document coordinates — no post-shift needed.
    // Override `height` with the full-document estimate so consumers that
    // read `layout.height` (scrollbars, paint extents) see the doc height,
    // not the slice height.
    const sliceLayout = measureLayoutSlice(
      {
        ...documentIndex,
        regions: documentIndex.regions.slice(expandedSlice.startIndex, expandedSlice.endIndex),
      },
      options,
      cache,
      resources,
      sliceTop,
    );

    layout = { ...sliceLayout, height: virtualLayout.totalHeight };

    updateMeasuredContainerHeights(cache, documentIndex, layout, options, resources);

    // Re-resolve the virtual layout after the slice has been measured. The
    // measurement may have written new heights to the measured-container-
    // height cache, which bumps `cache.measurementVersion`; that signals
    // `getOrCreateVirtualLayout` to rebuild deterministically from the
    // updated cache instead of mutating the previously cached entries via
    // an order-dependent offset propagation. Regions before the slice
    // weren't measured in this pass, so their cumulative top is unchanged
    // and the slice's `regionBounds` (anchored at `sliceTop`) stay aligned
    // with the rebuilt `entries[expandedSlice.startIndex].top`.
    activeVirtualLayout = getOrCreateVirtualLayout(cache, documentIndex, options, resources);

    if (activeVirtualLayout !== virtualLayout) {
      layout = { ...layout, height: activeVirtualLayout.totalHeight };
    }
  }

  return {
    estimateRegionBounds: activeVirtualLayout.estimateRegionBounds,
    layout,
    totalHeight: activeVirtualLayout.totalHeight,
  };
}
