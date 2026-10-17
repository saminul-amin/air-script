/**
 * Copy the measured accuracy numbers into the client for the "How it works"
 * panel, so the app shows exactly what evaluate.py / evaluate_bn.py /
 * evaluate-real-strokes.ts measured and nothing typed by hand.
 *
 *   npx vite-node scripts/sync-accuracy.ts          # writes src/data/accuracy.generated.ts + copies the matrices
 *   npx vite-node scripts/sync-accuracy.ts --check  # exits 1 if the committed copy is stale
 *
 * tests/accuracySync.test.ts runs the --check logic, so `npm run check` fails
 * when docs/accuracy-*.json changes without a re-sync.
 */

import fs from "node:fs";
import path from "node:path";
import { ASSETS, OUT, isStale, render } from "./accuracy-sync-lib";

function main() {
  if (process.argv.includes("--check")) {
    const stale = isStale();
    if (stale.length) {
      console.error(`stale: ${stale.join(", ")} — run npm run sync:accuracy`);
      process.exit(1);
    }
    console.log("accuracy data is in sync");
    return;
  }
  const { source, images } = render();
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.writeFileSync(OUT, source);
  for (const [name, bytes] of Object.entries(images)) fs.writeFileSync(path.join(ASSETS, name), bytes);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} and ${Object.keys(images).length} image(s)`);
}

main();
