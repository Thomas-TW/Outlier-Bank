"use strict";

const DEFAULT_ORIGIN = "http://127.0.0.1:4100";
const QUEUE_KEY = "outlierBankQueue";
const SETTINGS_KEY = "outlierBankSettings";

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || DEFAULT_ORIGIN).trim());
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error();
    return url.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

async function settings() {
  const stored = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] || {};
  return { origin: normalizeOrigin(stored.origin) };
}

async function queue() { return (await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY] || []; }
async function put(items) { await chrome.storage.local.set({ [QUEUE_KEY]: items }); }

async function send(entry) {
  const { origin } = await settings();
  let response;
  try {
    response = await fetch(`${origin}/api/outliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: entry.url, folderIds: [] }),
    });
  } catch {
    const error = new Error("Agentic OS inaccessible");
    error.offline = true;
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function save(entry) {
  try {
    const result = await send(entry);
    return { state: "saved", duplicate: !!result.duplicate };
  } catch (error) {
    if (!error.offline) return { state: "error", error: error.message };
    const items = await queue();
    if (!items.some((item) => item.videoId === entry.videoId)) await put([...items, entry]);
    return { state: "pending", error: error.message };
  }
}

async function sync() {
  const items = await queue();
  const remaining = [];
  for (const item of items) {
    try { await send(item); } catch { remaining.push(item); }
  }
  await put(remaining);
  return { pending: remaining.length, synced: items.length - remaining.length };
}

async function health() {
  const { origin } = await settings();
  const response = await fetch(`${origin}/api/outliers/health`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type === "save") save(message.entry).then(reply);
  else if (message.type === "sync") sync().then(reply);
  else if (message.type === "health") health().then((result) => reply({ ok: true, result })).catch((error) => reply({ ok: false, error: error.message }));
  else return;
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("outlier-bank-sync", { periodInMinutes: 1 });
  sync();
});
chrome.runtime.onStartup.addListener(sync);
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "outlier-bank-sync") sync(); });
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
