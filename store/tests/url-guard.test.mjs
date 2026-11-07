// The Worker's malformed-URL guard.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isDecodablePath } from "../src/lib/url-guard.ts";

test("ordinary and correctly encoded paths pass", () => {
  for (const path of ["/", "/products/sample-dome-jhumka", "/categories/jewellery", "/products/ear%72ings", "/collections/under-%E2%82%B9299", "/data/pin/v1/p/110.json"]) {
    assert.equal(isDecodablePath(path), true, path);
  }
});

test("paths that can't be decoded are refused", () => {
  for (const path of ["/products/%FF", "/categories/%E0%A4%A", "/%", "/products/%zz", "/a%2"]) {
    assert.equal(isDecodablePath(path), false, path);
  }
});
