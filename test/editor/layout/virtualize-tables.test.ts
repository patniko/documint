import { expect, test } from "bun:test";
import { createEditorLayoutState, createLayoutCache } from "@/editor";
import { createEditorState } from "@/editor/state";
import { parseDocument } from "@/markdown";

// Generates a virtualized fixture dominated by tables interleaved with prose
// to exercise the cache-aware table row estimate path. Tables expand the
// active viewport slice to whole rows in
// `expandViewportSliceToBlockBoundaries`, and removing the in-place
// refinement that previously synced table cell entries to measured row
// heights would silently break virtualized table convergence without a
// table-aware estimator.
function createTableFixture(sectionCount: number): string {
  const sections: string[] = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const number = index + 1;
    sections.push(`## Section ${number}`);
    sections.push("");
    sections.push(`Intro paragraph ${number} explaining the table below it.`);
    sections.push("");
    sections.push("| Item | Owner | Status | Notes |");
    sections.push("| ---- | ----- | ------ | ----- |");
    sections.push(
      `| Topic ${number}.a | Demo | Active | This row has a long note that should wrap across multiple visual lines to exercise per-row height variability. |`,
    );
    sections.push(`| Topic ${number}.b | Demo | Open | Shorter note. |`);
    sections.push(
      `| Topic ${number}.c | Demo | Done | Another note with moderate length to drive different row heights. |`,
    );
    sections.push("");
  }
  return sections.join("\n");
}

const markdown = createTableFixture(20);
const positions = [0, 200, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
const viewportOptions = { height: 720, width: 800 };

function buildState() {
  return createEditorState(parseDocument(markdown));
}

test("table-heavy virtualized fixture is large enough to be virtualized", () => {
  const state = buildState();
  expect(state.documentIndex.regions.length).toBeGreaterThan(96);
});

test("table-heavy virtualized totalHeight converges to a stable value", () => {
  const state = buildState();
  const cache = createLayoutCache();
  let lastHeight = 0;
  for (const top of positions) {
    lastHeight = createEditorLayoutState(state, { ...viewportOptions, top }, cache).totalHeight;
  }
  for (const top of positions) {
    const height = createEditorLayoutState(state, { ...viewportOptions, top }, cache).totalHeight;
    expect(height).toBe(lastHeight);
  }
});

test("table-heavy virtualized totalHeight is independent of scroll-visit order", () => {
  // To compare apples to apples, both caches must end up with the same set
  // of measured container heights. Scrolling forward then backward in each
  // cache (but in opposite orders) ensures both have visited every slice,
  // even though the *order* of warming differs. With deterministic rebuild
  // from cached heights, both caches must produce the same totalHeight.
  const forwardThenBackward = [...positions, ...[...positions].reverse()];
  const backwardThenForward = [...[...positions].reverse(), ...positions];

  const stateA = buildState();
  const cacheA = createLayoutCache();
  for (const top of forwardThenBackward) {
    createEditorLayoutState(stateA, { ...viewportOptions, top }, cacheA);
  }
  const heightA = createEditorLayoutState(
    stateA,
    { ...viewportOptions, top: 0 },
    cacheA,
  ).totalHeight;

  const stateB = buildState();
  const cacheB = createLayoutCache();
  for (const top of backwardThenForward) {
    createEditorLayoutState(stateB, { ...viewportOptions, top }, cacheB);
  }
  const heightB = createEditorLayoutState(
    stateB,
    { ...viewportOptions, top: 0 },
    cacheB,
  ).totalHeight;

  expect(heightA).toBe(heightB);
});
