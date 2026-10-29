"use strict";

const bank = require("./index");

async function optionalNotify(telegram, text) {
  if (!telegram || typeof telegram.send !== "function") return false;
  try { await telegram.send(text); return true; } catch { return false; }
}

async function handle({ req, res, url, path, readBody, json, telegram }) {
  if (!path.startsWith("/api/outliers")) return false;

  if (path === "/api/outliers/health" && req.method === "GET") {
    json(res, 200, { ok: true, ...bank.diagnostics(), telegram: { configured: !!telegram?.send } });
    return true;
  }
  if (path === "/api/outliers" && req.method === "GET") {
    json(res, 200, bank.list({
      folderId: url.searchParams.get("folder") || null,
      q: url.searchParams.get("q") || "",
      sort: url.searchParams.get("sort") || "outlier",
    }));
    return true;
  }
  if (path === "/api/outliers" && req.method === "POST") {
    try {
      const body = await readBody(req);
      json(res, 200, await bank.addByUrl(body.url, body.folderIds));
    } catch (error) { json(res, 400, { error: error.message }); }
    return true;
  }
  if (path === "/api/outliers/update" && req.method === "POST") {
    try {
      const result = await bank.updateAll();
      const status = result.failed ? "⚠️" : "✅";
      optionalNotify(telegram, `${status} <b>Outlier Bank — mise à jour</b>\n${result.updated}/${result.total} vidéo(s) mise(s) à jour${result.failed ? `\n${result.failed} échec(s), données conservées` : ""}`);
      json(res, 200, result);
    } catch (error) {
      optionalNotify(telegram, `❌ <b>Outlier Bank — mise à jour impossible</b>\n${error.message}`);
      json(res, 500, { error: error.message });
    }
    return true;
  }
  if (path === "/api/outliers/folders" && req.method === "POST") {
    try { json(res, 200, bank.createFolder((await readBody(req)).name)); }
    catch (error) { json(res, 400, { error: error.message }); }
    return true;
  }

  let match = /^\/api\/outliers\/folders\/(f[\w-]+)$/.exec(path);
  if (match && req.method === "PATCH") {
    try { json(res, 200, bank.renameFolder(match[1], (await readBody(req)).name)); }
    catch (error) { json(res, 400, { error: error.message }); }
    return true;
  }
  if (match && req.method === "DELETE") {
    try { bank.removeFolder(match[1]); json(res, 200, { ok: true }); }
    catch (error) { json(res, 404, { error: error.message }); }
    return true;
  }

  match = /^\/api\/outliers\/([\w-]{11})$/.exec(path);
  if (match && req.method === "PATCH") {
    try { json(res, 200, bank.setFolders(match[1], (await readBody(req)).folderIds)); }
    catch (error) { json(res, 400, { error: error.message }); }
    return true;
  }
  if (match && req.method === "DELETE") {
    try { bank.removeOutlier(match[1]); json(res, 200, { ok: true }); }
    catch (error) { json(res, 404, { error: error.message }); }
    return true;
  }

  json(res, 404, { error: "Route Outlier Bank introuvable" });
  return true;
}

module.exports = { handle };
