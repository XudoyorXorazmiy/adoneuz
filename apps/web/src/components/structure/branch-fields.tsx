import { Field } from '@/components/ui/form-drawer';
import { Slider } from '@/components/settings/client';

export function BranchFields({ b }: { b?: { id: string; name: string; address: string | null; lat: number; lng: number; radiusM: number } }) {
  return (
    <>
      {b && <input type="hidden" name="id" value={b.id} />}
      <Field label="Nomi"><input name="name" defaultValue={b?.name} placeholder="Mudom — Markaz" className="input" required /></Field>
      <Field label="Manzil"><input name="address" defaultValue={b?.address ?? ''} placeholder="Hazorasp, markaz" className="input" /></Field>
      <Field
        label="Joylashuv"
        hint={<>Google yoki Yandex xaritada filial nuqtasini bosib, havolani shu yerga qo&apos;ying — yoki «41.3194, 61.0742».</>}
      >
        <input name="coords" defaultValue={b ? `${b.lat}, ${b.lng}` : ''} placeholder="https://maps.app.goo.gl/… yoki 41.3194, 61.0742" className="input tnum" required />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Radius (metr)</span>
        <Slider name="radiusM" min={20} max={2000} step={1} defaultValue={b?.radiusM ?? 100} unit=" m" lo="20 m" hi="2 km" />
        <span className="block text-xs text-muted">Xodim shu doira ichida «Keldim» qila oladi. Odatda 50–150 m.</span>
      </div>
    </>
  );
}
