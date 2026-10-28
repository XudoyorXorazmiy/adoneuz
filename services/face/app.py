"""
adone yuz servisi (CLAUDE.md §2): InsightFace buffalo_l, CPU. Faqat ichki tarmoqda; Next.js FACE_SERVICE_URL orqali chaqiradi.

  GET  /health                 → model yuklanganmi
  POST /embed   media          → bitta yuz vektori (512, normallangan) + sifat   (ro'yxatdan o'tish namunasi)
  POST /verify  media[] + templates(JSON) → eng yaxshi kosinus o'xshashlik + liveness (bosh burilishi, yaw oralig'i)

media — rasm(lar) yoki video (dumaloq video / mp4): videodan teng oraliqda kadrlar olinadi.
Qaror (ok / suspicious) bu yerda emas — Next.js tomonida, ishxona chegaralari bilan (packages/core/face.ts).
Rasm va vektor diskka yozilmaydi, logga chiqmaydi (§1.4).

Barqarorlik: endpointlar oddiy `def` — FastAPI ularni thread pool'da ishlatadi, og'ir hisob event loop'ni (va /health'ni)
to'smaydi; bir vaqtda ko'pi bilan INFER_SLOTS ta tahlil (CPU va RAM), navbatda QUEUE_WAIT_S dan ko'p kutsa — 503 busy
(Next.js «face_unavailable» → shubhali, bloklanmaydi). Videodan kadrlar o'qish paytida tanlanadi — xotirada ≤ 2×MAX_FRAMES.
"""
import json
import os
import tempfile
import threading
from typing import List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from insightface.app import FaceAnalysis

MAX_BYTES = 20 * 1024 * 1024
MAX_FRAMES = 8
MAX_VIDEO_FRAMES = 1800  # ~60 s (30 fps) — undan uzunini o'qimaymiz
INFER_SLOTS = int(os.environ.get("FACE_INFER_SLOTS", "2"))
QUEUE_WAIT_S = 15
MIN_FACE_PX = 60
MIN_DET_SCORE = 0.6
KEY = os.environ.get("FACE_SERVICE_KEY", "")

slots = threading.BoundedSemaphore(INFER_SLOTS)
app = FastAPI(title="adone-face")


@app.on_event("startup")
def require_key():
    """Kalitsiz servis ichki tarmoqdagi har kimga yuz vektorini beradi — ishga tushmaydi (sinov: FACE_ALLOW_NO_KEY=1)."""
    if not KEY and os.environ.get("FACE_ALLOW_NO_KEY") != "1":
        raise RuntimeError("FACE_SERVICE_KEY sozlanmagan — servis ishga tushmaydi")
fa = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition", "landmark_3d_68"], providers=["CPUExecutionProvider"])
fa.prepare(ctx_id=-1, det_size=(640, 640))


def auth(key: Optional[str]):
    if KEY and key != KEY:
        raise HTTPException(status_code=401, detail="unauthorized")


