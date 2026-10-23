import assert from "node:assert/strict";
import test from "node:test";
import { buildSeed } from "./seed-build.ts";
import { matchesQuery } from "./search.ts";

function asSearch(row: ReturnType<typeof buildSeed>[number]) {
  return {
    ...row,
    trackingNumber: "",
    courier: "",
    declineReason: "",
    postUrl: "",
  };
}

test("search hits the handle, the order and the notes", () => {
  const rows = buildSeed().map(asSearch);
  assert.equal(rows.filter((row) => matchesQuery(row, "crusetwins")).length, 1);
  assert.equal(rows.filter((row) => matchesQuery(row, "214507?")).map((row) => row.name).join(), "Em (Emily Blatchford)");
  assert.equal(rows.filter((row) => matchesQuery(row, "samantha starr")).map((row) => row.name).join(), "Sam (Ada and Alfie)");
  assert.equal(rows.filter((row) => matchesQuery(row, "mon 26 oct")).map((row) => row.name).join(), "Louis");
  assert.equal(rows.some((row) => matchesQuery(row, "nobody-else")), false);
});
