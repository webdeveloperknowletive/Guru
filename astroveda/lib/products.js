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
  { id: 31, sku: 'RU-101', slug: '8-mukhi-ru-101', cat: 'm8', catLabel: '8 Mukhi · Nepal', title: '8 Mukhi Rudraksha', desc: 'An 8 Mukhi Rudraksha is associated with Lord Ganesha. Removes obstacles, brings success & enhances wisdom.', price: '₹2,499', priceOld: '₹5,000', priceNum: 2499, save: '50% off', rating: '4.9', reviews: '94', badge: 'lab', stock_quantity: 20, is_in_stock: true, img: svgRudraksha('८') },
  { id: 32, sku: 'RUD-009', slug: '9-mukhi-rudraksha-rud-009', cat: 'm9', catLabel: '9 Mukhi · Nepal', title: '9 Mukhi Rudraksha', desc: 'Blessed by Goddess Durga. Protects against negative energies, grants courage & dissolves Rahu-Ketu dosha.', price: '₹3,499', priceOld: '₹6,500', priceNum: 3499, save: '46% off', rating: '4.9', reviews: '118', badge: 'lab', stock_quantity: 15, is_in_stock: true, img: svgRudraksha('९') },
  { id: 33, sku: 'RUD-010', slug: '10-mukhi-rudraksha-rud-010', cat: 'm10', catLabel: '10 Mukhi · Nepal', title: '10 Mukhi Rudraksha', desc: 'Lord Vishnu Dasha Avatar form. Ultimate protective shield against evil eyes, pacifies all 9 planets & clears legal hurdles.', price: '₹4,999', priceOld: '₹8,500', priceNum: 4999, save: '41% off', rating: '4.9', reviews: '86', badge: 'lab', stock_quantity: 12, is_in_stock: true, img: svgRudraksha('१०') },
  { id: 34, sku: 'RUD-011', slug: '11-mukhi-rudraksha-rud-011', cat: 'm11', catLabel: '11 Mukhi · Nepal', title: '11 Mukhi Rudraksha', desc: 'Lord Hanuman & 11 Rudras form. Grants physical stamina, mental clarity, fearlessness & victory in challenges.', price: '₹5,499', priceOld: '₹9,500', priceNum: 5499, save: '42% off', rating: '4.9', reviews: '72', badge: 'lab', stock_quantity: 10, is_in_stock: true, img: svgRudraksha('११') },
  { id: 35, sku: 'RUD-012', slug: '12-mukhi-rudraksha-rud-012', cat: 'm12', catLabel: '12 Mukhi · Nepal', title: '12 Mukhi Rudraksha', desc: 'Lord Surya & 12 Adityas form. Bestows administrative authority, magnetic radiance, high energy & removes doubts.', price: '₹6,999', priceOld: '₹12,000', priceNum: 6999, save: '42% off', rating: '5.0', reviews: '64', badge: 'lab', stock_quantity: 8, is_in_stock: true, img: svgRudraksha('१२') },
  { id: 36, sku: 'RUD-013', slug: '13-mukhi-rudraksha-rud-013', cat: 'm13', catLabel: '13 Mukhi · Nepal', title: '13 Mukhi Rudraksha', desc: 'Kamadeva & Indra form. Bestows hypnotic charisma, persuasive speech, artistic mastery & prosperity.', price: '₹8,499', priceOld: '₹14,500', priceNum: 8499, save: '41% off', rating: '4.9', reviews: '53', badge: 'lab', stock_quantity: 6, is_in_stock: true, img: svgRudraksha('१३') },
  { id: 37, sku: 'RUD-014', slug: '14-mukhi-rudraksha-rud-014', cat: 'm14', catLabel: '14 Mukhi · Nepal', title: '14 Mukhi Rudraksha', desc: 'Devamani from Shiva third eye. Awakens Ajna intuition chakra, mitigates Sade Sati & Manglik doshas.', price: '₹12,999', priceOld: '₹22,000', priceNum: 12999, save: '41% off', rating: '5.0', reviews: '39', badge: 'lab', stock_quantity: 5, is_in_stock: true, img: svgRudraksha('१४') },
  { id: 17, sku: 'RM-006', slug: 'panchamukhi-rudraksha-mala-rm-006', cat: 'mala', catLabel: 'Rudraksha · Mala', title: 'Panchamukhi Rudraksha Mala', desc: '108 + 1 beads 5 Mukhi. Traditional knotted mala for japa & meditation.', price: '₹2,499', priceOld: '₹3,999', priceNum: 2499, save: '38% off', rating: '4.9', reviews: '247', badge: 'hot', stock_quantity: 20, is_in_stock: true, img: svgRudraksha('रु') },
  { id: 18, sku: 'BRC-RUD', slug: 'rudraksha-bracelet-5-mukhi-brc-rud', cat: 'bracelet', catLabel: 'Rudraksha · Bracelet', title: 'Rudraksha Bracelet 5 Mukhi', desc: 'Stretchable elastic bracelet with 5 Mukhi beads. Energised & certified.', price: '₹899', priceOld: '₹1,499', priceNum: 899, save: '40% off', rating: '4.8', reviews: '178', badge: 'hot', stock_quantity: 30, is_in_stock: true, img: svgBracelet(['#8a5410', '#6d3e08', '#8a5410']) },
];

