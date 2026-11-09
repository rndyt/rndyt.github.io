import { ArchiveEntry, ARRAY_ENTRY_END } from "./archive-entry";
import { InspectionOverlay } from "./inspection-overlay";
import { DocumentDecryption } from "./document-decryption";
import "./document-decryption.css";
import "./decryption.css";
import { escapeHtml } from "./html";
import { normalizeQuality, qualityPresets, type QualityPreset, type RenderQuality } from "./render-quality";
import { qualityMarkup, syncQualityUI } from "./quality-settings";
import "@kitlangton/rolling-number/styles.css";
import "./style.css";
import "./quality-settings.css";
import "./responsive.css";
import { viewportLayout } from "./viewport-layout";
import { assetUrl } from "./asset-url";
import { initPwa, pwaSettingsMarkup } from "./pwa";
import { createRollingNumber, createRollingText } from "@kitlangton/rolling-number";
import { ArchiveScene } from "./scene";
import { ModelViewer } from "./model-viewer";
import { ContentTransition, SurfaceTransition } from "./ui-transitions";
import { BootSequence } from "./boot";
import { wrap, type ArchiveNavigation } from "./archive-loop";
import {
  records,
  categories,
  archiveColumns,
  columnFiles,
  fileLocation,
} from "./data";
import { TerminalAudio } from "./audio";
import { audioSettingsMarkup } from "./audio-settings";
import {
  createMotionPreferences,
  fullMotion,
  motionEnabled,
  motionPresetFor,
  motionSettingsMarkup,
  motionSummary,
  reducedMotion,
  type MotionKey,
  type MotionPreset,
  type StoredMotion,
} from "./motion-preferences";
import { StartupGate } from "./startup";
import "./startup.css";
import "./blog.css";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
import { logo, brandHeading } from "./brand";

$("#stage").innerHTML = `
  <div id="three-scene" class="three-scene"></div>
  <div class="scene-atmosphere archive-atmosphere"></div>
  <div id="boot-background" class="boot-background"><svg viewBox="0 0 1920 1080" preserveAspectRatio="none"><g fill="none" stroke="#fff" stroke-width="3"><path d="M-210 705C-45 705 182 704 247 567C337 377 99 306 4 435S27 680 169 631C309 584 227 314 279 111S568-113 568-113"/><path d="M1560-80C1374 114 1671 168 1601 323S1371 367 1431 480S1692 666 1559 787S1329 886 1498 1130"/><circle cx="1450" cy="648" r="346"/><circle cx="1450" cy="648" r="348"/></g></svg></div>
  <header class="brand">${brandHeading}</header>
  <nav class="system-nav" aria-label="系统导航">
    <button data-action="search" aria-label="Archive Index / 文章检索"><span class="search-label-full">ARCHIVE INDEX</span><span class="search-label-compact">检索</span><span class="key">/</span></button>
    <button class="settings-button" data-action="settings" aria-label="系统设置" title="系统设置"><span class="settings-label">设置</span></button>
  </nav>
  <button id="skip" class="skip" data-action="skip">ENTER SYSTEM <span>↗</span></button>
  <section id="boot" class="boot" aria-label="系统启动">
    <div class="access-text">ACCESS</div>
    <div class="boot-logo">${logo}</div>
    <div class="auth-status"><span>▪</span> <span id="auth-message"></span><i></i></div>
    <div class="scan"><svg viewBox="0 0 1920 1080" aria-hidden="true"><g fill="none" stroke="#080a08" stroke-width="2" stroke-linecap="round"><path/><path stroke="#fff"/><path/><path/><path/><path/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="scan-core" cx="960" cy="540" r="5" fill="#080a08" stroke="none"/></g></svg><span>PERMISSION AUTHORIZED</span></div>
    <div class="welcome"><div class="welcome-panel"></div><div class="welcome-heading">WELCOME TO</div><div class="welcome-company"><strong>RNDYT BLOG.</strong><strong class="welcome-highlight" aria-hidden="true">RNDYT BLOG.</strong></div><div class="welcome-database">PERSONAL ARCHIVE</div><div class="welcome-logo">${logo}</div></div>
  </section>
  <div id="cinema-caption" class="cinema-caption"></div>
  <svg id="inspection-marks" viewBox="0 0 1920 1080" aria-hidden="true"><path id="inspection-lines"/><g id="inspection-corners"></g><circle id="inspection-point" r="1.8"/></svg>
  <div id="inspection-text" aria-hidden="true">CONFIDENTIALITY:<strong>PUBLIC READING</strong></div>
  <section id="archive-ui" class="archive-ui" aria-label="档案选择">
    <div class="archive-callout"><div class="eyebrow">PERSONAL ARCHIVE <span>／</span> <span id="archive-category">工程文章</span></div><button class="file-title" data-action="open">POST NUMBER: <span id="selected-id">X-<span id="selected-code">001</span></span><span class="file-open">↗</span></button><div class="callout-rule"><i></i></div><div class="file-summary"><span id="selected-title">rndyt 博客</span><span id="selected-clearance">PREVIEW / 示例</span></div><button class="read-file" data-action="open">ACCESS FILE <span>→</span></button></div>
    <div id="hover-label" class="hover-label" hidden>X-<span id="hover-code">001</span> / <span id="hover-title"></span></div>
    <div class="archive-counter"><span class="tiny-label">ARCHIVE / SELECT</span><div><span id="selected-number">01</span><i>/</i><span class="count-total">12</span></div></div>
    <div class="archive-navigation"><button data-action="prev" aria-label="上一个档案">↑</button><div id="file-ticks" class="file-ticks"></div><button data-action="next" aria-label="下一个档案">↓</button></div>
    <div class="column-navigation"><button data-action="column-prev" aria-label="上一列">←</button><div><span id="column-number">COLUMN <span id="column-index">03</span> / ${String(archiveColumns.length).padStart(2, "0")}</span><strong id="column-name">工程文章</strong></div><button data-action="column-next" aria-label="下一列">→</button></div>
    <div class="archive-hint"><kbd>←</kbd> <kbd>→</kbd> 切换列 <span>／</span> <kbd>↑</kbd> <kbd>↓</kbd> 前后档案 <span>／</span> <kbd>ENTER</kbd> 读取</div>
  </section>
  <section id="detail-ui" class="detail-ui" aria-label="档案内容" hidden>
    <button class="back-button" data-action="back">← <span>ARCHIVE OVERVIEW</span><small>ESC</small></button>
    <div class="object-caption"><span id="object-id">NO.001</span><div>PERSONAL ARCHIVE</div><small>DRAG TO INSPECT <span>↔</span></small><button class="viewer-open" data-action="model-viewer">360° 查看文档模型 <span>↗</span></button></div>
    <article id="detail-content" class="detail-content"></article>
  </section>
  <div class="powered">POWERED BY <b>RHINELAB UI</b><i></i></div>
  <footer class="system-footer"><span><i class="status-light"></i> PUBLIC READING</span><span>RNDYT <i>／</i> <span id="clock">00:00:00</span></span><div class="footer-actions"><button class="view-toggle" data-action="view-toggle" aria-label="切换到二维文章目录" title="切换到二维文章目录"><span class="view-toggle-option">2D</span><i class="view-toggle-track" aria-hidden="true"><b></b></i><span class="view-toggle-option is-current">3D</span></button><button data-action="replay" title="重播启动流程">REINITIALIZE ↗</button></div></footer>
  <div id="pwa-update-notice" class="pwa-update-notice" role="status" hidden><span>新版本已就绪</span><button data-pwa-action="update">更新并重启 ↻</button></div>
  <div id="modal-root"></div><div id="toast" class="toast" role="status"></div>
  <div id="loading" class="loading"><div class="loading-mark">${logo}</div><span>CONNECTING TO PERSONAL ARCHIVE</span><i></i></div>
`;

