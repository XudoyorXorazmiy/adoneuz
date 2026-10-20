import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="text-5xl font-semibold text-slate-300">404</span>
      <p className="text-slate-500">Bunday sahifa yo&apos;q.</p>
      <Link href="/" className="btn btn-secondary">Bosh sahifaga</Link>
    </main>
  );
}
