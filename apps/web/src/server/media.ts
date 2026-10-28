import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { media, type Tx } from '@adone/db';
import type { MediaKind } from '@adone/core';

/** Fayllar diskda: MEDIA_DIR/<tenant>/<yyyy-mm>/<uuid>.<ext> (CLAUDE.md §1.4 — boshqa tenantga chiqmaydi). */
export function mediaRoot(): string {
  return path.resolve(process.env.MEDIA_DIR || './media-data');
}

/** Kichik nusxalar (ro'yxatlardagi 320 px rasm) — MEDIA_DIR/.thumbs/<tenant>/<id>.jpg (api/media ?w=320, cleanup). */
export function thumbsRoot(): string {
  return path.join(mediaRoot(), '.thumbs');
}

export type StoredMedia = typeof media.$inferInsert & { id: string };

/**
 * Faylni diskka yozish — TRANZAKSIYADAN TASHQARIDA (disk sekin bo'lsa baza ulanishi/qulflar ushlab turilmasin).
 * Bazaga yozuv keyin tranzaksiyada `insertMedia`. Tranzaksiya bekor bo'lsa fayl yetim qoladi — kunlik tozalash o'chiradi (cleanup).
 */
export async function writeMediaFile(input: { tenantId: string; employeeId: string | null; kind: MediaKind; data: Buffer; mime: string; ext: string; durationSec?: number | null }): Promise<StoredMedia> {
  const id = randomUUID();
  const rel = path.join(input.tenantId, new Date().toISOString().slice(0, 7), `${id}.${input.ext}`);
  const full = path.join(mediaRoot(), rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, input.data);
  return {
    id, tenantId: input.tenantId, employeeId: input.employeeId, kind: input.kind, path: rel, mime: input.mime,
    sizeBytes: input.data.length, sha256: createHash('sha256').update(input.data).digest('hex'), durationSec: input.durationSec ?? null,
  };
}

export async function insertMedia(tx: Tx, f: StoredMedia): Promise<string> {
  await tx.insert(media).values(f);
  return f.id;
}

export class MediaTooLarge extends Error {}

/**
 * Katta fayl (Mini App hisobot videosi) — xotiraga yig'ilmaydi: oqim diskka yoziladi, hajm va sha256 yo'l-yo'lakay.
 * `maxBytes` dan oshsa — fayl o'chiriladi, `MediaTooLarge`. Bazaga yozuv — chaqiruvchining tranzaksiyasida (`insertStreamed`).
 */
export async function writeMediaStream(tenantId: string, body: ReadableStream<Uint8Array>, ext: string, maxBytes: number) {
  const id = randomUUID();
  const rel = path.join(tenantId, new Date().toISOString().slice(0, 7), `${id}.${ext}`);
  const full = path.join(mediaRoot(), rel);
  await mkdir(path.dirname(full), { recursive: true });
  const hash = createHash('sha256');
  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > maxBytes) return cb(new MediaTooLarge());
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as import('node:stream/web').ReadableStream), meter, createWriteStream(full));
  } catch (e) {
    await rm(full, { force: true });
    throw e;
  }
  return { id, path: rel, size, sha256: hash.digest('hex'), full };
}

export async function insertStreamed(tx: Tx, input: { tenantId: string; employeeId: string | null; kind: MediaKind; mime: string; file: Awaited<ReturnType<typeof writeMediaStream>> }) {
  await tx.insert(media).values({
    id: input.file.id, tenantId: input.tenantId, employeeId: input.employeeId, kind: input.kind, path: input.file.path, mime: input.mime,
    sizeBytes: input.file.size, sha256: input.file.sha256,
  });
  return input.file.id;
}
