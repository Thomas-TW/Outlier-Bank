"use strict";

let youtube;
try {
  youtube = require("../youtube");
} catch {
  youtube = null;
}

function configuredKeyCount() {
  try {
    const vault = require("../vault");
    return typeof vault.youtubeKeys === "function" ? vault.youtubeKeys().length : null;
  } catch {
    return null;
  }
}

function status() {
  const compatible = !!youtube && typeof youtube.dataApi === "function";
  const keyCount = configuredKeyCount();
  return {
    compatible,
    configured: keyCount === null ? null : keyCount > 0,
    keyCount,
    message: !compatible
      ? "Service YouTube compatible introuvable (fonction dataApi requise)."
      : keyCount === 0
        ? "Aucune clé YouTube détectée dans le coffre Agentic OS."
        : keyCount === null
          ? "Service YouTube détecté ; la présence des clés doit être vérifiée selon l’architecture de cet Agentic OS."
          : `${keyCount} clé(s) YouTube détectée(s).`,
  };
}

async function dataApi(...args) {
  const current = status();
  if (!current.compatible) throw new Error(current.message);
  if (current.configured === false) throw new Error(current.message);
  return youtube.dataApi(...args);
}

module.exports = { dataApi, status };
