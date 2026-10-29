/** Intégration facultative : ajoute Save outlier aux cartes vidéo compatibles du Niche Finder. */
(function () {
  "use strict";
  if (!window.AgentOS?.api || !window.AgentOS?.toast) return;

  function enhance(root = document) {
    root.querySelectorAll?.(".niche-card .add-drop").forEach((menu) => {
      if (menu.querySelector('[data-ob-save-outlier]') || menu.querySelector('[data-addtype="outlier"]')) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.obSaveOutlier = "";
      button.textContent = "🔖 Save outlier";
      menu.appendChild(button);
    });
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-ob-save-outlier]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const card = button.closest(".niche-card");
    const link = card?.querySelector('a[href*="youtube.com/watch"],a[href*="youtu.be/"]');
    if (!link) return AgentOS.toast("Vidéo YouTube introuvable dans ce résultat", "err");
    button.disabled = true;
    try {
      const result = await AgentOS.api("/api/outliers", { method: "POST", body: { url: link.href, folderIds: [] } });
      AgentOS.toast(result.duplicate ? "Déjà dans Outlier Bank" : "Outlier sauvegardé dans Inbox ✓", "ok");
    } catch (error) { AgentOS.toast(error.message, "err"); }
    finally { button.disabled = false; }
  }, true);

  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === 1) enhance(node.matches?.(".niche-card") ? node.parentElement : node);
  }))).observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
