const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');
const baseCanvas = document.createElement('canvas');
const baseCtx = baseCanvas.getContext('2d');

const canvasWrapper = document.querySelector('.canvas-wrapper');
const emptyState = document.getElementById('empty-state');
const selectionBox = document.getElementById('selection-box');

const imageInput = document.getElementById('image-input');
const resetImageBtn = document.getElementById('reset-image');
const undoBtn = document.getElementById('undo');
const downloadBtn = document.getElementById('download');
const rotateBtns = Array.from(document.querySelectorAll('button.rotate'));
const flipBtns = Array.from(document.querySelectorAll('button.flip'));
const autoEnhanceBtn = document.getElementById('auto-enhance');
const resetFiltersBtn = document.getElementById('reset-filters');
const toggleCropBtn = document.getElementById('toggle-crop');
const applyCropBtn = document.getElementById('apply-crop');
const cancelCropBtn = document.getElementById('cancel-crop');

const filterInputs = Array.from(document.querySelectorAll('.slider-group input[type="range"]'));

const DEFAULT_FILTERS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  temperature: 0,
  clarity: 0,
  grayscale: 0,
  sepia: 0,
  hue: 0,
  blur: 0,
};

let filterState = { ...DEFAULT_FILTERS };
let imageLoaded = false;
let originalImageData = null;
let cropStart = null;
let cropCurrent = null;
let cropRect = null;
let isCropping = false;
const history = [];

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
if (prefersDark.matches) {
  document.body.classList.add('dark');
}
prefersDark.addEventListener('change', (event) => {
  document.body.classList.toggle('dark', event.matches);
});

imageInput.addEventListener('change', handleImageUpload);
resetImageBtn.addEventListener('click', resetToOriginal);
undoBtn.addEventListener('click', undoLastChange);
downloadBtn.addEventListener('click', downloadImage);
autoEnhanceBtn.addEventListener('click', applyAutoEnhance);
resetFiltersBtn.addEventListener('click', () => {
  setFilters(DEFAULT_FILTERS);
  drawPreview();
});
toggleCropBtn.addEventListener('click', () => {
  if (!imageLoaded) return;
  isCropping = !isCropping;
  cropStart = null;
  cropCurrent = null;
  cropRect = null;
  updateCropUI();
});
applyCropBtn.addEventListener('click', applyCrop);
cancelCropBtn.addEventListener('click', () => {
  isCropping = false;
  cropStart = null;
  cropCurrent = null;
  cropRect = null;
  updateCropUI();
});

rotateBtns.forEach((btn) =>
  btn.addEventListener('click', () => {
    const amount = parseInt(btn.dataset.rotate, 10);
    rotateBase(amount);
  })
);

flipBtns.forEach((btn) =>
  btn.addEventListener('click', () => {
    const direction = btn.dataset.flip;
    flipBase(direction === 'horizontal');
  })
);

filterInputs.forEach((input) => {
  const id = input.id;
  if (!(id in filterState)) {
    return;
  }
  updateValueLabel(id, input.value);
  input.addEventListener('input', () => {
    const value = parseFloat(input.value);
    filterState = { ...filterState, [id]: value };
    updateValueLabel(id, value);
    drawPreview();
  });
});

canvas.addEventListener('pointerdown', (event) => {
  if (!isCropping || !imageLoaded) return;
  const { x, y } = getCanvasCoordinates(event);
  cropStart = { x, y };
  cropCurrent = { x, y };
  cropRect = null;
  selectionBox.hidden = false;
  updateSelectionBox();
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!isCropping || !cropStart) return;
  const { x, y } = getCanvasCoordinates(event);
  cropCurrent = { x, y };
  updateSelectionBox();
});

canvas.addEventListener('pointerup', (event) => {
  if (!isCropping || !cropStart) return;
  const { x, y } = getCanvasCoordinates(event);
  cropCurrent = { x, y };
  canvas.releasePointerCapture(event.pointerId);
  finalizeCropRect();
});

canvas.addEventListener('pointerleave', () => {
  if (!isCropping || !cropStart) return;
  finalizeCropRect();
});

function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      setupBaseImage(image);
      imageLoaded = true;
      canvasWrapper.style.display = 'block';
      emptyState.style.display = 'none';
      enableEditingControls();
      setFilters(DEFAULT_FILTERS);
      drawPreview();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
}

