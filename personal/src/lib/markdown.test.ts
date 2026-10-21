import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown } from "./markdown.ts";

test("escapes HTML in a briefing", () => {
  const html = renderMarkdown("Hello <script>alert(1)</script>");
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
});

test("renders bold text and a safe link", () => {
  const html = renderMarkdown("See **flour** at [the mill](https://mill.example/a).");
  assert.match(html, /<strong>flour<\/strong>/);
  assert.match(html, /href="https:\/\/mill\.example\/a"/);
});

test("drops a javascript link", () => {
  const html = renderMarkdown("[click](javascript:alert(1))");
  assert.equal(html.includes("javascript"), false);
  assert.match(html, /click/);
});

test("renders a list", () => {
  const html = renderMarkdown("- One\n- Two");
  assert.match(html, /<ul><li>One<\/li><li>Two<\/li><\/ul>/);
});
