// ─────────────────────────────────────────────
// TruthLens — frontend app.js
// Person 1 owns this file
// ─────────────────────────────────────────────

//─ Firebase Config ──────────────────────────
// Replace these values with your Firebase project config
// (Firebase Console → Project Settings → Your Apps → SDK setup)
const firebaseConfig = {
  apiKey: "AIzaSyBlap8XCNmKd7qAh2TgmINN_Hh_IjopZTY",
  authDomain: "cloudlab-eb9e3.firebaseapp.com",
  projectId: "cloudlab-eb9e3",
  storageBucket: "cloudlab-eb9e3.firebasestorage.app", // Corrected storage bucket
  messagingSenderId: "287047121500",
  appId: "1:287047121500:web:8122b388ee03cd98bf4499"
};

firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();
const firestore = firebase.firestore();

// ── Connect to emulators when running locally ─
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  storage.useEmulator("localhost", 9199);
  firestore.useEmulator("localhost", 8090);
}

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
dropZone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });

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

// ── File selected ────────────────────────────
function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    showError("Please select a valid image file (JPG, PNG, WEBP).");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError("File is too large. Maximum size is 10 MB.");
    return;
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

  // Show progress
  uploadCard.classList.add("hidden");
  resultCard.classList.add("hidden");
  errorCard.classList.add("hidden");
  progressSection.classList.remove("hidden");
  setProgress("Uploading image to Firebase Storage…");

  try {
    // 1. Upload to Firebase Storage
    const fileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, "_")}`;
    const storageRef = storage.ref(`uploads/${fileName}`);
    const uploadTask = storageRef.put(selectedFile);

    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed",
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(`Uploading… ${pct}%`);
        },
        reject,
        resolve
      );
    });

    setProgress("Image uploaded. Running AI analysis…");

    // 2. Get the public download URL.
    // On the emulator, getDownloadURL() triggers a cross-origin preflight to
    // 127.0.0.1:9199 that the Storage emulator rejects (no CORS headers).
    // Construct the URL directly instead; in production use the SDK method.
    let downloadURL;
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      const encodedPath = encodeURIComponent(`uploads/${fileName}`);
      downloadURL = `http://127.0.0.1:9199/v0/b/${firebaseConfig.storageBucket}/o/${encodedPath}?alt=media`;
    } else {
      downloadURL = await storageRef.getDownloadURL();
    }

    // 3. Call the backend API (Render.com in production, local server in dev)
    const apiBase = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
      ? "http://localhost:3000"
      : "https://ccproject.onrender.com";
    const response = await fetch(`${apiBase}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: downloadURL, fileName })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Server error" }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    setProgress("Analysis complete!");

    // 4. Show result
    setTimeout(() => showResult(result), 400);

  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong. Please try again.");
  }
}

// ── Show result ──────────────────────────────
function showResult(data) {
  progressSection.classList.add("hidden");
  resultCard.classList.remove("hidden");

  const isAI = data.isAIGenerated;
  const confidence = Math.round((data.confidence || 0) * 100);
  const type = isAI ? "ai" : "real";

  // Badge
  resultBadge.textContent = isAI ? "🤖" : "📷";
  resultBadge.className = `result-badge ${type}`;

  // Label
  resultLabel.textContent = isAI ? "AI-Generated" : "Authentic / Real";
  resultLabel.className = `result-label ${type}`;

  // Confidence bar (animate after paint)
  confidenceBar.className = `confidence-bar ${type}`;
  requestAnimationFrame(() => {
    confidenceBar.style.width = `${confidence}%`;
  });
  confidenceText.textContent = `Confidence: ${confidence}%`;

  // Meta info
  resultMeta.innerHTML = `
    <strong>File:</strong> ${data.fileName || selectedFile?.name || "—"}<br>
    <strong>Detection model:</strong> ${data.model || "Sightengine AI"}<br>
    <strong>Raw AI score:</strong> ${(data.rawScore || 0).toFixed(4)}<br>
    <strong>Threshold:</strong> &gt; 0.70 → AI-generated<br>
    <strong>Analysed at:</strong> ${new Date(data.analysedAt || Date.now()).toLocaleString()}
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
