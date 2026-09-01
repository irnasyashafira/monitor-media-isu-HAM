import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the dashboard theme, data surfaces, and motion safeguards", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--digital:\s*#2563eb/);
  assert.match(css, /--psn:\s*#d97706/);
  assert.match(css, /--sipol:\s*#dc2626/);
  assert.match(css, /ticker-scroll/);
  assert.match(css, /heatmap-svg/);
  assert.match(css, /article-card/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