$("#boot-background").insertAdjacentHTML(
  "beforeend",
  '<div class="boot-white"></div>',
);
const bootSequence = new BootSequence($("#stage"));
$("#viewport").insertAdjacentHTML("beforeend", '<button class="mobile-entry" data-action="skip">进入档案 <span>→</span></button>');

type Mode = "boot" | "archive" | "detail";
let mode: Mode = "boot",
  selected = 0,
  bootStart = 0,
  lastStep = "",
  ready = false;
let modal: "search" | "saved" | "settings" | null = null,
  searchQuery = "",
  filter = "全部档案";
let activeTab = "overview";
let restoringRoute = false;
let archiveEntry: ArchiveEntry | null = null;
let browsingEntryLayout = false;
const reviewParams = new URLSearchParams(location.search);
let frozenTime =
  reviewParams.get("freeze") === "1"
    ? Number(reviewParams.get("time") ?? 0)
    : null;
if (reviewParams.get("review") === "1") {
  $("#stage").dataset.review = "true";
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.type !== "rhine-review-frame"
    )
      return;
    const t = Number(event.data.time);
    if (!Number.isFinite(t) || t < 0 || t >= 35) return;
    frozenTime = t;
    if (ready && mode !== "boot") setMode("boot");
  });
}
let toastTimer: ReturnType<typeof setTimeout>;
let previousFocus: HTMLElement | null = null;
const detailTransition = new SurfaceTransition($("#detail-ui"), undefined, 180, 180);
const tabTransition = new ContentTransition();
let modalTransition: SurfaceTransition | undefined;
let modalClosing = false;
let modalSiblings: { node: HTMLElement; inert: boolean }[] = [];
let pendingDetailFocus = false;
function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const saved = new Set<string>(readLocal<string[]>("rndyt-blog-saved", []));
const storedPrefs = readLocal<Partial<{ sound: boolean; music: boolean; soundVolume: number; musicVolume: number; reduced: boolean; quality: boolean; rendering: RenderQuality; motion: StoredMotion; motionPreset: "system" | "full" | "reduced" | "custom" }>>("rndyt-blog-settings", {});
const motionMedia = matchMedia("(prefers-reduced-motion: reduce)");
let systemReduced = motionMedia.matches;
let initialMotionPreset: MotionPreset = storedPrefs.motionPreset ?? storedPrefs.motion?.preset
  ?? (storedPrefs.motion ? "custom" : storedPrefs.reduced === undefined ? (systemReduced ? "system" : "full") : storedPrefs.reduced ? "reduced" : "full");
const initialMotion = createMotionPreferences(initialMotionPreset === "system" ? undefined : storedPrefs.motion, storedPrefs.reduced, systemReduced);
if (initialMotionPreset === "full" && !Object.values(initialMotion).every(Boolean)) initialMotionPreset = "custom";
if (initialMotionPreset === "reduced" && Object.values(initialMotion).some(Boolean)) initialMotionPreset = "custom";
const prefs = {
  sound: storedPrefs.sound ?? true,
  music: storedPrefs.music ?? true,
  soundVolume: storedPrefs.soundVolume ?? .55,
  musicVolume: storedPrefs.musicVolume ?? .5,
  motion: initialMotion,
  motionPreset: initialMotionPreset,
  quality: storedPrefs.quality ?? true,
  rendering: normalizeQuality(storedPrefs.rendering, storedPrefs.quality !== false),
};
const motionActive = (key: MotionKey) => motionEnabled(prefs.motion, key);
const motionIsReduced = () => Object.values(prefs.motion).every((value) => !value);
const rollingMotion = {
  duration: 460,
  motionBlur: true,
  animated: motionActive("rollingNumbers"),
};
const numberOptions = {
  ...rollingMotion,
  locales: "en-US",
  format: { minimumIntegerDigits: 2, useGrouping: false },
};
const fileCounter = createRollingNumber($("#selected-number"), {
  ...numberOptions,
  value: 1,
});
const columnCounter = createRollingNumber($("#column-index"), {
  ...numberOptions,
  value: 3,
});
const codeOptions = {
  ...numberOptions,
  format: { minimumIntegerDigits: 3, useGrouping: false },
  value: 1,
};
const textOptions = {
  ...rollingMotion,
  animated: motionActive("rollingText"),
  transition: "direct" as const,
  stagger: "none" as const,
};
const selectionTitle = createRollingText($("#selected-title"), {
  ...textOptions,
  text: $("#selected-title").textContent ?? "",
});
const columnTitle = createRollingText($("#column-name"), {
  ...textOptions,
  text: $("#column-name").textContent ?? "",
});
const hoverTitle = createRollingText($("#hover-title"), { ...textOptions, text: "" });
const categoryTitle = createRollingText($("#archive-category"), {
  ...textOptions,
  text: $("#archive-category").textContent ?? "",
});
const clearanceTitle = createRollingText($("#selected-clearance"), {
  ...textOptions,
  text: $("#selected-clearance").textContent ?? "",
});
const rollingTitles = [selectionTitle, columnTitle, hoverTitle, categoryTitle, clearanceTitle];
const selectedCode = createRollingNumber($("#selected-code"), codeOptions);
const hoverCode = createRollingNumber($("#hover-code"), codeOptions);
const audio = new TerminalAudio();
audio.configure(prefs);
const reviewEntry = reviewParams.has("scene") || reviewParams.has("time") || reviewParams.get("review") === "1" || reviewParams.has("post");
let started = false;
const loading = $("#loading");
// The entry screen uses the actual viewport, including portrait phones; the
// reference animation still uses its calibrated 1920 x 1080 stage.
$("#viewport").append(loading);
$("#stage").inert = true;
$(".mobile-entry").inert = true;
const entry = !reviewEntry && (prefs.sound || prefs.music) ? new StartupGate({
  root: loading,
  unlock: () => audio.unlock(),
  cancel: () => audio.cancelEntry(),
  start: silent => completeStartup(silent),
}) : undefined;
if (entry) {
  audio.holdForEntry();
  if (prefs.music) void audio.prepareMusic().catch(() => { /* Entry offers retry. */ });
}
let audioPreview = false, audioPreviewRequest = 0;
let scene: ArchiveScene;
let viewer: ModelViewer | undefined;
const columnMemory = archiveColumns.map((_, lane) => columnFiles(lane)[0]);
function saveAudioPrefs() {
  try {
    localStorage.setItem("rndyt-blog-settings", JSON.stringify(prefs));
  } catch {}
  audio.configure(prefs);
}
function savePrefs() {
  saveAudioPrefs();
  if (!motionActive("rollingText")) rollingTitles.forEach(title => title.finish());
  if (!motionActive("rollingNumbers")) [fileCounter, columnCounter, selectedCode, hoverCode].forEach(counter => counter.finish());
  if (!motionActive("detailTransition")) detailTransition.finish();
  if (!motionActive("surfaceTransitions")) {
    modalTransition?.finish();
    tabTransition.finish();
  }
  scene?.setMotion(prefs.motion);
  scene?.setQuality(prefs.rendering);
  viewer?.setQuality(prefs.rendering);
  viewer?.setMotion(prefs.motion);
  syncQualityUI(prefs.rendering);
  updateQualitySummary();
  fileCounter.update({ animated: motionActive("rollingNumbers") && mode === "archive" });
  rollingTitles.forEach(title => title.update({ animated: motionActive("rollingText") && mode === "archive" }));
  columnCounter.update({ animated: motionActive("rollingNumbers") && mode === "archive" });
  selectedCode.update({ animated: motionActive("rollingNumbers") && mode === "archive" });
  hoverCode.update({ animated: motionActive("rollingNumbers") && mode === "archive" });
  $("#stage").classList.toggle("reduce-motion", motionIsReduced());
}
let previousLayout = "";
function fit() {
  const stage = $("#stage");
  const viewport = $("#viewport");
  const coarse = matchMedia("(pointer: coarse)").matches;
  const { width, height, scale, kind } = viewportLayout(viewport.clientWidth, viewport.clientHeight, coarse, mode === "boot" && !browsingEntryLayout);
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  stage.dataset.layout = kind;
  stage.dataset.touch = String(coarse);
  viewport.dataset.mobileBoot = String(mode === "boot" && (coarse || viewport.clientWidth < 1100));
  stage.style.setProperty("--stage-scale", String(scale));
  // The software keyboard resizes dialogs without recomposing the 3D scene.
  const visible = window.visualViewport;
  const stageTop = (viewport.clientHeight - height * scale) / 2;
  stage.style.setProperty("--modal-top", `${Math.max(0, (visible?.offsetTop ?? 0) - stageTop) / scale}px`);
  stage.style.setProperty("--modal-height", `${Math.min(height, (visible?.height ?? viewport.clientHeight) / scale)}px`);
  $("#viewport").style.setProperty("--scale", String(scale));
  const marks = document.querySelector("#inspection-marks");
  marks?.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const layoutKey = JSON.stringify([width, height, scale, kind, devicePixelRatio]);
  if (layoutKey !== previousLayout) {
    previousLayout = layoutKey;
    scene?.resize();
    viewer?.resize();
  }
  updateQualitySummary();
  // Re-measure line covers and tab underline after wrapping changes.
  requestAnimationFrame(() => {
    documentDecryption.refresh();
    const tab = document.querySelector<HTMLElement>(".detail-tabs button.active");
    const indicator = document.querySelector<HTMLElement>(".tab-indicator");
    if (tab && indicator) indicator.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
  });
}
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.visualViewport?.addEventListener("scroll", fit);
matchMedia("(pointer: coarse)").addEventListener("change", fit);
fit();
$("#file-ticks").innerHTML = columnFiles(fileLocation(selected).lane)
  .map(
    (index) => `<button data-select="${index}"></button>`,
  )
  .join("");
