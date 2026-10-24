'use client';

import React, { useState, useRef, useEffect } from 'react';

const fallbackVideoTestimonials = [
  {
    id: 'vikram-ghodke',
    name: 'श्री. विक्रम घोडके',
    designation: 'उद्योगपती, Shirodkar Preci Comp Pvt. Ltd.',
    location: 'पुणे',
    event: 'भव्य चंडी याग (कंपनी उद्घाटन)',
    badge: 'उद्योगपती अभिप्राय',
    duration: '0:33',
    videoSrc: '/videos/testimonials/review-vikram-ghodke-chandi-yag.mp4',
    poster: '/videos/testimonials/poster-vikram-ghodke.jpg',
    rating: 5,
    quote: 'कंपनीच्या उद्घाटनानिमित्त भव्य चंडी याग संपन्न झाला. या पूजेमुळे अत्यंत सकारात्मक ऊर्जा आणि मनाला मोठे समाधान लाभले.'
  },
  {
    id: 'kurlekar-mumbai',
    name: 'श्री. कुर्लेकर',
    designation: 'भाविक, मुंबई',
    location: 'मुंबई',
    event: 'शास्त्रशुद्ध गृह पूजा विधी',
    badge: 'सोशल मीडिया संपर्क',
    duration: '0:31',
    videoSrc: '/videos/testimonials/review-kurlekar-mumbai-puja.mp4',
    poster: '/videos/testimonials/poster-kurlekar-mumbai.jpg',
    rating: 5,
    quote: 'Instagram वर Reel पाहून संपर्क साधला आणि घरी शास्त्रशुद्ध विधी केला. त्यांच्या मार्गदर्शनामुळे विश्वास अधिक दृढ झाला.'
  },
  {
    id: 'devotee-pune',
    name: 'श्री. अमोल पाटील',
    designation: 'भाविक, पुणे',
    location: 'पुणे',
    event: 'कुंडली व वास्तु मार्गदर्शन',
    badge: 'वास्तु व विधी',
    duration: '0:49',
    videoSrc: '/videos/testimonials/review-devotee-blessing-1.mp4',
    poster: '/videos/testimonials/poster-devotee-1.jpg',
    rating: 5,
    quote: 'गुरुजींचे मार्गदर्शन अतिशय शास्त्रीय व पारदर्शक आहे. कोणत्याही अंधश्रद्धेशिवाय समस्येचे अचूक व शास्त्रोक्त निवारण झाले.'
  },
  {
    id: 'devotee-nashik',
    name: 'सौ. व श्री. कुलकर्णी',
    designation: 'भाविक, नाशिक',
    location: 'नाशिक',
    event: 'रुद्राभिषेक व नवग्रह शांती',
    badge: 'कौटुंबिक शांती',
    duration: '1:00',
    videoSrc: '/videos/testimonials/review-devotee-blessing-2.mp4',
    poster: '/videos/testimonials/poster-devotee-2.jpg',
    rating: 5,
    quote: 'कुटुंबाच्या स्वास्थ्यासाठी आणि शांतीसाठी रुद्राभिषेक विधी केला. संपूर्ण विधी अत्यंत समर्पणाने व भक्तिभावाने पार पडला.'
  }
];

const fallbackWrittenTestimonials = [
  {
    initial: 'V',
    name: 'Vikram Patil',
    place: 'Thane · Shri Yantra',
    text: 'Ordered a Shri Yantra with pran-pratishtha. The follow-up guidance call after delivery was a wonderful touch. Truly a premium spiritual service.',
    rating: 5
  },
  {
    initial: 'S',
    name: 'Shweta Joshi',
    place: 'Nashik · 5 Mukhi Rudraksha',
    text: 'Rudraksha quality and guidance were excellent. Got proper certification and clear instructions on how to wear and care. Very authentic experience.',
    rating: 5
  },
  {
    initial: 'R',
    name: 'Rohit Kulkarni',
    place: 'Mumbai · Career Consultation',
    text: 'Consultation was explained very clearly. Guruji took time to study my kundali and explained everything in simple language. No unnecessary fear-mongering.',
    rating: 5
  },
  {
    initial: 'A',
    name: 'Anjali Deshmukh',
    place: 'Pune · गृहप्रवेश पूजा',
    text: 'Puja arrangement was very systematic. Panditji arrived on time, all samagri was prepared properly, and the entire vidhi was explained step by step. Highly recommended.',
    rating: 5
  }
];

