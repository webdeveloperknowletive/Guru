export default function AboutSection({ guruji }) {
  // Extract display visibility preferences set from Admin Panel
  const vis = {
    show_photo: true,
    show_lineage: true,
    show_bio: true,
    show_secondary_bio: true,
    show_stats: true,
    show_experience: true,
    show_consultations: true,
    show_pujas: true,
    show_cta_button: true,
    show_darshan: false,
    show_ashram: false,
    show_contact: false,
    ...(guruji?.visibility_settings || guruji?.visibility || {}),
  };

  const name = guruji?.full_title || guruji?.name || 'Nagesh Guruji';
  const lineage = guruji?.spiritual_lineage || 'वेदशास्त्र संपन्न • २५+ वर्षांची साधना व ज्योतिष मार्गदर्शन';
  const bio = guruji?.bio || 'श्रद्धेतून समाधान, परंपरेतून मार्गदर्शन. सनातन वैदिक परंपरा, सिद्ध रुद्राक्ष, प्रामाणिक रत्न आणि शास्त्रोक्त पूजा विधींद्वारे सहस्रो भक्तांचे जीवन प्रकाशित करणारे आदरणीय मार्गदर्शक.';
  const secondaryBio = guruji?.secondary_bio || 'जन्मकुंडली अभ्यास, वास्तुशांती, रुद्राभिषेक, नवग्रह शांती आणि रत्न निवड — प्रत्येक सेवेत शास्त्राचा आदर आणि व्यक्तीच्या गरजेचा विचार केला जातो.';

  // Format stats
  const expYears = guruji?.experience_years 
    ? (String(guruji.experience_years).includes('+') ? guruji.experience_years : `${guruji.experience_years}+`)
    : '25+';
  const consults = guruji?.consultations_count 
    ? (String(guruji.consultations_count).includes('+') ? guruji.consultations_count : `${guruji.consultations_count}+`)
    : '10K+';
  const pujas = guruji?.pujas_count 
    ? (String(guruji.pujas_count).includes('+') ? guruji.pujas_count : `${guruji.pujas_count}+`)
    : '5000+';

  const buttonText = guruji?.button_text || 'Book Consultation →';
  const buttonUrl = guruji?.button_url || '#jyotish';

  // Photo resolution: handle uploads, external URLs, and local fallback
  const backendBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
  let photo = '/guruji.png';
  const rawPhoto = guruji?.profile_image || guruji?.image_url;
  if (rawPhoto) {
    if (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://')) {
      photo = rawPhoto;
    } else if (rawPhoto.startsWith('/static/')) {
      photo = `${backendBase}${rawPhoto}`;
    } else {
      photo = rawPhoto;
    }
  }

  const hasStats = vis.show_stats && (vis.show_experience || vis.show_consultations || vis.show_pujas);
  const hasAshramInfo = (vis.show_darshan && guruji?.darshan_timings) ||
                        (vis.show_ashram && guruji?.ashram_address) ||
                        (vis.show_contact && (guruji?.contact_phone || guruji?.contact_email));

  return (
    <section id="about">
      <div className="wrap">
        <div 
          className="about-wrap" 
          style={!vis.show_photo ? { gridTemplateColumns: '1fr', maxWidth: '820px', margin: '0 auto' } : undefined}
        >
          {/* Guruji Photo (Toggled via Admin Panel) */}
          {vis.show_photo && (
            <div className="guru-photo reveal">
              <img
                src={photo}
                alt={name}
                loading="lazy"
                decoding="async"
                width={773}
                height={1024}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Guruji Copy & Content */}
          <div className="guru-copy reveal">
            <span className="kicker">About Guruji</span>
            <h2>{name}</h2>

            {/* Spiritual Lineage */}
            {vis.show_lineage && lineage && (
              <p style={{ color: 'var(--gold, #d4af37)', fontWeight: 600, fontSize: '15px', marginBottom: '10px' }}>
                {lineage}
              </p>
            )}

            {/* Primary Biography */}
            {vis.show_bio && bio && <p>{bio}</p>}

            {/* Detailed Secondary Bio */}
            {vis.show_secondary_bio && secondaryBio && <p>{secondaryBio}</p>}

            {/* Key Statistics Counters */}
            {hasStats && (
              <div className="guru-stats">
                {vis.show_experience && (
                  <div className="st"><b>{expYears}</b><span>Years Experience</span></div>
                )}
                {vis.show_consultations && (
                  <div className="st"><b>{consults}</b><span>Consultations</span></div>
                )}
                {vis.show_pujas && (
                  <div className="st"><b>{pujas}</b><span>Pujas Performed</span></div>
                )}
              </div>
            )}

            {/* Ashram & Darshan Timings Badge (if enabled) */}
            {hasAshramInfo && (
              <div style={{
                marginTop: '16px',
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'var(--surface-elevated, #FFFFFF)',
                border: '1px solid var(--border-subtle, #E3CFB1)',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text-primary, #35251F)'
              }}>
                {vis.show_darshan && guruji?.darshan_timings && (
                  <div style={{ marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--accent-primary, #563B2D)' }}>Meeting Time:</strong>{' '}
                    {guruji.darshan_timings.includes('सोमवार')
                      ? 'Monday to Saturday: 9:00 AM to 1:00 PM & 4:00 PM to 8:00 PM'
                      : guruji.darshan_timings}
                  </div>
                )}
                {vis.show_ashram && guruji?.ashram_address && (
                  <div style={{ marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--accent-primary, #563B2D)' }}>Address:</strong>{' '}
                    {guruji.ashram_address.includes('सद्गुरू')
                      ? 'Sadguru Kripa, Vedic Sadhana Kendra, Pune / Nashik, Maharashtra'
                      : guruji.ashram_address}
                  </div>
                )}
                {vis.show_contact && (guruji?.contact_phone || guruji?.contact_email) && (
                  <div>
                    <strong style={{ color: 'var(--accent-primary, #563B2D)' }}>Contact:</strong> {guruji.contact_phone}
                    {guruji?.contact_email ? ` · ${guruji.contact_email}` : ''}
                  </div>
                )}
              </div>
            )}

            {/* Call to Action Button */}
            {vis.show_cta_button && (
              <a href={buttonUrl} className="btn btn-gold">{buttonText}</a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