function setupBaseImage(image) {
  baseCanvas.width = image.width;
  baseCanvas.height = image.height;
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  baseCtx.drawImage(image, 0, 0);
  originalImageData = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
  history.length = 0;
  updateUndoState();
}

function drawPreview() {
  if (!imageLoaded) return;
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = buildFilterString(filterState);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.restore();
  if (filterState.clarity > 0) {
    applyClarity(filterState.clarity);
  }
}

function buildFilterString(filters) {
  const parts = [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    `saturate(${filters.saturation}%)`,
    `grayscale(${filters.grayscale}%)`,
    `sepia(${filters.sepia}%)`,
    `hue-rotate(${filters.hue}deg)`,
    `blur(${filters.blur}px)`,
  ];

  if (filters.temperature !== 0) {
    const amount = filters.temperature;
    const intensity = Math.abs(amount) * 0.4;
    const sepia = Math.abs(amount) * 0.2;
    const hue = amount > 0 ? amount * 0.15 : amount * 0.3;
    const saturate = amount > 0 ? 100 + intensity : Math.max(20, 100 - intensity);
    parts.push(`sepia(${sepia}%)`);
    parts.push(`hue-rotate(${hue}deg)`);
    parts.push(`saturate(${saturate}%)`);
  }

  return parts.join(' ');
}

function applyClarity(amount) {
  const sharpening = Math.min(3, Math.max(0, amount));
  if (sharpening <= 0) return;

  const strength = sharpening * 0.5;
  const kernel = [
    0, -strength, 0,
    -strength, 1 + 4 * strength, -strength,
    0, -strength, 0,
  ];

  const { width, height } = canvas;
  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const src = source.data;
  const dst = output.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const index = (py * width + px) * 4;
          r += src[index] * weight;
          g += src[index + 1] * weight;
          b += src[index + 2] * weight;
        }
      }

      const index = (y * width + x) * 4;
      dst[index] = clamp(r);
      dst[index + 1] = clamp(g);
      dst[index + 2] = clamp(b);
      dst[index + 3] = src[index + 3];
    }
  }

  ctx.putImageData(output, 0, 0);
}

function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function setFilters(nextFilters) {
  filterState = { ...filterState, ...nextFilters };
  Object.entries(filterState).forEach(([key, value]) => {
    const input = document.getElementById(key);
    if (input) {
      input.value = value;
      updateValueLabel(key, value);
    }
  });
}

function updateValueLabel(key, value) {
  const label = document.querySelector(`[data-value="${key}"]`);
  if (!label) return;
  let formatted = value;
  switch (key) {
    case 'brightness':
    case 'contrast':
    case 'saturation':
      formatted = `${Math.round(value)}%`;
      break;
    case 'temperature':
      formatted = value > 0 ? `+${value}` : `${value}`;
      break;
    case 'blur':
      formatted = `${Number(value).toFixed(1)}px`;
      break;
    case 'clarity':
      formatted = Number(value).toFixed(1);
      break;
    case 'grayscale':
    case 'sepia':
      formatted = `${Math.round(value)}%`;
      break;
    case 'hue':
      formatted = `${Math.round(value)}°`;
      break;
    default:
      formatted = `${value}`;
  }
  label.textContent = formatted;
}

function enableEditingControls() {
  [resetImageBtn, undoBtn, downloadBtn, autoEnhanceBtn, resetFiltersBtn, toggleCropBtn, applyCropBtn, cancelCropBtn, ...rotateBtns, ...flipBtns].forEach((btn) => {
    btn.disabled = false;
  });
  applyCropBtn.disabled = true;
  cancelCropBtn.disabled = true;
  updateUndoState();
}

function rotateBase(degrees) {
  if (!imageLoaded) return;
  pushHistorySnapshot();
  const radians = (degrees * Math.PI) / 180;
  const width = baseCanvas.width;
  const height = baseCanvas.height;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const newWidth = Math.round(width * cos + height * sin);
  const newHeight = Math.round(width * sin + height * cos);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = newWidth;
  tempCanvas.height = newHeight;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.save();
  tempCtx.translate(newWidth / 2, newHeight / 2);
  tempCtx.rotate(radians);
  tempCtx.drawImage(baseCanvas, -width / 2, -height / 2);
  tempCtx.restore();

  baseCanvas.width = newWidth;
  baseCanvas.height = newHeight;
  baseCtx.clearRect(0, 0, newWidth, newHeight);
  baseCtx.drawImage(tempCanvas, 0, 0);

  drawPreview();
  updateUndoState();
}

