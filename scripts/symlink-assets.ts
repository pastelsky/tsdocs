/**
 * Symlink assets in `docs` with `docs-shared-assets`
 */

import fs from "fs";
import glob from "fast-glob";
import path from "path";
import { docsVersion } from "../server/package/utils";

const assets = glob.sync(
  [
    "docs/**/assets/style.css",
    "docs/**/assets/custom.css",
    "docs/**/assets/highlight.css",
    "docs/**/assets/main.js",
  ],
  {
    cwd: process.cwd(),
  },
);

console.log(`Symlinking ${assets.length} assets to docs-shared-assets`);

assets.forEach((asset) => {
  const target = path.join(
    "docs-shared-assets",
    docsVersion,
    path.basename(asset),
  );
  console.log("Symlinked: ", asset, " to ", target);
  if (fs.existsSync(asset)) {
    fs.unlinkSync(asset);
  }
  fs.symlinkSync(target, asset, "file");
});
