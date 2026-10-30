'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore, loadRazorpayScript } from '@/context/StoreContext';
import { requestConsultation, getConsultations, getAvailabilitySlots, verifyPayment } from '@/lib/api';
import { JYOTISH_SERVICES, JANMA_KUNDALI_PACKAGES, DIWALI_OFFER, getServiceById } from '@/config/jyotishServices';
import OfflinePaymentBox from '@/components/OfflinePaymentBox';
import ReCaptcha from '@/components/ReCaptcha';

export default function JyotishSection({ sectionText }) {
  const kicker = sectionText?.kicker || 'Jyotish Consultation';
  const title = sectionText?.title || 'Kundali & Astrology';
  const subtitle = sectionText?.subtitle || 'Personalised Jyotish Guidance by Nagesh Swami Guruji';
  const waBtnText = sectionText?.wa_button_text || '📲 WhatsApp गुरुजी';
  const baseWaLink = sectionText?.wa_link || 'https://wa.me/919822000000';
  const formNote = sectionText?.form_note || '🔒 तुमची माहिती सुरक्षित आहे. Payment consultation confirm झाल्यावर.';

  const { showToast, paymentMode, offlineInstructions, offlineQrCode } = useStore();
  const [selectedServiceId, setSelectedServiceId] = useState('janma-kundali');
  const [selectedJanmaPackage, setSelectedJanmaPackage] = useState('hard-copy');
  const [loading, setLoading] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const recaptchaRef = useRef(null);

  // Common customer & booking state
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [commonData, setCommonData] = useState({
    name: '',
    phone: '',
    email: '',
    date: '',
    timeSlot: '10:00 AM',
    slotId: null,
    mode: 'Online · ऑनलाइन',
    notes: '',
  });

  useEffect(() => {
    if (!commonData.date) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    getAvailabilitySlots('jyotish', commonData.date)
      .then(res => {
        if (res?.slots && res.slots.length > 0) {
          setAvailableSlots(res.slots);
          const firstOpen = res.slots.find(s => !s.is_full);
          if (firstOpen) {
            setCommonData(prev => ({
              ...prev,
              timeSlot: firstOpen.time_window || firstOpen.start_time,
              slotId: firstOpen.id,
            }));
          }
        } else {
          setAvailableSlots([]);
          setCommonData(prev => ({ ...prev, slotId: null }));
        }
      })
      .catch(() => {
        setAvailableSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [commonData.date]);

  // Primary birth details (used by Services 1, 2, 4, 5 and optional in 6, 7, 8)
  const [birthData, setBirthData] = useState({
    dob: '',
    tob: '',
    timeUnknown: false,
    pob: '',
  });

  // Service 2: Kundali Analysis state
  const [analysisData, setAnalysisData] = useState({
    topic: 'General Life Guidance',
    topicOther: '',
    specificQuestion: '',
    additionalContext: '',
  });

  // Service 3: Marriage Kundali Matching state
  const [marriageData, setMarriageData] = useState({
    person1Name: '',
    person1Dob: '',
    person1Tob: '',
    person1TimeUnknown: false,
    person1Pob: '',

    person2Name: '',
    person2Dob: '',
    person2Tob: '',
    person2TimeUnknown: false,
    person2Pob: '',

    marriagePeriod: '',
    proposedWeddingDate: '',
    compatibilityQuestion: '',
  });

  // Service 4: Career & Business state
  const [careerData, setCareerData] = useState({
    category: 'Job / Career Guidance',
    categoryOther: '',
    currentProfession: '',
    businessNameType: '',
    mainChallenge: '',
    desiredGuidance: '',
  });

  // Service 5: Finance & Wealth state
  const [financeData, setFinanceData] = useState({
    topic: 'Savings and Investments',
    topicOther: '',
    financialGoal: '',
    mainQuestion: '',
  });

  // Service 6: Muhurat Selection state
  const [muhuratData, setMuhuratData] = useState({
    eventType: 'Wedding',
    eventTypeOther: '',
    startDate: '',
    endDate: '',
    flexibleDates: false,
    preferredTimeWindow: '',
    eventCity: '',
    hasBirthDetails: false,
    personName: '',
  });

  // Service 7: Gemstone & Rudraksha state
  const [gemstoneData, setGemstoneData] = useState({
    requestType: 'Gemstone (Ratna)',
    purpose: 'Career Growth',
    purposeOther: '',
    existingItems: '',
    specificQuestion: '',
    hasBirthDetails: false,
  });

  // Service 8: General Jyotish state
  const [generalData, setGeneralData] = useState({
    topic: 'General Jyotish Question',
    customerQuestion: '',
    hasBirthDetails: false,
  });

  const activeService = getServiceById(selectedServiceId);

  // Synchronize when switching services
  const handleSelectService = (id) => {
    setSelectedServiceId(id);
    setErrors({});
    const service = getServiceById(id);
    showToast(`Selected: ${service.title}`);
  };

// Pre-fill person 1 removed: participant names remain independent of contact person

  // Construct dynamic WhatsApp link
  const dynamicWaLink = (() => {
    const rawNumber = baseWaLink.replace(/[^0-9]/g, '') || '919822000000';
    const textMsg = encodeURIComponent(
      `नमस्ते गुरुजी, मला "${activeService.title}" संदर्भात ज्योतिष सल्लामसलत बुक करायची आहे.`
    );
    return `https://wa.me/${rawNumber}?text=${textMsg}`;
  })();

  // Validation function
  const validateForm = () => {
    const newErrors = {};

    // Common customer fields
    if (!commonData.name.trim()) {
      newErrors.name = selectedServiceId === 'marriage-matching'
        ? 'कृपया बुकिंग करणाऱ्या व्यक्तीचे पूर्ण नाव प्रविष्ट करा (Contact person full name is required)'
        : 'कृपया तुमचे पूर्ण नाव प्रविष्ट करा (Full name is required)';
    }
    const phoneClean = commonData.phone.replace(/[^0-9+]/g, '');
    if (!phoneClean || phoneClean.length < 8) {
      newErrors.phone = 'कृपया वैध मोबाईल / WhatsApp नंबर प्रविष्ट करा (Valid phone is required)';
    }
    if (commonData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(commonData.email.trim())) {
      newErrors.email = 'कृपया वैध ईमेल पत्ता प्रविष्ट करा (Valid email format required)';
    }

    // Service-specific validation
    switch (selectedServiceId) {
      case 'janma-kundali':
      case 'kundali-analysis':
      case 'career-business':
      case 'finance-wealth':
        if (!birthData.dob) {
          newErrors.dob = 'जन्मतारीख आवश्यक आहे (Date of birth is required)';
        }
        if (!birthData.pob.trim()) {
          newErrors.pob = 'जन्मस्थान (शहर, राज्य) आवश्यक आहे (Birth place is required)';
        }
        if (selectedServiceId === 'kundali-analysis') {
          if (analysisData.topic === 'Other' && !analysisData.topicOther.trim()) {
            newErrors.analysisTopicOther = 'कृपया विषय स्पष्ट करा (Please specify topic)';
          }
        }
        if (selectedServiceId === 'career-business') {
          if (careerData.category === 'Other' && !careerData.categoryOther.trim()) {
            newErrors.categoryOther = 'कृपया वर्गवारी स्पष्ट करा (Please specify category)';
          }
        }
        if (selectedServiceId === 'finance-wealth') {
          if (financeData.topic === 'Other' && !financeData.topicOther.trim()) {
            newErrors.financialTopicOther = 'कृपया विषय स्पष्ट करा (Please specify topic)';
          }
        }
        break;

      case 'marriage-matching':
        if (!marriageData.person1Name.trim()) {
          newErrors.person1Name = 'वराचे / मुलाचे नाव आवश्यक आहे (Male / Groom name is required)';
        }
        if (!marriageData.person1Dob) {
          newErrors.person1Dob = 'वराची / मुलाची जन्मतारीख आवश्यक आहे (Male / Groom DOB is required)';
        }
        if (!marriageData.person1Pob.trim()) {
          newErrors.person1Pob = 'वराचे / मुलाचे जन्मस्थान आवश्यक आहे (Male / Groom POB is required)';
        }

        if (!marriageData.person2Name.trim()) {
          newErrors.person2Name = 'वधूचे / मुलीचे नाव आवश्यक आहे (Female / Bride name is required)';
        }
        if (!marriageData.person2Dob) {
          newErrors.person2Dob = 'वधूची / मुलीची जन्मतारीख आवश्यक आहे (Female / Bride DOB is required)';
        }
        if (!marriageData.person2Pob.trim()) {
          newErrors.person2Pob = 'वधूचे / मुलीचे जन्मस्थान आवश्यक आहे (Female / Bride POB is required)';
        }
        break;

      case 'muhurat-selection':
        if (muhuratData.eventType === 'Other' && !muhuratData.eventTypeOther.trim()) {
          newErrors.eventTypeOther = 'कृपया कार्यक्रमाचा प्रकार प्रविष्ट करा (Please specify event)';
        }
        if (!muhuratData.startDate) {
          newErrors.muhuratStartDate = 'अपेक्षित तारीख आवश्यक आहे (Preferred start date is required)';
        }
        if (!muhuratData.flexibleDates && !muhuratData.endDate) {
          newErrors.muhuratEndDate = 'तारीख मर्यादा आवश्यक आहे (End date is required when not flexible)';
        }
        if (!muhuratData.eventCity.trim()) {
          newErrors.eventCity = 'कार्यक्रमाचे शहर / स्थान आवश्यक आहे (Event location is required)';
        }
        if (muhuratData.hasBirthDetails) {
          if (!birthData.dob) {
            newErrors.dob = 'जन्मतारीख आवश्यक आहे (Date of birth is required)';
          }
          if (!birthData.pob.trim()) {
            newErrors.pob = 'जन्मस्थान आवश्यक आहे (Birth place is required)';
          }
        }
        break;

      case 'gemstone-rudraksha':
        if (gemstoneData.purpose === 'Other' && !gemstoneData.purposeOther.trim()) {
          newErrors.purposeOther = 'कृपया उद्देश स्पष्ट करा (Please specify purpose)';
        }
        if (gemstoneData.hasBirthDetails) {
          if (!birthData.dob) {
            newErrors.dob = 'जन्मतारीख आवश्यक आहे (Date of birth is required)';
          }
          if (!birthData.pob.trim()) {
            newErrors.pob = 'जन्मस्थान आवश्यक आहे (Birth place is required)';
          }
        }
        break;

      case 'general-jyotish':
        if (!generalData.customerQuestion.trim()) {
          newErrors.customerQuestion = 'कृपया तुमचा मुख्य प्रश्न प्रविष्ट करा (Your question is required)';
        }
        if (generalData.hasBirthDetails) {
          if (!birthData.dob) {
            newErrors.dob = 'जन्मतारीख आवश्यक आहे (Date of birth is required)';
          }
          if (!birthData.pob.trim()) {
            newErrors.pob = 'जन्मस्थान आवश्यक आहे (Birth place is required)';
          }
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0];
      const el = document.querySelector(`[data-error-key="${firstKey}"]`) || document.getElementById(`f-${firstKey}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('कृपया आवश्यक माहिती तपासा (Please review highlighted fields)');
      return;
    }


    if (!captchaToken) {
      showToast('Please complete the CAPTCHA verification (कृपया कॅप्चा पूर्ण करा).');
      return;
    }
    setLoading(true);

    try {
      const email = commonData.email.trim() || `${commonData.phone.replace(/[^\w]/g, '')}@swamiguruji.in`;

      // Build service-specific payload
      const currentPayablePrice = selectedServiceId === 'janma-kundali'
        ? (selectedJanmaPackage === 'soft-copy' ? 101 : 1001)
        : 101;

      const payload = {
        service_id: selectedServiceId,
        topic: activeService.title,
        customer_name: commonData.name.trim(),
        customer_phone: commonData.phone.trim(),
        customer_email: email,
        preferred_date: commonData.date || null,
        time_slot: commonData.timeSlot || '10:00 AM',
        slot_id: commonData.slotId || null,
        consultation_type: commonData.mode.toLowerCase().includes('online') ? 'online_video' : 'in_person',
        notes: commonData.notes.trim() || null,
        amount: currentPayablePrice,
      };

      if (selectedServiceId === 'janma-kundali') {
        payload.package_type = selectedJanmaPackage;
        payload.package_name = selectedJanmaPackage === 'soft-copy'
          ? 'Soft Copy — Digital Kundali report'
          : 'Hard Copy — Printed Kundali with consultation';
      }

      // Add service-specific data
      if (selectedServiceId === 'marriage-matching') {
        payload.person1 = {
          name: marriageData.person1Name.trim(),
          dob: marriageData.person1Dob,
          tob: marriageData.person1TimeUnknown ? 'Time Unknown' : (marriageData.person1Tob || '10:00 AM'),
          time_unknown: marriageData.person1TimeUnknown,
          pob: marriageData.person1Pob.trim(),
        };
        payload.person2 = {
          name: marriageData.person2Name.trim(),
          dob: marriageData.person2Dob,
          tob: marriageData.person2TimeUnknown ? 'Time Unknown' : (marriageData.person2Tob || '10:00 AM'),
          time_unknown: marriageData.person2TimeUnknown,
          pob: marriageData.person2Pob.trim(),
        };
        payload.marriage_period = marriageData.marriagePeriod.trim() || null;
        payload.proposed_wedding_date = marriageData.proposedWeddingDate || null;
        payload.compatibility_question = marriageData.compatibilityQuestion.trim() || null;
        payload.dob = marriageData.person1Dob;
        payload.pob = marriageData.person1Pob.trim();
        payload.tob = marriageData.person1TimeUnknown ? 'Time Unknown' : (marriageData.person1Tob || '10:00 AM');
      } else if (selectedServiceId === 'muhurat-selection') {
        payload.event_type = muhuratData.eventType === 'Other' ? muhuratData.eventTypeOther : muhuratData.eventType;
        payload.event_start_date = muhuratData.startDate;
        payload.event_end_date = muhuratData.flexibleDates ? null : muhuratData.endDate;
        payload.flexible_dates = muhuratData.flexibleDates;
        payload.preferred_time_window = muhuratData.preferredTimeWindow.trim() || null;
        payload.event_city = muhuratData.eventCity.trim();
        payload.has_birth_details = muhuratData.hasBirthDetails;
        if (muhuratData.hasBirthDetails) {
          payload.person_name = muhuratData.personName.trim() || commonData.name.trim();
          payload.dob = birthData.dob;
          payload.tob = birthData.timeUnknown ? 'Time Unknown' : (birthData.tob || '10:00 AM');
          payload.pob = birthData.pob.trim();
          payload.time_unknown = birthData.timeUnknown;
        } else {
          payload.dob = muhuratData.startDate;
          payload.pob = muhuratData.eventCity.trim();
          payload.tob = 'N/A (Event Based)';
        }
      } else if (selectedServiceId === 'career-business') {
        payload.guidance_category = careerData.category === 'Other' ? careerData.categoryOther : careerData.category;
        payload.current_profession = careerData.currentProfession.trim() || null;
        payload.business_name_type = careerData.businessNameType.trim() || null;
        payload.main_challenge = careerData.mainChallenge.trim() || null;
        payload.dob = birthData.dob;
        payload.tob = birthData.timeUnknown ? 'Time Unknown' : (birthData.tob || '10:00 AM');
        payload.pob = birthData.pob.trim();
        payload.time_unknown = birthData.timeUnknown;
      } else if (selectedServiceId === 'finance-wealth') {
        payload.financial_topic = financeData.topic === 'Other' ? financeData.topicOther : financeData.topic;
        payload.financial_goal = financeData.financialGoal.trim() || null;
        payload.main_question = financeData.mainQuestion.trim() || null;
        payload.dob = birthData.dob;
        payload.tob = birthData.timeUnknown ? 'Time Unknown' : (birthData.tob || '10:00 AM');
        payload.pob = birthData.pob.trim();
        payload.time_unknown = birthData.timeUnknown;
      } else if (selectedServiceId === 'gemstone-rudraksha') {
        payload.request_type = gemstoneData.requestType;
        payload.recommendation_purpose = gemstoneData.purpose === 'Other' ? gemstoneData.purposeOther : gemstoneData.purpose;
        payload.existing_items = gemstoneData.existingItems.trim() || null;
        payload.specific_question = gemstoneData.specificQuestion.trim() || null;
        payload.has_birth_details = gemstoneData.hasBirthDetails;
        if (gemstoneData.hasBirthDetails) {
          payload.dob = birthData.dob;
          payload.tob = birthData.timeUnknown ? 'Time Unknown' : (birthData.tob || '10:00 AM');
          payload.pob = birthData.pob.trim();
          payload.time_unknown = birthData.timeUnknown;
        }
      } else if (selectedServiceId === 'general-jyotish') {
        payload.consultation_topic = generalData.topic;
        payload.customer_question = generalData.customerQuestion.trim();
        payload.has_birth_details = generalData.hasBirthDetails;
        if (generalData.hasBirthDetails) {
          payload.dob = birthData.dob;
          payload.tob = birthData.timeUnknown ? 'Time Unknown' : (birthData.tob || '10:00 AM');
          payload.pob = birthData.pob.trim();
          payload.time_unknown = birthData.timeUnknown;
        }
      } else {
        // Janma Kundali & Kundali Analysis
        payload.dob = birthData.dob;
        payload.tob = birthData.timeUnknown ? 'Time Unknown' : (birthData.tob || '10:00 AM');
        payload.pob = birthData.pob.trim();
        payload.time_unknown = birthData.timeUnknown;
        if (selectedServiceId === 'kundali-analysis') {
          payload.analysis_topic = analysisData.topic === 'Other' ? analysisData.topicOther : analysisData.topic;
          payload.specific_question = analysisData.specificQuestion.trim() || null;
          payload.additional_context = analysisData.additionalContext.trim() || null;
        }
      }

      payload.payment_mode = paymentMode;
      payload.recaptcha_token = captchaToken;
      payload.payment_method = paymentMode === 'offline' ? 'Offline Payment' : 'Online Video Consultation';

      const res = await requestConsultation(payload);

      if (paymentMode === 'online' && res.razorpay) {
        const isLoaded = await loadRazorpayScript();
        if (isLoaded && window.Razorpay) {
          const rzp = new window.Razorpay({
            key: res.razorpay.key_id,
            amount: res.razorpay.amount,
            currency: res.razorpay.currency || 'INR',
            name: 'Swami Guruji Jyotish Seva',
            description: `Consultation ${res.consultation_number} (${activeService.title})`,
            order_id: res.razorpay.order_id,
            prefill: {
              name: commonData.name.trim(),
              email: commonData.email.trim() || '',
              contact: commonData.phone.trim(),
            },
            theme: { color: '#d97706' },
            handler: async function (response) {
              try {
                const verifyRes = await verifyPayment({
                  consultation_number: res.consultation_number,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                setConfirmedBooking(prev => ({
                  ...prev,
                  status: 'confirmed',
                  transaction_number: verifyRes.transaction_number,
                }));
                showToast(`✓ Consultation Payment Verified: ${res.consultation_number}`);
              } catch (vErr) {
                console.warn('Payment verification issue:', vErr);
              }
            },
            modal: {
              ondismiss: function () {
                showToast('Payment window closed. Consultation registered.');
              }
            }
          });
          rzp.open();
        }
      }

      setConfirmedBooking({
        number: res.consultation_number,
        serviceId: selectedServiceId,
        serviceTitle: activeService.title,
        packageType: selectedServiceId === 'janma-kundali' ? selectedJanmaPackage : null,
        packageName: selectedServiceId === 'janma-kundali'
          ? (selectedJanmaPackage === 'soft-copy' ? 'Soft Copy — Digital Kundali report' : 'Hard Copy — Printed Kundali with consultation')
          : null,
        customerName: commonData.name.trim(),
        person1Name: selectedServiceId === 'marriage-matching' ? marriageData.person1Name.trim() : null,
        person2Name: selectedServiceId === 'marriage-matching' ? marriageData.person2Name.trim() : null,
        paymentMode: res.payment_mode || paymentMode,
        status: res.status,
        offlineInstructions: res.offline_payment_instructions || offlineInstructions,
        offlineQrCode: res.offline_qr_code || offlineQrCode || '/phonepe-qr.jpg',
        fee: res.fee || res.amount_paid || currentPayablePrice,
      });

      showToast(res.status === 'pending' && (res.payment_mode === 'offline' || paymentMode === 'offline')
        ? `✓ Consultation नोंदणी प्राप्त: ${res.consultation_number} (Offline Pending)`
        : `✓ Consultation नोंदणी यशस्वी: ${res.consultation_number}`
      );
    } catch (err) {
      recaptchaRef.current?.reset();
      setCaptchaToken('');
      showToast(err.message || 'त्रुटी आली, कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfirmedBooking(null);
    setErrors({});
    recaptchaRef.current?.reset();
    setCaptchaToken('');
  };

  return (
    <section id="jyotish" className="jyotish-section-container">
      <div className="wrap">
        <div className="jyotish-wrap">
          {/* LEFT COLUMN: Service Selection, Title & WhatsApp Action */}
          <div className="jyotish-info reveal">
            <span className="kicker">{kicker}</span>
            <h2>
              {title === 'Kundali & Astrology' ? (
                <>Kundali &amp; <em>Astrology</em></>
              ) : (
                title
              )}
            </h2>
            <p>{subtitle}</p>

            {/* 8 Selectable Consultation Service Buttons */}
            <div className="jyotish-tags" role="group" aria-label="Jyotish consultation services selection">
              {JYOTISH_SERVICES.map((svc) => {
                const isActive = selectedServiceId === svc.id;
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => handleSelectService(svc.id)}
                    className={`jyotish-tag-btn ${isActive ? 'active' : ''}`}
                    aria-pressed={isActive}
                    title={`Select ${svc.title}`}
                  >
                    {svc.title}
                  </button>
                );
              })}
            </div>

            <div className="jyotish-wa-wrap">
              <a
                href={dynamicWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost jyotish-wa-btn"
                aria-label={`Inquire about ${activeService.title} via WhatsApp`}
              >
                {waBtnText}
              </a>
            </div>

            {/* Guruji Consultation Visual Card with 3D Hover & Animation */}
            <div className="jyotish-visual-container">
              <div className="jyotish-3d-card" title="Nagesh Swami Guruji - The Astrology Desk">
                <div className="jyotish-card-glare" aria-hidden="true" />
                <div className="jyotish-img-frame">
                  <img
                    src="/guruji-consultation.jpg"
                    alt="Nagesh Swami Guruji at The Astrology Desk"
                    className="jyotish-desk-img"
                    loading="lazy"
                  />
                  {/* <div className="jyotish-img-overlay">
                    <span className="jyotish-badge-tag">✦ The Astrology Desk</span>
                    <span className="jyotish-badge-sub">प्रत्यक्ष कुंडली व ज्योतिष मार्गदर्शन</span>
                  </div> */}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Dynamic Booking Card */}
          <div className="form-card-container reveal">
            <form className="form-card jyotish-form-card" onSubmit={handleSubmit} noValidate ref={formRef}>
              <div className="form-card-header">
                <h3>{activeService.title}</h3>
                <p className="form-sub">{activeService.tagline}</p>
              </div>

              {/* Success Confirmation State */}
              {confirmedBooking && (
                <div className="jyotish-success-card" role="alert" aria-live="polite">
                  <div className="success-icon">✓</div>
                  <h4>
                    {confirmedBooking.paymentMode === 'offline'
                      ? 'Consultation विनंती प्राप्त!'
                      : 'Consultation नोंदणी यशस्वी!'}
                  </h4>
                  <p>
                    {confirmedBooking.serviceId === 'marriage-matching' ? (
                      <>
                        आदरणीय <strong>{confirmedBooking.customerName}</strong> (Contact Person), <strong>{confirmedBooking.serviceTitle}</strong> साठी नोंदणी झाली आहे.
                        {confirmedBooking.person1Name && confirmedBooking.person2Name && (
                          <span style={{ display: 'block', fontSize: '13px', color: 'var(--gold-lt)', marginTop: '4px' }}>
                            (वर / Groom: <strong>{confirmedBooking.person1Name}</strong> · वधू / Bride: <strong>{confirmedBooking.person2Name}</strong>)
                          </span>
                        )}
                      </>
                    ) : confirmedBooking.serviceId === 'janma-kundali' && confirmedBooking.packageName ? (
                      <>
                        आदरणीय <strong>{confirmedBooking.customerName}</strong>, तुमची <strong>{confirmedBooking.serviceTitle}</strong> ({confirmedBooking.packageName}) साठी नोंदणी झाली आहे.
                      </>
                    ) : (
                      <>
                        आदरणीय <strong>{confirmedBooking.customerName}</strong>, तुमची <strong>{confirmedBooking.serviceTitle}</strong> साठी नोंदणी झाली आहे.
                      </>
                    )}
                  </p>
                  <div className="reference-badge">
                    <span>Reference Number:</span>
                    <strong>{confirmedBooking.number}</strong>
                  </div>

                  {confirmedBooking.paymentMode === 'offline' && (
                    <OfflinePaymentBox
                      instructions={confirmedBooking.offlineInstructions}
                      qrCodeUrl={confirmedBooking.offlineQrCode || '/phonepe-qr.jpg'}
                      referenceNumber={confirmedBooking.number}
                      amount={confirmedBooking.fee}
                      customerName={confirmedBooking.customerName}
                      whatsappUrl={`https://wa.me/919623117545?text=${encodeURIComponent(
                        confirmedBooking.serviceId === 'marriage-matching'
                          ? `Namaste! I have submitted a Marriage Kundali Matching consultation (${confirmedBooking.number}). Contact Person: ${confirmedBooking.customerName}${confirmedBooking.person1Name ? `, Groom: ${confirmedBooking.person1Name}` : ''}${confirmedBooking.person2Name ? `, Bride: ${confirmedBooking.person2Name}` : ''} (Fee: ₹${confirmedBooking.fee || 101}). Here is my payment confirmation screenshot:`
                          : confirmedBooking.serviceId === 'janma-kundali'
                          ? `Namaste! I have submitted a Janma Kundali Preparation request (${confirmedBooking.number}) for ${confirmedBooking.packageName || 'Janma Kundali'} (Fee: ₹${confirmedBooking.fee || 1001}). Here is my payment confirmation screenshot:`
                          : `Namaste! I have submitted a Jyotish Consultation request (${confirmedBooking.number}) for ${confirmedBooking.serviceTitle} (Diwali Offer Fee: ₹${confirmedBooking.fee || 101}). Here is my payment confirmation screenshot:`
                      )}`}
                      whatsappButtonText="💬 Share Consultation Payment on WhatsApp"
                      title="Offline Dakshina Payment / दक्षिणा पद्धत"
                    />
                  )}

                  <p className="success-footer-note">
                    {confirmedBooking.paymentMode === 'offline'
                      ? 'आमचे समन्वयक २४ तासांत पेमेंट सत्यापन व वेळ निश्चित करण्यासाठी संपर्क करतील.'
                      : 'आम्ही २४ तासांत तुमच्याशी संपर्क करून वेळ निश्चित करू.'}
                  </p>
                  <button type="button" onClick={handleReset} className="btn btn-ghost reset-btn">
                    Book Another Consultation →
                  </button>
                </div>
              )}

              {!confirmedBooking && (
                <>
                  {/* Janma Kundali Preparation: Hard Copy vs Soft Copy Packages */}
                  {selectedServiceId === 'janma-kundali' && (
                    <div className="janma-packages-grid" role="radiogroup" aria-label="Janma Kundali Packages">
                      {JANMA_KUNDALI_PACKAGES.map((pkg) => {
                        const isSelected = selectedJanmaPackage === pkg.id;
                        return (
                          <div
                            key={pkg.id}
                            className={`janma-package-card ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => setSelectedJanmaPackage(pkg.id)}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                setSelectedJanmaPackage(pkg.id);
                              }
                            }}
                          >
                            <div className="janma-pkg-header">
                              <span className="janma-pkg-name">{pkg.name} — </span>
                              <span className="janma-pkg-price">₹{pkg.price.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="janma-pkg-sub">{pkg.subtitle}</div>
                            <ul className="janma-pkg-list">
                              {pkg.inclusions.map((item, idx) => (
                                <li key={idx}>
                                  <span className="check-icon" aria-hidden="true">✓</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Diwali Special Offer for the other 7 services */}
                  {selectedServiceId !== 'janma-kundali' && (
                    <div className="diwali-offer-card" role="region" aria-label="Diwali Special Offer">
                      <div className="diwali-offer-left">
                        <span className="diwali-diya-icon" role="img" aria-label="Diwali Diya">🪔</span>
                        <div>
                          <div className="diwali-offer-title">{DIWALI_OFFER.title}</div>
                          <div className="diwali-offer-sub">{DIWALI_OFFER.savingsText}</div>
                        </div>
                      </div>
                      <div className="diwali-offer-pricing">
                        <span className="diwali-old-price">₹{DIWALI_OFFER.originalPrice}</span>
                        <span className="diwali-new-price">₹{DIWALI_OFFER.discountedPrice}/-</span>
                      </div>
                    </div>
                  )}

                  <div className="form-grid">
                    {/* Common Customer Details */}
                    <div className="field full">
                      <label htmlFor="f-name">
                        {selectedServiceId === 'marriage-matching' ? "Contact Person’s Full Name / बुकिंग करणाऱ्या व्यक्तीचे नाव" : "Full Name · नाव"} <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        id="f-name"
                        name="contact_person_name"
                        autoComplete="name"
                        data-error-key="name"
                        placeholder={selectedServiceId === 'marriage-matching' ? "बुकिंग करणाऱ्या व्यक्तीचे पूर्ण नाव (Contact Person's Full Name)" : "तुमचे पूर्ण नाव (e.g. Rahul Sharma)"}
                        value={commonData.name}
                        onChange={(e) => {
                          setCommonData(prev => ({ ...prev, name: e.target.value }));
                          if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                        }}
                        className={errors.name ? 'has-error' : ''}
                        aria-invalid={!!errors.name}
                        required
                      />
                      {errors.name && <span className="field-error">{errors.name}</span>}
                    </div>

                    <div className="field">
                      <label htmlFor="f-phone">Mobile / WhatsApp <span className="req">*</span></label>
                      <input
                        type="tel"
                        id="f-phone"
                        data-error-key="phone"
                        placeholder="+91 98765 43210"
                        value={commonData.phone}
                        onChange={(e) => {
                          setCommonData(prev => ({ ...prev, phone: e.target.value }));
                          if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
                        }}
                        className={errors.phone ? 'has-error' : ''}
                        aria-invalid={!!errors.phone}
                        required
                      />
                      {errors.phone && <span className="field-error">{errors.phone}</span>}
                    </div>

                    <div className="field">
                      <label htmlFor="f-email">Email Address (Optional)</label>
                      <input
                        type="email"
                        id="f-email"
                        data-error-key="email"
                        placeholder="devotee@example.com"
                        value={commonData.email}
                        onChange={(e) => {
                          setCommonData(prev => ({ ...prev, email: e.target.value }));
                          if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                        }}
                        className={errors.email ? 'has-error' : ''}
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <span className="field-error">{errors.email}</span>}
                    </div>

                    {/* Synchronized Consultation Topic Dropdown */}
                    <div className="field full">
                      <label htmlFor="f-topic-sync">Consultation Service / Topic · सेवा निवडा <span className="req">*</span></label>
                      <select
                        id="f-topic-sync"
                        value={selectedServiceId}
                        onChange={(e) => handleSelectService(e.target.value)}
                        className="topic-select"
                      >
                        {JYOTISH_SERVICES.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ============================================================== */}
                    {/* SERVICE 1, 2, 4, 5: Standard Birth Information */}
                    {/* ============================================================== */}
                    {(selectedServiceId === 'janma-kundali' ||
                      selectedServiceId === 'kundali-analysis' ||
                      selectedServiceId === 'career-business' ||
                      selectedServiceId === 'finance-wealth') && (
                        <>
                          <div className="field">
                            <label htmlFor="f-dob">Date of Birth · जन्मतारीख <span className="req">*</span></label>
                            <input
                              type="date"
                              id="f-dob"
                              data-error-key="dob"
                              value={birthData.dob}
                              onChange={(e) => {
                                setBirthData(prev => ({ ...prev, dob: e.target.value }));
                                if (errors.dob) setErrors(prev => ({ ...prev, dob: undefined }));
                              }}
                              className={errors.dob ? 'has-error' : ''}
                              aria-invalid={!!errors.dob}
                              required
                            />
                            {errors.dob && <span className="field-error">{errors.dob}</span>}
                          </div>

                          <div className="field">
                            <label htmlFor="f-tob">Birth Time · जन्म वेळ</label>
                            <input
                              type="time"
                              id="f-tob"
                              value={birthData.tob}
                              disabled={birthData.timeUnknown}
                              onChange={(e) => setBirthData(prev => ({ ...prev, tob: e.target.value }))}
                              style={{ opacity: birthData.timeUnknown ? 0.5 : 1 }}
                            />
                            <label className="checkbox-sublabel">
                              <input
                                type="checkbox"
                                checked={birthData.timeUnknown}
                                onChange={(e) => setBirthData(prev => ({ ...prev, timeUnknown: e.target.checked, tob: e.target.checked ? '' : prev.tob }))}
                              />
                              <span>I don't know my exact birth time (वेळ माहित नाही)</span>
                            </label>
                          </div>

                          <div className="field full">
                            <label htmlFor="f-pob">Birth Place · जन्मस्थान (City, State, Country) <span className="req">*</span></label>
                            <input
                              type="text"
                              id="f-pob"
                              data-error-key="pob"
                              placeholder="e.g. Pune, Maharashtra, India"
                              value={birthData.pob}
                              onChange={(e) => {
                                setBirthData(prev => ({ ...prev, pob: e.target.value }));
                                if (errors.pob) setErrors(prev => ({ ...prev, pob: undefined }));
                              }}
                              className={errors.pob ? 'has-error' : ''}
                              aria-invalid={!!errors.pob}
                              required
                            />
                            {errors.pob && <span className="field-error">{errors.pob}</span>}
                          </div>
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* SERVICE 2: Kundali Analysis Specific Fields */}
                    {/* ============================================================== */}
                    {selectedServiceId === 'kundali-analysis' && (
                      <>
                        <div className="field full">
                          <label htmlFor="f-analysis-topic">Analysis Focus Topic · फलादेश विषय <span className="req">*</span></label>
                          <select
                            id="f-analysis-topic"
                            value={analysisData.topic}
                            onChange={(e) => setAnalysisData(prev => ({ ...prev, topic: e.target.value }))}
                          >
                            {activeService.topicOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        {analysisData.topic === 'Other' && (
                          <div className="field full">
                            <label htmlFor="f-analysis-other">Specify Analysis Topic · विषय स्पष्ट करा <span className="req">*</span></label>
                            <input
                              type="text"
                              id="f-analysis-other"
                              data-error-key="analysisTopicOther"
                              placeholder="Describe the area you need guidance on..."
                              value={analysisData.topicOther}
                              onChange={(e) => {
                                setAnalysisData(prev => ({ ...prev, topicOther: e.target.value }));
                                if (errors.analysisTopicOther) setErrors(prev => ({ ...prev, analysisTopicOther: undefined }));
                              }}
                              className={errors.analysisTopicOther ? 'has-error' : ''}
                            />
                            {errors.analysisTopicOther && <span className="field-error">{errors.analysisTopicOther}</span>}
                          </div>
                        )}

                        <div className="field full">
                          <label htmlFor="f-specific-q">Specific Question (Optional) · मुख्य प्रश्न</label>
                          <input
                            type="text"
                            id="f-specific-q"
                            placeholder="e.g. When will my promotion occur / Foreign travel prospects"
                            value={analysisData.specificQuestion}
                            onChange={(e) => setAnalysisData(prev => ({ ...prev, specificQuestion: e.target.value }))}
                          />
                        </div>
                      </>
                    )}

                    {/* ============================================================== */}
                    {/* SERVICE 3: Marriage Kundali Matching (Two Persons) */}
                    {/* ============================================================== */}
                    {selectedServiceId === 'marriage-matching' && (
                      <>
                        <div className="marriage-section-block full">
                          {/* Person 1 Box */}
                          <div className="person-box">
                            <h4 className="person-box-title">👦 Male / Groom Details (वर / मुलाचे तपशील)</h4>
                            <div className="field">
                              <label htmlFor="p1-name">Full Name · पूर्ण नाव <span className="req">*</span></label>
                              <input
                                type="text"
                                id="p1-name"
                                name="groom_name"
                                autoComplete="off"
                                data-error-key="person1Name"
                                placeholder="वराचे पूर्ण नाव (Groom's Full Name)"
                                value={marriageData.person1Name}
                                onChange={(e) => {
                                  setMarriageData(prev => ({ ...prev, person1Name: e.target.value }));
                                  if (errors.person1Name) setErrors(prev => ({ ...prev, person1Name: undefined }));
                                }}
                                className={errors.person1Name ? 'has-error' : ''}
                              />
                              {errors.person1Name && <span className="field-error">{errors.person1Name}</span>}
                            </div>

                            <div className="field">
                              <label htmlFor="p1-dob">Date of Birth <span className="req">*</span></label>
                              <input
                                type="date"
                                id="p1-dob"
                                data-error-key="person1Dob"
                                value={marriageData.person1Dob}
                                onChange={(e) => {
                                  setMarriageData(prev => ({ ...prev, person1Dob: e.target.value }));
                                  if (errors.person1Dob) setErrors(prev => ({ ...prev, person1Dob: undefined }));
                                }}
                                className={errors.person1Dob ? 'has-error' : ''}
                              />
                              {errors.person1Dob && <span className="field-error">{errors.person1Dob}</span>}
                            </div>

                            <div className="field">
                              <label htmlFor="p1-tob">Birth Time</label>
                              <input
                                type="time"
                                id="p1-tob"
                                value={marriageData.person1Tob}
                                disabled={marriageData.person1TimeUnknown}
                                onChange={(e) => setMarriageData(prev => ({ ...prev, person1Tob: e.target.value }))}
                                style={{ opacity: marriageData.person1TimeUnknown ? 0.5 : 1 }}
                              />
                              <label className="checkbox-sublabel">
                                <input
                                  type="checkbox"
                                  checked={marriageData.person1TimeUnknown}
                                  onChange={(e) => setMarriageData(prev => ({ ...prev, person1TimeUnknown: e.target.checked, person1Tob: e.target.checked ? '' : prev.person1Tob }))}
                                />
                                <span>Time Unknown</span>
                              </label>
                            </div>

                            <div className="field">
                              <label htmlFor="p1-pob">Place of Birth <span className="req">*</span></label>
                              <input
                                type="text"
                                id="p1-pob"
                                data-error-key="person1Pob"
                                placeholder="City, State, Country"
                                value={marriageData.person1Pob}
                                onChange={(e) => {
                                  setMarriageData(prev => ({ ...prev, person1Pob: e.target.value }));
                                  if (errors.person1Pob) setErrors(prev => ({ ...prev, person1Pob: undefined }));
                                }}
                                className={errors.person1Pob ? 'has-error' : ''}
                              />
                              {errors.person1Pob && <span className="field-error">{errors.person1Pob}</span>}
                            </div>
                          </div>

                          {/* Person 2 Box */}
                          <div className="person-box">
                            <h4 className="person-box-title">👧 Female / Bride Details (वधू / मुलीचे तपशील)</h4>
                            <div className="field">
                              <label htmlFor="p2-name">Full Name · पूर्ण नाव <span className="req">*</span></label>
                              <input
                                type="text"
                                id="p2-name"
                                name="bride_name"
                                autoComplete="off"
                                data-error-key="person2Name"
                                placeholder="वधूचे पूर्ण नाव (Bride's Full Name)"
                                value={marriageData.person2Name}
                                onChange={(e) => {
                                  setMarriageData(prev => ({ ...prev, person2Name: e.target.value }));
                                  if (errors.person2Name) setErrors(prev => ({ ...prev, person2Name: undefined }));
                                }}
                                className={errors.person2Name ? 'has-error' : ''}
                              />
                              {errors.person2Name && <span className="field-error">{errors.person2Name}</span>}
                            </div>

                            <div className="field">
                              <label htmlFor="p2-dob">Date of Birth <span className="req">*</span></label>
                              <input
                                type="date"
                                id="p2-dob"
                                data-error-key="person2Dob"
                                value={marriageData.person2Dob}
                                onChange={(e) => {
                                  setMarriageData(prev => ({ ...prev, person2Dob: e.target.value }));
                                  if (errors.person2Dob) setErrors(prev => ({ ...prev, person2Dob: undefined }));
                                }}
                                className={errors.person2Dob ? 'has-error' : ''}
                              />
                              {errors.person2Dob && <span className="field-error">{errors.person2Dob}</span>}
                            </div>

                            <div className="field">
                              <label htmlFor="p2-tob">Birth Time</label>
                              <input
                                type="time"
                                id="p2-tob"
                                value={marriageData.person2Tob}
                                disabled={marriageData.person2TimeUnknown}
                                onChange={(e) => setMarriageData(prev => ({ ...prev, person2Tob: e.target.value }))}
                                style={{ opacity: marriageData.person2TimeUnknown ? 0.5 : 1 }}
                              />
                              <label className="checkbox-sublabel">
                                <input
                                  type="checkbox"
                                  checked={marriageData.person2TimeUnknown}
                                  onChange={(e) => setMarriageData(prev => ({ ...prev, person2TimeUnknown: e.target.checked, person2Tob: e.target.checked ? '' : prev.person2Tob }))}
                                />
                                <span>Time Unknown</span>
                              </label>
                            </div>

                            <div className="field">
                              <label htmlFor="p2-pob">Place of Birth <span className="req">*</span></label>
                              <input
                                type="text"
                                id="p2-pob"
                                data-error-key="person2Pob"
                                placeholder="City, State, Country"
                                value={marriageData.person2Pob}
                                onChange={(e) => {
                                  setMarriageData(prev => ({ ...prev, person2Pob: e.target.value }));
                                  if (errors.person2Pob) setErrors(prev => ({ ...prev, person2Pob: undefined }));
                                }}
                                className={errors.person2Pob ? 'has-error' : ''}
                              />
                              {errors.person2Pob && <span className="field-error">{errors.person2Pob}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="field">
                          <label htmlFor="f-marriage-period">Preferred Marriage Period (Optional)</label>
                          <input
                            type="text"
                            id="f-marriage-period"
                            placeholder="e.g. Next 6 Months / Year 2026"
                            value={marriageData.marriagePeriod}
                            onChange={(e) => setMarriageData(prev => ({ ...prev, marriagePeriod: e.target.value }))}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor="f-wedding-date">Proposed Wedding Date (If planned)</label>
                          <input
                            type="date"
                            id="f-wedding-date"
                            value={marriageData.proposedWeddingDate}
                            onChange={(e) => setMarriageData(prev => ({ ...prev, proposedWeddingDate: e.target.value }))}
                          />
                        </div>

                        <div className="field full">
                          <label htmlFor="f-compat-q">Compatibility Question · विशेष प्रश्न</label>
                          <input
                            type="text"
                            id="f-compat-q"
                            placeholder="e.g. Mangal dosha severity, Nadi dosha, temperament compatibility"
                            value={marriageData.compatibilityQuestion}
                            onChange={(e) => setMarriageData(prev => ({ ...prev, compatibilityQuestion: e.target.value }))}
                          />
                        </div>
                      </>
                    )}

                    {/* ============================================================== */}
                    {/* SERVICE 4: Career & Business Guidance */}
                    {/* ============================================================== */}
                    {selectedServiceId === 'career-business' && (
                      <>
                        <div className="field full">
                          <label htmlFor="f-career-cat">Guidance Category · वर्गवारी <span className="req">*</span></label>
                          <select
                            id="f-career-cat"
                            value={careerData.category}
                            onChange={(e) => setCareerData(prev => ({ ...prev, category: e.target.value }))}
                          >
                            {activeService.categoryOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        {careerData.category === 'Other' && (
                          <div className="field full">
                            <label htmlFor="f-career-other">Specify Category · वर्गवारी स्पष्ट करा <span className="req">*</span></label>
                            <input
                              type="text"
                              id="f-career-other"
                              data-error-key="categoryOther"
                              placeholder="e.g. Competitive Exams / Career Sabbatical"
                              value={careerData.categoryOther}
                              onChange={(e) => {
                                setCareerData(prev => ({ ...prev, categoryOther: e.target.value }));
                                if (errors.categoryOther) setErrors(prev => ({ ...prev, categoryOther: undefined }));
                              }}
                              className={errors.categoryOther ? 'has-error' : ''}
                            />
                            {errors.categoryOther && <span className="field-error">{errors.categoryOther}</span>}
                          </div>
                        )}

                        {careerData.category.includes('Job') || careerData.category.includes('Career') ? (
                          <div className="field full">
                            <label htmlFor="f-current-prof">Current Profession / Designation (Optional)</label>
                            <input
                              type="text"
                              id="f-current-prof"
                              placeholder="e.g. Software Engineer / Banking Executive"
                              value={careerData.currentProfession}
                              onChange={(e) => setCareerData(prev => ({ ...prev, currentProfession: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <div className="field full">
                            <label htmlFor="f-business-name">Business Name or Type (Optional)</label>
                            <input
                              type="text"
                              id="f-business-name"
                              placeholder="e.g. Retail Trading / Manufacturing Startup"
                              value={careerData.businessNameType}
                              onChange={(e) => setCareerData(prev => ({ ...prev, businessNameType: e.target.value }))}
                            />
                          </div>
                        )}

                        <div className="field full">
                          <label htmlFor="f-career-chal">Main Career Challenge / Question · मुख्य प्रश्न</label>
                          <input
                            type="text"
                            id="f-career-chal"
                            placeholder="e.g. Favorable time for job switch / Partner suitability"
                            value={careerData.mainChallenge}
                            onChange={(e) => setCareerData(prev => ({ ...prev, mainChallenge: e.target.value }))}
                          />
                        </div>
                      </>
                    )}

                    {/* ============================================================== */}
                    {/* SERVICE 5: Finance & Wealth Guidance */}
                    {/* ============================================================== */}
                    {selectedServiceId === 'finance-wealth' && (
                      <>
                        <div className="field full">
                          <label htmlFor="f-finance-topic">Financial Topic · विषय <span className="req">*</span></label>
                          <select
                            id="f-finance-topic"
                            value={financeData.topic}
                            onChange={(e) => setFinanceData(prev => ({ ...prev, topic: e.target.value }))}
                          >
                            {activeService.topicOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        {financeData.topic === 'Other' && (
                          <div className="field full">
                            <label htmlFor="f-finance-other">Specify Topic · स्पष्ट करा <span className="req">*</span></label>
                            <input
                              type="text"
                              id="f-finance-other"
                              data-error-key="financialTopicOther"
                              placeholder="e.g. Ancestral Property settlement"
                              value={financeData.topicOther}
                              onChange={(e) => {
                                setFinanceData(prev => ({ ...prev, topicOther: e.target.value }));
                                if (errors.financialTopicOther) setErrors(prev => ({ ...prev, financialTopicOther: undefined }));
                              }}
                              className={errors.financialTopicOther ? 'has-error' : ''}
                            />
                            {errors.financialTopicOther && <span className="field-error">{errors.financialTopicOther}</span>}
                          </div>
                        )}

                        <div className="field full">
                          <label htmlFor="f-finance-goal">Financial Goal or Concern (Optional)</label>
                          <input
                            type="text"
                            id="f-finance-goal"
                            placeholder="e.g. Debt resolution, favorable property purchase period"
                            value={financeData.financialGoal}
                            onChange={(e) => setFinanceData(prev => ({ ...prev, financialGoal: e.target.value }))}
                          />
                        </div>
                      </>
                    )}

                    {/* ============================================================== */}
                    {/* SERVICE 6: Muhurat Selection */}
                    {/* ============================================================== */}
                    {selectedServiceId === 'muhurat-selection' && (
                      <>
                        <div className="field full">
                          <label htmlFor="f-event-type">Event Type · मंगल कार्य प्रकार <span className="req">*</span></label>
                          <select
                            id="f-event-type"
                            value={muhuratData.eventType}
                            onChange={(e) => setMuhuratData(prev => ({ ...prev, eventType: e.target.value }))}
                          >
                            {activeService.eventOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        {muhuratData.eventType === 'Other' && (
                          <div className="field full">
                            <label htmlFor="f-event-other">Specify Event · कार्यक्रमाचे नाव <span className="req">*</span></label>
                            <input
                              type="text"
                              id="f-event-other"
                              data-error-key="eventTypeOther"
                              placeholder="e.g. Upanayan / Thread Ceremony"
                              value={muhuratData.eventTypeOther}
                              onChange={(e) => {
                                setMuhuratData(prev => ({ ...prev, eventTypeOther: e.target.value }));
                                if (errors.eventTypeOther) setErrors(prev => ({ ...prev, eventTypeOther: undefined }));
                              }}
                              className={errors.eventTypeOther ? 'has-error' : ''}
                            />
                            {errors.eventTypeOther && <span className="field-error">{errors.eventTypeOther}</span>}
                          </div>
                        )}

                        <div className="field">
                          <label htmlFor="f-start-date">Preferred Start Date · सुरुवातीची तारीख <span className="req">*</span></label>
                          <input
                            type="date"
                            id="f-start-date"
                            data-error-key="muhuratStartDate"
                            value={muhuratData.startDate}
                            onChange={(e) => {
                              setMuhuratData(prev => ({ ...prev, startDate: e.target.value }));
                              if (errors.muhuratStartDate) setErrors(prev => ({ ...prev, muhuratStartDate: undefined }));
                            }}
                            className={errors.muhuratStartDate ? 'has-error' : ''}
                            required
                          />
                          {errors.muhuratStartDate && <span className="field-error">{errors.muhuratStartDate}</span>}
                        </div>

                        <div className="field">
                          <label htmlFor="f-end-date">
                            Preferred End Date · अंतिम तारीख {!muhuratData.flexibleDates && <span className="req">*</span>}
                          </label>
                          <input
                            type="date"
                            id="f-end-date"
                            data-error-key="muhuratEndDate"
                            value={muhuratData.endDate}
                            disabled={muhuratData.flexibleDates}
                            onChange={(e) => {
                              setMuhuratData(prev => ({ ...prev, endDate: e.target.value }));
                              if (errors.muhuratEndDate) setErrors(prev => ({ ...prev, muhuratEndDate: undefined }));
                            }}
                            className={errors.muhuratEndDate ? 'has-error' : ''}
                            style={{ opacity: muhuratData.flexibleDates ? 0.5 : 1 }}
                          />
                          {errors.muhuratEndDate && <span className="field-error">{errors.muhuratEndDate}</span>}
                          <label className="checkbox-sublabel">
                            <input
                              type="checkbox"
                              checked={muhuratData.flexibleDates}
                              onChange={(e) => setMuhuratData(prev => ({ ...prev, flexibleDates: e.target.checked }))}
                            />
                            <span>I am flexible with dates (तारीख लवचिक आहे)</span>
                          </label>
                        </div>

                        <div className="field">
                          <label htmlFor="f-event-city">Event City / Location · स्थान <span className="req">*</span></label>
                          <input
                            type="text"
                            id="f-event-city"
                            data-error-key="eventCity"
                            placeholder="e.g. Nashik, Maharashtra"
                            value={muhuratData.eventCity}
                            onChange={(e) => {
                              setMuhuratData(prev => ({ ...prev, eventCity: e.target.value }));
                              if (errors.eventCity) setErrors(prev => ({ ...prev, eventCity: undefined }));
                            }}
                            className={errors.eventCity ? 'has-error' : ''}
                            required
                          />
                          {errors.eventCity && <span className="field-error">{errors.eventCity}</span>}
                        </div>

                        <div className="field">
                          <label htmlFor="f-time-win">Preferred Time Window (Optional)</label>
                          <select
                            id="f-time-win"
                            value={muhuratData.preferredTimeWindow}
                            onChange={(e) => setMuhuratData(prev => ({ ...prev, preferredTimeWindow: e.target.value }))}
                          >
                            <option value="">Any Auspicious Shubh Muhurat</option>
                            <option value="Morning (प्रातःकाल)">Morning (सकाळ / प्रातःकाल)</option>
                            <option value="Afternoon (दुपार)">Afternoon (दुपार / माध्यान्ह)</option>
                            <option value="Evening (सायंकाल / गोधुली)">Evening (सायंकाल / गोधुली)</option>
                          </select>
                        </div>

                        {/* Optional Birth Details for Personalized Muhurat */}
                        <div className="field full conditional-box">
                          <label className="checkbox-sublabel main-check">
                            <input
                              type="checkbox"
                              checked={muhuratData.hasBirthDetails}
                              onChange={(e) => setMuhuratData(prev => ({ ...prev, hasBirthDetails: e.target.checked }))}
                            />
                            <strong>Provide birth details for personalized Muhurat guidance (वैयक्तिक कुंडली आधारित मुहूर्त)</strong>
                          </label>

                          {muhuratData.hasBirthDetails && (
                            <div className="conditional-fields-grid">
                              <div className="field full">
                                <label htmlFor="f-muh-person">Person's Name (e.g. Groom / Bride / Owner)</label>
                                <input
                                  type="text"
                                  id="f-muh-person"
                                  placeholder="Full Name"
                                  value={muhuratData.personName}
                                  onChange={(e) => setMuhuratData(prev => ({ ...prev, personName: e.target.value }))}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor="f-dob-muh">Date of Birth <span className="req">*</span></label>
                                <input
                                  type="date"
                                  id="f-dob-muh"
                                  data-error-key="dob"
                                  value={birthData.dob}
                                  onChange={(e) => {
                                    setBirthData(prev => ({ ...prev, dob: e.target.value }));
                                    if (errors.dob) setErrors(prev => ({ ...prev, dob: undefined }));
                                  }}
                                  className={errors.dob ? 'has-error' : ''}
                                />
                                {errors.dob && <span className="field-error">{errors.dob}</span>}
                              </div>
                              <div className="field">
                                <label htmlFor="f-tob-muh">Birth Time</label>
                                <input
                                  type="time"
                                  id="f-tob-muh"
                                  value={birthData.tob}
                                  disabled={birthData.timeUnknown}
                                  onChange={(e) => setBirthData(prev => ({ ...prev, tob: e.target.value }))}
                                  style={{ opacity: birthData.timeUnknown ? 0.5 : 1 }}
                                />
                                <label className="checkbox-sublabel">
                                  <input
                                    type="checkbox"
                                    checked={birthData.timeUnknown}
                                    onChange={(e) => setBirthData(prev => ({ ...prev, timeUnknown: e.target.checked, tob: e.target.checked ? '' : prev.tob }))}
                                  />
                                  <span>Time Unknown</span>
                                </label>
                              </div>
                              <div className="field full">
                                <label htmlFor="f-pob-muh">Birth Place <span className="req">*</span></label>
                                <input
                                  type="text"
                                  id="f-pob-muh"
                                  data-error-key="pob"
                                  placeholder="City, State, Country"
                                  value={birthData.pob}
                                  onChange={(e) => {
                                    setBirthData(prev => ({ ...prev, pob: e.target.value }));
                                    if (errors.pob) setErrors(prev => ({ ...prev, pob: undefined }));
                                  }}
                                  className={errors.pob ? 'has-error' : ''}
                                />
                                {errors.pob && <span className="field-error">{errors.pob}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* ============================================================== */}
                    {/* SERVICE 7: Gemstone & Rudraksha Guidance */}
                    {/* ============================================================== */}
                    {selectedServiceId === 'gemstone-rudraksha' && (
                      <>
                        <div className="field">
                          <label htmlFor="f-req-type">Request Type · शिफारस प्रकार <span className="req">*</span></label>
                          <select
                            id="f-req-type"
                            value={gemstoneData.requestType}
                            onChange={(e) => setGemstoneData(prev => ({ ...prev, requestType: e.target.value }))}
                          >
                            {activeService.requestOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div className="field">
                          <label htmlFor="f-gem-purpose">Primary Purpose · मुख्य उद्देश <span className="req">*</span></label>
                          <select
                            id="f-gem-purpose"
                            value={gemstoneData.purpose}
                            onChange={(e) => setGemstoneData(prev => ({ ...prev, purpose: e.target.value }))}
                          >
                            {activeService.purposeOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        {gemstoneData.purpose === 'Other' && (
                          <div className="field full">
                            <label htmlFor="f-purpose-other">Specify Purpose · उद्देश स्पष्ट करा <span className="req">*</span></label>
                            <input
                              type="text"
                              id="f-purpose-other"
                              data-error-key="purposeOther"
                              placeholder="Describe why you seek gemstone / Rudraksha recommendation..."
                              value={gemstoneData.purposeOther}
                              onChange={(e) => {
                                setGemstoneData(prev => ({ ...prev, purposeOther: e.target.value }));
                                if (errors.purposeOther) setErrors(prev => ({ ...prev, purposeOther: undefined }));
                              }}
                              className={errors.purposeOther ? 'has-error' : ''}
                            />
                            {errors.purposeOther && <span className="field-error">{errors.purposeOther}</span>}
                          </div>
                        )}

                        <div className="field full">
                          <label htmlFor="f-existing-items">Existing Items Currently Wearing (Optional)</label>
                          <input
                            type="text"
                            id="f-existing-items"
                            placeholder="e.g. Currently wearing Yellow Sapphire (Pukhraj) / 5 Mukhi Rudraksha"
                            value={gemstoneData.existingItems}
                            onChange={(e) => setGemstoneData(prev => ({ ...prev, existingItems: e.target.value }))}
                          />
                        </div>

                        {/* Optional Birth Details */}
                        <div className="field full conditional-box">
                          <label className="checkbox-sublabel main-check">
                            <input
                              type="checkbox"
                              checked={gemstoneData.hasBirthDetails}
                              onChange={(e) => setGemstoneData(prev => ({ ...prev, hasBirthDetails: e.target.checked }))}
                            />
                            <strong>Add birth details for personalized Kundali analysis (अचूक रत्न निवडीसाठी जन्मतपशील जोडा)</strong>
                          </label>

                          {gemstoneData.hasBirthDetails && (
                            <div className="conditional-fields-grid">
                              <div className="field">
                                <label htmlFor="f-dob-gem">Date of Birth <span className="req">*</span></label>
                                <input
                                  type="date"
                                  id="f-dob-gem"
                                  data-error-key="dob"
                                  value={birthData.dob}
                                  onChange={(e) => {
                                    setBirthData(prev => ({ ...prev, dob: e.target.value }));
                                    if (errors.dob) setErrors(prev => ({ ...prev, dob: undefined }));
                                  }}
                                  className={errors.dob ? 'has-error' : ''}
                                />
                                {errors.dob && <span className="field-error">{errors.dob}</span>}
                              </div>
                              <div className="field">
                                <label htmlFor="f-tob-gem">Birth Time</label>
                                <input
                                  type="time"
                                  id="f-tob-gem"
                                  value={birthData.tob}
                                  disabled={birthData.timeUnknown}
                                  onChange={(e) => setBirthData(prev => ({ ...prev, tob: e.target.value }))}
                                  style={{ opacity: birthData.timeUnknown ? 0.5 : 1 }}
                                />
                                <label className="checkbox-sublabel">
                                  <input
                                    type="checkbox"
                                    checked={birthData.timeUnknown}
                                    onChange={(e) => setBirthData(prev => ({ ...prev, timeUnknown: e.target.checked, tob: e.target.checked ? '' : prev.tob }))}
                                  />
                                  <span>Time Unknown</span>
                                </label>
                              </div>
                              <div className="field full">
                                <label htmlFor="f-pob-gem">Birth Place <span className="req">*</span></label>
                                <input
                                  type="text"
                                  id="f-pob-gem"
                                  data-error-key="pob"
                                  placeholder="City, State, Country"
                                  value={birthData.pob}
                                  onChange={(e) => {
                                    setBirthData(prev => ({ ...prev, pob: e.target.value }));
                                    if (errors.pob) setErrors(prev => ({ ...prev, pob: undefined }));
                                  }}
                                  className={errors.pob ? 'has-error' : ''}
                                />
                                {errors.pob && <span className="field-error">{errors.pob}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* ============================================================== */}
                    {/* SERVICE 8: General Jyotish Consultation */}
                    {/* ============================================================== */}
                    {selectedServiceId === 'general-jyotish' && (
                      <>
                        <div className="field full">
                          <label htmlFor="f-gen-topic">Consultation Topic · विषय <span className="req">*</span></label>
                          <select
                            id="f-gen-topic"
                            value={generalData.topic}
                            onChange={(e) => setGeneralData(prev => ({ ...prev, topic: e.target.value }))}
                          >
                            {activeService.topicOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div className="field full">
                          <label htmlFor="f-customer-q">Your Question / Concern · तुमचा मुख्य प्रश्न <span className="req">*</span></label>
                          <textarea
                            id="f-customer-q"
                            data-error-key="customerQuestion"
                            placeholder="कृपया तुमच्या समस्येविषयी किंवा प्रश्नाविषयी तपशील लिहा..."
                            rows={3}
                            value={generalData.customerQuestion}
                            onChange={(e) => {
                              setGeneralData(prev => ({ ...prev, customerQuestion: e.target.value }));
                              if (errors.customerQuestion) setErrors(prev => ({ ...prev, customerQuestion: undefined }));
                            }}
                            className={errors.customerQuestion ? 'has-error' : ''}
                            aria-invalid={!!errors.customerQuestion}
                            required
                          />
                          {errors.customerQuestion && <span className="field-error">{errors.customerQuestion}</span>}
                        </div>

                        {/* Optional Birth Details */}
                        <div className="field full conditional-box">
                          <label className="checkbox-sublabel main-check">
                            <input
                              type="checkbox"
                              checked={generalData.hasBirthDetails}
                              onChange={(e) => setGeneralData(prev => ({ ...prev, hasBirthDetails: e.target.checked }))}
                            />
                            <strong>Add birth details for personalized Kundali reading (जन्मकुंडली वाचनासाठी तपशील जोडा)</strong>
                          </label>

                          {generalData.hasBirthDetails && (
                            <div className="conditional-fields-grid">
                              <div className="field">
                                <label htmlFor="f-dob-gen">Date of Birth <span className="req">*</span></label>
                                <input
                                  type="date"
                                  id="f-dob-gen"
                                  data-error-key="dob"
                                  value={birthData.dob}
                                  onChange={(e) => {
                                    setBirthData(prev => ({ ...prev, dob: e.target.value }));
                                    if (errors.dob) setErrors(prev => ({ ...prev, dob: undefined }));
                                  }}
                                  className={errors.dob ? 'has-error' : ''}
                                />
                                {errors.dob && <span className="field-error">{errors.dob}</span>}
                              </div>
                              <div className="field">
                                <label htmlFor="f-tob-gen">Birth Time</label>
                                <input
                                  type="time"
                                  id="f-tob-gen"
                                  value={birthData.tob}
                                  disabled={birthData.timeUnknown}
                                  onChange={(e) => setBirthData(prev => ({ ...prev, tob: e.target.value }))}
                                  style={{ opacity: birthData.timeUnknown ? 0.5 : 1 }}
                                />
                                <label className="checkbox-sublabel">
                                  <input
                                    type="checkbox"
                                    checked={birthData.timeUnknown}
                                    onChange={(e) => setBirthData(prev => ({ ...prev, timeUnknown: e.target.checked, tob: e.target.checked ? '' : prev.tob }))}
                                  />
                                  <span>Time Unknown</span>
                                </label>
                              </div>
                              <div className="field full">
                                <label htmlFor="f-pob-gen">Birth Place <span className="req">*</span></label>
                                <input
                                  type="text"
                                  id="f-pob-gen"
                                  data-error-key="pob"
                                  placeholder="City, State, Country"
                                  value={birthData.pob}
                                  onChange={(e) => {
                                    setBirthData(prev => ({ ...prev, pob: e.target.value }));
                                    if (errors.pob) setErrors(prev => ({ ...prev, pob: undefined }));
                                  }}
                                  className={errors.pob ? 'has-error' : ''}
                                />
                                {errors.pob && <span className="field-error">{errors.pob}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* ============================================================== */}
                    {/* Common Appointment & Consultation Preferences */}
                    {/* ============================================================== */}
                    <div className="field">
                      <label htmlFor="f-date">Preferred Date · तारीख</label>
                      <input
                        type="date"
                        id="f-date"
                        value={commonData.date}
                        onChange={(e) => setCommonData(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="f-timeslot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Time Slot · वेळ</span>
                        {loadingSlots && <span style={{ fontSize: '11px', color: 'var(--gold-lt)' }}>लोड होत आहे...</span>}
                      </label>
                      <select
                        id="f-timeslot"
                        value={commonData.timeSlot}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = availableSlots.find(s => (s.time_window || s.start_time) === val);
                          setCommonData(prev => ({ ...prev, timeSlot: val, slotId: matched ? matched.id : null }));
                        }}
                      >
                        {availableSlots.length > 0 ? (
                          availableSlots.map(s => (
                            <option
                              key={s.id}
                              value={s.time_window || s.start_time}
                              disabled={s.is_full}
                            >
                              {s.time_window || s.start_time} — {s.is_full ? '❌ Full (पूर्ण)' : `✓ ${s.assigned_priest_or_astrologer || 'Nagesh Swami Guruji'} (${s.available_spots} स्लॉट उपलब्ध)`}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="10:00 AM">10:00 AM (सकाळ सत्र - Morning)</option>
                            <option value="11:30 AM">11:30 AM (दुपार सत्र - Noon)</option>
                            <option value="03:00 PM">03:00 PM (दुपार सत्र - Afternoon)</option>
                            <option value="05:00 PM">05:00 PM (सायंकाळ सत्र - Evening)</option>
                          </>
                        )}
                      </select>
                      {availableSlots.length > 0 ? (
                        <span style={{ fontSize: '11px', color: '#10b981', display: 'block', marginTop: '4px' }}>
                          ⚡ {availableSlots.length} ज्योतिषी वेळ स्लॉट उपलब्ध (Admin Calendar)
                        </span>
                      ) : commonData.date ? (
                        <span style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginTop: '4px' }}>
                          मानक सल्लामसलत वेळ (Standard Consultation Slots)
                        </span>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor="f-mode">Mode · माध्यम</label>
                      <select
                        id="f-mode"
                        value={commonData.mode}
                        onChange={(e) => setCommonData(prev => ({ ...prev, mode: e.target.value }))}
                      >
                        <option>Online · ऑनलाइन (Video / Phone)</option>
                        <option>In-Person · प्रत्यक्ष (Ashram / Nashik)</option>
                      </select>
                    </div>

                    <div className="field full">
                      <label htmlFor="f-notes">Additional Notes (Optional) · अतिरिक्त माहिती</label>
                      <textarea
                        id="f-notes"
                        placeholder="तुमचा प्रश्न किंवा अतिरिक्त माहिती..."
                        rows={2}
                        value={commonData.notes}
                        onChange={(e) => setCommonData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Google reCAPTCHA v2 Checkbox */}
                  <ReCaptcha
                    id="recaptcha-jyotish"
                    ref={recaptchaRef}
                    onChange={setCaptchaToken}
                    onExpired={() => setCaptchaToken('')}
                    onError={() => setCaptchaToken('')}
                  />

                  {/* Submission Action */}
                  <button
                    type="submit"
                    className="form-submit jyotish-submit-btn"
                    disabled={loading}
                    aria-label="Submit & Book Consultation"
                  >
                    {loading ? 'नोंदणी सुरू आहे...' : 'Submit & Book Consultation →'}
                  </button>

                  <p className="form-note">{formNote}</p>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
