export default function TopBar({ banners = [] }) {
  const hasBanners = banners && banners.length > 0;
  const items = hasBanners
    ? banners.map(b => ({ title: b.title, link: b.link_url }))
    : [
        { title: 'Free Shipping on Orders Above ₹999', link: null },
        { title: 'IGI & GIA Certified Gemstones', link: null },
        { title: 'Energised & Authentic Products', link: null },
      ];

  return (
    <div className="top-bar">
      <div className="tb-left">
        {items.map((it, idx) => (
          it.link ? (
            <a key={idx} href={it.link} style={{ color: 'inherit', textDecoration: 'none' }}>
              <span>{it.title}</span>
            </a>
          ) : (
            <span key={idx}>{it.title}</span>
          )
        ))}
      </div>
      <div className="tb-right">
        <a href="https://wa.me/919000000000" target="_blank" rel="noopener noreferrer" className="wa">
          📲 WhatsApp Guruji
        </a>
      </div>
    </div>
  );
}
