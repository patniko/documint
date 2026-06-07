// The leaf overlay primitive — a positioned, themed floating frame for
// any leaf-level surface (comment thread, link editor, table editor,
// insertion menu). Three visual layers:
//
//   1. OverlayPortal — host-app-defended placement, theme cascade
//   2. Anchor frame  — viewport positioning, optional hover bridge
//   3. Leaf shell    — bordered, shadowed container
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { OverlayPortal } from "../../OverlayPortal";
import type { DocumentLeafResolution } from "./shared";

// Pixel height of the hover bridge. JS-owned: written inline as
// `--documint-leaf-bridge-height` so styles.css has one source of truth.
export const LEAF_BRIDGE_HEIGHT = 12;

type DocumentLeafAnchorProps = {
  anchor: DocumentLeafResolution;
  children: ReactNode;
};

type DocumentLeafAnchorPlacement = {
  horizontalOffset: number;
  topOffset: number;
  verticalPlacement: "above" | "below";
};

type LeafShellSize = {
  height: number;
  width: number;
};

const DEFAULT_PLACEMENT: DocumentLeafAnchorPlacement = {
  horizontalOffset: 0,
  topOffset: 0,
  verticalPlacement: "below",
};

export function DocumentLeafAnchor({ anchor, children }: DocumentLeafAnchorProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const shellSizeRef = useRef<LeafShellSize | null>(null);
  const latestAnchorRef = useRef(anchor);
  const [placement, setPlacement] = useState<DocumentLeafAnchorPlacement>(DEFAULT_PLACEMENT);
  latestAnchorRef.current = anchor;

  // Anchor moves reuse shell size cached by ResizeObserver, avoiding a
  // shell layout read on scroll-only updates.
  useLayoutEffect(() => {
    const shellSize = shellSizeRef.current;
    if (!shellSize) {
      return;
    }

    setPlacement((current) => {
      const next = resolveLeafPlacement(anchor, shellSize);
      return arePlacementsEqual(current, next) ? current : next;
    });
  }, [anchor.left, anchor.placement, anchor.top]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const evaluatePlacement = () => {
      const bounds = shell.getBoundingClientRect();
      const shellSize = { height: bounds.height, width: bounds.width };
      shellSizeRef.current = shellSize;
      setPlacement((current) => {
        const next = resolveLeafPlacement(latestAnchorRef.current, shellSize);
        return arePlacementsEqual(current, next) ? current : next;
      });
    };

    evaluatePlacement();

    // Screen-space changes can also alter fit/flip decisions. Page scroll is
    // handled by the anchor-move effect above, using the cached shell size.
    const resizeObserver = new ResizeObserver(evaluatePlacement);
    resizeObserver.observe(shell);
    window.visualViewport?.addEventListener("resize", evaluatePlacement);
    window.addEventListener("resize", evaluatePlacement);

    return () => {
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener("resize", evaluatePlacement);
      window.removeEventListener("resize", evaluatePlacement);
    };
  }, []);

  return (
    <OverlayPortal>
      <div
        className="documint-leaf-anchor"
        data-bridge={anchor.bridge}
        data-placement-mode={anchor.placement}
        data-placement={placement.verticalPlacement}
        onPointerEnter={anchor.onPointerEnter}
        onPointerLeave={anchor.onPointerLeave}
        style={
          {
            left: `${anchor.left + placement.horizontalOffset}px`,
            top: `${anchor.top + placement.topOffset}px`,
            "--documint-leaf-anchor-height": `${anchor.anchorHeight}px`,
            "--documint-leaf-bridge-height": `${LEAF_BRIDGE_HEIGHT}px`,
            "--documint-leaf-padding-y": `${anchor.paddingY}px`,
            "--documint-leaf-width": anchor.width ? `${anchor.width}px` : undefined,
          } as CSSProperties
        }
      >
        {anchor.bridge ? <div className="documint-leaf-bridge" /> : null}
        <div className="documint-leaf-shell" ref={shellRef}>
          {children}
        </div>
      </div>
    </OverlayPortal>
  );
}

function resolveLeafPlacement(
  anchor: DocumentLeafResolution,
  shellSize: LeafShellSize,
): DocumentLeafAnchorPlacement {
  const visualVp = window.visualViewport;
  const visibleWidth = visualVp?.width ?? window.innerWidth;
  const visibleHeight = visualVp?.height ?? window.innerHeight;
  const visualOffsetLeft = visualVp?.offsetLeft ?? 0;
  const visualOffsetTop = visualVp?.offsetTop ?? 0;

  if (anchor.placement === "side-column") {
    return resolveSideColumnLeafPlacement(anchor, shellSize, visibleHeight, visualOffsetTop);
  }

  // Anchor coordinates are page-space; convert to visible-viewport
  // relative to ask where the shell fits.
  const anchorScreenLeft = anchor.left - window.scrollX - visualOffsetLeft;
  const anchorScreenTop = anchor.top - window.scrollY - visualOffsetTop;
  const spaceBelow = visibleHeight - anchorScreenTop;

  return {
    horizontalOffset: resolveHorizontalOffset({
      anchorScreenLeft,
      shellWidth: shellSize.width,
      visibleWidth,
    }),
    topOffset: 0,
    verticalPlacement: shellSize.height + LEAF_BRIDGE_HEIGHT > spaceBelow ? "above" : "below",
  };
}

function resolveSideColumnLeafPlacement(
  anchor: DocumentLeafResolution,
  shellSize: LeafShellSize,
  visibleHeight: number,
  visualOffsetTop: number,
): DocumentLeafAnchorPlacement {
  const viewportPadding = 8;
  const minTop = window.scrollY + visualOffsetTop + viewportPadding;
  const maxTop = Math.max(
    minTop,
    window.scrollY + visualOffsetTop + visibleHeight - shellSize.height - viewportPadding,
  );
  const clampedTop = Math.min(Math.max(anchor.top, minTop), maxTop);

  return {
    horizontalOffset: 0,
    topOffset: clampedTop - anchor.top,
    verticalPlacement: "below",
  };
}

function resolveHorizontalOffset({
  anchorScreenLeft,
  shellWidth,
  visibleWidth,
}: {
  anchorScreenLeft: number;
  shellWidth: number;
  visibleWidth: number;
}): number {
  const spaceRight = visibleWidth - anchorScreenLeft;

  if (shellWidth <= spaceRight) {
    return 0;
  }

  return Math.max(
    -anchorScreenLeft,
    Math.min(-shellWidth / 2, visibleWidth - anchorScreenLeft - shellWidth),
  );
}

function arePlacementsEqual(
  left: DocumentLeafAnchorPlacement,
  right: DocumentLeafAnchorPlacement,
): boolean {
  return (
    left.horizontalOffset === right.horizontalOffset &&
    left.topOffset === right.topOffset &&
    left.verticalPlacement === right.verticalPlacement
  );
}
