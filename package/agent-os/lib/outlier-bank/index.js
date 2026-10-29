/**
 * OUTLIER BANK — bibliothèque locale de vidéos YouTube longues.
 * Ne dépend ni de Scrap-o-matic, ni des machines : les données sont privées à cette feature.
 */
const fs = require("fs");
const path = require("path");
const { DATA_DIR, ensureDir, readJSON, writeJSON } = require("../store");
const yt = require("./youtube-adapter");

const BANK_FILE = "outliers/library.json";
const MEDIA_ROOT = process.env.AGENTIC_OS_MEDIA_ROOT
  ? path.resolve(process.env.AGENTIC_OS_MEDIA_ROOT)
  : path.resolve(__dirname, "..", "..", "..", "medias");
const MEDIA_DIR = path.join(MEDIA_ROOT, "Outliers");
const PROJECT_ROOT = path.dirname(MEDIA_ROOT);
const MAX_SCORE = 999;

ensureDir(path.join(DATA_DIR, "outliers"));
ensureDir(MEDIA_DIR);

function emptyLibrary() {
  return { version: 1, folders: [], outliers: [] };
}

function library() {
  const value = readJSON(BANK_FILE, emptyLibrary());
  return {
    version: 1,
    lastUpdatedAt: value.lastUpdatedAt || null,
    folders: Array.isArray(value.folders) ? value.folders : [],
    outliers: Array.isArray(value.outliers) ? value.outliers : [],
  };
}

