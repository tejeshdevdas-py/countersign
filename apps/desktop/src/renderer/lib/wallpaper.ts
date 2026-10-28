import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import type { WallpaperId } from '@/../shared/appearanceSettings';
import wallpaperManifest from '@/../shared/wallpaper-video-manifest.json';
import nightLaunch from '@/assets/wallpapers/thumbnails/night-launch.webp';
import silentOrbits from '@/assets/wallpapers/thumbnails/silent-orbits.webp';
import duneDawn from '@/assets/wallpapers/thumbnails/dune-dawn.webp';
import planetDawn from '@/assets/wallpapers/thumbnails/planet-dawn.webp';
import indigoFolds from '@/assets/wallpapers/thumbnails/indigo-folds.webp';
import duneSphere from '@/assets/wallpapers/thumbnails/dune-sphere.webp';
import oceanClouds from '@/assets/wallpapers/thumbnails/ocean-clouds.webp';
import roseQuartz from '@/assets/wallpapers/thumbnails/rose-quartz.webp';
import nightLaunchOriginal from '@/assets/wallpapers/night-launch.webp';
import silentOrbitsOriginal from '@/assets/wallpapers/silent-orbits.webp';
import duneDawnOriginal from '@/assets/wallpapers/dune-dawn.webp';
import planetDawnOriginal from '@/assets/wallpapers/planet-dawn.webp';
import indigoFoldsOriginal from '@/assets/wallpapers/indigo-folds.webp';
import duneSphereOriginal from '@/assets/wallpapers/dune-sphere.webp';
import oceanCloudsOriginal from '@/assets/wallpapers/ocean-clouds.webp';
import roseQuartzOriginal from '@/assets/wallpapers/rose-quartz.webp';

/** All official originals use the main-process downloader; only previews are bundled.
 * Countersign: under LOCAL_ONLY the originals are bundled too, so nothing is downloaded. */
export function isCdnWallpaper(id: WallpaperId): id is keyof typeof wallpaperManifest {
  return (
    !LOCAL_ONLY &&
    Object.hasOwn(wallpaperManifest, id) &&
    wallpaperManifest[id as keyof typeof wallpaperManifest].delivery === 'cdn'
  );
}

export function isSceneWallpaper(id: WallpaperId): boolean {
  return (
    Object.hasOwn(wallpaperManifest, id) &&
    'sha256' in wallpaperManifest[id as keyof typeof wallpaperManifest]
  );
}

/** Decorative artwork; the application applies a theme-derived readability veil.
 * Countersign: the Cindy-character previews are not shipped (see CINDY_CHARACTER_WALLPAPER_IDS). */
const BUILTIN_WALLPAPER_BACKGROUNDS: Partial<Record<WallpaperId, string>> = {
  'night-launch': `url("${nightLaunch}")`,
  'silent-orbits': `url("${silentOrbits}")`,
  'dune-dawn': `url("${duneDawn}")`,
  'planet-dawn': `url("${planetDawn}")`,
  'indigo-folds': `url("${indigoFolds}")`,
  'dune-sphere': `url("${duneSphere}")`,
  'ocean-clouds': `url("${oceanClouds}")`,
  'rose-quartz': `url("${roseQuartz}")`,
};

/** Countersign: the full originals, which match the manifest's CDN files byte for byte.
 * Under LOCAL_ONLY they replace the CDN download, so the CDN is never asked. */
const BUNDLED_WALLPAPER_ORIGINALS: Partial<Record<WallpaperId, string>> = {
  'night-launch': `url("${nightLaunchOriginal}")`,
  'silent-orbits': `url("${silentOrbitsOriginal}")`,
  'dune-dawn': `url("${duneDawnOriginal}")`,
  'planet-dawn': `url("${planetDawnOriginal}")`,
  'indigo-folds': `url("${indigoFoldsOriginal}")`,
  'dune-sphere': `url("${duneSphereOriginal}")`,
  'ocean-clouds': `url("${oceanCloudsOriginal}")`,
  'rose-quartz': `url("${roseQuartzOriginal}")`,
};

export function getBuiltinWallpaperBackground(id: WallpaperId): string | undefined {
  if (LOCAL_ONLY) return BUNDLED_WALLPAPER_ORIGINALS[id];
  return BUILTIN_WALLPAPER_BACKGROUNDS[id];
}

export function getBuiltinWallpaperPreview(id: WallpaperId): string | undefined {
  return BUILTIN_WALLPAPER_BACKGROUNDS[id];
}
