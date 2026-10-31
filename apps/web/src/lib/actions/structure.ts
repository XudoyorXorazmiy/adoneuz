'use server';
import { flashError } from '@/lib/flash';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, branches, departments, employees, schedules, withTenant, type Tx } from '@adone/db';
import { isValidDate, isValidTime, parseCoordinates } from '@adone/core';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { expandMapLink } from '@/server/maps';
import { setDepartmentHead, type HeadChoice } from '@/server/department-head';
import { kick } from '@/server/jobs/enqueue';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const optUuid = (v: string) => (z.uuid().safeParse(v).success ? v : null);

async function audit(tx: Tx, tenantId: string, userId: string, action: string, entityId: string, meta: Record<string, unknown> = {}) {
  await tx.insert(auditLog).values({ tenantId, userId, action, entity: action.split('.')[0], entityId, meta });
}

// ---------- Filiallar ----------

export async function saveBranchAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('branches');
  const id = optUuid(str(f, 'id'));
  const name = str(f, 'name');
  if (name.length < 2) return { error: 'Filial nomini kiriting' };
  const point = parseCoordinates(await expandMapLink(str(f, 'coords')));
  if (!point) return { error: "Koordinata topilmadi. «41.3194, 61.0742» ko'rinishida yoki Google/Yandex xarita havolasini qo'ying." };
  const radiusM = Number(str(f, 'radiusM'));
  if (!Number.isInteger(radiusM) || radiusM < 20 || radiusM > 2000) return { error: 'Radius 20–2000 metr oralig‘ida' };
  const values = { name, address: str(f, 'address') || null, lat: point.lat, lng: point.lng, radiusM };
  await withTenant(user.tenantId, async (tx) => {
    if (id) {
      const [r] = await tx.update(branches).set(values).where(eq(branches.id, id)).returning({ id: branches.id });
      if (!r) throw new Error('Filial topilmadi');
      await audit(tx, user.tenantId, user.id, 'branch.update', id, values);
    } else {
      const [r] = await tx.insert(branches).values({ tenantId: user.tenantId, ...values }).returning({ id: branches.id });
      await audit(tx, user.tenantId, user.id, 'branch.create', r!.id, values);
    }
  });
  revalidatePath('/filiallar');
  return { ok: 'Saqlandi' };
}

export async function toggleBranchAction(f: FormData): Promise<void> {
  const user = await assertArea('branches');
  const id = z.uuid().parse(f.get('id'));
  const active = f.get('active') === '1';
  await withTenant(user.tenantId, async (tx) => {
    await tx.update(branches).set({ isActive: active }).where(eq(branches.id, id));
    await audit(tx, user.tenantId, user.id, active ? 'branch.activate' : 'branch.archive', id);
  });
  revalidatePath('/filiallar');
}

// ---------- Bo'limlar ----------

/**
 * Bo'lim: nomi va boshlig'i. Boshliq — `e:<xodim>` (xodimga hisob va menejer a'zoligi ochiladi) yoki `u:<jamoa a'zosi>`;
 * bitta tushuncha va yagona yozish nuqtasi — server/department-head.ts.
 */
export async function saveDepartmentAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('employees');
  if (user.role === 'manager') return { error: "Bo'limlarni egasi yoki administrator boshqaradi" };
  const id = optUuid(str(f, 'id'));
  const name = str(f, 'name');
  if (name.length < 2) return { error: "Bo'lim nomini kiriting" };
  const raw = str(f, 'head');
  const head: HeadChoice = raw.startsWith('e:') && optUuid(raw.slice(2)) ? { employeeId: raw.slice(2) } : raw.startsWith('u:') && optUuid(raw.slice(2)) ? { userId: raw.slice(2) } : null;
  const responsibleEmployeeId = optUuid(str(f, 'responsible')) ?? null;
  const res = await withTenant(user.tenantId, async (tx): Promise<string | { id: string }> => {
    // «Nazorat» javobgari — shu ishxonaning faol xodimi (RLS: begona xodim topilmaydi)
    if (responsibleEmployeeId) {
      const [e] = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.id, responsibleEmployeeId), eq(employees.status, 'active'))).limit(1);
      if (!e) return 'Javobgar xodim topilmadi yoki faol emas';
    }
    if (id) {
      const [r] = await tx.update(departments).set({ name, responsibleEmployeeId }).where(eq(departments.id, id)).returning({ id: departments.id });
      if (!r) return "Bo'lim topilmadi";
      await audit(tx, user.tenantId, user.id, 'department.update', id, { name, responsibleEmployeeId });
      return { id };
    }
    const [r] = await tx.insert(departments).values({ tenantId: user.tenantId, name, responsibleEmployeeId }).returning({ id: departments.id });
    await audit(tx, user.tenantId, user.id, 'department.create', r!.id, { name, responsibleEmployeeId });
    return { id: r!.id };
  });
  if (typeof res === 'string') return { error: res };
  const err = await setDepartmentHead(user, res.id, head);
  revalidatePath('/xodimlar');
  if (err) return { error: id ? err : `Bo'lim yaratildi, lekin boshliq tayinlanmadi: ${err}` };
  kick();
  return { ok: 'Saqlandi' };
}

export async function archiveDepartmentAction(f: FormData): Promise<void> {
  const user = await assertArea('employees');
  if (user.role === 'manager') return flashError("Ruxsat yo'q");
  const id = z.uuid().parse(f.get('id'));
  await withTenant(user.tenantId, async (tx) => {
    await tx.update(departments).set({ isActive: false }).where(eq(departments.id, id));
    await audit(tx, user.tenantId, user.id, 'department.archive', id);
  });
  revalidatePath('/xodimlar');
}

