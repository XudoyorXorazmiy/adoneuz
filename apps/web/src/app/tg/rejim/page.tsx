import { ModeSwitch } from '@/components/tg/mode-switch';

/** Rejim almashtirish (bot xabaridagi «Rahbar rejimi» tugmasi ham shu yerga): `?to=rahbar|xodim` → cookie → bosh sahifa. */
export default async function TgModePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <ModeSwitch to={sp.to === 'xodim' ? 'xodim' : 'rahbar'} />;
}
