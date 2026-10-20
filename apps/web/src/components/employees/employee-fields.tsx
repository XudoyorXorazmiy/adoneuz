import { formatPhone } from '@adone/core';
import { Field } from '@/components/ui/form-drawer';

type Opt = { id: string; name: string };
export type EmployeeFormValue = {
  id: string; fullName: string; phone: string | null; position: string | null; departmentId: string | null; branchId: string | null;
  scheduleId: string | null; payType: 'monthly' | 'hourly' | 'daily'; payRate: number;
};

export function EmployeeFields({ e, options }: { e?: EmployeeFormValue; options: { departments: Opt[]; branches: Opt[]; schedules: Opt[] } }) {
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Ish haqi turi">
          <select name="payType" defaultValue={e?.payType ?? 'monthly'} className="input">
            <option value="monthly">Oylik</option><option value="daily">Kunbay</option><option value="hourly">Soatbay</option>
          </select>
        </Field>
        <Field label="Stavka (so'm)"><input name="payRate" defaultValue={e?.payRate || ''} placeholder="4 500 000" inputMode="numeric" className="input tnum" /></Field>
      </div>
    </>
  );
}
