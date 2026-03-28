# AirScript — AI-Powered Air Writing and Drawing System

An intelligent, touchless human-computer interaction system that allows users to write or draw in the air using hand gestures. Hand movements are captured via webcam and converted into digital content in real time using computer vision, deep learning, and natural language processing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React)                         │
│  Hand Tracking (MediaPipe) → Canvas → Stroke Collection     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST /api/*
┌──────────────────────────▼──────────────────────────────────┐
│                 Backend (Express / TypeScript)               │
│           Route orchestration, health checks, proxy         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST /predict, /process-text,
                           │          /suggest, /learn, etc.
┌──────────────────────────▼──────────────────────────────────┐
│                  AI Service (FastAPI / Python)               │
│  CNN Prediction │ Text Correction │ NLP Suggestions │ Learn │
└─────────────────────────────────────────────────────────────┘
```

## Live Deployment

- **Frontend (Vercel):** [https://airscript-frontend.vercel.app/](https://airscript-frontend.vercel.app/)
- **AI Backend (Hugging Face Spaces):** [https://saminul-amin-airscript-backend.hf.space](https://saminul-amin-airscript-backend.hf.space)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, MediaPipe Hands, Framer Motion |
| **Backend** | Node.js, Express, TypeScript |
| **AI Service** | Python, FastAPI, PyTorch, SymSpell, wordfreq |
| **Model** | Custom CNN trained on EMNIST Balanced (47 classes) with TorchScript JIT |

## Key Features

- **Air writing & drawing** via webcam hand tracking
- **Dual mode** — Drawing Mode and Writing Mode
- **Gesture controls**
- **Real-time character recognition** using a CNN model
- **Context-aware text correction** — character disambiguation, spell correction, punctuation
- **Predictive text & autocomplete** powered by word frequency analysis
- **Personal dictionary** — learns from user corrections over time
- **Keyboard shortcuts** for power users
- **Export** — save output as image or text

## Project Structure

```
capstone-project-v3/
├── ai-service/          # Python FastAPI — ML model, NLP, correction pipeline
│   ├── correction/      # Spell correction, disambiguation, punctuation
│   ├── nlp/             # Word prediction, autocomplete, personal dictionary
│   ├── model.py         # CNN architecture (CharCNN)
│   ├── train.py         # Training script (EMNIST Balanced)
│   ├── predict.py       # Inference pipeline
│   ├── preprocessing.py # Image preprocessing (10-step pipeline)
│   ├── model_loader.py  # Singleton loader with JIT optimization
│   └── main.py          # FastAPI app with all endpoints
├── server/              # Node.js Express — API gateway
│   └── src/
│       ├── controllers/ # Request handlers
│       ├── routes/      # Route definitions
│       ├── services/    # Business logic & AI service proxy
│       └── types/       # TypeScript type definitions
├── client/              # React frontend
│   └── src/
│       ├── components/  # UI components (Canvas, Webcam, Panels, etc.)
│       ├── hooks/       # Custom hooks (canvas, gestures, tracking, etc.)
│       └── utils/       # API calls, drawing helpers, export
└── docs/
    ├── problem-definition.md
    └── project-proposal.md
```

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- A webcam (for hand tracking)

## Setup

### 1. AI Service

```bash
cd ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

**Train the model** (first time only — downloads EMNIST automatically):
```bash
python train.py
```

**Start the service:**
```bash
uvicorn main:app --port 8000 --reload
```

### 2. Backend Server

```bash
cd server
npm install
npm run dev
```

The server starts on `http://localhost:5000` and proxies AI requests to port 8000.

### 3. Frontend Client

```bash
cd client
npm install
npm run dev
```

The client starts on `http://localhost:3000` with a proxy to the backend.

## Usage

1. Start all three services (AI → Server → Client).
2. Open `http://localhost:3000` in a browser with webcam access.
3. Switch between **Drawing Mode** and **Writing Mode** using the mode toggle.
4. Use hand gestures to write/draw in the air — the system captures strokes, recognizes characters, and builds corrected text in real time.
5. Use the suggestions panel for auto-completion or the output panel to review and edit recognized text.

## Author

**Md. Saminul Amin**
- GitHub: [@saminul-amin](https://github.com/saminul-amin)
- LinkedIn: [Md. Saminul Amin](https://linkedin.com/in/md-saminul-amin/)
- Contact: +880 1326 874 247
- Email: saminul.amin@gmail.com
- Project Repository: [air-script](https://github.com/saminul-amin/air-script)

## License

This project was developed as a capstone project.
