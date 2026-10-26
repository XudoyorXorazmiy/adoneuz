import ExcelJS from 'exceljs';
import { can, MONTHS, PAY_TYPE_LABELS, PAYROLL_STATUS_LABELS, isUuid } from '@adone/core';
import { currentUser, type TenantUser } from '@/lib/auth/session';
import { today } from '@/server/attendance';
import { isMonth, payrollView } from '@/server/payroll';

/** Ish haqi vedomosti — Excel (.xlsx). Ruxsat — `payroll` (egasi, admin). Summalar butun so'm, son formatida. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.tenantId || !user.role || !can(user.role, 'payroll')) return new Response('Unauthorized', { status: 401 });
  const u = user as TenantUser;
  const url = new URL(req.url);
  const cur = today(u).slice(0, 7);
  const oy = url.searchParams.get('oy');
  const month = isMonth(oy) && oy <= cur ? oy : cur;
  const bolim = url.searchParams.get('bolim');
  const { period, rows } = await payrollView(u.tenantId, month, isUuid(bolim) ? bolim : undefined);
  const [y, m] = month.split('-').map(Number) as [number, number];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'adone.uz';
  const ws = wb.addWorksheet(`Ish haqi ${month}`, { views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }] });
  ws.addRow([`${u.tenantName} — ish haqi, ${MONTHS[m - 1]} ${y}`]).font = { bold: true, size: 13 };
  ws.addRow([`Holat: ${period ? PAYROLL_STATUS_LABELS[period.status] : '—'}`]).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  const head = ws.addRow(['№', 'Xodim', 'Lavozim', 'Turi', 'Stavka', 'Ish kuni', 'Reja kuni', 'Soat', 'Kechikish (kun)', 'Kelmagan', 'Ruxsat', 'Asosiy', 'Jarima', 'Bonus', 'Tuzatish', 'Tuzatish sababi', 'Jami']);
  head.font = { bold: true };
  rows.forEach((r, i) => {
    const s = r.breakdown.stats;
    ws.addRow([i + 1, r.name, r.position ?? '', PAY_TYPE_LABELS[r.payType], r.rate, s.workedDays, s.plannedDays, Math.round((s.workedMinutes / 60) * 10) / 10, s.lateDays, s.absentDays, s.leaveDays,
      r.base, -r.penaltyTotal, r.bonusTotal, r.adjustment, r.adjustmentReason ?? '', r.total]);
  });
  const total = ws.addRow(['', 'Jami', '', '', '', '', '', '', '', '', '', ...(['base', 'penaltyTotal', 'bonusTotal', 'adjustment'] as const).map((k) => rows.reduce((a, r) => a + (k === 'penaltyTotal' ? -r[k] : r[k]), 0)), '', rows.reduce((a, r) => a + r.total, 0)]);
  total.font = { bold: true };
  for (const c of [5, 12, 13, 14, 15, 17]) ws.getColumn(c).numFmt = '#,##0';
  [4, 26, 16, 10, 12, 9, 9, 8, 10, 9, 8, 13, 12, 12, 12, 28, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ish-haqi-${month}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
