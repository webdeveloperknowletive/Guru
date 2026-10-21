'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { requestConsultation, getConsultations } from '@/lib/api';

export default function JyotishSection() {
  const { showToast } = useStore();
  const [consultInfo, setConsultInfo] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    time: '',
    place: '',
    topic: '',
    date: '',
    mode: 'Online · ऑनलाइन',
    msg: '',
  });
  const [loading, setLoading] = useState(false);
  const [confirmedNumber, setConfirmedNumber] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getConsultations()
      .then(res => {
        if (isMounted && res) setConsultInfo(res);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.id.replace('f-', '')]: e.target.value }));

  const handleSelectPackage = (topicName) => {
    setForm(prev => ({ ...prev, topic: topicName }));
    showToast(`Selected Topic: ${topicName}`);
    const selectEl = document.getElementById('f-topic');
    if (selectEl) {
      selectEl.focus();
    }
  };

  const topicTags = [
    'Janma Kundali Preparation',
    'Kundali Analysis & Guidance',
    'Marriage Kundali Matching',
    'Career & Business Guidance',
    'Finance & Wealth Guidance',
    'Muhurat Selection',
    'Gemstone & Rudraksha Guidance',
    'General Jyotish Consultation',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.dob || !form.place || !form.topic) {
      showToast('कृपया सर्व आवश्यक माहिती भरा (Name, DOB, Place, Topic)');
      return;
    }

    setLoading(true);
    try {
      const email = form.email.trim() || `${(form.phone || 'devotee').replace(/[^\w]/g, '')}@astroveda.in`;
      const res = await requestConsultation({
        customer_name: form.name.trim(),
        customer_email: email,
        customer_phone: form.phone.trim(),
        dob: form.dob,
        tob: form.time || '10:00 AM',
        pob: form.place.trim(),
        topic: form.topic,
        consultation_type: form.mode.includes('Online') ? 'online_video' : 'in_person',
      });

      setConfirmedNumber(res.consultation_number);
      showToast(`धन्यवाद ${form.name}! Consultation Booked: ${res.consultation_number}`);
      setForm({ name: '', email: '', phone: '', dob: '', time: '', place: '', topic: '', date: '', mode: 'Online · ऑनलाइन', msg: '' });
    } catch (err) {
      showToast(err.message || 'त्रुटी आली, कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="jyotish">
      <div className="wrap">
        <div className="jyotish-wrap">
          <div className="jyotish-info reveal">
            <span className="kicker">Jyotish Consultation</span>
            <h2>Kundali &amp; <em>Astrology</em></h2>
            <p>Personalised Jyotish Guidance by Nagesh Swami Guruji</p>
            <div className="jyotish-tags">
              {topicTags.map(tag => (
                <span
                  key={tag}
                  onClick={() => handleSelectPackage(tag)}
                  className={form.topic === tag ? 'active' : ''}
                  style={{
                    cursor: 'pointer',
                    background: form.topic === tag ? 'var(--accent-primary, #563B2D)' : undefined,
                    color: form.topic === tag ? '#FFFFFF' : undefined,
                    borderColor: form.topic === tag ? 'var(--accent-primary, #563B2D)' : undefined,
                  }}
                  title="Click to select this topic"
                >
                  {tag}
                </span>
              ))}
            </div>
            <a href="https://wa.me/919000000000" target="_blank" rel="noopener" className="btn btn-ghost">📲 WhatsApp गुरुजी</a>
          </div>

          <form className="form-card reveal" onSubmit={handleSubmit} noValidate>
            <h3>Book Your Consultation</h3>
            <p className="form-sub">कृपया खालील माहिती भरा — आम्ही 24 तासांत संपर्क करू.</p>

            {confirmedNumber && (
              <div style={{ background: 'rgba(224, 176, 74, 0.15)', border: '1px solid var(--gold)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: 'var(--gold-lt)', fontSize: '13px' }}>
                ✓ Consultation नोंदणी यशस्वी! Reference Number: <strong>{confirmedNumber}</strong>
              </div>
            )}

            <div className="form-grid">
              <div className="field full">
                <label htmlFor="f-name">Name · नाव *</label>
                <input type="text" id="f-name" placeholder="तुमचे पूर्ण नाव" value={form.name} onChange={handleChange} required />
              </div>
              <div className="field">
                <label htmlFor="f-phone">Mobile / WhatsApp *</label>
                <input type="tel" id="f-phone" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} required />
              </div>
              <div className="field">
                <label htmlFor="f-email">Email (Optional)</label>
                <input type="email" id="f-email" placeholder="devotee@example.com" value={form.email} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="f-dob">Date of Birth *</label>
                <input type="date" id="f-dob" value={form.dob} onChange={handleChange} required />
              </div>
              <div className="field">
                <label htmlFor="f-time">Birth Time</label>
                <input type="time" id="f-time" value={form.time} onChange={handleChange} />
              </div>
              <div className="field full">
                <label htmlFor="f-place">Birth Place *</label>
                <input type="text" id="f-place" placeholder="शहर, राज्य" value={form.place} onChange={handleChange} required />
              </div>
              <div className="field full">
                <label htmlFor="f-topic">Consultation Topic *</label>
                <select id="f-topic" value={form.topic} onChange={handleChange} required>
                  <option value="">निवडा...</option>
                  {topicTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-date">Preferred Date</label>
                <input type="date" id="f-date" value={form.date} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="f-mode">Mode</label>
                <select id="f-mode" value={form.mode} onChange={handleChange}>
                  <option>Online · ऑनलाइन</option>
                  <option>Offline · प्रत्यक्ष</option>
                </select>
              </div>
              <div className="field full">
                <label htmlFor="f-msg">Additional Notes (Optional)</label>
                <textarea id="f-msg" placeholder="तुमचा प्रश्न किंवा अतिरिक्त माहिती..." value={form.msg} onChange={handleChange} />
              </div>
            </div>
            <button type="submit" className="form-submit" disabled={loading}>
              {loading ? 'नोंदणी सुरू आहे...' : 'Submit & Book Consultation →'}
            </button>
            <p className="form-note">🔒 तुमची माहिती सुरक्षित आहे. Payment consultation confirm झाल्यावर.</p>
          </form>
        </div>
      </div>
    </section>
  );
}
