const ITEM = "agentic-outlier-menu-item";
const VIDEO_CARD = "ytd-rich-item-renderer, ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, yt-lockup-view-model, yt-lockup-view-model-wiz";
let pendingEntry = null;
let pendingMenuKind = null;
let resizedMenuNodes = [];

function entryFromCard(card) {
  const link = card?.querySelector('a#video-title-link[href*="/watch"], a#video-title[href*="/watch"], a[href*="/watch?v="]');
  if (!link || /shorts\//.test(link.href)) return null;
  const url = new URL(link.href, location.origin);
  const videoId = url.searchParams.get("v");
  return videoId?.length === 11 ? { videoId, url: `https://www.youtube.com/watch?v=${videoId}` } : null;
}

function entryFromCurrentVideo() {
  const videoId = new URL(location.href).searchParams.get("v");
  return videoId?.length === 11 ? { videoId, url: `https://www.youtube.com/watch?v=${videoId}` } : null;
}

function fitMenuToItem(item) {
  requestAnimationFrame(() => {
    let node = item.parentElement;
    while (node && node !== document.body) {
      if (node.scrollHeight > node.clientHeight) {
        node.style.setProperty("height", `${node.scrollHeight}px`, "important");
        node.style.setProperty("max-height", "none", "important");
        node.style.setProperty("overflow", "visible", "important");
        resizedMenuNodes.push(node);
      }
      if (node.matches("ytd-popup-container")) break;
      node = node.parentElement;
    }
  });
}

function restoreMenuSize() {
  resizedMenuNodes.forEach((node) => {
    node.style.removeProperty("height");
    node.style.removeProperty("max-height");
    node.style.removeProperty("overflow");
  });
  resizedMenuNodes = [];
}

function injectMenuItem() {
  if (!pendingEntry) return;
  const visibleMenus = [...document.querySelectorAll("ytd-menu-popup-renderer, tp-yt-paper-listbox, [role='menu']")].filter((menu) => {
    const rect = menu.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !menu.closest("#movie_player");
  });
  const menu = visibleMenus.find((candidate) => !visibleMenus.some((other) => other !== candidate && candidate.contains(other))) || visibleMenus.at(-1);
  if (!menu) return;
  const list = menu.querySelector("#items, tp-yt-paper-listbox, [role='menu']") || menu;
  const previous = list.querySelector(`.${ITEM}`);
  if (previous?.dataset.videoId === pendingEntry.videoId) return;
  previous?.remove();
  const item = document.createElement("tp-yt-paper-item");
  const entry = pendingEntry;
  const menuKind = pendingMenuKind;
  item.className = ITEM;
  item.dataset.videoId = entry.videoId;
  item.setAttribute("role", "menuitem");
  item.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg><span>Save outlier</span>';
  item.addEventListener("click", async (event) => {
    event.preventDefault(); event.stopPropagation();
    item.dataset.state = "syncing"; item.querySelector("span").textContent = "Saving…";
    let result;
    try { result = await chrome.runtime.sendMessage({ type: "save", entry: { ...entry, queuedAt: new Date().toISOString() } }); }
    catch (error) { result = { state: "error", error: error.message || "Extension indisponible" }; }
    item.dataset.state = result.state;
    item.querySelector("span").textContent = result.state === "saved" ? (result.duplicate ? "Already saved" : "Saved") : result.state === "pending" ? "Saved locally" : "Error";
  });
  list.prepend(item);
  if (menuKind === "current") fitMenuToItem(item);
}

document.addEventListener("pointerdown", (event) => {
  const path = event.composedPath();
  if (path.some((node) => node?.classList?.contains?.(ITEM))) return;
  restoreMenuSize();
  pendingEntry = null;
  pendingMenuKind = null;
  document.querySelectorAll(`.${ITEM}`).forEach((item) => item.remove());
  const card = path.find((node) => node?.matches?.(VIDEO_CARD));
  const isVideoMenuButton = path.some((node) => node?.matches?.('ytd-menu-renderer, #menu, yt-icon-button, tp-yt-paper-icon-button, button[aria-label*="action" i]'));
  const isCurrentVideoMenu = path.some((node) => node?.matches?.("ytd-watch-metadata, ytd-video-primary-info-renderer"));
  if (card && isVideoMenuButton) {
    pendingEntry = entryFromCard(card);
    pendingMenuKind = "card";
  } else if (isCurrentVideoMenu && isVideoMenuButton) {
    pendingEntry = entryFromCurrentVideo();
    pendingMenuKind = "current";
  }
}, true);

document.addEventListener("click", (event) => {
  if (!pendingEntry) return;
  [80, 250, 500, 900].forEach((delay) => setTimeout(injectMenuItem, delay));
}, true);

new MutationObserver(() => { if (pendingEntry) injectMenuItem(); })
  .observe(document.documentElement, { childList: true, subtree: true });
