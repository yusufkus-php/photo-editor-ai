const ratioOptions = [
  { id: "9:16", label: "9:16" },
  { id: "4:5", label: "4:5" },
  { id: "1:1", label: "1:1" },
  { id: "3:4", label: "3:4" },
  { id: "2:3", label: "2:3" },
  { id: "16:9", label: "16:9" }
];

const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("imagePreview");
const ratioButtons = document.getElementById("ratioButtons");
const completeButton = document.getElementById("completeButton");
const resultContainer = document.getElementById("result");
const resultActions = document.getElementById("resultActions");
const statusElement = document.getElementById("status");

let selectedFile = null;
let selectedRatio = null;
let originalImage = null;

function createPreview(file) {
  preview.innerHTML = "";

  const img = document.createElement("img");
  img.className = "upload__image";
  img.alt = "Yüklenen fotoğraf";
  img.src = URL.createObjectURL(file);

  preview.appendChild(img);
}

function renderRatioButtons() {
  ratioButtons.innerHTML = "";

  ratioOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ratio";
    button.textContent = option.label;
    button.dataset.value = option.id;

    button.addEventListener("click", () => {
      selectedRatio = option.id;
      document
        .querySelectorAll(".ratio--selected")
        .forEach((el) => el.classList.remove("ratio--selected"));
      button.classList.add("ratio--selected");
      updateButtonState();
    });

    ratioButtons.appendChild(button);
  });
}

function updateButtonState() {
  completeButton.disabled = !selectedFile || !selectedRatio || !originalImage;
}

function showStatus(message, type = "info") {
  statusElement.textContent = message;
  if (message) {
    statusElement.dataset.type = type;
  } else {
    delete statusElement.dataset.type;
  }
}

function clearResult() {
  resultContainer.innerHTML = `
    <div class="result__placeholder">
      Yeni görsel burada görünecek.
    </div>
  `;
  resultActions.innerHTML = "";
}

function parseRatio(value) {
  const [w, h] = value.split(":").map(Number);
  return w / h;
}

function computeTargetSize({ width, height }, ratioValue) {
  const originalRatio = width / height;
  if (Math.abs(originalRatio - ratioValue) < 0.001) {
    return { width, height };
  }

  if (originalRatio > ratioValue) {
    const targetWidth = width;
    const targetHeight = Math.round(width / ratioValue);
    return { width: targetWidth, height: targetHeight };
  }

  const targetHeight = height;
  const targetWidth = Math.round(height * ratioValue);
  return { width: targetWidth, height: targetHeight };
}

function sampleAverageColor(image) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const size = 10;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  let r = 0;
  let g = 0;
  let b = 0;
  const total = size * size;

  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }

  return `rgb(${Math.round(r / total)}, ${Math.round(g / total)}, ${Math.round(b / total)})`;
}

function generateExpandedImage() {
  const ratioValue = parseRatio(selectedRatio);
  const targetSize = computeTargetSize(originalImage, ratioValue);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize.width;
  canvas.height = targetSize.height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = sampleAverageColor(originalImage);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scaleToCover = Math.max(
    canvas.width / originalImage.width,
    canvas.height / originalImage.height
  ) * 1.1;
  const coverWidth = originalImage.width * scaleToCover;
  const coverHeight = originalImage.height * scaleToCover;
  const coverX = (canvas.width - coverWidth) / 2;
  const coverY = (canvas.height - coverHeight) / 2;

  ctx.filter = "blur(80px) saturate(115%)";
  ctx.drawImage(originalImage, coverX, coverY, coverWidth, coverHeight);
  ctx.filter = "none";

  const scaleToContain = Math.min(
    canvas.width / originalImage.width,
    canvas.height / originalImage.height
  );
  const containWidth = originalImage.width * scaleToContain;
  const containHeight = originalImage.height * scaleToContain;
  const containX = (canvas.width - containWidth) / 2;
  const containY = (canvas.height - containHeight) / 2;

  ctx.drawImage(originalImage, containX, containY, containWidth, containHeight);

  return canvas.toDataURL("image/jpeg", 0.92);
}

function displayResult(dataUrl) {
  const imageElement = document.createElement("img");
  imageElement.className = "result__image";
  imageElement.alt = `${selectedRatio} oranında tamamlanan fotoğraf`;
  imageElement.src = dataUrl;

  const downloadLink = document.createElement("a");
  downloadLink.href = dataUrl;
  downloadLink.download = `expanded-${selectedRatio.replace(":", "-")}.jpg`;
  downloadLink.className = "button button--ghost";
  downloadLink.textContent = "Sonucu İndir";

  resultContainer.innerHTML = "";
  resultContainer.appendChild(imageElement);
  resultActions.innerHTML = "";
  resultActions.appendChild(downloadLink);
}

async function processImage() {
  try {
    showStatus("Görsel işleniyor, lütfen bekleyin...");
    completeButton.disabled = true;
    completeButton.classList.add("button--loading");

    const dataUrl = generateExpandedImage();
    displayResult(dataUrl);
    showStatus("Görsel başarıyla genişletildi.", "success");
  } catch (error) {
    console.error(error);
    showStatus("Görsel işlenirken hata oluştu.", "error");
  } finally {
    completeButton.classList.remove("button--loading");
    updateButtonState();
  }
}

imageInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) {
    selectedFile = null;
    originalImage = null;
    preview.innerHTML = '<span class="upload__placeholder">Henüz fotoğraf seçilmedi.</span>';
    updateButtonState();
    clearResult();
    showStatus("");
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      createPreview(file);
      updateButtonState();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);

  clearResult();
  showStatus("");
});

completeButton.addEventListener("click", () => {
  if (!selectedFile || !selectedRatio || !originalImage) {
    return;
  }
  processImage();
});

renderRatioButtons();
updateButtonState();
clearResult();
