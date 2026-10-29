"use strict";

const crypto = require("crypto");
const { readJSON, writeJSON } = require("../store");

const DAILY_QUOTA = 10000;
const LEDGER_FILE = "outliers/youtube-quota.json";

function environmentKeys() {
  const values = [process.env.YOUTUBE_API_KEY, process.env.YOUTUBE_API_KEYS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[\s,;]+/))
    .map((key) => key.trim())
    .filter(Boolean);
  return values.map((key, index) => ({ label: `Environment ${index + 1}`, key }));
}

function vaultKeys() {
  try {
    const vault = require("../vault");
    if (typeof vault.youtubeKeys !== "function") return [];
    return vault.youtubeKeys()
      .filter((entry) => entry?.key)
      .map((entry, index) => ({ label: entry.label || `Coffre ${index + 1}`, key: String(entry.key) }));
  } catch {
    return [];
  }
}

function youtubeKeys() {
  const unique = new Map();
  for (const entry of [...vaultKeys(), ...environmentKeys()]) {
    if (!unique.has(entry.key)) unique.set(entry.key, entry);
  }
  return [...unique.values()];
}

function day() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function ledger() {
  return readJSON(LEDGER_FILE, {});
}

function keyId(entry) {
  // Empreinte courte pour distinguer les clés sans jamais les conserver dans le ledger.
  return `${entry.label}:${crypto.createHash("sha256").update(entry.key).digest("hex").slice(0, 12)}`;
}

function updateUsage(entry, units, exhausted = false) {
  const data = ledger();
  const currentDay = day();
  data[currentDay] ||= {};
  const id = keyId(entry);
  data[currentDay][id] = exhausted ? DAILY_QUOTA : (data[currentDay][id] || 0) + units;
  const recent = Object.keys(data).sort().slice(-30);
  writeJSON(LEDGER_FILE, Object.fromEntries(recent.map((date) => [date, data[date]])));
}

function remaining(entry) {
  return Math.max(0, DAILY_QUOTA - (ledger()[day()]?.[keyId(entry)] || 0));
}

function status() {
  const vault = vaultKeys();
  const environment = environmentKeys();
  const keys = youtubeKeys();
  return {
    compatible: true,
    bundled: true,
    configured: keys.length > 0,
    keyCount: keys.length,
    sources: { vault: vault.length, environment: environment.length },
    message: keys.length
      ? `${keys.length} clé(s) YouTube détectée(s).`
      : "Aucune clé YouTube détectée. Ajoutez-la au coffre Agentic OS ou configurez YOUTUBE_API_KEY/YOUTUBE_API_KEYS, puis relancez le serveur.",
  };
}

async function dataApi(endpoint, params = {}, unitCost = 1) {
  if (!/^[a-zA-Z]+$/.test(String(endpoint))) throw new Error("Endpoint YouTube invalide");
  const keys = youtubeKeys();
  if (!keys.length) throw new Error(status().message);

  const candidates = keys.slice().sort((a, b) => remaining(b) - remaining(a));
  let lastQuotaError = null;
  for (const entry of candidates) {
    if (remaining(entry) < unitCost) continue;
    const query = new URLSearchParams({ ...params, key: entry.key });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${query}`);
    const payload = await response.json().catch(() => ({}));
    if (response.ok && !payload.error) {
      updateUsage(entry, unitCost);
      return payload;
    }
    const reasons = payload.error?.errors?.map((error) => error.reason) || [];
    const quotaExceeded = reasons.some((reason) => ["quotaExceeded", "dailyLimitExceeded"].includes(reason));
    if (quotaExceeded) {
      updateUsage(entry, 0, true);
      lastQuotaError = new Error("Quota YouTube épuisé pour une clé ; tentative avec la suivante.");
      continue;
    }
    throw new Error(`YouTube API : ${payload.error?.message || `HTTP ${response.status}`}`);
  }
  throw lastQuotaError || new Error("Quota YouTube épuisé pour toutes les clés configurées.");
}

module.exports = {
  dataApi,
  status,
  _test: { environmentKeys, youtubeKeys, day },
};
