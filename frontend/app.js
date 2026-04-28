// ─────────────────────────────────────────────
// TruthLens — frontend app.js (FIXED VERSION)
// ─────────────────────────────────────────────

// ── Firebase Config ──────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBlap8XCNmKd7qAh2TgmINN_Hh_IjopZTY",
  authDomain: "cloudlab-eb9e3.firebaseapp.com",
  projectId: "cloudlab-eb9e3",
  storageBucket: "cloudlab-eb9e3.firebasestorage.app",
  messagingSenderId: "287047121500",
  appId: "1:287047121500:web:8122b388ee03cd98bf4499"
};

firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();
const firestore = firebase.firestore();

// ── Environment check ─────────────────────────
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

// ── Connect to emulators (only local) ────────
if (isLocal) {
  storage.useEmulator("localhost", 9199);
  firestore.useEmulator("localhost", 8090);
}

// ── API Base URL (FIXED) ─────────────────────
const API_BASE = isLocal
  ? "http://localhost:3000"
  : "https://ccproject-1.onrender.com";

// ── DOM refs ─────────────────────────────────
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const previewWrap = document.getElementById("previewWrap");
const previewImg = document.getElementById("previewImg");
const btnClear = document.getElementById("btnClear");
const btnAnalyse = document.getElementById("btnAnalyse");
const uploadCard = document.getElementById("uploadCard");
const progressSection = document.getElementById("progressSection");
const progressMsg = document.getElementById("progressMsg");
const resultCard = document.getElementById("resultCard");
const resultBadge = document.getElementById("resultBadge");
const resultLabel = document.getElementById("resultLabel");
const confidenceBar = document.getElementById("confidenceBar");
const confidenceText = document.getElementById("confidenceText");
const resultMeta = document.getElementById("resultMeta");
const btnReset = document.getElementById("btnReset");
const errorCard = document.getElementById("errorCard");
const errorMsg = document.getElementById("errorMsg");
const btnRetry = document.getElementById("btnRetry");

let selectedFile = null;

// ── Drag-and-drop ─────────────────────────────
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

// ── File handling ────────────────────────────
function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    return showError("Please select a valid image file.");
  }

  if (file.size > 10 * 1024 * 1024) {
    return showError("File too large (max 10MB).");
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    previewWrap.classList.remove("hidden");
    dropZone.style.display = "none";
    btnAnalyse.disabled = false;
  };
  reader.readAsDataURL(file);
}

btnClear.addEventListener("click", resetUpload);

function resetUpload() {
  selectedFile = null;
  fileInput.value = "";
  previewImg.src = "";
  previewWrap.classList.add("hidden");
  dropZone.style.display = "";
  btnAnalyse.disabled = true;
}

// ── Analyse ──────────────────────────────────
btnAnalyse.addEventListener("click", analyseImage);
btnReset.addEventListener("click", fullReset);
btnRetry.addEventListener("click", fullReset);

async function analyseImage() {
  if (!selectedFile) return;

  uploadCard.classList.add("hidden");
  resultCard.classList.add("hidden");
  errorCard.classList.add("hidden");
  progressSection.classList.remove("hidden");

  setProgress("Uploading image...");

  try {
    // 1. Upload to Firebase
    const fileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, "_")}`;
    const storageRef = storage.ref(`uploads/${fileName}`);
    const uploadTask = storageRef.put(selectedFile);

    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed",
        snap => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setProgress(`Uploading... ${pct}%`);
        },
        reject,
        resolve
      );
    });

    setProgress("Running AI analysis...");

    // 2. Get download URL
    const downloadURL = isLocal
      ? `http://127.0.0.1:9199/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(`uploads/${fileName}`)}?alt=media`
      : await storageRef.getDownloadURL();

    // 3. Call backend (FIXED)
    const response = await fetch(`${API_BASE}/analyse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ imageUrl: downloadURL, fileName })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    setTimeout(() => showResult(result), 300);

  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong");
  }
}

// ── Show result ──────────────────────────────
function showResult(data) {
  progressSection.classList.add("hidden");
  resultCard.classList.remove("hidden");

  const isAI = data.isAIGenerated;
  const confidence = Math.round((data.confidence || 0) * 100);
  const type = isAI ? "ai" : "real";

  resultBadge.textContent = isAI ? "🤖" : "📷";
  resultBadge.className = `result-badge ${type}`;

  resultLabel.textContent = isAI ? "AI Generated" : "Real Image";
  resultLabel.className = `result-label ${type}`;

  confidenceBar.className = `confidence-bar ${type}`;
  requestAnimationFrame(() => {
    confidenceBar.style.width = `${confidence}%`;
  });

  confidenceText.textContent = `Confidence: ${confidence}%`;

  resultMeta.innerHTML = `
    <strong>File:</strong> ${data.fileName}<br>
    <strong>Model:</strong> ${data.model}<br>
    <strong>Score:</strong> ${data.rawScore}<br>
  `;
}

// ── Helpers ──────────────────────────────────
function showError(msg) {
  progressSection.classList.add("hidden");
  uploadCard.classList.add("hidden");
  resultCard.classList.add("hidden");
  errorCard.classList.remove("hidden");
  errorMsg.textContent = msg;
}

function setProgress(msg) {
  progressMsg.textContent = msg;
}

function fullReset() {
  resultCard.classList.add("hidden");
  errorCard.classList.add("hidden");
  progressSection.classList.add("hidden");
  uploadCard.classList.remove("hidden");
  resetUpload();
}
