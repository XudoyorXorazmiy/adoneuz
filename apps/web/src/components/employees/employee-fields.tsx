import { formatPhone } from '@adone/core';
import { Field } from '@/components/ui/form-drawer';
import { Segmented } from '@/components/settings/ui';

type Opt = { id: string; name: string };
export type EmployeeFormValue = {
  id: string; fullName: string; phone: string | null; position: string | null; departmentId: string | null; branchId: string | null;
  scheduleId: string | null; payType: 'monthly' | 'hourly' | 'daily'; payRate: number;
};

/** `showPay` — faqat `payroll` ruxsati bor rol (egasi, admin): menejer stavkani ko'rmaydi ham, yozmaydi ham (§4). */
export function EmployeeFields({ e, options, showPay = true }: { e?: EmployeeFormValue; options: { departments: Opt[]; branches: Opt[]; schedules: Opt[] }; showPay?: boolean }) {
  const select = (name: string, value: string | null | undefined, opts: Opt[], empty: string) => (
    <select name={name} defaultValue={value ?? ''} className="input">
      <option value="">{empty}</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
  return (
    <>
      {e && <input type="hidden" name="id" value={e.id} />}
      <Field label="Ism-familiya"><input name="fullName" defaultValue={e?.fullName} placeholder="Gulnora Saidova" className="input" required /></Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Telefon" hint="Botda xodim o'z raqamini ulashadi — shu bilan solishtiriladi.">
          <input name="phone" defaultValue={e?.phone ? formatPhone(e.phone) : ''} placeholder="+998 90 123 45 67" inputMode="tel" className="input tnum" />
        </Field>
        <Field label="Lavozim"><input name="position" defaultValue={e?.position ?? ''} placeholder="Sotuvchi" className="input" /></Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Bo'lim">{select('departmentId', e?.departmentId, options.departments, '— tanlanmagan —')}</Field>
        <Field label="Filial">{select('branchId', e?.branchId, options.branches, '— tanlanmagan —')}</Field>
      </div>
      <Field label="Ish jadvali" hint="Jadvalsiz xodimga kechikish hisoblanmaydi.">{select('scheduleId', e?.scheduleId, options.schedules, '— jadvalsiz —')}</Field>
      {showPay && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Ish haqi turi</span>
          <Segmented name="payType" full defaultValue={e?.payType ?? 'monthly'} options={[{ value: 'monthly', label: 'Oylik' }, { value: 'daily', label: 'Kunbay' }, { value: 'hourly', label: 'Soatbay' }]} />
        </div>
        <Field label="Stavka (so'm)"><input name="payRate" defaultValue={e?.payRate || ''} placeholder="4 500 000" inputMode="numeric" className="input tnum" /></Field>
      </div>}
    </>
  );
}
