/* ============ SVG GENERATORS ============ */
export function svgRudraksha(glyph = 'रु') {
  return `<svg viewBox="0 0 200 200"><defs><radialGradient id="auraGold" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#e0b04a" stop-opacity=".35"/><stop offset="1" stop-color="#e0b04a" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="80" fill="url(#auraGold)" opacity=".5"/>
    <circle cx="100" cy="100" r="58" fill="none" stroke="#e0b04a" stroke-width="1.6" opacity=".55"/>
    <g fill="#8a5410" stroke="#e0b04a" stroke-width="1.2">
      <circle cx="100" cy="42" r="11"/><circle cx="130" cy="52" r="11"/><circle cx="152" cy="76" r="11"/>
      <circle cx="158" cy="106" r="11"/><circle cx="148" cy="134" r="11"/><circle cx="126" cy="152" r="11"/>
      <circle cx="100" cy="158" r="11"/><circle cx="74" cy="152" r="11"/><circle cx="52" cy="134" r="11"/>
      <circle cx="42" cy="106" r="11"/><circle cx="48" cy="76" r="11"/><circle cx="70" cy="52" r="11"/>
    </g>
    <text x="100" y="112" text-anchor="middle" font-family="'Tiro Devanagari Sanskrit',serif" font-size="34" fill="#f7dc9a">${glyph}</text></svg>`;
}

export function svgGem(color, glyph) {
  return `<svg viewBox="0 0 200 200"><defs><radialGradient id="auraGold" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#e0b04a" stop-opacity=".35"/><stop offset="1" stop-color="#e0b04a" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="80" fill="url(#auraGold)" opacity=".5"/>
    <polygon points="100,30 160,75 140,150 60,150 40,75" fill="none" stroke="${color}" stroke-width="2.5" opacity=".9"/>
    <polygon points="100,50 140,82 125,135 75,135 60,82" fill="none" stroke="${color}" stroke-width="1.4" opacity=".55"/>
    <polygon points="100,70 122,88 114,120 86,120 78,88" fill="none" stroke="${color}" stroke-width="1" opacity=".4"/>
    <text x="100" y="112" text-anchor="middle" font-family="'Tiro Devanagari Sanskrit',serif" font-size="30" fill="${color}">${glyph}</text></svg>`;
}

export function svgYantra(glyph = 'य') {
  return `<svg viewBox="0 0 200 200"><defs><radialGradient id="auraGold" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#e0b04a" stop-opacity=".35"/><stop offset="1" stop-color="#e0b04a" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="80" fill="url(#auraGold)" opacity=".5"/>
    <rect x="42" y="42" width="116" height="116" rx="6" fill="none" stroke="#e0b04a" stroke-width="2.4"/>
    <line x1="42" y1="42" x2="158" y2="158" stroke="#e0b04a" stroke-width="1.2" opacity=".65"/>
    <line x1="158" y1="42" x2="42" y2="158" stroke="#e0b04a" stroke-width="1.2" opacity=".65"/>
    <line x1="100" y1="42" x2="100" y2="158" stroke="#e0b04a" stroke-width="1.2" opacity=".65"/>
    <line x1="42" y1="100" x2="158" y2="100" stroke="#e0b04a" stroke-width="1.2" opacity=".65"/>
    <circle cx="100" cy="100" r="24" fill="none" stroke="#f7dc9a" stroke-width="1.4"/>
    <text x="100" y="110" text-anchor="middle" font-family="'Tiro Devanagari Sanskrit',serif" font-size="26" fill="#f7dc9a">${glyph}</text></svg>`;
}

export function svgBracelet(beads) {
  const cols = beads || ['#C8963E', '#3A3A3A', '#E8E0C8', '#A8C89E', '#E89878'];
  const N = 12, R = 58, cx = 100, cy = 100;
  let c = '';
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    c += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="${cols[i % cols.length]}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>`;
  }
  return `<svg viewBox="0 0 200 200"><defs><radialGradient id="auraGold" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#e0b04a" stop-opacity=".35"/><stop offset="1" stop-color="#e0b04a" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="80" fill="url(#auraGold)" opacity=".5"/>
    <circle cx="100" cy="100" r="58" fill="none" stroke="#e0b04a" stroke-width="1" opacity=".4"/>${c}</svg>`;
}

