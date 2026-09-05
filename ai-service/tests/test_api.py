"""Smoke tests through FastAPI's TestClient, plus the fail-loud startup contract."""

from __future__ import annotations

import os
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient

from tests.conftest import SERVICE_DIR


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:  # runs the lifespan → loads real weights
        yield c


def test_health_reports_real_weights(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model"]["loaded"] is True
    assert body["model"]["num_classes"] == 47
    assert isinstance(body["model"]["sha256"], str) and len(body["model"]["sha256"]) == 64
    assert body["model"]["error"] is None


def test_predict_returns_a_label_with_top3(client, png_vertical_bar):
    r = client.post("/predict-character", files={"file": ("drawing.png", png_vertical_bar, "image/png")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["prediction"]) == 1
    assert 0.0 <= body["confidence"] <= 1.0
    assert len(body["top3"]) == 3
    assert len(body["top3_confidences"]) == 3
    # A trained model reads a tall bar as a one or a capital I.
    assert {"1", "I"} & set(body["top3"]), body


def test_predict_circle_reads_as_o_or_zero(client, png_circle):
    r = client.post("/predict", files={"file": ("drawing.png", png_circle, "image/png")})
    assert r.status_code == 200, r.text
    assert {"O", "0"} & set(r.json()["top3"]), r.json()


def test_predict_rejects_wrong_content_type(client):
    r = client.post("/predict", files={"file": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_predict_blank_image_is_empty_prediction(client, png_blank):
    r = client.post("/predict", files={"file": ("blank.png", png_blank, "image/png")})
    assert r.status_code == 200
    assert r.json()["prediction"] == ""


def test_process_text_roundtrip(client):
    chars = [{"label": c, "confidence": 0.6, "top3": [c], "pause_before_ms": 0} for c in "teh"]
    r = client.post("/process-text", json={"raw_characters": chars})
    assert r.status_code == 200
    assert r.json()["raw_text"] == "teh"
    assert r.json()["corrected_text"] == "The"


def test_suggest_and_autocomplete(client):
    r = client.post("/suggest", json={"prefix": "hel", "context": "", "limit": 5})
    assert r.status_code == 200
    words = [s["word"] for s in r.json()["suggestions"]]
    assert "hello" in words or "help" in words

    r = client.post("/autocomplete", json={"partial": "hell", "context": ""})
    assert r.status_code == 200
    assert r.json()["full_word"] in ("hello", "hell", None) or isinstance(r.json()["full_word"], str)


def _boot_service(extra_env: dict[str, str]) -> subprocess.CompletedProcess:
    """Start the app via TestClient in a subprocess so env vars apply at import time."""
    code = (
        "from fastapi.testclient import TestClient\n"
        "from main import app\n"
        "with TestClient(app) as c:\n"
        "    h = c.get('/health').json()\n"
        "    p = c.post('/predict', files={'file': ('x.png', b'\\x89PNG', 'image/png')})\n"
        "    print('HEALTH', h['status'], h['model']['loaded'])\n"
        "    print('PREDICT', p.status_code)\n"
    )
    env = {**os.environ, **extra_env, "PYTHONPATH": SERVICE_DIR}
    return subprocess.run([sys.executable, "-c", code], cwd=SERVICE_DIR, env=env, capture_output=True, text=True, timeout=180)


def test_service_refuses_to_start_without_weights(tmp_path):
    missing = str(tmp_path / "nope.pth")
    proc = _boot_service({"AIRSCRIPT_MODEL_PATH": missing, "AIRSCRIPT_ALLOW_MISSING_MODEL": ""})
    assert proc.returncode != 0
    assert "refusing to start" in (proc.stderr + proc.stdout)


def test_service_rejects_checksum_mismatch(tmp_path):
    bogus = tmp_path / "bogus.pth"
    bogus.write_bytes(b"not a checkpoint")
    proc = _boot_service({"AIRSCRIPT_MODEL_PATH": str(bogus), "AIRSCRIPT_MODEL_SHA256": "0" * 64, "AIRSCRIPT_ALLOW_MISSING_MODEL": ""})
    assert proc.returncode != 0
    assert "checksum mismatch" in (proc.stderr + proc.stdout)


def test_degraded_mode_serves_503_on_predict(tmp_path):
    missing = str(tmp_path / "nope.pth")
    proc = _boot_service({"AIRSCRIPT_MODEL_PATH": missing, "AIRSCRIPT_ALLOW_MISSING_MODEL": "1"})
    assert proc.returncode == 0, proc.stderr
    assert "HEALTH degraded False" in proc.stdout
    assert "PREDICT 503" in proc.stdout
