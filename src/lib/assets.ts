import kigaliPanoramaHero from '@/src/assets/images/kigali_panorama_hero_1794481092206.jpg';
import rwandaEducationBanner from '@/src/assets/images/rwanda_education_banner_1794481091149.jpg';
import rwandaGraduation from '@/src/assets/images/rwanda_graduation_1794481092163.jpg';
import rwandaInfrastructure from '@/src/assets/images/rwanda_infrastructure_1794481092287.jpg';
import rwandaNewsKagame from '@/src/assets/images/rwanda_news_kagame_1794481092514.jpg';
import rwandaLogoGraphic from '@/src/assets/images/rwanda_opportunities_logo_graphic_1794481093301.jpg';

export const STATIC_ASSETS = {
  kigaliPanoramaHero,
  rwandaEducationBanner,
  rwandaGraduation,
  rwandaInfrastructure,
  rwandaNewsKagame,
  rwandaLogoGraphic,
};

const LEGACY_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/kigali_panorama_hero_1794481092206.jpg': kigaliPanoramaHero,
  '/src/assets/images/rwanda_education_banner_1794481091149.jpg': rwandaEducationBanner,
  '/src/assets/images/rwanda_graduation_1794481092163.jpg': rwandaGraduation,
  '/src/assets/images/rwanda_infrastructure_1794481092287.jpg': rwandaInfrastructure,
  '/src/assets/images/rwanda_news_kagame_1794481092514.jpg': rwandaNewsKagame,
  '/src/assets/images/rwanda_opportunities_logo_graphic_1794481093301.jpg': rwandaLogoGraphic,
};

export function resolveAssetUrl(url?: string, fallback: string = kigaliPanoramaHero): string {
  if (!url || !url.trim()) return fallback;
  const trimmed = url.trim();
  if (LEGACY_ASSET_MAP[trimmed]) {
    return LEGACY_ASSET_MAP[trimmed];
  }
  const withoutFridoPrefix = trimmed.replace(/^\/FRIDO/, '');
  if (LEGACY_ASSET_MAP[withoutFridoPrefix]) {
    return LEGACY_ASSET_MAP[withoutFridoPrefix];
  }
  return trimmed;
}
