import { appOrigin } from '@/lib/host';
import { CONTACTS } from '@/lib/landing/content';
import { LandingHeader } from '@/components/landing/header';
import { Checks, Features, Footer, Hero, OneDay, Blueprints, Pilot, Prices, Questions, Sectors, TryIt, Why, type Links } from '@/components/landing/sections';
import { Guides } from '@/components/landing/ui';

/** adone.uz landing — design/landing (Tessel uslubi) 1:1; matn va narxlar `lib/landing/content.ts`. */
export default function LandingPage() {
  const links: Links = {
    // O'zi ro'yxatdan o'tish (5-bosqich) tayyor bo'lguncha «Bepul sinash» — ariza formasi
    start: '#ariza-forma',
    login: `${appOrigin()}/kirish`,
    contact: CONTACTS.telegram ?? `https://t.me/${CONTACTS.bot}`,
  };
  return (
    <div className="min-h-screen overflow-x-clip bg-white font-l-sans text-[16px] text-l-ink [font-variant-numeric:normal] antialiased">
      <div className="relative mx-auto max-w-[1440px]">
        <Guides />
        <LandingHeader loginHref={links.login} startHref={links.start} />
        <main>
          <Hero links={links} />
          <Sectors />
          <Checks />
          <Features />
          <Why />
          <OneDay />
          <Blueprints links={links} />
          <Pilot />
          <Prices links={links} />
          <Questions />
          <TryIt links={links} />
        </main>
        <Footer links={links} />
      </div>
    </div>
  );
}
