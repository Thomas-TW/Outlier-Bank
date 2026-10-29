/** Outlier Bank — bibliothèque locale de vidéos YouTube enregistrées. */
AgentOS.register("outliers", {
  title: "Outlier Bank",
  async render(el, params) {
    const { api, esc, fmt, dateFr, toast } = AgentOS;
    let library = null;
    let backTopCleanup = null;

    const cover = (urls) => `<div class="ob-cover">${(urls || []).map((url, index) =>
      `<img class="ob-cover-${index}" src="${esc(url)}" loading="lazy">`).join("") || `<span class="ob-cover-empty">▦</span>`}</div>`;
    const folderName = (id) => library?.folders.find((folder) => folder.id === id)?.name || "";
    const scoreClass = (score) => {
      if (score == null) return "";
      if (score > 100) return "outlier-score--legendary";
      if (score >= 30) return "outlier-score--excellent";
      if (score >= 10) return "outlier-score--strong";
      if (score >= 3) return "outlier-score--good";
      return "outlier-score--modest";
    };
    const formatScore = (score) => {
      if (score == null) return "—";
      if (score > 100) return ">100x";
      return `${Number(score).toFixed(score >= 10 ? 1 : 2).replace(".", ",")}x`;
    };

    function modal(html) {
      const overlay = document.createElement("div");
      overlay.className = "picker-overlay";
      overlay.innerHTML = `<div class="scrap-modal ob-modal">${html}</div>`;
      document.body.appendChild(overlay);
      overlay.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => overlay.remove()));
      return overlay;
    }

    function folderPicker(selected = []) {
      return library.folders.length
        ? `<div class="ob-folder-picker">${library.folders.map((folder) => `<label><input type="checkbox" value="${esc(folder.id)}" ${selected.includes(folder.id) ? "checked" : ""}> ${esc(folder.name)}</label>`).join("")}</div>`
        : `<div class="small muted">Aucun folder : la vidéo sera rangée dans Inbox.</div>`;
    }

    function openFolderModal(folder = null) {
      const overlay = modal(`
        <div class="row between mb"><h2 style="margin:0">${folder ? "Renommer le folder" : "Nouveau folder"}</h2><button class="icon-btn" data-close>×</button></div>
        <label class="field"><span>Nom</span><input id="ob-folder-name" maxlength="80" value="${esc(folder?.name || "")}" autofocus></label>
        <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-accent" id="ob-folder-save">Enregistrer</button></div>`);
      const input = overlay.querySelector("#ob-folder-name");
      input.focus();
      overlay.querySelector("#ob-folder-save").addEventListener("click", async () => {
        const button = overlay.querySelector("#ob-folder-save");
        button.disabled = true;
        try {
          if (folder) await api(`/api/outliers/folders/${folder.id}`, { method: "PATCH", body: { name: input.value } });
          else await api("/api/outliers/folders", { method: "POST", body: { name: input.value } });
          overlay.remove();
          toast(folder ? "Folder renommé" : "Folder créé", "ok");
          if (el.querySelector("#ob-videos")) {
            const folderId = new URLSearchParams(location.hash.split("?")[1] || "").get("folder");
            const folder = folderId === "inbox" ? library.inbox : library.folders.find((entry) => entry.id === folderId);
            await renderVideos(folderId ? folder : null);
          } else {
            await renderHome();
          }
        } catch (error) { button.disabled = false; toast(error.message, "err"); }
      });
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") overlay.querySelector("#ob-folder-save").click(); });
    }

    function openAddModal() {
      const overlay = modal(`
        <div class="row between mb"><div><h2 style="margin:0">Ajouter une vidéo</h2><div class="small muted">Vidéos longues uniquement · le score est calculé avec l'historique public de la chaîne.</div></div><button class="icon-btn" data-close>×</button></div>
        <label class="field"><span>URL YouTube</span><input id="ob-url" placeholder="https://www.youtube.com/watch?v=…" autofocus></label>
        <div class="field"><span>Folders <em class="muted" style="font-style:normal">(facultatif)</em></span>${folderPicker()}</div>
        <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-accent" id="ob-add-save">Ajouter</button></div>`);
      const input = overlay.querySelector("#ob-url");
      overlay.querySelector("#ob-add-save").addEventListener("click", async () => {
        const button = overlay.querySelector("#ob-add-save");
        button.disabled = true;
        button.innerHTML = '<span class="spin"></span> Récupération et calcul…';
        const folderIds = [...overlay.querySelectorAll("input[type=checkbox]:checked")].map((box) => box.value);
        try {
          const result = await api("/api/outliers", { method: "POST", body: { url: input.value, folderIds } });
          overlay.remove();
          toast(result.duplicate
            ? (result.foldersUpdated ? "Vidéo existante : folders mis à jour" : "Cette vidéo est déjà dans Outlier Bank")
            : "Vidéo ajoutée à Outlier Bank", "ok");
          if (el.querySelector("#ob-videos")) {
            const folderId = new URLSearchParams(location.hash.split("?")[1] || "").get("folder");
            const currentFolder = folderId === "inbox" ? library.inbox : library.folders.find((entry) => entry.id === folderId);
            await renderVideos(folderId ? currentFolder : null);
          } else {
            await renderHome();
          }
        } catch (error) {
          button.disabled = false;
          button.textContent = "Ajouter";
          toast(error.message, "err");
        }
      });
    }

    function openFolderMenu(folder) {
      const overlay = modal(`
        <div class="row between mb"><h2 style="margin:0">${esc(folder.name)}</h2><button class="icon-btn" data-close>×</button></div>
        <div class="ob-menu-actions"><button class="btn btn-ghost" data-rename>Renommer</button><button class="btn btn-danger" data-delete>Supprimer le folder</button></div>
        <p class="small muted" style="margin:16px 0 0">Les vidéos ne seront pas supprimées. Celles sans autre folder retourneront dans Inbox.</p>`);
      overlay.querySelector("[data-rename]").addEventListener("click", () => { overlay.remove(); openFolderModal(folder); });
      overlay.querySelector("[data-delete]").addEventListener("click", async () => {
        if (!confirm(`Supprimer le folder « ${folder.name} » ? Les vidéos seront conservées.`)) return;
        try {
          await api(`/api/outliers/folders/${folder.id}`, { method: "DELETE" });
          overlay.remove(); toast("Folder supprimé", "ok"); renderHome();
        } catch (error) { toast(error.message, "err"); }
      });
    }

    async function openVideo(item) {
      library = await api("/api/outliers");
      const overlay = modal(`
        <div class="row between mb" style="align-items:flex-start"><div style="min-width:0"><button class="ob-detail-title" data-copy-detail-title title="Copier le titre">${esc(item.title)}</button><a class="small muted" href="${esc(item.channelUrl)}" target="_blank" rel="noopener">${esc(item.channelTitle)}</a></div><button class="icon-btn" data-close>×</button></div>
        <div class="ob-detail"><img src="${esc(item.thumbnailUrl || "")}" alt="" onerror="this.style.display='none'"><div class="ob-detail-score"><b>${item.outlierScore == null ? "—" : `${item.outlierScore}×`}</b><span>Outlier score</span><small>Référence : ${item.avgPreviousViews ? `${fmt(item.avgPreviousViews)} vues` : "indisponible"}</small><a class="ob-detail-video-link" href="${esc(item.videoUrl)}" target="_blank" rel="noopener">Ouvrir la vidéo ↗</a></div></div>
        <div class="ob-detail-stats"><span><b>${fmt(item.viewCount)}</b> vues</span><span><b>${fmt(item.subscriberCount)}</b> abonnés</span><span><b>${dateFr(item.publishedAt)}</b> publication</span></div>
        <div class="field"><div class="ob-folders-heading"><span>Folders</span><div class="ob-detail-menu-wrap"><button class="icon-btn" data-detail-menu title="Actions">⋯</button><div class="ob-detail-menu"><button class="btn btn-danger" data-delete>Supprimer</button></div></div></div>${folderPicker(item.folderIds || [])}</div>
        `);
      overlay.querySelector("[data-detail-menu]").addEventListener("click", (event) => {
        event.stopPropagation();
        overlay.querySelector(".ob-detail-menu-wrap").classList.toggle("open");
      });
      let folderSaveChain = Promise.resolve();
      overlay.querySelectorAll(".ob-folder-picker input[type=checkbox]").forEach((checkbox) => checkbox.addEventListener("change", () => {
        const folderIds = [...overlay.querySelectorAll(".ob-folder-picker input[type=checkbox]:checked")].map((box) => box.value);
        folderSaveChain = folderSaveChain.then(async () => {
          try {
            await api(`/api/outliers/${item.videoId}`, { method: "PATCH", body: { folderIds } });
            toast("Folders mis à jour", "ok");
          } catch (error) { toast(error.message, "err"); }
        });
      }));
      overlay.querySelector("[data-copy-detail-title]").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(item.title);
          toast("Titre copié", "ok");
        } catch (error) { toast("Impossible de copier le titre", "err"); }
      });
      overlay.querySelector("[data-delete]").addEventListener("click", async () => {
        try {
          await api(`/api/outliers/${item.videoId}`, { method: "DELETE" });
          overlay.remove();
          toast("Vidéo supprimée", "ok");
          const folderId = new URLSearchParams(location.hash.split("?")[1] || "").get("folder");
          const folder = folderId === "inbox" ? library.inbox : library.folders.find((entry) => entry.id === folderId);
          await renderVideos(folderId ? folder : null);
        }
        catch (error) { toast(error.message, "err"); }
      });
    }

    function videoCard(item) {
      const folders = (item.folderIds || []).map(folderName).filter(Boolean);
      return `<article class="ob-video" data-video="${esc(item.videoId)}">
        <span class="ob-video-thumb"><a class="ob-video-thumb-link" href="${esc(item.videoUrl)}" target="_blank" rel="noopener" aria-label="Ouvrir la vidéo sur YouTube">${item.thumbnailUrl ? `<img src="${esc(item.thumbnailUrl)}" loading="lazy">` : ""}</a><button class="icon-btn ob-video-menu" data-video-details="${esc(item.videoId)}" title="Détails">⋯</button><button class="ob-video-delete" data-video-delete="${esc(item.videoId)}" title="Supprimer">▣</button></span>
        <button class="ob-video-title ob-video-title-copy" data-copy-title="${esc(item.videoId)}" title="Copier le titre">${esc(item.title)}</button>
        <span class="ob-video-channel"><a href="${esc(item.channelUrl)}" target="_blank" rel="noopener">${esc(item.channelTitle)}</a> · ${fmt(item.subscriberCount)} abonnés</span>
        <span class="ob-video-meta"><b class="ob-video-score ${scoreClass(item.outlierScore)}">${formatScore(item.outlierScore)}</b><span>${fmt(item.viewCount)} vues · ${dateFr(item.publishedAt)}</span></span>
        ${folders.length ? `<span class="ob-video-folders">${folders.slice(0, 2).map((name) => `<i>${esc(name)}</i>`).join("")}${folders.length > 2 ? `<i>+${folders.length - 2}</i>` : ""}</span>` : ""}
      </article>`;
    }

    function bindVideoInteractions(items) {
      el.querySelectorAll("[data-video-details]").forEach((button) => button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openVideo(items.find((item) => item.videoId === button.dataset.videoDetails));
      }));
      el.querySelectorAll("[data-copy-title]").forEach((button) => button.addEventListener("click", async () => {
        const item = items.find((entry) => entry.videoId === button.dataset.copyTitle);
        if (!item) return;
        try {
          await navigator.clipboard.writeText(item.title);
          toast("Titre copié", "ok");
        } catch (error) { toast("Impossible de copier le titre", "err"); }
      }));
      el.querySelectorAll("[data-video-delete]").forEach((button) => button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const item = items.find((entry) => entry.videoId === button.dataset.videoDelete);
        if (!item || !confirm(`Supprimer « ${item.title} » d’Outlier Bank ?`)) return;
        try {
          await api(`/api/outliers/${item.videoId}`, { method: "DELETE" });
          toast("Vidéo supprimée", "ok");
          const folderId = new URLSearchParams(location.hash.split("?")[1] || "").get("folder");
          const folder = folderId === "inbox" ? library.inbox : library.folders.find((entry) => entry.id === folderId);
          await renderVideos(folderId ? folder : null);
        } catch (error) { toast(error.message, "err"); }
      }));
    }

    async function renderVideos(folder = null) {
      if (backTopCleanup) { backTopCleanup(); backTopCleanup = null; }
      const id = folder?.id || null;
      const route = new URLSearchParams(location.hash.split("?")[1] || "");
      const sortStorageKey = `agentic-outliers-sort:${id || "all"}`;
      let storedSort = null;
      try { storedSort = JSON.parse(localStorage.getItem(sortStorageKey) || "null"); } catch {}
      let selectedSort = ["outlier", "views", "published", "added"].includes(route.get("sort")) ? route.get("sort") : (id === "inbox" ? "added" : (storedSort?.sort || "outlier"));
      let sortDirection = route.get("dir") === "asc" || route.get("dir") === "desc" ? route.get("dir") : (id === "inbox" ? "desc" : (storedSort?.direction || "desc"));
      const updateRoute = () => {
        const params = new URLSearchParams();
        if (id) params.set("folder", id);
        else params.set("view", "all");
        if (selectedSort !== "outlier") params.set("sort", selectedSort);
        params.set("dir", sortDirection);
        history.replaceState(null, "", `#/outliers${params.toString() ? `?${params}` : ""}`);
        localStorage.setItem(sortStorageKey, JSON.stringify({ sort: selectedSort, direction: sortDirection }));
      };
      updateRoute();
      const data = await api(`/api/outliers?${new URLSearchParams({ ...(id ? { folder: id } : {}), sort: selectedSort })}`);
      library = data;
      let displayedItems = data.items.slice();
      const title = id === "inbox" ? "Inbox" : folder ? folder.name : "Toutes les vidéos";
      el.innerHTML = `<div class="ob-page">
        <div class="ob-head"><div><button class="back-btn" data-back title="Retour">←</button><h2>${esc(title)}</h2><span class="small muted">${data.items.length} vidéo(s)</span></div><div class="row"><button class="btn btn-ghost" data-all>Toutes les vidéos</button><button class="btn btn-ghost" data-new-folder>+ Folder</button><button class="btn btn-accent" data-add>+ Ajouter une vidéo</button></div></div>
        <div class="fbar mb"><input id="ob-search" type="search" placeholder="Rechercher un titre ou une chaîne…"><span class="fbar-item"><span>Trier</span><span class="mini-seg" id="ob-sort"><button class="active" data-sort="outlier">Outlier</button><button data-sort="views">Vues</button><button data-sort="published">Publication</button><button data-sort="added">Ajout</button></span><button class="ob-sort-direction" id="ob-sort-direction" title="Ordre décroissant">↓</button></span><span class="ob-update-actions"><span class="small muted">${data.lastUpdatedAt ? `Dernière mise à jour : ${dateFr(data.lastUpdatedAt)}` : "Données jamais actualisées"}</span><button class="btn btn-ghost btn-sm" id="ob-update">⟳ Mettre à jour les données</button></span></div>
        <div id="ob-videos">${data.items.length ? `<div class="ob-video-grid">${data.items.map(videoCard).join("")}</div>` : `<div class="empty"><b>${id === "inbox" ? "Inbox est vide" : "Aucune vidéo"}</b>${id ? "Ajoute une vidéo ou classe-en une ici." : "Ajoute ta première vidéo YouTube à Outlier Bank."}</div>`}</div>
      </div>`;
      const backTop = document.createElement("button");
      backTop.className = "ob-back-top";
      backTop.type = "button";
      backTop.title = "Revenir en haut";
      backTop.setAttribute("aria-label", "Revenir en haut");
      backTop.textContent = "↑";
      el.appendChild(backTop);
      const scrollTarget = el.closest(".view") || document.scrollingElement;
      const updateBackTop = () => backTop.classList.toggle("is-visible", scrollTarget.scrollTop > 420);
      backTop.addEventListener("click", () => scrollTarget.scrollTo({ top: 0, behavior: "smooth" }));
      scrollTarget.addEventListener("scroll", updateBackTop, { passive: true });
      updateBackTop();
      backTopCleanup = () => scrollTarget.removeEventListener("scroll", updateBackTop);
      el.querySelectorAll("[data-sort]").forEach((button) => button.classList.toggle("active", button.dataset.sort === selectedSort));
      const directionButton = el.querySelector("#ob-sort-direction");
      directionButton.textContent = sortDirection === "desc" ? "↓" : "↑";
      directionButton.title = sortDirection === "desc" ? "Ordre décroissant" : "Ordre croissant";
      const exportButton = document.createElement("button");
      exportButton.className = "btn btn-ghost btn-sm";
      exportButton.textContent = "Exporter les titres";
      exportButton.addEventListener("click", () => {
        const blob = new Blob([displayedItems.map((item) => item.title || "").join("\r\n")], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${id ? (folder?.name || id) : "toutes-les-videos"}-titres.txt`.replace(/[\\/:*?"<>|]+/g, "-");
        link.click();
        URL.revokeObjectURL(url);
        toast(`${displayedItems.length} titre(s) exporté(s)`, "ok");
      });
      el.querySelector(".ob-update-actions").prepend(exportButton);
      el.querySelector("[data-back]").addEventListener("click", renderHome);
      el.querySelector("[data-all]").addEventListener("click", () => renderVideos());
      el.querySelector("[data-add]").addEventListener("click", openAddModal);
      el.querySelector("[data-new-folder]").addEventListener("click", () => openFolderModal());
      el.querySelector("#ob-update").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.innerHTML = '<span class="spin"></span> Mise à jour…';
        try {
          const result = await api("/api/outliers/update", { method: "POST" });
          toast(result.failed ? `${result.updated} vidéo(s) mise(s) à jour, ${result.failed} échec(s)` : `${result.updated} vidéo(s) mise(s) à jour`, result.failed ? "err" : "ok");
          await renderVideos(folder);
        } catch (error) {
          button.disabled = false;
          button.textContent = "⟳ Mettre à jour les données";
          toast(error.message, "err");
        }
      });
      const draw = () => {
        const q = el.querySelector("#ob-search").value.toLocaleLowerCase("fr").trim();
        const sort = el.querySelector("#ob-sort .active").dataset.sort;
        const direction = sortDirection === "desc" ? -1 : 1;
        const items = data.items.filter((item) => !q || `${item.title} ${item.channelTitle}`.toLocaleLowerCase("fr").includes(q)).sort((a, b) => {
          if (sort === "views") return direction * (b.viewCount - a.viewCount);
          if (sort === "published") return direction * String(a.publishedAt || "").localeCompare(String(b.publishedAt || ""));
          if (sort === "added") return direction * String(a.savedAt || "").localeCompare(String(b.savedAt || ""));
          return direction * ((b.outlierScore || -1) - (a.outlierScore || -1));
        });
        displayedItems = items;
        el.querySelector("#ob-videos").innerHTML = items.length ? `<div class="ob-video-grid">${items.map(videoCard).join("")}</div>` : `<div class="empty"><b>Aucun résultat</b>Essaie une autre recherche.</div>`;
        bindVideoInteractions(items);
      };
      el.querySelector("#ob-search").addEventListener("input", draw);
      el.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => { selectedSort = button.dataset.sort; el.querySelectorAll("[data-sort]").forEach((entry) => entry.classList.toggle("active", entry === button)); updateRoute(); draw(); }));
      el.querySelector("#ob-sort-direction").addEventListener("click", (event) => {
        sortDirection = sortDirection === "desc" ? "asc" : "desc";
        event.currentTarget.textContent = sortDirection === "desc" ? "↓" : "↑";
        event.currentTarget.title = sortDirection === "desc" ? "Ordre décroissant" : "Ordre croissant";
        updateRoute();
        draw();
      });
      draw();
    }

    async function renderHome() {
      history.replaceState(null, "", "#/outliers");
      const data = await api("/api/outliers");
      library = data;
      const cards = [data.inbox, ...data.folders];
      el.innerHTML = `<div class="ob-page">
        <div class="ob-head"><div><h2>Outlier Bank</h2><span class="small muted">${data.total} vidéo(s) enregistrée(s)</span></div><div class="row"><button class="btn btn-ghost" data-all>Toutes les vidéos</button><button class="btn btn-ghost" data-new-folder>+ Folder</button><button class="btn btn-accent" data-add>+ Ajouter une vidéo</button></div></div>
        ${cards.length ? `<div class="ob-folder-grid">${cards.map((folder) => `<article class="ob-folder" data-folder="${esc(folder.id)}">${cover(folder.covers)}<div class="ob-folder-copy"><b>${esc(folder.name)}</b><span>${folder.count} vidéo(s)</span></div>${folder.system ? "" : `<button class="icon-btn ob-folder-menu" data-menu="${esc(folder.id)}" title="Actions">⋯</button>`}</article>`).join("")}</div>` : ""}
      </div>`;
      el.querySelector("[data-add]").addEventListener("click", openAddModal);
      el.querySelector("[data-new-folder]").addEventListener("click", () => openFolderModal());
      el.querySelector("[data-all]").addEventListener("click", () => renderVideos());
      el.querySelectorAll("[data-folder]").forEach((card) => card.addEventListener("click", () => {
        const id = card.dataset.folder;
        renderVideos(id === "inbox" ? data.inbox : data.folders.find((folder) => folder.id === id));
      }));
      el.querySelectorAll("[data-menu]").forEach((button) => button.addEventListener("click", (event) => {
        event.stopPropagation(); openFolderMenu(data.folders.find((folder) => folder.id === button.dataset.menu));
      }));
    }

    const requestedFolder = params?.get("folder");
    const requestedView = params?.get("view");
    if (requestedFolder) {
      const data = await api("/api/outliers");
      const folder = requestedFolder === "inbox" ? data.inbox : data.folders.find((entry) => entry.id === requestedFolder);
      if (folder) await renderVideos(folder);
      else await renderHome();
    } else if (requestedView === "all") {
      await renderVideos();
    } else {
      await renderHome();
    }
  },
});