let fileTicks = [...$("#file-ticks").querySelectorAll<HTMLButtonElement>("button")];

function setMode(next: Mode, animateEntry = true) {
  const previousMode = mode;
  if (next === "archive" && previousMode === "boot" && motionActive("boot") && animateEntry) {
    if (archiveEntry) return;
    const now = performance.now() / 1000;
    const currentTime = frozenTime ?? now - bootStart;
    if (currentTime < ARRAY_ENTRY_END) {
      archiveEntry = new ArchiveEntry(currentTime, Math.max(now, bootStart + 1.76));
      frozenTime = null;
      return;
    }
  }
  archiveEntry = null;
  rollingTitles.forEach(title => title.update({ animated: motionActive("rollingText") && next === "archive" }));
  if (next !== "archive") {
    rollingTitles.forEach(title => title.finish());
    hoverCode.finish();
    $("#hover-label").hidden = true;
  }
  if (next === "boot") browsingEntryLayout = false;
  mode = next;
  audio.setScene(next);
  if (next !== "boot" && audioPreview) {
    audioPreview = false;
    audioPreviewRequest++;
    audio.configure(prefs);
  }
  $("#stage").dataset.mode = next;
  if (previousMode !== next || next === "boot") fit();
  $("#boot").inert = next !== "boot";
  $("#boot").setAttribute("aria-hidden", String(next !== "boot"));
  $("#archive-ui").inert = next !== "archive" || Boolean(modal);
  $("#archive-ui").setAttribute("aria-hidden", String(next !== "archive"));
  $(".system-nav").inert = next === "boot" || Boolean(modal);
  $(".system-footer").inert = next === "boot" || Boolean(modal);
  if (next === "detail") {
    if (previousMode !== "detail") detailTransition.show(!motionActive("detailTransition"));
  } else if (previousMode === "detail" || (next === "boot" && !$("#detail-ui").hidden)) {
    pendingDetailFocus = false;
    tabTransition.cancel();
    detailTransition.hide(!motionActive("detailTransition") || next === "boot");
    if (!modal && next === "archive") $(".read-file").focus({ preventScroll: true });
  }
  $("#detail-ui").inert = next !== "detail" || Boolean(modal);
  scene?.setMode(next === "boot" ? "hidden" : next);
  if (next !== "boot") {
    bootSequence.reset();
    $(".file-title").firstChild!.textContent = "POST NUMBER: ";
    $("#stage").dataset.boot = "done";
    $("#cinema-caption").textContent = "";
  }
  if (previousMode === "boot" && next === "archive" && !modal) {
    $(".read-file").focus({ preventScroll: true });
  }
  if (next === "detail" && previousMode !== "detail") {
    renderDetail();
    pendingDetailFocus = true;
  }
  if (started && !restoringRoute && (next === "detail" || previousMode === "detail")) {
    const url = new URL(location.href);
    if (next === "detail") url.searchParams.set("post", records[selected].slug);
    else url.searchParams.delete("post");
    if (url.href !== location.href) history.pushState(null, "", url);
  }
  document.title = next === "detail" ? `${records[selected].title} · rndyt` : "rndyt · 个人博客";
}
function applyPostRoute() {
  if (!ready || !started) return;
  const slug = new URL(location.href).searchParams.get("post");
  const index = records.findIndex(r => r.slug === slug);
  restoringRoute = true;
  try {
    if (index >= 0) { select(index); setMode("detail"); }
    else { setMode("archive"); if (slug) notify("未找到这篇文章，可从文章目录重新选择。"); }
  } finally { restoringRoute = false; }
}
window.addEventListener("popstate", applyPostRoute);
function select(index: number, navigation?: ArchiveNavigation) {
  selected = (index + records.length) % records.length;
  columnMemory[fileLocation(selected).lane] = selected;
  if (mode === "detail") setMode("archive");
  activeTab = "overview";
  scene?.select(selected, navigation);
  updateSelection(navigation);
  const columnMove = navigation && "axis" in navigation && navigation.axis === "lane";
  audio.play(columnMove ? "column" : "tick", columnMove ? navigation.direction * .45 : 0);
}
function stepFile(direction: number) {
  const files = columnFiles(fileLocation(selected).lane);
  if (files.length < 2) return;
  select(
    files[(files.indexOf(selected) + direction + files.length) % files.length],
    { axis: "row", direction },
  );
}
function stepColumn(direction: number) {
  const lane = fileLocation(selected).lane;
  const next = wrap(lane + direction, archiveColumns.length);
  select(columnMemory[next], { axis: "lane", direction });
}
function updateSelection(navigation?: ArchiveNavigation) {
  const r = records[selected];
  const { lane } = fileLocation(selected);
  const files = columnFiles(lane);
  selectionTitle.update({ text: r.title, animated: motionActive("rollingText") && mode === "archive" });
  clearanceTitle.update({ text: r.clearance, animated: motionActive("rollingText") && mode === "archive" });
  categoryTitle.update({ text: r.category, animated: motionActive("rollingText") && mode === "archive" });
  const direction =
    navigation && "axis" in navigation
      ? navigation.direction > 0
        ? "up"
        : "down"
      : "auto";
  selectedCode.update({
    value: Number(r.id.slice(2)),
    animated: motionActive("rollingNumbers") && mode === "archive",
    direction,
  });
  fileCounter.update({
    value: files.indexOf(selected) + 1,
    animated: motionActive("rollingNumbers") && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "row"
        ? direction
        : "auto",
  });
  $(".count-total").textContent = String(files.length).padStart(2, "0");
  columnCounter.update({
    value: lane + 1,
    animated: motionActive("rollingNumbers") && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "lane"
        ? direction
        : "auto",
  });
  columnTitle.update({ text: archiveColumns[lane], animated: motionActive("rollingText") && mode === "archive" });
  $<HTMLButtonElement>('[data-action="column-prev"]').disabled = false;
  $<HTMLButtonElement>('[data-action="column-next"]').disabled = false;
  if (fileTicks.length !== files.length) {
    $("#file-ticks").innerHTML = files.map(index => `<button data-select="${index}"></button>`).join("");
    fileTicks = [...$("#file-ticks").querySelectorAll<HTMLButtonElement>("button")];
  }
  fileTicks.forEach((button, slot) => {
    const index = files[slot], record = records[index];
    button.dataset.select = String(index);
    button.setAttribute("aria-label", `选择档案 ${record.id} ${record.title}`);
    button.title = `${record.id} · ${record.title}`;
    button.classList.toggle("selected", index === selected);
    button.setAttribute("aria-pressed", String(index === selected));
  });
}
function replayBoot(forcePreview = false) {
  if (!ready) return;
  closeModal(() => replayBootAfterModal(forcePreview));
}
function replayBootAfterModal(forcePreview: boolean) {
  bootStart = performance.now() / 1000 - 1.76;
  frozenTime = null;
  lastStep = "";
  setMode(!motionActive("boot") && !forcePreview ? "archive" : "boot");
  audio.restartBoot();
  scene.select(0);
  selected = 0;
  updateSelection();
  if (!forcePreview) audio.play("ui-tick");
}
function openFile() {
  if (!ready) return;
  closeModal(() => {
    setMode("detail");
    audio.play("open");
  });
}
function renderDetail() {
  tabTransition.cancel();
  const r = records[selected];
  $("#object-id").textContent = "NO." + r.id.slice(2);
  $("#detail-content").innerHTML = `
  <div class="detail-kicker"><span>FILE ${r.id}</span><span>${escapeHtml(r.clearance)}</span></div>
  <h2>${escapeHtml(r.title)}</h2><div class="detail-title-cn">${escapeHtml(r.category)}<span>${r.readingMinutes} MIN READ</span></div>
  <div class="detail-rule"></div>
  <dl class="metadata"><div><dt>TAGS / 标签</dt><dd>${escapeHtml(r.department)}</dd></div><div><dt>DATE / 日期</dt><dd>${escapeHtml(r.date)}</dd></div><div><dt>AUTHOR / 作者</dt><dd>${escapeHtml(r.lead)}</dd></div><div><dt>STATUS / 状态</dt><dd><i></i>${r.preview ? "示例内容 · 预览" : "已发布 · 可阅读"}</dd></div></dl>
  <div class="detail-tabs" role="tablist"><button id="tab-overview" class="active" role="tab" aria-controls="tab-panel" aria-selected="true" data-tab="overview">01 <span>摘要</span></button><button id="tab-notes" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="notes">02 <span>目录</span></button><button id="tab-history" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="history">03 <span>相关文章</span></button><i class="tab-indicator" aria-hidden="true"></i></div>
  <div id="tab-panel" class="tab-panel" role="tabpanel">${overview()}</div>
  <div class="detail-actions"><a class="solid-button" href="${escapeHtml(r.source)}" aria-label="查看文章">VIEW<span>查看</span></a><button class="export-button" data-action="copy-link" aria-label="复制文件链接">EXPORT <span>↓</span></button></div>
  <div class="detail-footnote"><span>${String(selected + 1).padStart(3, "0")} / ${String(records.length).padStart(3, "0")}</span></div>`;
  $("#detail-content").scrollTop = 0;
  $("#detail-content").setAttribute("tabindex", "-1");
  documentDecryption.reset($("#detail-content"), !motionActive("documentReveal") || scene.decryptionFrame.phase === "clear");
  setTab(activeTab, false);
  try {
    const returning = JSON.parse(sessionStorage.getItem("reader-detail-return") ?? "null");
    if (returning?.slug === r.slug) {
      sessionStorage.removeItem("reader-detail-return");
      if (["overview", "notes", "history"].includes(returning.tab)) setTab(returning.tab, false);
      requestAnimationFrame(() => { $("#detail-content").scrollTop = Number(returning.scroll) || 0; });
    }
  } catch { /* Storage is optional; the archive URL still restores selection. */ }
}
function overview() {
  const r = records[selected];
  const template = document.createElement("template");
  template.innerHTML = r.bodyHtml;
  const paragraphs = [...template.content.querySelectorAll("p")];
  const paragraph = paragraphs.find((node) => !node.closest("blockquote")) ?? paragraphs[0];
  const summary = paragraph?.outerHTML ?? "<p>暂无摘要。</p>";
  return `<div class="panel-label">ABSTRACT / 摘要</div>${r.preview ? '<p class="blog-preview">示例内容 · 尚未替换为真实文章或项目资料。</p>' : ''}<div class="blog-prose">${summary}</div>`;
}
function setTab(tab: string, sound = true) {
  if (sound && tab === activeTab) return;
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((b) => {
    const active = (b as HTMLElement).dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
    b.setAttribute("tabindex", active ? "0" : "-1");
  });
  const r = records[selected];
  const tocHeadings = r.headings.filter(h => h.depth === 1);
  const tabButton = $<HTMLButtonElement>(`[data-tab="${tab}"]`);
  const indicator = $(".tab-indicator");
  indicator.style.transition = sound ? "" : "none";
  indicator.style.transform = `translateX(${tabButton.offsetLeft}px) scaleX(${tabButton.offsetWidth})`;
  $("#tab-panel").setAttribute("aria-labelledby", tabButton.id);
  $("#tab-panel").innerHTML =
    tab === "overview"
      ? overview()
      : tab === "notes"
        ? `<div class="panel-label">CONTENTS / 本文目录</div>${tocHeadings.length ? `<nav class="blog-toc" aria-label="本文目录">${tocHeadings.map(h => `<button data-heading="${h.id}">${h.text}</button>`).join("")}</nav>` : '<p>这是一篇短文，可直接在正文页签阅读。</p>'}`
        : `<div class="panel-label">RELATED / 同类文章</div>${records.map((post, index) => ({ post, index })).filter(({post}) => post.id !== r.id && post.category === r.category).map(({post,index}) => `<button class="blog-related" data-result="${index}"><span>${escapeHtml(post.title)}</span><small>${escapeHtml(post.date)} ↗</small></button>`).join("") || '<p>当前分类暂无其他文章。</p>'}`;
  $("#tab-panel").scrollTop = 0;
  documentDecryption.refresh();
  if (sound) {
    tabTransition.reveal($("#tab-panel"), !motionActive("surfaceTransitions"));
    audio.play("ui-tick");
  }
}
function notify(message: string) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}

