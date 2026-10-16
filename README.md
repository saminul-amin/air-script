# AirScript — touchless air writing and drawing

Write or draw in the air with your hand, or with a mouse or finger, and watch a
CNN plus an NLP pipeline turn the strokes into corrected text. Hand tracking
(MediaPipe) and character recognition (ONNX Runtime Web) both run in the
browser; only the recognised characters go to the server, for correction.

**Try it:** [https://airscript-frontend.vercel.app](https://airscript-frontend.vercel.app)
— no webcam needed. Draw with the mouse, or press *Replay a sample* and the app
demonstrates itself. Hand tracking is an opt-in upgrade ("Use your hand instead").

## Architecture

```mermaid
flowchart TB
    subgraph browser["Browser — React 18, Vite, Tailwind, Framer Motion"]
        direction LR
        IN["Mouse / touch / pen<br/>or webcam + MediaPipe Hands<br/>(on-device)"] --> CV["Canvas<br/>stroke collection & validation"]
        CV --> PRE["Preprocessing<br/>TypeScript port of the<br/>10-step Pillow pipeline<br/>(bit-exact, tested)"]
        PRE --> ORT["ONNX Runtime Web (WASM)<br/>CharCNN, EMNIST Balanced, 47 classes<br/>int8 export, 1.7 MB"]
    end

    GW["Express gateway — TypeScript<br/>proxy, upstream error surfacing,<br/>/api/health with model status"]

    subgraph ai["AI service — FastAPI, Python"]
        direction LR
        COR["Correction<br/>disambiguation, SymSpell,<br/>punctuation"] --> NLP["Prediction<br/>wordfreq, autocomplete,<br/>personal dictionary"]
        FB["Recognition fallback<br/>preprocessing.py + CharCNN (PyTorch)<br/>same weights, same pipeline"]
    end

    ORT -- "characters + confidences<br/>REST /api/process-text, /suggest, /learn" --> GW
    CV -. "PNG, only if WASM is unavailable<br/>/api/predict-character" .-> GW
    GW --> COR
    GW -.-> FB
```

Characters are recognised on the user's device: the strokes are painted to an
off-screen canvas, preprocessed by a TypeScript port of `preprocessing.py`
that matches it bit for bit (see [Checks](#checks)), and classified by the
same CharCNN weights exported to ONNX. The Python service keeps the correction
and prediction pipeline, and still serves recognition as a fallback for
browsers where WebAssembly fails. The Express layer never does inference; it
only routes. The personal dictionary is the one piece of state that persists
between sessions — it learns from corrections the user makes.

The client talks to whatever `VITE_API_BASE_URL` points at. Locally that is
`/api` (the gateway, proxied by Vite). The public frontend points straight at
the Hugging Face Space because the free tiers in use do not host the gateway;
the gateway is still the path exercised by the local setup and its tests.

## Live deployment

| Tier | URL | Notes |
|------|-----|-------|
| Frontend | https://airscript-frontend.vercel.app | Vercel. Deployed with the Vercel CLI, not from git: the live site is whatever was last pushed with `vercel --prod`. |
| AI service | https://saminul-amin-airscript-backend.hf.space | Hugging Face Space, free CPU tier. **Sleeps when idle**: the first request after a quiet period takes up to a minute. Recognition does not depend on it; correction waits for it and the app says so. A daily Vercel cron (`client/api/keep-warm.js`) pings `/health` so it idles less. `GET /health` reports whether trained weights are loaded. |

## Recognition on your device

The browser loads three things after first paint, without blocking drawing:
the ONNX Runtime Web JS bundle (73 KB), its WebAssembly binary (14.2 MB raw,
3.7 MB gzip, 2.3 MB brotli, cached after the first visit), and the model.
Two exports of the same weights are committed, both hashed into the build:

| Export | File | Size | EMNIST top-1 | Load (Chrome, this machine, dev server) | Per character (median) |
|---|---|---|---|---|---|
| int8 dynamic quantisation (**default**) | `emnist_cnn.int8.onnx` | 1.72 MB (1.0 MB brotli) | 87.04 % | 864 ms first visit, 270–500 ms cached | 61 ms = 39.5 ms preprocessing + 22 ms inference |
| fp32 | `emnist_cnn.onnx` | 6.85 MB (6.3 MB brotli) | 87.06 % | 565 ms cached | 44 ms = 38.9 ms preprocessing + 4.6 ms inference |

The int8 export is shipped because it costs 0.02 percentage points of
accuracy for a quarter of the download; its integer kernels are slower in
WASM than fp32 floats, but both are well under the one-second pause that
triggers recognition. `?model=fp32` (or `VITE_LOCAL_MODEL=fp32`) switches.
`?recognition=server` (or `VITE_RECOGNITION=server`) disables on-device
recognition to exercise the fallback. Timings come from
`window.__airscriptRecognition` in a dev build.

What the server is still for: `/process-text` (correction), `/suggest` and
`/autocomplete` (word prediction) and `/learn` (personal dictionary). When it
is asleep or unreachable, characters still appear immediately, the raw text
is shown with a note, and the correction is applied once `/health` answers
again.

## Accuracy

Everything below was produced by `ai-service/evaluate.py` on 17 October 2026
and is stored in [`docs/accuracy-emnist.json`](docs/accuracy-emnist.json).
Nothing here is estimated.

**EMNIST Balanced, test split, 18,800 samples, 47 classes**

| Model | Top-1 | Top-3 |
|---|---|---|
| PyTorch (`emnist_cnn.pth`) | 87.06 % | 98.59 % |
| ONNX fp32 (`emnist_cnn.onnx`) | 87.06 % | 98.59 % |
| ONNX int8 (`emnist_cnn.int8.onnx`) | 87.04 % | 98.59 % |

PyTorch and the fp32 export agree on the top-1 class for all 18,800 samples;
the largest logit difference is 9.5 × 10⁻⁶.

![Confusion matrix on the EMNIST Balanced test split](docs/confusion-matrix-emnist.png)

The ten most confused pairs (true → predicted, share of the true class):
`O`→`0` 42.2 %, `F`→`f` 36.2 %, `q`→`9` 32.8 %, `L`→`1` 32.5 %, `f`→`F` 29.8 %,
`1`→`L` 21.0 %, `I`→`1` 20.5 %, `g`→`9` 17.2 %, `5`→`S` 17.0 %, `0`→`O` 16.2 %.
EMNIST Balanced deliberately merges fifteen lowercase letters into their
uppercase class (c, i, j, k, l, m, o, p, s, u, v, w, x, y, z), so `L` contains
handwritten `l`, which is why `L`/`1`/`I` and `O`/`0` dominate: the shapes are
the same and only context can separate them. That is the job of the
correction pipeline, which turns `HELL0` into `Hello`.

**Real strokes: pending.** A benchmark number is not a real-world number: the
app's strokes are smoother and thicker than EMNIST's scanned pen on paper,
drawn with a mouse or in the air, and sized by the drawing surface rather
than by a scanner. The app has a dev-only recorder (`/?record=1`) that
prompts for each of the 47 classes, captures the strokes and the exact PNG
the recogniser sees, and exports labelled JSON.
`npm run evaluate:real-strokes` in `client/` then runs that set through the
same TypeScript preprocessing and ONNX Runtime the browser uses and writes
`docs/accuracy-real-strokes.json`. The set has not been drawn yet, so there
is no real-strokes figure to report.

## The model and its weights

`ai-service/model.py` defines `CharCNN`, trained on EMNIST Balanced with
`train.py`. The trained checkpoint is committed at
`ai-service/saved_model/emnist_cnn.pth` (6.8 MB) next to its SHA-256 in
`emnist_cnn.sha256`. Two ONNX exports of the same weights sit beside it
(`emnist_cnn.onnx`, `emnist_cnn.int8.onnx`), each with its own `.sha256`, and
`client/models/` holds byte-identical copies for the browser (a client test
fails if they drift).

```bash
cd ai-service
pip install -r requirements-export.txt
python export_onnx.py --quantize     # rewrites the .onnx files and their checksums
cp saved_model/*.onnx ../client/models/
python evaluate.py                   # EMNIST metrics + docs/confusion-matrix-emnist.png
```

The service **refuses to start** if the `.pth` is missing, cannot be loaded
into `CharCNN`, or does not match the pinned checksum. It never serves
predictions from an untrained network. To supply weights another way:

- set `AIRSCRIPT_MODEL_PATH` to a different `.pth`, or
- set `AIRSCRIPT_MODEL_URL` to a downloadable file (for example a Hugging Face
  model file or a GitHub Release asset); it is fetched once at startup, or
- retrain: `pip install -r requirements-train.txt && python train.py`
  (downloads EMNIST, ~2 GB, and writes a new `.pth` — update the `.sha256`
  file with the new checksum, re-export, re-evaluate).

`AIRSCRIPT_ALLOW_MISSING_MODEL=1` starts the text endpoints without a model for
development; `/predict` then answers `503` and `/health` reports `degraded`.
Do not set it in production.

Do not change the layer shapes in `model.py` or the 10-step pipeline in
`preprocessing.py` without retraining; the checkpoint, the ONNX exports, the
TypeScript port and the tests all pin them.

## Project structure

```
air-script/
├── ai-service/            # Python FastAPI — correction pipeline, NLP, recognition fallback
│   ├── correction/        # Spell correction, disambiguation, punctuation
│   ├── nlp/               # Word prediction, autocomplete, personal dictionary
│   ├── saved_model/       # emnist_cnn.pth + .onnx + .int8.onnx, each with a .sha256
│   ├── tests/             # pytest: preprocessing, correction, API, ONNX agreement
│   ├── tools/             # fixture recorder for the TS parity test, confusion plotter
│   ├── model.py           # CharCNN architecture (do not change shapes)
│   ├── preprocessing.py   # 10-step image pipeline (pinned by tests and the TS port)
│   ├── model_loader.py    # Strict loader: checksum, TorchScript trace
│   ├── export_onnx.py     # .pth → ONNX (+ int8), checksums, agreement report
│   ├── evaluate.py        # EMNIST metrics, confusion matrix, most confused pairs
│   ├── emnist_data.py     # Reads the EMNIST IDX files without torchvision
│   ├── predict.py         # Inference → top-3 labels with confidences
│   ├── main.py            # FastAPI app, /health, fail-loud startup
│   ├── train.py           # Training script (EMNIST Balanced)
│   ├── Dockerfile         # CPU-only image for Hugging Face Spaces
│   └── README.md          # Space card (YAML front matter)
├── server/                # Node/Express gateway
│   ├── src/               # config, routes, controllers, services, types
│   └── tests/             # vitest: proxying and upstream error surfacing
├── client/                # React 18 + Vite + Tailwind + Framer Motion
│   ├── models/            # ONNX exports the browser downloads (hashed by Vite)
│   ├── src/recognition/   # preprocess.ts (Pillow port), ORT loader, labels, softmax
│   ├── src/components/    # Canvas, panels, TopBar, ConnectionStrip, RecorderPanel…
│   ├── src/hooks/         # useCanvas, useWordBuilder, useLocalRecognizer,
│   │                      # useServiceStatus, useSampleReplay, useRecorder…
│   ├── src/data/          # Recorded sample strokes for "Replay a sample"
│   ├── scripts/           # fixture renderer, real-strokes evaluator (vite-node)
│   ├── tests/             # vitest + Testing Library; fixtures/preprocessing (70 PNGs + expected.json)
│   └── api/               # Vercel cron: keep the Space awake
└── docs/                  # problem definition, proposal, design plan, accuracy reports
```

## Local setup

Prerequisites: Python 3.10+, Node.js 18+. A webcam is optional.

### 1. AI service (port 8000)

```bash
cd ai-service
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

`requirements.txt` pulls CPU-only PyTorch from the official CPU wheel index.
Check it: `curl http://localhost:8000/health` should show `"loaded": true`.

### 2. Gateway (port 5000)

```bash
cd server
npm install
cp .env.example .env            # optional; defaults point at localhost:8000
npm run dev
```

### 3. Client (port 3000)

```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000. Draw a letter with the mouse; after a one-second
pause it is recognised in the browser, and after a word boundary (Space) it is
corrected by the service. Start the client alone and recognition still works;
the top bar then shows the correction service as waking or offline.

Configuration is by environment variables only; each tier has a committed
`.env.example`, and `.env*` files are git-ignored. Set
`VITE_API_BASE_URL` in `client/.env.local` to point the client somewhere else
(for example straight at the Space, with no `/api` suffix).

## Checks

There is no CI; run these locally. Each tier has one command.

| Tier | Command | What it covers |
|------|---------|----------------|
| ai-service | `pip install -r requirements-dev.txt && pytest` | preprocessing shape/normalisation, correction pipeline (known input → known output), `/predict` and `/health` through `TestClient`, refusal to start without valid weights, and the ONNX exports: pinned checksums, graph contract, PyTorch agreement on random inputs and on the EMNIST test split (top-1 agreement ≥ 99.9 %, int8 within 0.5 pp of fp32). The EMNIST tests skip with a message when the data is not under `data/EMNIST/raw` (run `train.py` once or set `AIRSCRIPT_EMNIST_DIR`). |
| server | `npm run check` | typecheck + gateway proxies JSON and multipart, surfaces upstream status and detail, `/api/health` reports model status |
| client | `npm run check` | typecheck + stroke validation and payload conversion; the word builder (recognition timing, on-device path, server fallback, correction retry when the service is unreachable); **preprocessing parity**: the TypeScript port against `preprocessing.py` on 70 fixtures (currently 70/70 bit-exact, tolerance one grey level), and the ONNX top-1 from the TypeScript input equals the one from the Python input on every fixture for both exports; `client/models` matches the checksums in `ai-service/saved_model` |

Regenerating the parity fixtures after a change to `paintStrokes` or the sample data:

```bash
cd client && npm run fixtures:preprocessing
cd ../ai-service && python tools/make_preprocessing_fixtures.py
```

## Deploying

**AI service → Hugging Face Space** (Docker SDK, port 7860). The Space is the
`ai-service/` folder; `ai-service/README.md` is the Space card.

```bash
pip install -U huggingface_hub
hf auth login
hf upload saminul-amin/airscript-backend ai-service . --repo-type space --exclude "venv/*" "__pycache__/*" "data/*" "tests/*" "*.onnx"
```

Then confirm `https://saminul-amin-airscript-backend.hf.space/health` returns
`"loaded": true` with the checksum from `saved_model/emnist_cnn.sha256`.

**Frontend → Vercel** from the `client/` directory. Set `VITE_API_BASE_URL` to
the Space URL in the Vercel project, then:

```bash
cd client
vercel --prod
```

Keep the `crons` entry in `client/vercel.json` while the client still calls
the Space for correction.

## Using it

- **Mouse / touch** is the default input. Draw one character at a time; lift
  the pointer and wait a second.
- **Replay a sample** plays a recorded stroke sequence through the same
  pipeline so you can see recognition and correction without drawing.
- **Use your hand instead** turns on the webcam and MediaPipe. Point with the
  index finger to draw, close the fist to pause, open the palm to clear.
  Video stays in the browser.
- **Write** mode recognises characters and builds corrected text with
  suggestions; **Draw** mode is a free canvas with colours and export.
- Press `?` for keyboard shortcuts.
- `/?record=1` opens the dev-only stroke recorder (see [Accuracy](#accuracy));
  `/?recognition=server` forces the server fallback; `/?model=fp32` loads the
  float export.

## Licences

Code: MIT, see [LICENSE](LICENSE). Runtime dependencies added for on-device
recognition are MIT (onnxruntime-web; onnxruntime-node, @napi-rs/canvas and
pngjs for the tests only). The model is trained on EMNIST (Cohen, Afshar,
Tapson, van Schaik, 2017, *EMNIST: an extension of MNIST to handwritten
letters*), derived from NIST Special Database 19; the dataset is not
redistributed here. Fonts (Fraunces, Inter, JetBrains Mono) are loaded from
Google Fonts under the SIL Open Font License.

## Author

**Md. Saminul Amin** — [GitHub](https://github.com/saminul-amin) ·
[LinkedIn](https://linkedin.com/in/md-saminul-amin/) · saminul.amin@gmail.com