export const RATNA = [
  { id: 19, sku: 'RAT-RUB', slug: 'manik-·-ruby-3.5ct-rat-rub', cat: 'ratna', catLabel: 'Ratna · Sun', title: 'Manik · Ruby 3.5ct', desc: 'Burmese Ruby, heat-treated, GIA certified. For Sun energy, confidence & leadership.', price: '₹12,999', priceOld: '₹18,000', priceNum: 12999, save: '28% off', rating: '4.9', reviews: '67', badge: 'lab', stock_quantity: 8, is_in_stock: true, display_rank: 1, img: '/products/manik.jpeg', images: ['/products/manik.jpeg'] },
  { id: 21, sku: 'RAT-PRL', slug: 'moti-·-south-sea-pearl-5ct-rat-prl', cat: 'ratna', catLabel: 'Ratna · Moon', title: 'Moti · South Sea Pearl 5ct', desc: 'Natural South Sea Pearl, certified. For Moon energy, emotional balance & peace.', price: '₹4,999', priceOld: '₹7,000', priceNum: 4999, save: '29% off', rating: '4.7', reviews: '143', badge: null, stock_quantity: 12, is_in_stock: true, display_rank: 2, img: '/static/uploads/products/864065f964_Moti_South_Sea_Pearl_5ct.webp', images: ['/static/uploads/products/864065f964_Moti_South_Sea_Pearl_5ct.webp'] },
  { id: 22, sku: 'RAT-COR', slug: 'moonga-·-red-coral-7ct-rat-cor', cat: 'ratna', catLabel: 'Ratna · Mars', title: 'Moonga · Red Coral 7ct', desc: 'Italian Red Coral, certified. For Mars, courage, health & removal of obstacles.', price: '₹5,499', priceOld: '₹7,500', priceNum: 5499, save: '27% off', rating: '4.8', reviews: '98', badge: null, stock_quantity: 10, is_in_stock: true, display_rank: 3, img: '/products/munga.jpeg', images: ['/products/munga.jpeg'] },
  { id: 20, sku: 'RAT-EME', slug: 'panna-·-emerald-4.2ct-rat-eme', cat: 'ratna', catLabel: 'Ratna · Mercury', title: 'Panna · Emerald 4.2ct', desc: 'Colombian Emerald, natural untreated, IGI certified. For Mercury, intellect & communication.', price: '₹8,999', priceOld: '₹12,500', priceNum: 8999, save: '28% off', rating: '4.8', reviews: '186', badge: 'lab', stock_quantity: 15, is_in_stock: true, display_rank: 4, img: '/products/panna.jpeg', images: ['/products/panna.jpeg'] },
  { id: 6, sku: 'RAT-001', slug: 'yellow-sapphire-pukhraj-rat-001', cat: 'ratna', catLabel: 'Ratna · Jupiter', title: 'Pukhraj · Yellow Sapphire 4ct', desc: 'Ceylon Yellow Sapphire, GIA certified. For Jupiter, wisdom, marriage & prosperity.', price: '₹18,500', priceOld: '₹22,000', priceNum: 18500, save: '16% off', rating: '4.9', reviews: '89', badge: 'lab', stock_quantity: 12, is_in_stock: true, display_rank: 5, img: '/products/pushkaraj.jpeg', images: ['/products/pushkaraj.jpeg'] },
  { id: 46, sku: 'RAT-DIA', slug: 'heera-natural-diamond-0.75ct-rat-dia', cat: 'ratna', catLabel: 'Ratna · Venus', title: 'Heera · Natural Diamond 0.75ct', desc: 'Natural brilliant-cut Diamond (Heera), certified. For Venus (Shukra), beauty, luxury, romance & prosperity.', price: '₹24,999', priceOld: '₹35,000', priceNum: 24999, save: '29% off', rating: '4.9', reviews: '72', badge: 'lab', stock_quantity: 8, is_in_stock: true, display_rank: 6, img: '/products/diamond.jpeg', images: ['/products/diamond.jpeg'] },
  { id: 7, sku: 'RAT-002', slug: 'natural-blue-sapphire-neelam-rat-002', cat: 'ratna', catLabel: 'Ratna · Saturn', title: 'Neelam · Blue Sapphire 3ct', desc: 'Ceylon Blue Sapphire, GIA certified. Must be tested first. For Saturn blessings.', price: '₹19,999', priceOld: '₹28,000', priceNum: 19999, save: '29% off', rating: '4.9', reviews: '54', badge: 'lab', stock_quantity: 7, is_in_stock: true, display_rank: 7, img: '/products/nilam.jpeg', images: ['/products/nilam.jpeg'] },
  { id: 47, sku: 'RAT-GOM', slug: 'gomed-hessonite-5.25ct-rat-gom', cat: 'ratna', catLabel: 'Ratna · Rahu', title: 'Gomed · Hessonite 5.25ct', desc: 'Natural Ceylon Hessonite (Gomed), certified. For Rahu balance, clarity of intellect & confidence.', price: '₹7,499', priceOld: '₹10,500', priceNum: 7499, save: '29% off', rating: '4.8', reviews: '84', badge: 'lab', stock_quantity: 15, is_in_stock: true, display_rank: 8, img: '/products/gomed.jpeg', images: ['/products/gomed.jpeg'] },
  { id: 48, sku: 'RAT-VAI', slug: 'vaidurya-cats-eye-4.5ct-rat-vai', cat: 'ratna', catLabel: 'Ratna · Ketu', title: 'Vaidurya · Cat\'s Eye 4.5ct', desc: 'Natural Chrysoberyl Cat\'s Eye (Vaidurya) with sharp chatoyancy, certified. For Ketu protection & intuition.', price: '₹9,999', priceOld: '₹14,000', priceNum: 9999, save: '29% off', rating: '4.9', reviews: '61', badge: 'lab', stock_quantity: 12, is_in_stock: true, display_rank: 9, img: '/products/Vedurya.jpeg', images: ['/products/Vedurya.jpeg'] },
];

