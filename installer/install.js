#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function fail(message) { console.error(`Installation refusée : ${message}`); process.exit(1); }
function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }
function replaceOnce(source, anchor, insertion, label) {
  if (!source.includes(anchor)) fail(`point d’insertion introuvable : ${label}`);
  if (source.includes(insertion.trim())) return source;
  return source.replace(anchor, `${anchor}${insertion}`);
}
function copy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: false, errorOnExist: true });
}

const approval = arg("--approve");
const planFile = arg("--plan");
if (approval !== "USER_APPROVED") fail("accord explicite manquant. Après accord de l’utilisateur, utiliser --approve USER_APPROVED.");
if (!planFile) fail("rapport préalable manquant (--plan rapport.json).");

const plan = JSON.parse(fs.readFileSync(path.resolve(planFile), "utf8"));
if (plan.schemaVersion !== 1 || !plan.compatible) fail("le rapport préalable n’est pas compatible.");
if (Date.now() - new Date(plan.generatedAt).getTime() > 24 * 3600 * 1000) fail("le rapport préalable a plus de 24 heures ; refaire l’audit.");
if (!fs.existsSync(path.join(plan.appDir, "server.js"))) fail("la cible du rapport n’existe plus.");

const distribution = path.resolve(__dirname, "..");
const appDir = path.resolve(plan.appDir);
const repoRoot = path.resolve(plan.repoRoot);
const serverFile = path.join(appDir, "server.js");
const indexFile = path.join(appDir, "public", "index.html");
const gitignoreFile = path.join(repoRoot, ".gitignore");
const conflicts = [
  path.join(appDir, "lib", "outlier-bank"),
  path.join(appDir, "public", "js", "pages", "outliers.js"),
  path.join(appDir, "public", "css", "outlier-bank.css"),
].filter(fs.existsSync);
if (conflicts.length) fail(`fichiers déjà présents : ${conflicts.join(", ")}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(repoRoot, ".outlier-bank-backups", stamp);
fs.mkdirSync(backup, { recursive: true });
for (const file of [serverFile, indexFile, ...(fs.existsSync(gitignoreFile) ? [gitignoreFile] : [])]) {
  const relative = path.relative(repoRoot, file);
  const destination = path.join(backup, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}

copy(path.join(distribution, "package", "agent-os", "lib", "outlier-bank"), path.join(appDir, "lib", "outlier-bank"));
copy(path.join(distribution, "package", "agent-os", "public", "js", "pages", "outliers.js"), path.join(appDir, "public", "js", "pages", "outliers.js"));
copy(path.join(distribution, "package", "agent-os", "public", "css", "outlier-bank.css"), path.join(appDir, "public", "css", "outlier-bank.css"));

let server = fs.readFileSync(serverFile, "utf8");
const pathImport = server.includes('const path = require("path");') ? 'const path = require("path");' : "const path = require('path');";
server = replaceOnce(server, pathImport, '\nconst outlierBankRoutes = require("./lib/outlier-bank/routes");', "import serveur");
server = replaceOnce(server, "  const p = url.pathname;", '\n  try {\n    if (await outlierBankRoutes.handle({ req, res, url, path: p, readBody, json, telegram: typeof telegram !== "undefined" ? telegram : null })) return;\n  } catch (error) {\n    return json(res, 500, { error: error.message });\n  }', "routeur HTTP");
fs.writeFileSync(serverFile, server, "utf8");

let index = fs.readFileSync(indexFile, "utf8");
index = replaceOnce(index, /<link rel="stylesheet" href="app\.css[^"]*" \/>/.exec(index)?.[0] || "", '\n  <link rel="stylesheet" href="css/outlier-bank.css" />', "feuille de styles");
const navAnchor = index.includes('data-page="niche"')
  ? index.split("\n").find((line) => line.includes('data-page="niche"'))
  : index.split("\n").find((line) => line.includes('data-page="scrap"'));
index = replaceOnce(index, navAnchor, '\n        <a href="#/outliers" data-page="outliers"><i>◈</i>Outlier Bank</a>', "navigation");
const scriptAnchor = index.includes("js/pages/niche.js")
  ? index.split("\n").find((line) => line.includes("js/pages/niche.js"))
  : index.split("\n").find((line) => line.includes("js/core.js"));
index = replaceOnce(index, scriptAnchor, '\n  <script src="js/pages/outliers.js"></script>', "script Outlier Bank");

if (plan.checks.nicheFinder.compatible) {
  copy(path.join(distribution, "integrations", "niche-finder", "niche-outlier.js"), path.join(appDir, "public", "js", "integrations", "niche-outlier.js"));
  index = replaceOnce(index, '  <script src="js/pages/outliers.js"></script>', '\n  <script src="js/integrations/niche-outlier.js"></script>', "intégration Niche Finder");
}
fs.writeFileSync(indexFile, index, "utf8");

const mediaDir = path.join(repoRoot, "medias", "Outliers");
fs.mkdirSync(mediaDir, { recursive: true });
const keep = path.join(mediaDir, ".gitkeep");
if (!fs.existsSync(keep)) fs.writeFileSync(keep, "", "utf8");

const appRelative = path.relative(repoRoot, appDir).replace(/\\/g, "/");
const dataRule = appRelative && appRelative !== "." ? `/${appRelative}/data/outliers/` : "/data/outliers/";
const ignoreBlock = `\n# Outlier Bank — données privées locales\n${dataRule}\n/medias/Outliers/*\n!/medias/Outliers/.gitkeep\n`;
let ignore = fs.existsSync(gitignoreFile) ? fs.readFileSync(gitignoreFile, "utf8") : "";
if (!ignore.includes("# Outlier Bank — données privées locales")) fs.writeFileSync(gitignoreFile, ignore.replace(/\s*$/, "") + ignoreBlock, "utf8");

console.log(JSON.stringify({ installed: true, appDir, backup, nicheFinderIntegrated: !!plan.checks.nicheFinder.compatible, next: "Exécuter node installer/verify.js <racine-agentic-os>, puis démarrer Agentic OS et tester /api/outliers/health." }, null, 2));
