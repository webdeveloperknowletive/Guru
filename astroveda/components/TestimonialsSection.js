const defaultTestimonials = [
  {
    initial: 'A',
    name: 'Anjali Deshmukh',
    place: 'Pune · गृहप्रवेश पूजा',
    text: 'Puja arrangement was very systematic. Panditji arrived on time, all samagri was prepared properly, and the entire vidhi was explained step by step. Highly recommended.'
  },
  {
    initial: 'R',
    name: 'Rohit Kulkarni',
    place: 'Mumbai · Career Consultation',
    text: 'Consultation was explained very clearly. Guruji took time to study my kundali and explained everything in simple language. No unnecessary fear-mongering.'
  },
  {
    initial: 'S',
    name: 'Shweta Joshi',
    place: 'Nashik · 5 Mukhi Rudraksha',
    text: 'Rudraksha quality and guidance were excellent. Got proper certification and clear instructions on how to wear and care. Very authentic experience.'
  },
  {
    initial: 'V',
    name: 'Vikram Patil',
    place: 'Thane · Shri Yantra',
    text: 'Ordered a Shri Yantra with pran-pratishtha. The follow-up guidance call after delivery was a wonderful touch. Truly a premium spiritual service.'
  }
];

export default function TestimonialsSection({ testimonials: initialTestimonials }) {
  const list = (initialTestimonials !== undefined && initialTestimonials !== null)
    ? initialTestimonials.map(t => ({
        initial: t.initial || (t.name ? t.name.charAt(0).toUpperCase() : 'A'),
        name: t.name,
        place: t.place || t.location || 'Pune',
        text: t.text || t.content || '',
      }))
    : defaultTestimonials;

  return (
    <section className="testi-section">
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Testimonials</span>
          <h2>What Our <em>Clients</em> Say</h2>
          <p>प्रत्येक अभिप्राय खरा आहे — फसवे reviews आम्ही ठेवत नाही.</p>
        </div>
        <div className="testi-grid">
          {list.map((t, idx) => (
            <div key={idx} className="testi-card reveal">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-text">&quot;{t.text}&quot;</p>
              <div className="testi-person">
                <div className="testi-avatar">{t.initial}</div>
                <div className="testi-info">
                  <strong>{t.name}</strong>
                  <span>{t.place}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
