#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function fail(message) { console.error(message); process.exit(1); }
function exists(file) { return fs.existsSync(file); }
function text(file) { return fs.readFileSync(file, "utf8"); }
function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }

const requested = process.argv[2] && !process.argv[2].startsWith("--") ? path.resolve(process.argv[2]) : null;
if (!requested) fail("Usage : node installer/preflight.js <racine-agentic-os> [--output rapport.json]");

const appDir = exists(path.join(requested, "agent-os", "server.js")) ? path.join(requested, "agent-os") : requested;
const repoRoot = appDir === requested ? path.dirname(appDir) : requested;
const files = {
  server: path.join(appDir, "server.js"),
  index: path.join(appDir, "public", "index.html"),
  css: path.join(appDir, "public", "app.css"),
  core: path.join(appDir, "public", "js", "core.js"),
  store: path.join(appDir, "lib", "store.js"),
  vault: path.join(appDir, "data", "vault.json"),
  telegram: path.join(appDir, "lib", "telegram.js"),
  files: path.join(appDir, "lib", "files.js"),
  niche: path.join(appDir, "public", "js", "pages", "niche.js"),
};

const required = ["server", "index", "css", "core", "store", "files"];
const missing = required.filter((name) => !exists(files[name]));
const server = exists(files.server) ? text(files.server) : "";
const index = exists(files.index) ? text(files.index) : "";
const core = exists(files.core) ? text(files.core) : "";
const fileService = exists(files.files) ? text(files.files) : "";
const niche = exists(files.niche) ? text(files.niche) : "";

let keyCount = null;
try {
  const vault = JSON.parse(fs.readFileSync(files.vault, "utf8"));
  keyCount = Array.isArray(vault.youtube_keys) ? vault.youtube_keys.length : 0;
} catch {}
const environmentKeyCount = [process.env.YOUTUBE_API_KEY, process.env.YOUTUBE_API_KEYS]
  .filter(Boolean)
  .flatMap((value) => String(value).split(/[\s,;]+/))
  .filter(Boolean).length;

const existing = {
  backend: exists(path.join(appDir, "lib", "outlier-bank.js")) || exists(path.join(appDir, "lib", "outlier-bank")),
  route: server.includes("/api/outliers"),
  frontend: exists(path.join(appDir, "public", "js", "pages", "outliers.js")) || index.includes('data-page="outliers"'),
};
const hooks = {
  serverImport: server.includes('require("path")') || server.includes("require('path')"),
  serverRequest: server.includes("const p = url.pathname"),
  mediaRoute: server.includes('p.startsWith("/media/")') || server.includes("p.startsWith('/media/')"),
  mediaResolver: fileService.includes("resolveLocal"),
  frontendRegistry: core.includes("register") && core.includes("api"),
  navAnchor: index.includes('data-page="niche"') || index.includes('data-page="scrap"'),
  scriptAnchor: index.includes("js/pages/niche.js") || index.includes("js/core.js"),
  stylesheetAnchor: /<link rel="stylesheet" href="app\.css[^"]*" \/>/.test(index),
};
const nicheCompatible = exists(files.niche)
  && niche.includes("niche-card")
  && niche.includes("add-drop")
  && (niche.includes("youtube.com/watch") || niche.includes("youtu.be/"));
const blockers = [
  ...missing.map((name) => `Fichier requis absent : ${files[name]}`),
  ...Object.entries(hooks).filter(([, ok]) => !ok).map(([name]) => `Point d’intégration incompatible : ${name}`),
  ...(Object.values(existing).some(Boolean) ? ["Une implémentation Outlier Bank existe déjà : migration ou fusion manuelle requise."] : []),
];
const warnings = [];
if (keyCount === 0 && environmentKeyCount === 0) warnings.push("Aucune clé YouTube détectée dans data/vault.json ou l’environnement. L’utilisateur devra la configurer avant l’ajout de vidéos.");
if (keyCount === null && environmentKeyCount === 0) warnings.push("Présence des clés YouTube non vérifiable sans exposer de secret. À confirmer avec l’utilisateur.");
if (!exists(files.telegram) || !/require\(["']\.\/lib\/telegram["']\)/.test(server)) warnings.push("Telegram non détecté : les notifications seront désactivées, sans bloquer Outlier Bank.");
if (!exists(files.niche)) warnings.push("Niche Finder absent : son intégration sera ignorée.");
else if (!nicheCompatible) warnings.push("Niche Finder détecté mais contrat d’interface incompatible : adaptation et nouvel accord requis.");

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target: requested,
  repoRoot,
  appDir,
  compatible: blockers.length === 0,
  installationAuthorized: false,
  checks: { missing, existing, hooks, youtube: { bundledClient: true, vaultKeyCount: keyCount, environmentKeyCount }, telegram: exists(files.telegram), nicheFinder: { present: exists(files.niche), compatible: nicheCompatible } },
  blockers,
  warnings,
  plannedChanges: [
    "Créer agent-os/lib/outlier-bank/ et y installer le moteur, le client YouTube Data API autonome et les routes.",
    "Installer la page, sa feuille de styles isolée et le lien de navigation.",
    "Ajouter deux raccords minimaux dans server.js (import et délégation des routes).",
    ...(nicheCompatible ? ["Charger l’intégration facultative Niche Finder sans modifier son code source."] : []),
    "Créer medias/Outliers si nécessaire et protéger données et miniatures via .gitignore.",
    "Ne créer aucune donnée personnelle ; Inbox restera un folder système virtuel.",
  ],
  consentRequired: "L’installation ne doit commencer qu’après présentation de ce rapport et accord explicite de l’utilisateur.",
};

const output = arg("--output");
if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.compatible ? 0 : 2;
