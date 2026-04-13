# TruthLens — AI Image Authenticity Detector

A serverless web application that determines whether an image is **AI-generated** or **real/authentic**.

---

## Architecture

```
[User Browser]
     │  Upload image (Firebase Storage SDK)
     ▼
[Firebase Storage]  ──onFinalize trigger──▶  [Cloud Function: onImageUploaded]
                                                        │
[Frontend JS]  ──POST /api/analyse──────────▶  [Cloud Function: api]
                                                        │
                                               [aiDetection.js]
                                               Sightengine API / Simulation
                                                        │
                                               [Firestore: /results]
                                                        │
                                               JSON response ──▶ [UI Result Card]
```

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | HTML / CSS / Vanilla JS |
| Storage | Firebase Storage |
| Serverless | Firebase Cloud Functions (Node.js 18) |
| Database | Cloud Firestore |
| AI Detection | Sightengine `genai` API |
| Hosting | Firebase Hosting |

---

## Team Ownership

| File(s) | Owner |
|---|---|
| `frontend/index.html`, `frontend/style.css`, `frontend/app.js` | **Person 1** — Frontend + Upload |
| `functions/index.js` | **Person 2** — Serverless Backend |
| `functions/aiDetection.js` | **Person 3** — AI Detection |

---

## Setup Guide

### Prerequisites
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- A free Firebase project (console.firebase.google.com)
- A free Sightengine account (sightengine.com) — optional, simulation mode works without it

---

### Step 1 — Clone / open the project
```bash
cd ccproject
```

### Step 2 — Firebase login & init
```bash
firebase login
firebase use --add   # select your Firebase project
```

### Step 3 — Fill in your Firebase config in the frontend
Open `frontend/app.js` and replace the placeholder values in `firebaseConfig` with your
actual values from **Firebase Console → Project Settings → Your apps → SDK setup & configuration**.

### Step 4 — Install function dependencies
```bash
cd functions
npm install
cd ..
```

### Step 5 — Enable Firebase services
In Firebase Console, enable:
- **Authentication** (not required but good practice)
- **Cloud Firestore** (production mode is fine — rules are already written)
- **Storage** (default bucket)
- **Functions** (requires Blaze pay-as-you-go plan, free tier is very generous)

### Step 6 — (Optional) Set Sightengine API credentials
```bash
firebase functions:config:set sightengine.api_user="YOUR_API_USER" sightengine.api_secret="YOUR_API_SECRET"
```
If you skip this, the app runs in **simulation mode** automatically — great for demos.

To force simulation mode explicitly:
```bash
firebase functions:config:set sightengine.simulate="true"
```

### Step 7 — Run locally with emulators
```bash
firebase emulators:start --only functions,firestore,storage,hosting
```
App will be at: http://localhost:5000

For local function config, create `functions/.env`:
```
USE_SIMULATION=true
```

### Step 8 — Deploy to production
```bash
firebase deploy
```
Your app URL: `https://YOUR_PROJECT_ID.web.app`

---

## Decision Logic

```
rawScore = Sightengine "ai_generated" probability (0.0 → 1.0)

if rawScore > 0.70:
    result = "AI-Generated"
    confidence = rawScore
else:
    result = "Authentic / Real"
    confidence = 1 - rawScore
```

---

## Firestore Schema

Collection: `results`
```json
{
  "fileName":      "1713000000000_photo.jpg",
  "imageUrl":      "https://...",
  "rawScore":      0.8412,
  "model":         "Sightengine genai",
  "isAIGenerated": true,
  "confidence":    0.8412,
  "threshold":     0.70,
  "analysedAt":    "2026-04-13T10:00:00.000Z"
}
```

---

## Project Structure

```
ccproject/
├── frontend/               ← Person 1
│   ├── index.html
│   ├── style.css
│   └── app.js
├── functions/
│   ├── index.js            ← Person 2
│   ├── aiDetection.js      ← Person 3
│   └── package.json
├── firebase.json
├── firestore.rules
├── storage.rules
├── .firebaserc
└── README.md
```
