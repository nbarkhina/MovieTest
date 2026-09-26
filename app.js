"use strict";

const DEFAULTS = {
  apiUrl: "",
  mediaUrl: "",
  password: "",
  autoplayNext: true,
};

const PAGE_SIZE = 6;
const state = {
  settings: loadSettings(),
  folder: "",
  parentFolders: [],
  entries: [],
  videos: [],
  currentVideoIndex: -1,
  page: 0,
  returnFocus: null,
  messageTimer: null,
};

const elements = {
  video: document.querySelector("#video"),
  title: document.querySelector("#video-title"),
  emptyState: document.querySelector("#empty-state"),
  message: document.querySelector("#message"),
  position: document.querySelector("#position-label"),
  progress: document.querySelector("#progress-bar"),
  libraryDialog: document.querySelector("#library-dialog"),
  settingsDialog: document.querySelector("#settings-dialog"),
  libraryGrid: document.querySelector("#library-grid"),
  folderTitle: document.querySelector("#folder-title"),
  pageLabel: document.querySelector("#page-label"),
  folderUp: document.querySelector("#folder-up-button"),
  previousPage: document.querySelector("#previous-page-button"),
  nextPage: document.querySelector("#next-page-button"),
  apiUrl: document.querySelector("#api-url"),
  mediaUrl: document.querySelector("#media-url"),
  password: document.querySelector("#api-password"),
  autoplayNext: document.querySelector("#autoplay-next"),
};

document.querySelector("[data-action='play']").addEventListener("click", playVideo);
document.querySelector("[data-action='pause']").addEventListener("click", pauseVideo);
document.querySelector("[data-action='next']").addEventListener("click", playNext);
document.querySelector("[data-action='list']").addEventListener("click", openLibrary);
document.querySelector("[data-action='settings']").addEventListener("click", openSettings);
document.querySelector("#settings-form").addEventListener("submit", saveSettings);
document.querySelector("#reset-settings").addEventListener("click", resetSettings);
elements.folderUp.addEventListener("click", goUpFolder);
elements.previousPage.addEventListener("click", () => changePage(-1));
elements.nextPage.addEventListener("click", () => changePage(1));

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeDialog(document.querySelector(`#${button.dataset.close}`)));
});

elements.video.addEventListener("timeupdate", updateProgress);
elements.video.addEventListener("durationchange", updateProgress);
elements.video.addEventListener("ended", () => {
  if (state.settings.autoplayNext) {
    playNext();
  }
});
elements.video.addEventListener("error", () => {
  showMessage("This video could not be played by the browser.");
});

document.addEventListener("keydown", handleDirectionalNavigation);
window.addEventListener("resize", fitViewport);
fitViewport();
document.querySelector("#list-button").focus();

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("rayban-video-settings") || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

function fitViewport() {
  const shell = document.querySelector(".app-shell");
  const scale = Math.min(window.innerWidth / 600, window.innerHeight / 600, 1);
  shell.style.transform = `scale(${scale})`;
}

async function openLibrary() {
  state.returnFocus = document.activeElement;
  elements.libraryDialog.showModal();
  if (!state.entries.length) {
    await loadFolder("");
  } else {
    renderLibrary();
  }
}