// ---------- Jadvallar ----------

export async function saveScheduleAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('schedules');
  const id = optUuid(str(f, 'id'));
  const name = str(f, 'name');
  if (name.length < 2) return { error: 'Jadval nomini kiriting' };
  const kind = z.enum(['weekly', 'cycle', 'free']).safeParse(str(f, 'kind'));
  if (!kind.success) return { error: 'Jadval turini tanlang' };
  const startTime = str(f, 'startTime') || '09:00';
  const endTime = str(f, 'endTime') || '18:00';
  if (!isValidTime(startTime) || !isValidTime(endTime)) return { error: "Vaqtni 09:00 ko'rinishida kiriting" };
  const weekdays = f.getAll('weekdays').map(Number).filter((d) => d >= 1 && d <= 7);
  const cycleOn = Number(str(f, 'cycleOn') || 0);
  const cycleOff = Number(str(f, 'cycleOff') || 0);
  const cycleStart = str(f, 'cycleStart') || null;
  if (kind.data === 'weekly' && weekdays.length === 0) return { error: 'Kamida bitta ish kunini belgilang' };
  if (kind.data === 'cycle' && (cycleOn < 1 || cycleOn > 14 || cycleOff < 0 || cycleOff > 14 || !cycleStart || !isValidDate(cycleStart))) {
    return { error: "Navbatli jadval: ish kunlari (1–14), dam kunlari (0–14) va boshlanish sanasi" };
  }
  // Ayrim kunlarda boshqa vaqt (faqat weekly): dtDays[i] — "2,4,6", dtStart[i], dtEnd[i]
  const dayTimes: Array<{ weekdays: number[]; startTime: string; endTime: string }> = [];
  if (kind.data === 'weekly') {
    const seen = new Set<number>();
    for (let i = 0; i < 7; i++) {
      const days = str(f, `dtDays${i}`);
      if (days === '' && !str(f, `dtStart${i}`)) continue;
      const wd = days.split(',').map(Number).filter((d) => d >= 1 && d <= 7 && weekdays.includes(d));
      const st = str(f, `dtStart${i}`);
      const en = str(f, `dtEnd${i}`);
      if (wd.length === 0) return { error: `Qo'shimcha vaqt ${i + 1}: kunlarni tanlang` };
      if (!isValidTime(st) || !isValidTime(en)) return { error: `Qo'shimcha vaqt ${i + 1}: vaqtni 09:00 ko'rinishida kiriting` };
      if (wd.some((d) => seen.has(d))) return { error: 'Bir kun ikki qo\'shimcha vaqtda takrorlanmasin' };
      wd.forEach((d) => seen.add(d));
      dayTimes.push({ weekdays: wd, startTime: st, endTime: en });
    }
  }
  // Haftalik almashinuv
  const altOn = kind.data !== 'free' && str(f, 'altOn') === '1';
  const altStartTime = altOn ? str(f, 'altStartTime') : '';
  const altEndTime = altOn ? str(f, 'altEndTime') : '';
  const altAnchor = altOn ? str(f, 'altAnchor') : '';
  if (altOn && (!isValidTime(altStartTime) || !isValidTime(altEndTime) || !isValidDate(altAnchor))) return { error: 'Almashinuv: ikkinchi hafta vaqti va asosiy vaqt haftasining sanasi kerak' };
  const breakMinutes = Number(str(f, 'breakMinutes') || 0);
  const graceMinutes = Number(str(f, 'graceMinutes') || 0);
  if (!(breakMinutes >= 0 && breakMinutes <= 600 && graceMinutes >= 0 && graceMinutes <= 120)) return { error: 'Tanaffus 0–600, kechikish chegarasi 0–120 daqiqa' };
  const values = {
    name, kind: kind.data, weekdays: kind.data === 'weekly' ? weekdays : [], cycleOn, cycleOff, cycleStart: kind.data === 'cycle' ? cycleStart : null, startTime, endTime, dayTimes,
    altStartTime: altOn ? altStartTime : null, altEndTime: altOn ? altEndTime : null, altAnchor: altOn ? altAnchor : null, breakMinutes, graceMinutes,
  };
  await withTenant(user.tenantId, async (tx) => {
    if (id) {
      const [r] = await tx.update(schedules).set(values).where(eq(schedules.id, id)).returning({ id: schedules.id });
      if (!r) throw new Error('Jadval topilmadi');
      await audit(tx, user.tenantId, user.id, 'schedule.update', id, values);
    } else {
      const [r] = await tx.insert(schedules).values({ tenantId: user.tenantId, ...values }).returning({ id: schedules.id });
      await audit(tx, user.tenantId, user.id, 'schedule.create', r!.id, values);
    }
  });
  revalidatePath('/jadvallar');
  return { ok: 'Saqlandi' };
}

export async function archiveScheduleAction(f: FormData): Promise<void> {
  const user = await assertArea('schedules');
  const id = z.uuid().parse(f.get('id'));
  await withTenant(user.tenantId, async (tx) => {
    await tx.update(schedules).set({ isActive: false }).where(eq(schedules.id, id));
    await audit(tx, user.tenantId, user.id, 'schedule.archive', id);
  });
  revalidatePath('/jadvallar');
}
