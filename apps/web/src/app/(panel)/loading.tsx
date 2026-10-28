/** Panel sahifalari orasida o'tish: server javobi kelguncha darhol skelet (menyu joyida qoladi). */
export default function PanelLoading() {
  const block = 'card animate-pulse';
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="flex items-center gap-3 pt-1">
        <span className="h-8 w-56 animate-pulse rounded-lg bg-subtle" />
        <span className="ml-auto h-11 w-36 animate-pulse rounded-full bg-subtle" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${block} h-28`} />)}
      </div>
      <div className={`${block} h-96`} />
    </div>
  );
}
