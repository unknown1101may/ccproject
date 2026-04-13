/**
 * TruthLens — AI Detection Module
 * Person 3 owns this file
 *
 * Provides: detectAIImage(imageUrl)
 *
 * Two modes (set USE_SIMULATION=true in .env / Firebase config for demo):
 *   1. REAL   → Sightengine API (ai-generated-text detector)
 *   2. SIMULATED → deterministic fake scores for offline demos
 */

const axios    = require("axios");
const FormData = require("form-data");
const functions = require("firebase-functions");

// ── Config ─────────────────────────────────────
// Store these in Firebase environment config:
//   firebase functions:config:set sightengine.api_user="xxx" sightengine.api_secret="yyy"
// Or in a local .env file when using the emulator.
function getConfig() {
  try {
    const cfg = functions.config();
    return {
      apiUser:       cfg.sightengine?.api_user   || process.env.SIGHTENGINE_USER   || "",
      apiSecret:     cfg.sightengine?.api_secret || process.env.SIGHTENGINE_SECRET || "",
      useSimulation: cfg.sightengine?.simulate   === "true" || process.env.USE_SIMULATION === "true",
    };
  } catch {
    // Running outside Firebase (unit tests, etc.)
    return {
      apiUser:       process.env.SIGHTENGINE_USER   || "",
      apiSecret:     process.env.SIGHTENGINE_SECRET || "",
      useSimulation: process.env.USE_SIMULATION === "true",
    };
  }
}

// ── Main export ────────────────────────────────
/**
 * Analyse an image URL and return a raw AI-generated score.
 *
 * @param {string} imageUrl  Public URL of the image to analyse
 * @returns {Promise<{ rawScore: number, model: string, raw: object }>}
 *   rawScore: 0.0 (definitely real) → 1.0 (definitely AI-generated)
 */
async function detectAIImage(imageUrl) {
  const { apiUser, apiSecret, useSimulation } = getConfig();

  if (useSimulation || !apiUser || !apiSecret) {
    return simulatedDetection(imageUrl);
  }

  return sightengineDetection(imageUrl, apiUser, apiSecret);
}

// ── Sightengine API ────────────────────────────
/**
 * Real AI detection via Sightengine's "genai" model.
 * Docs: https://sightengine.com/docs/genai
 *
 * The API returns:
 *   type.ai_generated  : 0.0–1.0  (probability image is AI-generated)
 */
async function sightengineDetection(imageUrl, apiUser, apiSecret) {
  const params = new URLSearchParams({
    url:        imageUrl,
    models:     "genai",
    api_user:   apiUser,
    api_secret: apiSecret,
  });

  const response = await axios.get(
    `https://api.sightengine.com/1.0/check.json?${params.toString()}`,
    { timeout: 20_000 }
  );

  const data = response.data;

  if (data.status !== "success") {
    throw new Error(`Sightengine error: ${data.error?.message || JSON.stringify(data)}`);
  }

  const rawScore = data.type?.ai_generated ?? 0;

  return {
    rawScore,
    model: "Sightengine genai",
    raw:   data,
  };
}

// ── Simulation mode ────────────────────────────
/**
 * Deterministic simulation for demos / when no API key is set.
 * Uses a hash of the image URL to produce consistent scores —
 * so the same image always gets the same result in a demo.
 */
function simulatedDetection(imageUrl) {
  // Simple numeric hash of the URL
  let hash = 0;
  for (let i = 0; i < imageUrl.length; i++) {
    hash = (hash * 31 + imageUrl.charCodeAt(i)) >>> 0;
  }

  // Map hash to 0.0–1.0, biased toward the extremes (more realistic demo)
  const base = (hash % 1000) / 1000;  // 0.0 – 0.999

  let rawScore;
  if (base < 0.5) {
    // Low scores (real images) — cluster near 0.05–0.35
    rawScore = 0.05 + base * 0.60;
  } else {
    // High scores (AI images) — cluster near 0.65–0.95
    rawScore = 0.65 + (base - 0.5) * 0.60;
  }

  rawScore = Math.min(0.99, Math.max(0.01, rawScore));

  return Promise.resolve({
    rawScore,
    model: "Simulation (demo mode)",
    raw:   { simulated: true, inputHash: hash },
  });
}

module.exports = { detectAIImage };
