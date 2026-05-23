from utils.appointment_manager import Appointment_Manager
from loguru import logger
from services.postgres_services import get_db
from models import MeetingDetail
import pandas as pd
from datetime import datetime

class SuggestionWorkflows:
    def get_suggestion(self, meeting_detail: dict, attendance_details, restaurant_data: list):
        meeting_detail = meeting_detail.to_dict()
        initial_data = meeting_detail.get("initial_data", None)
        if initial_data:
            print(f"INITIAL DATA : {initial_data}")
        attendee_datas = [attendance_detail.to_dict() for attendance_detail in attendance_details]
        suggestion_config = {
            "allow_system_suggest": initial_data.get("allow_system_suggest", True),
            "require_all_join": initial_data.get("require_all_join", True),
            "allow_others_suggest": initial_data.get("allow_others_suggest", True),
            "suggest_per_time": initial_data.get("suggest_per_time", False),
            "min_attendees": 1
        }
        
        appointments_manager = Appointment_Manager(
            key_person = [attendee.get("user_id") for attendee in attendee_datas if attendee.get("is_key_person", False)],
            attendees = [attendee.get("user_id") for attendee in attendee_datas],
            start_date = initial_data.get("start_date"),
            end_date = initial_data.get("end_date"),
            meal_time = initial_data.get("meal_time")
        )
        
        # SECTION: SUGGEST APPOINTMENT TIME
        if initial_data.get("timing_mode") == "fixed":
            # Extract fixed date and times
            fixed_date = initial_data.get("fixed_date")
            if isinstance(fixed_date, str):
                try:
                    # Attempt to parse YYYY-MM-DD format
                    fixed_date = datetime.strptime(fixed_date, "%Y-%m-%d").date()
                except ValueError:
                    # Fallback to ISO format if YYYY-MM-DD fails
                    fixed_date = datetime.fromisoformat(fixed_date.replace("Z", "+00:00")).date()
            elif isinstance(fixed_date, datetime):
                fixed_date = fixed_date.date()
            
            start_time_str = initial_data.get("fixed_start_time")
            end_time_str = initial_data.get("fixed_end_time")
            
            # Parse times and combine with date
            start_time_obj = datetime.strptime(start_time_str, "%H:%M").time()
            end_time_obj = datetime.strptime(end_time_str, "%H:%M").time()
            
            # Localize to Bangkok timezone
            start_dt = appointments_manager.TZ.localize(datetime.combine(fixed_date, start_time_obj))
            end_dt = appointments_manager.TZ.localize(datetime.combine(fixed_date, end_time_obj))
            
            # Construct the availability dictionary in the expected format
            attendees_availiability = {
                fixed_date: [{
                    'start': start_dt,
                    'end': end_dt,
                    'attendee_ratio': 100.0,
                    'attendees': appointments_manager.attendees,
                    'key_persons_ratio': 100.0,
                    'key_persons': appointments_manager.key_person,
                    'final_score': 10,
                    'scores': {},
                    'full_join': appointments_manager.attendees,
                    'partial_join': []
                }]
            }

        else:
            attendee_availability = {}
            for attendee_data in attendee_datas:

                attendee = attendee_data.get("user_id")
                # print(f"TRY TO GET AVALIABLE SLOT FROM : {attendee}")
                available_slots = appointments_manager.parase_avaliable_slots(attendee_data.get("avaliable_at", []))
                raw_intervals = appointments_manager.parse_raw_available_intervals(attendee_data.get("avaliable_at", []))
                
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
                    "raw_intervals": raw_intervals,
                    "preferred_meal_time": effective_meal_time
                }

            attendees_availiability = appointments_manager.get_suggested_slots(attendee_availability, suggestion_config)
            print('-' * 50)
            print("ATTENDANCE AVAILABILITY :")
            print('-' * 50)
            print(attendees_availiability)
            print('-' * 50)

        # SECTION: SUGGEST RESTAURANTS
        preferred_restaurants, suggested_restaurants, all_scored_restaurants = appointments_manager.get_suggesested_restaurants(
            attendee_datas=attendee_datas,
            attendees_availiability=attendees_availiability,
            suggestion_config = suggestion_config,
            fixed_restaurants=initial_data.get("fixed_restaurants", None),
            fixed_location=initial_data.get("fix_location_coords", None)
        )
        
        result = {
            "preferred_restaurants": preferred_restaurants,
            "suggested_restaurants": suggested_restaurants,
            "all_scored_restaurants": all_scored_restaurants
        }

        import json
        with open("./suggested_restaurants.json", "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=4)

        return result
