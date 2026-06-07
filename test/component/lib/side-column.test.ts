import { describe, expect, test } from "bun:test";
import { resolveSideColumnLayout } from "@/component/lib/side-column";

describe("resolveSideColumnLayout", () => {
  test("keeps inline placement as the default", () => {
    expect(resolveSideColumnLayout({ surfaceWidth: 900 })).toEqual({
      gap: 0,
      left: 900,
      outerLeft: 900,
      outerWidth: 0,
      placement: "inline",
      textWidth: 900,
      width: 0,
    });
  });

  test("reserves a right rail when side-column mode fits", () => {
    expect(resolveSideColumnLayout({ placement: "side-column", surfaceWidth: 900 })).toEqual({
      gap: 16,
      left: 580,
      outerLeft: 564,
      outerWidth: 336,
      placement: "side-column",
      textWidth: 564,
      width: 320,
    });
  });

  test("falls back to inline placement when the text area would be too narrow", () => {
    expect(resolveSideColumnLayout({ placement: "side-column", surfaceWidth: 680 })).toEqual({
      gap: 0,
      left: 680,
      outerLeft: 680,
      outerWidth: 0,
      placement: "inline",
      textWidth: 680,
      width: 0,
    });
  });

  test("honors integrator sizing options", () => {
    expect(
      resolveSideColumnLayout({
        placement: "side-column",
        sideColumn: { gap: 24, minTextWidth: 420, width: 280 },
        surfaceWidth: 760,
      }),
    ).toEqual({
      gap: 24,
      left: 480,
      outerLeft: 456,
      outerWidth: 304,
      placement: "side-column",
      textWidth: 456,
      width: 280,
    });
  });

  test("ignores invalid sizing options", () => {
    expect(
      resolveSideColumnLayout({
        placement: "side-column",
        sideColumn: { gap: -8, minTextWidth: 0, width: Number.NaN },
        surfaceWidth: 900,
      }),
    ).toEqual({
      gap: 16,
      left: 580,
      outerLeft: 564,
      outerWidth: 336,
      placement: "side-column",
      textWidth: 564,
      width: 320,
    });
  });
});
