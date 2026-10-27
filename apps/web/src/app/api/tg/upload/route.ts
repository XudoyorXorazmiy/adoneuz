import { and, eq, inArray } from 'drizzle-orm';
import { tasks, withTenant } from '@adone/db';
import { isUuid } from '@adone/core';
import { currentTgAssignee } from '@/lib/tg/session';
import { insertStreamed, MediaTooLarge, writeMediaStream } from '@/server/media';
import { allow } from '@/server/rate-limit';

/**
 * Mini App: vazifa hisobotiga video (yoki katta rasm) — server action emas (10 MB chegarasi, xotiraga yig'iladi), oqim bilan diskka.
 * POST ?task=<uuid>, tana — faylning o'zi, Content-Type video/* yoki image/*. Kim — FAQAT Mini App sessiyasidan (cookie),
 * vazifa — shu ijrochiniki va ochiq. Javob { id } — keyin `tgTaskAction` ga `media` maydonida (u yerda yana tekshiriladi).
 * proxy.ts /api ni ushlamaydi — tana bufersiz keladi.
 */
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-matroska': 'mkv',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let a;
  try {
    a = await currentTgAssignee();
  } catch {
    return json({ error: 'Mini App sessiyasi tugagan — ilovani qaytadan oching' }, 401);
  }
  const taskId = new URL(req.url).searchParams.get('task') ?? '';
  const mime = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const ext = EXT[mime];
  if (!isUuid(taskId) || !ext || !req.body) return json({ error: 'Fayl turi qo‘llab-quvvatlanmaydi (video yoki rasm)' }, 415);
  const max = mime.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > max) return json({ error: tooLarge(mime) }, 413);
  if (!(await allow(`tg-upload:${a.tg}`, 40, 3600))) return json({ error: 'Juda ko‘p yuklash — birozdan keyin urinib ko‘ring' }, 429);
  const open = await withTenant(a.tenantId, async (tx) =>
    (await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), a.own, inArray(tasks.status, ['new', 'accepted', 'in_progress', 'revision']))).limit(1)).length > 0);
  if (!open) return json({ error: 'Vazifa topilmadi yoki yopilgan' }, 404);
  let file;
  try {
    file = await writeMediaStream(a.tenantId, req.body, ext, max);
  } catch (e) {
    if (e instanceof MediaTooLarge) return json({ error: tooLarge(mime) }, 413);
    return json({ error: 'Yuklash uzildi — internetni tekshirib, qayta urinib ko‘ring' }, 400);
  }
  if (file.size === 0) return json({ error: 'Fayl bo‘sh' }, 400);
  const id = await withTenant(a.tenantId, (tx) => insertStreamed(tx, { tenantId: a.tenantId, employeeId: a.employeeId, kind: 'task_report', mime, file }));
  return json({ id, size: file.size });
}

function tooLarge(mime: string) {
  return mime.startsWith('video/') ? 'Video 100 MB dan katta — qisqaroq (1 daqiqagacha) yozing' : 'Rasm 10 MB dan katta';
}
