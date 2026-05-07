from utils.appointment_manager import Appointment_Manager
from loguru import logger
from services.postgres_services import get_db
from models import MeetingDetail
import pandas as pd

class SuggestionWorkflows:
    def get_suggestion(self, meeting_detail: dict, attendance_details, restaurant_data: list):
        meeting_detail = meeting_detail.to_dict()
        initial_data = meeting_detail.get("initial_data", None)
        if initial_data:
            print(f"INITIAL DATA : {initial_data}")
        attendee_datas = [attendance_detail.to_dict() for attendance_detail in attendance_details]

        appointments_manager = Appointment_Manager(
            key_person = [attendee.get("user_id") for attendee in attendee_datas if attendee.get("is_key_person", False)],
            attendees = [attendee.get("user_id") for attendee in attendee_datas],
            start_date = initial_data.get("start_date"),
            end_date = initial_data.get("end_date"),
            meal_time = initial_data.get("meal_time")
        )
        
        # SECTION: SUGGEST APPOINTMENT TIME
        attendee_availability = {}
        for attendee_data in attendee_datas:

            attendee = attendee_data.get("user_id")
            # print(f"TRY TO GET AVALIABLE SLOT FROM : {attendee}")
            available_slots = appointments_manager.parase_avaliable_slots(attendee_data.get("avaliable_at", []))
            
            # Determine effective meal time preference
            global_meal_time = initial_data.get("meal_time")
            user_preference = attendee_data.get("preference") or {} # Handle None
            user_meal_time = user_preference.get("meal_time")
            
            effective_meal_time = "Any"
            
            # Prioritize Global Setting if specific (Lunch/Dinner)
            if global_meal_time and global_meal_time in ["Lunch", "Dinner"]:
                 effective_meal_time = global_meal_time
            # If Global is Any (or missing), check User Preference
            elif user_meal_time and user_meal_time in ["Lunch", "Dinner"]:
                 effective_meal_time = user_meal_time
            
            attendee_availability[attendee] = {
                "availability": available_slots,
                "preferred_meal_time": effective_meal_time
            }

        attendees_availiability = appointments_manager.get_suggested_slots(attendee_availability)

        # SECTION: SUGGEST RESTAURANTS
        suggesested_restaurants = appointments_manager.get_suggesested_restaurants(attendee_datas, attendees_availiability, fixed_restaurants=initial_data.get("fixed_restaurants", None))
        import json

        with open("./suggested_restaurants.json", "w") as f:
            json.dump(suggesested_restaurants, f, indent=4)
        return suggesested_restaurants

        
