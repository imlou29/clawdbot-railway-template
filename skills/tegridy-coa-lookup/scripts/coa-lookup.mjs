#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://www.peptegridy.com/coas";
const CACHE_TTL_MS = 120_000;
const CACHE_FILE = process.env.TEGRIDY_COA_CACHE_FILE || "/tmp/tegridy-coa-cache.json";
const UA = "TegridyAI-COA-Lookup/0.1 (+https://www.peptegridy.com/coas)";

function parseArgs(argv) {
  const out = { query: "", groupBuy: "", noCache: false, debug: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--query" || a === "-q") out.query = argv[++i] || "";
    else if (a === "--group-buy" || a === "--gb") out.groupBuy = argv[++i] || "";
    else if (a === "--no-cache") out.noCache = true;
    else if (a === "--debug") out.debug = true;
    else if (!a.startsWith("-") && !out.query) out.query = a;
  }
  return out;
}

function decodeHtml(s = "") {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(html = "") {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(s = "") {
  return decodeHtml(String(s))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugLabel(slug = "") {
  return slug
    .replace(/-+/g, " ")
    .replace(/\bgb\b/gi, "GB")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function loadCache() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (!data || typeof data !== "object") return null;
    if (Date.now() - Number(data.fetchedAt || 0) > CACHE_TTL_MS) return null;
    if (!Array.isArray(data.records)) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(records, pages) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(
      tmp,
      JSON.stringify({ fetchedAt: Date.now(), records, pages }, null, 2),
      "utf8"
    );
    fs.renameSync(tmp, CACHE_FILE);
  } catch {
    // Cache is an optimization only; live lookup must still work if it cannot be written.
  }
}

function extractBatchUrls(html) {
  const urls = new Map();
  const re = /href=["']([^"']*\/coas\?batch=([^"'&#]+)[^"']*)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = decodeURIComponent(m[2]);
    const href = new URL(decodeHtml(m[1]), BASE_URL).toString();
    urls.set(slug, href);
  }
  return [...urls.entries()].map(([slug, url]) => ({
    slug,
    label: slugLabel(slug),
    url,
  }));
}

function fieldFromText(text, labels) {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\s)${label}\\s*[:#]?\\s*([^|]+?)(?=\\s+(?:PEPTIDE|LAB|BATCH|TESTED|PURITY|QUANTITY|COA\\s*#|REPORT\\s+NOTE|IDENTITY|ENDOTOXINS|STERILITY)\\b|$)`, "i");
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function deriveProduct(text) {
  const cleaned = text.replace(/\bView COA\b[\s\S]*$/i, "").trim();
  const beforeFields = cleaned.split(/\b(?:PEPTIDE|LAB|BATCH|TESTED|REPORT DETAILS|COA\s*#|PURITY|QUANTITY)\b/i)[0].trim();
  const bits = beforeFields.split(/\s{2,}|\|/).map((x) => x.trim()).filter(Boolean);
  return bits.at(-1) || beforeFields || "";
}

function extractRecordsFromBatchHtml(html, batchInfo) {
  const records = [];
  const anchorRe = /<a\b([^>]*\bhref=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const anchors = [];
  let m;
  while ((m = anchorRe.exec(html))) {
    const label = stripTags(m[3]);
    if (/\bview\s+coa\b/i.test(label)) {
      anchors.push({ index: m.index, href: new URL(decodeHtml(m[2]), batchInfo.url).toString() });
    }
  }

  for (let i = 0; i < anchors.length; i += 1) {
    const end = anchors[i].index;
    const start = i === 0 ? Math.max(0, end - 18_000) : anchors[i - 1].index + 1;
    let chunk = html.slice(start, end);

    // Prefer the nearest card-like container by trimming to the last likely report heading boundary.
    const boundaries = [
      /(?:<article\b|<section\b|<div\b)[^>]*(?:card|report|coa)[^>]*>/gi,
      /(?:FINISHED BUY|SHIPPING|GROUP BUY)/gi,
    ];
    for (const re of boundaries) {
      let last = -1;
      let bm;
      while ((bm = re.exec(chunk))) last = bm.index;
      if (last >= 0) chunk = chunk.slice(last);
    }

    const text = stripTags(chunk);
    const product = deriveProduct(text);
    const lab = fieldFromText(text, ["LAB"]);
    const batch = fieldFromText(text, ["BATCH"]);
    const tested = fieldFromText(text, ["TESTED"]);
    const purity = fieldFromText(text, ["PURITY"]);
    const quantity = fieldFromText(text, ["QUANTITY"]);
    const coaNumber = fieldFromText(text, ["COA\\s*#"]);

    records.push({
      groupBuy: batchInfo.label,
      groupBuySlug: batchInfo.slug,
      product,
      lab,
      batch,
      tested,
      purity,
      quantity,
      coaNumber,
      url: anchors[i].href,
      sourceUrl: batchInfo.url,
    });
  }

  // De-duplicate exact View COA URLs.
  return [...new Map(records.map((r) => [r.url, r])).values()];
}

async function buildLiveIndex(debug = false) {
  const baseHtml = await fetchText(BASE_URL);
  const batchUrls = extractBatchUrls(baseHtml);
  if (!batchUrls.length) {
    throw new Error("No batch links were discoverable on the live COA page");
  }

  const records = [];
  const pages = [];
  for (const batchInfo of batchUrls) {
    try {
      const html = await fetchText(batchInfo.url);
      const batchRecords = extractRecordsFromBatchHtml(html, batchInfo);
      records.push(...batchRecords);
      pages.push({ ...batchInfo, records: batchRecords.length, ok: true });
    } catch (err) {
      pages.push({ ...batchInfo, records: 0, ok: false, error: String(err?.message || err) });
      if (debug) console.error(`[coa-lookup] Failed ${batchInfo.url}: ${err}`);
    }
  }

  if (!records.length) {
    throw new Error("Live COA pages were reachable, but no View COA records could be extracted");
  }
  return { records, pages };
}

function scoreRecord(record, query, groupBuy) {
  const q = normalize(query);
  const g = normalize(groupBuy);
  const product = normalize(record.product);
  const haystack = normalize([
    record.product,
    record.groupBuy,
    record.batch,
    record.lab,
    record.coaNumber,
  ].join(" "));

  let score = 0;
  if (product === q) score += 100;
  if (product.includes(q) && q) score += 70;
  if (haystack.includes(q) && q) score += 45;

  const qTokens = q.split(" ").filter(Boolean);
  if (qTokens.length) {
    const hitCount = qTokens.filter((t) => haystack.includes(t)).length;
    score += (hitCount / qTokens.length) * 30;
  }

  if (g) {
    const gb = normalize(record.groupBuy);
    const gs = normalize(record.groupBuySlug);
    if (gb === g || gs === g) score += 50;
    else if (gb.includes(g) || g.includes(gb) || gs.includes(g)) score += 30;
    else score -= 40;
  }

  return score;
}

function chooseMatches(records, query, groupBuy) {
  const ranked = records
    .map((record) => ({ record, score: scoreRecord(record, query, groupBuy) }))
    .filter((x) => x.score >= 35)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return [];
  const best = ranked[0].score;
  return ranked
    .filter((x) => x.score >= Math.max(35, best - 18))
    .map((x) => x.record);
}

const args = parseArgs(process.argv.slice(2));
if (!args.query) {
  console.error("Usage: node coa-lookup.mjs --query \"Product name\" [--group-buy \"June 26 GB\"] [--no-cache] [--debug]");
  process.exit(2);
}

const started = Date.now();

try {
  let cache = !args.noCache ? loadCache() : null;
  let cacheStatus = "hit";

  if (!cache) {
    cacheStatus = "miss";
    const live = await buildLiveIndex(args.debug);
    cache = { fetchedAt: Date.now(), records: live.records, pages: live.pages };
    saveCache(live.records, live.pages);
  }

  const matches = chooseMatches(cache.records, args.query, args.groupBuy);
  const result = {
    status: matches.length === 0 ? "not_found" : matches.length === 1 ? "found" : "multiple",
    query: args.query,
    groupBuy: args.groupBuy || null,
    source: BASE_URL,
    liveDataAgeSeconds: Math.max(0, Math.round((Date.now() - Number(cache.fetchedAt || Date.now())) / 1000)),
    cache: cacheStatus,
    elapsedMs: Date.now() - started,
    matches: matches.map((r) => ({
      groupBuy: r.groupBuy,
      product: r.product,
      batch: r.batch || null,
      lab: r.lab || null,
      purity: r.purity || null,
      quantity: r.quantity || null,
      url: r.url,
    })),
  };

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(JSON.stringify({
    status: "error",
    query: args.query,
    groupBuy: args.groupBuy || null,
    source: BASE_URL,
    elapsedMs: Date.now() - started,
    error: String(err?.message || err),
  }, null, 2));
  process.exitCode = 1;
}
