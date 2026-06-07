FROM python:3.11-slim

WORKDIR /app

# System deps:
#  libpq-dev/gcc/g++ — psycopg2 + native wheels
#  espeak-ng        — Coqui VITS phonemizer (found via PATH at runtime)
#  ffmpeg           — torchcodec audio IO (provides libav*)
#  libsndfile1      — soundfile WAV encode
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc g++ espeak-ng ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Persisted model caches (mount a volume here to avoid re-downloading)
ENV HF_HOME=/app/.cache/huggingface \
    TORCH_HOME=/app/.cache/torch \
    XDG_DATA_HOME=/app/.cache/share \
    COQUI_TOS_AGREED=1

# CPU-only torch first — the default PyPI torch wheel drags ~3GB of CUDA libs
# that are useless in this CPU container. Pin to the CPU index so the rest of
# requirements.txt sees torch already satisfied.
RUN pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    torch torchaudio torchcodec

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# docling-ibm-models pulls a PyPI torchvision whose compiled ops (torchvision::nms)
# are ABI-incompatible with the CPU torch installed above. That broken import
# cascades through transformers and breaks Coqui TTS (`import TTS`). Voice + RAG
# need no vision ops; remove torchvision so TTS loads. Docling uses its text path.
RUN pip uninstall -y torchvision

# Cache-bust the source copy: BuildKit otherwise reuses a stale COPY layer and
# misses app/ edits. Pass `--build-arg CACHEBUST=$(date +%s)` to force a fresh copy
# without rebuilding the heavy pip layers above.
ARG CACHEBUST=0
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