def decode(data: bytes, content_type: str) -> List[np.ndarray]:
    """Rasm → [kadr]; video → teng oraliqdagi ≤ MAX_FRAMES kadr."""
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is not None:
        return [img]
    with tempfile.NamedTemporaryFile(suffix=".mp4") as f:
        f.write(data)
        f.flush()
        cap = cv2.VideoCapture(f.name)
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        frames = []
        if n > 0:
            for idx in np.linspace(0, max(n - 1, 0), num=min(MAX_FRAMES, n)).astype(int):
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                ok, fr = cap.read()
                if ok:
                    frames.append(fr)
        else:  # ba'zi konteynerlarda kadrlar soni noma'lum — ketma-ket o'qiymiz, tanlab (xotirada ≤ 2×MAX_FRAMES kadr)
            kept, step, i = [], 1, 0
            while i < MAX_VIDEO_FRAMES:
                ok, fr = cap.read()
                if not ok:
                    break
                if i % step == 0:
                    kept.append(fr)
                    if len(kept) >= 2 * MAX_FRAMES:  # siyraklashtiramiz: har ikkinchisi qoladi, qadam ikki barobar
                        kept, step = kept[::2], step * 2
                i += 1
            frames = kept[:: max(1, len(kept) // MAX_FRAMES)][:MAX_FRAMES]
        cap.release()
    if not frames:
        raise HTTPException(status_code=422, detail="bad_media")
    return frames


def main_face(frame: np.ndarray):
    """Kadrdagi eng katta yuz; ikkinchi yuz ham katta bo'lsa — many=True (boshqa odam yonida)."""
    faces = fa.get(frame)
    if not faces:
        return None, False
    faces.sort(key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    area = lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
    many = bool(len(faces) > 1 and area(faces[1]) > 0.35 * area(faces[0]))
    return faces[0], many


def quality(face, frame) -> dict:
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    crop = frame[max(y1, 0):max(y2, 0), max(x1, 0):max(x2, 0)]
    sharp = float(cv2.Laplacian(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()) if crop.size else 0.0
    return {"det_score": round(float(face.det_score), 3), "face_px": int(min(x2 - x1, y2 - y1)), "sharpness": round(sharp, 1)}


def read_all(files: List[UploadFile]) -> List[np.ndarray]:
    """Hajm o'qishdan OLDIN tekshiriladi (va o'qish chegaralangan) — katta fayl RAM'ni to'ldirmasin."""
    frames: List[np.ndarray] = []
    for f in files[:MAX_FRAMES]:
        if f.size is not None and f.size > MAX_BYTES:
            raise HTTPException(status_code=413, detail="too_large")
        data = f.file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="too_large")
        frames += decode(data, f.content_type or "")
    return frames[: MAX_FRAMES * 2]


class Slot:
    """Bir vaqtda INFER_SLOTS ta tahlil; navbat QUEUE_WAIT_S dan uzun bo'lsa — 503 (Next.js shubhali deb saqlaydi)."""

    def __enter__(self):
        if not slots.acquire(timeout=QUEUE_WAIT_S):
            raise HTTPException(status_code=503, detail="busy")

    def __exit__(self, *exc):
        slots.release()


@app.get("/health")
async def health():  # event loop'da — tahlillar thread pool'da, /health ular tufayli kutmaydi
    return {"ok": True, "model": "buffalo_l"}


@app.post("/embed")
def embed(media: List[UploadFile] = File(...), x_face_key: Optional[str] = Header(None)):
    auth(x_face_key)
    with Slot():
        return _embed(media)


def _embed(media: List[UploadFile]):
    frames = read_all(media)
    best = None
    many = False
    for fr in frames:
        face, m = main_face(fr)
        many = many or m
        if face is not None and (best is None or face.det_score > best[0].det_score):
            best = (face, fr)
    if best is None:
        return {"ok": False, "reason": "no_face", "frames": len(frames)}
    face, fr = best
    q = quality(face, fr)
    if q["face_px"] < MIN_FACE_PX or q["det_score"] < MIN_DET_SCORE:
        return {"ok": False, "reason": "low_quality", "quality": q, "frames": len(frames)}
    return {"ok": True, "embedding": [round(float(v), 6) for v in face.normed_embedding], "quality": q, "many_faces": many, "frames": len(frames)}


@app.post("/verify")
def verify(media: List[UploadFile] = File(...), templates: str = Form(...), x_face_key: Optional[str] = Header(None)):
    auth(x_face_key)
    try:
        T = np.array(json.loads(templates), dtype=np.float32)
        assert T.ndim == 2 and T.shape[1] == 512 and len(T) > 0
    except Exception:
        raise HTTPException(status_code=422, detail="bad_templates")
    T = T / np.linalg.norm(T, axis=1, keepdims=True)
    with Slot():
        return _verify(media, T)


def _verify(media: List[UploadFile], T: np.ndarray):
    frames = read_all(media)
    sims, yaws, qs = [], [], []
    many = False
    for fr in frames:
        face, m = main_face(fr)
        many = many or m
        if face is None:
            continue
        sims.append(float(np.max(T @ face.normed_embedding)))
        if getattr(face, "pose", None) is not None:
            yaws.append(float(face.pose[1]))
        qs.append(quality(face, fr))
    if not sims:
        return {"ok": False, "reason": "no_face", "frames": len(frames)}
    yaw_range = (max(yaws) - min(yaws)) if len(yaws) > 1 else 0.0
    best = int(np.argmax(sims))
    return {
        "ok": True,
        "similarity": round(max(sims), 4),
        "median_similarity": round(float(np.median(sims)), 4),
        "face_frames": len(sims),
        "frames": len(frames),
        "many_faces": many,
        "liveness": {"yaw_min": round(min(yaws), 1) if yaws else None, "yaw_max": round(max(yaws), 1) if yaws else None, "yaw_range": round(yaw_range, 1)},
        "quality": qs[best],
    }
