import { expect, test } from "bun:test";
import { createEditorLayoutState, createLayoutCache } from "@/editor";
import { createEditorState } from "@/editor/state";
import { parseDocument } from "@/markdown";

// Generates a virtualized fixture (>FULL_LAYOUT_REGION_THRESHOLD regions)
// with a mix of headings, paragraphs, lists, and a broken image. The
// estimate vs measured drift on each region drives the bug this test
// guards against: the order-dependent in-place refinement of
// `virtualLayout.entries` used to produce a different `totalHeight`
// depending on the sequence of scroll positions the cache was warmed at.
function createScrollFixture(sectionCount: number): string {
  const sections: string[] = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const number = index + 1;
    sections.push(`## Section ${number}`);
    sections.push("");
    sections.push(
      `Body paragraph ${number} with enough prose to wrap across a couple of lines at the test viewport width while still behaving like ordinary content.`,
    );
    sections.push("");
    sections.push(`- Bullet ${number}.a captures the current behavior in a short note.`);
    sections.push(`- Bullet ${number}.b follows up with the next concrete decision.`);
    sections.push(`- Bullet ${number}.c keeps enough context nearby for future edits.`);
    sections.push("");
    if (index === Math.floor(sectionCount / 2)) {
      sections.push("![](missing/broken.png)");
      sections.push("");
    }
  }
  return sections.join("\n");
}

const markdown = createScrollFixture(40);
const positions = [0, 200, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
const viewportOptions = { height: 720, width: 800 };

function buildState() {
  return createEditorState(parseDocument(markdown));
}

test("virtualized fixture exercises the broken-image, large-doc path", () => {
  const state = buildState();
  // Must remain virtualized (>= FULL_LAYOUT_REGION_THRESHOLD = 96 regions)
  // and contain at least one image so the broken-image fallback is covered.
  expect(state.documentIndex.regions.length).toBeGreaterThan(96);
  expect(state.documentIndex.imageUrls.size).toBeGreaterThan(0);
});

test("virtualized totalHeight is stable when re-creating layout at the same scroll positions", () => {
  const state = buildState();
  const cache = createLayoutCache();

  // First pass warms the measured-container-height cache by visiting every
  // scroll position once.
  let lastHeight = 0;
  for (const top of positions) {
    lastHeight = createEditorLayoutState(state, { ...viewportOptions, top }, cache).totalHeight;
  }

  // Second pass: with all regions measured, every position must report the
  // same `totalHeight`. Before the deterministic-rebuild fix this would
  // oscillate because `refineVirtualLayoutWithMeasuredSlice` mutated
  // entries with an order-dependent offset accumulator each frame.
  for (const top of positions) {
    const height = createEditorLayoutState(state, { ...viewportOptions, top }, cache).totalHeight;
    expect(height).toBe(lastHeight);
  }
});

test("virtualized totalHeight is independent of scroll-visit order", () => {
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
