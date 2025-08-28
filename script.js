/* ---------- Config / elements ---------- */
const PREVIEW_SIZE = 1080; // internal preview resolution
const EXPORT_SIZE = 1280; // export resolution

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

canvas.width = PREVIEW_SIZE;
canvas.height = PREVIEW_SIZE;

/* frame overlay */
const frame = new Image();
frame.src = "frame.png";

/* state */
let userImg = new Image();
let userLoaded = false;
let scale = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let startX = 0, startY = 0;
let lastPinchDist = null;

/* utility: show error toast */
function showError(msg) {
  errorToast.textContent = msg;
  errorToast.style.display = "block";
  setTimeout(() => errorToast.style.display = "none", 3000);
}

/* ---------- Core math: constraints & draw ---------- */
function clampTransform() {
  if (!userImg || !userImg.width) return;

  const minScalePreview = Math.max(PREVIEW_SIZE / userImg.width, PREVIEW_SIZE / userImg.height);
  if (scale < minScalePreview) scale = minScalePreview;

  const iw_preview = userImg.width * scale;
  const ih_preview = userImg.height * scale;

  // Clamp offsets so image always covers canvas
  const minX = Math.min(0, PREVIEW_SIZE - iw_preview);
  const maxX = Math.max(0, PREVIEW_SIZE - iw_preview);
  const minY = Math.min(0, PREVIEW_SIZE - ih_preview);
  const maxY = Math.max(0, PREVIEW_SIZE - ih_preview);

  if (iw_preview > PREVIEW_SIZE) {
    if (offsetX > 0) offsetX = 0;
    if (offsetX < PREVIEW_SIZE - iw_preview) offsetX = PREVIEW_SIZE - iw_preview;
  } else {
    offsetX = (PREVIEW_SIZE - iw_preview)/2;
  }

  if (ih_preview > PREVIEW_SIZE) {
    if (offsetY > 0) offsetY = 0;
    if (offsetY < PREVIEW_SIZE - ih_preview) offsetY = PREVIEW_SIZE - ih_preview;
  } else {
    offsetY = (PREVIEW_SIZE - ih_preview)/2;
  }
}

function draw(targetCanvas = canvas, targetCtx = ctx, size = PREVIEW_SIZE) {
  if (!userLoaded || !frame.complete) return;

  clampTransform();
  const sf = size / PREVIEW_SIZE;

  const iw_out = userImg.width * scale * sf;
  const ih_out = userImg.height * scale * sf;
  const offsetX_out = offsetX * sf;
  const offsetY_out = offsetY * sf;

  targetCanvas.width = size;
  targetCanvas.height = size;
  targetCtx.clearRect(0, 0, size, size);
  targetCtx.drawImage(userImg, offsetX_out, offsetY_out, iw_out, ih_out);
  targetCtx.drawImage(frame, 0, 0, size, size);
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

      // initial auto-fit scale
      scale = Math.max(PREVIEW_SIZE / userImg.width, PREVIEW_SIZE / userImg.height);
      offsetX = (PREVIEW_SIZE - userImg.width*scale)/2;
      offsetY = (PREVIEW_SIZE - userImg.height*scale)/2;

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

/* Open file picker */
function openPicker() { fileInput.click(); }
uploadBox.addEventListener("click", openPicker);
uploadBtn.addEventListener("click", openPicker);
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

/* Drag anywhere on window */
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

/* Controls: zoom, download, reset */
zoomEl.addEventListener("input", () => {
  scale = parseFloat(zoomEl.value);
  clampTransform();
  draw();
});

downloadBtn.addEventListener("click", () => {
  if (!userLoaded) return;
  const out = document.createElement("canvas");
  const octx = out.getContext("2d");
  draw(out, octx, EXPORT_SIZE);
  const a = document.createElement("a");
  a.download = "dp-trans.png";
  a.href = out.toDataURL("image/png");
  a.click();
});

resetBtn.addEventListener("click", () => {
  userLoaded = false;
  uploadArea.style.display = "flex";
  canvasWrapper.style.display = "none";
  controls.style.display = "none";
  ctx.clearRect(0,0,canvas.width,canvas.height);
  fileInput.value = "";
  downloadBtn.disabled = true;
});

/* ---------- Canvas drag (mouse) ---------- */
canvas.addEventListener("mousedown", e => {
  if (!userLoaded) return;
  isDragging = true;
  startX = e.offsetX * (PREVIEW_SIZE / canvas.clientWidth);
  startY = e.offsetY * (PREVIEW_SIZE / canvas.clientHeight);
  canvas.style.cursor = "grabbing";
  dragHint.classList.remove("show");
});

window.addEventListener("mouseup", () => { isDragging = false; canvas.style.cursor="grab"; });
canvas.addEventListener("mouseleave", () => { isDragging=false; canvas.style.cursor="grab"; });

canvas.addEventListener("mousemove", e => {
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
canvas.addEventListener("touchstart", e => {
  if (!userLoaded) return;
  if (e.touches.length === 1) {
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragHint.classList.remove("show");
  } else if (e.touches.length === 2) {
    lastPinchDist = Math.hypot(
      e.touches[1].clientX - e.touches[0].clientX,
      e.touches[1].clientY - e.touches[0].clientY
    );
  }
}, {passive:false});

canvas.addEventListener("touchmove", e => {
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
      e.touches[1].clientY - e.touches[0].clientY
    );
    if (lastPinchDist) {
      const delta = dist / lastPinchDist;
      scale *= delta;
      const minScalePreview = Math.max(PREVIEW_SIZE/userImg.width, PREVIEW_SIZE/userImg.height);
      if (scale < minScalePreview) scale = minScalePreview;
      if (scale > 6) scale = 6;
      zoomEl.value = scale.toFixed(2);
      clampTransform();
      draw();
    }
    lastPinchDist = dist;
  }
}, {passive:false});

canvas.addEventListener("touchend", e => {
  if (e.touches.length < 2) lastPinchDist = null;
  if (e.touches.length === 0) isDragging = false;
});

/* ---------- Init ---------- */
(function init() {
  canvasWrapper.style.display="none";
  controls.style.display="none";
  downloadBtn.disabled = true;
})();