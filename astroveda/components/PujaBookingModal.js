'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/context/StoreContext';
import { getPujaServices, bookPuja, verifyPayment, getGurujiProfile, getAvailabilitySlots } from '@/lib/api';
import OfflinePaymentBox from '@/components/OfflinePaymentBox';

export default function PujaBookingModal({ isOpen, onClose, selectedPujaTitle }) {
  const { showToast, paymentMode, offlineInstructions, offlineQrCode } = useStore();
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
    if (loading) return; // Prevent double-clicks / repeated submissions
    if (!form.name.trim() || !form.phone.trim() || !form.date) {
      showToast('कृपया नाव, फोन आणि तारीख प्रविष्ट करा (Please enter name, phone, and date)');
      return;
    }

    setLoading(true);
    try {
      const email = form.email.trim() || null;
      const res = await bookPuja({
        service_id: selectedServiceId,
        customer_name: form.name.trim(),
        customer_email: email,
        customer_phone: form.phone.trim(),
        booking_date: form.date,
        time_slot: form.timeSlot,
        booking_type: form.bookingType,
        payment_mode: paymentMode,
        payment_method: paymentMode === 'offline' ? 'Offline Payment' : 'Online Gateway',
        location: form.location.trim() || null,
        address: form.address.trim() || null,
        gotra: form.gotra.trim() || null,
        nakshatra: form.nakshatra.trim() || null,
        rashi: form.rashi.trim() || null,
        sankalp_text: form.sankalp.trim() || null,
      });

      if (!res || !res.booking_number) {
        throw new Error(res?.error || 'Booking submission failed. Please try again.');
      }

      if (paymentMode === 'online' && res.razorpay && typeof window !== 'undefined') {
        const isLoaded = await (async () => {
          if (window.Razorpay) return true;
          return new Promise(r => {
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.onload = () => r(true);
            s.onerror = () => r(false);
            document.body.appendChild(s);
          });
        })();

        if (isLoaded && window.Razorpay) {
          const rzpData = res.razorpay;
          const options = {
            key: rzpData.key_id,
            amount: rzpData.amount,
            currency: rzpData.currency || 'INR',
            name: 'AstroVeda Puja Seva',
            description: `${res.booking_number} (${form.name.trim()})`,
            order_id: rzpData.order_id,
            prefill: {
              name: form.name.trim(),
              email: email,
              contact: form.phone.trim(),
            },
            theme: { color: '#d97706' },
            handler: async (response) => {
              try {
                await verifyPayment({
                  booking_number: res.booking_number,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                setConfirmedBooking({ ...res, status: 'confirmed', amount_paid: rzpData.amount / 100 });
                showToast(`Puja Payment Verified & Confirmed: ${res.booking_number}`);
              } catch (e) {
                showToast('Payment verification failed. Please contact admin.');
              }
            },
            modal: {
              ondismiss: () => {
                showToast('Payment cancelled. Booking saved as pending.');
              }
            }
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      }

      setConfirmedBooking(res);
      showToast(res.status === 'pending' ? `Puja Booking Received: ${res.booking_number} (Offline Pending)` : `Puja Booking Confirmed: ${res.booking_number}`);
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
              {confirmedBooking.payment_mode === 'offline' || confirmedBooking.status === 'pending'
                ? 'Puja Request Received!'
                : 'Puja Booking Confirmed!'}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '13.5px', maxWidth: '440px', margin: '0 auto 20px' }}>
              {confirmedBooking.payment_mode === 'offline' || confirmedBooking.status === 'pending'
                ? 'तुमची पूजा यशस्वीरित्या नोंदवली गेली आहे. ऑफलाइन पेमेंट सत्यापनानंतर संकल्प विधी पुष्टी केली जाईल.'
                : 'तुमची पूजा यशस्वीरित्या नोंदवली गेली आहे. आमचे पुरोहित/समन्वयक संकल्प विधीसाठी तुमच्याशी संपर्क साधतील.'}
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(224, 176, 74, 0.2)',
                borderRadius: '10px',
                padding: '16px 20px',
                maxWidth: '420px',
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
                <span style={{ color: 'var(--muted)' }}>Dakshina Seva:</span>
                <strong style={{ color: 'var(--cream)' }}>₹{Number(confirmedBooking.amount_paid || selectedService?.price || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Payment Mode:</span>
                <span style={{ color: confirmedBooking.payment_mode === 'offline' ? '#f59e0b' : 'var(--gold-lt)', fontWeight: '700' }}>
                  {confirmedBooking.payment_mode === 'offline' ? 'Offline Mode' : 'Online Mode'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Status:</span>
                <span style={{ color: confirmedBooking.status === 'pending' ? '#f59e0b' : 'var(--gold-lt)', textTransform: 'capitalize', fontWeight: '700' }}>
                  {confirmedBooking.status === 'pending' ? 'Pending Confirmation' : confirmedBooking.status}
                </span>
              </div>
            </div>

            {(confirmedBooking.payment_mode === 'offline' || confirmedBooking.status === 'pending') && (
              <OfflinePaymentBox
                instructions={confirmedBooking.offline_payment_instructions || offlineInstructions}
                qrCodeUrl={confirmedBooking.offline_qr_code || offlineQrCode || '/phonepe-qr.jpg'}
                referenceNumber={confirmedBooking.booking_number}
                amount={confirmedBooking.dakshina_amount || confirmedBooking.amount || selectedService?.price}
                customerName={confirmedBooking.customer_name || confirmedBooking.devotee_name || form.name.trim()}
                whatsappUrl={`https://wa.me/919623117545?text=${encodeURIComponent(`Namaste! I have submitted a Puja Booking (${confirmedBooking.booking_number}) for ${selectedService?.name || 'Puja'}. Here is my offline payment confirmation / screenshot:`)}`}
                whatsappButtonText="💬 Share Puja Dakshina on WhatsApp"
                title="Offline Dakshina Payment / पूजा दक्षिणा पद्धत"
              />
            )}

            <button className="btn btn-gold" onClick={onClose} style={{ padding: '12px 30px', borderRadius: '99px' }}>
              Done / पूर्ण झाले
            </button>
          </div>
        ) : (
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
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Seva Dakshina</span>
                    <strong style={{ fontSize: '18px', color: 'var(--gold-lt)' }}>
                      ₹{Number(selectedService.price).toLocaleString('en-IN')}
                    </strong>
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
