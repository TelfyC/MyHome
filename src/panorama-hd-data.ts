import type { SchemeId } from './design-schemes';
import type { PanoramaId } from './panorama-data';

export type PanoramaTextureAsset = { path: string; width: number; height: number };
type PanoramaDetail = { full: PanoramaTextureAsset; mobile: PanoramaTextureAsset };

// API-generated high-resolution panoramas, exported separately from the originals.
// The original images remain available for progressive loading and comparison.
const detail = (style: SchemeId, room: PanoramaId): PanoramaDetail => ({
  full: { path: `panoramas-native/${style}/${room}.jpg`, width: 3840, height: 1920 },
  mobile: { path: `panoramas-native/${style}/${room}-mobile.jpg`, width: 2560, height: 1280 },
});

export const panoramaHighResolution: Record<SchemeId, Record<PanoramaId, PanoramaDetail>> = {
  forest: {
    living: detail('forest', 'living'), dining: detail('forest', 'dining'),
    master: detail('forest', 'master'), study: detail('forest', 'study'),
    guest: detail('forest', 'guest'), kitchen: detail('forest', 'kitchen'),
    bathroom: detail('forest', 'bathroom'),
  },
  japanese: {
    living: detail('japanese', 'living'), dining: detail('japanese', 'dining'),
    master: detail('japanese', 'master'), study: detail('japanese', 'study'),
    guest: detail('japanese', 'guest'), kitchen: detail('japanese', 'kitchen'),
    bathroom: detail('japanese', 'bathroom'),
  },
  french: {
    living: detail('french', 'living'), dining: detail('french', 'dining'),
    master: detail('french', 'master'), study: detail('french', 'study'),
    guest: detail('french', 'guest'), kitchen: detail('french', 'kitchen'),
    bathroom: detail('french', 'bathroom'),
  },
  sunlit: {
    living: detail('sunlit', 'living'), dining: detail('sunlit', 'dining'),
    master: detail('sunlit', 'master'), study: detail('sunlit', 'study'),
    guest: detail('sunlit', 'guest'), kitchen: detail('sunlit', 'kitchen'),
    bathroom: detail('sunlit', 'bathroom'),
  },
};
