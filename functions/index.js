/**
 * TruthLens — Cloud Functions (serverless backend)
 * Person 2 owns this file
 *
 * Exposes:
 *   POST /api/analyse  → accepts { imageUrl, fileName }
 *                      → calls AI detection (Person 3 module)
 *                      → applies decision logic
 *                      → stores result in Firestore
 *                      → returns JSON result to frontend
 *
 * Also:
 *   onFinalize trigger → fires when image lands in Storage
 *                      → auto-analyses without frontend call (bonus)
 */

const functions  = require("firebase-functions");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const admin      = require("firebase-admin");
const express    = require("express");
const cors       = require("cors");
const { detectAIImage } = require("./aiDetection");

admin.initializeApp();
const db = admin.firestore();

// ── Decision threshold ────────────────────────
const AI_THRESHOLD = 0.70;

// ── Express app for HTTP API ──────────────────
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * POST /api/analyse
 * Body: { imageUrl: string, fileName: string }
 *
 * This is the main serverless function — triggered by the frontend
 * after the image has been uploaded to Firebase Storage.
 */
app.post("/analyse", async (req, res) => {
  const { imageUrl, fileName } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    functions.logger.info("Analyse request received", { fileName });

    // ── Step 1: Call AI detection module (Person 3) ──
    const detection = await detectAIImage(imageUrl);
    // detection = { rawScore: 0.0–1.0, model: "...", ... }

    // ── Step 2: Apply decision logic ────────────────
    const isAIGenerated = detection.rawScore > AI_THRESHOLD;
    const confidence    = isAIGenerated ? detection.rawScore : (1 - detection.rawScore);

    const result = {
      fileName:      fileName || "unknown",
      imageUrl,
      rawScore:      detection.rawScore,
      model:         detection.model,
      isAIGenerated,
      confidence,
      threshold:     AI_THRESHOLD,
      analysedAt:    new Date().toISOString(),
    };

    functions.logger.info("Analysis result", { isAIGenerated, confidence: result.confidence });

    // ── Step 3: Store result in Firestore ────────────
    const docRef = await db.collection("results").add(result);
    result.docId = docRef.id;

    // ── Step 4: Return to frontend ───────────────────
    return res.status(200).json(result);

  } catch (err) {
    functions.logger.error("Analysis failed", { error: err.message });
    return res.status(500).json({ error: err.message || "Analysis failed" });
  }
});

// Export HTTP function
exports.api = functions.https.onRequest(app);

// ── Storage trigger (bonus / event-driven) ────
// Fires automatically when any image is uploaded to the
// uploads/ folder — demonstrates event-driven serverless pattern.
exports.onImageUploaded = onObjectFinalized(async (event) => {
  const object   = event.data;
  const filePath = object.name || "";
  if (!filePath.startsWith("uploads/")) return null;

  functions.logger.info("Storage trigger: new image", { filePath });

  try {
    // Build a signed URL so AI API can fetch the image
    const bucket = admin.storage().bucket(object.bucket);
    const [signedUrl] = await bucket.file(filePath).getSignedUrl({
      action:  "read",
      expires: Date.now() + 15 * 60 * 1000, // 15 min
    });

    const detection      = await detectAIImage(signedUrl);
    const isAIGenerated  = detection.rawScore > AI_THRESHOLD;
    const confidence     = isAIGenerated ? detection.rawScore : (1 - detection.rawScore);

    await db.collection("results").add({
      fileName:     filePath.split("/").pop(),
      imageUrl:     signedUrl,
      rawScore:     detection.rawScore,
      model:        detection.model,
      isAIGenerated,
      confidence,
      threshold:    AI_THRESHOLD,
      analysedAt:   new Date().toISOString(),
      source:       "storage_trigger",
    });

    functions.logger.info("Storage trigger analysis complete", { isAIGenerated });
  } catch (err) {
    functions.logger.error("Storage trigger failed", { error: err.message });
  }

  return null;
});
