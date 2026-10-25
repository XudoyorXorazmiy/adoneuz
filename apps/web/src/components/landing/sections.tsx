/**
 * Landing bo'limlari (server) — design/landing: A (hero, 01), B (02, 03), C (04–06), D (07–09), E (10, footer), F (telefon).
 * Desktop 1440 da piksel 1:1; lg — kasr ustunlar; telefon — Landing F.
 */
import { BLUEPRINTS, CONTACTS, FEATURES, METRICS, PILOT, SECTORS, WHY } from '@/lib/landing/content';
import { arrivalsChart, featureArts, TOWNS, townArt } from './art';
import { Faq } from './faq';
import { CubeWordmark, SystemStatus, TashkentClock } from './footer-live';
import { GeofenceBoard } from './geofence-board';
import { HeroArt } from './hero-art';
import { LeadForm } from './lead-form';
import { Pricing } from './pricing';
import { StackScroll } from './stack-scroll';
import { Btn3d, Eyebrow, H2, LogoMark, PAD_X, Section, SectionHead, Wordmark } from './ui';
import { WordReveal } from './word-reveal';

export interface Links { start: string; login: string; contact: string }

export function Hero({ links }: { links: Links }) {
  return (
    <>
      <section className={`relative grid grid-cols-1 pt-14 pb-10 lg:grid-cols-[511fr_715fr] lg:pt-24 lg:pb-[72px] ${PAD_X}`}>
        <div className="flex flex-col lg:pt-10">
          <Eyebrow>ADONE · TELEGRAM ORQALI DAVOMAT</Eyebrow>
          <h1 className="m-0 mt-5 font-l-serif text-[44px] leading-[42px] font-[360] tracking-[-0.035em] lg:mt-7 lg:w-[560px] lg:max-w-[calc(100%+60px)] lg:text-[60px] lg:leading-[58px] xl:text-[72px] xl:leading-[69px]">
            Kim ishda, kim kechikdi — <span className="text-l-muted">telefoningizda.</span>
          </h1>
          <p className="m-0 mt-5 text-[19px] leading-[28.5px] text-l-body lg:mt-7 lg:max-w-[450px]">
            Xodim Telegram&apos;da «Keldim» bosadi. adone joylashuvni, jonli selfini, yuzni va telefonni tekshiradi. Siz kim ishda ekanini, kim kechikkanini va bugun nima qilinganini bir qarashda ko&apos;rasiz.
          </p>
          <div className="mt-7 flex flex-col gap-[11px] lg:mt-10 lg:flex-row lg:gap-5">
            <Btn3d href={links.start} full className="lg:w-auto lg:flex-none">Bepul sinash ↗</Btn3d>
            <Btn3d href="#tekshiruv" variant="secondary" full className="lg:w-auto">Qanday ishlashini ko&apos;rish</Btn3d>
          </div>
        </div>
        <div className="relative mt-9 flex items-center justify-center lg:mt-0 lg:h-[560px]">
          <div aria-hidden className="absolute inset-0 [background-image:repeating-linear-gradient(30deg,rgba(11,11,13,.045)_0_1px,transparent_1px_26px),repeating-linear-gradient(150deg,rgba(11,11,13,.045)_0_1px,transparent_1px_26px)] [mask-image:radial-gradient(closest-side,#000_55%,transparent)]" />
          <div className="relative w-full max-w-[560px]"><HeroArt /></div>
          <div className="l-label-sm absolute bottom-1.5 left-1.5 hidden text-l-muted xl:block">YAQINLASHING — QATLAMLAR AJRALADI</div>
        </div>
      </section>
      <div className="l-bleed border-t border-l-line"><div className={`l-label-sm lg:l-label relative mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-[18px] gap-y-2 py-3.5 text-l-body lg:h-14 lg:gap-10 lg:py-0 ${PAD_X}`}>
        <span className="flex items-center gap-2"><span className="size-1.5 bg-l-accent" /><span className="text-l-ink">39 / 48</span> HOZIR ISHDA</span>
        <span>GEOFENCE · SELFI · YUZ · QURILMA</span>
        <span>ILOVA O&apos;RNATISH SHART EMAS</span>
        <span className="hidden flex-1 lg:block" />
        <a href="#tekshiruv" className="hidden text-l-ink hover:text-l-accent lg:inline">YAQINROQ KELING — TEKSHIRUVNI OCHING ↗</a>
      </div></div>
    </>
  );
}

