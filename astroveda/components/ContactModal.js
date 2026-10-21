'use client';
import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { submitContact } from '@/lib/api';

export default function ContactModal() {
  const { contactModal, closeContact, showToast } = useStore();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Devotee Guidance',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submittedRef, setSubmittedRef] = useState(null);

  if (!contactModal?.show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      showToast('कृपया नाव, ईमेल आणि संदेश प्रविष्ट करा (Please fill in name, email, and message)');
      return;
    }

    setLoading(true);
    try {
      const res = await submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });

      setSubmittedRef(res.enquiry_id || 'Submitted');
      showToast('तुमची चौकशी यशस्वीपणे पाठवली गेली आहे (Enquiry submitted successfully)');
      setForm({
        name: '',
        email: '',
        phone: '',
        subject: 'General Devotee Guidance',
        message: '',
      });
    } catch (err) {
      showToast(err.message || 'Error submitting enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="pd-modal-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) closeContact();
      }}
      style={{ zIndex: 1050 }}
    >
      <div
        className="pd-modal"
        style={{
          maxWidth: '560px',
          display: 'block',
          padding: 'clamp(18px, 4vw, 32px)',
        }}
      >
        <button
          className="pd-close"
          onClick={closeContact}
          aria-label="Close contact"
          disabled={loading}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span className="kicker" style={{ display: 'inline-block', marginBottom: '4px' }}>Seva Contact</span>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--gold-lt)' }}>
            Connect with Guruji Seva
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            पूजा, विधी, रत्न मार्गदर्शन किंवा कोणत्याही शंकेसाठी संपर्क साधा
          </p>
        </div>

        {submittedRef ? (
          <div style={{
            padding: '24px',
            background: 'rgba(224, 176, 74, 0.1)',
            border: '1px solid var(--gold)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🕉️</div>
            <h4 style={{ color: 'var(--gold-lt)', marginBottom: '8px' }}>चौकशी प्राप्त झाली! (Enquiry Received)</h4>
            <p style={{ fontSize: '13px', color: 'var(--ink)', marginBottom: '16px' }}>
              आमचे आश्रम सेवक 24 तासांच्या आत आपल्याशी संपर्क साधतील.
            </p>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => {
                setSubmittedRef(null);
                closeContact();
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Full Name · पूर्ण नाव *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="उदा. राहुल कुलकर्णी"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(224, 176, 74, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--ink)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Email · ईमेल *
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="devotee@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(224, 176, 74, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--ink)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Phone / WhatsApp · मोबाइल
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(224, 176, 74, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--ink)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Topic / Subject · विषय
              </label>
              <select
                name="subject"
                value={form.subject}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(20, 10, 15, 0.95)',
                  border: '1px solid rgba(224, 176, 74, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--ink)',
                  fontSize: '14px',
                }}
              >
                <option value="General Devotee Guidance">General Guidance · सामान्य मार्गदर्शन</option>
                <option value="Puja Vidhi Enquiry">Puja Vidhi Enquiry · पूजा विधी चौकशी</option>
                <option value="Gemstone Selection">Gemstone Selection · रत्न निवड</option>
                <option value="Rudraksha Authenticity">Rudraksha Authenticity · रुद्राक्ष परीक्षण</option>
                <option value="Order & Delivery Query">Order & Delivery Query · ऑर्डर व डिलिव्हरी</option>
                <option value="Other Spiritual Enquiry">Other Spiritual Enquiry · इतर</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Message / Prayer Request · संदेश किंवा प्रार्थना *
              </label>
              <textarea
                name="message"
                rows={4}
                value={form.message}
                onChange={handleChange}
                placeholder="तुमची शंका किंवा प्रश्न येथे लिहा..."
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(224, 176, 74, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--ink)',
                  fontSize: '14px',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              disabled={loading}
              style={{ width: '100%', padding: '12px', marginTop: '6px' }}
            >
              {loading ? 'Submitting...' : 'Send Message · संदेश पाठवा →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
