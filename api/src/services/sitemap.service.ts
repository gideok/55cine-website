import sql from "mssql";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { getMovieList, type MovieSection } from "./movies.service.js";

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

const STATIC_PATHS: Array<{ path: string; changefreq: SitemapEntry["changefreq"]; priority: string }> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/now-playing.html", changefreq: "daily", priority: "0.9" },
  { path: "/upcoming-playing.html", changefreq: "daily", priority: "0.8" },
  { path: "/past-playing.html", changefreq: "weekly", priority: "0.7" },
  { path: "/magazine-preview.html", changefreq: "weekly", priority: "0.8" },
  { path: "/magazine-serial.html", changefreq: "weekly", priority: "0.7" },
  { path: "/gv-moment.html", changefreq: "weekly", priority: "0.7" },
  { path: "/magazine-past-articles.html", changefreq: "weekly", priority: "0.6" },
  { path: "/special-exhibition.html", changefreq: "weekly", priority: "0.8" },
  { path: "/special-event.html", changefreq: "weekly", priority: "0.7" },
  { path: "/theater-info.html", changefreq: "monthly", priority: "0.6" },
  { path: "/viewing-guide.html", changefreq: "monthly", priority: "0.5" },
  { path: "/membership.html", changefreq: "monthly", priority: "0.5" },
  { path: "/seat-sponsor.html", changefreq: "monthly", priority: "0.4" },
  { path: "/daegwan.html", changefreq: "monthly", priority: "0.4" },
  { path: "/osinneun-gil.html", changefreq: "monthly", priority: "0.4" }
];

const MOVIE_SECTIONS: MovieSection[] = ["now-playing", "upcoming", "past"];

function siteBase(): string {
  return config.siteUrl.replace(/\/+$/, "");
}

function toAbsoluteUrl(pathOrUrl: string): string {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return siteBase() + "/";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw === "/") return siteBase() + "/";
  return `${siteBase()}/${raw.replace(/^\/+/, "")}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toLastmod(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function magazineDetailPath(row: {
  seq: number;
  section: string | null;
  is_past: boolean | number | null;
}): string {
  const id = encodeURIComponent(String(row.seq));
  const isPast = row.is_past === true || row.is_past === 1;
  if (isPast) {
    return `magazine/past-articles/article-detail.html?id=${id}`;
  }
  switch (String(row.section || "").trim()) {
    case "serial":
      return `magazine/serial/article-detail.html?id=${id}`;
    case "gv-moment":
      return `magazine/gv-moment/article-detail.html?id=${id}`;
    default:
      return `magazine/preview/article-detail.html?id=${id}`;
  }
}

function specialDetailPath(kind: string, publicId: string): string {
  const id = encodeURIComponent(String(publicId || "").trim());
  if (kind === "event") {
    return `special/event/event_detail.html?id=${id}`;
  }
  return `special/exhibition/exhibition_detail.html?id=${id}`;
}

function renderUrlEntry(entry: SitemapEntry): string {
  const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
  if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

async function collectMovieEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();

  for (const section of MOVIE_SECTIONS) {
    const { movies } = await getMovieList(section);
    for (const movie of movies) {
      const path =
        movie.detailUrl?.trim() ||
        `movies/movie-detail.html?slug=${encodeURIComponent(movie.slug)}&from=${section}`;
      const loc = toAbsoluteUrl(path);
      if (seen.has(loc)) continue;
      seen.add(loc);
      entries.push({
        loc,
        changefreq: section === "now-playing" ? "daily" : "weekly",
        priority: section === "now-playing" ? "0.8" : "0.6"
      });
    }
  }

  return entries;
}

async function collectMagazineEntries(): Promise<SitemapEntry[]> {
  const pool = await getPool();
  const result = await pool.request().query<{
    seq: number;
    section: string | null;
    is_past: boolean | number | null;
    updated_at: Date | null;
    published_at: Date | null;
  }>(`
    SELECT seq, section, is_past, updated_at, published_at
    FROM dbo.web_magazine
    ORDER BY seq ASC
  `);

  return result.recordset.map((row) => ({
    loc: toAbsoluteUrl(magazineDetailPath(row)),
    lastmod: toLastmod(row.updated_at) || toLastmod(row.published_at),
    changefreq: "weekly" as const,
    priority: "0.6"
  }));
}

async function collectSpecialEntries(): Promise<SitemapEntry[]> {
  const pool = await getPool();
  const result = await pool.request().query<{
    public_id: string;
    kind: string;
    updated_at: Date | null;
    created_at: Date | null;
  }>(`
    SELECT public_id, kind, updated_at, created_at
    FROM dbo.web_special
    WHERE public_id IS NOT NULL AND LTRIM(RTRIM(public_id)) <> ''
    ORDER BY list_order DESC, seq DESC
  `);

  return result.recordset.map((row) => ({
    loc: toAbsoluteUrl(specialDetailPath(row.kind, row.public_id)),
    lastmod: toLastmod(row.updated_at) || toLastmod(row.created_at),
    changefreq: "weekly" as const,
    priority: "0.7"
  }));
}

function staticEntries(): SitemapEntry[] {
  return STATIC_PATHS.map((item) => ({
    loc: toAbsoluteUrl(item.path),
    changefreq: item.changefreq,
    priority: item.priority
  }));
}

export async function buildSitemapXml(): Promise<string> {
  const entries: SitemapEntry[] = [...staticEntries()];

  if (config.db) {
    try {
      const [movies, magazines, specials] = await Promise.all([
        collectMovieEntries(),
        collectMagazineEntries(),
        collectSpecialEntries()
      ]);
      entries.push(...movies, ...magazines, ...specials);
    } catch (err) {
      // 정적 URL만이라도 반환해 크롤링이 완전히 막히지 않게 한다.
      console.error("[sitemap] dynamic URL collect failed:", err);
    }
  }

  const body = entries.map(renderUrlEntry).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function buildRobotsTxt(): string {
  const sitemapUrl = `${siteBase()}/sitemap.xml`;
  return `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/
Disallow: /partials/
Disallow: /components/
Disallow: /designsystem.html

Sitemap: ${sitemapUrl}
`;
}
