// Owns per-editor caches for layout measurement artifacts. The component host
// keeps one cache per editor instance and threads it through layout calls,
// without leaking that lifetime into the immutable editor model.

import type { PreparedTextWithSegments } from "@chenglou/pretext";
import type { DocumentIndex } from "../../state";
import type { LineBoundary } from "../measure";

export type VirtualLayout = {
  containerIndices: Map<string, number>;
  entries: Array<{
    bottom: number;
    top: number;
  }>;
  estimateRegionBounds: (regionId: string) => { bottom: number; top: number } | null;
  // Snapshot of `cache.measurementVersion` when this virtualLayout was built.
  // Consumers compare against the live cache counter to detect when newly
  // measured container heights have invalidated the cached entries, and
  // trigger a deterministic rebuild from the updated cache.
  measurementVersion: number;
  totalHeight: number;
};

export type LayoutCache = {
  graphemeWidths: Map<string, Map<string, number>>;
  lineBoundaries: Map<string, LineBoundary[]>;
  measuredContainerHeights: Map<string, number>;
  // Monotonically increasing counter bumped on every effective change to
  // `measuredContainerHeights` (insert with a different value, value update,
  // or LRU eviction). Cached `VirtualLayout` instances stamp the version at
  // build time so subsequent reads can tell whether the cache state they
  // were built from is still current — without that signal, the cached
  // entries drift from the canonical "sum of cached heights" geometry as
  // scrolling accrues new measurements.
  measurementVersion: number;
  measuredLines: Map<
    string,
    Array<{
      end: number;
      height: number;
      start: number;
      text: string;
      width: number;
    }>
  >;
  preparedText: Map<string, PreparedTextWithSegments>;
  virtualLayouts: WeakMap<DocumentIndex, Map<string, VirtualLayout>>;
};

const MAX_PREPARED_TEXT_ENTRIES = 256;
const MAX_MEASURED_LINE_ENTRIES = 512;
const MAX_LINE_BOUNDARY_ENTRIES = 1024;
const MAX_MEASURED_CONTAINER_HEIGHT_ENTRIES = 1024;
const MAX_GRAPHEME_FONT_ENTRIES = 64;

export function createLayoutCache(): LayoutCache {
  return {
    graphemeWidths: new Map(),
    lineBoundaries: new Map(),
    measuredContainerHeights: new Map(),
    measurementVersion: 0,
    measuredLines: new Map(),
    preparedText: new Map(),
    virtualLayouts: new WeakMap(),
  };
}

export function cachePreparedText(
  cache: LayoutCache,
  key: string,
  value: PreparedTextWithSegments,
) {
  return cacheBoundedValue(cache.preparedText, key, value, MAX_PREPARED_TEXT_ENTRIES);
}

export function cacheMeasuredLines(
  cache: LayoutCache,
  key: string,
  value: Array<{
    end: number;
    height: number;
    start: number;
    text: string;
    width: number;
  }>,
) {
  return cacheBoundedValue(cache.measuredLines, key, value, MAX_MEASURED_LINE_ENTRIES);
}

export function cacheLineBoundaries(cache: LayoutCache, key: string, value: LineBoundary[]) {
  return cacheBoundedValue(cache.lineBoundaries, key, value, MAX_LINE_BOUNDARY_ENTRIES);
}

export function cacheMeasuredContainerHeight(cache: LayoutCache, key: string, value: number) {
  const existing = cache.measuredContainerHeights.get(key);

  // Bump the version on any effective measurement change so cached virtual
  // layouts rebuild deterministically on the next read:
  //   - `existing !== value` covers both updates (different number for the
  //     same key) and new keys (where `existing === undefined`). A new key
  //     also covers the eviction case: a fresh insert that pushes the cache
  //     over its bound silently drops the oldest entry, and the dropped
  //     entry's loss is itself a measurement change.
  //   - When `existing === value` the call is a pure no-op for the cache's
  //     observable state (the bounded map's LRU reordering doesn't change
  //     which heights are visible), so we skip the bump to avoid forcing
  //     unnecessary virtual-layout rebuilds.
  if (existing !== value) {
    cache.measurementVersion += 1;
  }

  return cacheBoundedValue(
    cache.measuredContainerHeights,
    key,
    value,
    MAX_MEASURED_CONTAINER_HEIGHT_ENTRIES,
  );
}

export function getOrCreateGraphemeWidthCache(cache: LayoutCache, font: string) {
  const existing = cache.graphemeWidths.get(font);

  if (existing) {
    return existing;
  }

  const next = new Map<string, number>();
  cacheBoundedValue(cache.graphemeWidths, font, next, MAX_GRAPHEME_FONT_ENTRIES);

  return next;
}

export function getVirtualLayout(cache: LayoutCache, documentIndex: DocumentIndex, key: string) {
  return cache.virtualLayouts.get(documentIndex)?.get(key) ?? null;
}

export function setVirtualLayout(
  cache: LayoutCache,
  documentIndex: DocumentIndex,
  key: string,
  value: VirtualLayout,
) {
  const current = cache.virtualLayouts.get(documentIndex) ?? new Map<string, VirtualLayout>();

  current.set(key, value);
  cache.virtualLayouts.set(documentIndex, current);

  return value;
}

function cacheBoundedValue<Key, Value>(
  cache: Map<Key, Value>,
  key: Key,
  value: Value,
  maxEntries: number,
) {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);

  if (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value as Key | undefined;

    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  return value;
}
