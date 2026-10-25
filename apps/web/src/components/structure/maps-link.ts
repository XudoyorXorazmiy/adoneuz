/** Filial nuqtasi Google xaritada (server va client'da ishlatiladi). */
export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
