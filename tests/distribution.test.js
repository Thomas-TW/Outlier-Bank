"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("la distribution ne contient aucune donnée personnelle ni Title Generator", () => {
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full); else files.push(path.relative(root, full).replace(/\\/g, "/"));
  });
  walk(root);
  assert.equal(files.some((file) => /title-analyses|library\.json$/i.test(file) && !file.endsWith("library.empty.json")), false);
  assert.equal(files.some((file) => /title-generator/i.test(file)), false);
  assert.equal(files.some((file) => /medias\/Outliers\/.+\.(jpe?g|png|webp)$/i.test(file)), false);
});

test("Inbox est fournie comme folder système pour une bibliothèque vide", () => {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "ob-unit-"));
  const lib = path.join(host, "agent-os", "lib");
  fs.mkdirSync(lib, { recursive: true });
  fs.cpSync(path.join(root, "package", "agent-os", "lib", "outlier-bank"), path.join(lib, "outlier-bank"), { recursive: true });
  fs.writeFileSync(path.join(lib, "store.js"), `
    const fs=require("fs"),path=require("path");
    const DATA_DIR=path.join(${JSON.stringify(host)},"data");
    const ensureDir=(dir)=>fs.mkdirSync(dir,{recursive:true});
    const readJSON=(name,fallback)=>fallback;
    const writeJSON=()=>{};
    module.exports={DATA_DIR,ensureDir,readJSON,writeJSON};
  `);
  process.env.AGENTIC_OS_MEDIA_ROOT = path.join(host, "medias");
  const bank = require(path.join(lib, "outlier-bank", "index.js"));
  const view = bank.overview();
  assert.deepEqual(view.inbox, { id: "inbox", name: "Inbox", count: 0, covers: [], system: true });
});

test("le client YouTube inclus utilise les clés d’environnement sans les persister", async () => {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "ob-youtube-"));
  const lib = path.join(host, "agent-os", "lib");
  fs.mkdirSync(lib, { recursive: true });
  fs.cpSync(path.join(root, "package", "agent-os", "lib", "outlier-bank"), path.join(lib, "outlier-bank"), { recursive: true });
  const data = path.join(host, "data");
  fs.writeFileSync(path.join(lib, "store.js"), `
    const fs=require("fs"),path=require("path"),base=${JSON.stringify(data)};
    const file=(name)=>path.join(base,name);
    const readJSON=(name,fallback)=>{try{return JSON.parse(fs.readFileSync(file(name),"utf8"))}catch{return fallback}};
    const writeJSON=(name,value)=>{fs.mkdirSync(path.dirname(file(name)),{recursive:true});fs.writeFileSync(file(name),JSON.stringify(value))};
    module.exports={readJSON,writeJSON};
  `);
  const previous = process.env.YOUTUBE_API_KEYS;
  const previousFetch = global.fetch;
  process.env.YOUTUBE_API_KEYS = "fixture-key-one,fixture-key-two";
  let requestedUrl = "";
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, status: 200, json: async () => ({ items: [{ id: "abcdefghijk" }] }) };
  };
  const youtube = require(path.join(lib, "outlier-bank", "youtube-tools.js"));
  assert.equal(youtube.status().bundled, true);
  assert.equal(youtube.status().keyCount, 2);
  const response = await youtube.dataApi("videos", { part: "snippet", id: "abcdefghijk" }, 1);
  assert.equal(response.items[0].id, "abcdefghijk");
  assert.match(requestedUrl, /^https:\/\/www\.googleapis\.com\/youtube\/v3\/videos\?/);
  assert.match(requestedUrl, /key=fixture-key-(one|two)/);
  const ledger = fs.readFileSync(path.join(data, "outliers", "youtube-quota.json"), "utf8");
  assert.equal(ledger.includes("fixture-key-one"), false);
  assert.equal(ledger.includes("fixture-key-two"), false);
  if (previous === undefined) delete process.env.YOUTUBE_API_KEYS;
  else process.env.YOUTUBE_API_KEYS = previous;
  global.fetch = previousFetch;
});

test("l’audit précède une installation cloisonnée sur une fixture compatible", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ob-host-"));
  const app = path.join(fixture, "agent-os");
  const write = (relative, value) => {
    const file = path.join(app, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value, "utf8");
  };
  write("server.js", [
    'const path = require("path");',
    "function json() {}",
    "async function readBody() { return {}; }",
    "async function handler(req, res) {",
    '  const url = new URL(req.url, "http://127.0.0.1:4100");',
    "  const p = url.pathname;",
    '  if (p.startsWith("/media/")) files.resolveLocal("x");',
    "}",
  ].join("\n"));
  write("public/index.html", '<link rel="stylesheet" href="app.css" />\n<a data-page="niche"></a>\n<script src="js/core.js"></script>\n<script src="js/pages/niche.js"></script>');
  write("public/app.css", ":root{}");
  write("public/js/core.js", "const AgentOS={register(){},api(){},toast(){}};");
  write("public/js/pages/niche.js", 'const html = `<div class="niche-card"><span class="add-drop"></span><a href="https://youtube.com/watch?v=abcdefghijk"></a></div>`;');
  write("lib/store.js", "module.exports={};");
  write("lib/files.js", "function resolveLocal(){} module.exports={resolveLocal};");
  write("data/vault.json", JSON.stringify({ youtube_keys: [{ label: "fixture", blob: "not-a-secret" }] }));

  const report = path.join(fixture, "report.json");
  const preflight = spawnSync(process.execPath, [path.join(root, "installer", "preflight.js"), fixture, "--output", report], { encoding: "utf8" });
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  assert.equal(JSON.parse(fs.readFileSync(report, "utf8")).compatible, true);

  const refused = spawnSync(process.execPath, [path.join(root, "installer", "install.js"), "--plan", report], { encoding: "utf8" });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /accord explicite manquant/);

  const installed = spawnSync(process.execPath, [path.join(root, "installer", "install.js"), "--plan", report, "--approve", "USER_APPROVED"], { encoding: "utf8" });
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert.equal(fs.existsSync(path.join(app, "lib", "outlier-bank", "index.js")), true);
  assert.match(fs.readFileSync(path.join(app, "server.js"), "utf8"), /outlierBankRoutes\.handle/);
  assert.match(fs.readFileSync(path.join(app, "public", "index.html"), "utf8"), /data-page="outliers"/);
  assert.equal(fs.existsSync(path.join(fixture, "medias", "Outliers", ".gitkeep")), true);
});
