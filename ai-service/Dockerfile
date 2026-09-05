# AirScript AI service — CPU-only inference image (Hugging Face Spaces or any Docker host).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Hugging Face Spaces run the container as uid 1000.
RUN useradd -m -u 1000 user
WORKDIR /app

# Install dependencies first so this layer is cached across code changes.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Copy the service, including saved_model/emnist_cnn.pth and its checksum.
COPY --chown=user:user . .
RUN mkdir -p /app/data && chown -R user:user /app/data

USER user
ENV HOME=/home/user

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import json,sys,urllib.request; r=json.load(urllib.request.urlopen('http://127.0.0.1:7860/health', timeout=4)); sys.exit(0 if r['model']['loaded'] else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