async function refreshOutlier(item) {
  const videoData = await yt.dataApi("videos", { part: "snippet,statistics,contentDetails", id: item.videoId }, 1, "Outlier Bank", "Mise à jour : vidéo");
  const video = videoData.items?.[0];
  if (!video) throw new Error("Vidéo YouTube introuvable");
  if (durationSeconds(video.contentDetails?.duration) <= 62 || /#shorts/i.test(video.snippet?.title || "")) {
    throw new Error("La vidéo est devenue un Short ou sa durée est indisponible");
  }
  const channelId = video.snippet?.channelId || item.channelId;
  const channelData = await yt.dataApi("channels", { part: "statistics,contentDetails", id: channelId }, 1, "Outlier Bank", "Mise à jour : chaîne");
  const channel = channelData.items?.[0];
  if (!channel) throw new Error("Chaîne YouTube introuvable");
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("Historique public de la chaîne indisponible");
  const playlist = await yt.dataApi("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: "50" }, 1, "Outlier Bank", "Mise à jour : historique");
  const ids = (playlist.items || []).map((entry) => entry.contentDetails?.videoId).filter(Boolean);
  const historyData = ids.length ? await yt.dataApi("videos", { part: "statistics,snippet", id: ids.join(","), maxResults: "50" }, 1, "Outlier Bank", "Mise à jour : vues historiques") : { items: [] };
  let previous = (historyData.items || [])
    .map((entry) => ({ id: entry.id, views: Number(entry.statistics?.viewCount || 0), publishedAt: entry.snippet?.publishedAt }))
    .filter((entry) => entry.id !== item.videoId && new Date(entry.publishedAt) < new Date(video.snippet?.publishedAt));
  if (!previous.length) previous = (historyData.items || []).map((entry) => ({ id: entry.id, views: Number(entry.statistics?.viewCount || 0) })).filter((entry) => entry.id !== item.videoId);
  const avgPreviousViews = previous.length ? Math.round(previous.reduce((total, entry) => total + entry.views, 0) / previous.length) : 0;
  const thumbnailRel = await saveThumbnail(item.videoId);
  return {
    ...item,
    channelId,
    title: String(video.snippet?.title || item.title),
    channelTitle: String(video.snippet?.channelTitle || item.channelTitle),
    viewCount: Number(video.statistics?.viewCount || 0),
    subscriberCount: Number(channel.statistics?.subscriberCount || 0),
    publishedAt: video.snippet?.publishedAt || item.publishedAt,
    avgPreviousViews,
    ...(thumbnailRel ? { thumbnailRel } : {}),
  };
}

async function updateAll() {
  const db = library();
  const updated = [];
  const errors = [];
  for (const item of db.outliers) {
    try { updated.push(await refreshOutlier(item)); }
    catch (error) { errors.push({ videoId: item.videoId, title: item.title, error: error.message }); }
  }
  if (updated.length) {
    const byId = new Map(updated.map((item) => [item.videoId, item]));
    db.outliers = db.outliers.map((item) => byId.get(item.videoId) || item);
    db.lastUpdatedAt = new Date().toISOString();
    save(db);
  }
  return { total: db.outliers.length, updated: updated.length, failed: errors.length, errors, lastUpdatedAt: db.lastUpdatedAt || null, library: overview() };
}

function save(value) {
  writeJSON(BANK_FILE, value);
}

function videoIdFrom(input) {
  return /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/.exec(String(input || ""))?.[1]
    || /^([\w-]{11})$/.exec(String(input || "").trim())?.[1]
    || null;
}

function durationSeconds(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(String(iso || ""));
  return m ? (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0) : 0;
}

function outlierScore(viewCount, avgPreviousViews) {
  const avg = Number(avgPreviousViews) || 0;
  return avg > 0 ? Math.round(Math.min((Number(viewCount) || 0) / avg, MAX_SCORE) * 10) / 10 : null;
}

function publicOutlier(item) {
  return {
    ...item,
    folderIds: Array.isArray(item.folderIds) ? item.folderIds : [],
    videoUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
    channelUrl: `https://www.youtube.com/channel/${item.channelId}`,
    thumbnailUrl: item.thumbnailRel ? `/media/${encodeURIComponent(item.thumbnailRel)}` : null,
    outlierScore: outlierScore(item.viewCount, item.avgPreviousViews),
  };
}

function covers(items) {
  return items
    .slice()
    .sort((a, b) => (outlierScore(b.viewCount, b.avgPreviousViews) || -1) - (outlierScore(a.viewCount, a.avgPreviousViews) || -1))
    .slice(0, 4)
    .map((item) => publicOutlier(item).thumbnailUrl)
    .filter(Boolean);
}

function overview() {
  const db = library();
  const grouped = (folderId) => db.outliers.filter((item) => folderId === "inbox"
    ? !(item.folderIds || []).length
    : (item.folderIds || []).includes(folderId));
  const folders = db.folders.map((folder) => {
    const items = grouped(folder.id);
    return { ...folder, count: items.length, covers: covers(items) };
  }).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const inbox = grouped("inbox");
  return {
    folders,
    inbox: { id: "inbox", name: "Inbox", count: inbox.length, covers: covers(inbox), system: true },
    total: db.outliers.length,
    lastUpdatedAt: db.lastUpdatedAt || null,
  };
}

function list({ folderId, q, sort } = {}) {
  const db = library();
  const query = String(q || "").trim().toLocaleLowerCase("fr");
  let items = db.outliers.filter((item) => {
    if (folderId === "inbox" && (item.folderIds || []).length) return false;
    if (folderId && folderId !== "inbox" && !(item.folderIds || []).includes(folderId)) return false;
    return !query || `${item.title} ${item.channelTitle}`.toLocaleLowerCase("fr").includes(query);
  });
  const order = sort || "outlier";
  items.sort((a, b) => {
    if (order === "views") return Number(b.viewCount) - Number(a.viewCount);
    if (order === "published") return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
    if (order === "added") return String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
    return (outlierScore(b.viewCount, b.avgPreviousViews) || -1) - (outlierScore(a.viewCount, a.avgPreviousViews) || -1);
  });
  return { ...overview(), items: items.map(publicOutlier) };
}

function createFolder(name) {
  const clean = String(name || "").trim().slice(0, 80);
  if (!clean) throw new Error("Nom de folder requis");
  const db = library();
  if (db.folders.some((folder) => folder.name.localeCompare(clean, "fr", { sensitivity: "accent" }) === 0)) {
    throw new Error("Un folder porte déjà ce nom");
  }
  const folder = { id: "f" + Date.now().toString(36), name: clean, createdAt: new Date().toISOString() };
  db.folders.push(folder);
  save(db);
  return folder;
}

function renameFolder(id, name) {
  const clean = String(name || "").trim().slice(0, 80);
  if (!clean) throw new Error("Nom de folder requis");
  const db = library();
  const folder = db.folders.find((entry) => entry.id === id);
  if (!folder) throw new Error("Folder introuvable");
  if (db.folders.some((entry) => entry.id !== id && entry.name.localeCompare(clean, "fr", { sensitivity: "accent" }) === 0)) {
    throw new Error("Un folder porte déjà ce nom");
  }
  folder.name = clean;
  folder.updatedAt = new Date().toISOString();
  save(db);
  return folder;
}

function removeFolder(id) {
  const db = library();
  if (!db.folders.some((folder) => folder.id === id)) throw new Error("Folder introuvable");
  db.folders = db.folders.filter((folder) => folder.id !== id);
  for (const item of db.outliers) item.folderIds = (item.folderIds || []).filter((folderId) => folderId !== id);
  save(db);
}

function setFolders(videoId, folderIds) {
  const db = library();
  const item = db.outliers.find((entry) => entry.videoId === videoId);
  if (!item) throw new Error("Vidéo introuvable");
  const valid = new Set(db.folders.map((folder) => folder.id));
  item.folderIds = [...new Set(Array.isArray(folderIds) ? folderIds : [])].filter((id) => valid.has(id));
  item.updatedAt = new Date().toISOString();
  save(db);
  return publicOutlier(item);
}

function removeOutlier(videoId) {
  const db = library();
  const item = db.outliers.find((entry) => entry.videoId === videoId);
  if (!item) throw new Error("Vidéo introuvable");
  db.outliers = db.outliers.filter((entry) => entry.videoId !== videoId);
  save(db);
  if (item.thumbnailRel) {
    const target = path.resolve(PROJECT_ROOT, item.thumbnailRel);
    const relative = path.relative(MEDIA_DIR, target);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      try { fs.unlinkSync(target); } catch {}
    }
  }
}

