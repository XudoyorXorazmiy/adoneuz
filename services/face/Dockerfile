# adone yuz servisi — Coolify'da alohida ilova (adone-face), faqat ichki tarmoq, port 8000.
FROM python:3.12-slim
ENV PIP_NO_CACHE_DIR=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends g++ curl unzip libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt && apt-get purge -y g++ && apt-get autoremove -y
# Model build paytida (≈330 MB) — ishga tushganda internet kerak emas
RUN mkdir -p /root/.insightface/models && cd /root/.insightface/models \
 && curl -fsSL -o buffalo_l.zip https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip \
 && unzip -q buffalo_l.zip -d buffalo_l && rm buffalo_l.zip
COPY app.py .
EXPOSE 8000
# 15 s: og'ir tahlil paytida ham /health javob beradi (endpointlar thread pool'da), lekin sekin mashinada 5 s kam edi
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 CMD curl -fsS http://127.0.0.1:8000/health || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
