const { resolvePointWithSnaps } = window.PlanScaleSnap;
const { renderSegmentsPanel } = window.PlanScaleSegmentsPanel;
const canvas = document.querySelector("#planCanvas");
const wrap = document.querySelector("#canvasWrap");
const appShell = document.querySelector(".app-shell");
const ctx = canvas.getContext("2d");

const imageInput = document.querySelector("#imageInput");
const removeUnderlayButton = document.querySelector("#removeUnderlayButton");
const resetPlanButton = document.querySelector("#resetPlanButton");
const fitButton = document.querySelector("#fitButton");
const drawSegmentButton = document.querySelector("#drawSegmentButton");
const reanalyzeButton = document.querySelector("#reanalyzeButton");
const sidebarToggleButton = document.querySelector("#sidebarToggleButton");
const sidebarCloseButton = document.querySelector("#sidebarCloseButton");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const clearButton = document.querySelector("#clearButton");
const toggleAllFootnotesButton = document.querySelector("#toggleAllFootnotesButton");
const copyButton = document.querySelector("#copyButton");
const toggleSegmentsButton = document.querySelector("#toggleSegmentsButton");
const statusText = document.querySelector("#statusText");
const exportStatus = document.querySelector("#exportStatus");
const emptyState = document.querySelector("#emptyState");
const segmentSection = document.querySelector("#segmentSection");
const segmentsList = document.querySelector("#segmentsList");
const noSegments = document.querySelector("#noSegments");
const resultOutput = document.querySelector("#resultOutput");
const panelSummary = document.querySelector("#panelSummary");
const smartGridToggle = document.querySelector("#smartGridToggle");
const referenceLengthInput = document.querySelector("#referenceLengthInput");
const unitInput = document.querySelector("#unitInput");
const exportMenuButton = document.querySelector("#exportMenuButton");
const exportMenu = document.querySelector("#exportMenu");
const exportPngButton = document.querySelector("#exportPngButton");
const exportPngBgButton = document.querySelector("#exportPngBgButton");
const exportPdfButton = document.querySelector("#exportPdfButton");
const exportPdfBgButton = document.querySelector("#exportPdfBgButton");
const exportSvgButton = document.querySelector("#exportSvgButton");
const exportCsvButton = document.querySelector("#exportCsvButton");
const exportJsonButton = document.querySelector("#exportJsonButton");
const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
const welcomeOverlay = document.querySelector("#welcomeOverlay");
const welcomeStartButton = document.querySelector("#welcomeStartButton");
const emptyUploadButton = document.querySelector("#emptyUploadButton");
const cursorCoordinates = document.querySelector("#cursorCoordinates");
const analysisReview = document.querySelector("#analysisReview");
const analysisReviewText = document.querySelector("#analysisReviewText");
const acceptDetectedButton = document.querySelector("#acceptDetectedButton");
const addDetectedButton = document.querySelector("#addDetectedButton");
const cancelDetectedButton = document.querySelector("#cancelDetectedButton");
const calibrationHint = document.querySelector("#calibrationHint");
const calibrationHintTitle = document.querySelector("#calibrationHintTitle");
const calibrationHintText = document.querySelector("#calibrationHintText");
const focusReferenceButton = document.querySelector("#focusReferenceButton");
const baseConfirm = document.querySelector("#baseConfirm");
const baseConfirmText = document.querySelector("#baseConfirmText");
const confirmBaseButton = document.querySelector("#confirmBaseButton");
const cancelBaseButton = document.querySelector("#cancelBaseButton");
const referenceField = referenceLengthInput.closest(".toolbar-field");
const segmentContextMenu = document.querySelector("#segmentContextMenu");
const focusBaseInputButton = document.querySelector("#focusBaseInputButton");
const chooseBaseButton = document.querySelector("#chooseBaseButton");
const baseSegmentName = document.querySelector("#baseSegmentName");
const baseSegmentMeta = document.querySelector("#baseSegmentMeta");
const segmentsSortSelect = document.querySelector("#segmentsSortSelect");

const CANVAS_COLORS = {
  selected: "#2563eb",
  reference: "#0f8f73",
  normal: "#4f6f8f",
  angle: "#7768c8",
  detected: "#6475d9",
  leader: "rgba(79, 97, 120, 0.44)",
};

const state = {
  image: null,
  imageSrc: "",
  imageName: "",
  backgroundVisible: true,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  segments: [],
  referenceId: null,
  selectedSegmentIds: new Set(),
  referenceValue: "",
  unit: unitInput.value || "м",
  footnotesVisible: true,
  pendingPoint: null,
  isDragging: false,
  dragStart: null,
  didDrag: false,
  interactionMode: null,
  selectionBox: null,
  labelBounds: new Map(),
  snapPoint: null,
  previewPoint: null,
  orthogonalGuide: null,
  alignmentGuide: null,
  rightAngleHints: [],
  rightAngleIds: new Set(),
  detectedSegments: [],
  smartGridEnabled: false,
  isDrawingSegments: false,
  isChoosingBase: false,
  sidebarCollapsed: true,
  isSpacePressed: false,
  isAnalyzing: false,
  hoveredSegmentId: null,
  pendingReferenceId: null,
  lastPointerUpAt: 0,
};

let nextSegmentId = 1;
let analysisRunId = 0;
let activeContextSegmentId = null;
let resizeTimer = 0;
const MAX_AUTO_SEGMENTS = 150;
const STORAGE_KEY = "planscale-state-v4";
const VIEW_SAVE_DELAY = 220;
const MIN_VIEW_SCALE = 0.05;
const MAX_VIEW_SCALE = 12;
const TOUCH_LONG_PRESS_MS = 560;
const TOUCH_ENDPOINT_HIT_RADIUS = 44;
const TOUCH_ENDPOINT_DRAG_OFFSET = 42;
const historyState = {
  undo: [],
  redo: [],
  restoring: false,
};
let viewSaveTimer = 0;
const activePointers = new Map();
let pinchGesture = null;
let longPressTimer = 0;
let longPressSegment = null;
let touchContextMenuOpened = false;

function setUnitInputValue(value) {
  const unit = value || "м";
  const hasUnitOption = unitInput instanceof HTMLSelectElement
    && Array.from(unitInput.options).some((option) => option.value === unit);
  if (unitInput instanceof HTMLSelectElement && !hasUnitOption) {
    unitInput.add(new Option(unit, unit));
  }
  unitInput.value = unit;
  return unitInput.value || unit;
}

function clonePoint(point) {
  return point ? { x: point.x, y: point.y } : null;
}

function cloneSegment(segment) {
  return {
    id: segment.id,
    name: segment.name,
    start: clonePoint(segment.start),
    end: clonePoint(segment.end),
    labelOffset: segment.labelOffset ? { ...segment.labelOffset } : null,
    labelHidden: Boolean(segment.labelHidden),
  };
}

function snapshotState() {
  return {
    imageSrc: state.imageSrc,
    imageName: state.imageName,
    backgroundVisible: state.backgroundVisible,
    scale: state.scale,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    segments: state.segments.map(cloneSegment),
    referenceId: state.referenceId,
    selectedSegmentIds: getSelectedIds(),
    referenceValue: state.referenceValue,
    unit: state.unit,
    footnotesVisible: state.footnotesVisible,
    smartGridEnabled: state.smartGridEnabled,
    isDrawingSegments: state.isDrawingSegments,
    isChoosingBase: state.isChoosingBase,
    nextSegmentId,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = src;
  });
}

async function applySnapshot(snapshot) {
  historyState.restoring = true;
  try {
    const imageChanged = snapshot.imageSrc !== state.imageSrc;
    state.imageSrc = snapshot.imageSrc || "";
    state.imageName = snapshot.imageName || "";
    state.backgroundVisible = snapshot.backgroundVisible ?? true;
    state.image = imageChanged ? await loadImage(state.imageSrc) : state.image;
    if (!state.imageSrc) {
      state.image = null;
    }
    state.scale = snapshot.scale || 1;
    state.offsetX = snapshot.offsetX || 0;
    state.offsetY = snapshot.offsetY || 0;
    state.segments = (snapshot.segments || []).map((segment) => ({
      ...cloneSegment(segment),
      labelOffset: segment.labelOffset ? { ...segment.labelOffset } : null,
    }));
    state.referenceId = snapshot.referenceId ?? null;
    state.selectedSegmentIds = new Set(snapshot.selectedSegmentIds || []);
    state.referenceValue = snapshot.referenceValue || "";
    state.unit = snapshot.unit || "м";
    state.footnotesVisible = typeof snapshot.footnotesVisible === "boolean"
      ? snapshot.footnotesVisible
      : state.segments.length === 0 || state.segments.some((segment) => segment.labelHidden !== true);
    state.pendingPoint = null;
    state.selectionBox = null;
    state.snapPoint = null;
    state.previewPoint = null;
    state.orthogonalGuide = null;
    state.alignmentGuide = null;
    state.rightAngleHints = [];
    state.rightAngleIds = new Set();
    state.detectedSegments = [];
    state.smartGridEnabled = Boolean(snapshot.smartGridEnabled);
    state.isDrawingSegments = Boolean(snapshot.isDrawingSegments);
    state.isChoosingBase = Boolean(snapshot.isChoosingBase);
    state.isSpacePressed = false;
    state.isAnalyzing = false;
    state.hoveredSegmentId = null;
    state.pendingReferenceId = null;
    nextSegmentId = snapshot.nextSegmentId || Math.max(1, ...state.segments.map((segment) => segment.id + 1), 1);

    referenceLengthInput.value = state.referenceValue;
    setUnitInputValue(state.unit);
    smartGridToggle.checked = state.smartGridEnabled;
    updateToolControls();
    emptyState.hidden = Boolean(state.image);
    updateAll();
  } finally {
    historyState.restoring = false;
  }
}

function saveSnapshotToStorage(snapshot = snapshotState()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Large uploaded plans can exceed localStorage. The editor still works without persistence.
  }
}

