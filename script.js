/* ---------- Config / elements ---------- */
const PREVIEW_SIZE = 1080; // internal preview resolution
const EXPORT_SIZE = 1280; // export resolution

const FRAME_SIZE = 1280; // native resolution of background/frame/ribbon assets
const PHOTO_SIZE = 1050; // size of the transparent cutout in the frame, centered
const PHOTO_RATIO = PHOTO_SIZE / FRAME_SIZE;

const PHOTO_AREA_PREVIEW = PREVIEW_SIZE * PHOTO_RATIO;
const PHOTO_INSET_PREVIEW = (PREVIEW_SIZE - PHOTO_AREA_PREVIEW) / 2;

const MAX_NAME_LENGTH = 13;

// Ribbon text anchor points — measured against the native 1280px assets,
// using the text baseline (matches Canvas's default textBaseline behavior).
const RIBBON_TEXT = {
  bottom: { x: 640, y: 1010, angleDeg: 11.452, color: "#d1d1d1" },
  top: { x: 640, y: 972, angleDeg: 355.889, color: "#ffffff" },
};
const RIBBON_FONT_SIZE = 47.2; // in 1280-reference px — from Illustrator (47.2pt, assumed 72ppi doc)

const uploadBox = document.getElementById("uploadBox");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("upload");
const uploadArea = document.getElementById("uploadArea");
const spinner = document.getElementById("spinner");

const canvasWrapper = document.getElementById("canvasWrapper");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const dragHint = document.getElementById("dragHint");
const controls = document.getElementById("controls");
const zoomEl = document.getElementById("zoom");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

const errorToast = document.getElementById("error");
const successState = document.getElementById("successState");
const makeAnotherBtn = document.getElementById("makeAnotherBtn");

const nameInput = document.getElementById("nameInput");
const charCount = document.getElementById("charCount");

canvas.width = PREVIEW_SIZE;
canvas.height = PREVIEW_SIZE;