const SECTOR_STYLE = {
  serif: 'font-l-serif text-[22px] lg:text-[26px] font-[360] tracking-[-0.5px]',
  'serif-i': 'font-l-serif text-[22px] lg:text-[26px] font-[360] italic tracking-[-0.5px] text-l-body',
  mono: 'font-l-mono text-xs lg:text-[13px] tracking-[0.06em] text-l-body',
  sans: 'text-xl lg:text-[22px] font-semibold tracking-[-0.4px] text-l-muted',
  caps: 'text-lg lg:text-xl font-semibold tracking-[0.08em]',
} as const;

export function Sectors() {
  const strip = (aria?: boolean) => (
    <div aria-hidden={aria} className="flex shrink-0 items-center gap-7 pr-7 lg:gap-14 lg:pr-14">
      {SECTORS.map(([t, s], i) => <span key={t} className={`${SECTOR_STYLE[s]} ${i % 3 === 2 && s === 'serif' ? 'text-l-muted' : ''}`}>{t}</span>)}
    </div>
  );
  return (
    <Section tag="01 SOHALAR" className="flex flex-col gap-3 py-[18px] lg:grid lg:h-[100px] lg:grid-cols-[355px_1fr] lg:items-center lg:gap-0 lg:py-0 lg:pr-0 xl:pr-0">
      <span className="l-label-sm lg:l-label text-l-muted"><span className="lg:hidden">01 · </span>PILOT: MUDOM BOZOR, HAZORASP</span>
      <div className="l-fade-x overflow-hidden lg:mr-8 lg:pt-2 xl:mr-16">
        <div className="flex w-max animate-l-marquee whitespace-nowrap">{strip()}{strip(true)}</div>
      </div>
    </Section>
  );
}

export function Checks() {
  return (
    <Section id="tekshiruv" tag="02 TEKSHIRUV" className="pt-[72px] pb-14 lg:py-[136px]">
      <SectionHead eyebrow="TEKSHIRUV" lead="To'rt qatlam." rest="Bitta «Keldim» ortida." />
      <StackScroll />
    </Section>
  );
}