function openModal(kind: NonNullable<typeof modal>) {
  if (!ready) return;
  if (!modal) {
    previousFocus = document.activeElement as HTMLElement;
    modalSiblings = [...$("#stage").children]
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node.id !== "modal-root")
      .map((node) => ({ node, inert: node.inert }));
    modalSiblings.forEach(({ node }) => (node.inert = true));
  }
  modalClosing = false;
  modal = kind;
  searchQuery = "";
  filter = "全部档案";
  audio.play("page-open");
  renderModal();
}
function closeModal(afterClose?: () => void) {
  if (!modal) {
    afterClose?.();
    return;
  }
  if (modalClosing) return;
  modalClosing = true;
  audio.play("page-close");
  modalTransition!.hide(!motionActive("surfaceTransitions"), () => {
    modal = null;
    modalClosing = false;
    $("#modal-root").replaceChildren();
    modalTransition = undefined;
    modalSiblings.forEach(({ node, inert }) => (node.inert = inert));
    modalSiblings = [];
    $("#archive-ui").inert = mode !== "archive";
    $("#detail-ui").inert = mode !== "detail";
    previousFocus?.focus({ preventScroll: true });
    afterClose?.();
  });
}
function renderModal() {
  if (!modal) return;
  modalTransition?.dispose();
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="terminal-modal ${modal === "settings" ? "settings-modal" : ""}" role="dialog" aria-modal="true" aria-label="${modal === "settings" ? "系统设置" : modal === "saved" ? "收藏档案" : "档案检索"}"><div class="modal-top"><span>RNDYT / ${modal === "settings" ? "SYSTEM PREFERENCES" : "ARCHIVE DIRECTORY"}</span><button data-action="close-modal" aria-label="关闭窗口">CLOSE <span>×</span></button></div>${modal === "settings" ? settingsMarkup() : `<h2>${modal === "saved" ? "SAVED ARCHIVES" : "ARCHIVE INDEX"}<small>${modal === "saved" ? "收藏档案" : "博客文章检索"}</small></h2><div class="search-field"><span>⌕</span><input id="archive-search" type="search" autocomplete="off" placeholder="输入文章标题、标签或关键词" aria-label="检索档案"/><span class="key">ESC</span></div><div class="category-filters">${categories.map((c, i) => `<button data-filter="${escapeHtml(c)}" class="${i === 0 ? "active" : ""}">${escapeHtml(c)}</button>`).join("")}</div><div class="result-header"><span>FILE / 档案</span><span>TAGS / 标签</span><span>ACCESS</span></div><div id="search-results" class="search-results"></div><div class="modal-bottom"><span id="result-count"></span><span>PERSONAL ARCHIVE <i>●</i> CONNECTED</span></div>`}</section></div>`;
  const backdrop = $(".modal-backdrop");
  backdrop.hidden = true;
  modalTransition = new SurfaceTransition(backdrop, $(".terminal-modal"));
  modalTransition.show(!motionActive("surfaceTransitions"));
  if (modal === "settings") updateQualitySummary();
  if (modal !== "settings") {
    renderResults();
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing) $("#archive-search").focus();
    });
  } else
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing) $('[data-action="close-modal"]').focus();
    });
  $("#modal-root")
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
}
function renderResults() {
  const results = records
    .map((r, i) => ({ r, i }))
    .filter(
      ({ r }) =>
        (modal !== "saved" || saved.has(r.id)) &&
        (filter === "全部档案" || r.category === filter) &&
        `${r.id} ${r.title} ${r.en} ${r.department} ${r.lead} ${r.body}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  $("#search-results").innerHTML = results.length
    ? results
        .map(
          ({ r, i }) =>
            `<button class="result-row" data-result="${i}"><span class="result-name"><b>${r.id}</b><span>${escapeHtml(r.title)}<small>${escapeHtml(r.en)}</small></span>${saved.has(r.id) ? "<i>＋</i>" : ""}</span><span>${escapeHtml(r.department)}</span><span>${r.preview ? "示例" : "已发布"} <i>↗</i></span></button>`,
        )
        .join("")
    : `<div class="empty-results"><span>∅</span><strong>${modal === "saved" && !searchQuery ? "尚无收藏档案" : "没有匹配的档案"}</strong><p>${modal === "saved" && !searchQuery ? "读取档案时，选择 SAVE ARCHIVE 将其保存在此处。" : "尝试其他名称、档案编号，或切换文章分类。"}</p><button data-action="reset-search">${modal === "saved" ? "查看全部档案 →" : "重置检索 →"}</button></div>`;
  $("#result-count").textContent =
    `${String(results.length).padStart(2, "0")} RECORDS FOUND`;
}
function updateQualitySummary() {
  const summary = document.querySelector("#quality-summary");
  if (!summary || !scene) return;
  const canvas = scene.renderer.domElement;
  const metrics = JSON.parse(canvas.parentElement?.dataset.renderQuality ?? "{}");
  summary.textContent = `实际渲染 ${canvas.width} × ${canvas.height} · ${prefs.rendering.antialias === "smaa" ? "SMAA" : "原始抗锯齿"} · 纹理 ${metrics.anisotropy ?? 1}×${metrics.limited ? " · 已达到缓冲上限" : ""}`;
}
function motionPreferenceNoteMarkup() {
  const preset = prefs.motionPreset;
  const allEnabled = Object.values(prefs.motion).every(Boolean);
  return `<div id="motion-preference-note" class="motion-preference-note"><p>${preset === "system" ? `跟随系统 · ${motionSummary(prefs.motion)}` : motionSummary(prefs.motion)}</p><span>预设：${preset === "full" ? "完整动画" : preset === "reduced" ? "减少动画" : preset === "system" ? "跟随系统" : "自定义"}${systemReduced ? " · 系统偏好为减少动画" : ""}</span>${allEnabled ? "" : '<button data-action="enable-motion">启用完整动画并重播 ↻</button>'}</div>`;
}
function settingsMarkup() {
  return `<h2>SYSTEM SETTINGS<small>终端偏好设置</small></h2><p class="settings-intro">RNDYT <span>·</span> PUBLIC READING</p><div class="settings-list">${audioSettingsMarkup(prefs)}</div>${motionPreferenceNoteMarkup()}${motionSettingsMarkup(prefs.motion, prefs.motionPreset)}${qualityMarkup(prefs.rendering)}${pwaSettingsMarkup()}<div class="settings-shortcuts"><span>KEYBOARD CONTROLS</span><p><kbd>←</kbd><kbd>→</kbd> 切列 <kbd>↑</kbd><kbd>↓</kbd> 选档 <kbd>ENTER</kbd> 读取 <kbd>/</kbd> 检索 <kbd>ESC</kbd> 返回</p></div><div class="settings-bottom">${document.fullscreenEnabled ? '<button data-action="fullscreen">FULLSCREEN <span>↗</span></button>' : ''}<button data-action="restart">REINITIALIZE SYSTEM <span>↻</span></button></div><div class="modal-bottom"><span>ANALYSIS OS / 1.0 · 使用 MiSans 字体（小米） <a href="${assetUrl("fonts/MiSans-license.pdf")}" target="_blank" rel="noopener">字体许可</a></span><span>界面基于 <a href="https://github.com/LBEILC/RhineLabUI" target="_blank" rel="noopener">RhineLabUI · LBEILC</a> / MIT</span></div>`;
}