function encodeBase64Json(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeBase64Json(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

function restoreSharedStateFromHash() {
  const match = window.location.hash.slice(1).match(/(?:^|&)state=([^&]+)/);
  if (!match) return false;

  try {
    const payload = decodeBase64Json(match[1]);
    state.segments = (payload.segments || []).map((item, index) => ({
      id: Number(item.id) || index + 1,
      name: String(item.name || `Отрезок ${index + 1}`),
      start: { x: Number(item.startX), y: Number(item.startY) },
      end: { x: Number(item.endX), y: Number(item.endY) },
      labelHidden: item.labelHidden === true || item.footnoteVisible === false,
    })).filter((segment) => (
      Number.isFinite(segment.start.x) &&
      Number.isFinite(segment.start.y) &&
      Number.isFinite(segment.end.x) &&
      Number.isFinite(segment.end.y)
    ));
    state.referenceId = payload.baseSegmentId ?? state.segments[0]?.id ?? null;
    state.referenceValue = payload.baseValue ? String(payload.baseValue).replace(".", ",") : "";
    state.unit = payload.unit || state.unit || "м";
    state.footnotesVisible = typeof payload.footnotesVisible === "boolean"
      ? payload.footnotesVisible
      : state.segments.length === 0 || state.segments.some((segment) => segment.labelHidden !== true);
    state.selectedSegmentIds = new Set(state.referenceId ? [state.referenceId] : []);
    state.isChoosingBase = !state.referenceId && state.segments.length > 0;
    nextSegmentId = Math.max(1, ...state.segments.map((segment) => segment.id + 1), 1);
    referenceLengthInput.value = state.referenceValue;
    setUnitInputValue(state.unit);
    return true;
  } catch {
    return false;
  }
}

function scheduleViewSave() {
  window.clearTimeout(viewSaveTimer);
  viewSaveTimer = window.setTimeout(() => {
    saveSnapshotToStorage();
  }, VIEW_SAVE_DELAY);
}

function updateHistoryButtons() {
  const hasImage = Boolean(state.image);
  const hasSegments = state.segments.length > 0;
  const hasDetected = state.detectedSegments.length > 0;
  const hasSelection = state.selectedSegmentIds.size > 0;
  undoButton.disabled = historyState.undo.length <= 1;
  redoButton.disabled = historyState.redo.length === 0;
  removeUnderlayButton.disabled = !hasImage;
  resetPlanButton.disabled = !hasImage && !hasSegments && !hasDetected;
  fitButton.disabled = !hasImage;
  drawSegmentButton.disabled = !hasImage;
  reanalyzeButton.disabled = !hasImage || state.isAnalyzing;
  exportMenuButton.disabled = !hasImage;
  clearButton.disabled = !hasSelection;
  clearButton.title = hasSelection
    ? "Удалить выбранный отрезок"
    : "Сначала выберите отрезок";
  clearButton.setAttribute("aria-label", clearButton.title);
  if (toggleAllFootnotesButton) {
    toggleAllFootnotesButton.disabled = !hasSegments;
  }
  copyButton.disabled = !hasSegments;
  if (!hasImage) {
    setExportMenuOpen(false);
  }
}

function updateToolControls() {
  if (!state.image && state.isDrawingSegments) {
    state.isDrawingSegments = false;
  }
  drawSegmentButton.setAttribute("aria-pressed", String(state.isDrawingSegments));
  reanalyzeButton.classList.toggle("is-loading", state.isAnalyzing);
  reanalyzeButton.setAttribute("aria-busy", String(state.isAnalyzing));
  canvas.classList.toggle("drawing-mode", state.isDrawingSegments);
  canvas.classList.toggle("choosing-base", state.isChoosingBase);
  canvas.classList.toggle("panning-ready", state.isSpacePressed && Boolean(state.image));
  wrap.classList.toggle("analyzing", state.isAnalyzing);
  wrap.classList.toggle("drawing-active", state.isDrawingSegments && Boolean(state.image));
  document.body.classList.toggle("empty-mode", !state.image && welcomeOverlay.hidden);
  document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  if (!state.image) {
    hideCursorCoordinates();
  }

  const underlayLabel = removeUnderlayButton.querySelector("span");
  if (underlayLabel) {
    underlayLabel.textContent = !state.image
      ? "Подложка"
      : state.backgroundVisible
        ? "Скрыть план"
        : "Показать план";
  }
  removeUnderlayButton.setAttribute("aria-pressed", String(Boolean(state.image && !state.backgroundVisible)));
  removeUnderlayButton.title = !state.image
    ? "Сначала загрузите изображение плана"
    : state.backgroundVisible
      ? "Скрыть загруженную подложку, оставив разметку"
      : "Вернуть загруженную подложку";
  removeUnderlayButton.setAttribute(
    "aria-label",
    !state.image
      ? "Сначала загрузите изображение плана"
      : state.backgroundVisible
        ? "Скрыть подложку"
        : "Показать подложку",
  );

  smartGridToggle.checked = state.smartGridEnabled;
  smartGridToggle.closest(".toolbar-toggle")?.classList.toggle("active", state.smartGridEnabled);

  updateAllFootnotesButtonState();

  const hasBase = Boolean(state.referenceId);
  referenceLengthInput.disabled = !hasBase;
  focusReferenceButton.hidden = !hasBase;
  focusBaseInputButton.disabled = !hasBase;
  chooseBaseButton.disabled = !state.segments.length;
  chooseBaseButton.textContent = hasBase ? "Изменить отрезок" : "Выбрать отрезок";
  sidebarToggleButton.title = state.sidebarCollapsed ? "Показать список отрезков" : "Скрыть список отрезков";
  sidebarToggleButton.setAttribute("aria-label", sidebarToggleButton.title);
}

function updateGuidanceControls() {
  const detectedCount = state.detectedSegments.length;
  analysisReview.hidden = detectedCount === 0;
  if (detectedCount) {
    const hasCurrentMarkup = state.segments.length > 0;
    analysisReviewText.textContent = hasCurrentMarkup
      ? `Найдено ${detectedCount} ${plural(detectedCount, "кандидат", "кандидата", "кандидатов")}. Пунктирные линии еще не сохранены: примите их, добавьте к текущей разметке или отмените.`
      : `Найдено ${detectedCount} ${plural(detectedCount, "кандидат", "кандидата", "кандидатов")}. Пунктирные линии еще не сохранены: примите их или отмените.`;
    addDetectedButton.hidden = !hasCurrentMarkup;
  }

  const needsBase = Boolean(state.image && state.segments.length && !state.referenceId);
  const needsLength = Boolean(state.image && state.segments.length && state.referenceId && parseDecimal(state.referenceValue) === null);
  calibrationHint.hidden = !needsBase && !needsLength;
  if (needsBase) {
    calibrationHintTitle.textContent = "Выберите базовый отрезок";
    calibrationHintText.textContent = "Кликните по известному отрезку на плане или в списке. После выбора появится ввод реальной длины.";
  } else if (needsLength) {
    calibrationHintTitle.textContent = "Введите базовый размер";
    calibrationHintText.textContent = "Введите реальную длину выбранного базового отрезка, чтобы пересчитать остальные размеры.";
  }
  referenceField?.classList.toggle("needs-attention", needsBase || needsLength);
  referenceLengthInput.setAttribute("aria-invalid", String(needsLength && state.referenceValue.trim().length > 0));
  if (baseConfirm) {
    baseConfirm.hidden = !state.pendingReferenceId;
  }
}

function commitHistory() {
  if (historyState.restoring) return;

  const snapshot = snapshotState();
  const previous = historyState.undo[historyState.undo.length - 1];
  const serialized = JSON.stringify(snapshot);
  if (!previous || JSON.stringify(previous) !== serialized) {
    historyState.undo.push(snapshot);
    historyState.redo = [];
  }
  saveSnapshotToStorage(snapshot);
  updateHistoryButtons();
}

async function undoHistory() {
  if (historyState.undo.length <= 1) return;
  const current = historyState.undo.pop();
  historyState.redo.push(current);
  await applySnapshot(historyState.undo[historyState.undo.length - 1]);
  saveSnapshotToStorage();
  updateHistoryButtons();
}

async function redoHistory() {
  const snapshot = historyState.redo.pop();
  if (!snapshot) return;
  historyState.undo.push(snapshot);
  await applySnapshot(snapshot);
  saveSnapshotToStorage();
  updateHistoryButtons();
}

async function restoreSavedState() {
  if (restoreSharedStateFromHash()) {
    updateAll();
    commitHistory();
    showToast("Разметка из ссылки загружена. Теперь добавьте тот же план.");
    return;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    updateAll();
    commitHistory();
    return;
  }

  try {
    const snapshot = JSON.parse(raw);
    await applySnapshot(snapshot);
    historyState.undo = [snapshotState()];
    historyState.redo = [];
    updateHistoryButtons();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    updateAll();
    commitHistory();
  }
}

function syncCanvasHeightToViewport() {
  if (!appShell || !wrap) return;

  const shellStyle = window.getComputedStyle(appShell);
  const paddingBottom = Number.parseFloat(shellStyle.paddingBottom) || 0;
  const rect = wrap.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const isCompact = window.matchMedia("(max-width: 760px)").matches;
  const minHeight = isCompact ? 140 : 280;
  const availableHeight = viewportHeight - rect.top - paddingBottom;
  wrap.style.height = `${Math.max(minHeight, Math.floor(availableHeight))}px`;
}

function resizeCanvas() {
  syncCanvasHeightToViewport();
  const ratio = window.devicePixelRatio || 1;
  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function syncCanvasAfterLayout({ fit = false } = {}) {
  resizeCanvas();
  if (fit && state.image) {
    fitImage();
  }
}

function fitImage() {
  if (!state.image) return;

  const rect = wrap.getBoundingClientRect();
  const padding = 36;
  const usableWidth = Math.max(1, rect.width - padding * 2);
  const usableHeight = Math.max(1, rect.height - padding * 2);
  state.scale = Math.min(usableWidth / state.image.width, usableHeight / state.image.height);
  state.offsetX = (rect.width - state.image.width * state.scale) / 2;
  state.offsetY = (rect.height - state.image.height * state.scale) / 2;
  draw();
}

function normalizedWheelDelta(value, deltaMode) {
  if (deltaMode === 1) return value * 16;
  if (deltaMode === 2) return value * wrap.getBoundingClientRect().height;
  return value;
}

function clampViewScale(scale) {
  return Math.min(Math.max(scale, MIN_VIEW_SCALE), MAX_VIEW_SCALE);
}

function zoomAtClientPoint(clientX, clientY, factor) {
  const screen = screenPointFromClient(clientX, clientY);
  const before = screenToImage(clientX, clientY);
  state.scale = clampViewScale(state.scale * factor);
  state.offsetX = screen.x - before.x * state.scale;
  state.offsetY = screen.y - before.y * state.scale;
}

function pointerPairMetrics() {
  const pointers = Array.from(activePointers.values()).slice(0, 2);
  if (pointers.length < 2) return null;
  const [first, second] = pointers;
  const center = {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
  return {
    center,
    distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
  };
}

function clearLongPressTimer() {
  window.clearTimeout(longPressTimer);
  longPressTimer = 0;
  longPressSegment = null;
}

function resetTransientGestureState(mode = null) {
  state.isDragging = false;
  state.dragStart = null;
  state.didDrag = false;
  state.interactionMode = mode;
  state.selectionBox = null;
  state.snapPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  canvas.classList.remove("dragging");
}

function safeSetPointerCapture(pointerId) {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Some mobile WebViews can reject capture while still delivering pointer events.
  }
}

function safeReleasePointerCapture(pointerId) {
  try {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  } catch {
    // Pointer capture may already be gone after touch cancellation.
  }
}

function startPinchGesture() {
  const metrics = pointerPairMetrics();
  if (!metrics || metrics.distance < 1) return;
  pinchGesture = {
    distance: metrics.distance,
  };
  clearLongPressTimer();
  resetTransientGestureState("pinch");
}

function updatePointerFromEvent(event) {
  if (event.pointerType !== "touch") return;
  activePointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  });
}

function removePointerFromEvent(event) {
  if (event.pointerType !== "touch") return;
  activePointers.delete(event.pointerId);
  if (activePointers.size < 2) {
    pinchGesture = null;
  }
}

function scheduleTouchContextMenu(segment, event) {
  clearLongPressTimer();
  if (!segment || event.pointerType !== "touch" || state.isDrawingSegments || state.isChoosingBase) return;
  const { clientX, clientY } = event;
  longPressSegment = segment;
  longPressTimer = window.setTimeout(() => {
    if (!longPressSegment || activePointers.size > 1) return;
    selectOnlySegment(longPressSegment.id);
    resetTransientGestureState(null);
    touchContextMenuOpened = true;
    updateAll();
    showSegmentContextMenu(longPressSegment, clientX, clientY);
    longPressSegment = null;
  }, TOUCH_LONG_PRESS_MS);
}

function canvasLogicalSize() {
  const ratio = window.devicePixelRatio || 1;
  return {
    width: canvas.width / ratio,
    height: canvas.height / ratio,
  };
}

function screenPointFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const logical = canvasLogicalSize();
  const scaleX = rect.width ? logical.width / rect.width : 1;
  const scaleY = rect.height ? logical.height / rect.height : 1;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function screenToImage(clientX, clientY) {
  const point = screenPointFromClient(clientX, clientY);
  return {
    x: (point.x - state.offsetX) / state.scale,
    y: (point.y - state.offsetY) / state.scale,
  };
}

function updateCursorCoordinates(clientX, clientY) {
  if (!cursorCoordinates || !state.image || !welcomeOverlay.hidden) {
    hideCursorCoordinates();
    return;
  }

  const point = screenToImage(clientX, clientY);
  const isInsideImage = point.x >= 0 && point.x <= state.image.width && point.y >= 0 && point.y <= state.image.height;
  cursorCoordinates.hidden = !isInsideImage;
  if (isInsideImage) {
    cursorCoordinates.textContent = `x ${formatDecimal(point.x)} · y ${formatDecimal(point.y)}`;
  }
}

function hideCursorCoordinates() {
  if (cursorCoordinates) {
    cursorCoordinates.hidden = true;
  }
}

function imageToScreen(point) {
  return {
    x: point.x * state.scale + state.offsetX,
    y: point.y * state.scale + state.offsetY,
  };
}

function clampPointToImage(point) {
  if (!state.image) return point;
  return {
    x: Math.min(Math.max(point.x, 0), state.image.width),
    y: Math.min(Math.max(point.y, 0), state.image.height),
  };
}

function segmentLength(segment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  return Math.hypot(dx, dy);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function findSegmentAt(clientX, clientY, tolerance = isCoarsePointer() ? 30 : 18) {
  const point = screenPointFromClient(clientX, clientY);
  let closest = null;
  let closestDistance = Infinity;

  for (const segment of state.segments) {
    const start = imageToScreen(segment.start);
    const end = imageToScreen(segment.end);
    const distance = distanceToSegment(point, start, end);

    if (distance < closestDistance) {
      closestDistance = distance;
      closest = segment;
    }
  }

  return closestDistance <= tolerance ? closest : null;
}

function findLabelAt(clientX, clientY) {
  const point = screenPointFromClient(clientX, clientY);

  for (const [id, rect] of state.labelBounds.entries()) {
    if (pointInsideRect(point, rect)) {
      return state.segments.find((segment) => segment.id === id) ?? null;
    }
  }

  return null;
}

function findEndpointAt(clientX, clientY) {
  const point = screenPointFromClient(clientX, clientY);
  let closest = null;
  let closestDistance = Infinity;
  const hitRadius = isCoarsePointer() ? TOUCH_ENDPOINT_HIT_RADIUS : 16;

  for (const segment of state.segments) {
    if (!isSegmentSelected(segment)) continue;

    for (const endpoint of ["start", "end"]) {
      const screen = imageToScreen(segment[endpoint]);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = { segment, endpoint };
      }
    }
  }

  return closestDistance <= hitRadius ? closest : null;
}

function findSnapPoint(imagePoint, segmentId) {
  const screen = imageToScreen(imagePoint);
  let closest = null;
  let closestDistance = Infinity;

  for (const segment of state.segments) {
    if (segment.id === segmentId) continue;

    for (const endpoint of ["start", "end"]) {
      const endpointScreen = imageToScreen(segment[endpoint]);
      const distance = Math.hypot(screen.x - endpointScreen.x, screen.y - endpointScreen.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = {
          point: { ...segment[endpoint] },
          screen: endpointScreen,
        };
      }
    }
  }

  return closestDistance <= 16 ? closest : null;
}

function findOrthogonalSnapPoint(point, anchor, axis, segmentId) {
  if (!state.smartGridEnabled || !axis || !anchor) return null;

  const screen = imageToScreen(point);
  const snapTolerance = 15;
  const lineTolerance = 7;
  let closest = null;
  let closestDistance = Infinity;

  for (const segment of state.segments) {
    if (segment.id === segmentId) continue;

    for (const endpointName of ["start", "end"]) {
      const candidate = segment[endpointName];
      const candidateScreen = imageToScreen(candidate);
      const projected = axis === "horizontal"
        ? { x: candidate.x, y: anchor.y }
        : { x: anchor.x, y: candidate.y };
      const projectedScreen = imageToScreen(projected);
      const distance = axis === "horizontal"
        ? Math.abs(screen.x - projectedScreen.x)
        : Math.abs(screen.y - projectedScreen.y);
      const lineDistance = axis === "horizontal"
        ? Math.abs(candidateScreen.y - imageToScreen(anchor).y)
        : Math.abs(candidateScreen.x - imageToScreen(anchor).x);

      if (distance < closestDistance && distance <= snapTolerance) {
        closestDistance = distance;
        closest = {
          point: projected,
          screen: projectedScreen,
          guide: {
            from: { ...candidate },
            to: projected,
            axis: axis === "horizontal" ? "vertical" : "horizontal",
            exactEndpoint: lineDistance <= lineTolerance,
          },
        };
      }
    }
  }

  return closest;
}

function resolveEndpointPoint(rawPoint, fixedEndpoint, segmentId) {
  const resolved = resolvePointWithSnaps({
    rawPoint,
    fixedEndpoint,
    segmentId,
    segments: state.segments,
    scale: state.scale,
    smartGridEnabled: state.smartGridEnabled,
  });

  if (resolved.snap?.point && !resolved.snap.screen) {
    resolved.snap.screen = imageToScreen(resolved.snap.point);
  }

  return resolved;
}

function smartGridPoint(point, anchor) {
  if (!state.smartGridEnabled || !anchor) {
    return { point, snapped: false, axis: null };
  }

  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const dominant = Math.max(absDx, absDy);
  const pixelTolerance = 10 / Math.max(state.scale, 0.001);

  if (dominant < pixelTolerance) {
    return { point, snapped: false, axis: null };
  }

  if (absDx >= absDy) {
    return { point: { x: point.x, y: anchor.y }, snapped: true, axis: "horizontal" };
  }

  return { point: { x: anchor.x, y: point.y }, snapped: true, axis: "vertical" };
}

function buildOrthogonalGuide(anchor, point, axis) {
  if (!axis) return null;
  return {
    axis,
    anchor: clonePoint(anchor),
    point: clonePoint(point),
  };
}

function sharedEndpoint(a, b, tolerance = 4) {
  const endpointsA = [a.start, a.end];
  const endpointsB = [b.start, b.end];
  const threshold = tolerance / Math.max(state.scale, 0.001);

  for (const pointA of endpointsA) {
    for (const pointB of endpointsB) {
      if (Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y) <= threshold) {
        return {
          x: (pointA.x + pointB.x) / 2,
          y: (pointA.y + pointB.y) / 2,
        };
      }
    }
  }

  return null;
}

