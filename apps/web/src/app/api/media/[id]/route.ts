import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { can, isUuid } from '@adone/core';
import { currentUser } from '@/lib/auth/session';
import { currentTgMember } from '@/lib/tg/session';
import { mediaFor } from '@/server/attendance';
import { mediaRoot } from '@/server/media';

/** Davomat/hisobot videosi yoki rasmi — faqat shu ishxona (RLS): panel sessiyasi yoki rahbar Mini App sessiyasi, davomatni ko'ra oladigan rol. */
export async function GET(req: Request, ctx: RouteContext<'/api/media/[id]'>) {
  const { id } = await ctx.params;
  const user = await currentUser();
  const viewer = user?.tenantId ? { tenantId: user.tenantId, role: user.role } : await currentTgMember();
  if (!viewer || !can(viewer.role, 'attendance')) return new Response('Unauthorized', { status: 401 });
  if (!isUuid(id)) return new Response('Not found', { status: 404 });
  const m = await mediaFor(viewer.tenantId, id);
  if (!m) return new Response('Not found', { status: 404 });
  const full = path.join(mediaRoot(), m.path);
  if (!full.startsWith(mediaRoot())) return new Response('Not found', { status: 404 });
  const st = await stat(full).catch(() => null);
  if (!st) return new Response('Not found', { status: 404 });
  const base = { 'Content-Type': m.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  // Range — iOS (Safari, Telegram) videoni faqat qisman so'rovlar bilan ijro etadi; katta videoni ham boshidan o'ynatish tez
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    return new Response(Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream, {
      status: 206, headers: { ...base, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${st.size}` },
    });
  }
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, { headers: { ...base, 'Content-Length': String(st.size) } });
}