/* ============ PRODUCT DATA (Backed by Canonical JAPAM Database IDs) ============ */
export const FEATURED = [
  { id: 3, sku: 'RM-005', slug: 'rudraksha-mala-5-mukhi-rm-005', cat: 'rudraksha', catLabel: 'Rudraksha · Nepal', title: '5 Mukhi Rudraksha Mala', desc: '108 hand-strung beads, lab-verified Elaeocarpus ganitrus. Energised in Kashi.', price: '₹2,499', priceOld: '₹2,999', priceNum: 2499, save: '17% off', rating: '4.9', reviews: '247', badge: 'hot', stock_quantity: 24, is_in_stock: true, img: svgRudraksha('रु') },
  { id: 20, sku: 'RAT-EME', slug: 'panna-·-emerald-4.2ct-rat-eme', cat: 'ratna', catLabel: 'Ratna · Mercury', title: 'Panna · Emerald 4.2ct', desc: 'Natural, untreated, IGI-certified. Set in Panchdhatu. For focus & communication.', price: '₹8,999', priceOld: '₹12,500', priceNum: 8999, save: '28% off', rating: '4.8', reviews: '186', badge: 'lab', stock_quantity: 15, is_in_stock: true, img: svgGem('#7ee2b8', 'प') },
  { id: 30, sku: 'RM-OO4', slug: 'sri-yantra-in-pure-copper-rm-oo4', cat: 'yantra', catLabel: 'Yantra · Lakshmi', title: 'Sri Yantra in Pure Copper', desc: 'Hand-etched 99.4% pure copper. Pran-pratishtha & installation guidance included.', price: '₹ 3,500', priceOld: '₹ 4,200', priceNum: 3500, save: '17% off', rating: '4.9', reviews: '124', badge: 'new', stock_quantity: 20, is_in_stock: true, img: svgYantra('श्रीं ह्रीं') },
  { id: 26, sku: 'BRC-NAV', slug: 'navagraha-mixed-stone-bracelet-brc-nav', cat: 'bracelets', catLabel: 'Bracelet · Mixed', title: 'Navagraha Mixed-Stone Bracelet', desc: 'Tiger eye, obsidian, moonstone, jade & sunstone. 8mm beads, elastic fit.', price: '₹1,899', priceOld: '₹2,999', priceNum: 1899, save: '37% off', rating: '4.9', reviews: '312', badge: 'hot', stock_quantity: 25, is_in_stock: true, img: svgBracelet() },
];

