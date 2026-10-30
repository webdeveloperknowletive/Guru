'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore, loadRazorpayScript } from '@/context/StoreContext';
import { getPujaServices, bookPuja, getGurujiProfile, getAvailabilitySlots, verifyPayment } from '@/lib/api';
import ReCaptcha from '@/components/ReCaptcha';

export default function PujaBookingModal({ isOpen, onClose, selectedPujaTitle }) {
  const { showToast, paymentMode } = useStore();
  const [mounted, setMounted] = useState(false);
  const [pujaList, setPujaList] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(1);
  const [ashramAddress, setAshramAddress] = useState('Shri Swami Astrology, Shop No. 14, Matoshri Apartment, Gaykhe Colony, Nashik Road, Nashik.');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    timeSlot: '10:00 AM',
    bookingType: 'online',
    location: '',
    address: '',
    gotra: '',
    rashi: '',
    nakshatra: '',
    sankalp: '',
  });
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const recaptchaRef = useRef(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  useEffect(() => {
    if (!form.date) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    getAvailabilitySlots('puja', form.date)
      .then(res => {
        if (res?.slots && res.slots.length > 0) {
          setAvailableSlots(res.slots);
          const firstOpen = res.slots.find(s => !s.is_full);
          if (firstOpen) {
            setForm(prev => ({ ...prev, timeSlot: firstOpen.time_window || firstOpen.start_time }));
          }
        } else {
          setAvailableSlots([]);
        }
      })
      .catch(() => {
        setAvailableSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [form.date]);

  useEffect(() => {
    setMounted(true);
    getGurujiProfile()
      .then(res => {
        if (res?.ashram_address) setAshramAddress(res.ashram_address);
      })
      .catch(() => {});
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

  const matchPuja = (list, title) => {
    if (!title || !list || list.length === 0) return null;
    const clean = (s) => (s || '').toLowerCase().replace(/pooja/g, 'puja').replace(/[^a-z0-9]/g, '');
    const target = clean(title);
    return list.find(s => {
      const sName = clean(s.name || s.title);
      return sName.includes(target) || target.includes(sName);
    });
  };

  useEffect(() => {
    let isMounted = true;
    getPujaServices()
      .then(res => {
        if (isMounted && res.puja_services && res.puja_services.length > 0) {
          setPujaList(res.puja_services);
          if (selectedPujaTitle) {
            const match = matchPuja(res.puja_services, selectedPujaTitle);
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

  useEffect(() => {
    if (!selectedPujaTitle || pujaList.length === 0) return;
    const match = matchPuja(pujaList, selectedPujaTitle);
    if (match) setSelectedServiceId(match.id);
  }, [selectedPujaTitle, pujaList]);

  if (!isOpen) return null;

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!form.name.trim() || !form.phone.trim() || !form.date) {
      showToast('कृपया नाव, फोन आणि तारीख प्रविष्ट करा (Please enter name, phone, and date)');
      return;
    }

    if (!captchaToken) {
      showToast('Please complete the CAPTCHA verification (कृपया कॅप्चा पूर्ण करा).');
      return;
    }

    setLoading(true);
    try {
      const email = form.email.trim() || null;
      const isOnline = paymentMode === 'online';
      const res = await bookPuja({
        service_id: selectedServiceId,
        customer_name: form.name.trim(),
        customer_email: email,
        customer_phone: form.phone.trim(),
        booking_date: form.date,
        time_slot: form.timeSlot,
        booking_type: form.bookingType || (isOnline ? 'online' : 'whatsapp'),
        payment_mode: isOnline ? 'online' : 'whatsapp',
        payment_method: isOnline ? 'Razorpay' : 'WhatsApp Booking',
        location: form.location.trim() || null,
        address: form.address.trim() || null,
        gotra: form.gotra.trim() || null,
        nakshatra: form.nakshatra.trim() || null,
        rashi: form.rashi.trim() || null,
        sankalp_text: form.sankalp.trim() || null,
        recaptcha_token: captchaToken,
      });

      if (!res || !res.booking_number) {
        throw new Error(res?.error || 'Booking submission failed. Please try again.');
      }

      // Build complete WhatsApp message with all filled details
      const bookingRef = res.booking_number;
      const svcName = selectedService?.name || selectedService?.title || 'शास्त्रोक्त पूजा सेवा';
      const modeText = form.bookingType === 'offline' ? 'At Home / Ashram (प्रत्यक्ष)' : 'Online Live Sankalp (व्हिडिओद्वारे)';

      let msg = `🕉️ *नवीन पूजा नोंदणी / NEW PUJA SEVA BOOKING*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📌 *Booking Ref:* ${bookingRef}\n`;
      msg += `🪔 *Puja Seva:* ${svcName}\n`;
      msg += `👤 *Yajman Name:* ${form.name.trim()}\n`;
      msg += `📞 *Mobile / WhatsApp:* ${form.phone.trim()}\n`;
      if (form.email.trim()) {
        msg += `✉️ *Email:* ${form.email.trim()}\n`;
      }
      msg += `📅 *Preferred Date:* ${form.date}\n`;
      msg += `🕒 *Time Slot:* ${form.timeSlot}\n`;
      msg += `🚩 *Puja Mode:* ${modeText}\n`;
      if (form.location.trim()) {
        msg += `📍 *Location / City:* ${form.location.trim()}\n`;
      }
      if (form.address.trim()) {
        msg += `🏛️ *Address:* ${form.address.trim()}\n`;
      }
      if (form.gotra.trim()) {
        msg += `🌿 *Gotra:* ${form.gotra.trim()}\n`;
      }
      if (form.rashi.trim()) {
        msg += `⭐ *Rashi:* ${form.rashi.trim()}\n`;
      }
      if (form.nakshatra.trim()) {
        msg += `✨ *Nakshatra:* ${form.nakshatra.trim()}\n`;
      }
      if (form.sankalp.trim()) {
        msg += `🙏 *Sankalp Purpose:* ${form.sankalp.trim()}\n`;
      }
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🙏 *कृपया पूजा पुष्टी व संकल्प संदर्भात मार्गदर्शन करावे.*`;

      const waUrl = `https://wa.me/919623117545?text=${encodeURIComponent(msg)}`;

      if (isOnline && res.razorpay) {
        const isLoaded = await loadRazorpayScript();
        if (isLoaded && window.Razorpay) {
          const rzp = new window.Razorpay({
            key: res.razorpay.key_id,
            amount: res.razorpay.amount,
            currency: res.razorpay.currency || 'INR',
            name: 'Swami Guruji Vedic Seva',
            description: `Puja Seva Booking ${res.booking_number}`,
            order_id: res.razorpay.order_id,
            prefill: {
              name: form.name.trim(),
              email: form.email.trim() || '',
              contact: form.phone.trim(),
            },
            theme: { color: '#d97706' },
            handler: async function (response) {
              try {
                const verifyRes = await verifyPayment({
                  booking_number: res.booking_number,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                setConfirmedBooking({
                  ...res,
                  status: 'confirmed',
                  transaction_number: verifyRes.transaction_number,
                  whatsapp_url: waUrl,
                  service_name: svcName,
                  yajman_name: form.name.trim(),
                  date: form.date,
                  time_slot: form.timeSlot,
                });
                showToast(`✓ Payment Confirmed: ${res.booking_number}`);
              } catch (vErr) {
                console.warn('Payment verification issue:', vErr);
                showToast('Payment verified. Recording booking.');
              }
            },
            modal: {
              ondismiss: function () {
                showToast('Payment pending: You can pay offline or retry.');
              }
            }
          });
          rzp.open();
        }
      } else {
        if (typeof window !== 'undefined') {
          window.open(waUrl, '_blank');
        }
      }

      setConfirmedBooking({
        ...res,
        whatsapp_url: waUrl,
        service_name: svcName,
        yajman_name: form.name.trim(),
        date: form.date,
        time_slot: form.timeSlot,
      });
      showToast(`Puja Booking Submitted: ${res.booking_number}`);
    } catch (err) {
      recaptchaRef.current?.reset();
      setCaptchaToken('');
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
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(37, 211, 102, 0.15)',
                border: '1px solid rgba(37, 211, 102, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 16px',
                boxShadow: '0 0 20px rgba(37, 211, 102, 0.25)',
              }}
            >
              🕉️
            </div>
            <span className="kicker" style={{ color: 'var(--gold-lt)' }}>शास्त्रोक्त संकल्प नोंदणी</span>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--cream)', margin: '6px 0 10px' }}>
              PUJA REQUEST RECEIVED!
            </h3>
            <p style={{ color: '#e8dbca', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
              तुमची पूजा यशस्वीरित्या नोंदवली गेली आहे. खालील WhatsApp बटणावर क्लिक करून थेट अधिकृत क्रमांकावर पूजा तपशील पाठवा.
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(224, 176, 74, 0.2)',
                borderRadius: '12px',
                padding: '16px 20px',
                maxWidth: '440px',
                margin: '0 auto 20px',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Booking Reference:</span>
                <strong style={{ color: 'var(--gold-lt)' }}>{confirmedBooking.booking_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Puja Seva:</span>
                <strong style={{ color: 'var(--cream)', textAlign: 'right' }}>{confirmedBooking.service_name || selectedService?.name || 'Puja'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Yajman Name:</span>
                <strong style={{ color: 'var(--cream)' }}>{confirmedBooking.yajman_name || form.name.trim()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Ceremony Date &amp; Time:</span>
                <strong style={{ color: 'var(--cream)' }}>{form.date} ({form.timeSlot})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Booking Mode:</span>
                <span style={{ color: '#25D366', fontWeight: '700' }}>
                  💬 WhatsApp Mode
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Status:</span>
                <span style={{ color: '#f59e0b', textTransform: 'capitalize', fontWeight: '700' }}>
                  Pending Confirmation
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '440px', margin: '0 auto' }}>
              <a
                href={confirmedBooking.whatsapp_url || `https://wa.me/919623117545`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  padding: '14px 24px',
                  borderRadius: '99px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '15px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(37, 211, 102, 0.35)',
                  cursor: 'pointer',
                }}
              >
                💬 Open WhatsApp · WhatsApp वर पाठवा
              </a>

              <button
                className="btn btn-gold"
                onClick={onClose}
                style={{ width: '100%', padding: '12px 24px', borderRadius: '99px' }}
              >
                Done / पूर्ण झाले
              </button>
            </div>
          </div>) : (
          <div>
            <span className="kicker">Traditional Vedic Sankalp</span>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: '22px', color: 'var(--cream)', margin: '4px 0 14px' }}>
              Book Puja Seva · शास्त्रोक्त पूजा नोंदणी
            </h3>

            {selectedService && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(224, 176, 74, 0.08), rgba(255, 140, 43, 0.04))',
                  border: '1px solid rgba(224, 176, 74, 0.28)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {selectedService.image_url && (
                      <img
                        src={selectedService.image_url}
                        alt={selectedService.name || selectedService.title}
                        style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(224, 176, 74, 0.4)', flexShrink: 0 }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--gold-lt)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, display: 'block' }}>
                        {selectedService.deity ? `🪔 ${selectedService.deity}` : 'शास्त्रोक्त वैदिक विधी'}
                      </span>
                      <h4 style={{ margin: '3px 0 4px', fontSize: '18px', color: 'var(--cream)', fontFamily: 'var(--serif)', fontWeight: 700 }}>
                        {selectedService.name || selectedService.title}
                      </h4>
                    </div>
                  </div>

                </div>

                {(selectedService.description || selectedService.desc) && (
                  <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.5, color: '#e8dbca' }}>
                    {selectedService.description || selectedService.desc}
                  </p>
                )}

                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(224, 176, 74, 0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    fontSize: '12px',
                  }}
                >
                  {/* <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--gold-lt)', fontWeight: 600 }}>📍 Location:</span>
                    <span style={{ color: 'var(--cream)' }}>
                      {selectedService.location || 'Nashik, Maharashtra'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: 'var(--gold-lt)', fontWeight: 600, whiteSpace: 'nowrap' }}>🏛️ Address:</span>
                    <span style={{ color: '#e8dbca', lineHeight: 1.4 }}>
                      {selectedService.address || ashramAddress}
                    </span>
                  </div> */}
                </div>
              </div>
            )}

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
                        {s.name} {s.deity ? `(${s.deity})` : ''}
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
                  <label htmlFor="puj-slot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Time Slot · वेळ</span>
                    {loadingSlots && <span style={{ fontSize: '11px', color: 'var(--gold-lt)' }}>लोड होत आहे...</span>}
                  </label>
                  <select
                    id="puj-slot"
                    name="timeSlot"
                    value={form.timeSlot}
                    onChange={handleFieldChange}
                  >
                    {availableSlots.length > 0 ? (
                      availableSlots.map(s => (
                        <option
                          key={s.id}
                          value={s.time_window || s.start_time}
                          disabled={s.is_full}
                        >
                          {s.time_window || s.start_time} — {s.is_full ? '❌ Full (पूर्ण)' : `✓ ${s.assigned_priest_or_astrologer || 'Pandit Ji'} (${s.available_spots} जागा उपलब्ध)`}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="08:00 AM">08:00 AM (प्रातःकाल - Morning)</option>
                        <option value="10:00 AM">10:00 AM (सकाळ - Shubha Muhurta)</option>
                        <option value="11:30 AM">11:30 AM (माध्यान्ह - Midday)</option>
                        <option value="04:00 PM">04:00 PM (सायंकाल - Evening Sandhya)</option>
                      </>
                    )}
                  </select>
                  {availableSlots.length > 0 ? (
                    <span style={{ fontSize: '11px', color: '#10b981', display: 'block', marginTop: '4px' }}>
                      ⚡ {availableSlots.length} विशेष पूजा मुहूर्त वेळ उपलब्ध (Admin Calendar)
                    </span>
                  ) : form.date ? (
                    <span style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginTop: '4px' }}>
                      मानक वैदिक मुहूर्त वेळ (Standard Vedic Timings)
                    </span>
                  ) : null}
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
                  <label htmlFor="puj-location">Location · स्थान / शहर</label>
                  <input
                    type="text"
                    id="puj-location"
                    name="location"
                    placeholder="e.g. Pune, Nashik, Mumbai"
                    value={form.location}
                    onChange={handleFieldChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="puj-address">Address · पत्ता</label>
                  <input
                    type="text"
                    id="puj-address"
                    name="address"
                    placeholder="e.g. Flat No, Society, Area / Ashram"
                    value={form.address}
                    onChange={handleFieldChange}
                  />
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

                <div className="field">
                  <label htmlFor="puj-nakshatra">Nakshatra · नक्षत्र (Optional)</label>
                  <input
                    type="text"
                    id="puj-nakshatra"
                    name="nakshatra"
                    placeholder="e.g. Rohini, Ashwini"
                    value={form.nakshatra}
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

              {/* Google reCAPTCHA v2 Checkbox */}
              <ReCaptcha
                id="recaptcha-puja"
                ref={recaptchaRef}
                onChange={setCaptchaToken}
                onExpired={() => setCaptchaToken('')}
                onError={() => setCaptchaToken('')}
              />

              <div style={{ marginTop: '16px' }}>
                <button
                  type="submit"
                  className="btn"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    borderRadius: '99px',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(37, 211, 102, 0.35)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loading ? 'पूजा नोंदणी पाठवत आहे...' : '💬 Book via WhatsApp · पूजा नोंदणी WhatsApp वर पाठवा →'}
                </button>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textAlign: 'center', marginTop: '8px' }}>
                  🔒 तुमची माहिती सुरक्षित राहील व थेट अधिकृत WhatsApp वर पाठवली जाईल
                </span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