function vectorAwayFromJoint(segment, joint) {
  const distanceToStart = Math.hypot(segment.start.x - joint.x, segment.start.y - joint.y);
  const distanceToEnd = Math.hypot(segment.end.x - joint.x, segment.end.y - joint.y);
  const far = distanceToStart > distanceToEnd ? segment.start : segment.end;
  return {
    x: far.x - joint.x,
    y: far.y - joint.y,
  };
}

function isRightAngle(vectorA, vectorB) {
  const lengthA = Math.hypot(vectorA.x, vectorA.y);
  const lengthB = Math.hypot(vectorB.x, vectorB.y);
  if (!lengthA || !lengthB) return false;
  const cosine = Math.abs((vectorA.x * vectorB.x + vectorA.y * vectorB.y) / (lengthA * lengthB));
  return cosine < 0.08;
}

function isGridAlignedSegment(segment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return false;

  const axisError = Math.min(Math.abs(dx), Math.abs(dy));
  const tolerance = Math.max(1, length * 0.015);
  return axisError <= tolerance;
}

function computeRightAngleHints() {
  const hints = [];
  const ids = new Set();

  for (let i = 0; i < state.segments.length; i++) {
    for (let j = i + 1; j < state.segments.length; j++) {
      const first = state.segments[i];
      const second = state.segments[j];
      const joint = sharedEndpoint(first, second);
      if (!joint) continue;

      const vectorA = vectorAwayFromJoint(first, joint);
      const vectorB = vectorAwayFromJoint(second, joint);
      if (!isRightAngle(vectorA, vectorB)) continue;

      ids.add(first.id);
      ids.add(second.id);
      hints.push({ joint, vectorA, vectorB, ids: [first.id, second.id] });
    }
  }

  return { hints, ids };
}

function isSegmentSelected(segment) {
  return state.selectedSegmentIds.has(segment.id);
}

function isCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function selectOnlySegment(id) {
  state.selectedSegmentIds = id === null ? new Set() : new Set([id]);
}

function selectSegments(ids) {
  state.selectedSegmentIds = new Set(ids);
}

function toggleSegmentSelection(id) {
  const selected = new Set(state.selectedSegmentIds);
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }
  state.selectedSegmentIds = selected;
}

function clearSelection() {
  state.selectedSegmentIds = new Set();
}

function adjustedEndpointDragPoint(event) {
  if (event.pointerType !== "touch") {
    return { x: event.clientX, y: event.clientY };
  }
  return {
    x: event.clientX,
    y: event.clientY - TOUCH_ENDPOINT_DRAG_OFFSET,
  };
}

function startChoosingBase() {
  if (!state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }
  state.isChoosingBase = true;
  state.pendingReferenceId = null;
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  clearSelection();
  updateAll();
  showToast("Кликните по базовому отрезку");
}

function setReferenceSegment(id, { focusLength = true } = {}) {
  state.referenceId = id;
  state.isChoosingBase = false;
  state.pendingReferenceId = null;
  selectOnlySegment(id);
  state.pendingPoint = null;
  hideBaseConfirmation();
  updateAll();
  commitHistory();
  if (focusLength) {
    referenceLengthInput.focus();
    referenceLengthInput.select();
  }
}

function hideBaseConfirmation() {
  state.pendingReferenceId = null;
  if (baseConfirm) {
    baseConfirm.hidden = true;
  }
}

function requestReferenceConfirmation(id) {
  const segment = state.segments.find((item) => item.id === id);
  if (!segment || !baseConfirm) return false;

  state.pendingReferenceId = id;
  selectOnlySegment(id);
  baseConfirmText.textContent = `${segment.name}: подтвердите выбор базового отрезка.`;
  baseConfirm.hidden = false;
  updateAll();
  return true;
}

function handleSegmentPick(id, { requireConfirmation = false } = {}) {
  if (state.isChoosingBase || !state.referenceId) {
    if (requireConfirmation && requestReferenceConfirmation(id)) {
      showToast("Подтвердите базовый отрезок");
      return true;
    }
    setReferenceSegment(id, { focusLength: !isCoarsePointer() });
    showToast("Теперь введите базовый размер");
    return true;
  }
  return false;
}

function confirmPendingReference() {
  const id = state.pendingReferenceId;
  if (!id) return;
  setReferenceSegment(id, { focusLength: !isCoarsePointer() });
  showToast("Теперь введите базовый размер");
}

function getSelectedIds() {
  return [...state.selectedSegmentIds];
}

function normalizedRect(start, end) {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

function pointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function orientation(a, b, c) {
  return Math.sign((b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y));
}

function lineSegmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

function segmentIntersectsRect(segment, rect) {
  const start = imageToScreen(segment.start);
  const end = imageToScreen(segment.end);
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  if (pointInsideRect(start, rect) || pointInsideRect(end, rect) || pointInsideRect(midpoint, rect)) {
    return true;
  }

  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomRight = { x: rect.right, y: rect.bottom };
  const bottomLeft = { x: rect.left, y: rect.bottom };

  return (
    lineSegmentsIntersect(start, end, topLeft, topRight) ||
    lineSegmentsIntersect(start, end, topRight, bottomRight) ||
    lineSegmentsIntersect(start, end, bottomRight, bottomLeft) ||
    lineSegmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

function segmentIdsInsideSelectionBox() {
  if (!state.selectionBox) return [];
  const rect = normalizedRect(state.selectionBox.start, state.selectionBox.end);
  return state.segments
    .filter((segment) => segmentIntersectsRect(segment, rect))
    .map((segment) => segment.id);
}

function getReferenceLength() {
  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  return reference ? segmentLength(reference) : 0;
}

function ratioFor(segment) {
  const referenceLength = getReferenceLength();
  if (!referenceLength) return null;
  return segmentLength(segment) / referenceLength;
}

function parseDecimal(value) {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function formatDecimal(value) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(3).replace(".", ",");
}

function calculatedLengthFor(segment) {
  const ratio = ratioFor(segment);
  const referenceValue = parseDecimal(state.referenceValue);
  if (ratio === null || referenceValue === null) return null;
  return ratio * referenceValue;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function otsuThreshold(grayscale) {
  const histogram = new Array(256).fill(0);
  for (const value of grayscale) {
    histogram[value]++;
  }

  const total = grayscale.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i];
    if (!weightBackground) continue;

    const weightForeground = total - weightBackground;
    if (!weightForeground) break;

    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return Math.min(200, Math.max(70, threshold));
}

function collectRuns(binary, width, height, horizontal, minRun) {
  const runs = [];
  const primarySize = horizontal ? height : width;
  const secondarySize = horizontal ? width : height;

  for (let primary = 0; primary < primarySize; primary++) {
    let secondary = 0;
    while (secondary < secondarySize) {
      while (secondary < secondarySize) {
        const index = horizontal ? primary * width + secondary : secondary * width + primary;
        if (binary[index]) break;
        secondary++;
      }

      const start = secondary;
      while (secondary < secondarySize) {
        const index = horizontal ? primary * width + secondary : secondary * width + primary;
        if (!binary[index]) break;
        secondary++;
      }

      const end = secondary - 1;
      if (end - start + 1 >= minRun) {
        runs.push({ start, end, axis: primary });
      }
    }
  }

  return runs;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart) + 1);
}

function mergeRuns(runs, axisTolerance) {
  const groups = [];

  for (const run of runs) {
    let bestGroup = null;
    let bestOverlap = 0;
    const runLength = run.end - run.start + 1;

    for (const group of groups) {
      if (run.axis > group.maxAxis + axisTolerance) continue;
      if (run.axis < group.minAxis - axisTolerance) continue;

      const groupStart = median(group.starts);
      const groupEnd = median(group.ends);
      const groupLength = groupEnd - groupStart + 1;
      const overlap = rangesOverlap(run.start, run.end, groupStart, groupEnd);
      const overlapRatio = overlap / Math.min(runLength, groupLength);

      if (overlapRatio > 0.45 && overlap > bestOverlap) {
        bestGroup = group;
        bestOverlap = overlap;
      }
    }

    if (!bestGroup) {
      groups.push({
        minAxis: run.axis,
        maxAxis: run.axis,
        starts: [run.start],
        ends: [run.end],
      });
      continue;
    }

    bestGroup.minAxis = Math.min(bestGroup.minAxis, run.axis);
    bestGroup.maxAxis = Math.max(bestGroup.maxAxis, run.axis);
    bestGroup.starts.push(run.start);
    bestGroup.ends.push(run.end);
  }

  return groups;
}

function groupsToSegments(groups, horizontal, minRun, maxThickness, processScale) {
  const segments = [];

  for (const group of groups) {
    const start = median(group.starts);
    const end = median(group.ends);
    const axis = (group.minAxis + group.maxAxis) / 2;
    const length = end - start + 1;
    const thickness = group.maxAxis - group.minAxis + 1;

    if (length < minRun || thickness > maxThickness || length / Math.max(1, thickness) < 4) {
      continue;
    }

    if (horizontal) {
      segments.push({
        start: { x: start / processScale, y: axis / processScale },
        end: { x: end / processScale, y: axis / processScale },
      });
    } else {
      segments.push({
        start: { x: axis / processScale, y: start / processScale },
        end: { x: axis / processScale, y: end / processScale },
      });
    }
  }

  return segments;
}

function areSimilarSegments(a, b) {
  const aHorizontal = Math.abs(a.start.y - a.end.y) <= Math.abs(a.start.x - a.end.x);
  const bHorizontal = Math.abs(b.start.y - b.end.y) <= Math.abs(b.start.x - b.end.x);
  if (aHorizontal !== bHorizontal) return false;

  if (aHorizontal) {
    const yA = (a.start.y + a.end.y) / 2;
    const yB = (b.start.y + b.end.y) / 2;
    if (Math.abs(yA - yB) > 5) return false;
    const overlap = rangesOverlap(
      Math.min(a.start.x, a.end.x),
      Math.max(a.start.x, a.end.x),
      Math.min(b.start.x, b.end.x),
      Math.max(b.start.x, b.end.x),
    );
    return overlap / Math.min(segmentLength(a), segmentLength(b)) > 0.85;
  }

  const xA = (a.start.x + a.end.x) / 2;
  const xB = (b.start.x + b.end.x) / 2;
  if (Math.abs(xA - xB) > 5) return false;
  const overlap = rangesOverlap(
    Math.min(a.start.y, a.end.y),
    Math.max(a.start.y, a.end.y),
    Math.min(b.start.y, b.end.y),
    Math.max(b.start.y, b.end.y),
  );
  return overlap / Math.min(segmentLength(a), segmentLength(b)) > 0.85;
}

function dedupeSegments(segments) {
  const sorted = [...segments].sort((a, b) => segmentLength(b) - segmentLength(a));
  const unique = [];

  for (const segment of sorted) {
    if (!unique.some((existing) => areSimilarSegments(segment, existing))) {
      unique.push(segment);
    }
  }

  return unique;
}

function cloneDetectedSegment(segment) {
  return {
    start: clonePoint(segment.start),
    end: clonePoint(segment.end),
  };
}

function clearDetectedSegments() {
  state.detectedSegments = [];
  cancelAnalysis();
  updateAll();
}

function materializeDetectedSegments(append = false) {
  if (!state.detectedSegments.length) return;

  const detected = state.detectedSegments.map(cloneDetectedSegment);
  if (!append) {
    state.segments = [];
    state.referenceId = null;
    state.referenceValue = "";
    referenceLengthInput.value = "";
    nextSegmentId = 1;
    clearSelection();
  }

  const created = detected.map((segment) => {
    const id = nextSegmentId++;
    return {
      id,
      name: `Отрезок ${id}`,
      start: segment.start,
      end: segment.end,
      labelHidden: !state.footnotesVisible,
    };
  });

  state.segments.push(...created);
  if (!state.referenceId) {
    state.isChoosingBase = true;
    clearSelection();
  } else {
    selectOnlySegment(state.referenceId);
  }
  state.detectedSegments = [];
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  updateAll();
  commitHistory();
  showToast(append ? `Добавлено: ${created.length}` : `Принято: ${created.length}`);
  if (created.length && state.isChoosingBase) {
    showToast("Выберите базовый отрезок");
  }
}

function detectImageSegmentsFromImage() {
  const maxSide = 1400;
  const processScale = Math.min(1, maxSide / Math.max(state.image.width, state.image.height));
  const width = Math.max(1, Math.round(state.image.width * processScale));
  const height = Math.max(1, Math.round(state.image.height * processScale));
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
  offscreenContext.drawImage(state.image, 0, 0, width, height);
  const { data } = offscreenContext.getImageData(0, 0, width, height);

  const grayscale = new Uint8Array(width * height);
  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel++) {
    const alpha = data[i + 3] / 255;
    const luma = Math.round((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * alpha + 255 * (1 - alpha));
    grayscale[pixel] = luma;
  }

  const threshold = otsuThreshold(grayscale);
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < grayscale.length; i++) {
    binary[i] = grayscale[i] < threshold ? 1 : 0;
  }

  const minDimension = Math.min(width, height);
  const minRun = Math.max(24, Math.round(minDimension * 0.035));
  const axisTolerance = Math.max(3, Math.round(minDimension * 0.006));
  const maxThickness = Math.max(10, Math.round(minDimension * 0.035));

  const horizontalGroups = mergeRuns(collectRuns(binary, width, height, true, minRun), axisTolerance);
  const verticalGroups = mergeRuns(collectRuns(binary, width, height, false, minRun), axisTolerance);
  const foundSegments = dedupeSegments([
    ...groupsToSegments(horizontalGroups, true, minRun, maxThickness, processScale),
    ...groupsToSegments(verticalGroups, false, minRun, maxThickness, processScale),
  ]).slice(0, MAX_AUTO_SEGMENTS);

  return foundSegments;
}