export const RUDRAKSHA = [
  { id: 10, sku: 'RUD-001', slug: '1-mukhi-rudraksha-rud-001', cat: 'm1', catLabel: '1 Mukhi · Nepal', title: '1 Mukhi Rudraksha', desc: 'Rarest form. Signifies Shiva himself. Sun-energy, leadership & clarity.', price: '₹15,999', priceOld: '₹21,000', priceNum: 15999, save: '24% off', rating: '5.0', reviews: '42', badge: 'lab', stock_quantity: 5, is_in_stock: true, img: svgRudraksha('१') },
  { id: 11, sku: 'RUD-002', slug: '2-mukhi-rudraksha-rud-002', cat: 'm2', catLabel: '2 Mukhi · Nepal', title: '2 Mukhi Rudraksha', desc: 'Ardhanarishwar form. Harmony in relationships & balance of energies.', price: '₹3,999', priceOld: '₹5,500', priceNum: 3999, save: '27% off', rating: '4.8', reviews: '89', badge: 'lab', stock_quantity: 12, is_in_stock: true, img: svgRudraksha('२') },
  { id: 12, sku: 'RUD-003', slug: '3-mukhi-rudraksha-rud-003', cat: 'm3', catLabel: '3 Mukhi · Nepal', title: '3 Mukhi Rudraksha', desc: 'Agni Swaroop. Removes sins & past karma. Boosts confidence.', price: '₹1,299', priceOld: '₹1,800', priceNum: 1299, save: '28% off', rating: '4.7', reviews: '134', badge: null, stock_quantity: 20, is_in_stock: true, img: svgRudraksha('३') },
  { id: 13, sku: 'RUD-004', slug: '4-mukhi-rudraksha-rud-004', cat: 'm4', catLabel: '4 Mukhi · Nepal', title: '4 Mukhi Rudraksha', desc: 'Brahma Swaroop. Enhances intelligence, creativity & knowledge.', price: '₹1,499', priceOld: '₹2,000', priceNum: 1499, save: '25% off', rating: '4.8', reviews: '76', badge: null, stock_quantity: 18, is_in_stock: true, img: svgRudraksha('४') },
  { id: 14, sku: 'RUD-005', slug: '5-mukhi-rudraksha-rud-005', cat: 'm5', catLabel: '5 Mukhi · Nepal', title: '5 Mukhi Rudraksha', desc: 'Panchamukhi. Most common, highly beneficial. Kalagni Rudra form.', price: '₹799', priceOld: '₹1,200', priceNum: 799, save: '33% off', rating: '4.9', reviews: '456', badge: 'hot', stock_quantity: 40, is_in_stock: true, img: svgRudraksha('५') },
  { id: 15, sku: 'RUD-006', slug: '6-mukhi-rudraksha-rud-006', cat: 'm6', catLabel: '6 Mukhi · Nepal', title: '6 Mukhi Rudraksha', desc: 'Kartikeya Swaroop. Bestows knowledge, wisdom & physical strength.', price: '₹1,999', priceOld: '₹2,800', priceNum: 1999, save: '29% off', rating: '4.7', reviews: '98', badge: null, stock_quantity: 15, is_in_stock: true, img: svgRudraksha('६') },
  { id: 16, sku: 'RUD-007', slug: '7-mukhi-rudraksha-rud-007', cat: 'm7', catLabel: '7 Mukhi · Nepal', title: '7 Mukhi Rudraksha', desc: 'Mahalaxmi Swaroop. Brings wealth, prosperity & good fortune.', price: '₹2,499', priceOld: '₹3,500', priceNum: 2499, save: '29% off', rating: '4.8', reviews: '112', badge: null, stock_quantity: 14, is_in_stock: true, img: svgRudraksha('७') },
  { id: 17, sku: 'RM-006', slug: 'panchamukhi-rudraksha-mala-rm-006', cat: 'mala', catLabel: 'Rudraksha · Mala', title: 'Panchamukhi Rudraksha Mala', desc: '108 + 1 beads 5 Mukhi. Traditional knotted mala for japa & meditation.', price: '₹2,499', priceOld: '₹3,999', priceNum: 2499, save: '38% off', rating: '4.9', reviews: '247', badge: 'hot', stock_quantity: 20, is_in_stock: true, img: svgRudraksha('रु') },
  { id: 18, sku: 'BRC-RUD', slug: 'rudraksha-bracelet-5-mukhi-brc-rud', cat: 'bracelet', catLabel: 'Rudraksha · Bracelet', title: 'Rudraksha Bracelet 5 Mukhi', desc: 'Stretchable elastic bracelet with 5 Mukhi beads. Energised & certified.', price: '₹899', priceOld: '₹1,499', priceNum: 899, save: '40% off', rating: '4.8', reviews: '178', badge: 'hot', stock_quantity: 30, is_in_stock: true, img: svgBracelet(['#8a5410', '#6d3e08', '#8a5410']) },
];

