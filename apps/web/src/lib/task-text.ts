/**
 * Vazifa xabari matni (Telegram, HTML) — bot ham, «Vazifa berish» oynasidagi jonli ko'rinish ham shundan oladi.
 * server-only emas: client komponent (preview) import qiladi.
 */
import { TASK_PRIORITY_LABELS, TASK_PROOF_LABELS, type TaskPriority, type TaskProof } from '@adone/core';

export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PRIORITY_ICON: Record<TaskPriority, string> = { low: '⚪️', medium: '🟠', high: '🔴' };

export function proofText(proofs: readonly TaskProof[]): string {
  const real = proofs.filter((p) => p !== 'button');
  return real.length ? `${real.map((p) => TASK_PROOF_LABELS[p].toLowerCase()).join(' + ')} bilan` : 'tugma bilan';
}

/** «🆕 Yangi vazifa!» kartasi. `due` — tayyor matn («Bugun, 17:00»). */
export function taskCardText(t: { title: string; description?: string | null; from: string; due: string | null; priority: TaskPriority; proofs: readonly TaskProof[]; checklist?: string[]; header?: string }): string {
  return [
    `📋 <b>${escHtml(t.header ?? 'Yangi vazifa!')}</b>`,
    `<b>${escHtml(t.title)}</b>`,
    t.description ? `\n${escHtml(t.description)}\n` : '',
    `👤 Kimdan: ${escHtml(t.from)}`,
    t.due ? `⏰ Muddat: ${t.due}` : '',
    `${PRIORITY_ICON[t.priority]} Muhimlik: ${TASK_PRIORITY_LABELS[t.priority]}`,
    `📷 Hisobot: ${proofText(t.proofs)}`,
    t.checklist?.length ? `\n☑️ Bosqichlar:\n${t.checklist.map((c) => `• ${escHtml(c)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

/** Muddat matni: «Bugun, 17:00» / «Ertaga, 09:00» / «21.10.2026, 18:00». `today` — ishxona sanasi. */
export function dueLabel(dueDate: string, dueTime: string, today: string): string {
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const d = dueDate === today ? 'Bugun' : dueDate === tomorrow ? 'Ertaga' : dueDate.split('-').reverse().join('.');
  return `${d}, ${dueTime}`;
}
