import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the organic tab icon is a MailBakes pink camera, not a letter", () => {
  const svg = readFileSync(new URL("../app/icon.svg", import.meta.url), "utf8");
  assert.match(svg, /#ED217A/);
  assert.match(svg, /<circle /);
  assert.match(svg, /M14\.5 4h-5/);
  assert.doesNotMatch(svg, /<text[\s>]/i);
  assert.doesNotMatch(svg, />[GPROMR]</);
});

test("organic does not serve the Growth paid-ads or retention icons", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  for (const source of [layout, middleware]) {
    assert.doesNotMatch(source, /paidads\/icon|retention\/icon|markSvg/);
    assert.doesNotMatch(source, /growth\/src/);
  }
});