async function saveThumbnail(videoId) {
  const target = path.join(MEDIA_DIR, `${videoId}.jpg`);
  for (const quality of ["maxresdefault", "sddefault", "hqdefault"]) {
    const response = await fetch(`https://i.ytimg.com/vi/${videoId}/${quality}.jpg`);
    if (!response.ok || !/^image\//i.test(response.headers.get("content-type") || "")) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) continue;
    fs.writeFileSync(target, buffer);
    return path.relative(PROJECT_ROOT, target).replace(/\\/g, "/");
  }
  return null;
}

async function addByUrl(input, folderIds = []) {
  const videoId = videoIdFrom(input);
  if (!videoId) throw new Error("URL YouTube invalide — colle un lien de vidéo longue");
  const db = library();
  const existing = db.outliers.find((item) => item.videoId === videoId);
  if (existing) {
    const validFolders = new Set(db.folders.map((folder) => folder.id));
    const requestedFolderIds = [...new Set(Array.isArray(folderIds) ? folderIds : [])].filter((id) => validFolders.has(id));
    const previousFolderIds = Array.isArray(existing.folderIds) ? existing.folderIds : [];
    const mergedFolderIds = [...new Set([...previousFolderIds, ...requestedFolderIds])];
    const foldersUpdated = mergedFolderIds.length !== previousFolderIds.length;
    if (foldersUpdated) {
      existing.folderIds = mergedFolderIds;
      existing.updatedAt = new Date().toISOString();
    }
    const thumbnailRel = await saveThumbnail(videoId);
    if (thumbnailRel) {
      existing.thumbnailRel = thumbnailRel;
    }
    if (foldersUpdated || thumbnailRel) save(db);
    return { outlier: publicOutlier(existing), duplicate: true, foldersUpdated };
  }

  const videoData = await yt.dataApi("videos", { part: "snippet,statistics,contentDetails", id: videoId }, 1, "Outlier Bank", "Ajout manuel : vidéo");
  const video = videoData.items?.[0];
  if (!video) throw new Error("Vidéo YouTube introuvable");
  if (durationSeconds(video.contentDetails?.duration) <= 62 || /#shorts/i.test(video.snippet?.title || "")) {
    throw new Error("Outlier Bank accepte uniquement les vidéos longues, jamais les Shorts");
  }

  const channelId = video.snippet?.channelId;
  const channelData = await yt.dataApi("channels", { part: "statistics,contentDetails", id: channelId }, 1, "Outlier Bank", "Ajout manuel : chaîne");
  const channel = channelData.items?.[0];
  const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel || !uploads) throw new Error("Impossible de récupérer l'historique public de cette chaîne");

  const playlist = await yt.dataApi("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: "50" }, 1, "Outlier Bank", "Calcul score : uploads chaîne");
  const ids = (playlist.items || []).map((entry) => entry.contentDetails?.videoId).filter(Boolean);
  const historyData = ids.length
    ? await yt.dataApi("videos", { part: "statistics,snippet", id: ids.join(","), maxResults: "50" }, 1, "Outlier Bank", "Calcul score : vues historiques")
    : { items: [] };
  let previous = (historyData.items || [])
    .map((entry) => ({ id: entry.id, views: Number(entry.statistics?.viewCount || 0), publishedAt: entry.snippet?.publishedAt }))
    .filter((entry) => entry.id !== videoId && new Date(entry.publishedAt) < new Date(video.snippet?.publishedAt));
  if (!previous.length) previous = (historyData.items || [])
    .map((entry) => ({ id: entry.id, views: Number(entry.statistics?.viewCount || 0) }))
    .filter((entry) => entry.id !== videoId);
  const avgPreviousViews = previous.length
    ? Math.round(previous.reduce((total, entry) => total + entry.views, 0) / previous.length)
    : 0;

  const validFolders = new Set(db.folders.map((folder) => folder.id));
  const thumbnailRel = await saveThumbnail(videoId);
  const now = new Date().toISOString();
  const item = {
    videoId,
    channelId,
    title: String(video.snippet?.title || "Vidéo sans titre"),
    channelTitle: String(video.snippet?.channelTitle || "Chaîne sans nom"),
    viewCount: Number(video.statistics?.viewCount || 0),
    subscriberCount: Number(channel.statistics?.subscriberCount || 0),
    publishedAt: video.snippet?.publishedAt || null,
    thumbnailRel,
    avgPreviousViews,
    folderIds: [...new Set(Array.isArray(folderIds) ? folderIds : [])].filter((id) => validFolders.has(id)),
    savedAt: now,
  };
  db.outliers.push(item);
  save(db);
  return { outlier: publicOutlier(item), duplicate: false };
}

module.exports = {
  overview, list, updateAll, createFolder, renameFolder, removeFolder, setFolders, removeOutlier, addByUrl,
  diagnostics: () => ({ storage: BANK_FILE, mediaDir: MEDIA_DIR, youtube: yt.status() }),
  _test: { videoIdFrom, durationSeconds, outlierScore, emptyLibrary },
};
