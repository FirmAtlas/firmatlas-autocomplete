// Fails the build when a bundle is over 10 KB gzipped (CSS is inlined in the JS).
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const LIMIT = 10 * 1024;
let failed = false;
for (const f of ["dist/firmatlas-autocomplete.js", "dist/firmatlas-autocomplete.iife.js"]) {
  const raw = readFileSync(f);
  const gz = gzipSync(raw, { level: 9 }).length;
  console.log(`${f}: ${raw.length} bytes, ${gz} bytes gzipped`);
  if (gz > LIMIT) failed = true;
}
if (failed) {
  console.error(`over the ${LIMIT}-byte gzip budget`);
  process.exit(1);
}
