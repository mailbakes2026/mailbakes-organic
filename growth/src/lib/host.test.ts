import assert from "node:assert/strict";
import test from "node:test";
import { appFromHost, destinationPath, otherAppHref, publicBase, requiresSession, safeNext } from "./host.ts";

test("custom hosts select an app and other hosts do not", () => {
  assert.equal(appFromHost("paidads.mailbakes.com"), "paidads");
  assert.equal(appFromHost("Retention.mailbakes.com:443"), "retention");
  assert.equal(appFromHost("mailbakes-growth.onrender.com"), null);
  assert.equal(appFromHost("localhost:3000"), null);
});

test("a custom host rewrites pages and leaves the API and login alone", () => {
  assert.equal(destinationPath("paidads.mailbakes.com", "/"), "/paidads");
  assert.equal(destinationPath("paidads.mailbakes.com", "/campaigns"), "/paidads/campaigns");
  assert.equal(destinationPath("paidads.mailbakes.com", "/login"), "/login");
  assert.equal(destinationPath("paidads.mailbakes.com", "/api/v1/ingest"), "/api/v1/ingest");
  assert.equal(destinationPath("paidads.mailbakes.com", "/favicon.ico"), "/paidads/icon");
  assert.equal(destinationPath("retention.mailbakes.com", "/retention/plan"), "/retention/plan");
});

test("the onrender host keeps path routing", () => {
  assert.equal(destinationPath("mailbakes-growth.onrender.com", "/"), "/");
  assert.equal(destinationPath("mailbakes-growth.onrender.com", "/paidads"), "/paidads");
  assert.equal(destinationPath("mailbakes-growth.onrender.com", "/retention/flows"), "/retention/flows");
});

test("session is required for an app page and not for ingest, login, or the chooser", () => {
  assert.equal(requiresSession("/", "/paidads"), true);
  assert.equal(requiresSession("/paidads", "/paidads"), true);
  assert.equal(requiresSession("/", "/"), false);
  assert.equal(requiresSession("/login", "/login"), false);
  assert.equal(requiresSession("/api/v1/ingest", "/api/v1/ingest"), false);
  assert.equal(requiresSession("/paidads/api/v1/ingest", "/paidads/api/v1/ingest"), false);
  assert.equal(requiresSession("/favicon.ico", "/paidads/icon"), false);
});

test("next paths stay on this site", () => {
  assert.equal(safeNext("/paidads/campaigns?range=28d", "/"), "/paidads/campaigns?range=28d");
  assert.equal(safeNext("https://evil.example/paidads", "/paidads"), "/paidads");
  assert.equal(safeNext("//evil.example", "/paidads"), "/paidads");
});

test("links drop the prefix only on a custom host", () => {
  assert.equal(publicBase("paidads.mailbakes.com", "paidads"), "");
  assert.equal(publicBase("localhost", "paidads"), "/paidads");
  assert.equal(otherAppHref("retention.mailbakes.com", "retention"), "https://paidads.mailbakes.com");
  assert.equal(otherAppHref("localhost", "paidads"), "/retention");
});
