"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "@/components/ui/native-select";
import {
  CLUSTER_BY_ID,
  CLUSTERS,
  MONITOR_CONFIG,
  REFRESH_HOURS,
  START_DATE,
  SUBCLUSTER_BY_ID,
} from "@/lib/monitor";
import type { Article, NewsPayload } from "@/lib/types";

const MONTHS_ID = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const STOPWORDS = new Set([
  "yang",
  "dan",
  "di",
  "ke",
  "dari",
  "untuk",
  "dengan",
  "pada",
  "ini",
  "itu",
  "akan",
  "tidak",
  "ada",
  "atau",
  "juga",
  "oleh",
  "para",
  "dalam",
  "tersebut",
  "sebagai",
  "adalah",
  "telah",
  "secara",
  "terkait",
  "dua",
  "satu",
  "tahun",
  "hari",
  "lebih",
  "saat",
  "jadi",
  "bisa",
  "harus",
  "sudah",
  "belum",
  "masih",
  "mereka",
  "kami",
  "kita",
  "saya",
  "anda",
  "dia",
  "nya",
  "per",
  "usai",
  "soal",
  "buat",
  "karena",
  "antara",
  "bagi",
  "saja",
  "agar",
  "namun",
  "tetapi",
  "serta",
  "hingga",
  "sejak",
  "ketika",
  "via",
  "the",
  "kasus",
  "diduga",
  "dugaan",
  "kata",
  "berita",
  "indonesia",
]);

function safePayload(value: unknown): NewsPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<NewsPayload>;
  if (!Array.isArray(candidate.articles) || !candidate.meta) return null;
  return candidate as NewsPayload;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function startForDays(days: number) {
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() - Math.max(0, days - 1));
  return dateKey(current);
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return '"' + text.replaceAll('"', '""') + '"';
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportRows(articles: Article[]) {
  return articles.map((article) => ({
    "Tanggal Terbit": article.publishedAt,
    Judul: article.title,
    Media: article.source,
    Tautan: article.link,
    Kluster: article.clusterIds.map((id) => CLUSTER_BY_ID[id]?.label ?? id).join(" | "),
    Subkluster: article.subclusterIds
      .map((id) => SUBCLUSTER_BY_ID[id]?.label ?? id)
      .join(" | "),
    "Status Verifikasi": article.reviewStatus,
    "Diverifikasi Manusia": article.humanVerified ? "Ya" : "Belum",
    "Catatan Peneliti": article.reviewNote,
    "Dikumpulkan Pada": article.collectedAt,
  }));
}

