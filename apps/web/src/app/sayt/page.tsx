import Link from 'next/link';
import { Camera, ClipboardCheck, MapPin, Send } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { appOrigin } from '@/lib/host';

/** Vaqtinchalik landing (5-bosqichda dizayn bilan almashtiriladi). */
export default function LandingPage() {
  const features = [
    { icon: <MapPin size={20} />, title: 'Lokatsiya', text: "Xodim faqat filial zonasida «Keldim» qila oladi — uydan belgilab bo'lmaydi." },
    { icon: <Camera size={20} />, title: 'Jonli selfi va yuz', text: 'Kamera orqali jonli rasm va yuz tekshiruvi — boshqa odam o‘rniga kelolmaydi.' },
    { icon: <ClipboardCheck size={20} />, title: 'Vazifalar', text: 'Rahbar vazifa beradi, xodim rasm bilan hisobot topshiradi, rahbar tasdiqlaydi.' },
    { icon: <Send size={20} />, title: 'Telegram orqali', text: "Ilova o'rnatish shart emas — hammasi Telegram bot va Mini App'da." },
  ];
  return (
    <main className="min-h-screen bg-card">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-5">
        <Logo />
        <Link href={`${appOrigin()}/kirish`} className="btn-secondary">Kirish</Link>
      </header>
      <section className="mx-auto flex max-w-[1120px] flex-col items-start gap-6 px-4 pt-12 pb-16 md:pt-20">
        <h1 className="m-0 max-w-[720px] text-4xl leading-tight font-bold tracking-[-0.02em] md:text-5xl">Kim ishda va bugun nima qilindi — bir qarashda.</h1>
        <p className="m-0 max-w-[620px] text-lg text-muted">adone — xodimlar davomati va vazifalarini Telegram orqali nazorat qilish tizimi. Lokatsiya, jonli selfi va yuz tekshiruvi bilan.</p>
        <a href="https://t.me/adoneuz_bot" className="btn-primary btn-lg">Ulanish uchun ariza</a>
      </section>
      <section className="mx-auto grid max-w-[1120px] grid-cols-1 gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="card-pad flex flex-col gap-2">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary-tint text-primary">{f.icon}</span>
            <span className="font-semibold">{f.title}</span>
            <span className="text-[13px] text-muted">{f.text}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