function flipBase(horizontal = true) {
  if (!imageLoaded) return;
  pushHistorySnapshot();
  const width = baseCanvas.width;
  const height = baseCanvas.height;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');

  tempCtx.save();
  tempCtx.translate(horizontal ? width : 0, horizontal ? 0 : height);
  tempCtx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
  tempCtx.drawImage(baseCanvas, 0, 0);
  tempCtx.restore();

  baseCtx.clearRect(0, 0, width, height);
  baseCtx.drawImage(tempCanvas, 0, 0);
  drawPreview();
  updateUndoState();
}

function pushHistorySnapshot() {
  const snapshot = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
  history.push(snapshot);
  if (history.length > 10) {
    history.shift();
  }
}

function undoLastChange() {
  if (!history.length) return;
  const previous = history.pop();
  baseCanvas.width = previous.width;
  baseCanvas.height = previous.height;
  baseCtx.putImageData(previous, 0, 0);
  drawPreview();
  updateUndoState();
}

function updateUndoState() {
  undoBtn.disabled = history.length === 0;
}

function resetToOriginal() {
  if (!originalImageData) return;
  baseCanvas.width = originalImageData.width;
  baseCanvas.height = originalImageData.height;
  baseCtx.putImageData(originalImageData, 0, 0);
  history.length = 0;
  setFilters(DEFAULT_FILTERS);
  drawPreview();
  updateUndoState();
}

function applyAutoEnhance() {
  const enhanced = {
    brightness: 110,
    contrast: 108,
    saturation: 120,
    temperature: 15,
    clarity: 1.2,
    grayscale: 0,
    sepia: 0,
    hue: 0,
    blur: 0,
  };
  setFilters(enhanced);
  drawPreview();
}

function updateCropUI() {
  toggleCropBtn.textContent = isCropping ? 'Seçimi Temizle' : 'Seçim Başlat';
  toggleCropBtn.classList.toggle('primary', isCropping);
  applyCropBtn.disabled = !isCropping || !cropRect;
  cancelCropBtn.disabled = !isCropping;
  if (!isCropping) {
    selectionBox.hidden = true;
  }
}

function updateSelectionBox() {
  if (!cropStart || !cropCurrent) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  const startX = cropStart.x * scaleX;
  const startY = cropStart.y * scaleY;
  const currentX = cropCurrent.x * scaleX;
  const currentY = cropCurrent.y * scaleY;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

function finalizeCropRect() {
  if (!cropStart || !cropCurrent) {
    selectionBox.hidden = true;
    cropRect = null;
    updateCropUI();
    return;
  }

  const x = Math.round(Math.min(cropStart.x, cropCurrent.x));
  const y = Math.round(Math.min(cropStart.y, cropCurrent.y));
  const width = Math.round(Math.abs(cropCurrent.x - cropStart.x));
  const height = Math.round(Math.abs(cropCurrent.y - cropStart.y));

  if (width < 10 || height < 10) {
    cropRect = null;
    selectionBox.hidden = true;
  } else {
    cropRect = { x, y, width, height };
  }

  updateCropUI();
}

function applyCrop() {
  if (!cropRect) return;
  pushHistorySnapshot();
  const { x, y, width, height } = cropRect;
  const cropped = baseCtx.getImageData(x, y, width, height);
  baseCanvas.width = width;
  baseCanvas.height = height;
  baseCtx.putImageData(cropped, 0, 0);
  cropRect = null;
  cropStart = null;
  cropCurrent = null;
  isCropping = false;
  selectionBox.hidden = true;
  drawPreview();
  updateCropUI();
  updateUndoState();
}

function downloadImage() {
  if (!imageLoaded) return;
  const link = document.createElement('a');
  link.download = 'photo-editor-ai.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function getCanvasCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return { x, y };
}
