import assert from "node:assert/strict";
import { allowedBrowserOrigins, isAllowedBrowserOrigin } from "./runtime-config";

const origins = allowedBrowserOrigins("https://app.example.com, https://preview.example.com, ,");
assert.deepEqual([...origins], ["https://app.example.com", "https://preview.example.com"]);
assert.equal(isAllowedBrowserOrigin(undefined, origins), true);
assert.equal(isAllowedBrowserOrigin("http://localhost:5173", origins), true);
assert.equal(isAllowedBrowserOrigin("https://app.example.com", origins), true);
assert.equal(isAllowedBrowserOrigin("https://untrusted.example.com", origins), false);

console.log("runtime-config.self-test passed");
