import assert from "node:assert/strict";
import test from "node:test";
import { safeFilename, sniffDesign } from "./files.ts";

test("design uploads accept png, jpeg, webp, and html only", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(sniffDesign(png).ok && sniffDesign(png).mime, "image/png");
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(sniffDesign(jpeg).ok && sniffDesign(jpeg).mime, "image/jpeg");
  const webp = new Uint8Array(12);
  webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(sniffDesign(webp).ok && sniffDesign(webp).mime, "image/webp");
  const html = new TextEncoder().encode("<!DOCTYPE html><html><body><table></table></body></html>");
  assert.equal(sniffDesign(html).ok && sniffDesign(html).mime, "text/html");
  assert.equal(sniffDesign(new TextEncoder().encode("hello")).ok, false);
  assert.equal(sniffDesign(new Uint8Array([0])).ok, false);
  assert.equal(safeFilename("../../secret.png", "image/png"), "secret.png");
  assert.equal(safeFilename("", "text/html"), "design.html");
});
