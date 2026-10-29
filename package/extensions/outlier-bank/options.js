"use strict";

const input = document.querySelector("#origin");
const status = document.querySelector("#status");

function show(message, ok) {
  status.textContent = message;
  status.className = ok ? "ok" : "err";
}

function normalize(value) {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Utilise une adresse locale 127.0.0.1 ou localhost.");
  }
  return url.origin;
}

chrome.storage.local.get("outlierBankSettings").then(({ outlierBankSettings }) => {
  if (outlierBankSettings?.origin) input.value = outlierBankSettings.origin;
});

document.querySelector("#save").addEventListener("click", async () => {
  try {
    const origin = normalize(input.value);
    await chrome.storage.local.set({ outlierBankSettings: { origin } });
    input.value = origin;
    const result = await chrome.runtime.sendMessage({ type: "health" });
    if (!result?.ok) throw new Error(result?.error || "Outlier Bank inaccessible");
    const youtube = result.result.youtube;
    show(youtube?.configured === false ? `Connexion réussie. Attention : ${youtube.message}` : "Connexion réussie à Outlier Bank.", youtube?.configured !== false);
  } catch (error) { show(error.message, false); }
});

document.querySelector("#sync").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "sync" });
  show(`${result.synced} synchronisée(s), ${result.pending} en attente.`, result.pending === 0);
});
