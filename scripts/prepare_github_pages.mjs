import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("dist/client");
const rawBase = process.env.PAGES_BASE_PATH ?? "";
const base = rawBase && rawBase !== "/" ? "/" + rawBase.replace(/^\/+|\/+$/g, "") : "";
const textExtensions = new Set([".html", ".rsc", ".js", ".css", ".json", ""]);
const sitesOrigin = "https://monitor-represi-digital.nessiorion.chatgpt.site/";
const preservedAssetPath = "__MONITOR_GITHUB_PAGES_ASSET_PATH__";

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(fullPath) : [fullPath];
    }),
  );
  return files.flat();
}

if (base) {
  const files = await walk(output);
  let changed = 0;
  for (const file of files) {
    if (!textExtensions.has(path.extname(file)) && path.basename(file) !== "_headers") continue;
    const original = await readFile(file, "utf8");
    const next = original
      .replaceAll(base + "/assets/", preservedAssetPath)
      .replaceAll("/assets/", base + "/assets/")
      .replaceAll(preservedAssetPath, base + "/assets/")
      .replaceAll(sitesOrigin, base + "/");
    if (next !== original) {
      await writeFile(file, next, "utf8");
      changed += 1;
    }
  }
  console.log("GitHub Pages base path " + base + " diterapkan pada " + changed + " berkas.");
} else {
  console.log("Repository memakai root domain; base path tidak diperlukan.");
}
