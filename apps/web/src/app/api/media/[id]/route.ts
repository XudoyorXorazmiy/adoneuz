import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { employees, withTenant } from '@adone/db';
import { can, isUuid } from '@adone/core';
import { currentUser, type TenantUser } from '@/lib/auth/session';
import { currentTgMember, memberAsTenantUser } from '@/lib/tg/session';
import { mediaFor } from '@/server/attendance';
import { mediaRoot, thumbsRoot } from '@/server/media';
import { departmentScope } from '@/server/scope';

/**
 * Davomat/hisobot videosi yoki rasmi — faqat shu ishxona (RLS): panel sessiyasi yoki rahbar Mini App sessiyasi, davomatni ko'ra oladigan rol.
 * Bo'lim boshlig'i — faqat o'z bo'limi xodimlarining fayli. `?w=320` — rasmning kichik nusxasi (ro'yxatlar, kartochkalar; bir marta
 * yasalib `.thumbs` da saqlanadi), video uchun e'tiborsiz.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/media/[id]'>) {
  const { id } = await ctx.params;
  const user = await currentUser();
  const member = user?.tenantId ? null : await currentTgMember();
  const viewer: TenantUser | null = user?.tenantId && user.role ? (user as TenantUser) : member ? memberAsTenantUser(member) : null;
  if (!viewer || !can(viewer.role, 'attendance')) return new Response('Unauthorized', { status: 401 });
  if (!isUuid(id)) return new Response('Not found', { status: 404 });
  const m = await mediaFor(viewer.tenantId, id);
  if (!m) return new Response('Not found', { status: 404 });
  if (viewer.role === 'manager') {
    const allowed = await withTenant(viewer.tenantId, async (tx) => {
      const scope = await departmentScope(tx, viewer);
      if (!m.employeeId || !scope?.length) return false;
      const [e] = await tx.select({ dep: employees.departmentId }).from(employees).where(eq(employees.id, m.employeeId)).limit(1);
      return !!e?.dep && scope.includes(e.dep);
    });
    if (!allowed) return new Response('Not found', { status: 404 });
  }
  const full = path.join(mediaRoot(), m.path);
  if (!full.startsWith(mediaRoot())) return new Response('Not found', { status: 404 });
  const st = await stat(full).catch(() => null);
  if (!st) return new Response('Not found', { status: 404 });
  if (new URL(req.url).searchParams.get('w') === '320' && m.mime.startsWith('image/')) {
    const thumb = path.join(thumbsRoot(), viewer.tenantId, `${m.id}.jpg`);
    if (!(await stat(thumb).catch(() => null))) {
      await mkdir(path.dirname(thumb), { recursive: true });
      await sharp(full).rotate().resize(320, 320, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(thumb).catch(() => null);
    }
    const ts = await stat(thumb).catch(() => null);
    if (ts) return new Response(Readable.toWeb(createReadStream(thumb)) as ReadableStream, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(ts.size), 'Cache-Control': 'private, max-age=86400' } });
  }
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
