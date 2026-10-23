import assert from "node:assert/strict";
import test from "node:test";
import { googleAdsStatus } from "./google.ts";

test("Google stays parked even when credential env vars are present", () => {
  const previous = {
    token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    customer: process.env.GOOGLE_ADS_CUSTOMER_ID,
  };
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "should-not-be-read";
  process.env.GOOGLE_ADS_CUSTOMER_ID = "123-456-7890";
  try {
    const status = googleAdsStatus();
    assert.equal(status.connected, false);
    assert.equal(status.parked, true);
    assert.match(status.detail, /does not read GOOGLE_ADS_/);
  } finally {
    if (previous.token === undefined) delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    else process.env.GOOGLE_ADS_DEVELOPER_TOKEN = previous.token;
    if (previous.customer === undefined) delete process.env.GOOGLE_ADS_CUSTOMER_ID;
    else process.env.GOOGLE_ADS_CUSTOMER_ID = previous.customer;
  }
});