export default function TestimonialsSection({ testimonials: initialTestimonials, headerText }) {
  const [playingId, setPlayingId] = useState(null);
  const [mutedId, setMutedId] = useState(null);
  const [activeModalVideo, setActiveModalVideo] = useState(null);
  const videoRefs = useRef({});
  const modalVideoRef = useRef(null);

  const allTestimonials = (initialTestimonials && Array.isArray(initialTestimonials) && initialTestimonials.length > 0)
    ? initialTestimonials
    : null;

  // Extract Video Testimonials from database API response
  const dbVideoReviews = allTestimonials
    ? allTestimonials.filter(t => t.is_video || t.video_url || t.videoSrc)
    : [];

  const videoTestimonials = (dbVideoReviews.length > 0)
    ? dbVideoReviews.map((t, idx) => ({
        id: t.id ? String(t.id) : `video-${idx}`,
        name: t.name || t.devotee_name,
        designation: t.service || t.service_or_product || t.place || '',
        location: t.city || t.devotee_city || '',
        event: t.service || t.service_or_product || 'शास्त्रशुद्ध विधी',
        badge: t.badge || 'व्हिडिओ अनुभव',
        duration: t.duration || '0:30',
        videoSrc: t.video_url || t.videoSrc,
        poster: t.poster_url || t.poster || '/videos/testimonials/poster-vikram-ghodke.jpg',
        rating: t.rating || 5,
        quote: t.quote || t.text || t.blessing_text || ''
      }))
    : (allTestimonials ? [] : fallbackVideoTestimonials);

  // Extract Written Testimonials from database API response
  const dbWrittenReviews = allTestimonials
    ? allTestimonials.filter(t => !(t.is_video || t.video_url || t.videoSrc))
    : [];

  const writtenTestimonials = (dbWrittenReviews.length > 0)
    ? dbWrittenReviews.map(t => ({
        id: t.id,
        initial: t.initial || (t.name ? t.name.charAt(0).toUpperCase() : 'A'),
        name: t.name || t.devotee_name,
        place: t.place || `${t.city || 'Pune'} · ${t.service || 'पूजा विधी'}`,
        text: t.text || t.quote || t.blessing_text || '',
        rating: t.rating || 5
      }))
    : (allTestimonials ? [] : fallbackWrittenTestimonials);

  // Header texts from database (SiteTextService / admin panel)
  const kicker = headerText?.kicker || 'TESTIMONIALS';
  const title = headerText?.title || 'What Our Clients Say';
  const subtitle = headerText?.subtitle || 'प्रत्येक अभिप्राय खरा आहे — फसवे reviews आम्ही ठेवत नाही.';
  const videoPill = headerText?.video_pill || 'थेट व्हिडिओ अनुभव (Authentic Video Experiences)';
  const videoHint = headerText?.video_hint || 'व्हिडिओ पाहण्यासाठी कार्डवर टॅप करा';
  const writtenPill = headerText?.written_pill || 'प्रमाणित भाविकांचे अभिप्राय (Verified Client Reviews)';

  // Handle inline video play/pause
  const handleTogglePlay = (id) => {
    const currentVideo = videoRefs.current[id];
    if (!currentVideo) return;

    if (playingId === id) {
      currentVideo.pause();
      setPlayingId(null);
    } else {
      // Pause any previously playing video
      if (playingId && videoRefs.current[playingId]) {
        videoRefs.current[playingId].pause();
      }
      currentVideo.play().then(() => {
        setPlayingId(id);
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleToggleMute = (e, id) => {
    e.stopPropagation();
    const currentVideo = videoRefs.current[id];
    if (!currentVideo) return;

    const newMuted = !currentVideo.muted;
    currentVideo.muted = newMuted;
    setMutedId(newMuted ? id : null);
  };

  // Open modal
  const openModal = (e, video) => {
    e.stopPropagation();
    // Pause any inline playing video
    if (playingId && videoRefs.current[playingId]) {
      videoRefs.current[playingId].pause();
      setPlayingId(null);
    }
    setActiveModalVideo(video);
  };

  const closeModal = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.pause();
    }
    setActiveModalVideo(null);
  };

  // Keyboard shortcut to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeModalVideo) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModalVideo]);

  return (
    <section className="testi-section" id="testimonials">
      <div className="wrap">
        {/* Section Header (Editable from Admin Panel -> Content -> Site Text) */}
        <div className="sec-head center reveal">
          <span className="kicker">— {kicker} —</span>
          <h2>
            {title === 'What Our Clients Say' ? (
              <>What Our <em>Clients</em> Say</>
            ) : (
              title
            )}
          </h2>
          <p>{subtitle}</p>
        </div>

        {/* 1. Dynamic Video Testimonials Section */}
        {videoTestimonials.length > 0 && (
          <div className="video-testi-container reveal">
            <div className="video-testi-subhead">
              <span className="video-testi-pill">
                <span className="pulsing-dot" /> {videoPill}
              </span>
              <span className="video-testi-hint">{videoHint}</span>
            </div>

            <div className="video-testi-grid">
              {videoTestimonials.map((item) => {
                const isPlaying = playingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`video-testi-card ${isPlaying ? 'is-playing' : ''}`}
                    onClick={() => handleTogglePlay(item.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Play testimonial from ${item.name}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTogglePlay(item.id); }}
                  >
                    <div className="video-testi-media-wrap">
                      <video
                        ref={(el) => { videoRefs.current[item.id] = el; }}
                        src={item.videoSrc}
                        poster={item.poster}
                        playsInline
                        preload="metadata"
                        onEnded={() => setPlayingId(null)}
                        className="video-testi-element"
                      />

                      {/* Gradient Overlay */}
                      <div className="video-testi-gradient" />

                      {/* Top Bar Badges */}
                      <div className="video-testi-topbar">
                        <span className="video-badge-tag">{item.badge}</span>
                        <span className="video-badge-duration">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          {item.duration}
                        </span>
                      </div>

                      {/* Center Play/Pause Floating Button */}
                      <div className={`video-play-center ${isPlaying ? 'hidden-on-play' : ''}`}>
                        <div className="video-play-glow-ring" />
                        <button
                          type="button"
                          className="video-play-disc"
                          aria-label="Play video"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                            <polygon points="6 4 20 12 6 20 6 4" />
                          </svg>
                        </button>
                      </div>

                      {/* Quick controls when playing */}
                      {isPlaying && (
                        <div className="video-active-controls">
                          <button
                            type="button"
                            className="video-ctrl-btn"
                            onClick={(e) => handleToggleMute(e, item.id)}
                            aria-label="Toggle mute"
                            title="Mute / Unmute"
                          >
                            {videoRefs.current[item.id]?.muted ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <line x1="23" y1="9" x2="17" y2="15" />
                                <line x1="17" y1="9" x2="23" y2="15" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                              </svg>
                            )}
                          </button>

                          <button
                            type="button"
                            className="video-ctrl-btn"
                            onClick={(e) => openModal(e, item)}
                            aria-label="Open Fullscreen Modal"
                            title="मोठ्या पडद्यावर पहा (Expand)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                              <path d="M15 3h6v6" />
                              <path d="M9 21H3v-6" />
                              <path d="M21 3l-7 7" />
                              <path d="M3 21l7-7" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Bottom Info Card */}
                      <div className="video-testi-info">
                        <div className="video-testi-stars">
                          {'★'.repeat(item.rating)}
                          <span className="video-rating-val">{item.rating}.0</span>
                        </div>
                        <h4 className="video-devotee-name">{item.name}</h4>
                        <div className="video-devotee-meta">
                          <span className="video-devotee-role">{item.designation}</span>
                        </div>
                        <div className="video-event-pill">
                          <span className="pill-dot" /> {item.event}
                        </div>
                        <p className="video-quote-snippet">&quot;{item.quote}&quot;</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Minimal Divider */}
        {videoTestimonials.length > 0 && writtenTestimonials.length > 0 && (
          <div className="testi-divider">
            <span>✦ ✦ ✦</span>
          </div>
        )}

        {/* 2. Dynamic Written Reviews Section */}
        {writtenTestimonials.length > 0 && (
          <div className="written-testi-container">
            <div className="written-testi-subhead">
              <span className="written-testi-label">{writtenPill}</span>
            </div>
            <div className="testi-grid">
              {writtenTestimonials.map((t, idx) => (
                <div key={t.id || idx} className="testi-card reveal">
                  <div className="testi-stars">
                    {'★'.repeat(t.rating || 5)}
                  </div>
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
        )}
      </div>

      {/* Video Modal / Lightbox Player */}
      {activeModalVideo && (
        <div className="video-modal-backdrop" onClick={closeModal}>
          <div className="video-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="video-modal-close"
              onClick={closeModal}
              aria-label="Close video"
            >
              ✕
            </button>

            <div className="video-modal-content">
              <div className="video-modal-player-wrap">
                <video
                  ref={modalVideoRef}
                  src={activeModalVideo.videoSrc}
                  poster={activeModalVideo.poster}
                  controls
                  autoPlay
                  playsInline
                  className="video-modal-element"
                />
              </div>

              <div className="video-modal-details">
                <span className="video-modal-event-tag">{activeModalVideo.event}</span>
                <div className="video-modal-stars">{'★'.repeat(activeModalVideo.rating || 5)}</div>
                <h3 className="video-modal-name">{activeModalVideo.name}</h3>
                <p className="video-modal-role">{activeModalVideo.designation} {activeModalVideo.location ? `· ${activeModalVideo.location}` : ''}</p>
                <div className="video-modal-quote-box">
                  <p>&quot;{activeModalVideo.quote}&quot;</p>
                </div>
                <div className="video-modal-guarantee">
                  <span>✓ 100% अस्सल व प्रत्यक्ष भाविक अनुभव</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
