/* ---------- Config / elements ---------- */
const PREVIEW_SIZE = 1080;
const EXPORT_SIZE = 1280;

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

/* ---------- Frame ---------- */
const frame = new Image();
frame.src = "frame.png";

/* ---------- State ---------- */
let userImg = new Image();
let userLoaded = false;
let scale = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let startX = 0, startY = 0;
let lastPinchDist = null;

/* ---------- Utility ---------- */
function showError(msg) {
  errorToast.textContent = msg;
  errorToast.style.display = "block";
  setTimeout(() => errorToast.style.display = "none", 3000);
}

/* ---------- Constraints ---------- */
function clampTransform() {
  if (!userImg || !userImg.width) return;

  const minScalePreview = Math.max(PREVIEW_SIZE / userImg.width, PREVIEW_SIZE / userImg.height);
  if (scale < minScalePreview) scale = minScalePreview;

  const iw = userImg.width * scale;
  const ih = userImg.height * scale;

  const minX = Math.min(0, PREVIEW_SIZE - iw);
  const maxX = Math.max(0, PREVIEW_SIZE - iw); // ensure image can't go beyond canvas
  const minY = Math.min(0, PREVIEW_SIZE - ih);
  const maxY = Math.max(0, PREVIEW_SIZE - ih);

  if (offsetX > 0) offsetX = 0;
  if (offsetX < PREVIEW_SIZE - iw) offsetX = PREVIEW_SIZE - iw;
  if (offsetY > 0) offsetY = 0;
  if (offsetY < PREVIEW_SIZE - ih) offsetY = PREVIEW_SIZE - ih;
}

/* ---------- Draw ---------- */
function draw(targetCanvas = canvas, targetCtx = ctx, size = PREVIEW_SIZE) {
  if (!userLoaded || !frame.complete) return;

  clampTransform();

  const sf = size / PREVIEW_SIZE;
  const iw_out = userImg.width * scale * sf;
  const ih_out = userImg.height * scale * sf;
  const x = offsetX * sf;
  const y = offsetY * sf;

  targetCanvas.width = size;
  targetCanvas.height = size;
  targetCtx.clearRect(0, 0, size, size);
  targetCtx.drawImage(userImg, x, y, iw_out, ih_out);
  targetCtx.drawImage(frame, 0, 0, size, size);
}

/* ---------- File Handling ---------- */
function handleFile(file) {
  if (!file) return;
  const valid = ["image/png","image/jpeg"];
  if (!valid.includes(file.type)) {
    showError("File type not supported. Upload .png or .jpg");
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

      // Auto-fit to cover preview
      const sx = PREVIEW_SIZE / userImg.width;
      const sy = PREVIEW_SIZE / userImg.height;
      scale = Math.max(sx, sy);
      offsetX = 0;
      offsetY = 0;

      zoomEl.value = scale.toFixed(2);
      downloadBtn.disabled = false;

      draw();
      dragHint.classList.add("show");
      setTimeout(()=> dragHint.classList.remove("show"), 2200);
    };
    userImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- Event Listeners ---------- */
function openPicker() { fileInput.click(); }
uploadBox.addEventListener("click", openPicker);
uploadBox.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); }
});
uploadBtn.addEventListener("click", openPicker);
fileInput.addEventListener("change", e => handleFile(e.target.files[0]));

/* Drag anywhere to upload */
window.addEventListener("dragover", e => { e.preventDefault(); });
window.addEventListener("drop", e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

/* ---------- Controls ---------- */
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

/* ---------- Canvas Drag ---------- */
canvas.addEventListener("mousedown", e => {
  if (!userLoaded) return;
  isDragging = true;
  const sf = PREVIEW_SIZE / canvas.clientWidth;
  startX = e.offsetX * sf;
  startY = e.offsetY * sf;
  canvas.style.cursor = "grabbing";
  dragHint.classList.remove("show");
});

window.addEventListener("mouseup", () => { isDragging = false; canvas.style.cursor = "grab"; });
canvas.addEventListener("mouseleave", () => { isDragging = false; canvas.style.cursor = "grab"; });

canvas.addEventListener("mousemove", e => {
  if (!isDragging) return;
  const sf = PREVIEW_SIZE / canvas.clientWidth;
  const curX = e.offsetX * sf;
  const curY = e.offsetY * sf;
  offsetX += curX - startX;
  offsetY += curY - startY;
  startX = curX;
  startY = curY;
  clampTransform();
  draw();
});

/* ---------- Touch ---------- */
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
}, {passive: false});

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
      clampTransform();
      zoomEl.value = scale.toFixed(2);
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
  canvasWrapper.style.display = "none";
  controls.style.display = "none";
  downloadBtn.disabled = true;
})();