'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/context/StoreContext';
import { getPujaServices, bookPuja } from '@/lib/api';

export default function PujaBookingModal({ isOpen, onClose, selectedPujaTitle }) {
  const { showToast } = useStore();
  const [mounted, setMounted] = useState(false);
  const [pujaList, setPujaList] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    timeSlot: '10:00 AM',
    bookingType: 'online',
    gotra: '',
    rashi: '',
    nakshatra: '',
    sankalp: '',
  });
  const [loading, setLoading] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    let isMounted = true;
    getPujaServices()
      .then(res => {
        if (isMounted && res.puja_services && res.puja_services.length > 0) {
          setPujaList(res.puja_services);
          // Match selected title if possible
          if (selectedPujaTitle) {
            const match = res.puja_services.find(s => s.name.toLowerCase().includes(selectedPujaTitle.toLowerCase()));
            if (match) setSelectedServiceId(match.id);
          } else {
            setSelectedServiceId(res.puja_services[0].id);
          }
        }
      })
      .catch(() => {
        // Fallback default puja list if backend is starting
        setPujaList([
          { id: 1, name: 'Maha Ganapati Puja', price: 2100, deity: 'Lord Ganesha' },
          { id: 2, name: 'Navagraha Shanti Puja', price: 3500, deity: 'Navagraha' },
          { id: 3, name: 'Satyanarayan Puja', price: 2500, deity: 'Lord Vishnu' },
          { id: 4, name: 'Maha Mrityunjaya Japa & Homa', price: 5100, deity: 'Lord Shiva' },
          { id: 5, name: 'Kanakadhara Lakshmi Puja', price: 3100, deity: 'Goddess Lakshmi' },
        ]);
      });

    return () => { isMounted = false; };
  }, [selectedPujaTitle]);

  if (!isOpen) return null;

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.date) {
      showToast('कृपया नाव, फोन आणि तारीख प्रविष्ट करा (Please enter name, phone, and date)');
      return;
    }

    setLoading(true);
    try {
      const email = form.email.trim() || `${form.phone.replace(/[^\d]/g, '')}@astroveda.in`;
      const res = await bookPuja({
        service_id: selectedServiceId,
        customer_name: form.name.trim(),
        customer_email: email,
        customer_phone: form.phone.trim(),
        booking_date: form.date,
        time_slot: form.timeSlot,
        booking_type: form.bookingType,
        gotra: form.gotra.trim() || 'Kashyap',
        nakshatra: form.nakshatra.trim() || null,
        rashi: form.rashi.trim() || null,
        sankalp_text: form.sankalp.trim() || 'Parivar Samriddhi & Arogya Sankalp',
      });

      setConfirmedBooking(res);
      showToast(`Puja Booking Confirmed: ${res.booking_number}`);
    } catch (err) {
      showToast(err.message || 'Booking failed, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedService = pujaList.find(s => s.id === Number(selectedServiceId)) || pujaList[0];

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="pd-modal-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      style={{ zIndex: 1200 }}
    >
      <div
        className="pd-modal"
        style={{
          maxWidth: '680px',
          gridTemplateColumns: '1fr',
          padding: 'clamp(18px, 4vw, 28px) clamp(14px, 3.5vw, 24px)',
          overflowY: 'auto',
          maxHeight: '85vh',
        }}
      >
        <button className="pd-close" onClick={onClose} aria-label="Close" disabled={loading}>
          ✕
        </button>

        {confirmedBooking ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: 'rgba(224, 176, 74, 0.15)',
                border: '2px solid var(--gold)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '28px',
                color: 'var(--gold-lt)',
              }}
            >
              🕉️
            </div>
            <span className="kicker">शास्त्रोक्त संकल्प नोंदणी</span>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--cream)', margin: '8px 0' }}>
              Puja Booking Confirmed!
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '13.5px', maxWidth: '440px', margin: '0 auto 20px' }}>
              तुमची पूजा यशस्वीरित्या नोंदवली गेली आहे. आमचे पुरोहित/समन्वयक संकल्प विधीसाठी तुमच्याशी संपर्क साधतील.
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(224, 176, 74, 0.2)',
                borderRadius: '10px',
                padding: '16px 20px',
                maxWidth: '420px',
                margin: '0 auto 24px',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Booking Reference:</span>
                <strong style={{ color: 'var(--gold-lt)' }}>{confirmedBooking.booking_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Dakshina Seva:</span>
                <strong style={{ color: 'var(--cream)' }}>₹{Number(confirmedBooking.amount_paid).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Status:</span>
                <span style={{ color: 'var(--gold-lt)', textTransform: 'capitalize' }}>{confirmedBooking.status}</span>
              </div>
            </div>

            <button className="btn btn-gold" onClick={onClose} style={{ padding: '12px 30px', borderRadius: '99px' }}>
              Done / पूर्ण झाले
            </button>
          </div>
        ) : (
          <div>
            <span className="kicker">Traditional Vedic Sankalp</span>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: '22px', color: 'var(--cream)', margin: '4px 0 16px' }}>
              Book Puja Seva · शास्त्रोक्त पूजा नोंदणी
            </h3>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid" style={{ gap: '14px' }}>
                <div className="field full">
                  <label htmlFor="puj-service">Select Puja · पूजा निवडा *</label>
                  <select
                    id="puj-service"
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                  >
                    {pujaList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.deity}) — ₹{Number(s.price).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="puj-name">Yajman Name · यजमानांचे नाव *</label>
                  <input
                    type="text"
                    id="puj-name"
                    name="name"
                    placeholder="Full Name"
                    value={form.name}
                    onChange={handleFieldChange}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="puj-phone">Mobile / WhatsApp *</label>
                  <input
                    type="tel"
                    id="puj-phone"
                    name="phone"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={handleFieldChange}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="puj-email">Email Address</label>
                  <input
                    type="email"
                    id="puj-email"
                    name="email"
                    placeholder="devotee@example.com"
                    value={form.email}
                    onChange={handleFieldChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="puj-date">Preferred Date · तारीख *</label>
                  <input
                    type="date"
                    id="puj-date"
                    name="date"
                    value={form.date}
                    onChange={handleFieldChange}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="puj-slot">Time Slot · वेळ</label>
                  <select
                    id="puj-slot"
                    name="timeSlot"
                    value={form.timeSlot}
                    onChange={handleFieldChange}
                  >
                    <option value="08:00 AM">08:00 AM (प्रातःकाल)</option>
                    <option value="10:00 AM">10:00 AM (सकाळ)</option>
                    <option value="11:30 AM">11:30 AM (माध्यान्ह)</option>
                    <option value="04:00 PM">04:00 PM (सायंकाल)</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="puj-type">Puja Mode · माध्यम</label>
                  <select
                    id="puj-type"
                    name="bookingType"
                    value={form.bookingType}
                    onChange={handleFieldChange}
                  >
                    <option value="online">Online Live Sankalp (व्हिडिओद्वारे)</option>
                    <option value="offline">At Home / Ashram (प्रत्यक्ष)</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="puj-gotra">Gotra · गोत्र (Optional)</label>
                  <input
                    type="text"
                    id="puj-gotra"
                    name="gotra"
                    placeholder="e.g. Kashyap, Bharadwaj"
                    value={form.gotra}
                    onChange={handleFieldChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="puj-rashi">Rashi · राशी (Optional)</label>
                  <input
                    type="text"
                    id="puj-rashi"
                    name="rashi"
                    placeholder="e.g. Mesh, Vrishabh"
                    value={form.rashi}
                    onChange={handleFieldChange}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="puj-sankalp">Sankalp Purpose · संकल्प उद्देश</label>
                  <textarea
                    id="puj-sankalp"
                    name="sankalp"
                    placeholder="आरोग्य, गृहशांती, व्यवसाय वृद्धी, इ."
                    rows={2}
                    value={form.sankalp}
                    onChange={handleFieldChange}
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', background: 'rgba(224,176,74,0.06)', border: '1px solid rgba(224,176,74,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Seva Dakshina</span>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '18px', color: 'var(--gold-lt)', fontWeight: '700' }}>
                    ₹{selectedService ? Number(selectedService.price).toLocaleString('en-IN') : '2,100'}
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={loading}
                  style={{ padding: '12px 24px', borderRadius: '99px' }}
                >
                  {loading ? 'नोंदणी सुरू आहे...' : 'Confirm Puja Booking →'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
