import { Field } from '@/components/ui/form-drawer';

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
      <Field label="Radius (metr)" hint="Xodim shu doira ichida «Keldim» qila oladi. Odatda 50–150 m.">
        <input name="radiusM" type="number" min={20} max={2000} defaultValue={b?.radiusM ?? 100} className="input tnum" required />
      </Field>
    </>
  );
}