function detectImageSegmentsWithWorker() {
  return new Promise((resolve, reject) => {
    const maxSide = 1400;
    const processScale = Math.min(1, maxSide / Math.max(state.image.width, state.image.height));
    const width = Math.max(1, Math.round(state.image.width * processScale));
    const height = Math.max(1, Math.round(state.image.height * processScale));
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
    offscreenContext.drawImage(state.image, 0, 0, width, height);
    const imageData = offscreenContext.getImageData(0, 0, width, height);
    const worker = new Worker("detection-worker.js");

    function cleanup() {
      worker.terminate();
    }

    worker.addEventListener("message", (event) => {
      if (event.data?.type === "result") {
        cleanup();
        resolve(event.data.segments || []);
      }
    });
    worker.addEventListener("error", (event) => {
      cleanup();
      reject(event.error || new Error(event.message));
    });
    worker.postMessage({
      type: "analyze",
      width,
      height,
      processScale,
      maxSegments: MAX_AUTO_SEGMENTS,
      buffer: imageData.data.buffer,
    }, [imageData.data.buffer]);
  });
}

function analyzeImageSegments({ automatic = false } = {}) {
  if (!state.image) {
    showToast("Сначала загрузите план");
    return;
  }

  const runId = ++analysisRunId;
  state.isAnalyzing = true;
  state.detectedSegments = [];
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.isDrawingSegments = false;
  updateAll();

  window.setTimeout(async () => {
    if (runId !== analysisRunId || !state.image) {
      return;
    }

    let foundSegments = [];
    let analysisFailed = false;
    const canUseWorker = typeof Worker !== "undefined" && window.location.protocol !== "file:";
    try {
      foundSegments = canUseWorker
        ? await detectImageSegmentsWithWorker()
        : detectImageSegmentsFromImage();
    } catch {
      if (canUseWorker) {
        try {
          foundSegments = detectImageSegmentsFromImage();
        } catch {
          analysisFailed = true;
        }
      } else {
        analysisFailed = true;
      }
    }

    if (runId !== analysisRunId || !state.image) {
      return;
    }

    state.isAnalyzing = false;
    if (analysisFailed) {
      updateAll();
      showToast("Не удалось выполнить анализ");
      return;
    }

    if (!foundSegments.length) {
      updateAll();
      showToast(automatic ? "Линии не найдены, нарисуйте отрезки вручную" : "Автоотрезки не найдены");
      return;
    }

    state.detectedSegments = foundSegments.map(cloneDetectedSegment);
    state.pendingPoint = null;
    state.previewPoint = null;
    state.orthogonalGuide = null;
    state.isDrawingSegments = false;
    updateAll();
    showToast(`Найдено: ${state.detectedSegments.length}`);
  }, automatic ? 220 : 60);
}

function cancelAnalysis() {
  if (!state.isAnalyzing) {
    return;
  }
  analysisRunId++;
  state.isAnalyzing = false;
  updateAll();
}

function formatLength(value, includeUnit = true) {
  const formatted = formatDecimal(value);
  if (formatted === "—" || !includeUnit || !state.unit.trim()) return formatted;
  return `${formatted} ${state.unit.trim()}`;
}

function rectsIntersect(a, b, padding = 0) {
  return !(
    a.right + padding < b.left ||
    a.left - padding > b.right ||
    a.bottom + padding < b.top ||
    a.top - padding > b.bottom
  );
}

function isSegmentFootnoteVisible(segment) {
  return segment.labelHidden !== true;
}

function visibleFootnoteCount() {
  return state.segments.filter(isSegmentFootnoteVisible).length;
}

function updateAllFootnotesButtonState() {
  if (!toggleAllFootnotesButton) return;

  const hasSegments = state.segments.length > 0;
  const hasVisible = hasSegments ? visibleFootnoteCount() > 0 : state.footnotesVisible;
  toggleAllFootnotesButton.disabled = !hasSegments;
  toggleAllFootnotesButton.classList.toggle("active", hasVisible);
  toggleAllFootnotesButton.setAttribute("aria-pressed", String(hasVisible));
  toggleAllFootnotesButton.title = hasVisible
    ? "Скрыть сноски всех отрезков"
    : "Показать сноски всех отрезков";
  toggleAllFootnotesButton.setAttribute("aria-label", toggleAllFootnotesButton.title);
}

function setSegmentFootnoteVisible(id, visible) {
  const segment = state.segments.find((item) => item.id === id);
  if (!segment) return;

  segment.labelHidden = !visible;
  state.footnotesVisible = visibleFootnoteCount() > 0;
  updateAll();
  commitHistory();
}

function toggleAllFootnotes() {
  if (!state.segments.length) return;

  const shouldShow = visibleFootnoteCount() === 0;
  state.footnotesVisible = shouldShow;
  for (const segment of state.segments) {
    segment.labelHidden = !shouldShow;
  }
  updateAll();
  commitHistory();
}

function labelTextFor(segment) {
  const calculatedLength = calculatedLengthFor(segment);
  if (calculatedLength === null && state.segments.length) {
    return segment.name;
  }
  return formatLength(calculatedLength);
}

function getLabelOffset(segment, labelWidth, labelHeight) {
  if (segment.labelOffset) {
    return segment.labelOffset;
  }

  const candidates = [
    { x: 0, y: -36 },
    { x: 0, y: 36 },
    { x: 48, y: -36 },
    { x: -48, y: -36 },
    { x: 48, y: 36 },
    { x: -48, y: 36 },
    { x: 0, y: -66 },
    { x: 0, y: 66 },
    { x: 90, y: 0 },
    { x: -90, y: 0 },
  ];
  const mid = segmentMidpointScreen(segment);

  for (const offset of candidates) {
    const rect = {
      left: mid.x + offset.x - labelWidth / 2,
      top: mid.y + offset.y - labelHeight / 2,
      right: mid.x + offset.x + labelWidth / 2,
      bottom: mid.y + offset.y + labelHeight / 2,
    };

    if (![...state.labelBounds.values()].some((existing) => rectsIntersect(rect, existing, 5))) {
      return offset;
    }
  }

  return candidates[0];
}

function currentLabelOffset(segment) {
  if (segment.labelOffset) {
    return { ...segment.labelOffset };
  }

  const bounds = state.labelBounds.get(segment.id);
  if (!bounds) {
    return { x: 0, y: -36 };
  }

  const midpoint = segmentMidpointScreen(segment);
  return {
    x: (bounds.left + bounds.right) / 2 - midpoint.x,
    y: (bounds.top + bounds.bottom) / 2 - midpoint.y,
  };
}

