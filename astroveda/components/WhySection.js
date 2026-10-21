const reasons = [
  {
    num: '01',
    title: 'A Legacy of Vedic Knowledge',
    desc: 'A Vedic and spiritual tradition spanning three generations. A commitment to carry forward the legacy of traditional rituals, sacrificial rites (yajnas), and religious ceremonies.',
  },
  {
    num: '02',
    title: 'Personalised Jyotish Guidance',
    desc: 'Qualified in Jyotish Bhaskar, Guruji provides detailed Kundali analysis, study-based astrological guidance, and traditional remedies tailored to individual needs.',
  },
  {
    num: '03',
    title: 'Authentic & Genuine Products',
    desc: 'Explore authentic Rudraksha, gemstones, Yantras, and spiritual products, carefully selected for quality and authenticity.',
  },
  {
    num: '04',
    title: 'Your One-Stop Spiritual Destination',
    desc: 'From Vedic Puja and Kundali Consultation to Yantras, Rudraksha, Gemstones, and Sacred Products — discover all your spiritual needs in one place.',
  },
  {
    num: '05',
    title: 'Traditional Energisation & Guidance',
    desc: 'Selected Yantras and Rudraksha can be ritually energised by Guruji, with personalised guidance on their proper use, wearing methods, and care according to Vedic traditions.',
  },
  {
    num: '06',
    title: 'Trusted by Yajmans Worldwide',
    desc: 'Serving yajmans across Maharashtra, India, and abroad through traditional Vedic pujas, spiritual guidance, and convenient online services.',
  },
];

export default function WhySection() {
  return (
    <section className="why-section">
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Why Choose</span>
          <h2>Nagesh Swami Guruji?</h2>
          <p>Three Generations of Tradition</p>
        </div>
        <div className="why-grid">
          {reasons.map((r) => (
            <div key={r.num} className="why-card reveal">
              <div className="why-num">{r.num}</div>
              <h4>{r.title}</h4>
              <p>{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