export const YANTRA = [
  { id: 30, sku: 'RM-OO4', slug: 'sri-yantra-in-pure-copper-rm-oo4', cat: 'yantra', catLabel: 'Yantra · Lakshmi', title: 'Sri Yantra in Pure Copper', desc: 'Hand-etched 99.4% pure copper. Pran-pratishtha & installation guidance included.', price: '₹ 3,500', priceOld: '₹ 4,200', priceNum: 3500, save: '17% off', rating: '4.9', reviews: '124', badge: 'new', stock_quantity: 20, is_in_stock: true, img: svgYantra('श्रीं ह्रीं') },
  { id: 23, sku: 'YAN-KUB', slug: 'kuber-yantra-·-copper-yan-kub', cat: 'yantra', catLabel: 'Yantra · Wealth', title: 'Kuber Yantra · Copper', desc: 'For financial prosperity, wealth attraction & business growth. Hand-etched copper.', price: '₹2,499', priceOld: '₹3,500', priceNum: 2499, save: '29% off', rating: '4.8', reviews: '89', badge: null, stock_quantity: 18, is_in_stock: true, img: svgYantra('कु') },
  { id: 24, sku: 'YAN-NAV', slug: 'navgraha-yantra-·-copper-yan-nav', cat: 'yantra', catLabel: 'Yantra · Nine Planets', title: 'Navgraha Yantra · Copper', desc: 'Nine planetary yantras in one. Complete cosmic balance. Pran-pratishtha done.', price: '₹4,999', priceOld: '₹6,500', priceNum: 4999, save: '23% off', rating: '4.9', reviews: '67', badge: 'hot', stock_quantity: 10, is_in_stock: true, img: svgYantra('न') },
  { id: 25, sku: 'YAN-GAN', slug: 'ganesh-yantra-·-copper-yan-gan', cat: 'yantra', catLabel: 'Yantra · Ganesh', title: 'Ganesh Yantra · Copper', desc: 'For removal of obstacles, new beginnings & success in endeavours.', price: '₹1,999', priceOld: '₹2,800', priceNum: 1999, save: '29% off', rating: '4.8', reviews: '156', badge: null, stock_quantity: 15, is_in_stock: true, img: svgYantra('ग') },
];

