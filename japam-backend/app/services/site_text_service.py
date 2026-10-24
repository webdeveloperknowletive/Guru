import json
from datetime import datetime, timezone
from app.extensions import db
from app.models.operations import SystemSetting


DEFAULT_SITE_TEXTS = {
    "why_section": {
        "kicker": "Why Choose",
        "title": "Nagesh Swami Guruji?",
        "subtitle": "Three Generations of Tradition",
        "reasons": [
            {
                "num": "01",
                "title": "A Legacy of Vedic Knowledge",
                "desc": "A Vedic and spiritual tradition spanning three generations. A commitment to carry forward the legacy of traditional rituals, sacrificial rites (yajnas), and religious ceremonies.",
            },
            {
                "num": "02",
                "title": "Personalised Jyotish Guidance",
                "desc": "Qualified in Jyotish Bhaskar, Guruji provides detailed Kundali analysis, study-based astrological guidance, and traditional remedies tailored to individual needs.",
            },
            {
                "num": "03",
                "title": "Authentic & Genuine Products",
                "desc": "Explore authentic Rudraksha, gemstones, Yantras, and spiritual products, carefully selected for quality and authenticity.",
            },
            {
                "num": "04",
                "title": "Your One-Stop Spiritual Destination",
                "desc": "From Vedic Puja and Kundali Consultation to Yantras, Rudraksha, Gemstones, and Sacred Products — discover all your spiritual needs in one place.",
            },
            {
                "num": "05",
                "title": "Traditional Energisation & Guidance",
                "desc": "Selected Yantras and Rudraksha can be ritually energised by Guruji, with personalised guidance on their proper use, wearing methods, and care according to Vedic traditions.",
            },
            {
                "num": "06",
                "title": "Trusted by Yajmans Worldwide",
                "desc": "Serving yajmans across Maharashtra, India, and abroad through traditional Vedic pujas, spiritual guidance, and convenient online services.",
            },
        ],
    },
    "jyotish_section": {
        "kicker": "Jyotish Consultation",
        "title": "Kundali & Astrology",
        "subtitle": "Personalised Jyotish Guidance by Nagesh Swami Guruji",
        "wa_button_text": "📲 WhatsApp गुरुजी",
        "wa_link": "https://wa.me/919000000000",
        "form_title": "Book Your Consultation",
        "form_sub": "कृपया खालील माहिती भरा — आम्ही 24 तासांत संपर्क करू.",
        "form_note": "🔒 तुमची माहिती सुरक्षित आहे. Payment consultation confirm झाल्यावर.",
    },
    "puja_section": {
        "kicker": "Puja Services",
        "title": "Traditional Puja Services",
        "subtitle": "परंपरागत विधी, योग्य मंत्रोच्चार, शास्त्रोक्त पद्धती — तुमच्या घरी किंवा ऑनलाइन Sankalp Seva द्वारे.",
        "button_text": "Book a Puja →",
    },
    "hero_section": {
        "secondary_button_text": "Book Consultation",
        "secondary_button_url": "#jyotish",
    },
    "category_section": {
        "kicker": "Shop by Category",
        "title": "The Right Choice for You",
        "subtitle": "Every category is traditionally curated — with astrological guidance, from certified sources.",
    },
    "featured_section": {
        "kicker": "Featured",
        "title": "Our Sacred Collection",
        "subtitle": "सर्वाधिक मागणी असलेली उत्पादने — प्रमाणित, अभिमंत्रित आणि पूर्ण मार्गदर्शनासह.",
    },
    "rudraksha_section": {
        "kicker": "Rudraksha",
        "title": "रुद्राक्ष Collection",
        "subtitle": "प्रत्येक रुद्राक्ष प्रमाणित स्रोतांकडून — मुखीनुसार, आकारानुसार आणि पारंपरिक महत्त्वानुसार.",
    },
    "ratna_section": {
        "kicker": "Ratna",
        "title": "Choose Your Gemstone With Guidance",
        "subtitle": "प्रत्येक रत्न IGI / GIA प्रमाणित. पण रत्न निवड ही वैयक्तिक बाब आहे — म्हणून आम्ही मार्गदर्शन देतो.",
        "consultation_cta": "Not sure which gemstone is right for you? · Get Gemstone Consultation →",
    },
    "yantra_section": {
        "kicker": "Yantra",
        "title": "Sacred Yantra Collection",
        "subtitle": "तांब्यात हस्तनिर्मित यंत्र — अभिमंत्रण, प्राणप्रतिष्ठा व स्थापना मार्गदर्शनासह.",
    },
    "bracelets_section": {
        "kicker": "Bracelets",
        "title": "Spiritual Bracelets",
        "subtitle": "रुद्राक्ष, रत्न आणि संयोजन ब्रेसलेट — प्रत्येकासाठी धारण मार्गदर्शनासह.",
    },
    "puja_samagri_section": {
        "kicker": "Puja Samagri",
        "title": "Sacred Puja Samagri Collection",
        "subtitle": "पूजा व धार्मिक विधींसाठी आवश्यक सर्व शुद्ध व प्रमाणित साहित्य — एकाच ठिकाणी.",
    },
    "special_collections_section": {
        "kicker": "Special Collections",
        "title": "Sacred Special Collections",
        "subtitle": "विशेष पूजा, सण आणि gift sets — तुमच्या शुभ प्रसंगासाठी प्रमाणित व अभिमंत्रित.",
    },
    "video_section": {
        "kicker": "Video Experience",
        "video_url": "/videos/guruji-video.mp4",
    },
    "testimonials_section": {
        "kicker": "Testimonials",
        "title": "What Our Clients Say",
        "subtitle": "प्रत्येक अभिप्राय खरा आहे — फसवे reviews आम्ही ठेवत नाही.",
    },
    "blog_section": {
        "kicker": "Knowledge Centre",
        "title": "Blog & Learn",
        "subtitle": "रुद्राक्ष, रत्न, यंत्र आणि पूजा यांविषयी सखोल माहिती — शास्त्राधारित, सोप्या भाषेत.",
    },
    "footer_section": {
        "brand_desc": "परंपरेतून मार्गदर्शन, श्रद्धेतून समाधान. 25 वर्षांहून अधिक अनुभव — पूजा, ज्योतिष, रत्न, रुद्राक्ष, यंत्र आणि ब्रेसलेट.",
        "shloka": "॥ सर्वे भवन्तु सुखिनः ॥",
        "phone": "+91 90000 00000",
        "email": "seva@astroveda.in",
        "whatsapp_url": "https://wa.me/919000000000",
    },
}