/* ---------- Asset loading ---------- */
function loadImg(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const background = loadImg("background.png");
const bottomRibbon = loadImg("bottom-ribbon.png");
const topRibbon = loadImg("top-ribbon.png");

let assetsReady = false;
const assetList = [background, bottomRibbon, topRibbon];
let loadedCount = 0;

assetList.forEach((img) => {
  img.onload = () => {
    loadedCount++;
    if (loadedCount === assetList.length) {
      assetsReady = true;
      if (userLoaded) draw();
    }
  };
  img.onerror = () => {
    showError(
      "Something didn't load properly. Please check your internet and try again.",
    );
  };
});

let fontReady = false;
if (document.fonts && document.fonts.load) {
  document.fonts
    .load(`${RIBBON_FONT_SIZE}px Frick`)
    .then(() => {
      fontReady = true;
      if (userLoaded) draw();
    })
    .catch(() => {
      fontReady = true; // fall back silently, browser default font will render instead
    });
} else {
  fontReady = true;
}

/* state */
let userImg = new Image();
let userLoaded = false;
let scale = 1;
let offsetX = 0,
  offsetY = 0;
let isDragging = false;
let startX = 0,
  startY = 0;
let lastPinchDist = null;

/* utility: show error toast */
function showError(msg) {
  errorToast.textContent = msg;
  errorToast.style.display = "block";
  setTimeout(() => (errorToast.style.display = "none"), 3000);
}

/* ---------- Name field ---------- */
function currentName() {
  const val = nameInput.value.trim();
  return val.length ? val : "I";
}

function buildRibbonText() {
  const phrase = `${currentName()} WILL BE AT TRANS 2026`.toUpperCase();
  return Array(4).fill(phrase).join(" • ");
}

function updateCharCount() {
  charCount.textContent = `${nameInput.value.length} / ${MAX_NAME_LENGTH}`;
}

nameInput.addEventListener("input", () => {
  updateCharCount();
  if (userLoaded) draw();
});
updateCharCount();

/* ---------- Core math: constraints & draw ---------- */
function clampTransform() {
  if (!userImg || !userImg.width) return;

  const minScalePreview = Math.max(
    PHOTO_AREA_PREVIEW / userImg.width,
    PHOTO_AREA_PREVIEW / userImg.height,
  );
  if (scale < minScalePreview) scale = minScalePreview;

  const iw_preview = userImg.width * scale;
  const ih_preview = userImg.height * scale;

  const minX = PHOTO_INSET_PREVIEW + PHOTO_AREA_PREVIEW - iw_preview;
  const maxX = PHOTO_INSET_PREVIEW;
  const minY = PHOTO_INSET_PREVIEW + PHOTO_AREA_PREVIEW - ih_preview;
  const maxY = PHOTO_INSET_PREVIEW;

  if (iw_preview > PHOTO_AREA_PREVIEW) {
    if (offsetX > maxX) offsetX = maxX;
    if (offsetX < minX) offsetX = minX;
  } else {
    offsetX = PHOTO_INSET_PREVIEW + (PHOTO_AREA_PREVIEW - iw_preview) / 2;
  }

  if (ih_preview > PHOTO_AREA_PREVIEW) {
    if (offsetY > maxY) offsetY = maxY;
    if (offsetY < minY) offsetY = minY;
  } else {
    offsetY = PHOTO_INSET_PREVIEW + (PHOTO_AREA_PREVIEW - ih_preview) / 2;
  }
}

function drawRibbonText(targetCtx, anchor, rf) {
  const text = buildRibbonText();
  const x = anchor.x * rf;
  const y = anchor.y * rf;
  const angleRad = (anchor.angleDeg * Math.PI) / 180;
  const fontSize = RIBBON_FONT_SIZE * rf;

  targetCtx.save();
  targetCtx.translate(x, y);
  targetCtx.rotate(-angleRad);
  targetCtx.font = `${fontSize}px Frick, sans-serif`;
  targetCtx.fillStyle = anchor.color;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "alphabetic";
  targetCtx.fillText(text, 0, 0);
  targetCtx.restore();
}

function draw(targetCanvas = canvas, targetCtx = ctx, size = PREVIEW_SIZE) {
  if (!userLoaded) return;

  clampTransform();
  const sf = size / PREVIEW_SIZE; // scale for user photo (working in PREVIEW_SIZE coord space)
  const rf = size / FRAME_SIZE; // scale for fixed-position layered assets (native 1280 ref)

  const iw_out = userImg.width * scale * sf;
  const ih_out = userImg.height * scale * sf;
  const offsetX_out = offsetX * sf;
  const offsetY_out = offsetY * sf;

  targetCanvas.width = size;
  targetCanvas.height = size;
  targetCtx.clearRect(0, 0, size, size);
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";

  // 1. user photo (bottommost)
  targetCtx.drawImage(userImg, offsetX_out, offsetY_out, iw_out, ih_out);

  // 2. background — has a transparent cutout revealing the photo, plus border art baked in
  if (background.complete && background.naturalWidth > 0) {
    targetCtx.drawImage(background, 0, 0, size, size);
  }

  // 3. bottom ribbon + name text
  if (bottomRibbon.complete && bottomRibbon.naturalWidth > 0) {
    targetCtx.drawImage(bottomRibbon, 0, 0, size, size);
  }
  drawRibbonText(targetCtx, RIBBON_TEXT.bottom, rf);

  // 4. top ribbon + name text
  if (topRibbon.complete && topRibbon.naturalWidth > 0) {
    targetCtx.drawImage(topRibbon, 0, 0, size, size);
  }
  drawRibbonText(targetCtx, RIBBON_TEXT.top, rf);
}

/* ---------- File handling & UI ---------- */
function handleFile(file) {
  if (!file) return;
  const valid = ["image/png", "image/jpeg"];
  if (!valid.includes(file.type)) {
    showError("File type not supported. Please upload .png, .jpg or .jpeg.");
    return;
  }

  spinner.style.display = "block";
  const reader = new FileReader();
  reader.onload = (e) => {
    userImg = new Image();
    userImg.onload = () => {
      spinner.style.display = "none";
      uploadArea.style.display = "none";
      canvasWrapper.style.display = "block";
      controls.style.display = "flex";
      userLoaded = true;

      scale = Math.max(
        PHOTO_AREA_PREVIEW / userImg.width,
        PHOTO_AREA_PREVIEW / userImg.height,
      );
      offsetX =
        PHOTO_INSET_PREVIEW + (PHOTO_AREA_PREVIEW - userImg.width * scale) / 2;
      offsetY =
        PHOTO_INSET_PREVIEW + (PHOTO_AREA_PREVIEW - userImg.height * scale) / 2;

      zoomEl.value = scale.toFixed(2);
      downloadBtn.disabled = false;

      draw();
      dragHint.classList.add("show");
      setTimeout(() => dragHint.classList.remove("show"), 2200);
    };
    userImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function openPicker() {
  fileInput.click();
}
uploadBox.addEventListener("click", openPicker);
uploadBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openPicker();
  }
});
uploadBtn.addEventListener("click", openPicker);
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files[0])
    handleFile(e.dataTransfer.files[0]);
});

