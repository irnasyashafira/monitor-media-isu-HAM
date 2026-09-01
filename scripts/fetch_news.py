#!/usr/bin/env python3
"""Collect Google News RSS results and maintain the dashboard CSV/JSON files.

The CSV is the editable source of truth. Review columns are preserved between
runs so researchers can verify or reject the automatic HAM coding in GitHub.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "monitor-config.json"
DATA_DIR = ROOT / "public" / "data"
CSV_PATH = DATA_DIR / "news.csv"
JSON_PATH = DATA_DIR / "news.json"
META_PATH = DATA_DIR / "meta.json"
GOOGLE_NEWS_URL = "https://news.google.com/rss/search"

CSV_FIELDS = [
    "id",
    "published_at",
    "title",
    "source",
    "link",
    "description",
    "primary_cluster",
    "cluster_ids",
    "primary_subcluster",
    "subcluster_ids",
    "matched_queries",
    "collected_at",
    "review_status",
    "human_verified",
    "review_note",
]


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def html_to_text(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(html.unescape(value or ""))
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


def normalize_title(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def article_id(title: str, source: str) -> str:
    key = f"{title.casefold().strip()}|{source.casefold().strip()}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def parse_truthy(value: str) -> bool:
    return value.strip().casefold() in {"1", "true", "ya", "yes", "y"}


def split_values(value: str) -> list[str]:
    return [item.strip() for item in (value or "").split(";") if item.strip()]


def ordered_union(current: list[str], additions: list[str]) -> list[str]:
    output = list(current)
    seen = set(output)
    for item in additions:
        if item and item not in seen:
            output.append(item)
            seen.add(item)
    return output


def next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def month_windows(start: date, end_exclusive: date) -> list[tuple[date, date]]:
    windows: list[tuple[date, date]] = []
    cursor = start
    while cursor < end_exclusive:
        boundary = min(next_month(cursor), end_exclusive)
        windows.append((cursor, boundary))
        cursor = boundary
    return windows


@dataclass(frozen=True)
class FeedTask:
    cluster_id: str
    cluster_label: str
    subcluster_id: str
    subcluster_label: str
    query: str
    start: date
    end_exclusive: date


def build_feed_url(task: FeedTask) -> str:
    # Google News treats after/before as exclusive. Subtract one day so the
    # first requested calendar day is retained.
    after = task.start - timedelta(days=1)
    query = f"({task.query}) after:{after.isoformat()} before:{task.end_exclusive.isoformat()}"
    params = urllib.parse.urlencode(
        {"q": query, "hl": "id", "gl": "ID", "ceid": "ID:id"}
    )
    return f"{GOOGLE_NEWS_URL}?{params}"


def parse_rss(xml_bytes: bytes) -> list[dict[str, str]]:
    root = ET.fromstring(xml_bytes)
    articles: list[dict[str, str]] = []
    for item in root.findall("./channel/item"):
        title = normalize_title(item.findtext("title", ""))
        source = normalize_title(item.findtext("source", "")) or "Sumber tidak tercantum"
        link = normalize_title(item.findtext("link", ""))
        published_raw = normalize_title(item.findtext("pubDate", ""))
        if not title or not link or not published_raw:
            continue
        try:
            published = parsedate_to_datetime(published_raw)
            if published.tzinfo is None:
                published = published.replace(tzinfo=timezone.utc)
            published_at = published.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except (TypeError, ValueError, OverflowError):
            continue

        suffix = f" - {source}"
        if title.casefold().endswith(suffix.casefold()):
            title = title[: -len(suffix)].rstrip()

        description = html_to_text(item.findtext("description", ""))
        if description.casefold() in {title.casefold(), f"{title} {source}".casefold()}:
            description = ""
        elif title.casefold() in description.casefold():
            description = ""

        articles.append(
            {
                "title": title,
                "source": source,
                "link": link,
                "published_at": published_at,
                "description": description[:700],
            }
        )
    return articles


def fetch_task(task: FeedTask) -> tuple[FeedTask, list[dict[str, str]], str | None]:
    request = urllib.request.Request(
        build_feed_url(task),
        headers={
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "id-ID,id;q=0.9,en;q=0.6",
            "User-Agent": "Mozilla/5.0 Monitor-Media-HAM-Indonesia/1.0",
        },
    )
    last_error = "RSS gagal dimuat"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return task, parse_rss(response.read()), None
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ET.ParseError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    return task, [], last_error


def load_existing() -> dict[str, dict[str, Any]]:
    if not CSV_PATH.exists():
        return {}
    records: dict[str, dict[str, Any]] = {}
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if not row.get("id") or not row.get("title"):
                continue
            records[row["id"]] = {
                "id": row["id"],
                "published_at": row.get("published_at", ""),
                "title": row.get("title", ""),
                "source": row.get("source", ""),
                "link": row.get("link", ""),
                "description": row.get("description", ""),
                "primary_cluster": row.get("primary_cluster", ""),
                "cluster_ids": split_values(row.get("cluster_ids", "")),
                "primary_subcluster": row.get("primary_subcluster", ""),
                "subcluster_ids": split_values(row.get("subcluster_ids", "")),
                "matched_queries": split_values(row.get("matched_queries", "")),
                "collected_at": row.get("collected_at", ""),
                "review_status": row.get("review_status", "Belum ditinjau") or "Belum ditinjau",
                "human_verified": parse_truthy(row.get("human_verified", "")),
                "review_note": row.get("review_note", ""),
            }
    return records


def last_collection_date(records: dict[str, dict[str, Any]]) -> date | None:
    dates: list[date] = []
    for row in records.values():
        value = str(row.get("collected_at", ""))
        if not value:
            continue
        try:
            dates.append(datetime.fromisoformat(value.replace("Z", "+00:00")).date())
        except ValueError:
            continue
    return max(dates) if dates else None


def csv_row(record: dict[str, Any]) -> dict[str, str]:
    return {
        "id": str(record["id"]),
        "published_at": str(record["published_at"]),
        "title": str(record["title"]),
        "source": str(record["source"]),
        "link": str(record["link"]),
        "description": str(record.get("description", "")),
        "primary_cluster": str(record.get("primary_cluster", "")),
        "cluster_ids": "; ".join(record.get("cluster_ids", [])),
        "primary_subcluster": str(record.get("primary_subcluster", "")),
        "subcluster_ids": "; ".join(record.get("subcluster_ids", [])),
        "matched_queries": "; ".join(record.get("matched_queries", [])),
        "collected_at": str(record.get("collected_at", "")),
        "review_status": str(record.get("review_status", "Belum ditinjau")),
        "human_verified": "true" if record.get("human_verified") else "false",
        "review_note": str(record.get("review_note", "")),
    }


def json_article(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "publishedAt": record["published_at"],
        "title": record["title"],
        "source": record["source"],
        "link": record["link"],
        "description": record.get("description", ""),
        "primaryCluster": record.get("primary_cluster", ""),
        "clusterIds": record.get("cluster_ids", []),
        "primarySubcluster": record.get("primary_subcluster", ""),
        "subclusterIds": record.get("subcluster_ids", []),
        "matchedQueries": record.get("matched_queries", []),
        "collectedAt": record.get("collected_at", ""),
        "reviewStatus": record.get("review_status", "Belum ditinjau"),
        "humanVerified": bool(record.get("human_verified")),
        "reviewNote": record.get("review_note", ""),
    }


def run(full: bool, max_workers: int) -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    start_date = date.fromisoformat(config["startDate"])
    today = datetime.now(timezone.utc).date()
    end_exclusive = today + timedelta(days=1)
    records = load_existing()

    if full or not records:
        collection_start = start_date
        mode = "full"
    else:
        last_date = last_collection_date(records) or start_date
        collection_start = max(start_date, last_date - timedelta(days=2))
        mode = "incremental"

    tasks: list[FeedTask] = []
    windows = month_windows(collection_start, end_exclusive)
    for cluster in config["clusters"]:
        for subcluster in cluster["subclusters"]:
            for window_start, window_end in windows:
                tasks.append(
                    FeedTask(
                        cluster_id=cluster["id"],
                        cluster_label=cluster["label"],
                        subcluster_id=subcluster["id"],
                        subcluster_label=subcluster["label"],
                        query=subcluster["query"],
                        start=window_start,
                        end_exclusive=window_end,
                    )
                )

    print(
        f"Menjalankan {len(tasks)} feed Google News RSS "
        f"({collection_start.isoformat()} s.d. {today.isoformat()})…",
        flush=True,
    )
    with ThreadPoolExecutor(max_workers=max(1, max_workers)) as pool:
        results = list(pool.map(fetch_task, tasks))

    feeds_ok = 0
    failures: list[str] = []
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    new_ids: set[str] = set()

    for task, items, error in results:
        if error:
            failures.append(
                f"{task.subcluster_id} {task.start.isoformat()}–{task.end_exclusive.isoformat()}: {error}"
            )
            continue
        feeds_ok += 1
        for item in items:
            if item["published_at"][:10] < config["startDate"]:
                continue
            identifier = article_id(item["title"], item["source"])
            if identifier not in records:
                records[identifier] = {
                    "id": identifier,
                    **item,
                    "primary_cluster": task.cluster_id,
                    "cluster_ids": [task.cluster_id],
                    "primary_subcluster": task.subcluster_id,
                    "subcluster_ids": [task.subcluster_id],
                    "matched_queries": [task.subcluster_label],
                    "collected_at": now_iso,
                    "review_status": "Belum ditinjau",
                    "human_verified": False,
                    "review_note": "",
                }
                new_ids.add(identifier)
            else:
                record = records[identifier]
                record["cluster_ids"] = ordered_union(record.get("cluster_ids", []), [task.cluster_id])
                record["subcluster_ids"] = ordered_union(
                    record.get("subcluster_ids", []), [task.subcluster_id]
                )
                record["matched_queries"] = ordered_union(
                    record.get("matched_queries", []), [task.subcluster_label]
                )
                if not record.get("description") and item.get("description"):
                    record["description"] = item["description"]
                if not record.get("link"):
                    record["link"] = item["link"]

    if not feeds_ok and not records:
        print("Semua feed gagal dan belum ada data tersimpan.", file=sys.stderr)
        return 1

    ordered_records = sorted(
        records.values(), key=lambda row: (row.get("published_at", ""), row.get("title", "")), reverse=True
    )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(csv_row(record) for record in ordered_records)

    published_records = [
        record
        for record in ordered_records
        if record.get("review_status", "").casefold() not in {"tidak relevan", "ditolak", "reject"}
    ]
    meta = {
        "generatedAt": now_iso,
        "lastRunAt": now_iso,
        "startDate": config["startDate"],
        "refreshHours": config["refreshHours"],
        "mode": mode,
        "feedsOk": feeds_ok,
        "feedsFailed": len(failures),
        "totalStored": len(ordered_records),
        "totalPublished": len(published_records),
        "newArticles": len(new_ids),
        "warning": f"{len(failures)} feed gagal; feed lain tetap diproses." if failures else "",
    }
    payload = {
        "meta": meta,
        "clusters": config["clusters"],
        "articles": [json_article(record) for record in published_records],
    }
    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if failures:
        print("Peringatan feed:", file=sys.stderr)
        for failure in failures[:20]:
            print(f"- {failure}", file=sys.stderr)
        if len(failures) > 20:
            print(f"- …dan {len(failures) - 20} kegagalan lain", file=sys.stderr)

    print(
        f"Selesai: {len(published_records)} artikel ditampilkan, "
        f"{len(new_ids)} baru, {feeds_ok}/{len(tasks)} feed berhasil.",
        flush=True,
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Tarik berita HAM dari Google News RSS.")
    parser.add_argument(
        "--full",
        action="store_true",
        help="Tarik ulang seluruh rentang sejak startDate, bukan hanya pembaruan terbaru.",
    )
    parser.add_argument("--max-workers", type=int, default=6)
    args = parser.parse_args()
    return run(full=args.full, max_workers=args.max_workers)


if __name__ == "__main__":
    raise SystemExit(main())