class SiteTextService:
    SETTING_KEY = "storefront_texts"

    @classmethod
    def get_all(cls):
        """Retrieve all storefront texts, deep-merging DB overrides into defaults."""
        setting = SystemSetting.query.filter_by(key=cls.SETTING_KEY).first()
        if not setting or not setting.value:
            return json.loads(json.dumps(DEFAULT_SITE_TEXTS))

        try:
            saved = json.loads(setting.value)
        except Exception:
            saved = {}

        merged = json.loads(json.dumps(DEFAULT_SITE_TEXTS))

        for section_key, section_val in saved.items():
            if section_key not in merged:
                merged[section_key] = section_val
            elif isinstance(section_val, dict) and isinstance(merged[section_key], dict):
                merged[section_key].update(section_val)
            else:
                merged[section_key] = section_val

        return merged

    @classmethod
    def save_all(cls, new_texts):
        """Save updated storefront texts to SystemSetting in DB."""
        setting = SystemSetting.query.filter_by(key=cls.SETTING_KEY).first()
        if not setting:
            setting = SystemSetting(
                key=cls.SETTING_KEY,
                value=json.dumps(new_texts, ensure_ascii=False),
                description="Custom editable text and headings across all storefront sections",
                group_name="site_text",
            )
            db.session.add(setting)
        else:
            setting.value = json.dumps(new_texts, ensure_ascii=False)
            setting.updated_at = datetime.now(timezone.utc)

        db.session.commit()
        return setting
