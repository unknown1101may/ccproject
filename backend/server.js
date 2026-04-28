/**
 * TruthLens — standalone Express backend for Render.com
 */

const express = require("express");
const cors = require("cors");
const { detectAIImage } = require("./aiDetection");

const app = express();
const PORT = process.env.PORT || 3000;

const AI_THRESHOLD = 0.70;

/**
 * ✅ CORS configuration
 * Allow frontend to access backend
 */
app.use(cors({
  origin: "*", // 🔥 change to your frontend URL later for security
}));

app.use(express.json({ limit: "10mb" }));

/**
 * ✅ Root route (fixes "Cannot GET /")
 */
app.get("/", (_req, res) => {
  res.send("🚀 TruthLens API is running");
});

/**
 * ✅ Health check
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * ✅ Main analysis route
 */
app.post("/analyse", async (req, res) => {
  const { imageUrl, fileName } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    const detection = await detectAIImage(imageUrl);

    const isAIGenerated = detection.rawScore > AI_THRESHOLD;
    const confidence = isAIGenerated
      ? detection.rawScore
      : (1 - detection.rawScore);

    return res.status(200).json({
      fileName: fileName || "unknown",
      imageUrl,
      rawScore: detection.rawScore,
      model: detection.model,
      isAIGenerated,
      confidence,
      threshold: AI_THRESHOLD,
      analysedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error("❌ Analysis failed:", err.message);

    return res.status(500).json({
      error: err.message || "Analysis failed",
    });
  }
});

/**
 * ✅ Handle unknown routes
 */
app.use((req, res) => {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found`,
  });
});

/**
 * ✅ Start server
 */
app.listen(PORT, () => {
  console.log(`🚀 TruthLens API running on port ${PORT}`);
});
