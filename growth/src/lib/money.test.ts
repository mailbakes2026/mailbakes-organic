import assert from "node:assert/strict";
import test from "node:test";
import { optionalCount, toCount, toPence } from "./money.ts";

test("pence conversion rounds the third decimal and rejects junk", () => {
  assert.equal(toPence("12.34"), 1234);
  assert.equal(toPence("12.345"), 1235);
  assert.equal(toPence(0), 0);
  assert.equal(toPence("-2.5"), -250);
  assert.equal(toPence("12.3"), 1230);
  assert.equal(toPence(""), null);
  assert.equal(toPence("£12"), null);
  assert.equal(toPence(Number.NaN), null);
});

test("counts stay non-negative integers and blank means missing", () => {
  assert.equal(toCount("3"), 3);
  assert.equal(toCount(-1), null);
  assert.equal(toCount(1.5), null);
  assert.equal(optionalCount(undefined), null);
  assert.equal(optionalCount("nope"), undefined);
});
