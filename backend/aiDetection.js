/**
 * TruthLens — AI Detection Module (standalone, no Firebase deps)
 */

const axios    = require("axios");
const FormData = require("form-data");

function getConfig() {
  return {
    apiUser:       process.env.SIGHTENGINE_USER   || "",
    apiSecret:     process.env.SIGHTENGINE_SECRET || "",
    useSimulation: process.env.USE_SIMULATION === "true",
  };
}

async function detectAIImage(imageUrl) {
  const { apiUser, apiSecret, useSimulation } = getConfig();

  if (useSimulation || !apiUser || !apiSecret) {
    return simulatedDetection(imageUrl);
  }

  return sightengineDetection(imageUrl, apiUser, apiSecret);
}

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

  return {
    rawScore: data.type?.ai_generated ?? 0,
    model:    "Sightengine genai",
    raw:      data,
  };
}

function simulatedDetection(imageUrl) {
  let hash = 0;
  for (let i = 0; i < imageUrl.length; i++) {
    hash = (hash * 31 + imageUrl.charCodeAt(i)) >>> 0;
  }
  const base = (hash % 1000) / 1000;
  let rawScore;
  if (base < 0.5) {
    rawScore = 0.05 + base * 0.60;
  } else {
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
