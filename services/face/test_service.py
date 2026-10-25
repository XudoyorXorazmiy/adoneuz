"""
Yuz servisi sinovi (haqiqiy model). insightface paketidagi namunaviy rasmlar bilan:
  pip install -r requirements.txt && python test_service.py
Kutiladi: o'sha odam (aylantirilgan, qorong'i, ko'zgu) ≥ 0.8; boshqa odamlar < 0.3; yuzsiz rasm — no_face; guruh — many_faces.
"""
import json
import os

import cv2
import numpy as np
from fastapi.testclient import TestClient

import insightface

import app as svc

IMG = os.path.join(os.path.dirname(insightface.__file__), "data", "images")
client = TestClient(svc.app)


def jpg(img):
    return cv2.imencode(".jpg", img)[1].tobytes()


def canvas(img, scale):
    big = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    c = np.full((big.shape[0] + 300, big.shape[1] + 300, 3), 180, np.uint8)
    c[150:150 + big.shape[0], 150:150 + big.shape[1]] = big
    return c


a = canvas(cv2.imread(os.path.join(IMG, "Tom_Hanks_54745.png")), 3)
group = cv2.imread(os.path.join(IMG, "t1.jpg"))

r = client.post("/embed", files={"media": ("a.jpg", jpg(a), "image/jpeg")}).json()
assert r["ok"] and len(r["embedding"]) == 512, r
tpl = json.dumps([r["embedding"]])


def sim(img):
    v = client.post("/verify", files={"media": ("x.jpg", jpg(img), "image/jpeg")}, data={"templates": tpl}).json()
    return v


h, w = a.shape[:2]
same = [cv2.flip(a, 1), cv2.warpAffine(a, cv2.getRotationMatrix2D((w / 2, h / 2), 12, 1.0), (w, h), borderValue=(180, 180, 180)), (a * 0.5).astype("uint8")]
for img in same:
    s = sim(img)["similarity"]
    assert s >= 0.8, s
fa = svc.fa
others = [f for f in fa.get(group)][:3]
for f in others:
    x1, y1, x2, y2 = [int(v) for v in f.bbox]
    crop = canvas(group[max(0, y1 - 40):y2 + 40, max(0, x1 - 40):x2 + 40], 2)
    s = sim(crop)["similarity"]
    assert s < 0.3, s
assert sim(np.full((300, 300, 3), 200, np.uint8))["reason"] == "no_face"
assert sim(group)["many_faces"] is True
v = client.post("/verify", files=[("media", ("1.jpg", jpg(a), "image/jpeg")), ("media", ("2.jpg", jpg(cv2.flip(a, 1)), "image/jpeg"))], data={"templates": tpl}).json()
assert v["liveness"]["yaw_range"] > 15, v
print("face: hammasi joyida ✓")
