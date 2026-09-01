import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exports a complete static dashboard entry page", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");

  assert.match(html, /Monitor Media HAM Indonesia/);
  assert.match(html, /Represi Digital/);
  assert.match(html, /og:image/);
});

test("ships populated RSS data with all configured clusters", async () => {
  const payload = JSON.parse(
    await readFile(new URL("../public/data/news.json", import.meta.url), "utf8"),
  );

  assert.equal(payload.clusters.length, 3);
  assert.equal(
    payload.clusters.reduce((total, cluster) => total + cluster.subclusters.length, 0),
    16,
  );
  assert.ok(payload.articles.length > 0);
  assert.equal(payload.meta.startDate, "2026-01-01");
  assert.equal(payload.meta.refreshHours, 6);
  assert.ok(payload.articles.every((article) => article.publishedAt.slice(0, 10) >= "2026-01-01"));
});
