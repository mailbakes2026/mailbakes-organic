import assert from "node:assert/strict";
import test from "node:test";
import { campaignCallouts, flowCallouts, flowCards, flowIconKind, klaviyoCampaignUrl, klaviyoFlowUrl } from "./attention.ts";

const card = {
  id: "Abandon1",
  name: "Abandoned checkout",
  status: "live",
  revenuePence: 800,
  previousRevenuePence: 1000,
  currency: "GBP",
  delivered: 100,
  openRate: 0.4,
  clickRate: 0.05,
  monthRevenuePence: 4000,
};

test("flow icons follow the name", () => {
  assert.equal(flowIconKind("Abandoned checkout"), "cart");
  assert.equal(flowIconKind("Welcome series"), "welcome");
  assert.equal(flowIconKind("Browse abandonment"), "browse");
  assert.equal(flowIconKind("Win-back"), "winback");
  assert.equal(flowIconKind("Post-purchase review"), "post");
  assert.equal(flowIconKind("VIP"), "flow");
});

test("Klaviyo links only use a real id", () => {
  assert.equal(klaviyoFlowUrl("Abandon1"), "https://www.klaviyo.com/flow/Abandon1/edit");
  assert.equal(klaviyoCampaignUrl("Camp123"), "https://www.klaviyo.com/campaign/Camp123/wizard");
  assert.equal(klaviyoFlowUrl("has space"), null);
});

test("flow cards pair this week with the previous week", () => {
  const cards = flowCards({
    week: [{ ...card, revenuePence: 800 }],
    month: [{ ...card, revenuePence: 4000, status: "manual" }],
    previous: [{ ...card, revenuePence: 1000 }],
  });
  assert.equal(cards[0]?.revenuePence, 800);
  assert.equal(cards[0]?.previousRevenuePence, 1000);
  assert.equal(cards[0]?.monthRevenuePence, 4000);
  assert.equal(cards[0]?.status, "live");
});

test("attention lists a sharp drop, a finished test, and a paused flow", () => {
  const steady = { ...card, id: "Welcome1", name: "Welcome", revenuePence: 900, previousRevenuePence: 1000 };
  const paused = { ...card, id: "Draft11", name: "Sunset", status: "draft", revenuePence: 0, previousRevenuePence: null };
  const notes = flowCallouts([card, steady, paused], [
    { flowId: "Welcome1", flowName: "Welcome", name: "Subject test", status: "running", metricA: "2%", metricB: "4%", winner: "" },
  ]);
  assert.equal(notes.length, 3);
  assert.match(notes[0] ?? "", /Abandoned checkout is down/);
  assert.match(notes[1] ?? "", /Call a winner/);
  assert.match(notes[2] ?? "", /still a draft/);
  assert.equal(flowCallouts([steady], []).length, 0);
});

test("campaign attention flags a drop and a weak open rate", () => {
  const notes = campaignCallouts([
    {
      id: "Camp123",
      name: "Friday bake",
      weekRevenuePence: 500,
      previousRevenuePence: 1000,
      currency: "GBP",
      weekOpenRate: 0.1,
      averageOpenRate: 0.4,
      hasVisual: true,
    },
    {
      id: "Camp789",
      name: "Quiet Tuesday",
      weekRevenuePence: 400,
      previousRevenuePence: 380,
      currency: "GBP",
      weekOpenRate: 0.1,
      averageOpenRate: 0.4,
      hasVisual: true,
    },
    {
      id: "Camp456",
      name: "Secret slice",
      weekRevenuePence: 200,
      previousRevenuePence: 180,
      currency: "GBP",
      weekOpenRate: 0.42,
      averageOpenRate: 0.4,
      hasVisual: false,
    },
  ]);
  assert.match(notes[0] ?? "", /Friday bake is down/);
  assert.match(notes[1] ?? "", /below the account/);
  assert.match(notes[2] ?? "", /no email visual/);
});
