import assert from "node:assert/strict";
import test from "node:test";
import { getNonce, getPanelHtml } from "../src/extension/panelHtml.js";

test("getPanelHtml renders required controls and message contract", () => {
  const html = getPanelHtml("nonce-123");

  assert.match(html, /id="prLink"/);
  assert.match(html, /id="profile"/);
  assert.match(html, /id="keywords"/);
  assert.match(html, /id="draft"/);
  assert.match(html, /id="reviewBtn"/);
  assert.match(html, /id="publishBtn"/);
  assert.match(html, /type: "start-review"/);
  assert.match(html, /type: "publish-review"/);
  assert.match(html, /review-completed/);
  assert.match(html, /publish-completed/);
  assert.match(html, /review-failed/);
  assert.match(html, /nonce-123/);
});

test("getNonce returns randomized token with fixed length", () => {
  const a = getNonce();
  const b = getNonce();

  assert.equal(a.length, 24);
  assert.equal(b.length, 24);
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9]+$/);
});