function downloadCsv(articles: Article[]) {
  const rows = exportRows(articles);
  const headers = Object.keys(rows[0] ?? {
    "Tanggal Terbit": "",
    Judul: "",
    Media: "",
    Tautan: "",
    Kluster: "",
    Subkluster: "",
    "Status Verifikasi": "",
    "Diverifikasi Manusia": "",
    "Catatan Peneliti": "",
    "Dikumpulkan Pada": "",
  });
  const csv = "\uFEFF" + [headers, ...rows.map((row) => headers.map((header) => row[header as keyof typeof row]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  saveBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    "monitor-media-ham-" + dateKey(new Date()) + ".csv",
  );
}

async function downloadExcel(articles: Article[]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows(articles));
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 70 },
    { wch: 25 },
    { wch: 55 },
    { wch: 35 },
    { wch: 48 },
    { wch: 20 },
    { wch: 22 },
    { wch: 40 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Berita");
  XLSX.writeFile(workbook, "monitor-media-ham-" + dateKey(new Date()) + ".xlsx");
}

function articleSearchText(article: Article) {
  return [
    article.title,
    article.source,
    article.description,
    ...article.matchedQueries,
    ...article.subclusterIds.map((id) => SUBCLUSTER_BY_ID[id]?.label ?? id),
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID");
}

function Sparkline({
  articles,
  cluster,
  color,
}: {
  articles: Article[];
  cluster?: string;
  color: string;
}) {
  const counts = useMemo(() => {
    const keys = Array.from({ length: 14 }, (_, index) => {
      const current = new Date();
      current.setDate(current.getDate() - (13 - index));
      return dateKey(current);
    });
    return keys.map(
      (key) =>
        articles.filter(
          (article) =>
            dateKey(article.publishedAt) === key &&
            (!cluster || article.clusterIds.includes(cluster)),
        ).length,
    );
  }, [articles, cluster]);
  const maximum = Math.max(1, ...counts);
  const points = counts
    .map((count, index) => {
      const x = 2 + index * (96 / Math.max(1, counts.length - 1));
      const y = 14 - (count / maximum) * 12;
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");

  return (
    <svg className="stat-spark" viewBox="0 0 100 16" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

function Heatmap({ articles }: { articles: Article[] }) {
  const model = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() - 371);
    const configured = new Date(START_DATE + "T00:00:00");
    const firstArticle = articles.length
      ? new Date(
          Math.min(
            ...articles
              .map((article) => new Date(article.publishedAt).getTime())
              .filter(Number.isFinite),
          ),
        )
      : configured;
    const start = new Date(Math.max(earliest.getTime(), configured.getTime(), firstArticle.getTime()));
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());

    const counts = new Map<string, number>();
    articles.forEach((article) => {
      const key = dateKey(article.publishedAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const totalDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
    const weeks = Math.ceil(totalDays / 7);
    const cells: Array<{ key: string; count: number; x: number; y: number; label: string }> = [];
    const months: Array<{ x: number; label: string }> = [];
    let lastMonth = -1;
    for (let week = 0; week < weeks; week += 1) {
      for (let day = 0; day < 7; day += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + week * 7 + day);
        if (current > today) continue;
        if (day === 0 && current.getMonth() !== lastMonth) {
          lastMonth = current.getMonth();
          months.push({ x: 26 + week * 14, label: MONTHS_ID[lastMonth + 1].slice(0, 3) });
        }
        const key = dateKey(current);
        cells.push({
          key,
          count: counts.get(key) ?? 0,
          x: 26 + week * 14,
          y: 16 + day * 14,
          label:
            new Intl.DateTimeFormat("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(current) +
            ": " +
            (counts.get(key) ?? 0) +
            " berita",
        });
      }
    }
    return { cells, months, weeks, maximum: Math.max(1, ...counts.values()) };
  }, [articles]);

  function color(count: number) {
    if (!count) return "#f3f4f6";
    const ratio = count / model.maximum;
    if (ratio < 0.25) return "#dbeafe";
    if (ratio < 0.5) return "#93c5fd";
    if (ratio < 0.75) return "#f59e0b";
    return "#dc2626";
  }

  const width = 26 + model.weeks * 14;
  return (
    <div className="heatmap-scroll">
      <svg
        className="heatmap-svg"
        width={width}
        height="114"
        viewBox={"0 0 " + width + " 114"}
        aria-label="Kalender intensitas pemberitaan"
      >
        <text x="0" y="41" className="heatmap-label">Sen</text>
        <text x="0" y="69" className="heatmap-label">Rab</text>
        <text x="0" y="97" className="heatmap-label">Jum</text>
        {model.months.map((month, index) => (
          <text key={month.label + index} x={month.x} y="10" className="heatmap-label">
            {month.label}
          </text>
        ))}
        {model.cells.map((cell) => (
          <rect
            key={cell.key}
            x={cell.x}
            y={cell.y}
            width="11"
            height="11"
            rx="2"
            fill={color(cell.count)}
          >
            <title>{cell.label}</title>
          </rect>
        ))}
      </svg>
      <div className="heatmap-legend-row" aria-hidden="true">
        sedikit
        {["#f3f4f6", "#dbeafe", "#93c5fd", "#f59e0b", "#dc2626"].map((item) => (
          <span className="sq" style={{ background: item }} key={item} />
        ))}
        banyak
      </div>
    </div>
  );
}

function WordCloud({
  articles,
  onSelect,
}: {
  articles: Article[];
  onSelect: (word: string) => void;
}) {
  const words = useMemo(() => {
    const frequency = new Map<string, number>();
    const clusterHits = new Map<string, Map<string, number>>();
    articles.forEach((article) => {
      const seen = new Set<string>();
      article.title
        .toLocaleLowerCase("id-ID")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
        .forEach((word) => {
          frequency.set(word, (frequency.get(word) ?? 0) + 1);
          if (!seen.has(word)) {
            const hits = clusterHits.get(word) ?? new Map<string, number>();
            article.clusterIds.forEach((cluster) => hits.set(cluster, (hits.get(cluster) ?? 0) + 1));
            clusterHits.set(word, hits);
            seen.add(word);
          }
        });
    });
    const sorted = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    const maximum = sorted[0]?.[1] ?? 1;
    const minimum = sorted[sorted.length - 1]?.[1] ?? 1;
    return sorted.map(([word, count]) => {
      const ratio = maximum === minimum ? 1 : (count - minimum) / (maximum - minimum);
      const dominant = [...(clusterHits.get(word)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        word,
        count,
        size: 0.75 + ratio * 1.35,
        color: CLUSTER_BY_ID[dominant]?.color ?? "#6b7280",
      };
    });
  }, [articles]);

  if (!words.length) return <div className="tagcloud-empty">Belum cukup data.</div>;
  return (
    <div className="tagcloud" id="tagcloud">
      {words.map((item) => (
        <button
          type="button"
          className="tag-word"
          style={{ fontSize: item.size.toFixed(2) + "rem", color: item.color }}
          title={item.count + "x muncul"}
          onClick={() => onSelect(item.word)}
          key={item.word}
        >
          {item.word}
        </button>
      ))}
    </div>
  );
}

function pageItems(current: number, total: number) {
  const output: Array<number | "ellipsis"> = [];
  let ellipsisAdded = false;
  for (let value = 1; value <= total; value += 1) {
    if (value === 1 || value === total || Math.abs(value - current) <= 2) {
      output.push(value);
      ellipsisAdded = false;
    } else if (!ellipsisAdded) {
      output.push("ellipsis");
      ellipsisAdded = true;
    }
  }
  return output;
}

export default function Dashboard() {
  const [payload, setPayload] = useState<NewsPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [cluster, setCluster] = useState("all");
  const [subcluster, setSubcluster] = useState("all");
  const [review, setReview] = useState("all");
  const [search, setSearch] = useState("");
  const [periodDays, setPeriodDays] = useState(0);
  const [filterMonth, setFilterMonth] = useState(0);
  const [filterYear, setFilterYear] = useState(0);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    fetch("./data/news.json?_=" + Date.now(), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Data berita belum dapat dimuat.");
        return response.json();
      })
      .then((value) => {
        const parsed = safePayload(value);
        if (!parsed) throw new Error("Format data berita tidak dikenali.");
        if (active) setPayload(parsed);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Data berita belum dapat dimuat.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const articles = useMemo(() => payload?.articles ?? [], [payload]);
  const sortedArticles = useMemo(
    () => [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [articles],
  );
  const clusterScoped = useMemo(
    () =>
      articles.filter(
        (article) =>
          (cluster === "all" || article.clusterIds.includes(cluster)) &&
          (subcluster === "all" || article.subclusterIds.includes(subcluster)),
      ),
    [articles, cluster, subcluster],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id-ID");
    const threshold = periodDays > 0 ? startForDays(periodDays) : "";
    return clusterScoped
      .filter((article) => {
        if (review === "verified") return article.humanVerified;
        if (review === "pending") return !article.humanVerified;
        return true;
      })
      .filter((article) => !needle || articleSearchText(article).includes(needle))
      .filter((article) => {
        const key = dateKey(article.publishedAt);
        if (threshold && key < threshold) return false;
        const published = new Date(article.publishedAt);
        if (filterMonth > 0 && published.getMonth() + 1 !== filterMonth) return false;
        if (filterYear > 0 && published.getFullYear() !== filterYear) return false;
        return true;
      })
      .sort((a, b) =>
        sort === "oldest"
          ? a.publishedAt.localeCompare(b.publishedAt)
          : b.publishedAt.localeCompare(a.publishedAt),
      );
  }, [clusterScoped, filterMonth, filterYear, periodDays, review, search, sort]);

  const years = useMemo(
    () =>
      [...new Set(articles.map((article) => new Date(article.publishedAt).getFullYear()))]
        .filter(Number.isFinite)
        .sort((a, b) => b - a),
    [articles],
  );
  const availableSubclusters = useMemo(
    () =>
      cluster === "all"
        ? CLUSTERS.flatMap((item) =>
            item.subclusters.map((sub) => ({ ...sub, clusterLabel: item.shortLabel })),
          )
        : (CLUSTER_BY_ID[cluster]?.subclusters ?? []).map((sub) => ({
            ...sub,
            clusterLabel: CLUSTER_BY_ID[cluster]?.shortLabel ?? "",
          })),
    [cluster],
  );

  const clusterCounts = useMemo(
    () =>
      Object.fromEntries(
        CLUSTERS.map((item) => [
          item.id,
          articles.filter((article) => article.clusterIds.includes(item.id)).length,
        ]),
      ) as Record<string, number>,
    [articles],
  );
  const uniqueSources = new Set(articles.map((article) => article.source).filter(Boolean)).size;
  const dateValues = articles
    .map((article) => new Date(article.publishedAt).getTime())
    .filter(Number.isFinite);
  const spanDays = dateValues.length
    ? Math.max(1, Math.round((Math.max(...dateValues) - Math.min(...dateValues)) / 86_400_000) + 1)
    : 0;
  const dominantCluster = [...CLUSTERS].sort(
    (a, b) => (clusterCounts[b.id] ?? 0) - (clusterCounts[a.id] ?? 0),
  )[0];
  const todayCount = articles.filter((article) => dateKey(article.publishedAt) === dateKey(new Date())).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visibleArticles = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const donutData = CLUSTERS.map((item) => ({
    name: item.shortLabel,
    value: clusterCounts[item.id] ?? 0,
    color: item.color,
  }));
  const trendData = useMemo(() => {
    const counts = new Map<string, number>();
    articles.forEach((article) => {
      const key = dateKey(article.publishedAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from({ length: 30 }, (_, index) => {
      const current = new Date();
      current.setDate(current.getDate() - (29 - index));
      const key = dateKey(current);
      return { key, label: key.slice(5), value: counts.get(key) ?? 0 };
    });
  }, [articles]);
  const topSources = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((article) => counts.set(article.source, (counts.get(article.source) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);
  const maxSource = Math.max(1, ...topSources.map((item) => item[1]));

  function choosePeriod(days: number) {
    setPeriodDays(days);
    setFilterMonth(0);
    setFilterYear(0);
    setPage(1);
  }

  function chooseMonth(value: number) {
    setFilterMonth(value);
    if (value > 0) setPeriodDays(0);
    setPage(1);
  }

  function chooseYear(value: number) {
    setFilterYear(value);
    if (value > 0) setPeriodDays(0);
    setPage(1);
  }

  function chooseCluster(value: string) {
    setCluster(value);
    setPage(1);
    if (
      value !== "all" &&
      subcluster !== "all" &&
      !CLUSTER_BY_ID[value]?.subclusters.some((item) => item.id === subcluster)
    ) {
      setSubcluster("all");
    }
  }

  function filterByWord(word: string) {
    setSearch(word);
    setPage(1);
    window.setTimeout(() => {
      document.getElementById("article-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  }

  return (
    <main className="monitor-shell">
      <header className="header">
        <div className="header-icon" aria-hidden="true">⚖️</div>
        <div className="header-text">
          <h1>{MONITOR_CONFIG.title}</h1>
          <p>Pemantauan pemberitaan media · Diperbarui otomatis tiap {REFRESH_HOURS} jam</p>
          <div className="hero-insights">
            <div className="insight-pill">📡 <b>{formatNumber(uniqueSources)}</b> media dipantau</div>
            <div className="insight-pill">🗓️ <b>{formatNumber(spanDays)}</b> hari cakupan data</div>
            <div className="insight-pill">🔥 topik dominan: <b>{dominantCluster?.shortLabel ?? "—"}</b></div>
            <div className="insight-pill">🔄 diperbarui tiap <b>{REFRESH_HOURS} jam</b></div>
          </div>
        </div>
        <div className="header-meta">
          <div>Terakhir diperbarui</div>
          <div id="last-updated">{formatDateTime(payload?.meta.generatedAt)}</div>
          <small>Google News RSS · sejak 1 Jan 2026</small>
        </div>
      </header>

      <div className="ticker-wrap" aria-label="Berita terbaru">
        <div className="ticker-label">▸ TERBARU</div>
        <div className="ticker-track-outer">
          <div className="ticker-track">
            {sortedArticles.length ? (
              [...sortedArticles.slice(0, 8), ...sortedArticles.slice(0, 8)].map((article, index) => (
                <a
                  className="ticker-item"
                  href={article.link}
                  target="_blank"
                  rel="noreferrer"
                  key={article.id + "-" + index}
                >
                  <b>{article.source}</b> — {article.title}
                </a>
              ))
            ) : (
              <span className="ticker-item">Memuat berita terbaru…</span>
            )}
          </div>
        </div>
      </div>

      <nav className="topic-nav" aria-label="Kluster pemantauan">
        <button
          type="button"
          className={"tab " + (cluster === "all" ? "active" : "")}
          data-topic="all"
          onClick={() => chooseCluster("all")}
        >
          Semua <span className="tab-badge">{formatNumber(articles.length)}</span>
        </button>
        {CLUSTERS.map((item) => (
          <button
            type="button"
            className={"tab " + (cluster === item.id ? "active" : "")}
            data-topic={item.id}
            style={{ "--tab-color": item.color } as CSSProperties}
            onClick={() => chooseCluster(item.id)}
            key={item.id}
          >
            <span className="tab-dot" /> {item.shortLabel}
            <span className="tab-badge">{formatNumber(clusterCounts[item.id] ?? 0)}</span>
          </button>
        ))}
      </nav>

      <section className="insights-row">
        <div className="card">
          <div className="card-header">
            <span>Kata Kunci Paling Sering Muncul di Judul Berita</span>
            <span className="hint">klik untuk memfilter</span>
          </div>
          <div className="card-body">
            <WordCloud articles={clusterScoped} onSelect={filterByWord} />
            <div className="tagcloud-hint">
              Ukuran &amp; warna kata mengikuti frekuensi dan kluster yang paling terkait.
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">Kalender Intensitas Pemberitaan</div>
          <div className="card-body">
            <Heatmap articles={clusterScoped} />
          </div>
        </div>
      </section>

      <section className="main">
        <div className="feed-column">
          <div className="filter-bar">
            <div className="filter-row">
              <div className="search-wrap">
                <Search aria-hidden="true" />
                <Input
                  type="search"
                  className="search-box"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari judul, isu, atau nama media…"
                  aria-label="Cari berita"
                />
              </div>
              <NativeSelect
                className="select-ctrl select-subcluster"
                value={subcluster}
                onChange={(event) => {
                  setSubcluster(event.target.value);
                  setPage(1);
                }}
                aria-label="Filter subkluster"
              >
                <NativeSelectOption value="all">Semua subkluster</NativeSelectOption>
                {cluster === "all" ? (
                  CLUSTERS.map((item) => (
                    <NativeSelectOptGroup label={item.shortLabel} key={item.id}>
                      {item.subclusters.map((sub) => (
                        <NativeSelectOption value={sub.id} key={sub.id}>
                          {sub.shortLabel}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))
                ) : (
                  availableSubclusters.map((sub) => (
                    <NativeSelectOption value={sub.id} key={sub.id}>
                      {sub.shortLabel}
                    </NativeSelectOption>
                  ))
                )}
              </NativeSelect>
              <NativeSelect
                className="select-ctrl"
                value={review}
                onChange={(event) => {
                  setReview(event.target.value);
                  setPage(1);
                }}
                aria-label="Filter verifikasi"
              >
                <NativeSelectOption value="all">Semua status</NativeSelectOption>
                <NativeSelectOption value="pending">Belum ditinjau</NativeSelectOption>
                <NativeSelectOption value="verified">Terverifikasi</NativeSelectOption>
              </NativeSelect>
              <NativeSelect
                className="select-ctrl"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as "newest" | "oldest");
                  setPage(1);
                }}
                aria-label="Urutan berita"
              >
                <NativeSelectOption value="newest">Terbaru dulu</NativeSelectOption>
                <NativeSelectOption value="oldest">Terlama dulu</NativeSelectOption>
              </NativeSelect>
              <NativeSelect
                className="select-ctrl"
                value={String(perPage)}
                onChange={(event) => {
                  setPerPage(Number(event.target.value));
                  setPage(1);
                }}
                aria-label="Jumlah artikel per halaman"
              >
                <NativeSelectOption value="25">25 / hal</NativeSelectOption>
                <NativeSelectOption value="50">50 / hal</NativeSelectOption>
                <NativeSelectOption value="100">100 / hal</NativeSelectOption>
                <NativeSelectOption value="99999">Semua</NativeSelectOption>
              </NativeSelect>
            </div>

            <hr className="filter-divider" />

            <div className="filter-row">
              <span className="filter-label">Periode</span>
              <div className="chips">
                {[
                  [0, "Semua waktu"],
                  [1, "Hari ini"],
                  [7, "7 hari"],
                  [30, "30 hari"],
                  [90, "90 hari"],
                  [180, "6 bulan"],
                  [365, "1 tahun"],
                ].map(([days, label]) => (
                  <button
                    type="button"
                    className={"chip " + (periodDays === days && !filterMonth && !filterYear ? "active" : "")}
                    onClick={() => choosePeriod(Number(days))}
                    key={String(days)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-row">
              <span className="filter-label">Bulan/Tahun</span>
              <NativeSelect
                className="select-ctrl"
                value={String(filterMonth)}
                onChange={(event) => chooseMonth(Number(event.target.value))}
                aria-label="Bulan"
              >
                <NativeSelectOption value="0">— Semua bulan —</NativeSelectOption>
                {MONTHS_ID.slice(1).map((month, index) => (
                  <NativeSelectOption value={String(index + 1)} key={month}>
                    {month}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                className="select-ctrl"
                value={String(filterYear)}
                onChange={(event) => chooseYear(Number(event.target.value))}
                aria-label="Tahun"
              >
                <NativeSelectOption value="0">— Semua tahun —</NativeSelectOption>
                {years.map((year) => (
                  <NativeSelectOption value={String(year)} key={year}>
                    {year}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {(filterMonth > 0 || filterYear > 0) && (
                <button
                  type="button"
                  className="chip chip-reset"
                  onClick={() => {
                    setFilterMonth(0);
                    setFilterYear(0);
                    setPeriodDays(0);
                    setPage(1);
                  }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          {payload?.meta.warning && <div className="data-warning">⚠ {payload.meta.warning}</div>}
          <div id="article-count">
            <strong>{formatNumber(filtered.length)}</strong> artikel ditampilkan
            {subcluster !== "all" && (
              <span> · {SUBCLUSTER_BY_ID[subcluster]?.shortLabel ?? subcluster}</span>
            )}
          </div>

          <div className="article-list" id="article-list">
            {!payload && !loadError && (
              <div className="state-msg"><div className="icon">⏳</div>Memuat data berita…</div>
            )}
            {loadError && (
              <div className="state-msg">
                <div className="icon">⚠️</div>
                {loadError}
                <br />
                <small>Jalankan workflow pembaruan data di GitHub.</small>
              </div>
            )}
            {payload && !visibleArticles.length && (
              <div className="state-msg"><div className="icon">🔍</div>Tidak ada artikel yang cocok dengan filter ini.</div>
            )}
            {visibleArticles.map((article) => {
              const clusterInfo = CLUSTER_BY_ID[article.primaryCluster] ?? CLUSTERS[0];
              const subclusterInfo = SUBCLUSTER_BY_ID[article.primarySubcluster];
              return (
                <article
                  className="article-card"
                  style={{ "--topic-color": clusterInfo?.color ?? "#6b7280" } as CSSProperties}
                  key={article.id}
                >
                  <div className="article-meta">
                    <span
                      className="badge"
                      style={{
                        color: clusterInfo?.color,
                        backgroundColor: (clusterInfo?.color ?? "#6b7280") + "16",
                      }}
                    >
                      {clusterInfo?.shortLabel ?? article.primaryCluster}
                    </span>
                    <span className="subcluster-badge">
                      {subclusterInfo?.shortLabel ?? article.primarySubcluster}
                    </span>
                    <span className="article-source">{article.source}</span>
                    <span className="article-date">{formatDate(article.publishedAt)}</span>
                  </div>
                  <h2 className="article-title">
                    <a href={article.link} target="_blank" rel="noreferrer">
                      {article.title}
                    </a>
                  </h2>
                  {article.description && <p className="article-desc">{article.description}</p>}
                  <div className="review-row">
                    <span className={article.humanVerified ? "review-verified" : "review-pending"}>
                      {article.humanVerified ? "✓ Coding HAM terverifikasi" : "○ Coding otomatis · belum ditinjau"}
                    </span>
                    {article.subclusterIds.length > 1 && (
                      <span>{article.subclusterIds.length} subkluster terdeteksi</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {filtered.length > perPage && (
            <div className="pagination">
              <Button
                variant="outline"
                size="sm"
                className="page-btn"
                disabled={safePage === 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
              >
                ‹ Prev
              </Button>
              {pageItems(safePage, totalPages).map((item, index) =>
                item === "ellipsis" ? (
                  <span className="page-ellipsis" key={"e-" + index}>…</span>
                ) : (
                  <Button
                    variant={item === safePage ? "default" : "outline"}
                    size="sm"
                    className={"page-btn " + (item === safePage ? "active" : "")}
                    onClick={() => setPage(item)}
                    key={item}
                  >
                    {item}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="sm"
                className="page-btn"
                disabled={safePage === totalPages}
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              >
                Next ›
              </Button>
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="card">
            <div className="card-header">Ringkasan Keseluruhan</div>
            <div className="card-body">
              <div className="stat-grid">
                <div className="stat-item total">
                  <div className="stat-num">{formatNumber(articles.length)}</div>
                  <div className="stat-label">Total</div>
                  <Sparkline articles={articles} color="#374151" />
                </div>
                {CLUSTERS.map((item) => (
                  <div className="stat-item" key={item.id}>
                    <div className="stat-num" style={{ color: item.color }}>
                      {formatNumber(clusterCounts[item.id] ?? 0)}
                    </div>
                    <div className="stat-label">{item.id === "digital" ? "Digital" : item.id.toUpperCase()}</div>
                    <Sparkline articles={articles} cluster={item.id} color={item.color} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Aktivitas Hari Ini</div>
            <div className="card-body">
              <div className="today-big">
                <span className="today-num">{formatNumber(todayCount)}</span>
                <span className="today-label">berita masuk<br />hari ini</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Sebaran Kluster</div>
            <div className="card-body">
              <div className="chart-wrap">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 280, height: 180 }}
                >
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={3}
                    >
                      {donutData.map((item) => <Cell fill={item.color} key={item.name} />)}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value) => formatNumber(Number(value))}
                      contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: "#e5e7eb" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                {donutData.map((item) => (
                  <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Tren 30 Hari Terakhir</div>
            <div className="card-body">
              <div className="trend-wrap">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 280, height: 150 }}
                >
                  <BarChart data={trendData} margin={{ top: 6, right: 0, left: -27, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 9 }}
                      interval={5}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 9 }}
                    />
                    <RechartsTooltip
                      formatter={(value) => [formatNumber(Number(value)), "Berita"]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: "#e5e7eb" }}
                    />
                    <Bar dataKey="value" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Top 10 Sumber Media</div>
            <div className="card-body">
              <div className="source-list">
                {topSources.length ? (
                  topSources.map(([sourceName, count]) => (
                    <button
                      type="button"
                      className="source-row"
                      onClick={() => {
                        setSearch(sourceName);
                        setPage(1);
                      }}
                      title={"Filter " + sourceName}
                      key={sourceName}
                    >
                      <span className="source-name">{sourceName}</span>
                      <span className="source-bar-wrap">
                        <span
                          className="source-bar"
                          style={{ width: Math.round((count / maxSource) * 100) + "%" }}
                        />
                      </span>
                      <span className="source-count">{formatNumber(count)}</span>
                    </button>
                  ))
                ) : (
                  <div className="muted-small">Belum ada data</div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Ekspor Data (sesuai filter aktif)</div>
            <div className="card-body">
              <Button
                type="button"
                className="btn btn-excel"
                onClick={() => void downloadExcel(filtered)}
                disabled={!filtered.length}
              >
                <Download /> Unduh Excel (.xlsx)
              </Button>
              <Button
                type="button"
                className="btn btn-csv"
                onClick={() => downloadCsv(filtered)}
                disabled={!filtered.length}
              >
                <Download /> Unduh CSV
              </Button>
            </div>
          </div>

          <div className="card review-note">
            <div className="card-header">Status Verifikasi</div>
            <div className="card-body">
              <p>
                Metadata dan kluster diisi otomatis. Coding HAM perlu diperiksa manusia melalui
                kolom verifikasi di <b>public/data/news.csv</b>.
              </p>
              <div className="review-summary">
                <span><b>{formatNumber(articles.filter((item) => item.humanVerified).length)}</b> terverifikasi</span>
                <span><b>{formatNumber(articles.filter((item) => !item.humanVerified).length)}</b> menunggu tinjauan</span>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