export function Features() {
  const arts = featureArts();
  return (
    <Section id="imkoniyatlar" tag="03 IMKONIYATLAR" className="pt-[72px] pb-14 lg:py-[136px]">
      <SectionHead eyebrow="IMKONIYATLAR" lead="Davomatdan ish haqigacha." rest="Bitta tizimda.">
        <p className="m-0 hidden max-w-[600px] text-[19px] leading-[28.5px] text-l-body lg:block">Telegram guruhdagi «keldim» xabarlari va qo&apos;lda yuritiladigan jurnal o&apos;rniga — tekshiriladigan, hisoblanadigan, Excel&apos;ga chiqadigan tizim.</p>
      </SectionHead>
      <div className="mt-7 grid grid-cols-1 border-t border-l border-l-line md:grid-cols-2 lg:mt-[88px] lg:-ml-px lg:grid-cols-3">
        {FEATURES.map((c, i) => (
          <div key={c.n} className="flex flex-col border-r border-b border-l-line lg:h-[489px]">
            <div className="l-iso-grid-sm relative flex h-[170px] items-center justify-center overflow-hidden border-b border-l-line lg:h-[280px]">
              <span className="l-label-sm absolute top-3 left-3.5 hidden text-l-muted lg:block">{c.n}</span>
              <div className="w-full max-w-[300px] lg:max-w-[380px]">{arts[i]}</div>
            </div>
            <div className="flex flex-1 flex-col p-5 lg:px-7 lg:pt-7 lg:pb-6">
              <h3 className="m-0 font-l-serif text-2xl leading-[29px] font-[380] tracking-[-0.48px]">{c.t}</h3>
              <p className="m-0 mt-2 text-base leading-6 text-l-body lg:mt-2.5">{c.p}</p>
              <div className="l-label-sm mt-3.5 text-l-muted lg:mt-auto">{c.m}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Why() {
  return (
    <Section tag="04 NEGA ADONE" className="pt-[72px] pb-16 lg:pt-[136px] lg:pb-[140px]">
      <Eyebrow className="hidden lg:flex">NEGA ADONE</Eyebrow>
      <div className="lg:mt-10"><WordReveal text={WHY} /></div>
    </Section>
  );
}

export function OneDay() {
  return (
    <Section dark tag="05 BIR KUN" className="pt-[72px] pb-14 lg:pt-[136px] lg:pb-[140px]">
      <div className="relative">
        <SectionHead eyebrow="NAMUNA KUN" lead="Ertalab 09:00 dan oldin." rest="Hammasi aniq." dark />
        <div className="mt-7 grid grid-cols-1 items-center gap-5 lg:mt-24 lg:grid-cols-[480fr_686fr] lg:gap-[60px]">
          <div>
            {METRICS.map(([n, l]) => (
              <div key={n} className="flex flex-col gap-2 border-t border-l-line-dark py-5 lg:flex-row lg:items-baseline lg:justify-between lg:gap-4 lg:py-7">
                <span className="font-l-serif text-[48px] leading-[48px] font-[360] tracking-[-1.4px] xl:text-[56px] xl:leading-[56px] xl:tracking-[-1.7px]">{n}</span>
                <span className="l-label-sm lg:l-label text-l-on-dark-2 lg:text-right">{l}</span>
              </div>
            ))}
            <div className="border-t border-l-line-dark" />
          </div>
          <div className="flex flex-col items-start gap-3.5">
            <div className="l-label hidden text-l-on-dark-2 lg:block">KELGANLAR · 15 DAQIQALIK ORALIQ</div>
            <div className="w-full max-w-[640px] overflow-hidden">{arrivalsChart()}</div>
            <div className="l-label-sm flex self-stretch justify-between gap-3 text-[9px] text-l-muted lg:text-[10px]"><span>NAMUNA: SHANBA, 25.10.2026</span><span>[ILLUSTRATIV]</span></div>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function Blueprints({ links }: { links: Links }) {
  return (
    <Section tag="06 QAYSI BIZNES UCHUN" divider={false} className="pt-[72px] pb-14 lg:pt-[136px] lg:pb-[140px]">
      <SectionHead eyebrow="TAYYOR SOZLAMALAR" lead="Biznesingizni tanlang." rest="Ertaga ertalab boshlang." />
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-[88px] lg:grid-cols-4">
        {BLUEPRINTS.map((c, i) => (
          <a key={c.k} href={links.start} className="group flex border border-l-line bg-white text-l-ink transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.7,.1,1)] hover:-translate-x-1.5 hover:-translate-y-1.5 hover:shadow-[6px_6px_0_#DFDFDB] sm:flex-col lg:h-[415px]">
            <div className="l-sq-grid flex w-[110px] shrink-0 items-center justify-center overflow-hidden border-r border-l-line sm:aspect-square sm:w-auto sm:border-r-0 sm:border-b lg:h-[295px]">
              <div className="w-full max-w-[280px]">{townArt(...TOWNS[i]!)}</div>
            </div>
            <div className="flex min-h-24 flex-1 flex-col gap-1.5 px-4 py-3.5 lg:gap-2 lg:px-5 lg:py-[18px]">
              <div className="l-label-sm lg:l-label flex justify-between text-l-body"><span>{c.k}</span><span className="font-l-sans text-base transition-colors group-hover:text-l-accent lg:text-[17px]">↗</span></div>
              <div className="text-[17px] leading-[22px] font-medium tracking-[-0.17px]">{c.t}</div>
              <div className="l-label-sm mt-auto text-[9px] text-l-muted lg:text-[10px]">{c.m}</div>
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}

/** 07 Pilot — faqat haqiqiy iqtibos va raqamlar bo'lsa (content.ts PILOT). */
export function Pilot() {
  if (!PILOT) return null;
  return (
    <Section tag="07 PILOT" className="pt-[72px] pb-14 lg:py-[136px]">
      <Eyebrow>MUDOM BOZOR · PILOT</Eyebrow>
      <div className="mt-4 lg:mt-10 lg:ml-[29%]">
        <p className="m-0 font-l-serif text-[30px] leading-9 font-[360] tracking-[-0.6px] lg:text-[48px] lg:leading-[57px] lg:tracking-[-1.2px]">«{PILOT.quote}»</p>
        <div className="mt-5 flex items-center gap-3 lg:mt-9">
          <span className="flex size-8 items-center justify-center rounded-full border border-l-line bg-l-side font-l-mono text-[10px] text-l-body">{PILOT.initials}</span>
          <div><div className="text-[15px] font-medium">{PILOT.name}</div><div className="l-label-sm mt-0.5 text-l-muted">{PILOT.role}</div></div>
        </div>
        <div className="mt-7 grid grid-cols-3 border-t border-l-line lg:mt-16">
          {PILOT.stats.map(([v, l], i) => (
            <div key={l} className={`px-2.5 pt-4 lg:px-6 lg:pt-7 ${i ? 'border-l border-l-line' : ''}`}>
              <div className="font-l-serif text-[32px] font-[360] tracking-[-1.3px] lg:text-[44px]">{v}</div>
              <div className="l-label-sm mt-1.5 text-[8px] text-l-body lg:l-label lg:mt-2.5">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function Prices({ links }: { links: Links }) {
  return (
    <Section id="tariflar" tag="08 TARIFLAR" className="pt-[72px] pb-14 lg:py-[136px]">
      <Pricing startHref={links.start} contactHref={links.contact} eyebrow={<Eyebrow className="self-start lg:pt-3.5">TARIFLAR</Eyebrow>} title={<H2 lead="Xodimlar soniga qarab." rest="14 kun bepul." />} />
      <div className="l-label mt-10 text-l-body">TO&apos;LOV: CLICK, PAYME YOKI BANK O&apos;TKAZMASI</div>
    </Section>
  );
}

export function Questions() {
  return (
    <Section id="savollar" tag="09 SAVOLLAR" className="pt-[72px] pb-14 lg:py-[136px]">
      <div className="grid grid-cols-1 lg:grid-cols-[511fr_715fr]">
        <div className="flex flex-col gap-4 lg:gap-7">
          <Eyebrow>SAVOLLAR</Eyebrow>
          <H2 lead="Boshlashdan" rest="oldin so'rashadi." className="mb-6 lg:mb-0 lg:max-w-[440px]" />
        </div>
        <Faq />
      </div>
    </Section>
  );
}

export function TryIt({ links }: { links: Links }) {
  return (
    <Section id="ariza" tag="10 SINAB KO'RING" className="pt-[72px] pb-14 lg:pt-[136px] lg:pb-[120px]">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,634px)] lg:gap-[60px]">
        <div className="flex flex-col">
          <Eyebrow>NAVBAT SIZDA</Eyebrow>
          <H2 lead="Birinchi «Keldim»ni" rest="bosing." className="mt-4 lg:mt-7" />
          <p className="m-0 mt-7 hidden max-w-[480px] text-[19px] leading-[28.5px] text-l-body lg:block">Xaritadagi istalgan katakni bosing — xodim shu joydan «Keldim» bosdi, deb hisoblaymiz. Doira ichida — qabul, tashqarida — rad. Keyin haqiqiysini ulang: 14 kun bepul, karta kerak emas.</p>
          <div className="mt-10 hidden gap-5 lg:flex">
            <Btn3d href="#ariza-forma">Bepul sinash ↗</Btn3d>
            <Btn3d href={links.contact} variant="secondary">Demo so&apos;rash</Btn3d>
          </div>
        </div>
        <div className="hidden lg:block"><GeofenceBoard /></div>
        <div className="lg:hidden"><GeofenceBoard compact /></div>
      </div>
      <div id="ariza-forma" className="mt-6 scroll-mt-24 lg:mt-[72px] lg:border lg:border-l-line">
        <LeadForm />
        <div className="l-label-sm mt-2 text-[9px] text-l-body lg:mt-0 lg:border-t lg:border-l-line lg:px-6 lg:py-3 lg:text-[10px]">1 ISH KUNIDA QO&apos;NG&apos;IROQ QILAMIZ</div>
      </div>
    </Section>
  );
}

function Cell({ id, className = '', children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative border-b border-l-line ${className}`}>
      <span className="absolute top-2 right-2.5 font-l-mono text-[9px] text-l-muted lg:top-2.5 lg:right-3 lg:text-[10px]">{id}</span>
      {children}
    </div>
  );
}

export function Footer({ links }: { links: Links }) {
  const tg = `https://t.me/${CONTACTS.bot}`;
  const cols: Array<[string, string, Array<[string, string | null]>]> = [
    ['C1', 'MAHSULOT', [['Davomat', '#tekshiruv'], ['Vazifalar', '#imkoniyatlar'], ['Ish haqi', '#imkoniyatlar'], ['Mini App', '#tekshiruv'], ['Tariflar', '#tariflar']]],
    ['D1', 'KOMPANIYA', [['Kirish', links.login], ['Aloqa', CONTACTS.telegram ?? tg]]],
    ['E1', 'HUQUQIY', [['Maxfiylik siyosati', null], ['Foydalanish shartlari', null], ["Biometrik ma'lumotlar", null]]],
  ];
  const social: Array<[string, string]> = [['Telegram', CONTACTS.telegram ?? tg], ...(CONTACTS.instagram ? [['Instagram', CONTACTS.instagram] as [string, string]] : []), ...(CONTACTS.youtube ? [['YouTube', CONTACTS.youtube] as [string, string]] : [])];
  return (
    <footer className="relative px-4 lg:px-8 xl:px-16">
      <div className="grid grid-cols-1 border-t border-l-line lg:grid-cols-5">
        <Cell id="A1" className="flex flex-col gap-3 px-4 py-7 lg:col-span-2 lg:gap-[18px] lg:border-r lg:px-8 lg:pt-8 lg:pb-10 xl:px-[43px]">
          <div className="flex items-center gap-2.5"><LogoMark /><Wordmark /></div>
          <p className="m-0 max-w-[400px] font-l-serif text-xl leading-[26px] font-[360] tracking-[-0.4px] lg:text-[22px] lg:leading-[29px]">Xodimlar davomati va vazifalari — Telegram orqali.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={tg} target="_blank" rel="noreferrer" className="border-b border-l-line-strong pb-0.5 text-[15px] font-medium hover:text-l-accent">Telegram&apos;da yozing ↗</a>
            <span className="l-label text-l-body">@{CONTACTS.bot.toUpperCase()}</span>
          </div>
        </Cell>
        {cols.map(([id, h, items], i) => (
          <Cell key={id} id={id} className={`flex flex-col gap-2 px-4 py-[22px] lg:gap-3 lg:px-6 lg:pt-8 lg:pb-10 ${i < 2 ? 'lg:border-r' : ''}`}>
            <span className="l-label-sm lg:l-label mb-1 text-l-muted lg:mb-1.5">{h}</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-3">
              {items.map(([t, href]) => href
                ? <a key={t} href={href} className="text-[15px] text-l-body hover:text-l-accent">{t}</a>
                : <span key={t} className="text-[15px] text-l-muted" title="Tez orada">{t}</span>)}
            </div>
          </Cell>
        ))}
        <Cell id="C2" className="flex items-center gap-8 px-4 py-5 lg:col-span-4 lg:border-r lg:px-8 lg:py-7 xl:px-[43px]">
          <div className="flex w-full items-center gap-2 lg:hidden"><SystemStatus compact /></div>
          <div className="hidden items-center gap-8 lg:flex"><SystemStatus /></div>
        </Cell>
        <Cell id="E2" className="hidden flex-col gap-2.5 px-6 py-7 lg:flex">
          <span className="l-label text-l-muted">BIZ BILAN</span>
          {social.map(([t, href]) => <a key={t} href={href} target="_blank" rel="noreferrer" className="flex justify-between border-b border-l-line pb-1.5 text-[15px] hover:text-l-accent">{t}<span>↗</span></a>)}
        </Cell>
        <Cell id="" className="flex flex-col gap-5 px-4 pt-7 pb-4 lg:col-span-5 lg:px-8 lg:pt-14 lg:pb-9 xl:px-[43px]">
          <CubeWordmark />
          <div className="l-label-sm hidden justify-between text-l-muted lg:flex"><span>SICHQONCHANI OLIB O&apos;TING</span><span>ISO 30°</span></div>
        </Cell>
        <div className="l-label-sm lg:l-label flex h-12 items-center border-b border-l-line px-4 text-l-body lg:h-[52px] lg:border-r lg:border-b-0 lg:px-6">© 2026 ADONE.UZ</div>
        <div className="l-label-sm lg:l-label flex h-12 items-center border-b border-l-line px-4 text-l-body lg:col-span-2 lg:h-[52px] lg:border-r lg:border-b-0 lg:px-6"><TashkentClock /></div>
        <div className="l-label-sm lg:l-label flex h-12 items-center border-b border-l-line px-4 text-l-body lg:h-[52px] lg:border-r lg:border-b-0 lg:px-6">
          {CONTACTS.phone ? <a href={`tel:${CONTACTS.phone.replace(/\s/g, '')}`} className="hover:text-l-accent">{CONTACTS.phone}</a> : <a href={tg} className="hover:text-l-accent">@{CONTACTS.bot.toUpperCase()}</a>}
        </div>
        <a href="#" className="l-label-sm lg:l-label flex h-12 items-center px-4 text-l-body hover:text-l-accent lg:h-[52px] lg:px-6">YUQORIGA ↑</a>
      </div>
    </footer>
  );
}
