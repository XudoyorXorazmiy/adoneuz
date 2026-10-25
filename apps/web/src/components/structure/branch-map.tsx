'use client';
/**
 * Filial xaritasi (Leaflet + OpenStreetMap, kalitsiz): nuqta va radius doirasi (dizayn: ko'k shaffof doira).
 * Tile'lar och kulrang (CSS filtr) — kartochka uslubiga mos. Leaflet faqat brauzerda yuklanadi.
 */
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export function BranchMap({ lat, lng, radiusM, height = 200 }: { lat: number; lng: number; radiusM: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      // Ko'rinish — doiradan oldin (circle.getBounds() xarita ko'rinishisiz ishlamaydi)
      map.fitBounds(L.latLng(lat, lng).toBounds(radiusM * 2), { padding: [28, 28] });
      L.circle([lat, lng], { radius: radiusM, color: '#2443F5', weight: 1.5, fillColor: '#2443F5', fillOpacity: 0.12 }).addTo(map);
      L.circleMarker([lat, lng], { radius: 6, color: '#fff', weight: 2.5, fillColor: '#2443F5', fillOpacity: 1 }).addTo(map);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, radiusM]);
  return <div ref={ref} className="adone-map z-0 w-full overflow-hidden rounded-2xl border border-line bg-page" style={{ height }} />;
}
