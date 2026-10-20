/** OpenStreetMap ko'rinishi (iframe, kalitsiz). Dizayndagi radius doirasi Leaflet bilan keyin. */
export function BranchMap({ lat, lng, radiusM, height = 160 }: { lat: number; lng: number; radiusM: number; height?: number }) {
  const d = Math.max(radiusM * 3, 300) / 111_000;
  const bbox = [lng - d * 1.6, lat - d, lng + d * 1.6, lat + d].join(',');
  return (
    <iframe
      title="Xarita"
      loading="lazy"
      className="w-full rounded-lg border border-line"
      style={{ height }}
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
    />
  );
}

export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
