import json
from datetime import datetime, timezone
from app.extensions import db
from app.models.operations import SystemSetting


DEFAULT_SECTION_ORDER = [
    {
        "key": "categories",
        "name": "Sacred Categories",
        "desc": "Browsing tiles for Rudraksha, Gemstones, Pujas, and Divine Products",
        "icon": "🗂️",
        "enabled": True,
    },
    {
        "key": "featured",
        "name": "Featured Holy Artifacts",
        "desc": "Handpicked high-demand consecrated idols and energized malas",
        "icon": "⭐",
        "enabled": True,
    },
    {
        "key": "puja",
        "name": "Vedic Puja Services",
        "desc": "Bookable traditional rituals (Kaal Sarp, Navagraha, Vastu Shanti)",
        "icon": "🪔",
        "enabled": True,
    },
    {
        "key": "jyotish",
        "name": "Jyotish & Kundali Consultation",
        "desc": "Personalized astrological guidance & birth chart analysis by Guruji",
        "icon": "🔮",
        "enabled": True,
    },
    {
        "key": "rudraksha",
        "name": "Authentic Rudraksha Beads",
        "desc": "1 to 14 Mukhi laboratory-certified Nepal and Indonesian beads",
        "icon": "📿",
        "enabled": True,
    },
    {
        "key": "ratna",
        "name": "Certified Vedic Gemstones",
        "desc": "Natural unheated astrological gemstones with authentic laboratory cards",
        "icon": "💎",
        "enabled": True,
    },
    {
        "key": "yantra",
        "name": "Sacred Energized Yantras",
        "desc": "Geometric copper and brass yantras for prosperity and protection",
        "icon": "📐",
        "enabled": True,
    },
    {
        "key": "bracelets",
        "name": "Healing Gemstone Bracelets",
        "desc": "Wrist malas and crystal energy wristbands for daily wear",
        "icon": "✨",
        "enabled": True,
    },
    {
        "key": "puja_samagri",
        "name": "Authentic Puja Samagri",
        "desc": "Pure temple dhoop, sacred gangajal, natural camphor, and puja kits",
        "icon": "🌿",
        "enabled": True,
    },
    {
        "key": "ads_banner",
        "name": "Sponsored Ads Banner",
        "desc": "Active Google AdSense, Meta, or direct promotional partner banner",
        "icon": "📢",
        "enabled": True,
    },
    {
        "key": "video",
        "name": "Sacred Video Darshan",
        "desc": "Temple ritual footage and Guruji divine guidance video",
        "icon": "🎬",
        "enabled": True,
    },
    {
        "key": "why",
        "name": "Why Choose Swami Guruji",
        "desc": "Three generations of tradition, authentic lineage, and trust",
        "icon": "🛡️",
        "enabled": True,
    },
    {
        "key": "about",
        "name": "Guruji Profile & Ashram Lineage",
        "desc": "Biography, spiritual journey, experience stats, and ashram darshan",
        "icon": "🕉️",
        "enabled": True,
    },
    {
        "key": "testimonials",
        "name": "Devotee Testimonials & Blessings",
        "desc": "Reviews, audio/text blessings, and ratings from verified devotees",
        "icon": "💬",
        "enabled": True,
    },
    {
        "key": "blog",
        "name": "Spiritual Wisdom & Blog",
        "desc": "Educational articles on festival tithis, Vedic mantras, and rituals",
        "icon": "📖",
        "enabled": True,
    },
]


class SectionService:
    SETTING_KEY = "homepage_sections_order"

    @classmethod
    def get_sections(cls):
        """Retrieve ordered sections, falling back to defaults if not yet customized."""
        setting = SystemSetting.query.filter_by(key=cls.SETTING_KEY).first()
        if not setting or not setting.value:
            return [dict(s) for s in DEFAULT_SECTION_ORDER]

        try:
            saved_list = json.loads(setting.value)
            if not isinstance(saved_list, list):
                return [dict(s) for s in DEFAULT_SECTION_ORDER]

            # Merge with default list so newly added sections are never missing
            default_map = {s["key"]: s for s in DEFAULT_SECTION_ORDER}
            result = []
            seen_keys = set()

            for item in saved_list:
                k = item.get("key")
                if k in default_map and k not in seen_keys:
                    merged = dict(default_map[k])
                    merged["enabled"] = bool(item.get("enabled", True))
                    result.append(merged)
                    seen_keys.add(k)

            # Append any defaults that were not in saved list
            for s in DEFAULT_SECTION_ORDER:
                if s["key"] not in seen_keys:
                    result.append(dict(s))

            return result
        except Exception:
            return [dict(s) for s in DEFAULT_SECTION_ORDER]

    @classmethod
    def save_sections(cls, ordered_list):
        """Save new sequence and visibility state of sections."""
        clean_list = []
        default_map = {s["key"]: s for s in DEFAULT_SECTION_ORDER}

        for item in ordered_list:
            k = item.get("key")
            if k in default_map:
                clean_list.append({
                    "key": k,
                    "enabled": bool(item.get("enabled", True)),
                })

        setting = SystemSetting.query.filter_by(key=cls.SETTING_KEY).first()
        if not setting:
            setting = SystemSetting(
                key=cls.SETTING_KEY,
                value=json.dumps(clean_list),
                description="Custom ordering and visibility for homepage sections",
                group_name="content",
            )
            db.session.add(setting)
        else:
            setting.value = json.dumps(clean_list)
            setting.updated_at = datetime.now(timezone.utc)

        db.session.commit()
        return clean_list

    @classmethod
    def reset_sections(cls):
        """Reset section order back to canonical defaults."""
        setting = SystemSetting.query.filter_by(key=cls.SETTING_KEY).first()
        if setting:
            db.session.delete(setting)
            db.session.commit()
        return [dict(s) for s in DEFAULT_SECTION_ORDER]