function segmentMidpointScreen(segment) {
  const start = imageToScreen(segment.start);
  const end = imageToScreen(segment.end);
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function nearestPointOnRect(point, rect) {
  return {
    x: Math.min(Math.max(point.x, rect.left), rect.right),
    y: Math.min(Math.max(point.y, rect.top), rect.bottom),
  };
}

function drawPoint(point, color, radius = 5) {
  const screen = imageToScreen(point);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fffdfa";
  ctx.stroke();
}

function drawHandle(point, color, radius = 5) {
  const screen = imageToScreen(point);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdfa";
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawSegment(segment) {
  const start = imageToScreen(segment.start);
  const end = imageToScreen(segment.end);
  const isReference = segment.id === state.referenceId;
  const isSelected = isSegmentSelected(segment);
  const isHovered = state.hoveredSegmentId === segment.id;
  const isAngleAligned = state.rightAngleIds.has(segment.id) || isGridAlignedSegment(segment);
  const handleColor = isSelected
    ? CANVAS_COLORS.selected
    : isReference
      ? CANVAS_COLORS.reference
      : isAngleAligned
        ? CANVAS_COLORS.angle
        : CANVAS_COLORS.normal;

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineWidth = isSelected ? 6 : isReference ? 4.5 : isHovered ? 4 : 3;
  ctx.strokeStyle = isSelected
    ? CANVAS_COLORS.selected
    : isReference
      ? CANVAS_COLORS.reference
      : isAngleAligned
        ? CANVAS_COLORS.angle
        : CANVAS_COLORS.normal;
  ctx.stroke();

  const handleRadius = isCoarsePointer() && isSelected ? 9 : isSelected || isHovered ? 6 : 5;
  drawHandle(segment.start, handleColor, handleRadius);
  drawHandle(segment.end, handleColor, handleRadius);

  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  if (!isSegmentFootnoteVisible(segment)) {
    state.labelBounds.delete(segment.id);
    return;
  }

  const label = labelTextFor(segment);
  const labelFontSize = state.scale > 3 ? 7 : 8;
  ctx.font = `400 ${labelFontSize}px 'DM Sans', Inter, system-ui, sans-serif`;
  const metrics = ctx.measureText(label);
  const labelWidth = metrics.width + 9;
  const labelHeight = Math.max(14, labelFontSize + 7);
  const offset = getLabelOffset(segment, labelWidth, labelHeight);
  const labelCenter = {
    x: midpoint.x + offset.x,
    y: midpoint.y + offset.y,
  };
  const labelRect = {
    left: labelCenter.x - labelWidth / 2,
    top: labelCenter.y - labelHeight / 2,
    right: labelCenter.x + labelWidth / 2,
    bottom: labelCenter.y + labelHeight / 2,
  };
  state.labelBounds.set(segment.id, labelRect);

  const leaderEnd = nearestPointOnRect(midpoint, labelRect);
  ctx.beginPath();
  ctx.moveTo(midpoint.x, midpoint.y);
  ctx.lineTo(leaderEnd.x, leaderEnd.y);
  ctx.lineWidth = isSelected ? 1.1 : 0.75;
  ctx.strokeStyle = isSelected ? CANVAS_COLORS.selected : CANVAS_COLORS.leader;
  ctx.stroke();

  const labelOpacity = state.scale < 0.45 ? 0.42 : 0.96;
  ctx.fillStyle = `rgba(255, 255, 255, ${labelOpacity})`;
  ctx.strokeStyle = isSelected ? CANVAS_COLORS.selected : isReference ? CANVAS_COLORS.reference : "rgba(79, 97, 120, 0.34)";
  ctx.lineWidth = 0.8;
  roundedRect(labelRect.left, labelRect.top, labelWidth, labelHeight, labelHeight / 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#202936";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelCenter.x, labelCenter.y);
}

function drawDetectedSegments() {
  if (!state.detectedSegments.length) return;

  ctx.save();
  ctx.strokeStyle = "rgba(100, 117, 217, 0.5)";
  ctx.fillStyle = "rgba(100, 117, 217, 0.42)";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 6]);

  for (const segment of state.detectedSegments) {
    const start = imageToScreen(segment.start);
    const end = imageToScreen(segment.end);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 2.4, 0, Math.PI * 2);
    ctx.arc(end.x, end.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([5, 6]);
  }

  ctx.restore();
}

function drawSelectionBox() {
  if (!state.selectionBox) return;

  const rect = normalizedRect(state.selectionBox.start, state.selectionBox.end);
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  if (width < 1 || height < 1) return;

  ctx.save();
  ctx.fillStyle = "rgba(37, 99, 235, 0.13)";
  ctx.strokeStyle = CANVAS_COLORS.selected;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.fillRect(rect.left, rect.top, width, height);
  ctx.strokeRect(rect.left, rect.top, width, height);
  ctx.restore();
}

function drawSnapPoint() {
  if (!state.snapPoint) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(state.snapPoint.screen.x, state.snapPoint.screen.y, 9, 0, Math.PI * 2);
  ctx.strokeStyle = CANVAS_COLORS.selected;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.restore();
}

function drawOrthogonalGuide() {
  if (!state.orthogonalGuide) return;

  const anchor = imageToScreen(state.orthogonalGuide.anchor);
  const point = imageToScreen(state.orthogonalGuide.point);

  ctx.save();
  ctx.strokeStyle = "rgba(119, 104, 200, 0.72)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(119, 104, 200, 0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(119, 104, 200, 0.88)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawAlignmentGuide() {
  if (!state.alignmentGuide) return;

  const lines = Array.isArray(state.alignmentGuide.lines)
    ? state.alignmentGuide.lines
    : [state.alignmentGuide];

  ctx.save();
  ctx.strokeStyle = "rgba(37, 99, 235, 0.42)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);

  for (const line of lines) {
    if (!line?.from || !line?.to) continue;
    const from = imageToScreen(line.from);
    const to = imageToScreen(line.to);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  const target = state.alignmentGuide.target || lines.at(-1)?.to;
  if (target) {
    const targetScreen = imageToScreen(target);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(targetScreen.x, targetScreen.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(37, 99, 235, 0.62)";
    ctx.stroke();
  }

  ctx.restore();
}

function drawPendingPreview() {
  if (!state.pendingPoint || !state.previewPoint) return;

  const start = imageToScreen(state.pendingPoint);
  const end = imageToScreen(state.previewPoint);
  ctx.save();
  ctx.strokeStyle = "rgba(37, 99, 235, 0.72)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawRightAngleHints() {
  return;
  if (!state.rightAngleHints.length) return;

  ctx.save();
  ctx.strokeStyle = "rgba(119, 104, 200, 0.64)";
  ctx.lineWidth = 1.4;

  for (const hint of state.rightAngleHints) {
    if (!hint.ids.some((id) => state.selectedSegmentIds.has(id))) {
      continue;
    }

    const joint = imageToScreen(hint.joint);
    const vectorA = hint.vectorA;
    const vectorB = hint.vectorB;
    const lengthA = Math.hypot(vectorA.x, vectorA.y);
    const lengthB = Math.hypot(vectorB.x, vectorB.y);
    if (!lengthA || !lengthB) continue;

    const size = 16;
    const a = {
      x: joint.x + (vectorA.x / lengthA) * size,
      y: joint.y + (vectorA.y / lengthA) * size,
    };
    const b = {
      x: joint.x + (vectorB.x / lengthB) * size,
      y: joint.y + (vectorB.y / lengthB) * size,
    };
    const corner = {
      x: a.x + b.x - joint.x,
      y: a.y + b.y - joint.y,
    };

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHintPill(text, x, y) {
  ctx.save();
  ctx.font = "700 13px 'DM Sans', Inter, system-ui, sans-serif";
  const width = ctx.measureText(text).width + 22;
  const height = 30;
  roundedRect(x - width / 2, y - height / 2, width, height, height / 2);
  ctx.fillStyle = "rgba(32, 41, 54, 0.88)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawCanvasHints() {
  if (!state.image) return;

  const rect = canvas.getBoundingClientRect();
  if (!state.segments.length && !state.detectedSegments.length && !state.isAnalyzing) {
    drawHintPill(isCoarsePointer() ? "Поставьте первую точку" : "Нажмите «Отрезок» и поставьте первую точку", rect.width / 2, rect.height / 2);
  }

  if (state.isChoosingBase && state.segments.length) {
    drawHintPill("Выберите базовый отрезок", rect.width / 2, 42);
  }

  if (state.pendingPoint && state.previewPoint) {
    const preview = imageToScreen(state.previewPoint);
    drawHintPill(isCoarsePointer() ? "Вторая точка" : "Кликните вторую точку", preview.x, preview.y - 28);
  }

  if (state.isSpacePressed) {
    drawHintPill("Пробел: перемещение", 110, rect.height - 56);
  }

  if (state.smartGridEnabled && state.pendingPoint) {
    drawHintPill("90° включено", rect.width - 92, 34);
  }
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (!state.image) return;

  state.labelBounds = new Map();
  const rightAngles = computeRightAngleHints();
  state.rightAngleHints = rightAngles.hints;
  state.rightAngleIds = rightAngles.ids;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (state.backgroundVisible) {
    ctx.drawImage(
      state.image,
      state.offsetX,
      state.offsetY,
      state.image.width * state.scale,
      state.image.height * state.scale,
    );
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.fillRect(
      state.offsetX,
      state.offsetY,
      state.image.width * state.scale,
      state.image.height * state.scale,
    );
  }
  ctx.restore();

  if (state.isDrawingSegments) {
    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.035)";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.restore();
  }

  drawDetectedSegments();

  for (const segment of state.segments) {
    drawSegment(segment);
  }

  drawRightAngleHints();
  drawOrthogonalGuide();
  drawAlignmentGuide();
  drawPendingPreview();

  if (state.pendingPoint) {
    drawPoint(state.pendingPoint, CANVAS_COLORS.selected);
  }

  drawSelectionBox();
  drawSnapPoint();
  drawCanvasHints();
}

function exportLabelOffset(segment, labelWidth, labelHeight, usedBounds, viewScale) {
  const midpoint = {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };

  if (segment.labelOffset) {
    return {
      x: segment.labelOffset.x / viewScale,
      y: segment.labelOffset.y / viewScale,
    };
  }

  const candidates = [
    { x: 0, y: -36 / viewScale },
    { x: 0, y: 36 / viewScale },
    { x: 48 / viewScale, y: -36 / viewScale },
    { x: -48 / viewScale, y: -36 / viewScale },
    { x: 48 / viewScale, y: 36 / viewScale },
    { x: -48 / viewScale, y: 36 / viewScale },
    { x: 0, y: -66 / viewScale },
    { x: 0, y: 66 / viewScale },
  ];

  for (const offset of candidates) {
    const rect = {
      left: midpoint.x + offset.x - labelWidth / 2,
      top: midpoint.y + offset.y - labelHeight / 2,
      right: midpoint.x + offset.x + labelWidth / 2,
      bottom: midpoint.y + offset.y + labelHeight / 2,
    };
    if (!usedBounds.some((existing) => rectsIntersect(rect, existing, 5 / viewScale))) {
      return offset;
    }
  }

  return candidates[0];
}

function createExportLayout(viewScale) {
  const usedBounds = [];
  const labelLayouts = [];
  let bounds = {
    left: 0,
    top: 0,
    right: state.image.width,
    bottom: state.image.height,
  };

  for (const segment of state.segments) {
    bounds.left = Math.min(bounds.left, segment.start.x, segment.end.x);
    bounds.top = Math.min(bounds.top, segment.start.y, segment.end.y);
    bounds.right = Math.max(bounds.right, segment.start.x, segment.end.x);
    bounds.bottom = Math.max(bounds.bottom, segment.start.y, segment.end.y);
  }

  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  const fontSize = Math.max(6.5, 7 / viewScale);
  const horizontalPadding = 7 / viewScale;
  const labelHeight = 12 / viewScale;
  measureContext.font = `400 ${fontSize}px Inter, system-ui, sans-serif`;

  for (const segment of state.segments) {
    if (!isSegmentFootnoteVisible(segment)) continue;

    const midpoint = {
      x: (segment.start.x + segment.end.x) / 2,
      y: (segment.start.y + segment.end.y) / 2,
    };
    const label = labelTextFor(segment);
    const labelWidth = measureContext.measureText(label).width + horizontalPadding;
    const offset = exportLabelOffset(segment, labelWidth, labelHeight, usedBounds, viewScale);
    const labelCenter = {
      x: midpoint.x + offset.x,
      y: midpoint.y + offset.y,
    };
    const labelRect = {
      left: labelCenter.x - labelWidth / 2,
      top: labelCenter.y - labelHeight / 2,
      right: labelCenter.x + labelWidth / 2,
      bottom: labelCenter.y + labelHeight / 2,
    };
    usedBounds.push(labelRect);
    labelLayouts.push({ segment, label, labelRect, labelCenter, labelWidth, labelHeight, fontSize });

    bounds.left = Math.min(bounds.left, labelRect.left);
    bounds.top = Math.min(bounds.top, labelRect.top);
    bounds.right = Math.max(bounds.right, labelRect.right);
    bounds.bottom = Math.max(bounds.bottom, labelRect.bottom);
  }

  const margin = Math.max(18, 22 / viewScale);
  bounds.left -= margin;
  bounds.top -= margin;
  bounds.right += margin;
  bounds.bottom += margin;

  return {
    bounds,
    labelLayouts,
    width: Math.ceil(bounds.right - bounds.left),
    height: Math.ceil(bounds.bottom - bounds.top),
    offsetX: -bounds.left,
    offsetY: -bounds.top,
  };
}

function renderExportCanvas({ withBackground, whiteBackground = false }) {
  if (!state.image) return null;

  const viewScale = Math.max(state.scale, 0.001);
  const layout = createExportLayout(viewScale);
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = layout.width;
  exportCanvas.height = layout.height;
  const exportContext = exportCanvas.getContext("2d");

  exportContext.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
  if (whiteBackground) {
    exportContext.fillStyle = "#ffffff";
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }
  if (withBackground) {
    exportContext.drawImage(state.image, layout.offsetX, layout.offsetY);
  }

  exportContext.lineCap = "round";
  exportContext.lineJoin = "round";

  for (const segment of state.segments) {
    const segmentColor = colorForSegment(segment);
    exportContext.beginPath();
    exportContext.moveTo(segment.start.x + layout.offsetX, segment.start.y + layout.offsetY);
    exportContext.lineTo(segment.end.x + layout.offsetX, segment.end.y + layout.offsetY);
    exportContext.strokeStyle = segmentColor;
    exportContext.lineWidth = Math.max(2, 3 / viewScale);
    exportContext.stroke();
  }

  for (const layoutItem of layout.labelLayouts) {
    const { segment, label, labelWidth, labelHeight, fontSize } = layoutItem;
    const segmentColor = colorForSegment(segment);
    const midpoint = {
      x: (segment.start.x + segment.end.x) / 2 + layout.offsetX,
      y: (segment.start.y + segment.end.y) / 2 + layout.offsetY,
    };
    exportContext.font = `400 ${fontSize}px Inter, system-ui, sans-serif`;
    const labelRect = {
      left: layoutItem.labelRect.left + layout.offsetX,
      top: layoutItem.labelRect.top + layout.offsetY,
      right: layoutItem.labelRect.right + layout.offsetX,
      bottom: layoutItem.labelRect.bottom + layout.offsetY,
    };
    const labelCenter = {
      x: layoutItem.labelCenter.x + layout.offsetX,
      y: layoutItem.labelCenter.y + layout.offsetY,
    };

    const leaderEnd = nearestPointOnRect(midpoint, labelRect);
    exportContext.beginPath();
    exportContext.moveTo(midpoint.x, midpoint.y);
    exportContext.lineTo(leaderEnd.x, leaderEnd.y);
    exportContext.strokeStyle = "rgba(79, 97, 120, 0.64)";
    exportContext.lineWidth = Math.max(0.8, 1 / viewScale);
    exportContext.stroke();

    exportContext.beginPath();
    const radius = 5 / viewScale;
    roundedRectOnContext(exportContext, labelRect.left, labelRect.top, labelWidth, labelHeight, radius);
    exportContext.fillStyle = "rgba(255, 255, 255, 0.88)";
    exportContext.strokeStyle = segmentColor;
    exportContext.lineWidth = Math.max(0.8, 1 / viewScale);
    exportContext.fill();
    exportContext.stroke();

    exportContext.fillStyle = "#202936";
    exportContext.textAlign = "center";
    exportContext.textBaseline = "middle";
    exportContext.fillText(label, labelCenter.x, labelCenter.y);
  }

  return exportCanvas;
}

function roundedRectOnContext(targetContext, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  targetContext.moveTo(x + r, y);
  targetContext.arcTo(x + width, y, x + width, y + height, r);
  targetContext.arcTo(x + width, y + height, x, y + height, r);
  targetContext.arcTo(x, y + height, x, y, r);
  targetContext.arcTo(x, y, x + width, y, r);
  targetContext.closePath();
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function showExportLink(dataUrl, filename) {
  exportStatus.innerHTML = "";
  exportStatus.hidden = false;

  const title = document.createElement("strong");
  title.textContent = `Экспорт готов: ${filename}`;

  const downloadLink = document.createElement("a");
  downloadLink.href = dataUrl;
  downloadLink.download = filename;
  downloadLink.textContent = "Скачать";

  const openLink = document.createElement("a");
  openLink.href = dataUrl;
  openLink.target = "_blank";
  openLink.rel = "noopener";
  openLink.textContent = "Открыть";

  exportStatus.append(title, downloadLink, openLink);
  showToast("Экспорт готов");

  window.setTimeout(() => {
    try {
      downloadLink.click();
    } catch {
      // The visible link remains available if the browser blocks automatic download.
    }
  }, 0);
}

function setExportMenuOpen(open) {
  exportMenu.hidden = !open;
  exportMenuButton.setAttribute("aria-expanded", String(open));
}

function toggleExportMenu() {
  setExportMenuOpen(exportMenu.hidden);
}

function hideSegmentContextMenu() {
  segmentContextMenu.hidden = true;
  activeContextSegmentId = null;
}

function showSegmentContextMenu(segment, clientX, clientY) {
  activeContextSegmentId = segment.id;
  selectOnlySegment(segment.id);
  updateAll();
  segmentContextMenu.hidden = false;
  const menuRect = segmentContextMenu.getBoundingClientRect();
  const left = Math.min(clientX, window.innerWidth - menuRect.width - 10);
  const top = Math.min(clientY, window.innerHeight - menuRect.height - 10);
  segmentContextMenu.style.left = `${Math.max(10, left)}px`;
  segmentContextMenu.style.top = `${Math.max(10, top)}px`;
}

function renameSegmentWithPrompt(segment) {
  const nextName = window.prompt("Название отрезка", segment.name);
  if (nextName === null) return;
  segment.name = nextName.trim() || `Отрезок ${segment.id}`;
  updateAll();
  commitHistory();
}

function dismissWelcome() {
  welcomeOverlay.hidden = true;
  updateToolControls();
  syncCanvasAfterLayout({ fit: Boolean(state.image) });
  if (state.image) {
    canvas.focus();
  } else {
    emptyUploadButton.focus();
  }
  try {
    sessionStorage.setItem("planscale-welcome-seen", "1");
  } catch {
    // Session storage is only a convenience; the app works without it.
  }
}

function initWelcome() {
  try {
    if (sessionStorage.getItem("planscale-welcome-seen")) {
      welcomeOverlay.hidden = true;
    }
  } catch {
    welcomeOverlay.hidden = false;
  }
}

function safeExportName(extension, withBackground) {
  const base = (state.imageName || "plan")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9а-яё_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "plan";
  return `${base}-${withBackground ? "with-plan" : "segments"}.${extension}`;
}

async function exportPng(withBackground) {
  setExportMenuOpen(false);
  if (!withBackground && !state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }
  const exportCanvas = renderExportCanvas({ withBackground });
  if (!exportCanvas) {
    showToast("Сначала загрузите план");
    return;
  }

  showExportLink(exportCanvas.toDataURL("image/png"), safeExportName("png", withBackground));
}

function makePdfFromJpeg(jpegBytes, width, height) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let position = 0;

  function addText(text) {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    position += bytes.length;
  }

  function addBytes(bytes) {
    chunks.push(bytes);
    position += bytes.length;
  }

  function object(id, body) {
    offsets[id] = position;
    addText(`${id} 0 obj\n${body}\nendobj\n`);
  }

  addText("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );

  offsets[4] = position;
  addText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  addBytes(jpegBytes);
  addText("\nendstream\nendobj\n");

  const drawCommand = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  object(5, `<< /Length ${drawCommand.length} >>\nstream\n${drawCommand}endstream`);

  const xrefStart = position;
  addText(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    addText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function exportPdf(withBackground) {
  setExportMenuOpen(false);
  if (!withBackground && !state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }
  const exportCanvas = renderExportCanvas({ withBackground, whiteBackground: true });
  if (!exportCanvas) {
    showToast("Сначала загрузите план");
    return;
  }

  const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.94);
  const jpegBytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (char) => char.charCodeAt(0));
  const pdfBytes = makePdfFromJpeg(jpegBytes, exportCanvas.width, exportCanvas.height);
  const pdfDataUrl = `data:application/pdf;base64,${bytesToBase64(pdfBytes)}`;
  showExportLink(pdfDataUrl, safeExportName("pdf", withBackground));
}

function textDataUrl(mime, text) {
  return `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
}

function dataExportName(extension) {
  return safeExportName(extension, false);
}

function segmentExportRows() {
  return state.segments.map((segment) => {
    const calculated = calculatedLengthFor(segment);
    return {
      id: segment.id,
      name: segment.name,
      isBase: segment.id === state.referenceId,
      footnoteVisible: isSegmentFootnoteVisible(segment),
      lengthPx: Number(segmentLength(segment).toFixed(3)),
      calculatedLength: calculated === null ? null : Number(calculated.toFixed(3)),
      unit: state.unit.trim(),
      angle: segmentAngle(segment),
      startX: Number(segment.start.x.toFixed(3)),
      startY: Number(segment.start.y.toFixed(3)),
      endX: Number(segment.end.x.toFixed(3)),
      endY: Number(segment.end.y.toFixed(3)),
    };
  });
}

function exportCsv() {
  setExportMenuOpen(false);
  if (!state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }

  const header = "id;name;is_base;footnote_visible;length_px;calculated_length;unit;angle;start_x;start_y;end_x;end_y";
  const lines = segmentExportRows().map((row) => [
    row.id,
    `"${String(row.name).replace(/"/g, '""')}"`,
    row.isBase ? "yes" : "no",
    row.footnoteVisible ? "yes" : "no",
    row.lengthPx,
    row.calculatedLength ?? "",
    row.unit,
    row.angle,
    row.startX,
    row.startY,
    row.endX,
    row.endY,
  ].join(";"));
  showExportLink(textDataUrl("text/csv", [header, ...lines].join("\n")), dataExportName("csv"));
}

function exportJson() {
  setExportMenuOpen(false);
  if (!state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }

  const payload = {
    app: "PlanScale",
    imageName: state.imageName,
    baseSegmentId: state.referenceId,
    baseValue: parseDecimal(state.referenceValue),
    unit: state.unit.trim(),
    footnotesVisible: state.footnotesVisible,
    segments: segmentExportRows(),
  };
  showExportLink(textDataUrl("application/json", JSON.stringify(payload, null, 2)), dataExportName("json"));
}

async function copyShareLink() {
  setExportMenuOpen(false);
  if (!state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }

  const payload = {
    baseSegmentId: state.referenceId,
    baseValue: parseDecimal(state.referenceValue),
    unit: state.unit.trim(),
    footnotesVisible: state.footnotesVisible,
    segments: segmentExportRows(),
  };
  const link = `${window.location.origin}${window.location.pathname}${window.location.search}#state=${encodeBase64Json(payload)}`;
  window.history.replaceState(null, "", link);

  try {
    await navigator.clipboard.writeText(link);
    showToast("Ссылка скопирована");
  } catch {
    showToast("Ссылка добавлена в адресную строку");
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colorForSegment(segment) {
  if (segment.id === state.referenceId) return CANVAS_COLORS.reference;
  if (state.rightAngleIds.has(segment.id) || isGridAlignedSegment(segment)) return CANVAS_COLORS.angle;
  return CANVAS_COLORS.normal;
}

function createSvgMarkup() {
  const viewScale = Math.max(state.scale, 0.001);
  const layout = createExportLayout(viewScale);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`,
  ];

  for (const segment of state.segments) {
    const color = colorForSegment(segment);
    lines.push(
      `<line x1="${(segment.start.x + layout.offsetX).toFixed(2)}" y1="${(segment.start.y + layout.offsetY).toFixed(2)}" x2="${(segment.end.x + layout.offsetX).toFixed(2)}" y2="${(segment.end.y + layout.offsetY).toFixed(2)}" stroke="${color}" stroke-width="${Math.max(2, 3 / viewScale).toFixed(2)}"/>`,
    );
  }

  lines.push(`</g>`);
  lines.push(`<g font-family="Inter, Arial, sans-serif" font-weight="500">`);

  for (const layoutItem of layout.labelLayouts) {
    const { segment, label, labelWidth, labelHeight, fontSize } = layoutItem;
    const color = colorForSegment(segment);
    const labelRect = {
      left: layoutItem.labelRect.left + layout.offsetX,
      top: layoutItem.labelRect.top + layout.offsetY,
    };
    const labelCenter = {
      x: layoutItem.labelCenter.x + layout.offsetX,
      y: layoutItem.labelCenter.y + layout.offsetY,
    };
    const midpoint = {
      x: (segment.start.x + segment.end.x) / 2 + layout.offsetX,
      y: (segment.start.y + segment.end.y) / 2 + layout.offsetY,
    };
    const leaderEnd = nearestPointOnRect(midpoint, {
      left: labelRect.left,
      top: labelRect.top,
      right: labelRect.left + labelWidth,
      bottom: labelRect.top + labelHeight,
    });
    lines.push(`<line x1="${midpoint.x.toFixed(2)}" y1="${midpoint.y.toFixed(2)}" x2="${leaderEnd.x.toFixed(2)}" y2="${leaderEnd.y.toFixed(2)}" stroke="${color}" stroke-width="${Math.max(0.8, 1 / viewScale).toFixed(2)}" opacity="0.7"/>`);
    lines.push(`<rect x="${labelRect.left.toFixed(2)}" y="${labelRect.top.toFixed(2)}" width="${labelWidth.toFixed(2)}" height="${labelHeight.toFixed(2)}" rx="${(labelHeight / 2).toFixed(2)}" fill="#fffdf8" stroke="${color}" stroke-width="${Math.max(0.8, 1 / viewScale).toFixed(2)}"/>`);
    lines.push(`<rect x="${labelRect.left.toFixed(2)}" y="${labelRect.top.toFixed(2)}" width="${Math.max(3, 3 / viewScale).toFixed(2)}" height="${labelHeight.toFixed(2)}" rx="${(labelHeight / 2).toFixed(2)}" fill="${color}"/>`);
    lines.push(`<text x="${labelCenter.x.toFixed(2)}" y="${labelCenter.y.toFixed(2)}" font-size="${fontSize.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#25231f">${escapeXml(label)}</text>`);
  }

  lines.push(`</g>`);
  lines.push(`</svg>`);
  return lines.join("\n");
}

function exportSvg() {
  setExportMenuOpen(false);
  if (!state.image || !state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }
  showExportLink(textDataUrl("image/svg+xml", createSvgMarkup()), dataExportName("svg"));
}

function segmentAngle(segment) {
  const radians = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x);
  const degrees = radians * 180 / Math.PI;
  return Math.round(degrees * 10) / 10;
}

function sortedSegmentsForPanel() {
  const sortMode = segmentsSortSelect?.value || "created";
  const segments = [...state.segments];
  if (sortMode === "length-desc") {
    segments.sort((a, b) => segmentLength(b) - segmentLength(a));
  } else if (sortMode === "name") {
    segments.sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true }));
  } else {
    segments.sort((a, b) => a.id - b.id);
  }
  return segments;
}

function renderPanelSummary() {
  if (!panelSummary) return;

  const count = state.segments.length;
  const base = state.referenceId ? "база выбрана" : "база не выбрана";
  const unit = state.unit.trim() || "без единицы";
  panelSummary.textContent = `${count} ${plural(count, "отрезок", "отрезка", "отрезков")} · ${base} · ${unit}`;
}

function renderBaseSummary() {
  renderPanelSummary();

  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  if (!reference) {
    baseSegmentName.textContent = "Не выбран";
    baseSegmentMeta.textContent = state.segments.length
      ? "Выберите известный отрезок на плане или в списке."
      : "Добавьте отрезок и задайте одну известную длину.";
    baseSegmentName.classList.toggle("pending", state.segments.length > 0);
    return;
  }

  const realValue = parseDecimal(state.referenceValue);
  baseSegmentName.textContent = reference.name;
  baseSegmentName.classList.remove("pending");
  baseSegmentMeta.textContent = realValue === null
    ? `${formatDecimal(segmentLength(reference))} px · введите реальную длину`
    : `${formatLength(realValue)} · ${formatDecimal(segmentLength(reference))} px на плане`;
}

function renderSegments() {
  renderSegmentsPanel({
    segmentsList,
    noSegments,
    segments: sortedSegmentsForPanel(),
    isSegmentSelected,
    handleSegmentPick,
    toggleSegmentSelection,
    selectOnlySegment,
    updateAll,
    renderOutput,
    updateStatus,
    draw,
    commitHistory,
    calculatedLengthFor,
    formatLength,
    formatDecimal,
    segmentLength,
    segmentAngle,
    referenceId: state.referenceId,
    isSegmentFootnoteVisible,
    setSegmentFootnoteVisible,
    setReferenceSegment,
    deleteSegment,
  });
}

function segmentsSummaryText() {
  if (!state.segments.length) return "";

  const lengthHeader = state.unit.trim()
    ? `Расчетная длина (${state.unit.trim()})`
    : "Расчетная длина";
  const lines = [`Отрезок;${lengthHeader}`];
  for (const segment of state.segments) {
    const length = formatLength(calculatedLengthFor(segment), false);
    lines.push(`${segment.name};${length}`);
  }
  return lines.join("\n");
}

function renderOutput() {
  if (!resultOutput) return;
  resultOutput.value = segmentsSummaryText();
}

function updateStatus() {
  if (!state.image) {
    statusText.textContent = "Загрузите изображение плана";
    return;
  }

  if (state.isAnalyzing) {
    statusText.textContent = "Анализ линий...";
    return;
  }

  if (state.pendingPoint) {
    statusText.textContent = "Выберите вторую точку отрезка";
    return;
  }

  const count = state.segments.length;
  const detectedState = state.detectedSegments.length ? ` · предпросмотр ${state.detectedSegments.length}` : "";
  const underlayState = state.backgroundVisible ? "" : " · подложка скрыта";
  const drawingState = state.isDrawingSegments ? " · добавление отрезков" : "";
  const baseState = count && !state.referenceId ? " · выберите базовый отрезок" : "";
  statusText.textContent = `План готов${detectedState}${baseState}${underlayState}${drawingState}`;
}

function plural(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function updateAll() {
  updateToolControls();
  renderBaseSummary();
  renderSegments();
  renderOutput();
  updateStatus();
  updateGuidanceControls();
  updateHistoryButtons();
  if (window.matchMedia("(max-width: 760px)").matches) {
    resizeCanvas();
  } else {
    draw();
  }
}

function addPoint(point) {
  if (!state.pendingPoint) {
    state.pendingPoint = point;
    state.previewPoint = null;
    state.orthogonalGuide = null;
    state.alignmentGuide = null;
    clearSelection();
    updateAll();
    return;
  }

  const start = state.pendingPoint;
  const resolved = resolveEndpointPoint(point, start, null);
  const end = resolved.point;
  const id = nextSegmentId++;
  const segment = {
    id,
    name: `Отрезок ${id}`,
    start,
    end,
    labelHidden: !state.footnotesVisible,
  };

  state.segments.push(segment);
  if (!state.referenceId) {
    state.isChoosingBase = true;
  }
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  selectOnlySegment(id);
  updateAll();
  commitHistory();
}

function deleteSegment(id) {
  deleteSegments([id]);
}

function deleteSegments(ids) {
  const idsToDelete = new Set(ids);
  if (!idsToDelete.size) return;

  state.segments = state.segments.filter((segment) => !idsToDelete.has(segment.id));
  if (state.segments.length) {
    state.footnotesVisible = visibleFootnoteCount() > 0;
  }
  if (idsToDelete.has(state.referenceId)) {
    state.referenceId = null;
    state.referenceValue = "";
    referenceLengthInput.value = "";
    state.isChoosingBase = state.segments.length > 0;
  }
  if (idsToDelete.has(state.pendingReferenceId)) {
    hideBaseConfirmation();
  }
  selectSegments(getSelectedIds().filter((id) => !idsToDelete.has(id)));
  updateAll();
  commitHistory();
}

function resetPlan() {
  if (!state.image && !state.segments.length && !state.detectedSegments.length) return;
  const confirmed = window.confirm("Удалить план, все отрезки и настройки?");
  if (!confirmed) return;

  analysisRunId++;
  const rememberedUnit = state.unit || "м";
  state.image = null;
  state.imageSrc = "";
  state.imageName = "";
  state.backgroundVisible = true;
  state.scale = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  state.segments = [];
  state.detectedSegments = [];
  state.referenceId = null;
  state.selectedSegmentIds = new Set();
  state.referenceValue = "";
  state.unit = rememberedUnit;
  state.footnotesVisible = true;
  state.pendingPoint = null;
  state.isDragging = false;
  state.dragStart = null;
  state.didDrag = false;
  state.interactionMode = null;
  state.selectionBox = null;
  state.labelBounds = new Map();
  state.snapPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  state.rightAngleHints = [];
  state.rightAngleIds = new Set();
  state.isDrawingSegments = false;
  state.isChoosingBase = false;
  state.isAnalyzing = false;
  state.hoveredSegmentId = null;
  nextSegmentId = 1;

  imageInput.value = "";
  referenceLengthInput.value = "";
  setUnitInputValue(rememberedUnit);
  emptyState.hidden = false;
  exportStatus.hidden = true;
  exportStatus.innerHTML = "";
  setExportMenuOpen(false);
  historyState.undo = [];
  historyState.redo = [];
  updateAll();
  syncCanvasAfterLayout();
  commitHistory();
  showToast("План удалён");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function shouldReplaceCurrentPlan() {
  if (!state.image || (!state.segments.length && !state.detectedSegments.length)) {
    return true;
  }
  return window.confirm("Заменить план? Текущая разметка будет очищена.");
}

function loadImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Выберите файл изображения");
    return;
  }
  if (!shouldReplaceCurrentPlan()) {
    return;
  }

  const preserveExistingMarkup = !state.image && state.segments.length > 0;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const image = new Image();
    image.addEventListener("load", () => {
      analysisRunId++;
      state.image = image;
      state.imageSrc = String(reader.result);
      state.imageName = file.name;
      state.backgroundVisible = true;
      if (!preserveExistingMarkup) {
        state.segments = [];
        state.referenceId = null;
        state.referenceValue = "";
        referenceLengthInput.value = "";
        state.isChoosingBase = false;
        clearSelection();
      }
      state.detectedSegments = [];
      state.pendingPoint = null;
      state.pendingReferenceId = null;
      state.previewPoint = null;
      state.orthogonalGuide = null;
      state.isDrawingSegments = false;
      state.isAnalyzing = false;
      state.hoveredSegmentId = null;
      emptyState.hidden = true;
      updateToolControls();
      resizeCanvas();
      fitImage();
      updateAll();
      commitHistory();
      showToast("План загружен");
      if (!preserveExistingMarkup) {
        window.setTimeout(() => analyzeImageSegments({ automatic: true }), 180);
      }
    });
    image.addEventListener("error", () => showToast("Не удалось прочитать изображение"), { once: true });
    image.src = reader.result;
  });
  reader.addEventListener("error", () => showToast("Не удалось открыть файл"), { once: true });
  reader.readAsDataURL(file);
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  loadImageFile(file);
  imageInput.value = "";
});

emptyUploadButton.addEventListener("click", () => imageInput.click());

for (const target of [wrap, emptyState]) {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    wrap.classList.add("drag-over");
  });
  target.addEventListener("dragleave", (event) => {
    event.stopPropagation();
    if (!wrap.contains(event.relatedTarget)) {
      wrap.classList.remove("drag-over");
    }
  });
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    wrap.classList.remove("drag-over");
    loadImageFile(event.dataTransfer?.files?.[0]);
  });
}

document.addEventListener("paste", (event) => {
  const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith("image/"));
  if (file) {
    loadImageFile(file);
  }
});

acceptDetectedButton.addEventListener("click", () => materializeDetectedSegments(false));
addDetectedButton.addEventListener("click", () => materializeDetectedSegments(true));
cancelDetectedButton.addEventListener("click", () => {
  clearDetectedSegments();
  showToast("Найденные отрезки отменены");
});
focusReferenceButton.addEventListener("click", () => referenceLengthInput.focus());
focusBaseInputButton.addEventListener("click", () => referenceLengthInput.focus());
chooseBaseButton.addEventListener("click", startChoosingBase);
confirmBaseButton?.addEventListener("click", confirmPendingReference);
cancelBaseButton?.addEventListener("click", () => {
  hideBaseConfirmation();
  updateAll();
});

fitButton.addEventListener("click", () => {
  fitImage();
  scheduleViewSave();
});
drawSegmentButton.addEventListener("click", () => {
  state.isDrawingSegments = !state.isDrawingSegments;
  state.detectedSegments = [];
  if (!state.isDrawingSegments) {
    state.pendingPoint = null;
    state.previewPoint = null;
    state.orthogonalGuide = null;
  }
  updateAll();
  saveSnapshotToStorage();
});

reanalyzeButton.addEventListener("click", () => {
  if (!state.image || state.isAnalyzing) return;
  analyzeImageSegments({ automatic: false });
});

removeUnderlayButton.addEventListener("click", () => {
  if (!state.image) return;
  state.backgroundVisible = !state.backgroundVisible;
  updateAll();
  commitHistory();
  showToast(state.backgroundVisible ? "Подложка показана" : "Подложка скрыта");
});
resetPlanButton.addEventListener("click", resetPlan);

undoButton.addEventListener("click", undoHistory);
redoButton.addEventListener("click", redoHistory);

clearButton.addEventListener("click", () => {
  const selectedIds = getSelectedIds();
  if (!selectedIds.length) {
    showToast("Выберите отрезок для удаления");
    return;
  }
  deleteSegments(selectedIds);
  showToast(selectedIds.length === 1 ? "Отрезок удалён" : `Удалено: ${selectedIds.length}`);
});

copyButton.addEventListener("click", async () => {
  const text = segmentsSummaryText();
  if (!text) {
    showToast("Пока нечего копировать");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Список отрезков скопирован");
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.left = "-9999px";
    document.body.append(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
    showToast("Список отрезков скопирован");
  }
});

toggleSegmentsButton.addEventListener("click", () => {
  const collapsed = segmentSection.classList.toggle("collapsed");
  toggleSegmentsButton.textContent = collapsed ? "Развернуть" : "Свернуть";
});

exportMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleExportMenu();
});
exportPngButton.addEventListener("click", () => exportPng(false));
exportPngBgButton.addEventListener("click", () => exportPng(true));
exportPdfButton.addEventListener("click", () => exportPdf(false));
exportPdfBgButton.addEventListener("click", () => exportPdf(true));
exportSvgButton.addEventListener("click", exportSvg);
exportCsvButton.addEventListener("click", exportCsv);
exportJsonButton.addEventListener("click", exportJson);
copyShareLinkButton.addEventListener("click", copyShareLink);

document.addEventListener("click", (event) => {
  if (!segmentContextMenu.hidden && event.target instanceof Node && !segmentContextMenu.contains(event.target)) {
    hideSegmentContextMenu();
  }
  if (exportMenu.hidden) return;
  if (event.target instanceof Node && exportMenu.contains(event.target)) return;
  if (event.target instanceof Node && exportMenuButton.contains(event.target)) return;
  setExportMenuOpen(false);
});

segmentContextMenu.addEventListener("click", (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest("button[data-action]") : null;
  if (!button) return;
  const segment = state.segments.find((item) => item.id === activeContextSegmentId);
  if (!segment) {
    hideSegmentContextMenu();
    return;
  }

  const action = button.dataset.action;
  hideSegmentContextMenu();
  if (action === "base") {
    setReferenceSegment(segment.id);
  } else if (action === "rename") {
    renameSegmentWithPrompt(segment);
  } else if (action === "delete") {
    deleteSegment(segment.id);
  }
});

welcomeStartButton.addEventListener("click", dismissWelcome);

referenceLengthInput.addEventListener("input", () => {
  state.referenceValue = referenceLengthInput.value;
  updateAll();
});
referenceLengthInput.addEventListener("change", () => {
  state.referenceValue = referenceLengthInput.value;
  updateAll();
  commitHistory();
});

unitInput.addEventListener("input", () => {
  state.unit = unitInput.value;
  updateAll();
});
unitInput.addEventListener("change", () => {
  state.unit = unitInput.value;
  updateAll();
  commitHistory();
});

segmentsSortSelect.addEventListener("change", renderSegments);

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  updateToolControls();
  syncCanvasAfterLayout();
}

sidebarToggleButton.addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));
sidebarCloseButton?.addEventListener("click", () => setSidebarCollapsed(true));
if (toggleAllFootnotesButton) {
  toggleAllFootnotesButton.addEventListener("click", toggleAllFootnotes);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!state.image) return;
  updatePointerFromEvent(event);
  safeSetPointerCapture(event.pointerId);
  if (event.pointerType === "touch" && activePointers.size >= 2) {
    event.preventDefault();
    startPinchGesture();
    updateAll();
    return;
  }

  const hitEndpoint = findEndpointAt(event.clientX, event.clientY);
  const hitLabel = hitEndpoint ? null : findLabelAt(event.clientX, event.clientY);
  const hitSegment = hitEndpoint || hitLabel ? null : findSegmentAt(event.clientX, event.clientY);
  const touchEmptyPan = event.pointerType === "touch"
    && !state.isDrawingSegments
    && !state.isChoosingBase
    && !hitEndpoint
    && !hitLabel
    && !hitSegment;
  const wantsPan = event.button === 1 || state.isSpacePressed || touchEmptyPan;

  state.isDragging = true;
  state.didDrag = false;
  touchContextMenuOpened = false;
  state.snapPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  state.selectionBox = null;

  if (wantsPan) {
    state.pendingPoint = null;
    state.interactionMode = "pan";
  } else if (hitEndpoint) {
    selectOnlySegment(hitEndpoint.segment.id);
    state.pendingPoint = null;
    state.interactionMode = "endpoint";
  } else if (hitLabel) {
    if (event.shiftKey) {
      toggleSegmentSelection(hitLabel.id);
      state.interactionMode = "shift-select";
    } else {
      selectOnlySegment(hitLabel.id);
      state.interactionMode = "label";
    }
    state.pendingPoint = null;
  } else if (hitSegment) {
    if (event.shiftKey) {
      toggleSegmentSelection(hitSegment.id);
      state.interactionMode = "shift-select";
    } else {
      selectOnlySegment(hitSegment.id);
      state.interactionMode = "segment";
    }
    state.pendingPoint = null;
  } else {
    state.interactionMode = "select";
  }

  state.dragStart = {
    x: event.clientX,
    y: event.clientY,
    screen: screenPointFromClient(event.clientX, event.clientY),
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    endpoint: hitEndpoint,
    labelSegment: hitLabel,
    labelOffset: hitLabel ? currentLabelOffset(hitLabel) : { x: 0, y: -36 },
  };
  scheduleTouchContextMenu(hitLabel || hitSegment, event);
  updateAll();
  canvas.classList.add("dragging");
});

canvas.addEventListener("pointermove", (event) => {
  updatePointerFromEvent(event);
  if (pinchGesture && event.pointerType === "touch" && activePointers.size >= 2) {
    event.preventDefault();
    const metrics = pointerPairMetrics();
    if (metrics && metrics.distance >= 1) {
      const factor = metrics.distance / Math.max(pinchGesture.distance, 1);
      zoomAtClientPoint(metrics.center.x, metrics.center.y, factor);
      pinchGesture.distance = metrics.distance;
      draw();
      scheduleViewSave();
    }
    return;
  }

  updateCursorCoordinates(event.clientX, event.clientY);

  if (!state.isDragging || !state.dragStart) {
    const hoverTarget = state.image && !state.isDrawingSegments
      ? findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY)
      : null;
    const hoverId = hoverTarget?.id ?? null;
    if (hoverId !== state.hoveredSegmentId) {
      state.hoveredSegmentId = hoverId;
      canvas.classList.toggle("hovering-segment", Boolean(hoverId));
      draw();
    }

    if (state.pendingPoint && state.isDrawingSegments) {
      const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
      const resolved = resolveEndpointPoint(rawPoint, state.pendingPoint, null);
      state.previewPoint = resolved.point;
      state.snapPoint = resolved.snap;
      state.orthogonalGuide = resolved.guide;
      state.alignmentGuide = resolved.alignmentGuide;
      draw();
    }
    return;
  }

  const dx = event.clientX - state.dragStart.x;
  const dy = event.clientY - state.dragStart.y;
  const distance = Math.hypot(dx, dy);

  if (distance > 4) {
    if (distance > 10) {
      clearLongPressTimer();
    }
    state.didDrag = true;

    if (state.interactionMode === "endpoint" && state.dragStart.endpoint) {
      const { segment, endpoint } = state.dragStart.endpoint;
      const fixedEndpoint = endpoint === "start" ? segment.end : segment.start;
      const dragPoint = adjustedEndpointDragPoint(event);
      const rawPoint = clampPointToImage(screenToImage(dragPoint.x, dragPoint.y));
      const resolved = resolveEndpointPoint(rawPoint, fixedEndpoint, segment.id);
      segment[endpoint] = resolved.point;
      state.snapPoint = resolved.snap;
      state.orthogonalGuide = resolved.guide;
      state.alignmentGuide = resolved.alignmentGuide;
      draw();
    } else if (state.interactionMode === "label" && state.dragStart.labelSegment) {
      const dx = event.clientX - state.dragStart.x;
      const dy = event.clientY - state.dragStart.y;
      state.dragStart.labelSegment.labelOffset = {
        x: state.dragStart.labelOffset.x + dx,
        y: state.dragStart.labelOffset.y + dy,
      };
      draw();
    } else if (state.interactionMode === "segment") {
      state.selectionBox = null;
      draw();
    } else if (state.pendingPoint) {
      draw();
    } else if (state.interactionMode === "pan") {
      state.offsetX = state.dragStart.offsetX + dx;
      state.offsetY = state.dragStart.offsetY + dy;
    } else {
      state.selectionBox = {
        start: state.dragStart.screen,
        end: screenPointFromClient(event.clientX, event.clientY),
      };
      selectSegments(segmentIdsInsideSelectionBox());
    }

    draw();
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (!state.image) return;
  clearLongPressTimer();
  removePointerFromEvent(event);
  safeReleasePointerCapture(event.pointerId);
  if (touchContextMenuOpened) {
    touchContextMenuOpened = false;
    resetTransientGestureState(null);
    state.lastPointerUpAt = performance.now();
    draw();
    return;
  }
  if (pinchGesture || state.interactionMode === "pinch") {
    resetTransientGestureState(null);
    state.lastPointerUpAt = performance.now();
    scheduleViewSave();
    draw();
    return;
  }
  canvas.classList.remove("dragging");
  state.lastPointerUpAt = performance.now();

  const wasClick = !state.didDrag;
  const hadSelectionBox = Boolean(state.selectionBox);
  const hitLabel = wasClick ? findLabelAt(event.clientX, event.clientY) : null;
  const hitSegment = wasClick && !hitLabel ? findSegmentAt(event.clientX, event.clientY) : null;
  const completedMode = state.interactionMode;
  const shouldAddPoint = state.isDrawingSegments && wasClick && !hitLabel && !hitSegment && completedMode !== "endpoint";
  state.isDragging = false;
  state.dragStart = null;
  state.interactionMode = null;
  state.snapPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;

  if (completedMode === "endpoint" || completedMode === "label") {
    updateAll();
    if (state.didDrag) {
      commitHistory();
    }
  } else if (completedMode === "segment" && !wasClick) {
    state.selectionBox = null;
    state.pendingPoint = null;
    updateAll();
  } else if (completedMode === "pan") {
    scheduleViewSave();
  } else if (hadSelectionBox) {
    const selectedCount = state.selectedSegmentIds.size;
    state.selectionBox = null;
    state.pendingPoint = null;
    updateAll();
    if (selectedCount) {
      showToast(`Выбрано: ${selectedCount}`);
    }
  } else if (hitLabel || hitSegment) {
    const hitId = (hitLabel || hitSegment).id;
    if (handleSegmentPick(hitId, { requireConfirmation: event.pointerType === "touch" })) {
      state.pendingPoint = null;
      return;
    }
    if (event.shiftKey || completedMode === "shift-select") {
      if (completedMode !== "shift-select") {
        toggleSegmentSelection(hitId);
      }
    } else {
      selectOnlySegment(hitId);
    }
    state.pendingPoint = null;
    updateAll();
  } else if (shouldAddPoint) {
    addPoint(clampPointToImage(screenToImage(event.clientX, event.clientY)));
  }
});

canvas.addEventListener("dblclick", (event) => {
  if (!state.image) return;
  const segment = findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY);
  if (!segment) return;
  event.preventDefault();
  renameSegmentWithPrompt(segment);
});

canvas.addEventListener("contextmenu", (event) => {
  if (!state.image) return;
  const segment = findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY);
  if (!segment) return;
  event.preventDefault();
  showSegmentContextMenu(segment, event.clientX, event.clientY);
});

canvas.addEventListener("pointerleave", () => {
  hideCursorCoordinates();
  if (state.isDragging) return;
  state.hoveredSegmentId = null;
  canvas.classList.remove("hovering-segment");
  if (!state.previewPoint && !state.orthogonalGuide && !state.alignmentGuide) {
    draw();
    return;
  }
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  draw();
});

canvas.addEventListener("pointercancel", (event) => {
  clearLongPressTimer();
  removePointerFromEvent(event);
  if (state.interactionMode === "pinch" || activePointers.size === 0) {
    resetTransientGestureState(null);
    draw();
  }
});

canvas.addEventListener("wheel", (event) => {
  if (!state.image) return;
  event.preventDefault();

  const deltaX = normalizedWheelDelta(event.deltaX, event.deltaMode);
  const deltaY = normalizedWheelDelta(event.deltaY, event.deltaMode);
  const shouldZoom = event.ctrlKey || event.metaKey || event.altKey;

  if (!shouldZoom) {
    state.offsetX -= deltaX;
    state.offsetY -= deltaY;
    draw();
    scheduleViewSave();
    return;
  }

  if (performance.now() - state.lastPointerUpAt < 240 || Math.abs(deltaY) < 1.5) {
    return;
  }

  const rawFactor = Math.exp(-deltaY * 0.0025);
  const factor = Math.min(Math.max(rawFactor, 0.75), 1.33);
  zoomAtClientPoint(event.clientX, event.clientY, factor);
  draw();
  scheduleViewSave();
}, { passive: false });

smartGridToggle.addEventListener("change", () => {
  state.smartGridEnabled = smartGridToggle.checked;
  updateAll();
  commitHistory();
});

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resizeCanvas, 50);
});

window.visualViewport?.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resizeCanvas, 50);
});

if (typeof ResizeObserver !== "undefined") {
  const canvasResizeObserver = new ResizeObserver(() => resizeCanvas());
  canvasResizeObserver.observe(wrap);
}

function isTextInputTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  );
}

window.addEventListener("keydown", (event) => {
  const isEditingText = isTextInputTarget(event.target);
  if (event.code === "Space" && !isEditingText && state.image) {
    state.isSpacePressed = true;
    updateToolControls();
    event.preventDefault();
    return;
  }

  if (event.key === "Escape") {
    if (!segmentContextMenu.hidden) {
      hideSegmentContextMenu();
      event.preventDefault();
      return;
    }
    if (!exportMenu.hidden) {
      setExportMenuOpen(false);
      event.preventDefault();
      return;
    }
    if (state.pendingReferenceId) {
      hideBaseConfirmation();
      updateAll();
      event.preventDefault();
      return;
    }
    if (state.detectedSegments.length) {
      state.detectedSegments = [];
      updateAll();
      showToast("Найденные отрезки отменены");
      event.preventDefault();
      return;
    }
    if (!welcomeOverlay.hidden) {
      dismissWelcome();
      event.preventDefault();
      return;
    }
  }

  if (!welcomeOverlay.hidden) {
    return;
  }

  if (event.key === "Escape") {
    if (state.pendingPoint || state.isDrawingSegments || state.selectedSegmentIds.size) {
      state.pendingPoint = null;
      state.previewPoint = null;
      state.orthogonalGuide = null;
      state.selectionBox = null;
      state.isDrawingSegments = false;
      clearSelection();
      updateAll();
      saveSnapshotToStorage();
      event.preventDefault();
    }
    return;
  }

  if (!isEditingText && (event.metaKey || event.ctrlKey)) {
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoHistory();
      } else {
        undoHistory();
      }
      return;
    }
    if (key === "y") {
      event.preventDefault();
      redoHistory();
      return;
    }
  }

  if (isEditingText || (event.key !== "Delete" && event.key !== "Backspace")) {
    return;
  }

  const selectedIds = getSelectedIds();
  if (selectedIds.length) {
    event.preventDefault();
    deleteSegments(selectedIds);
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return;
  state.isSpacePressed = false;
  updateToolControls();
});

resizeCanvas();
initWelcome();
restoreSavedState();
