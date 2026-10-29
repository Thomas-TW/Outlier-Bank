#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const requested = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!requested) { console.error("Usage : node installer/verify.js <racine-agentic-os>"); process.exit(1); }
const appDir = fs.existsSync(path.join(requested, "agent-os", "server.js")) ? path.join(requested, "agent-os") : requested;
const checks = {
  backend: fs.existsSync(path.join(appDir, "lib", "outlier-bank", "index.js")),
  routes: fs.existsSync(path.join(appDir, "lib", "outlier-bank", "routes.js")),
  frontend: fs.existsSync(path.join(appDir, "public", "js", "pages", "outliers.js")),
  styles: fs.existsSync(path.join(appDir, "public", "css", "outlier-bank.css")),
  serverWiring: fs.readFileSync(path.join(appDir, "server.js"), "utf8").includes("outlierBankRoutes.handle"),
  navigation: fs.readFileSync(path.join(appDir, "public", "index.html"), "utf8").includes('data-page="outliers"'),
};
console.log(JSON.stringify({ ok: Object.values(checks).every(Boolean), checks, note: "Ce contrôle statique doit être complété par les tests fonctionnels décrits dans README.md." }, null, 2));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 2;