export const BRACELETS = [
  { id: 26, sku: 'BRC-NAV', slug: 'tiger-eye-bracelet-brc-nav', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Tiger Eye Bracelet', desc: 'Courage, willpower & confidence. 8mm authentic polished tiger eye crystal beads.', price: '₹1,899', priceOld: '₹2,999', priceNum: 1899, save: '37% off', rating: '4.9', reviews: '120', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 1, img: '/products/tiger_eye_bracelet.png', images: ['/products/tiger_eye_bracelet.png'] },
  { id: 38, sku: 'BRC-RSQ', slug: 'rose-quartz-bracelet-brc-rsq', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Rose Quartz Bracelet', desc: 'Unconditional love, emotional balance, compassion & heart chakra alignment.', price: '₹1,299', priceOld: '₹1,999', priceNum: 1299, save: '35% off', rating: '4.9', reviews: '118', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 2, img: '/products/rose_quartz_bracelet.jpg', images: ['/products/rose_quartz_bracelet.jpg'] },
  { id: 28, sku: 'BRC-TOU', slug: 'black-tourmaline-bracelet-brc-tou', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Black Tourmaline Bracelet', desc: 'Powerful aura protection stone. Shields from negative energies & evil eye.', price: '₹1,499', priceOld: '₹2,200', priceNum: 1499, save: '32% off', rating: '4.9', reviews: '95', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 3, img: '/products/black_tourmaline_bracelet.png', images: ['/products/black_tourmaline_bracelet.png'] },
  { id: 9, sku: 'BRC-001', slug: 'firoza-bracelet-brc-001', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Firoza Bracelet', desc: 'Sacred turquoise beads for mental peace, protection & throat chakra healing.', price: '₹799', priceOld: '₹999', priceNum: 799, save: '20% off', rating: '4.9', reviews: '120', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 4, img: '/static/uploads/products/779af49d3c_Gemstone_bead_bracelet_on_podium_2K_20261020132128-clean.png', images: ['/static/uploads/products/779af49d3c_Gemstone_bead_bracelet_on_podium_2K_20261020132128-clean.png'] },
  { id: 39, sku: 'BRC-SPH', slug: 'clear-quartz-bracelet-brc-sph', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Clear Quartz Bracelet', desc: 'Pure natural Sphatik beads. Master healer for clarity of mind & spiritual purity.', price: '₹1,199', priceOld: '₹1,800', priceNum: 1199, save: '33% off', rating: '4.8', reviews: '86', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 5, img: '/products/clear_quartz_bracelet.png', images: ['/products/clear_quartz_bracelet.png'] },
  { id: 29, sku: 'BRC-COM', slug: 'citrine-bracelet-brc-com', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Citrine Bracelet', desc: 'Radiant abundance & solar plexus energy. Attracts success, joy & prosperity.', price: '₹2,299', priceOld: '₹3,200', priceNum: 2299, save: '28% off', rating: '4.9', reviews: '120', badge: 'lab', stock_quantity: 15, is_in_stock: true, display_rank: 6, img: '/static/uploads/products/60141ddde9_Citrine_crystal_bracelet_on_podium_2K_20261020131544-clean.png', images: ['/static/uploads/products/60141ddde9_Citrine_crystal_bracelet_on_podium_2K_20261020131544-clean.png'] },
  { id: 40, sku: 'BRC-MMG', slug: 'money-magnet-gemstone-bracelet-brc-mmg', cat: 'combo', catLabel: 'Bracelet · Combination', title: 'Money Magnet Gemstone Bracelet', desc: 'Synergistic Pyrite, Green Aventurine, Tiger Eye & Citrine for wealth attraction.', price: '₹2,499', priceOld: '₹3,500', priceNum: 2499, save: '29% off', rating: '4.9', reviews: '142', badge: 'lab', stock_quantity: 20, is_in_stock: true, display_rank: 7, img: '/products/money_magnet_bracelet.png', images: ['/products/money_magnet_bracelet.png'] },
  { id: 41, sku: 'BRC-AVE', slug: 'green-aventurine-gemstone-bracelet-brc-ave', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Green Aventurine Bracelet', desc: 'Natural Green Aventurine crystal beads. Stone of opportunity, good fortune & heart chakra balance.', price: '₹1,299', priceOld: '₹1,899', priceNum: 1299, save: '32% off', rating: '4.9', reviews: '114', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 8, img: '/products/green_aventurine_bracelet.jpg', images: ['/products/green_aventurine_bracelet.jpg'] },
  { id: 42, sku: 'BRC-MLT', slug: 'multicolor-gemstone-navagraha-bracelet-brc-mlt', cat: 'combo', catLabel: 'Bracelet · Combination', title: 'Multicolor Gemstone Bracelet', desc: 'Sacred 9-gemstone planetary combination with authentic natural crystals for holistic balance.', price: '₹1,899', priceOld: '₹2,799', priceNum: 1899, save: '32% off', rating: '4.9', reviews: '138', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 9, img: '/products/multicolor_gemstone_bracelet.png', images: ['/products/multicolor_gemstone_bracelet.png'] },
  { id: 43, sku: 'BRC-ONX', slug: 'black-onyx-protective-bracelet-brc-onx', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Black Onyx Bracelet', desc: 'Polished natural Black Onyx round beads. Master grounding crystal that absorbs negative energies.', price: '₹1,099', priceOld: '₹1,699', priceNum: 1099, save: '35% off', rating: '4.9', reviews: '102', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 10, img: '/products/black_onyx_bracelet.png', images: ['/products/black_onyx_bracelet.png'] },
  { id: 44, sku: 'BRC-LAV', slug: 'natural-lava-stone-grounding-bracelet-brc-lav', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Lava Stone Bracelet', desc: 'Authentic porous volcanic lava rock beads. Connects with Earth energy for grounding & strength.', price: '₹899', priceOld: '₹1,399', priceNum: 899, save: '36% off', rating: '4.8', reviews: '94', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 11, img: '/products/lava_stone_bracelet.jpeg', images: ['/products/lava_stone_bracelet.jpeg'] },
  { id: 45, sku: 'BRC-TRQ', slug: 'turquoise-healing-bead-bracelet-brc-trq', cat: 'spi', catLabel: 'Bracelet · Spiritual', title: 'Turquoise Stone Bracelet', desc: 'Natural vibrant turquoise stone beads for peace of mind, self-expression & positive aura flow.', price: '₹999', priceOld: '₹1,499', priceNum: 999, save: '33% off', rating: '4.9', reviews: '106', badge: 'lab', stock_quantity: 25, is_in_stock: true, display_rank: 12, img: '/products/turquoise_bracelet.jpg', images: ['/products/turquoise_bracelet.jpg'] },
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

  // Resolve uploaded image URLs for both browser and Next.js rendering.
  // Same-origin /static paths are intentionally preserved so next.config.mjs
  // can rewrite them to the Flask backend service.
  let visual = '';
  const lowerName = String(p.name || '').toLowerCase();
  const catSlug = String(
    (typeof p.category === 'object' && p.category?.slug)
      ? p.category.slug
      : (p.category || '')
  ).toLowerCase();

  const resolveImg = (value) => {
    if (!value) return '';

    let clean = typeof value === 'string'
      ? value.trim()
      : (value.url || value.image_url || value.path || value.src || '');

    if (typeof clean !== 'string' || !clean.trim()) return '';
    clean = clean.trim();

    // Convert Windows filesystem paths to the public uploads route.
    if (clean.includes('\\') || /^[A-Za-z]:/.test(clean)) {
      const filename = clean.split(/[/\\]/).pop();
      if (!filename) return '';
      clean = `/static/uploads/products/${encodeURIComponent(filename)}`;
    }

    // Normalize URLs that accidentally expose internal Docker hostnames.
    if (/^https?:\/\//i.test(clean)) {
      try {
        const parsed = new URL(clean);
        const internalHosts = new Set(['localhost', '127.0.0.1', 'backend']);
        if (parsed.pathname.startsWith('/static/') && internalHosts.has(parsed.hostname)) {
          return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {
        return '';
      }
      return clean;
    }

    if (clean.startsWith('static/')) clean = `/${clean}`;
    if (clean.startsWith('/static/')) return clean;
    return clean.startsWith('/') ? clean : `/${clean}`;
  };

  if (p.thumbnail && p.thumbnail !== '/static/img/product-default.png' && !String(p.thumbnail).includes('default')) {
    // Keep img as a URL/path, not an HTML <img> string. ProductCard renders URLs.
    visual = resolveImg(p.thumbnail);
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

  // Build real image URLs for the card carousel and product modal.
  // Do not invent secondary slides: a single uploaded thumbnail means one slide.
  let rawImagesList = [];
  if (Array.isArray(p.images)) {
    rawImagesList = [...p.images];
  } else if (typeof p.images === 'string' && p.images.trim()) {
    try {
      const parsed = JSON.parse(p.images);
      if (Array.isArray(parsed)) rawImagesList = parsed;
    } catch {
      // Ignore malformed gallery JSON and rely on the thumbnail.
    }
  }

  const hasRealThumbnail = Boolean(
    p.thumbnail && !String(p.thumbnail).toLowerCase().includes('default')
  );
  if (hasRealThumbnail) rawImagesList.unshift(p.thumbnail);

  const resolvedImages = [...new Set(rawImagesList.map(resolveImg).filter(Boolean))];
  if (resolvedImages.length === 0 && visual) resolvedImages.push(visual);

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
    low_stock_threshold: p.low_stock_threshold ?? 10,
    is_in_stock: p.stock_quantity !== undefined ? p.stock_quantity > 0 : true,
    certification_status: p.certification_status || 'certified',
    comparePriceNum: numCompare,
    img: visual,
    images: resolvedImages,
    attributes: attrs,
    material: attrs.material || p.material || '',
    size: attrs.size || p.size || '',
    mukhi: attrs.mukhi || p.mukhi || '',
    origin: attrs.origin || p.origin || '',
    carat: attrs.carat || p.carat || '',
    metal: attrs.metal || p.metal || '',
    bead_size: attrs.bead_size || p.bead_size || '',
    energized: attrs.energized || p.energized || '',
    installation: attrs.installation || p.installation || '',
    significance_en: attrs.significance_en || p.significance_en || '',
    significance_mr: attrs.significance_mr || p.significance_mr || '',
    how_to_wear_mr: attrs.how_to_wear_mr || p.how_to_wear_mr || '',
    mantra: attrs.mantra || p.mantra || '',
    care_mr: attrs.care_mr || p.care_mr || '',
    shipping_mr: attrs.shipping_mr || p.shipping_mr || '',
    cert_label: attrs.cert_label || p.cert_label || '',
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
