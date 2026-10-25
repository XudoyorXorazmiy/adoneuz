import ExcelJS from 'exceljs';
import { can, formatDate, formatTime, periodLabel, RATING_WEIGHTS, TASK_STATUS_LABELS } from '@adone/core';
import { currentUser, type TenantUser } from '@/lib/auth/session';
import { today } from '@/server/attendance';
import { buildReport, loadJournal, parseReportParams } from '@/server/reports';

const SHEETS = ['davomat', 'vazifalar', 'reyting', 'jurnal'] as const;
const hours = (m: number) => Math.round((m / 60) * 10) / 10;
const SOURCE: Record<string, string> = { assigned: 'Berilgan', self_plan: "O'zi rejalashtirdi", self_done: "O'zi qo'shdi" };

/**
 * Hisobotlar — Excel (.xlsx): har tanlangan bo'lim (`varaq=davomat,vazifalar,reyting,jurnal`) alohida varaq.
 * Davr va filtrlar — sahifa bilan bir xil (`davr`, `dan`, `gacha`, `filial`, `bolim`). Ruxsat — `reports` (egasi, admin).
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.tenantId || !user.role || !can(user.role, 'reports')) return new Response('Unauthorized', { status: 401 });
  const u = user as TenantUser;
  const url = new URL(req.url);
  const f = parseReportParams(Object.fromEntries(url.searchParams), today(u));
  const want = new Set((url.searchParams.get('varaq') ?? 'davomat,vazifalar,reyting').split(',').filter((s) => (SHEETS as readonly string[]).includes(s)));
  if (want.size === 0) want.add('davomat');
  const { from, to } = f.period;
  const label = periodLabel(from, to, today(u));
  const tz = u.tenantTimezone;
  const r = want.has('davomat') || want.has('vazifalar') || want.has('reyting') ? await buildReport(u, f) : null;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'adone.uz';
  const sheet = (name: string, title: string, freeze = 2) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: freeze, ySplit: 3 }] });
    ws.addRow([`${u.tenantName} — ${title}, ${label}`]).font = { bold: true, size: 13 };
    ws.addRow([`Davr: ${formatDate(`${from}T12:00:00Z`)} – ${formatDate(`${to}T12:00:00Z`)}`]).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    return ws;
  };
  const header = (ws: ExcelJS.Worksheet, cols: string[]) => { const h = ws.addRow(cols); h.font = { bold: true }; return h; };
  const widths = (ws: ExcelJS.Worksheet, w: number[]) => w.forEach((x, i) => (ws.getColumn(i + 1).width = x));

  if (r && want.has('davomat')) {
    const ws = sheet('Davomat', 'davomat');
    header(ws, ['№', 'Xodim', 'Lavozim', "Bo'lim", 'Reja kuni', 'Kelgan kun', 'Kechikish (marta)', 'Kechikish (daq)', 'Erta ketish (marta)', 'Erta ketish (daq)',
      'Kelmagan', 'Ruxsatda', 'Ishladi (soat)', "Qo'shimcha (soat)", 'Davomat, %']);
    r.attendance.rows.forEach(({ emp, stats: s }, i) => ws.addRow([i + 1, emp.name, emp.position ?? '', emp.departmentName ?? '', s.planned, s.came, s.late, s.lateMinutes,
      s.early, s.earlyMinutes, s.absent, s.leave, hours(s.workedMinutes), hours(s.overtimeMinutes), s.pct ?? '']));
    const t = r.attendance.total;
    ws.addRow(['', 'Jami', '', '', t.planned, t.came, t.late, t.lateMinutes, t.early, t.earlyMinutes, t.absent, t.leave, hours(t.workedMinutes), hours(t.overtimeMinutes), t.pct ?? '']).font = { bold: true };
    ws.addRow([]);
    ws.addRow(["Kunlar bo'yicha"]).font = { bold: true };
    header(ws, ['', 'Sana', 'Ishda', 'Kechikdi', 'Kelmadi', 'Ruxsatda', 'Dam olish']);
    for (const d of r.attendance.series) ws.addRow(['', formatDate(`${d.date}T12:00:00Z`), d.present, d.late, d.absent, d.leave, d.off]);
    widths(ws, [4, 26, 16, 16, 10, 11, 10, 10, 10, 10, 10, 10, 12, 12, 11]);
  }

  if (r && want.has('vazifalar')) {
    const ws = sheet('Vazifalar', 'vazifalar');
    header(ws, ['№', 'Xodim', "Bo'lim", 'Berilgan', 'Bajarildi', 'Bajarildi, %', "O'z vaqtida, %", 'Kechikdi', 'Qaytarildi', "O'rtacha baho", "O'zi qo'shgan (ish)", "O'zi qo'shgan (soat)"]);
    r.tasks.rows.forEach(({ emp, stats: s }, i) => ws.addRow([i + 1, emp.name, emp.departmentName ?? '', s.given, s.done, s.donePct ?? '', s.onTimePct ?? '', s.late, s.returned,
      s.avgRating ?? '', s.selfDone + s.selfPlan, hours(s.selfMinutes)]));
    const t = r.tasks.total;
    ws.addRow(['', 'Jami', '', t.given, t.done, t.donePct ?? '', t.onTimePct ?? '', t.late, t.returned, t.avgRating ?? '', t.selfDone + t.selfPlan, hours(t.selfMinutes)]).font = { bold: true };
    ws.addRow([]);
    ws.addRow([r.tasks.bucketKind === 'day' ? "Kunlar bo'yicha" : "Haftalar bo'yicha"]).font = { bold: true };
    header(ws, ['', 'Davr', 'Oraliq', 'Berilgan', "O'z vaqtida", 'Kechikib', "O'rtacha baho"]);
    for (const b of r.tasks.buckets) ws.addRow(['', b.label, b.range, b.given, b.onTime, b.late, b.avgRating ?? '']);
    widths(ws, [4, 26, 16, 10, 10, 11, 12, 10, 10, 12, 14, 14]);
  }

  if (r && want.has('reyting')) {
    const ws = sheet('Reyting', 'reyting');
    ws.getRow(2).getCell(1).value = `Ball = davomat ${RATING_WEIGHTS.attendance}% + vazifalar o'z vaqtida ${RATING_WEIGHTS.onTime}% + o'rtacha baho ${RATING_WEIGHTS.rating}% · ${formatDate(`${from}T12:00:00Z`)} – ${formatDate(`${to}T12:00:00Z`)}`;
    header(ws, ["O'rin", 'Xodim', "Bo'lim", 'Ball', "O'zgarish (o'rin)", 'Davomat, %', "O'z vaqtida, %", "O'rtacha baho", 'Asosiy sabab']);
    for (const x of r.rating.rows) ws.addRow([x.place, x.emp.name, x.emp.departmentName ?? '', x.score, x.change ?? '', x.attendance ?? '', x.onTime ?? '', x.rating ?? '', x.score < 90 ? x.reason ?? '' : '']);
    ws.addRow([]);
    ws.addRow(["Bo'limlar reytingi"]).font = { bold: true };
    header(ws, ["O'rin", "Bo'lim", '', 'Ball']);
    for (const d of r.rating.departments) ws.addRow([d.place, d.name, '', d.score]);
    widths(ws, [7, 26, 16, 8, 14, 11, 12, 12, 28]);
  }

  if (want.has('jurnal')) {
    const j = await loadJournal(u, f);
    const ws = sheet('Ish jurnali', 'ish jurnali', 0);
    header(ws, ['Sana', 'Vaqt', 'Xodim', 'Ish', 'Manba', 'Holat', 'Sarflangan (daq)']);
    for (const e of j.entries) ws.addRow([formatDate(e.at, tz), formatTime(e.at, tz), e.name, e.title, SOURCE[e.source] ?? e.source, TASK_STATUS_LABELS[e.status], e.spentMinutes ?? '']);
    if (j.truncated) ws.addRow(['Oxirgi 300 ta yozuv — davrni qisqartiring']).font = { italic: true, color: { argb: 'FF64748B' } };
    widths(ws, [11, 7, 24, 44, 16, 14, 14]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="hisobot-${from}-${to}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
