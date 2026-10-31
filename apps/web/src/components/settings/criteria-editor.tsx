'use client';
import { useState } from 'react';
import type { InspectionCriterion } from '@adone/core';
import { Icon } from '@/components/ui/icon';

type Row = { key: number; id: string; label: string; departments: string[] | null };

/** Nazorat mezonlari ro'yxati: yorliq + qaysi bo'limlarga tegishli (hech biri tanlanmasa — hammasiga). Qatorlar `label_<n>`, `id_<n>`, `dep_<n>`. */
export function CriteriaEditor({ criteria, departments }: { criteria: InspectionCriterion[]; departments: Array<{ id: string; name: string }> }) {
  const [rows, setRows] = useState<Row[]>(() => criteria.map((c, i) => ({ key: i, ...c })));
  const [next, setNext] = useState(criteria.length);
  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const toggleDep = (row: Row, id: string) => {
    const cur = row.departments ?? [];
    const deps = cur.includes(id) ? cur.filter((d) => d !== id) : [...cur, id];
    update(row.key, { departments: deps.length ? deps : null });
  };
  return (
    <div className="flex flex-col gap-3 py-2">
      {rows.map((row, i) => (
        <div key={row.key} className="flex flex-col gap-2 rounded-2xl border border-line p-3">
          <div className="flex items-center gap-2">
            <span className="tnum w-6 text-sm text-muted">{i + 1}</span>
            <input type="hidden" name={`id_${i}`} value={row.id} />
            <input name={`label_${i}`} value={row.label} onChange={(e) => update(row.key, { label: e.target.value })} maxLength={60} placeholder="Mezon nomi" className="input h-10 flex-1" />
            <button type="button" onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))} className="btn-icon" title="O'chirish"><Icon name="delete" size={18} /></button>
          </div>
          {departments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pl-8">
              <span className="text-xs text-muted">{row.departments ? 'Faqat:' : 'Hamma bo‘limga'}</span>
              {departments.map((d) => {
                const on = !!row.departments?.includes(d.id);
                return (
                  <label key={d.id} className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-primary text-white' : 'bg-subtle text-muted'}`}>
                    <input type="checkbox" name={`dep_${i}`} value={d.id} checked={on} onChange={() => toggleDep(row, d.id)} className="hidden" />{d.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={() => { setRows((r) => [...r, { key: next, id: '', label: '', departments: null }]); setNext((n) => n + 1); }} className="btn-secondary h-10 w-fit text-sm"><Icon name="add" size={18} className="text-primary" />Mezon qo&apos;shish</button>
    </div>
  );
}
