import assert from "node:assert/strict";
import test from "node:test";
import { parsePrLink, PrLinkParseError } from "../src/utils/parsePrLink.js";
test("parsePrLink parses valid GitHub pull request URL", () => {
    const parsed = parsePrLink("https://github.com/acme/platform/pull/42");
    assert.deepEqual(parsed, {
        owner: "acme",
        repo: "platform",
        prNumber: 42
    });
});
test("parsePrLink throws on invalid URL", () => {
    assert.throws(() => parsePrLink("https://gitlab.com/acme/platform/-/merge_requests/42"), PrLinkParseError);
});