export const RATNA = [
  { id: 19, sku: 'RAT-RUB', slug: 'manik-·-ruby-3.5ct-rat-rub', cat: 'ratna', catLabel: 'Ratna · Sun', title: 'Manik · Ruby 3.5ct', desc: 'Burmese Ruby, heat-treated, GIA certified. For Sun energy, confidence & leadership.', price: '₹12,999', priceOld: '₹18,000', priceNum: 12999, save: '28% off', rating: '4.9', reviews: '67', badge: 'lab', stock_quantity: 8, is_in_stock: true, img: svgGem('#ff4444', 'मा') },
  { id: 20, sku: 'RAT-EME', slug: 'panna-·-emerald-4.2ct-rat-eme', cat: 'ratna', catLabel: 'Ratna · Mercury', title: 'Panna · Emerald 4.2ct', desc: 'Colombian Emerald, natural untreated, IGI certified. For Mercury, intellect & communication.', price: '₹8,999', priceOld: '₹12,500', priceNum: 8999, save: '28% off', rating: '4.8', reviews: '186', badge: 'lab', stock_quantity: 15, is_in_stock: true, img: svgGem('#7ee2b8', 'प') },
  { id: 7, sku: 'RAT-002', slug: 'natural-blue-sapphire-neelam-rat-002', cat: 'ratna', catLabel: 'Ratna · Saturn', title: 'Neelam · Blue Sapphire 3ct', desc: 'Ceylon Blue Sapphire, GIA certified. Must be tested first. For Saturn blessings.', price: '₹19,999', priceOld: '₹28,000', priceNum: 19999, save: '29% off', rating: '4.9', reviews: '54', badge: 'lab', stock_quantity: 7, is_in_stock: true, img: svgGem('#6fa8dc', 'नी') },
  { id: 21, sku: 'RAT-PRL', slug: 'moti-·-south-sea-pearl-5ct-rat-prl', cat: 'ratna', catLabel: 'Ratna · Moon', title: 'Moti · South Sea Pearl 5ct', desc: 'Natural South Sea Pearl, certified. For Moon energy, emotional balance & peace.', price: '₹4,999', priceOld: '₹7,000', priceNum: 4999, save: '29% off', rating: '4.7', reviews: '143', badge: null, stock_quantity: 12, is_in_stock: true, img: svgGem('#f0f0f0', 'मो') },
  { id: 6, sku: 'RAT-001', slug: 'yellow-sapphire-pukhraj-rat-001', cat: 'ratna', catLabel: 'Ratna · Jupiter', title: 'Pukhraj · Yellow Sapphire 4ct', desc: 'Ceylon Yellow Sapphire, GIA certified. For Jupiter, wisdom, marriage & prosperity.', price: '₹18,500', priceOld: '₹22,000', priceNum: 18500, save: '16% off', rating: '4.9', reviews: '89', badge: 'lab', stock_quantity: 12, is_in_stock: true, img: svgGem('#f7dc9a', 'पु') },
  { id: 22, sku: 'RAT-COR', slug: 'moonga-·-red-coral-7ct-rat-cor', cat: 'ratna', catLabel: 'Ratna · Mars', title: 'Moonga · Red Coral 7ct', desc: 'Italian Red Coral, certified. For Mars, courage, health & removal of obstacles.', price: '₹5,499', priceOld: '₹7,500', priceNum: 5499, save: '27% off', rating: '4.8', reviews: '98', badge: null, stock_quantity: 10, is_in_stock: true, img: svgGem('#ff8c2b', 'मू') },
];

export const YANTRA = [
  { id: 30, sku: 'RM-OO4', slug: 'sri-yantra-in-pure-copper-rm-oo4', cat: 'yantra', catLabel: 'Yantra · Lakshmi', title: 'Sri Yantra in Pure Copper', desc: 'Hand-etched 99.4% pure copper. Pran-pratishtha & installation guidance included.', price: '₹ 3,500', priceOld: '₹ 4,200', priceNum: 3500, save: '17% off', rating: '4.9', reviews: '124', badge: 'new', stock_quantity: 20, is_in_stock: true, img: svgYantra('श्रीं ह्रीं') },
  { id: 23, sku: 'YAN-KUB', slug: 'kuber-yantra-·-copper-yan-kub', cat: 'yantra', catLabel: 'Yantra · Wealth', title: 'Kuber Yantra · Copper', desc: 'For financial prosperity, wealth attraction & business growth. Hand-etched copper.', price: '₹2,499', priceOld: '₹3,500', priceNum: 2499, save: '29% off', rating: '4.8', reviews: '89', badge: null, stock_quantity: 18, is_in_stock: true, img: svgYantra('कु') },
  { id: 24, sku: 'YAN-NAV', slug: 'navgraha-yantra-·-copper-yan-nav', cat: 'yantra', catLabel: 'Yantra · Nine Planets', title: 'Navgraha Yantra · Copper', desc: 'Nine planetary yantras in one. Complete cosmic balance. Pran-pratishtha done.', price: '₹4,999', priceOld: '₹6,500', priceNum: 4999, save: '23% off', rating: '4.9', reviews: '67', badge: 'hot', stock_quantity: 10, is_in_stock: true, img: svgYantra('न') },
  { id: 25, sku: 'YAN-GAN', slug: 'ganesh-yantra-·-copper-yan-gan', cat: 'yantra', catLabel: 'Yantra · Ganesh', title: 'Ganesh Yantra · Copper', desc: 'For removal of obstacles, new beginnings & success in endeavours.', price: '₹1,999', priceOld: '₹2,800', priceNum: 1999, save: '29% off', rating: '4.8', reviews: '156', badge: null, stock_quantity: 15, is_in_stock: true, img: svgYantra('ग') },
];