document.addEventListener("input", (e) => {
  const slider = e.target as HTMLInputElement;
  if (slider.dataset.quality) {
    const output = document.querySelector<HTMLOutputElement>(`[data-quality-output="${slider.dataset.quality}"]`);
    if (output) output.value = `${slider.value}%`;
  }
  const volume = e.target as HTMLInputElement;
  if (volume.dataset.volume === "musicVolume" || volume.dataset.volume === "soundVolume") {
    prefs[volume.dataset.volume] = Number(volume.value) / 100;
    volume.closest("label")?.querySelector("output")?.replaceChildren(`${volume.value}%`);
    saveAudioPrefs();
  }
  if ((e.target as HTMLElement).id === "archive-search") {
    searchQuery = (e.target as HTMLInputElement).value;
    renderResults();
  }
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "quality-preset" && Object.hasOwn(qualityPresets, el.value)) {
    prefs.rendering = { ...qualityPresets[el.value as QualityPreset] };
    savePrefs();
  } else if (el.dataset.quality) {
    const key = el.dataset.quality as keyof RenderQuality;
    prefs.rendering = normalizeQuality({ ...prefs.rendering, [key]: key === "antialias" ? el.value : Number(el.value) });
    savePrefs();
  }
  if (el.dataset.pref) {
    const key = el.dataset.pref;
    if (key === "sound" || key === "music" || key === "quality") prefs[key] = el.checked;
    if (key === "sound" || key === "music") saveAudioPrefs(); else savePrefs();
    audio.play("confirm");
  }
  if (el.dataset.motion) {
    const key = el.dataset.motion as MotionKey;
    prefs.motion[key] = el.checked;
    prefs.motionPreset = motionPresetFor(prefs.motion);
    savePrefs();
    const motionRoot = $("#motion-settings");
    const advancedOpen = motionRoot.querySelector<HTMLDetailsElement>(".motion-advanced")?.open ?? false;
    const settingsPanel = motionRoot.closest<HTMLElement>(".settings-modal");
    const scrollTop = settingsPanel?.scrollTop ?? 0;
    motionRoot.outerHTML = motionSettingsMarkup(prefs.motion, prefs.motionPreset);
    $("#motion-preference-note").outerHTML = motionPreferenceNoteMarkup();
    $("#motion-settings").querySelector<HTMLDetailsElement>(".motion-advanced")!.open = advancedOpen;
    requestAnimationFrame(() => {
      if (settingsPanel) settingsPanel.scrollTop = scrollTop;
      document.querySelector<HTMLInputElement>(`[data-motion="${key}"]`)?.focus({ preventScroll: true });
    });
    notify(key === "boot" ? "开场设置将在下次重播时生效" : el.checked ? "已启用此动画" : "已关闭此动画");
    audio.play("confirm");
  }
});
document.addEventListener("click", (e) => {
  if (!started) return;
  if (modalClosing) return;
  const el = (e.target as Element).closest<HTMLElement>("button");
  if (!el) return;
  if (el.dataset.action === "motion-preset") {
    const preset = el.dataset.preset;
    if (preset !== "system" && preset !== "full" && preset !== "reduced") return;
    prefs.motionPreset = preset;
    prefs.motion = preset === "full"
      ? fullMotion()
      : preset === "reduced"
        ? reducedMotion()
        : createMotionPreferences(undefined, undefined, systemReduced);
    savePrefs();
    renderModal();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-action="motion-preset"][data-preset="${prefs.motionPreset}"]`)?.focus({ preventScroll: true }));
    audio.play("confirm");
    return;
  }
  if (el.dataset.heading) {
    const id = el.dataset.heading;
    setTab("overview");
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: motionActive("smoothScroll") ? "smooth" : "instant" });
    return;
  }
  if (el.dataset.select) {
    select(Number(el.dataset.select));
    return;
  }
  if (el.dataset.result) {
    const index = Number(el.dataset.result);
    closeModal(() => {
      restoringRoute = true;
      try { select(index); } finally { restoringRoute = false; }
      openFile();
    });
    return;
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          (b as HTMLElement).dataset.filter === filter,
        ),
      );
    renderResults();
    return;
  }
  if (el.dataset.tab) {
    setTab(el.dataset.tab);
    return;
  }
  if (el.dataset.action === "motion-preset") {
    const preset = el.dataset.preset;
    prefs.motionPreset = preset === "system" || preset === "full" || preset === "reduced" ? preset : "custom";
    prefs.motion = preset === "full"
      ? fullMotion()
      : preset === "reduced"
        ? reducedMotion()
        : createMotionPreferences(undefined, undefined, systemReduced);
    savePrefs();
    renderModal();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-action="motion-preset"][data-preset="${prefs.motionPreset}"]`)?.focus({ preventScroll: true }));
    audio.play("confirm");
    return;
  }
  const action = el.dataset.action;
  if (action === "view-toggle") {
    location.assign(assetUrl("blog/"));
    return;
  }
  if (action === "sound-preview") audio.play("confirm");
  if (action === "skip") {
    setMode("archive");
    audio.play("confirm");
  }
  if (action === "prev") stepFile(-1);
  if (action === "next") stepFile(1);
  if (action === "column-prev") stepColumn(-1);
  if (action === "column-next") stepColumn(1);
  if (action === "open") openFile();
  if (action === "model-viewer" && mode === "detail") {
    // Safari does not always focus a button when it is tapped. Capture the
    // actual opener so closing the modal reliably restores the right control.
    el.focus({ preventScroll: true });
    viewer ??= new ModelViewer($("#stage"), () => { audio.setScene(mode); audio.play("page-close"); }, (sound) => audio.play(sound === "tick" ? "ui-tick" : sound));
    audio.setScene("viewer");
    viewer.setQuality(prefs.rendering);
    viewer.setMotion(prefs.motion);
    scene.finishDecryption();
    viewer.open(
      records[selected].id,
      records[selected].title,
      () => scene.createAssemblyModel(),
      !motionActive("viewerNavigation"),
    );
    audio.play("page-open");
  }
  if (action === "back") {
    setMode("archive");
    audio.play("back");
  }
  if (action === "search" || action === "saved" || action === "settings") {
    el.focus({ preventScroll: true });
    openModal(action);
  }
  if (action === "close-modal") closeModal();
  if (action === "copy-link") {
    const url = new URL(records[selected].source, location.href);
    void navigator.clipboard?.writeText(url.href).then(() => notify("文件链接已复制"), () => notify(`复制失败，文件链接：${url.href}`));
    if (!navigator.clipboard) notify(`文件链接：${url.href}`);
  }
  if (action === "reset-search") {
    modal = "search";
    searchQuery = "";
    filter = "全部档案";
    renderModal();
  }
  if (action === "replay" || action === "restart") {
    replayBoot();
  }
  if (action === "enable-motion") {
    prefs.motion = fullMotion();
    prefs.motionPreset = "full";
    savePrefs();
    replayBoot();
  }
  if (action === "fullscreen" && document.fullscreenEnabled) {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen()
        .catch(() => notify("请使用浏览器的全屏快捷键 F11"));
  }
});
document.addEventListener("keydown", (e) => {
  if (!started) return;
  if (viewer?.isOpen) return;
  if (modalClosing) {
    e.preventDefault();
    return;
  }
  const typing = e.target instanceof HTMLInputElement;
  if (e.key === "Escape") {
    if (modal) closeModal();
    else if (mode === "detail" || (mode === "boot" && ready)) { const sound = mode === "detail" ? "back" : "ui-tick"; setMode("archive"); audio.play(sound); }
    return;
  }
  if (modal && e.key === "Tab") {
    const focusables = [
      ...$("#modal-root").querySelectorAll<HTMLElement>(
        'button,input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
      ),
    ];
    const visible = focusables.filter(el => el.getClientRects().length > 0);
    const first = visible[0],
      last = visible.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (typing || modal || !ready) return;
  if (
    (e.target as HTMLElement).dataset.tab &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    const tabs = ["overview", "notes", "history"];
    setTab(
      tabs[(tabs.indexOf(activeTab) + (e.key === "ArrowRight" ? 1 : 2)) % 3],
    );
    $<HTMLButtonElement>(`[data-tab="${activeTab}"]`).focus();
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    openModal("search");
  }
  if (e.key === "ArrowLeft" && mode === "archive") {
    e.preventDefault();
    stepColumn(-1);
  }
  if (e.key === "ArrowRight" && mode === "archive") {
    e.preventDefault();
    stepColumn(1);
  }
  if (["ArrowUp", "ArrowDown"].includes(e.key) && mode === "archive") {
    e.preventDefault();
    stepFile(e.key === "ArrowUp" ? -1 : 1);
  }
  if (
    e.key === "Enter" &&
    (document.activeElement === document.body ||
      document.activeElement?.id === "detail-content" ||
      ["prev", "next", "column-prev", "column-next"].includes(
        (document.activeElement as HTMLElement)?.dataset.action ?? "",
      ) ||
      (document.activeElement as HTMLElement)?.dataset.select)
  ) {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    else if (mode === "archive") openFile();
  }
});

const ease = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
function bootFrame(t: number) {
  audio.updateBoot(t, frozenTime !== null);
  const motion = bootSequence.update(t);
  let step: string = motion.step;
  let caption =
    motion.step === "auth"
      ? t < 9.52
        ? "身份信息确认：RNDYT"
        : t < 11.84
          ? "请求已接收"
          : "开始处理"
      : motion.step === "scan"
        ? "权限验证通过"
        : motion.step === "welcome"
          ? "欢迎访问rndyt 博客内部资料档案"
          : "";
  if (t >= 22) {
    step = "array";
    caption = "选择档案";
  }
  if (t >= 25.68) {
    step = "select";
    caption = "编号：X-001";
  }
  if (t >= 28.3) {
    step = "inspect";
    caption = t >= 29.3 ? "保密级别：商业区" : "编号：X-001";
  }
  if (step !== lastStep) {
    $("#stage").dataset.boot = step;
    lastStep = step;
  }
  $("#cinema-caption").textContent = caption;
  $(".file-title").firstChild!.textContent =
    step === "array"
      ? "SELECTING FILES...".slice(0, Math.max(0, Math.floor((t - 21.94) * 18)))
      : "POST NUMBER: ";
  $("#stage").style.setProperty(
    "--entry-opacity",
    String(ease((t - 21.9) / 0.13)),
  );
  $(".callout-rule").style.transform = `scaleX(${ease((t - 22.08) / 0.9)})`;
  const reveal = ease((t - 22) / 0.4),
    lift = ease((t - 26) / 1.8),
    zoom = 0.55 * ease((t - 27.3) / 1.65) + 0.45 * ease((t - 29.0) / 5.0);
  if (t >= 35) {
    setMode("detail");
    return undefined;
  }
  return { reveal, lift, zoom, time: t };
}

const inspectionOverlay = new InspectionOverlay();
const documentDecryption = new DocumentDecryption();
// A newly opened archive can introduce another font shard. Re-measure its
// redaction lines after font swap while retaining the current reveal progress.
document.fonts.addEventListener("loadingdone", () => documentDecryption.refresh());

let lastTime = 0,
  frameCount = 0,
  frameStart = performance.now(),
  fps = 0;
// Opt-in local diagnostic: compare first visible 3D frames with steady frames.
const measureStartup = import.meta.env.DEV && reviewParams.has("startupMetrics");
const startupFrames: { time: number; renderMs: number; frameMs: number }[] = [];
let previousStartupFrame = 0;
function frame(ms: number) {
  if (document.hidden) { requestAnimationFrame(frame); return; }
  const time = ms / 1000;
  const referencePlayback = reviewParams.has("time") || reviewParams.get("review") === "1";
  const bootTime = archiveEntry ? archiveEntry.advance(time) : frozenTime ?? time - bootStart;
  const cinema = mode === "boot" && ready
    ? bootFrame(referencePlayback ? bootTime : Math.min(bootTime, ARRAY_ENTRY_END))
    : undefined;
  if (cinema && !referencePlayback && cinema.time >= 21.9 && !browsingEntryLayout) {
    browsingEntryLayout = true;
    fit();
  }
  const sceneCinema = cinema ? { ...cinema, browseEntry: !referencePlayback } : undefined;
  // The calibrated 2D opening fully covers the scene until array entry.
  const renderStart = measureStartup ? performance.now() : 0;
  if (!viewer?.isOpen && (!cinema || cinema.time >= 21.9)) scene?.update(time, sceneCinema);
  if (measureStartup && cinema && cinema.time >= 21.8 && cinema.time < 25) {
    if (startupFrames.length && cinema.time < startupFrames[startupFrames.length - 1].time) {
      startupFrames.length = 0;
      previousStartupFrame = 0;
    }
    startupFrames.push({ time: cinema.time, renderMs: performance.now() - renderStart,
      frameMs: previousStartupFrame ? ms - previousStartupFrame : 0 });
    $("#stage").dataset.startupMetrics = JSON.stringify(startupFrames);
    previousStartupFrame = ms;
  }
  // Normal startup ends in browsing. Explicit reference playback retains the
  // full original extraction/inspection timeline for frame-by-frame review.
  if (archiveEntry?.finished || (mode === "boot" && cinema && cinema.time >= ARRAY_ENTRY_END && !referencePlayback)) {
    setMode("archive", false);
  }
  viewer?.update(time);
  if (scene && mode === "detail") {
    documentDecryption.update(time, scene.decryptionFrame, !motionActive("documentReveal"));
    $("#detail-content").style.opacity = String(scene.detailVisibility);
    $("#detail-content").style.transform =
      `translateY(${(1 - scene.detailVisibility) * 18}px)`;
    $("#detail-content").inert = scene.detailVisibility < 0.1;
    if (pendingDetailFocus && scene.detailVisibility >= 0.1 && !modal && !viewer?.isOpen) {
      $("#detail-content").focus({ preventScroll: true });
      pendingDetailFocus = false;
    }
  }
  $("#stage").style.setProperty("--detail-shade", String(mode === "boot" ? 0 : scene?.detailVisibility ?? 0));
  if (scene) inspectionOverlay.render(scene.decryptionFrame,
    (x, y) => scene.projectCard(x, y), Boolean(cinema), motionActive("modelDecryption"));
  if (Math.floor(time) !== lastTime) {
    lastTime = Math.floor(time);
    $("#clock").textContent = new Date().toLocaleTimeString("en-GB");
  }
  frameCount++;
  if (ms - frameStart > 1000) {
    fps = (frameCount * 1000) / (ms - frameStart);
    frameStart = ms;
    frameCount = 0;
    $("#three-scene").dataset.fps = String(Math.round(fps));
    $("#three-scene").dataset.renderStats = JSON.stringify(scene?.getStats());
  }
  requestAnimationFrame(frame);
}
async function start() {
  try {
    scene = new ArchiveScene($("#three-scene"));
    await Promise.all([
      scene.load(),
      // With unicode-range faces, preload the opening's actual characters,
      // not every font shard. Other archive text loads on demand.
      document.fonts.load("300 20px MiSans", "ACCESS WELCOME TO PERSONAL ARCHIVE"),
      document.fonts.load("400 20px MiSans", "身份信息确认请求已接收开始处理权限验证通过欢迎访问rndyt 博客内部资料档案编号保密级别商业区选择档案：0123456789 RNDYT"),
      document.fonts.load("600 20px MiSans", "SYNTHESIZE INFORMATION ANALYSIS OS"),
      document.fonts.load("700 20px MiSans", "RNDYT WELCOME TO PERSONAL ARCHIVE"),
    ]);
    scene.select(selected);
    scene.onSelect = (i, cell) => {
      if (mode !== "archive" || modal || viewer?.isOpen) return;
      select(i, cell ? { cell } : undefined);
    };
    scene.onNavigate = (axis, direction) => {
      if (mode !== "archive" || modal || viewer?.isOpen) return;
      if (axis === "lane") stepColumn(direction);
      else stepFile(direction);
    };
    scene.onHover = (i) => {
      const label = $("#hover-label");
      if (i === null) {
        label.hidden = true;
        hoverCode.finish();
        hoverTitle.finish();
        return;
      }
      const animated = motionActive("rollingText") && mode === "archive";
      hoverCode.update({
        value: Number(records[i].id.slice(2)),
        animated: !label.hidden && animated,
      });
      hoverTitle.update({ text: records[i].title, animated: !label.hidden && animated });
      label.hidden = false;
      // Prepare the first visible value so the next hover can animate immediately.
      hoverCode.update({ animated });
      hoverTitle.update({ animated });
    };
    savePrefs();
    await scene.prepareOpening();
    ready = true;
    select(0);
    if (entry) entry.ready();
    else completeStartup(false);
  } catch (error) {
    console.error(error);
    $("#loading").innerHTML =
      '<div class="error-state"><strong>CONNECTION INTERRUPTED</strong><p>三维档案资源未能载入。请确认浏览器已启用硬件加速，然后重新连接，或从下方文章目录直接阅读。</p><a href="/blog/">进入文章目录 ↗</a><button onclick="location.reload()">RECONNECT →</button></div>';
  }
}
function completeStartup(silent: boolean) {
  if (started || !ready) return;
  started = true;
  if (silent) {
    prefs.sound = false;
    prefs.music = false;
    saveAudioPrefs();
  }
  audio.releaseEntry();
  audio.restartBoot();
  const fade = motionActive("boot") ? 600 : 0;
  bootStart = performance.now() / 1000 - (reviewParams.has("time") ? Number(reviewParams.get("time")) : 1.76);
  if (!reviewParams.has("time")) bootStart += fade / 1000;
  setMode("boot");
  if (reviewParams.get("scene") === "archive" || (!motionActive("boot") && !reviewParams.has("time"))) setMode("archive");
  if (reviewParams.get("scene") === "detail") setMode("detail");
  if (new URL(location.href).searchParams.has("post")) applyPostRoute();
  $("#stage").inert = false;
  $(".mobile-entry").inert = false;
  loading.classList.add("loaded");
  loading.inert = true;
  setTimeout(() => {
    const restoreFocus = loading.contains(document.activeElement) || document.activeElement === document.body;
    loading.remove();
    if (entry && restoreFocus) {
      const skip = $("#skip");
      const target = mode === "boot" ? skip.getClientRects().length ? skip : $(".mobile-entry") : $(".read-file");
      target.focus({ preventScroll: true });
    }
  }, fade);
  requestAnimationFrame(frame);
  // Do not compete with entry audio/font downloads. Full offline installation
  // begins after startup is complete and remains atomic.
  setTimeout(() => void initPwa(notify), 1500);
}
updateSelection();
void start();
// Deterministic review controls: the running application, never a video surrogate.
Object.assign(window, {
  rhine: {
    // The review button supplies a real user activation. Preferences stay local to this preview.
    playBootPreview: async (music = false) => {
      if (!ready || !navigator.userActivation.isActive) return false;
      const request = ++audioPreviewRequest;
      audioPreview = true;
      audio.configure({ ...prefs, sound: true, music });
      const unlocked = await audio.unlock();
      if (request !== audioPreviewRequest) return false;
      if (!unlocked) {
        audioPreview = false;
        audio.configure(prefs);
        return false;
      }
      replayBoot(true);
      return true;
    },
    seek: (t: number) => {
      setMode("boot");
      bootStart = performance.now() / 1000 - t;
      lastStep = "";
    },
    archive: () => setMode("archive", false),
    detail: () => openFile(),
    select: (i: number) => select(i),
    stats: () => ({
      ...scene?.getStats(),
      fps: Math.round(fps),
      mode,
      ready,
      startup: started ? "started" : entry?.phase ?? "loading",
      motion: { reduced: motionIsReduced(), preset: prefs.motionPreset },
      bootTime: mode === "boot" ? started ? (frozenTime ?? performance.now() / 1000 - bootStart) + 5 : 6.76 : null,
      selected: records[selected].id,
      saved: [...saved],
      audio: audio.stats(),
    }),
  },
});
if (import.meta.hot) import.meta.hot.dispose(() => audio.dispose());

window.addEventListener("reader-open", () => {
  audio.play("page-open");
  try {
    sessionStorage.setItem("reader-detail-return", JSON.stringify({ slug: records[selected].slug, tab: activeTab, scroll: $("#detail-content").scrollTop }));
  } catch { /* Private browsing may disable storage. */ }
});