async function loadFolder(folder) {
  state.folder = folder;
  state.page = 0;
  elements.libraryGrid.innerHTML = '<p class="position-label">Loading library…</p>';

  const url = new URL(state.settings.apiUrl);
  url.searchParams.set("password", state.settings.password);
  url.searchParams.set("folder", folder);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Library request failed (${response.status})`);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.list)) {
      throw new Error("The library returned an unexpected response.");
    }
    state.entries = data.list.filter((entry) => entry.folder === "true" || entry.isvideo === "true");
    renderLibrary();
  } catch (error) {
    elements.libraryGrid.innerHTML = `<p class="position-label">${escapeHtml(error.message)}</p>`;
    showMessage(error.message);
  }
}

function renderLibrary() {
  const pageCount = Math.max(1, Math.ceil(state.entries.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount - 1);
  const start = state.page * PAGE_SIZE;
  const visibleEntries = state.entries.slice(start, start + PAGE_SIZE);

  elements.folderTitle.textContent = state.folder ? displayName(state.folder) : "Movies";
  elements.pageLabel.textContent = `${state.page + 1} / ${pageCount}`;
  elements.previousPage.disabled = state.page === 0;
  elements.nextPage.disabled = state.page >= pageCount - 1;
  elements.folderUp.disabled = state.parentFolders.length === 0;
  elements.libraryGrid.replaceChildren();

  if (!visibleEntries.length) {
    elements.libraryGrid.innerHTML = '<p class="position-label">No playable videos in this folder.</p>';
    elements.folderUp.focus();
    return;
  }

  visibleEntries.forEach((entry) => {
    const isFolder = entry.folder === "true";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "library-item focusable";
    button.innerHTML = `
      <span class="library-item-icon" aria-hidden="true">${isFolder ? "▣" : "▶"}</span>
      <span>
        <span class="library-item-name">${escapeHtml(displayName(entry.path))}</span>
        <span class="library-item-meta">${escapeHtml(isFolder ? "Folder" : (entry.size || "Video"))}</span>
      </span>`;
    button.addEventListener("click", () => isFolder ? enterFolder(entry.path) : selectVideo(entry));
    elements.libraryGrid.append(button);
  });

  elements.libraryGrid.querySelector(".focusable")?.focus();
}

function enterFolder(folder) {
  state.parentFolders.push(state.folder);
  loadFolder(folder);
}

function goUpFolder() {
  if (!state.parentFolders.length) return;
  loadFolder(state.parentFolders.pop());
}

function changePage(offset) {
  state.page += offset;
  renderLibrary();
}

function selectVideo(entry) {
  state.videos = state.entries.filter((item) => item.isvideo === "true");
  state.currentVideoIndex = state.videos.indexOf(entry);
  const relativePath = `${entry.folderoffset || ""}${entry.path}`;
  const mediaBase = ensureTrailingSlash(state.settings.mediaUrl);
  elements.video.src = new URL(relativePath, mediaBase).href;
  elements.title.textContent = displayName(entry.path);
  elements.emptyState.hidden = true;
  closeDialog(elements.libraryDialog);
  playVideo();
}

async function playVideo() {
  if (!elements.video.src) {
    showMessage("Choose a video from the list first.");
    return;
  }
  try {
    await elements.video.play();
  } catch (error) {
    showMessage(error.name === "NotAllowedError" ? "Select Play again to start the video." : "Unable to start playback.");
  }
}

function pauseVideo() {
  elements.video.pause();
}

function playNext() {
  if (!state.videos.length) {
    showMessage("Choose a video from the list first.");
    return;
  }
  state.currentVideoIndex = (state.currentVideoIndex + 1) % state.videos.length;
  selectVideo(state.videos[state.currentVideoIndex]);
}

function updateProgress() {
  const duration = Number.isFinite(elements.video.duration) ? elements.video.duration : 0;
  const current = Number.isFinite(elements.video.currentTime) ? elements.video.currentTime : 0;
  elements.progress.style.width = duration ? `${(current / duration) * 100}%` : "0";
  elements.position.textContent = `${formatTime(current)} / ${duration ? formatTime(duration) : "--:--"}`;
}

function openSettings() {
  state.returnFocus = document.activeElement;
  elements.apiUrl.value = state.settings.apiUrl;
  elements.mediaUrl.value = state.settings.mediaUrl;
  elements.password.value = state.settings.password;
  elements.autoplayNext.checked = state.settings.autoplayNext;
  elements.settingsDialog.showModal();
  elements.apiUrl.focus();
}

function saveSettings(event) {
  event.preventDefault();
  state.settings = {
    apiUrl: elements.apiUrl.value.trim(),
    mediaUrl: ensureTrailingSlash(elements.mediaUrl.value.trim()),
    password: elements.password.value,
    autoplayNext: elements.autoplayNext.checked,
  };
  localStorage.setItem("rayban-video-settings", JSON.stringify(state.settings));
  state.folder = "";
  state.parentFolders = [];
  state.entries = [];
  closeDialog(elements.settingsDialog);
  showMessage("Settings saved.");
}

function resetSettings() {
  elements.apiUrl.value = DEFAULTS.apiUrl;
  elements.mediaUrl.value = DEFAULTS.mediaUrl;
  elements.password.value = DEFAULTS.password;
  elements.autoplayNext.checked = DEFAULTS.autoplayNext;
}

function closeDialog(dialog) {
  dialog.close();
  state.returnFocus?.focus();
}

function handleDirectionalNavigation(event) {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    if (event.key === "Escape") {
      const dialog = document.querySelector("dialog[open]");
      if (dialog) {
        event.preventDefault();
        closeDialog(dialog);
      }
    }
    return;
  }

  const focusables = getVisibleFocusables();
  if (!focusables.length) return;
  const current = document.activeElement;
  const currentRect = current.getBoundingClientRect();
  const currentCenter = center(currentRect);
  const candidates = focusables
    .filter((element) => element !== current)
    .map((element) => {
      const targetCenter = center(element.getBoundingClientRect());
      const dx = targetCenter.x - currentCenter.x;
      const dy = targetCenter.y - currentCenter.y;
      return { element, dx, dy, distance: Math.hypot(dx, dy) };
    })
    .filter((candidate) => isInDirection(candidate, event.key))
    .sort((a, b) => directionScore(a, event.key) - directionScore(b, event.key));

  if (candidates[0]) {
    event.preventDefault();
    candidates[0].element.focus();
  }
}

function getVisibleFocusables() {
  const scope = document.querySelector("dialog[open]") || document;
  return [...scope.querySelectorAll(".focusable:not([disabled])")].filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function isInDirection(candidate, key) {
  if (key === "ArrowLeft") return candidate.dx < -4;
  if (key === "ArrowRight") return candidate.dx > 4;
  if (key === "ArrowUp") return candidate.dy < -4;
  return candidate.dy > 4;
}

function directionScore(candidate, key) {
  const primary = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(candidate.dx) : Math.abs(candidate.dy);
  const secondary = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(candidate.dy) : Math.abs(candidate.dx);
  return primary + secondary * 2 + candidate.distance * 0.1;
}

function showMessage(text) {
  clearTimeout(state.messageTimer);
  elements.message.textContent = text;
  elements.message.classList.add("visible");
  state.messageTimer = setTimeout(() => elements.message.classList.remove("visible"), 3200);
}

function displayName(path) {
  const leaf = path.split(/[\\/]/).pop() || path;
  let decoded = leaf;
  try {
    decoded = decodeURIComponent(leaf);
  } catch {
    decoded = leaf;
  }
  return decoded.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