zoomEl.addEventListener("input", () => {
  scale = parseFloat(zoomEl.value);
  clampTransform();
  draw();
});

downloadBtn.addEventListener("click", () => {
  if (!userLoaded) return;

  if (!assetsReady) {
    showError("Almost ready — please wait a few seconds and try again.");
    return;
  }

  const out = document.createElement("canvas");
  const octx = out.getContext("2d");
  draw(out, octx, EXPORT_SIZE);
  const a = document.createElement("a");
  a.download = "dp-trans.png";
  a.href = out.toDataURL("image/png");
  a.click();

  canvasWrapper.style.display = "none";
  controls.style.display = "none";
  successState.style.display = "flex";
});

makeAnotherBtn.addEventListener("click", () => {
  successState.style.display = "none";
  userLoaded = false;
  uploadArea.style.display = "flex";
  canvasWrapper.style.display = "none";
  controls.style.display = "none";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fileInput.value = "";
  downloadBtn.disabled = true;
});

resetBtn.addEventListener("click", () => {
  userLoaded = false;
  successState.style.display = "none";
  uploadArea.style.display = "flex";
  canvasWrapper.style.display = "none";
  controls.style.display = "none";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fileInput.value = "";
  downloadBtn.disabled = true;
});

/* ---------- Canvas drag (mouse) ---------- */
canvas.addEventListener("mousedown", (e) => {
  if (!userLoaded) return;
  isDragging = true;
  startX = e.offsetX * (PREVIEW_SIZE / canvas.clientWidth);
  startY = e.offsetY * (PREVIEW_SIZE / canvas.clientHeight);
  dragHint.classList.remove("show");
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});
canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const sx = PREVIEW_SIZE / canvas.clientWidth;
  const sy = PREVIEW_SIZE / canvas.clientHeight;
  const curX = e.offsetX * sx;
  const curY = e.offsetY * sy;
  offsetX += curX - startX;
  offsetY += curY - startY;
  startX = curX;
  startY = curY;
  clampTransform();
  draw();
});

/* ---------- Touch: drag + pinch ---------- */
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (!userLoaded) return;
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragHint.classList.remove("show");
    } else if (e.touches.length === 2) {
      lastPinchDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
    }
  },
  { passive: false },
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!userLoaded) return;
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      offsetX += dx * (PREVIEW_SIZE / canvas.clientWidth);
      offsetY += dy * (PREVIEW_SIZE / canvas.clientHeight);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      clampTransform();
      draw();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      if (lastPinchDist) {
        const delta = dist / lastPinchDist;
        scale *= delta;
        const minScalePreview = Math.max(
          PHOTO_AREA_PREVIEW / userImg.width,
          PHOTO_AREA_PREVIEW / userImg.height,
        );
        if (scale < minScalePreview) scale = minScalePreview;
        if (scale > 6) scale = 6;
        zoomEl.value = scale.toFixed(2);
        clampTransform();
        draw();
      }
      lastPinchDist = dist;
    }
  },
  { passive: false },
);

canvas.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) lastPinchDist = null;
  if (e.touches.length === 0) isDragging = false;
});

/* ---------- Init ---------- */
(function init() {
  canvasWrapper.style.display = "none";
  controls.style.display = "none";
  successState.style.display = "none";
  downloadBtn.disabled = true;
})();
