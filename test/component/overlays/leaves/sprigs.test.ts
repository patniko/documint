import { describe, expect, test } from "bun:test";
import { createStore } from "@/component/store";
import { cursorLeafSprig, pointerViewSprig } from "@/component/overlays/leaves/sprigs";
import {
  createLayoutCache,
  getDocument,
  createEditorLayoutState,
  type EditorHoverTarget,
} from "@/editor";
import { addComment } from "@/editor/state";
import { getRegion, placeAt, setup } from "@test/editor/helpers";

describe("overlay leaf sprigs", () => {
  test("shows pointer comment leaves in the default trigger mode", () => {
    const { store } = setupCommentedText();
    const target: EditorHoverTarget = {
      commentThreadIndex: 0,
      kind: "text",
    };

    const view = pointerViewSprig.read(store, target, "hover-or-caret");

    expect(view.commentThreadIndex).toBe(0);
    expect(view.leaf?.kind).toBe("thread");
  });

  test("suppresses pointer comment leaves in caret trigger mode", () => {
    const { store } = setupCommentedText();
    const target: EditorHoverTarget = {
      commentThreadIndex: 0,
      kind: "text",
    };

    const view = pointerViewSprig.read(store, target, "caret");

    expect(view.commentThreadIndex).toBe(0);
    expect(view.leaf).toBeNull();
    expect(view.cursor).toBe("text");
  });

  test("keeps commented link leaves available in caret trigger mode", () => {
    let state = setup("Review [Docs](https://example.com) now\n");
    const region = getRegion(state, "Review Docs now");
    const startOffset = region.text.indexOf("Docs");
    const endOffset = startOffset + "Docs".length;
    state =
      addComment(
        state,
        {
          endOffset,
          regionId: region.id,
          startOffset,
        },
        "note",
      ) ?? state;
    const store = createStore(getDocument(state));
    const target: EditorHoverTarget = {
      commentThreadIndex: 0,
      endOffset,
      kind: "link",
      regionId: region.id,
      startOffset,
      title: null,
      url: "https://example.com",
    };

    const view = pointerViewSprig.read(store, target, "caret");

    expect(view.commentThreadIndex).toBe(0);
    expect(view.leaf).toMatchObject({
      kind: "link",
      url: "https://example.com",
    });
    expect(view.cursor).toBe("pointer");
  });

  test("keeps commented resource targeting without a comment leaf in caret trigger mode", () => {
    const { region, store } = setupCommentedText();
    const target: EditorHoverTarget = {
      commentThreadIndex: 0,
      kind: "resource",
      label: "Recording",
      protocol: "demo-resource:",
      regionId: region.id,
      url: "demo-resource://recording/live",
    };

    const view = pointerViewSprig.read(store, target, "caret");

    expect(view.commentThreadIndex).toBe(0);
    expect(view.leaf).toBeNull();
    expect(view.cursor).toBe("pointer");
  });

  test("prefers cursor link leaves over table leaves", () => {
    const state = setup("| Label |\n| --- |\n| [Docs](https://example.com) |\n");
    const region = getRegion(state, "Docs");
    const selected = placeAt(state, region, 1);
    const store = createStore(getDocument(selected));
    const layout = createLayout(selected);

    store.editor.replace(selected);
    store.layout.setLayoutResolver(() => layout);
    store.layout.commit();

    expect(cursorLeafSprig.read(store, true)?.kind).toBe("link");
  });

  test("prefers cursor comment leaves over table leaves", () => {
    let state = setup("| Label |\n| --- |\n| Review target |\n");
    const region = getRegion(state, "Review target");
    state =
      addComment(
        state,
        {
          endOffset: "Review".length,
          regionId: region.id,
          startOffset: 0,
        },
        "note",
      ) ?? state;
    state = placeAt(state, getRegion(state, "Review target"), 2);
    const store = createStore(getDocument(state));
    const layout = createLayout(state);

    store.editor.replace(state);
    store.layout.setLayoutResolver(() => layout);
    store.layout.commit();

    expect(cursorLeafSprig.read(store, true)?.kind).toBe("thread");
  });
});

function createLayout(state: ReturnType<typeof setup>) {
  return createEditorLayoutState(
    state,
    {
      height: 320,
      paddingX: 0,
      paddingY: 0,
      top: 0,
      width: 640,
    },
    createLayoutCache(),
    null,
  );
}

function setupCommentedText() {
  let state = setup("Review target\n");
  const region = getRegion(state, "Review target");
  state =
    addComment(
      state,
      {
        endOffset: "Review".length,
        regionId: region.id,
        startOffset: 0,
      },
      "note",
    ) ?? state;

  return {
    region,
    state,
    store: createStore(getDocument(state)),
  };
}
