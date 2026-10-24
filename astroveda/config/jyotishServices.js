// Centralized Jyotish Consultation Services Configuration
// Defines stable IDs, titles, descriptions, categories, conditional fields, and validation rules

export const JYOTISH_SERVICES = [
  {
    id: 'janma-kundali',
    title: 'Janma Kundali Preparation',
    marathiTitle: 'जन्मकुंडली निर्मिती व पत्रिका लेखन',
    tagline: 'Personalized Vedic birth-chart report with planetary placements, dashas, and traditional analysis.',
    requiresBirthDetails: true,
    requiresTime: false, // optional if unknown
    allowUnknownTime: true,
    topicOptions: null,
  },
  {
    id: 'kundali-analysis',
    title: 'Kundali Analysis & Guidance',
    marathiTitle: 'पत्रिका फलादेश व ग्रहदोष मार्गदर्शन',
    tagline: 'In-depth horoscope reading focusing on your specific life concerns and astrological remedies.',
    requiresBirthDetails: true,
    requiresTime: false,
    allowUnknownTime: true,
    topicOptions: [
      'General Life Guidance',
      'Relationships and Family',
      'Education',
      'Career and Profession',
      'Health-related traditional astrology',
      'Foreign Travel or Settlement',
      'Other',
    ],
  },
  {
    id: 'marriage-matching',
    title: 'Marriage Kundali Matching',
    marathiTitle: 'विवाह कुंडली मिलन व गुण मिलान',
    tagline: 'Comprehensive compatibility analysis for prospective bride and groom with Mangal dosha review.',
    isMarriageMatching: true,
    requiresBirthDetails: false, // handled via person1 & person2
  },
  {
    id: 'career-business',
    title: 'Career & Business Guidance',
    marathiTitle: 'नोकरी, व्यवसाय व करिअर मार्गदर्शन',
    tagline: 'Astrological guidance for career growth, job changes, new ventures, and business partnerships.',
    requiresBirthDetails: true,
    requiresTime: false,
    allowUnknownTime: true,
    categoryOptions: [
      'Job / Career Guidance',
      'Job Change',
      'Business Startup',
      'Existing Business',
      'Career Growth',
      'Business Partnership',
      'Other',
    ],
  },
  {
    id: 'finance-wealth',
    title: 'Finance & Wealth Guidance',
    marathiTitle: 'धनसंपदा, गुंतवणूक व आर्थिक स्थैर्य',
    tagline: 'Astrological insights on wealth accumulation, financial bottlenecks, and favorable periods.',
    requiresBirthDetails: true,
    requiresTime: false,
    allowUnknownTime: true,
    topicOptions: [
      'Savings and Investments',
      'Business Income',
      'Career Income',
      'Property and Assets',
      'General Wealth Guidance',
      'Other',
    ],
  },
  {
    id: 'muhurat-selection',
    title: 'Muhurat Selection',
    marathiTitle: 'शुभ मुहूर्त निवड व निर्णय',
    tagline: 'Auspicious date and time selection for weddings, Griha Pravesh, ceremonies, and major beginnings.',
    isMuhurat: true,
    eventOptions: [
      'Wedding',
      'Engagement',
      'Griha Pravesh / Housewarming',
      'Business Opening',
      'Vehicle Purchase',
      'Naming Ceremony',
      'Bhoomi Pujan',
      'Religious Ceremony',
      'Other',
    ],
  },
  {
    id: 'gemstone-rudraksha',
    title: 'Gemstone & Rudraksha Guidance',
    marathiTitle: 'रत्न व रुद्राक्ष योग्य निवड मार्गदर्शन',
    tagline: 'Personalized recommendations for authentic Jyotish gemstones and energized Rudraksha beads.',
    isGemstone: true,
    requestOptions: [
      'Gemstone (Ratna)',
      'Rudraksha',
      'Rudraksha Mala',
      'General Spiritual Guidance',
    ],
    purposeOptions: [
      'Career Growth',
      'General Spiritual Guidance',
      'Wealth-related Spiritual Guidance',
      'Family and Relationships',
      'Peace and Well-being',
      'Traditional Astrological Remedy',
      'Other',
    ],
  },
  {
    id: 'general-jyotish',
    title: 'General Jyotish Consultation',
    marathiTitle: 'सामान्य ज्योतिष सल्ला व शंका समाधान',
    tagline: 'Open consultation for specific queries, spiritual guidance, and personalized astrological advice.',
    isGeneral: true,
    topicOptions: [
      'General Jyotish Question',
      'Personal Guidance',
      'Family or Relationships',
      'Career or Business',
      'Spiritual Guidance',
      'Another Topic',
    ],
  },
];

export function getServiceById(id) {
  return JYOTISH_SERVICES.find(s => s.id === id) || JYOTISH_SERVICES[0];
}

export function getServiceByTitle(title) {
  if (!title) return JYOTISH_SERVICES[0];
  const t = title.toLowerCase().trim();
  return (
    JYOTISH_SERVICES.find(s => s.title.toLowerCase() === t) ||
    JYOTISH_SERVICES.find(s => s.title.toLowerCase().includes(t) || t.includes(s.title.toLowerCase())) ||
    JYOTISH_SERVICES[0]
  );
}
