import json
from datetime import date
from app.models.service import JyotishConsultation

def test_marriage_kundali_matching_independent_names(client, app):
    with app.app_context():
        # Case 1: Parent submits booking on behalf of groom & bride
        payload_parent = {
            "service_id": "marriage-matching",
            "topic": "Marriage Kundali Matching",
            "customer_name": "Suresh Sharma (Father)",
            "customer_phone": "9876543210",
            "customer_email": "suresh@example.com",
            "person1": {
                "name": "Rohit Sharma",
                "dob": "1995-05-15",
                "tob": "08:30 AM",
                "pob": "Pune, Maharashtra",
                "time_unknown": False,
            },
            "person2": {
                "name": "Pooja Verma",
                "dob": "1997-09-20",
                "tob": "02:15 PM",
                "pob": "Nashik, Maharashtra",
                "time_unknown": False,
            },
            "marriage_period": "Within 6 months",
        }

        res = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps(payload_parent),
            content_type="application/json",
        )
        assert res.status_code == 201
        data = res.get_json()
        consult_num = data["consultation_number"]

        consult = JyotishConsultation.query.filter_by(consultation_number=consult_num).first()
        assert consult is not None
        # Contact person is Suresh Sharma
        assert consult.customer_name == "Suresh Sharma (Father)"
        # Astrologer notes contain independent records with correct labels
        notes = consult.astrologer_notes
        assert "Contact Person: Suresh Sharma (Father)" in notes
        assert "Male / Groom Details: Rohit Sharma" in notes
        assert "Female / Bride Details: Pooja Verma" in notes
        assert "DOB: 1995-05-15" in notes
        assert "DOB: 1997-09-20" in notes

        # Case 2: Female / Bride submits booking
        payload_female = {
            "service_id": "marriage-matching",
            "topic": "Marriage Kundali Matching",
            "customer_name": "Sneha Patil",
            "customer_phone": "9822334455",
            "customer_email": "sneha@example.com",
            "person1": {
                "name": "Amit Deshmukh",
                "dob": "1994-03-10",
                "tob": "11:00 AM",
                "pob": "Kolhapur",
                "time_unknown": False,
            },
            "person2": {
                "name": "Sneha Patil",
                "dob": "1996-07-25",
                "tob": "06:45 PM",
                "pob": "Sangli",
                "time_unknown": False,
            },
        }

        res2 = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps(payload_female),
            content_type="application/json",
        )
        assert res2.status_code == 201
        data2 = res2.get_json()
        consult2 = JyotishConsultation.query.filter_by(consultation_number=data2["consultation_number"]).first()
        assert consult2.customer_name == "Sneha Patil"
        assert "Male / Groom Details: Amit Deshmukh" in consult2.astrologer_notes
        assert "Female / Bride Details: Sneha Patil" in consult2.astrologer_notes

        # Case 3: Male / Groom submits booking
        payload_male = {
            "service_id": "marriage-matching",
            "topic": "Marriage Kundali Matching",
            "customer_name": "Vikram Kulkarni",
            "customer_phone": "9811223344",
            "customer_email": "vikram@example.com",
            "person1": {
                "name": "Vikram Kulkarni",
                "dob": "1993-12-05",
                "tob": "09:15 AM",
                "pob": "Mumbai",
                "time_unknown": False,
            },
            "person2": {
                "name": "Ananya Joshi",
                "dob": "1995-04-18",
                "tob": "04:30 PM",
                "pob": "Thane",
                "time_unknown": False,
            },
        }

        res3 = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps(payload_male),
            content_type="application/json",
        )
        assert res3.status_code == 201
        data3 = res3.get_json()
        consult3 = JyotishConsultation.query.filter_by(consultation_number=data3["consultation_number"]).first()
        assert consult3.customer_name == "Vikram Kulkarni"
        assert "Male / Groom Details: Vikram Kulkarni" in consult3.astrologer_notes
        assert "Female / Bride Details: Ananya Joshi" in consult3.astrologer_notes