export const BRACELETS = [
  { id: 26, sku: 'BRC-NAV', slug: 'navagraha-mixed-stone-bracelet-brc-nav', cat: 'combo', catLabel: 'Bracelet · Mixed', title: 'Navagraha Mixed-Stone Bracelet', desc: 'Tiger eye, obsidian, moonstone, jade & sunstone. 8mm beads, elastic fit.', price: '₹1,899', priceOld: '₹2,999', priceNum: 1899, save: '37% off', rating: '4.9', reviews: '312', badge: 'hot', stock_quantity: 25, is_in_stock: true, display_rank: 1, img: svgBracelet() },
  { id: 28, sku: 'BRC-TOU', slug: 'black-tourmaline-protection-bracelet-brc-tou', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Black Tourmaline Protection Bracelet', desc: 'Powerful protection stone. Shields from negative energy. 8mm beads.', price: '₹1,499', priceOld: '₹2,200', priceNum: 1499, save: '32% off', rating: '4.8', reviews: '89', badge: null, stock_quantity: 18, is_in_stock: true, display_rank: 2, img: svgBracelet(['#2c3e50', '#1a252f', '#2c3e50']) },
  { id: 29, sku: 'BRC-COM', slug: 'wealth-&-prosperity-combo-bracelet-brc-com', cat: 'combo', catLabel: 'Bracelet · Combination', title: 'Wealth & Prosperity Combo Bracelet', desc: 'Citrine, green jade & pyrite combo. For wealth attraction & abundance.', price: '₹2,199', priceOld: '₹3,200', priceNum: 2199, save: '31% off', rating: '4.9', reviews: '67', badge: 'new', stock_quantity: 15, is_in_stock: true, display_rank: 3, img: svgBracelet(['#f7dc9a', '#7ee2b8', '#c8a84b']) },
];

/**
 * Adapter that seamlessly maps any backend JAPAM API product into the Astroveda UI component schema.
 */
export function adaptApiProduct(p) {
  if (!p) return null;
  const numPrice = typeof p.price === 'number' ? p.price : (parseFloat(p.price) || 0);
  const numCompare = p.compare_price ? (typeof p.compare_price === 'number' ? p.compare_price : parseFloat(p.compare_price)) : null;

  const savePct = numCompare && numCompare > numPrice
    ? `${Math.round(((numCompare - numPrice) / numCompare) * 100)}% off`
    : null;

  // Derive SVG or thumbnail visual
  let visual = '';
  const lowerName = (p.name || '').toLowerCase();
  const catSlug = (typeof p.category === 'object' && p.category?.slug) ? p.category.slug : (p.category || '').toLowerCase();

  const backendBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
  const resolveImg = (url) => {
    if (!url) return '';
    let clean = String(url).trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.includes('\\') || clean.match(/^[A-Za-z]:/)) {
      const filename = clean.split(/[/\\]/).pop();
      clean = `/static/uploads/products/${filename}`;
    }
    if (clean.startsWith('/static/')) return `${backendBase}${clean}`;
    return clean;
  };

  if (p.thumbnail && p.thumbnail !== '/static/img/product-default.png' && !p.thumbnail.includes('default')) {
    const src = resolveImg(p.thumbnail);
    visual = `<img src="${src}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"/>`;
  } else if (lowerName.includes('rudraksha') || catSlug.includes('rudraksha')) {
    const m = lowerName.match(/(\d+)\s*mukhi/);
    visual = svgRudraksha(m ? m[1] : 'रु');
  } else if (lowerName.includes('yantra') || catSlug.includes('yantra')) {
    visual = svgYantra(lowerName.includes('shri') ? 'श्री' : (lowerName.includes('kuber') ? 'कु' : 'य'));
  } else if (lowerName.includes('bracelet') || catSlug.includes('bracelet')) {
    visual = svgBracelet();
  } else if (lowerName.includes('ruby') || lowerName.includes('manik')) {
    visual = svgGem('#ff4444', 'मा');
  } else if (lowerName.includes('emerald') || lowerName.includes('panna')) {
    visual = svgGem('#7ee2b8', 'प');
  } else if (lowerName.includes('blue sapphire') || lowerName.includes('neelam')) {
    visual = svgGem('#6fa8dc', 'नी');
  } else if (lowerName.includes('yellow sapphire') || lowerName.includes('pukhraj')) {
    visual = svgGem('#f7dc9a', 'पु');
  } else if (lowerName.includes('pearl') || lowerName.includes('moti')) {
    visual = svgGem('#f0f0f0', 'मो');
  } else if (lowerName.includes('coral') || lowerName.includes('moonga')) {
    visual = svgGem('#ff8c2b', 'मू');
  } else {
    visual = svgRudraksha('ॐ');
  }

  const attrs = p.attributes || {};

  let filterCategory = catSlug;
  if (catSlug.includes('rudraksha') || lowerName.includes('rudraksha')) {
    const mukhiMatch = lowerName.match(/(\d+)\s*mukhi/);
    if (mukhiMatch) {
      filterCategory = `m${mukhiMatch[1]}`;
    } else if (lowerName.includes('mala')) {
      filterCategory = 'mala';
    } else if (lowerName.includes('bracelet')) {
      filterCategory = 'bracelet';
    }
  } else if (catSlug.includes('bracelet') || lowerName.includes('bracelet')) {
    if (lowerName.includes('rudraksha')) filterCategory = 'rud';
    else if (lowerName.includes('amethyst') || lowerName.includes('gem')) filterCategory = 'gem';
    else if (lowerName.includes('combo') || lowerName.includes('navagraha') || lowerName.includes('wealth')) filterCategory = 'combo';
    else filterCategory = 'spi';
  }

  let categoryLabel = (typeof p.category === 'object' ? p.category?.name : p.category) || 'Spiritual';
  if (lowerName.includes('yantra') && categoryLabel.toLowerCase().includes('puja')) {
    categoryLabel = 'Yantra';
  }

  const resolvedRank = p.display_rank !== undefined && p.display_rank !== null
    ? Number(p.display_rank)
    : (p.rank !== undefined && p.rank !== null ? Number(p.rank) : 999);

  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    title: p.name,
    cat: filterCategory,
    catLabel: categoryLabel,
    desc: p.description || attrs.description || `${p.name} — authentic, certified, and energized for spiritual elevation.`,
    price: `₹${numPrice.toLocaleString('en-IN')}`,
    priceOld: numCompare ? `₹${numCompare.toLocaleString('en-IN')}` : null,
    priceNum: numPrice,
    save: savePct,
    rating: attrs.rating || '4.9',
    reviews: String(attrs.reviews || p.review_count || 120),
    badge: p.certification_status === 'certified' ? 'lab' : (numPrice > 2000 ? 'hot' : null),
    display_rank: resolvedRank,
    rank: resolvedRank,
    stock_quantity: p.stock_quantity ?? 10,
    is_in_stock: p.stock_quantity !== undefined ? p.stock_quantity > 0 : true,
    img: visual,
    attributes: attrs,
  };
}

export function getAllProducts() {
  return [...FEATURED, ...RUDRAKSHA, ...RATNA, ...YANTRA, ...BRACELETS];
}

export function findProduct(identifier) {
  if (!identifier) return null;
  const all = getAllProducts();
  if (typeof identifier === 'number') {
    return all.find(p => p.id === identifier);
  }
  return all.find(p => p.title === identifier || p.slug === identifier || String(p.id) === String(identifier));
}
