import ExcelJS from 'exceljs';
import { DAY_STATUS_LABELS, monthDays, MONTHS, isUuid } from '@adone/core';
import { can } from '@adone/core';
import { currentUser, type TenantUser } from '@/lib/auth/session';
import { monthGrid, monthTotals, today } from '@/server/attendance';

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const SHORT: Record<string, string> = { present: '', late: 'K', absent: 'X', leave: 'R', holiday: 'B', off: '' };

/** Oylik tabel — Excel (.xlsx). Ruxsat va bo'lim cheklovi panel bilan bir xil. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.tenantId || !user.role || !can(user.role, 'attendance')) return new Response('Unauthorized', { status: 401 });
  const u = user as TenantUser;
  const url = new URL(req.url);
  const cur = today(u).slice(0, 7);
  const oy = url.searchParams.get('oy') ?? cur;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(oy) ? oy : cur;
  const bolim = url.searchParams.get('bolim');
  const xodim = url.searchParams.get('xodim');
  const grid = await monthGrid(u, month, isUuid(bolim) ? bolim : undefined);
  // Bitta xodim (profil sahifasidan) — ro'yxat baribir bo'lim cheklovi bilan olingan, shu ichidan
  const emps = xodim ? grid.emps.filter((e) => e.id === xodim) : grid.emps;
  const { cells } = grid;
  const dates = monthDays(month);
  const [y, m] = month.split('-').map(Number) as [number, number];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'adone.uz';
  const ws = wb.addWorksheet(`Tabel ${month}`, { views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }] });
  ws.addRow([`${u.tenantName} — tabel, ${MONTHS[m - 1]} ${y}`]).font = { bold: true, size: 13 };
  ws.addRow(['Belgilar: soat — ishlagan vaqt; K — kechikdi; X — kelmadi; R — ruxsatda']).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  const head = ws.addRow(['№', 'Xodim', 'Lavozim', ...dates.map((d) => Number(d.slice(8))), 'Ish kuni', 'Soat', 'Kechikish (kun)', 'Kechikish (daq)', 'Kelmagan', 'Ruxsat', 'Qo‘shimcha soat']);
  head.font = { bold: true };
  head.alignment = { horizontal: 'center' };
  emps.forEach((e, i) => {
    const t = monthTotals(e.id, dates, cells);
    const row = ws.addRow([
      i + 1, e.fullName, e.position ?? '',
      ...dates.map((d) => {
        const c = cells.get(`${e.id}:${d}`);
        if (!c) return '';
        if (c.workedMinutes > 0) return `${hm(c.workedMinutes)}${c.status === 'late' ? ' K' : ''}`;
        return SHORT[c.status] ?? '';
      }),
      t.presentDays, hm(t.worked), t.lateDays, t.lateMinutes, t.absentDays, t.leaveDays, hm(t.overtime),
    ]);
    dates.forEach((d, j) => {
      const c = cells.get(`${e.id}:${d}`);
      const color = c?.status === 'late' ? 'FFFEF3C7' : c?.status === 'absent' ? 'FFFEE2E2' : c?.status === 'leave' ? 'FFDBEAFE' : null;
      if (color) row.getCell(4 + j).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      row.getCell(4 + j).alignment = { horizontal: 'center' };
      if (c) row.getCell(4 + j).note = DAY_STATUS_LABELS[c.status];
    });
  });
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 14;
  dates.forEach((_, j) => (ws.getColumn(4 + j).width = 6.5));
  for (let k = 0; k < 7; k++) ws.getColumn(4 + dates.length + k).width = 11;

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tabel-${month}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
