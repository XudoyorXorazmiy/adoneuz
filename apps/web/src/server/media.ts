import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { media, type Tx } from '@adone/db';
import type { MediaKind } from '@adone/core';

/** Fayllar diskda: MEDIA_DIR/<tenant>/<yyyy-mm>/<uuid>.<ext> (CLAUDE.md §1.4 — boshqa tenantga chiqmaydi). */
export function mediaRoot(): string {
  return path.resolve(process.env.MEDIA_DIR || './media-data');
}

export async function saveMedia(tx: Tx, input: { tenantId: string; employeeId: string | null; kind: MediaKind; data: Buffer; mime: string; ext: string; durationSec?: number | null }) {
  const id = randomUUID();
  const rel = path.join(input.tenantId, new Date().toISOString().slice(0, 7), `${id}.${input.ext}`);
  const full = path.join(mediaRoot(), rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, input.data);
  await tx.insert(media).values({
    id, tenantId: input.tenantId, employeeId: input.employeeId, kind: input.kind, path: rel, mime: input.mime,
    sizeBytes: input.data.length, sha256: createHash('sha256').update(input.data).digest('hex'), durationSec: input.durationSec ?? null,
  });
  return id;
}
