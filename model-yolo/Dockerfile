# YOLO model microservice container.
#
# We use a Dockerfile (instead of nixpacks) because `opencv-python` (a
# transitive dependency of ultralytics) needs several X11 / GL system
# libraries at runtime. Nixpacks aptPkgs were not reliably installing them
# on Railway, so we install them explicitly here.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System libs required by opencv-python (libxcb.so.1, libGL.so.1, etc.)
# plus a couple of common ML runtime libs (libgomp for torch).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libxcb1 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .

EXPOSE 8080

# Railway sets $PORT at runtime; default to 8080 locally.
CMD ["sh", "-c", "gunicorn server:app -b 0.0.0.0:${PORT:-8080} --timeout 120 --workers 1"]
