import assert from "node:assert/strict";
import test from "node:test";
import { markSvg } from "./marks.ts";

test("tab marks are a pink rounded square with a white line icon", () => {
  for (const kind of ["megaphone", "repeat"] as const) {
    const svg = markSvg(kind);
    assert.match(svg, /fill="#ED217A"/);
    assert.match(svg, /rx="8"/);
    assert.match(svg, /stroke="#ffffff"/);
    assert.equal(svg.includes("😀"), false);
  }
});
