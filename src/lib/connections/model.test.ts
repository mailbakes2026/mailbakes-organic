import assert from "node:assert/strict";
import test from "node:test";
import { matchExternalPosts, organicBag, shouldWriteApiStat } from "./model.ts";

test("typed-in stats are not replaced by a sync", () => {
  assert.equal(shouldWriteApiStat("MANUAL"), false);
  assert.equal(shouldWriteApiStat("API"), true);
  assert.equal(shouldWriteApiStat(null), true);
});

test("a same-day post with a similar caption is matched once", () => {
  const matched = matchExternalPosts(
    [
      {
        externalId: "ig-1",
        platform: "INSTAGRAM",
        publishedOn: "2026-10-20",
        title: "Lemon drizzle loaf",
        caption: "Lemon drizzle loaf with icing",
      },
      {
        externalId: "ig-2",
        platform: "INSTAGRAM",
        publishedOn: "2026-10-20",
        title: "Lemon drizzle loaf",
        caption: "Lemon drizzle loaf again",
      },
    ],
    [
      {
        id: "post-1",
        platforms: ["INSTAGRAM"],
        plannedDate: "2026-10-20",
        title: "Lemon drizzle",
        caption: "Lemon drizzle loaf",
      },
    ],
  );
  assert.equal(Object.keys(matched).length, 1);
  assert.equal(matched["ig-1"] ?? matched["ig-2"], "post-1");
});

test("matched organic posts are not added on top of planner stats", () => {
  const bag = organicBag(
    ["INSTAGRAM"],
    new Set(["post-1"]),
    [
      {
        platform: "INSTAGRAM",
        externalId: "ig-1",
        title: "Lemon",
        caption: "",
        publishedOn: "2026-10-20",
        permalink: "",
        views: 100,
        likes: 10,
        comments: 1,
        shares: 0,
        saves: 2,
        linkClicks: null,
        matchedPostId: "post-1",
      },
    ],
    [
      {
        platform: "INSTAGRAM",
        day: "2026-10-20",
        views: 999,
        likes: null,
        comments: null,
        shares: null,
        saves: null,
        linkClicks: null,
      },
    ],
    "2026-10-19",
    "2026-10-25",
  );
  assert.equal(bag.views, null);
  assert.equal(bag.posts, 0);
});

test("unmatched account posts fill the week", () => {
  const bag = organicBag(
    ["TIKTOK"],
    new Set(),
    [
      {
        platform: "TIKTOK",
        externalId: "tt-1",
        title: "Birthday bundles",
        caption: "",
        publishedOn: "2026-10-21",
        permalink: "",
        views: 50,
        likes: 4,
        comments: null,
        shares: 1,
        saves: null,
        linkClicks: null,
        matchedPostId: null,
      },
    ],
    [],
    "2026-10-19",
    "2026-10-25",
  );
  assert.equal(bag.posts, 1);
  assert.equal(bag.views, 50);
  assert.equal(bag.likes, 4);
  assert.equal(bag.shares, 1);
});
