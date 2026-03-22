"""
AI Service — FastAPI application for character recognition and text correction.

Endpoints:
    POST /predict             – single character prediction (legacy)
    POST /predict-character   – enhanced prediction with top-3 results
    POST /process-text        – context-aware text correction pipeline
    POST /suggest             – prefix-based word suggestions
    POST /autocomplete        – single best word completion
    POST /learn               – personal dictionary learning
    GET  /personal-dict       – view personal dictionary entries
    GET  /health              – health check
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from predict import predict_character
from correction.pipeline import process_characters
from nlp.predictor import suggest_words, autocomplete_word, predict_next_word
from nlp.personalizer import learn as personal_learn, get_all_entries, delete_entry

app = FastAPI(title="Air Drawing AI Service", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES = ("image/png", "image/jpeg", "image/webp")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service", "version": "4.0.0"}


async def _run_prediction(file: UploadFile) -> dict:
    """Shared prediction logic for both endpoints."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    image_bytes = await file.read()
    return predict_character(image_bytes)


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Legacy endpoint — returns prediction + confidence + top3."""
    return await _run_prediction(file)


@app.post("/predict-character")
async def predict_character_endpoint(file: UploadFile = File(...)):
    """Enhanced endpoint — same response, explicit name for Phase 3."""
    return await _run_prediction(file)



class CharacterEntry(BaseModel):
    label: str
    confidence: float = 0.0
    top3: list[str] = []
    pause_before_ms: int = 0

class ProcessTextRequest(BaseModel):
    raw_characters: list[CharacterEntry]

class ProcessTextResponse(BaseModel):
    raw_text: str
    corrected_text: str
    stages: dict | None = None

@app.post("/process-text", response_model=ProcessTextResponse)
async def process_text(req: ProcessTextRequest):
    """
    Accept a list of recognised characters and return corrected text.

    Pipeline: dot-merge → punctuation → disambiguation → spell check → formatting
    """
    chars = [entry.model_dump() for entry in req.raw_characters]
    result = process_characters(chars)
    return ProcessTextResponse(
        raw_text=result["raw_text"],
        corrected_text=result["corrected_text"],
        stages=result["stages"],
    )



class SuggestRequest(BaseModel):
    prefix: str
    context: str = ""
    limit: int = 5

class SuggestResponse(BaseModel):
    suggestions: list[dict]
    next_words: list[str]

@app.post("/suggest", response_model=SuggestResponse)
async def suggest(req: SuggestRequest):
    """Return word suggestions for a partial word + next-word predictions."""
    suggestions = suggest_words(req.prefix, limit=req.limit)
    next_words = predict_next_word(req.context, limit=req.limit)
    return SuggestResponse(suggestions=suggestions, next_words=next_words)


class AutocompleteRequest(BaseModel):
    partial: str
    context: str = ""

class AutocompleteResponse(BaseModel):
    completion: str | None = None
    full_word: str | None = None
    confidence: float = 0.0

@app.post("/autocomplete", response_model=AutocompleteResponse)
async def autocomplete(req: AutocompleteRequest):
    """Return the single best auto-completion for a partial word."""
    result = autocomplete_word(req.partial, context=req.context)
    if result is None:
        return AutocompleteResponse()
    return AutocompleteResponse(**result)


class LearnRequest(BaseModel):
    wrong: str
    correct: str

@app.post("/learn")
async def learn(req: LearnRequest):
    """Record a user correction in the personal dictionary."""
    ok = personal_learn(req.wrong, req.correct)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or identical words")
    return {"status": "learned", "wrong": req.wrong, "correct": req.correct}


@app.get("/personal-dict")
async def personal_dict():
    """Return all personal dictionary entries."""
    return {"entries": get_all_entries()}
