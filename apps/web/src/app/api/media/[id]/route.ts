import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { can } from '@adone/core';
import { currentUser } from '@/lib/auth/session';
import { mediaFor } from '@/server/attendance';
import { mediaRoot } from '@/server/media';

/** Davomat videosi/rasmi — faqat shu ishxona paneli (RLS) va davomatni ko'ra oladigan rol. */
export async function GET(_req: Request, ctx: RouteContext<'/api/media/[id]'>) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user?.tenantId || !can(user.role, 'attendance')) return new Response('Unauthorized', { status: 401 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const m = await mediaFor(user.tenantId, id);
  if (!m) return new Response('Not found', { status: 404 });
  const full = path.join(mediaRoot(), m.path);
  if (!full.startsWith(mediaRoot())) return new Response('Not found', { status: 404 });
  const st = await stat(full).catch(() => null);
  if (!st) return new Response('Not found', { status: 404 });
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: { 'Content-Type': m.mime, 'Content-Length': String(st.size), 'Cache-Control': 'private, max-age=3600' },
  });
}
