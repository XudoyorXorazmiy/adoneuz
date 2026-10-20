import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { surfaceFor, type Surface } from './host';

export const currentSurface = cache(async (): Promise<Surface> => {
  const h = await headers();
  return surfaceFor(h.get('x-forwarded-host') ?? h.get('host'));
});
