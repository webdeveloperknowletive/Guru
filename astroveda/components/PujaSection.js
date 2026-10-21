'use client';
import { useState } from 'react';
import PujaBookingModal from '@/components/PujaBookingModal';

const defaultPujaServices = [
  { icon: '🏠', title: 'गृहप्रवेश पूजा', desc: 'नवीन घरात प्रवेश करण्यापूर्वी वास्तुदोष शांती व गृहप्रवेश विधी.' },
  { icon: '🔱', title: 'वास्तुशांती', desc: 'वास्तु दोष निवारणासाठी शास्त्रोक्त वास्तुशांती होम व मंत्र जप.' },
  { icon: '🕉️', title: 'सत्यनारायण पूजा', desc: 'कुटुंबातील सुख, शांती व समृद्धीसाठी सत्यनारायण कथा व पूजन.' },
  { icon: '💧', title: 'रुद्राभिषेक', desc: 'शिवलिंगावर अभिषेक व रुद्र मंत्र जप — आरोग्य व मनःशांतीसाठी.' },
  { icon: '🌌', title: 'नवग्रह शांती', desc: 'नऊ ग्रहांच्या अशुभ प्रभावासाठी नवग्रह शांती होम व जप.' },
  { icon: '🌊', title: 'उदकशांती', desc: 'जलदोष, पूर किंवा अनावृष्टी निवारणासाठी उदकशांती विधी.' },
  { icon: '💐', title: 'विवाह संबंधित पूजा', desc: 'साखरपुडा, लग्न व वरातीशी संबंधित सर्व शास्त्रोक्त विधी.' },
  { icon: '✨', title: 'विशेष अनुष्ठान', desc: 'तुमच्या विशिष्ट समस्येसाठी कस्टम अनुष्ठान व मंत्र जप.' },
];

const pujaImageMap = [
  { match: ['laghu', 'लघुरुद्र', 'rudrayag'], image: '/puja/laghurudra.jpg' },
  { match: ['navagraha', 'नवग्रह', 'graha'], image: '/puja/navagraha-shanti.jpg' },
  { match: ['navchandi', 'नवचंडी', 'chandi', 'durga'], image: '/puja/navchandi.jpg' },
  { match: ['satyanarayan', 'सत्यनारायण', 'satya'], image: '/puja/satyanarayan.jpg' },
  { match: ['udak', 'उदक'], image: '/puja/udak-shanti.jpg' },
  { match: ['vastu', 'गृहप्रवेश', 'वास्तु'], image: '/puja/vastu-shanti.jpg' },
  { match: ['vivah', 'विवाह', 'marriage'], image: '/puja/vedic-vivah.jpg' },
  { match: ['abhishek', 'अभिषेक'], image: '/puja/abhishek.jpg' },
  { match: ['kaal sarp', 'कालसर्प', 'काल सर्प', 'kalsarp'], image: '/puja/kaal-sarp-shanti.jpg' },
];

function getPujaBgImage(title = '') {
  const t = (title || '').toLowerCase();
  for (const item of pujaImageMap) {
    if (item.match.some(m => t.includes(m.toLowerCase()))) {
      return item.image;
    }
  }
  return '/puja/vastu-shanti.jpg';
}

export default function PujaSection({ services: initialServices }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPuja, setSelectedPuja] = useState('');

  const services = (initialServices !== undefined && initialServices !== null)
    ? initialServices.map(s => ({
      icon: s.icon || '🪔',
      title: s.title || s.name,
      desc: s.description || s.desc || 'शास्त्रोक्त विधी व वैदिक संकल्प सेवेसह.',
    }))
    : defaultPujaServices;

  const handleOpenBooking = (pujaTitle = '') => {
    setSelectedPuja(pujaTitle);
    setModalOpen(true);
  };

  return (
    <section className="puja-section" id="puja">
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Puja Services</span>
          <h2>Traditional <em>Puja</em> Services</h2>
          <p>परंपरागत विधी, योग्य मंत्रोच्चार, शास्त्रोक्त पद्धती — तुमच्या घरी किंवा ऑनलाइन Sankalp Seva द्वारे.</p>
        </div>
        <div className="puja-grid">
          {services.map((puja) => {
            const bgImage = getPujaBgImage(puja.title);
            return (
              <div
                key={puja.title}
                className="puja-card reveal"
                style={{
                  backgroundImage: `url("${bgImage}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                <div className="puja-card-content">
                  <h4 className="puja-title">{puja.title}</h4>
                  <p className="puja-desc">{puja.desc}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenBooking(puja.title)}
                    className="puja-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                  >
                    View Puja Details →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="puja-cta reveal">
          <button
            type="button"
            onClick={() => handleOpenBooking('')}
            className="btn btn-gold"
          >
            Book a Puja →
          </button>
        </div>
      </div>

      <PujaBookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedPujaTitle={selectedPuja}
      />
    </section>
  );
}
