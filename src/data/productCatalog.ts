import hydratingJarImg from '../assets/images/hydrating_capsule_cream_1791289060022.jpg';
import txaNiaJarImg from '../assets/images/txa_nia_capsule_cream_1791289075478.jpg';
import sebumJarImg from '../assets/images/sebum_control_capsule_cream_1791289090042.jpg';
import pdrnJarImg from '../assets/images/pdrn_collagen_capsule_cream_1791289104379.jpg';

export interface S19ProductDetails {
  id: string;
  name: string;
  code: string;
  weight: string;
  priceFormatted: string;
  priceNumeric: number;
  tagline: string;
  image: string;
  phaseId: 'DEHYDRATION' | 'UNEVEN_TONE' | 'OIL_IMBALANCE' | 'RECOVERY';
  activesHighlight: string;
}

export const S19_PRODUCTS: Record<string, S19ProductDetails> = {
  HYDRATING: {
    id: 'hydrating',
    name: 'Hydrating Capsule Cream',
    code: 'S19 / 01',
    weight: 'S19 SKINLABS · 65.0 G',
    priceFormatted: '₹1,300',
    priceNumeric: 1300,
    tagline: 'For Extra Hydration Boost.',
    image: hydratingJarImg,
    phaseId: 'DEHYDRATION',
    activesHighlight: '5% 13D Hyaluronic Acid · 2% Hydroviton · 2% Pentavitin',
  },
  TXA_NIA: {
    id: 'txa_nia',
    name: 'TXA + NIA Capsule Cream',
    code: 'S19 / 02',
    weight: 'S19 SKINLABS · 65.0 G',
    priceFormatted: '₹1,300',
    priceNumeric: 1300,
    tagline: 'Your tone. More in tune.',
    image: txaNiaJarImg,
    phaseId: 'UNEVEN_TONE',
    activesHighlight: '4% Tranexamic Acid · 2% Niacinamide · 2% Rose PDRN',
  },
  PDRN_COLLAGEN: {
    id: 'pdrn_collagen',
    name: 'PDRN Collagen Capsule Cream',
    code: 'S19 / 03',
    weight: 'S19 SKINLABS · 65.0 G',
    priceFormatted: '₹1,650',
    priceNumeric: 1650,
    tagline: 'A little care. A new phase.',
    image: pdrnJarImg,
    phaseId: 'RECOVERY',
    activesHighlight: '3% Salmon PDRN · 2% Peptides · Cellular Collagen Matrix',
  },
  SEBUM_CONTROL: {
    id: 'sebum_control',
    name: 'Sebum Control Capsule Cream',
    code: 'S19 / 04',
    weight: 'S19 SKINLABS · 65.0 G',
    priceFormatted: '₹1,250',
    priceNumeric: 1250,
    tagline: 'Find your own balance.',
    image: sebumJarImg,
    phaseId: 'OIL_IMBALANCE',
    activesHighlight: '3% Encapsulated Salicylic Acid · 2% Tranexamic Acid · 0.5% Sebum Control Complex',
  },
};

/**
 * Helper to match product by name or keyword from IXX's speech / recommendation / chat queries
 */
export function matchProductFromText(text: string, currentPhaseId?: string | null): S19ProductDetails | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Exact product specific keywords
  if (
    lower.includes('pdrn') ||
    lower.includes('collagen') ||
    lower.includes('s19 / 03') ||
    lower.includes('s19/03') ||
    lower.includes('1,650') ||
    lower.includes('1650') ||
    lower.includes('recovery phase') ||
    lower.includes('barrier replenishment')
  ) {
    return S19_PRODUCTS.PDRN_COLLAGEN;
  }
  if (
    lower.includes('sebum') ||
    lower.includes('oil imbalance') ||
    lower.includes('salicylic') ||
    lower.includes('s19 / 04') ||
    lower.includes('s19/04') ||
    lower.includes('1,250') ||
    lower.includes('1250') ||
    lower.includes('shine') ||
    lower.includes('clogged pore')
  ) {
    return S19_PRODUCTS.SEBUM_CONTROL;
  }
  if (
    lower.includes('txa') ||
    lower.includes('nia') ||
    lower.includes('s19 / 02') ||
    lower.includes('s19/02') ||
    lower.includes('uneven tone') ||
    lower.includes('dark spot') ||
    lower.includes('marks') ||
    lower.includes('tranexamic') ||
    lower.includes('niacinamide')
  ) {
    return S19_PRODUCTS.TXA_NIA;
  }
  if (
    lower.includes('hydrat') ||
    lower.includes('dehydrat') ||
    lower.includes('s19 / 01') ||
    lower.includes('s19/01') ||
    lower.includes('hyaluronic') ||
    lower.includes('tightness') ||
    lower.includes('dryness')
  ) {
    return S19_PRODUCTS.HYDRATING;
  }

  // 2. Generic cream, photo, popup, routine, or product queries
  if (
    lower.includes('cream') ||
    lower.includes('creame') ||
    lower.includes('photo') ||
    lower.includes('picture') ||
    lower.includes('image') ||
    lower.includes('pop up') ||
    lower.includes('popup') ||
    lower.includes('product') ||
    lower.includes('recommend') ||
    lower.includes('jar') ||
    lower.includes('capsule') ||
    lower.includes('formula') ||
    lower.includes('moisturizer') ||
    lower.includes('ingredient') ||
    lower.includes('actives')
  ) {
    if (currentPhaseId === 'RECOVERY') return S19_PRODUCTS.PDRN_COLLAGEN;
    if (currentPhaseId === 'OIL_IMBALANCE') return S19_PRODUCTS.SEBUM_CONTROL;
    if (currentPhaseId === 'UNEVEN_TONE') return S19_PRODUCTS.TXA_NIA;
    return S19_PRODUCTS.HYDRATING;
  }

  return null;
}
