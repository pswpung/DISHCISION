import pandas as pd
from loguru import logger
from datetime import datetime, time, timedelta
import json
import os
from collections import defaultdict
import pytz
import ast
import numpy as np
from typing import Optional, Dict

class Appointment_Manager(object):
    def __init__(self, key_person, attendees, start_date, end_date, meal_time, meeting_duration_hours: int = 2, step_minutes: int = 30, key_weight: float = 0.7):
        self.DAY_START = time(hour=10)
        self.DAY_END = time(hour=23)
        self.TZ = pytz.timezone("Asia/Bangkok")
        self.MINIMUM_MEETING_DURATION_HOURS = meeting_duration_hours
        self.STEP_MINUTES = step_minutes
        self.LUNCH_CONFIG = {"start": time(hour=11), "end": time(hour=13)}
        self.DINNER_CONFIG = {"start": time(hour=17), "end": time(hour=19)}
        
        self.key_person = key_person if len(key_person) > 0 else attendees
        self.attendees = attendees
        self.start_date = start_date
        self.end_date = end_date
        self.meal_time = meal_time
        self.key_weight = key_weight

        # Load stations
        try:
            # Use path relative to this file
            dir_path = os.path.dirname(os.path.realpath(__file__))
            stations_path = os.path.join(dir_path, "..", "statics", "stations.json")
            with open(stations_path, "r") as f:
                self.stations = json.load(f)
        except Exception as e:
            logger.warning(f"Could not load stations.json at {stations_path if 'stations_path' in locals() else 'unknown'}: {e}")
            self.stations = []

    def __get_time_scoring(self, start_time, end_time, prefered_meal_time):
        
        def time_to_minutes(t):
            return t.hour * 60 + t.minute
        
        score_rules = [
            {"start": "10:00", "end": "10:30", "points": 1, "meal_time": "Lunch"},
            {"start": "10:30", "end": "11:00", "points": 1, "meal_time": "Lunch"},
            {"start": "11:00", "end": "11:30", "points": 2, "meal_time": "Lunch"},
            {"start": "11:30", "end": "12:00", "points": 2, "meal_time": "Lunch"},
            {"start": "12:00", "end": "12:30", "points": 2, "meal_time": "Lunch"},
            {"start": "12:30", "end": "13:00", "points": 2, "meal_time": "Lunch"},
            {"start": "13:00", "end": "13:30", "points": 1, "meal_time": "Lunch"},
            {"start": "13:30", "end": "14:00", "points": 1, "meal_time": "Lunch"},
            {"start": "14:00", "end": "14:30", "points": 1, "meal_time": "Lunch"},
            {"start": "14:30", "end": "15:00", "points": 1, "meal_time": "Lunch"},
            {"start": "15:00", "end": "15:30", "points": 1, "meal_time": "Dinner"},
            {"start": "15:30", "end": "16:00", "points": 1, "meal_time": "Dinner"},
            {"start": "16:00", "end": "16:30", "points": 1, "meal_time": "Dinner"},
            {"start": "16:30", "end": "17:00", "points": 1, "meal_time": "Dinner"},
            {"start": "17:00", "end": "17:30", "points": 1, "meal_time": "Dinner"},
            {"start": "17:30", "end": "18:00", "points": 1, "meal_time": "Dinner"},
            {"start": "18:00", "end": "18:30", "points": 2, "meal_time": "Dinner"},
            {"start": "18:30", "end": "19:00", "points": 2, "meal_time": "Dinner"},
            {"start": "19:00", "end": "19:30", "points": 2, "meal_time": "Dinner"},
            {"start": "19:30", "end": "20:00", "points": 2, "meal_time": "Dinner"},
            {"start": "20:00", "end": "20:30", "points": 1, "meal_time": "Dinner"},
            {"start": "20:30", "end": "21:00", "points": 1, "meal_time": "Dinner"},
            {"start": "21:00", "end": "21:30", "points": 1, "meal_time": "Dinner"},
            {"start": "21:30", "end": "22:00", "points": 1, "meal_time": "Dinner"},
            {"start": "22:00", "end": "22:30", "points": 1, "meal_time": "Dinner"},
            {"start": "22:30", "end": "23:00", "points": 1, "meal_time": "Dinner"},
        ]

        period_start_minutes = time_to_minutes(start_time)
        period_end_minutes = time_to_minutes(end_time)
        period_score = 0
        meal_time_periods = []
        meal_time_score = 0
        
        for rule in score_rules:
            rule_start_minutes = time_to_minutes(datetime.strptime(rule['start'], "%H:%M"))
            rule_end_minutes = time_to_minutes(datetime.strptime(rule['end'], "%H:%M"))
            
            # Check if the time period overlaps with the rule's period
            overlap_start = max(period_start_minutes, rule_start_minutes)
            overlap_end = min(period_end_minutes, rule_end_minutes)
            
            # If there's an overlap, add the score
            if overlap_start < overlap_end:
                period_score += rule['points']
                meal_time_periods.append(rule['meal_time'])
        
        meal_time_lunch = meal_time_periods.count("Lunch") * prefered_meal_time["Lunch"]
        meal_time_dinner = meal_time_periods.count("Dinner") * prefered_meal_time["Dinner"]
        meal_time_score = meal_time_lunch + meal_time_dinner
        
        return period_score, meal_time_score
    
    def create_meeting(self):
        event_name = input("Enter the event name (e.g. John Doe's Birthday): ") or "John Doe's Birthday"
        start_date = input("Enter the organizer meeting start date (e.g. 12/09/2025): ") or "1/09/2025"
        end_date = input("Enter the organizer meeting end date (e.g. 30/09/2025): ") or "30/09/2025"
        attendees = input("Enter the attendee names (e.g. John Doe, Jane Doe): ") or "pao, alice, bob, diana, fiona, george"
        key_person = input("Enter the key person name (e.g. John Doe): ") or "alice, bob"
        meal_time = input("Please choose one: [Lunch / Dinner / Any]: ") or "Any"
        
        start_date = datetime.strptime(start_date, "%d/%m/%Y")
        start_date.astimezone(self.TZ)
        end_date = datetime.strptime(end_date, "%d/%m/%Y")
        end_date.astimezone(self.TZ)
        attendees = attendees.strip().split(", ")
        key_person = key_person.strip().split(", ")
        
        meeting_data = {
            "event_name": event_name,
            "start_date": start_date,
            "end_date": end_date,
            "attendees": attendees,
            "key_person": key_person,
            "meal_time": meal_time
        }
        self.key_person = key_person
        self.attendees = attendees
        self.start_date = start_date
        self.end_date = end_date
        self.meal_time = meal_time
        return meeting_data
    
    def parase_avaliable_slots(self, attendee_avaliablity):
        """
        Get the Google Calendar data for the attendee
        """
        calendar_data = []
        raw_data = attendee_avaliablity
        for each_slot in raw_data:
            slot_start = datetime.strptime(each_slot["start"]["dateTime"], "%Y-%m-%dT%H:%M:%S%z")
            slot_end = datetime.strptime(each_slot["end"]["dateTime"], "%Y-%m-%dT%H:%M:%S%z")
            calendar_data.append({
                "start": slot_start.astimezone(self.TZ),
                "end": slot_end.astimezone(self.TZ),
                "is_available" : each_slot["is_avaliable"]
            })
        available_slots = self.get_available_slots(calendar_data)
        print(f"DEBUG: Parsed {len(available_slots)} dates with available slots")
        return available_slots

    def get_raw_available_intervals(self, data: list):
        results = {}
        avail = [
            slot for slot in data
            if slot.get("is_available", True)
        ]
        if avail != []:
            grouped = defaultdict(list)
            for slot in avail:
                grouped[slot["start"].date()].append(slot)
            for date, slots in grouped.items():
                slots = sorted(slots, key=lambda x: x["start"])
                merged = []
                for slot in slots:
                    s, e = slot["start"], slot["end"]
                    if not merged or merged[-1]["end"] < s:
                        merged.append({"start": s, "end": e})
                    else:
                        merged[-1]["end"] = max(merged[-1]["end"], e)
                results[date] = merged
            return results

        unavail = [
            slot for slot in data 
            if not slot.get("is_available", True)
        ]
        if unavail != []:
            grouped = defaultdict(list)
            for slot in unavail:
                grouped[slot["start"].date()].append(slot)

            for date, slots in grouped.items():
                slots = sorted(slots, key=lambda x: x["start"])
                intervals = []

                start = self.TZ.localize(datetime.combine(date, self.DAY_START))
                end = self.TZ.localize(datetime.combine(date, self.DAY_END))

                current = start
                for slot in slots:
                    s, e = slot["start"], slot["end"]
                    if current < s:
                        intervals.append({"start": current, "end": s})
                    current = max(current, e)
                if current < end:
                    intervals.append({"start": current, "end": end})
                results[date] = intervals
            return results
        return results

    def parse_raw_available_intervals(self, attendee_avaliablity_list):
        calendar_data = []
        for each_slot in attendee_avaliablity_list:
            slot_start = datetime.strptime(each_slot["start"]["dateTime"], "%Y-%m-%dT%H:%M:%S%z")
            slot_end = datetime.strptime(each_slot["end"]["dateTime"], "%Y-%m-%dT%H:%M:%S%z")
            calendar_data.append({
                "start": slot_start.astimezone(self.TZ),
                "end": slot_end.astimezone(self.TZ),
                "is_available" : each_slot["is_avaliable"]
            })
        return self.get_raw_available_intervals(calendar_data)

    def calculate_overlap_minutes(self, slot_start, slot_end, attendee_raw_intervals):
        total_overlap = 0.0
        for interval in attendee_raw_intervals:
            overlap_start = max(slot_start, interval["start"])
            overlap_end = min(slot_end, interval["end"])
            if overlap_start < overlap_end:
                total_overlap += (overlap_end - overlap_start).total_seconds() / 60
        return total_overlap

    def format_overlap_time(self, minutes):
        hours = minutes / 60.0
        if hours == 1.0:
            return "1 hr"
        elif hours == 1.5:
            return "1.5 hr"
        elif hours == 2.0:
            return "2 hr"
        elif hours == 0.5:
            return "30 mins"
        elif hours == 0.0:
            return "0 mins"
        else:
            h = int(minutes // 60)
            m = int(minutes % 60)
            parts = []
            if h > 0:
                parts.append(f"{h} hr")
            if m > 0:
                parts.append(f"{m} mins")
            return " ".join(parts) if parts else "0 mins"
    
    def get_available_slots(self, data: list):
        results = {}
        avail = [
            slot for slot in data
            if slot.get("is_available", True)
        ]
        if avail != []:
            # Group unavailable slots by date
            grouped = defaultdict(list)
            for slot in avail:
                grouped[slot["start"].date()].append(slot)
            
            for date, slots in grouped.items():
                available = []
                for slot in slots:
                    available.extend(self._split_into_steps(slot.get("start"), slot.get("end")))
                results[date] = available

        unavail = [
            slot for slot in data 
            if not slot.get("is_available", True)
        ]
        
        if unavail != []:
            # Group unavailable slots by date
            grouped = defaultdict(list)
            for slot in unavail:
                grouped[slot["start"].date()].append(slot)

            for date, slots in grouped.items():
                slots = sorted(slots, key=lambda x: x["start"])
                available = []

                start = self.TZ.localize(datetime.combine(date, self.DAY_START))
                end = self.TZ.localize(datetime.combine(date, self.DAY_END))

                current = start
                for slot in slots:
                    s, e = slot["start"], slot["end"]
                    if current < s:
                        available.extend(self._split_into_steps(current, s))
                    current = max(current, e)
                if current < end:
                    available.extend(self._split_into_steps(current, end))

                results[date] = available
        return results

    def _split_into_steps(self, start, end):
        """Split a big available window into small STEP periods."""
        sessions = []
        aligned_start = start.replace(second=0, microsecond=0)
        minutes = (aligned_start.minute // self.STEP_MINUTES) * self.STEP_MINUTES
        aligned_start = aligned_start.replace(minute=minutes)

        if aligned_start < start:
            aligned_start += timedelta(minutes=self.STEP_MINUTES)

        cur = aligned_start
        while cur < end:
            cur_end = cur + timedelta(hours=self.MINIMUM_MEETING_DURATION_HOURS)
            next_cur = cur + timedelta(minutes=self.STEP_MINUTES)
            
            if cur_end <= end:
                sessions.append({"start": cur, "end": cur_end})
                
            cur = next_cur

        return sessions

    def __get_similarity_availability(self, attendees: list, key_persons: list, attendee_availability: dict, min_attendees: int = 1):
        """
        Get the similarity availability
        """
        similarity_availability = {}
        all_dates = set()
        for attendee in attendees:
            all_dates.update(attendee_availability.get(attendee, {}).get("availability", {}).keys())
        
        for date in all_dates:
            all_times = self._split_into_steps(
                start = self.TZ.localize(datetime.combine(date, self.DAY_START)),
                end = self.TZ.localize(datetime.combine(date, self.DAY_END))
            )
            availability_time = []
            for time in all_times:
                availiable_lists = []
                for attendee in attendees:
                    availability = attendee_availability.get(attendee, {}).get("availability")
                    if date in availability.keys():
                        if time in availability.get(date, {}):
                            availiable_lists.append(attendee)
                
                availiable_key_persons = list(set(key_persons).intersection(set(availiable_lists)))
                
                # Debug log for overlap
                if len(availiable_lists) > 0:
                    print(f"DEBUG: Slot {time['start'].strftime('%H:%M')} | Avail: {len(availiable_lists)}/{len(attendees)} | KP: {len(availiable_key_persons)}/{len(key_persons)}")
                
                if len(availiable_lists) >= min_attendees:
                    # if len(availiable_lists) == 1:
                    #     pass
                    # else:
                    #     attendees_scoring = {
                    #         "attendee_ratio": round((len(availiable_lists) / len(attendees)) * 100, 2),
                    #         "attendees" : availiable_lists,
                    #         "key_persons_ratio": round((len(availiable_key_persons) / len(key_persons)) * 100, 2),
                    #         "key_persons": availiable_key_persons
                    #     }
                    #     availability_time.append({**time, **attendees_scoring})
                    attendees_scoring = {
                        "attendee_ratio": round((len(availiable_lists) / len(attendees)) * 100, 2),
                        "attendees" : availiable_lists,
                        "key_persons_ratio": round((len(availiable_key_persons) / len(key_persons)) * 100, 2),
                        "key_persons": availiable_key_persons
                    }
                    availability_time.append({**time, **attendees_scoring})
            if availability_time != []:                  
                similarity_availability[date] = availability_time
        return similarity_availability

    def get_suggested_slots(self, attendee_availiability: dict, suggestion_config: dict = None):
        """
        Get the suggested slots for the meeting
        """
        require_all_join = suggestion_config.get("require_all_join", False) if suggestion_config else False
        
        preferred_meal_time: dict = {"Lunch": 0, "Dinner": 0, "Any": 0}
        for attendee in attendee_availiability:
            preferred_meal_time[attendee_availiability.get(attendee, {}).get("preferred_meal_time")] += 1
        
        total_attendees = sum(preferred_meal_time.values())
        min_attendees = suggestion_config.get("min_attendees", 1) if suggestion_config else 1
        attendees_availiability: dict = self.__get_similarity_availability(
            attendees=self.attendees, 
            key_persons=self.key_person, 
            attendee_availability=attendee_availiability,
            min_attendees=min_attendees
        )
        
        print(f"DEBUG: Similarity availability found dates: {list(attendees_availiability.keys())}")
        
        filtered_availability = {}
        for date, avail_times in attendees_availiability.items():
            print(f"DEBUG: Processing date {date} with {len(avail_times)} slots")
            valid_times = []
            for avail_time in avail_times:
                # 1. Compute Full Join vs Partial Join first
                slot_start = avail_time["start"]
                slot_end = avail_time["end"]
                slot_duration_minutes = (slot_end - slot_start).total_seconds() / 60
                
                full_join = []
                partial_join = []
                
                for attendee in self.attendees:
                    if attendee in avail_time.get("attendees", []):
                        full_join.append(attendee)
                    else:
                        # Get their raw intervals for this date
                        attendee_data_item = attendee_availiability.get(attendee, {})
                        raw_intervals = attendee_data_item.get("raw_intervals", {}).get(date, [])
                        overlap = self.calculate_overlap_minutes(slot_start, slot_end, raw_intervals)
                        if overlap >= slot_duration_minutes:
                            full_join.append(attendee)
                        elif overlap > 0:
                            partial_join.append({
                                "user_id": attendee,
                                "overlap_minutes": overlap,
                                "overlap_text": self.format_overlap_time(overlap)
                            })
                
                # Filter out slots with only 1 person if the meeting has > 1 attendee total
                total_slot_participants = len(full_join) + len(partial_join)
                if len(self.attendees) > 1 and total_slot_participants <= 1:
                    continue

                # Calculate adjusted key person and attendee ratios
                full_kp_count = sum(1 for kp in self.key_person if kp in full_join)
                full_at_count = sum(1 for at in self.attendees if at in full_join)
                
                partial_kp_weighted = 0.0
                partial_at_weighted = 0.0
                for p in partial_join:
                    weight = p["overlap_minutes"] / slot_duration_minutes
                    if p["user_id"] in self.key_person:
                        partial_kp_weighted += weight
                    if p["user_id"] in self.attendees:
                        partial_at_weighted += weight
                
                adjusted_kp_count = full_kp_count + partial_kp_weighted
                adjusted_at_count = full_at_count + partial_at_weighted
                
                kp_ratio = (adjusted_kp_count / len(self.key_person)) * 100.0 if len(self.key_person) > 0 else 0.0
                at_ratio = (adjusted_at_count / len(self.attendees)) * 100.0 if len(self.attendees) > 0 else 0.0

                # 2. Get Base Scores
                points, meal_time_scores = self.__get_time_scoring(slot_start, slot_end, preferred_meal_time)
                avail_time["points"] = points
                avail_time["meal_time_scores"] = meal_time_scores
                
                # 3. Calculate Final Score Components (0-10 Scale)
                # Normalized Availability (Weight: 50%)
                raw_avail = ((kp_ratio * self.key_weight) + (at_ratio * (1.0 - self.key_weight))) / 10.0
                norm_avail = 1 + (raw_avail / 10.0) * 9.0
                
                # Meal Preference Alignment (Weight: 30%)
                duration_minutes = (slot_end - slot_start).total_seconds() / 60
                steps = duration_minutes / 30
                max_meal_score = steps * total_attendees if total_attendees > 0 else 1
                
                raw_meal = 0
                if max_meal_score > 0:
                    raw_meal = (meal_time_scores / max_meal_score) * 10.0
                norm_meal = 1 + (raw_meal / 10.0) * 9.0
                
                # Time Quality / Standard Hours (Weight: 20%)
                max_points = steps * 2
                raw_quality = 0
                if max_points > 0:
                    raw_quality = (points / max_points) * 10.0
                norm_quality = 1 + (raw_quality / 10.0) * 9.0
                
                # 4. Final Weighted Score
                final_score = (0.7 * norm_avail) + (0.2 * norm_meal) + (0.1 * norm_quality)
                
                avail_time["full_join"] = full_join
                avail_time["partial_join"] = partial_join

                # Store Step Scores
                avail_time["scores"] = {
                    "availability": round(norm_avail, 1),
                    "time_quality": round(norm_quality, 1)
                }
                avail_time["final_score"] = round(final_score, 1)
                valid_times.append(avail_time)
            
            if valid_times:
                filtered_availability[date] = valid_times
                
        return filtered_availability

    def __extract_preference(self, attendee_preferences_df: pd.DataFrame):
        # Extract preferred_restaurants IDs if available
        preferred_restaurants_list = []
        seen_ids = set()
        preferred_counts = {}
        if "preferred_restaurant" in attendee_preferences_df.columns:
             # Use apply to handle potential NaNs safely before explode
             raw_prefs = attendee_preferences_df["preferred_restaurant"].dropna()
             for item in raw_prefs:
                  if isinstance(item, list):
                       for p in item:
                             # Expected format: Object/Dict with 'id'
                             if isinstance(p, dict):
                                 pid = p.get('id')
                                 if pid is not None: 
                                     sid = str(pid)
                                     preferred_counts[sid] = preferred_counts.get(sid, 0) + 1
                                     if sid not in seen_ids:
                                         preferred_restaurants_list.append(p)
                                         seen_ids.add(sid)
                             # Fallback: String (Assume ID or Name?) User said ID, so let's check exact match
                             elif isinstance(p, (str, int)):
                                 sid = str(p)
                                 preferred_counts[sid] = preferred_counts.get(sid, 0) + 1
                  elif isinstance(item, (str, int)):
                       sid = str(item)
                       preferred_counts[sid] = preferred_counts.get(sid, 0) + 1
        
        return {
            "count" : attendee_preferences_df.shape[0],
            "price": attendee_preferences_df["price"].value_counts().to_dict(),
            "category": attendee_preferences_df["category"].explode().value_counts().to_dict(),
            "avoid_categories": attendee_preferences_df["avoid_categories"].explode().value_counts().to_dict() if "avoid_categories" in attendee_preferences_df.columns else {},
            "unique_good_fors": attendee_preferences_df["good_fors"].explode().value_counts().to_dict(),
            "parking": attendee_preferences_df["parking"].value_counts().to_dict(),
            "alcohols": attendee_preferences_df["alcohols"].value_counts().to_dict(),
            "lat": float(attendee_preferences_df["lat"].mean()) if pd.notna(attendee_preferences_df["lat"].mean()) else 0.0,
            "lng": float(attendee_preferences_df["lng"].mean()) if pd.notna(attendee_preferences_df["lng"].mean()) else 0.0,
            "preferred_restaurants": preferred_counts,
            "preferred_restaurants_list": preferred_restaurants_list
        }

    def __haversine(self, lat1, lon1, lat2, lon2):
        # Radius of Earth in kilometers
        R = 6371.0
        
        # Convert degrees to radians
        lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        c = 2 * np.arcsin(np.sqrt(a))
        return R * c

    def _get_distance_to_nearest_station(self, lat, lng):
        """Calculate distance to the nearest station in km. Returns (dist, name)"""
        if not self.stations:
            return 999.0, "None"
        
        min_dist = float('inf')
        nearest_station = "None"
        for station in self.stations:
            d = self.__haversine(lat, lng, station['lat'], station['lng'])
            if d < min_dist:
                min_dist = d
                nearest_station = station.get('name', 'Unknown')
        return min_dist, nearest_station

    def _is_open(self, restaurant_row, start_time: datetime, end_time: datetime):
        """
        Check if the restaurant is open during the meeting slot.
        opening_hours example: 
        [{'day': 1, 'from': '10:30', 'to': '19:30'}, ...]
        day: 1 (Monday) - 7 (Sunday)
        """
        try:
            opening_hours_str = restaurant_row.get('opening_hours')
            if pd.isna(opening_hours_str) or not opening_hours_str:
                return True # Assume open if no data

            if isinstance(opening_hours_str, str):
                opening_hours = ast.literal_eval(opening_hours_str)
            else:
                opening_hours = opening_hours_str
            
            if not isinstance(opening_hours, list):
                return True

            # Get meeting day (1=Monday, 7=Sunday)
            meeting_day = start_time.isoweekday()
            
            # Find rules for this day
            todays_rules = [obs for obs in opening_hours if obs.get('day') == meeting_day]
            if not todays_rules:
                return False # Closed today

            # Check coverage
            # We need the restaurant to be open from start_time to end_time
            meeting_start_str = start_time.strftime("%H:%M")
            meeting_end_str = end_time.strftime("%H:%M")
            
            for rule in todays_rules:
                # Simple check: rule['from'] <= meeting_start AND rule['to'] >= meeting_end
                # This assumes simple ranges without overnight shifts for now
                if rule.get('from') <= meeting_start_str and rule.get('to') >= meeting_end_str:
                    return True
            
            return False
        except Exception as e:
            logger.warning(f"Error checking if restaurant is open: {e}")
            return True

    def _calculate_user_roc_weights(self, priorities, pref=None):
        """
        Calculate ROC weights for a single user's priorities.
        priorities is a list of lists of strings, e.g. [["Price", "Category"], ["Vibe"]]
        """
        # If the user has a non-empty free_text preference (AI Craving Mode)
        if pref and pref.get('free_text'):
            return {
                'Price': 0.0,
                'Category': 0.0,
                'Vibe': 0.0,
                'Station': 0.0,
                'Rating': 0.0,
                'Parking': 0.0,
                'Alcohol': 0.0,
                'AICraving': 1.0
            }

        # Convert legacy format (list of strings) to list of lists of strings
        normalized = []
        if isinstance(priorities, list):
            for item in priorities:
                if isinstance(item, str):
                    normalized.append([item])
                elif isinstance(item, list):
                    normalized.append(item)
        else:
            normalized = []
            
        # 1. Flatten and count total items k
        flat_items = []
        for group in normalized:
            flat_items.extend(group)
            
        k = len(flat_items)
        all_factors = ['Price', 'Category', 'Vibe', 'Station', 'Rating', 'Parking', 'Alcohol', 'AICraving']
        
        if k == 0:
            # Fallback: all standard factors get equal weight (AICraving gets 0.0)
            return {
                'Price': 1.0 / 7.0,
                'Category': 1.0 / 7.0,
                'Vibe': 1.0 / 7.0,
                'Station': 1.0 / 7.0,
                'Rating': 1.0 / 7.0,
                'Parking': 1.0 / 7.0,
                'Alcohol': 1.0 / 7.0,
                'AICraving': 0.0
            }
            
        # 2. Calculate ROC weights for k items
        # Wr = (1/k) * sum_{j=r}^k (1/j)
        roc_weights = []
        for r in range(1, k + 1):
            w_r = sum(1.0 / j for j in range(r, k + 1)) / k
            roc_weights.append(w_r)
            
        # 3. Assign weights to groups
        user_weights = {f: 0.0 for f in all_factors}
        current_rank_idx = 0
        for group in normalized:
            group_size = len(group)
            if group_size == 0:
                continue
                
            # Get ROC weights for the ranks this group covers
            group_weights = roc_weights[current_rank_idx : current_rank_idx + group_size]
            avg_weight = sum(group_weights) / group_size
            
            for item in group:
                key = item
                # Normalize frontend names to backend keys
                if key in ['Vibe/Good For', 'Vibe']: key = 'Vibe'
                if key in ['Distance from BTS', 'Distance', 'Station']: key = 'Station'
                if key in all_factors:
                    user_weights[key] = avg_weight
                
            current_rank_idx += group_size
            
        return user_weights

    def calculate_restaurant_score(self, attendee_preference: dict, restaurant_row: dict, weights: dict = None):
        """
        Calculate a dynamic score (0-100) for a restaurant based on a SINGLE attendee's preferences.
        Uses weights from the attendee's personal ROC calculation.
        """
        if not weights:
            # Fallback
            weights = {
                'Price': 1.0/7.0,
                'Category': 1.0/7.0,
                'Vibe': 1.0/7.0,
                'Station': 1.0/7.0,
                'Rating': 1.0/7.0,
                'Parking': 1.0/7.0,
                'Alcohol': 1.0/7.0,
                'AICraving': 0.0
            }

        score = 0.0
        reason = {}
        
        # Helper to normalize strings for comparison
        def normalize_str(s):
            import re
            return re.sub(r'[^a-zA-Z0-9\u0E00-\u0E7F]', '', str(s))

        try:
            res_lat = float(restaurant_row.get('lat', 0) or 0)
            res_lng = float(restaurant_row.get('lng', 0) or 0)
            res_rating = float(restaurant_row.get('rating', 0) or 0)
        except (ValueError, TypeError, AttributeError):
            res_lat, res_lng, res_rating = 0.0, 0.0, 0.0

        # --- A. Price ---
        w_price = weights.get('Price', 0.0)
        p_score = 0.0
        if w_price > 0:
            pref_price = attendee_preference.get('price')
            res_price = restaurant_row.get('price')
            
            # If no price preference is set, or if they set "Any", it matches 100%
            if not pref_price or pref_price == 'Any':
                p_score = 100.0
            else:
                p_score = 100.0 if normalize_str(res_price) == normalize_str(pref_price) else 0.0
                
            score += w_price * p_score
            reason["Price"] = {"score": round(w_price * p_score, 1), "max": w_price * 100.0, "base": p_score}

        # --- B. Category ---
        w_cat = weights.get('Category', 0.0)
        c_score = 0.0
        if w_cat > 0:
            try:
                res_cats = restaurant_row.get('category', [])
                if isinstance(res_cats, str):
                    res_cats = set(ast.literal_eval(res_cats))
                else:
                    res_cats = set(res_cats)
                
                pref_cats = attendee_preference.get('category', [])
                # If no preferred categories are specified, default to 100% (neutral match)
                if not pref_cats:
                    c_score = 100.0
                else:
                    # check if any preferred category overlaps with restaurant categories
                    overlap = [c for c in pref_cats if c in res_cats]
                    c_score = 100.0 if overlap else 0.0
            except Exception as e:
                logger.warning(f"Error parsing categories: {e}")
                c_score = 0.0
                
            score += w_cat * c_score
            reason["Category"] = {"score": round(w_cat * c_score, 1), "max": w_cat * 100.0, "base": c_score}

        # --- C. Vibe / Good For ---
        w_vibe = weights.get('Vibe', 0.0)
        v_score = 0.0
        if w_vibe > 0:
            try:
                res_gf = restaurant_row.get('good_fors', [])
                if isinstance(res_gf, str):
                    res_gf = set(ast.literal_eval(res_gf))
                else:
                    res_gf = set(res_gf)
                    
                pref_gf = attendee_preference.get('good_fors', [])
                if not pref_gf:
                    v_score = 100.0
                elif len(res_gf) == 0:
                    v_score = 100.0  # Neutral fallback for missing database attributes
                else:
                    overlap_count = len([g for g in pref_gf if g in res_gf])
                    pref_count = len(pref_gf)
                    
                    if overlap_count == 0:
                        v_score = 0.0
                    elif pref_count == 1:
                        v_score = 100.0
                    else:
                        # Base score of 70 for first match, scaling remaining 30 points for subsequent matches
                        v_score = 70.0 + ((overlap_count - 1) / (pref_count - 1)) * 30.0
            except Exception as e:
                logger.warning(f"Error parsing vibes: {e}")
                v_score = 0.0
                
            score += w_vibe * v_score
            reason["Vibe"] = {"score": round(w_vibe * v_score, 1), "max": w_vibe * 100.0, "base": round(v_score, 1)}

        # --- D. Station Proximity (Distance from BTS) ---
        w_station = weights.get('Station', 0.0)
        s_score = 0.0
        if w_station > 0:
            station_dist, station_name = self._get_distance_to_nearest_station(res_lat, res_lng)
            # Retrieve user-specific walk limit (in meters), default to 1000m
            max_walk_m = attendee_preference.get('max_walk_distance', 1000)
            try:
                max_walk_km = float(max_walk_m) / 1000.0
            except (ValueError, TypeError):
                max_walk_km = 1.0 # 1km fallback
                
            s_score = max(0.0, (1.0 - (station_dist / max_walk_km))) * 100.0 if station_dist < max_walk_km else 0.0
            
            score += w_station * s_score
            reason["Station"] = {
                "score": round(w_station * s_score, 1),
                "max": w_station * 100.0,
                "base": round(s_score, 1),
                "dist_km": round(station_dist, 2),
                "nearest_station": station_name
            }

        # --- E. Rating ---
        w_rating = weights.get('Rating', 0.0)
        r_score = 0.0
        if w_rating > 0:
            r_score = (res_rating / 5.0) * 100.0
            score += w_rating * r_score
            reason["Rating"] = {"score": round(w_rating * r_score, 1), "max": w_rating * 100.0, "base": r_score}

        # --- F. Parking ---
        w_parking = weights.get('Parking', 0.0)
        pk_score = 0.0
        if w_parking > 0:
            res_parking = "มีที่จอดรถ" in str(restaurant_row.get('parking', ''))
            req_parking = attendee_preference.get('parking', False)
            if not req_parking:
                pk_score = 100.0
            else:
                pk_score = 100.0 if res_parking else 0.0
                
            score += w_parking * pk_score
            reason["Parking"] = {"score": round(w_parking * pk_score, 1), "max": w_parking * 100.0, "base": pk_score}

        # --- G. Alcohol ---
        w_alcohol = weights.get('Alcohol', 0.0)
        alc_score = 0.0
        if w_alcohol > 0:
            res_alcohol_list = restaurant_row.get('alcohols')
            has_alcohol = isinstance(res_alcohol_list, list) and len(res_alcohol_list) > 0
            if not has_alcohol and isinstance(res_alcohol_list, str):
                try:
                    res_alcohol_list = ast.literal_eval(res_alcohol_list)
                    has_alcohol = isinstance(res_alcohol_list, list) and len(res_alcohol_list) > 0
                except:
                    has_alcohol = False
                    
            req_alcohol = attendee_preference.get('alcohols', False)
            if not req_alcohol:
                alc_score = 100.0
            else:
                alc_score = 100.0 if has_alcohol else 0.0
                
            score += w_alcohol * alc_score
            reason["Alcohol"] = {"score": round(w_alcohol * alc_score, 1), "max": w_alcohol * 100.0, "base": alc_score}

        # --- H. AI Craving ---
        w_craving = weights.get('AICraving', 0.0)
        cr_score = 0.0
        if w_craving > 0:
            query_vector = attendee_preference.get('query_vector')
            res_emb = restaurant_row.get('embedding')
            if query_vector is not None and res_emb is not None:
                # Dot product is equivalent to cosine similarity since embeddings are normalized
                cos_sim = float(np.dot(res_emb, query_vector))
                cr_score = max(0.0, cos_sim) * 100.0
            else:
                cr_score = 100.0 # Neutral match if no craving query is provided by this attendee
                
            score += w_craving * cr_score
            reason["AICraving"] = {"score": round(w_craving * cr_score, 1), "max": w_craving * 100.0, "base": cr_score}

        # Return score out of 100
        return round(min(score, 100.0), 1), reason
    
    def _get_summary(self, datas, points_per_vote=5.0):
        if not datas:
            return {"count": 0, "price": {}, "category": {}, "unique_good_fors": {}, "parking": {}, "alcohols": {}, "lat": 0, "lng": 0, "preferred_restaurants": {}, "points_per_vote": points_per_vote }
        
        df = pd.DataFrame(datas)
        expanded_cols = pd.json_normalize(df['preference'])
        df = df.drop(columns=['preference']).join(expanded_cols)
        summary = self.__extract_preference(df)
        summary['points_per_vote'] = points_per_vote
        return summary

    def _calculate_weighted_score(self, row, key_persons_data, general_persons_data, user_details=None):
        attendee_scores = {}
        
        # 1. Calculate score for Key Persons group
        key_scores = []
        key_reasons = []
        for attendee in key_persons_data:
            pref = attendee.get('preference', {}) or {}
            priorities = pref.get('priorities', [])
            weights = self._calculate_user_roc_weights(priorities, pref)
            score, reason = self.calculate_restaurant_score(pref, row, weights)
            key_scores.append(score)
            key_reasons.append(reason)
            
            user_id = attendee.get('userId') or attendee.get('user_id')
            if user_id and user_details and user_id in user_details:
                user_info = user_details[user_id]
                display_name = user_info.display_name
                picture_url = user_info.pictureurl
            else:
                display_name = attendee.get('displayName') or attendee.get('display_name') or user_id or "Unknown"
                picture_url = attendee.get('pictureUrl') or attendee.get('picture_url')
            
            attendee_scores[user_id] = {
                "name": display_name,
                "score": round(score, 1),
                "pictureUrl": picture_url
            }
            
        score_key = sum(key_scores) / len(key_scores) if key_scores else 0.0
        
        # 2. Calculate score for General Persons group
        gen_scores = []
        gen_reasons = []
        for attendee in general_persons_data:
            pref = attendee.get('preference', {}) or {}
            priorities = pref.get('priorities', [])
            weights = self._calculate_user_roc_weights(priorities, pref)
            score, reason = self.calculate_restaurant_score(pref, row, weights)
            gen_scores.append(score)
            gen_reasons.append(reason)
            
            user_id = attendee.get('userId') or attendee.get('user_id')
            if user_id and user_details and user_id in user_details:
                user_info = user_details[user_id]
                display_name = user_info.display_name
                picture_url = user_info.pictureurl
            else:
                display_name = attendee.get('displayName') or attendee.get('display_name') or user_id or "Unknown"
                picture_url = attendee.get('pictureUrl') or attendee.get('picture_url')
            
            attendee_scores[user_id] = {
                "name": display_name,
                "score": round(score, 1),
                "pictureUrl": picture_url
            }
            
        score_gen = sum(gen_scores) / len(gen_scores) if gen_scores else 0.0
        
        # 3. Combine scores using key_weight
        if key_scores and gen_scores:
            final_score = (score_key * self.key_weight) + (score_gen * (1.0 - self.key_weight))
        elif key_scores:
            final_score = score_key
        else:
            final_score = score_gen
            
        # 4. Combine reasons for debugging UI
        combined_reason = {}
        combined_reason["_attendee_scores"] = attendee_scores
        all_criteria = ['Price', 'Category', 'Vibe', 'Station', 'Rating', 'Parking', 'Alcohol']
        
        for criterion in all_criteria:
            # Average base score (0-100) for key group
            k_bases = [r.get(criterion, {}).get("base", 0.0) for r in key_reasons if criterion in r]
            k_avg_base = sum(k_bases) / len(k_bases) if k_bases else 0.0
            
            # Average base score (0-100) for general group
            g_bases = [r.get(criterion, {}).get("base", 0.0) for r in gen_reasons if criterion in r]
            g_avg_base = sum(g_bases) / len(g_bases) if g_bases else 0.0
            
            # Weighted criteria scores (weights * base) - sum across all attendees
            k_weighted = [r.get(criterion, {}).get("score", 0.0) for r in key_reasons if criterion in r]
            g_weighted = [r.get(criterion, {}).get("score", 0.0) for r in gen_reasons if criterion in r]
            w_score = sum(k_weighted) + sum(g_weighted)
            
            # Max possible score for this criterion - sum across all attendees
            k_max = [r.get(criterion, {}).get("max", 0.0) for r in key_reasons if criterion in r]
            g_max = [r.get(criterion, {}).get("max", 0.0) for r in gen_reasons if criterion in r]
            max_w = sum(k_max) + sum(g_max)
                
            combined_reason[criterion] = {
                "key_ratio": round(k_avg_base, 1),
                "attendee_ratio": round(g_avg_base, 1),
                "weighted_score": round(w_score, 1),
                "max_score": round(max_w, 1),
                "base_score": round((k_avg_base + g_avg_base) / 2.0, 1) if (key_reasons and gen_reasons) else round(k_avg_base or g_avg_base, 1)
            }
            
        return round(final_score, 1), combined_reason

    def get_suggesested_restaurants(self, attendee_datas: list, attendees_availiability: dict, suggestion_config: dict, fixed_restaurants: Optional[list] = None, fixed_location: Optional[Dict[str, float]] = None, user_details: Optional[Dict[str, dict]] = None):
        print(f"""      >> ALLOW OTHER SUGGESTION : {suggestion_config.get("allow_others_suggest", None)}""")
        # FAST PATH: Organizer Fixed Restaurants
        if suggestion_config.get("allow_system_suggest", None) == False and len(fixed_restaurants) > 0:
            logger.info("Fixed restaurants provided. Bypassing suggestion algorithm.")
            
            # Pre-calculate counts from all attendee preferences
            attendee_counts = {}
            for attendee_data in attendee_datas:
                prefs = attendee_data.get("preference", {}) or {}
                for r in prefs.get("preferred_restaurant", []):
                    rid = str(r.get('id'))
                    attendee_counts[rid] = attendee_counts.get(rid, 0) + 1

            formatted_list = []
            seen_ids = set()
            
            # 1. Organizer Fixed
            for r in fixed_restaurants:
                r_dict = dict(r)
                rid = str(r_dict.get('id'))
                r_dict['score'] = 100.0
                r_dict['reason'] = {"Fixed": {"key_ratio": 100, "attendee_ratio": 100, "max_score": 100}}
                r_dict['suggestion_count'] = max(1, attendee_counts.get(rid, 0))
                if rid not in seen_ids:
                    formatted_list.append(r_dict)
                    seen_ids.add(rid)
            
            # 2. Attendee Suggested
            for attendee_data in attendee_datas:
                prefs = attendee_data.get("preference", {}) or {}
                for r in prefs.get("preferred_restaurant", []):
                    r_dict = dict(r)
                    rid = str(r_dict.get('id'))
                    if rid not in seen_ids:
                        r_dict['score'] = 100.0
                        r_dict['reason'] = {"Suggested": {"key_ratio": 0, "attendee_ratio": 100, "max_score": 100}}
                        r_dict['suggestion_count'] = max(1, attendee_counts.get(rid, 0))
                        formatted_list.append(r_dict)
                        seen_ids.add(rid)
            
            # Sort by suggestion count desc
            unique_fixed = sorted(formatted_list, key=lambda x: x.get('suggestion_count', 0), reverse=True)

            suggestions_map = {}
            for date_key, slots in attendees_availiability.items():
                date_str = date_key.strftime("%Y-%m-%d") if hasattr(date_key, 'strftime') else str(date_key)
                suggestions_map[date_str] = {}
                for slot in slots:
                    slot_start = slot['start']
                    slot_end = slot['end']
                    time_key = f"""{slot_start.strftime("%H:%M")}-{slot_end.strftime("%H:%M")}"""
                    
                    suggestions_map[date_str][time_key] = {
                        "restaurants": [],
                        "scores": slot.get("scores", {}),
                        "final_score": slot.get("final_score", 10),
                        "attendees": slot.get("attendees", []),
                        "full_join": slot.get("full_join", []),
                        "partial_join": slot.get("partial_join", [])
                    }
            return unique_fixed, suggestions_map, []

        # 1. Split Attendees & Summarize Preferences
        key_persons_data = [d for d in attendee_datas if d.get('is_key_person', False)]
        general_persons_data = [d for d in attendee_datas if not d.get('is_key_person', False)]
        
        # If no key persons declared, treat everyone as key (or general with 100% weight) -> Effectively equal weight
        # But logic: Final = 0.7 Key + 0.3 General. If Key is empty, usage general as 100%.
        
        key_summary = self._get_summary(key_persons_data, points_per_vote=10.0)
        general_summary = self._get_summary(general_persons_data, points_per_vote=5.0)
        overall_summary = self._get_summary(attendee_datas)
        
        # Merge lat/lng for center calculation (Subjective: use ALL attendees for center?)
        # Yes, location convenience should probably consider everyone equally or weighted. 
        # For simplicity, let's keep using the 'overall' mean from ALL attendees for distance filtering.
        
        # print("- " * 100)
        # print(f"KEY SUMMARY : {key_summary}")
        # print("- " * 100)
        # print(f"GENERAL SUMMARY : {general_summary}")
        # print("- " * 100)
        # print(f"OVERALL SUMMARY : {overall_summary}")
        # print("- " * 100)

        # 2. Get Query Vectors for attendees who provided free_text
        from services.search_service import get_embedding
        for attendee_data in attendee_datas:
            pref = attendee_data.get("preference", {}) or {}
            free_text = pref.get("free_text")
            if free_text:
                try:
                    pref["query_vector"] = get_embedding(free_text)
                except Exception as e:
                    logger.error(f"Failed to generate embedding for attendee preference: {e}")

        # 3. Calculate distance from Center (Using Overall Center)
        if fixed_location is None:
            mean_lat = float(overall_summary.get("lat") or 0.0)
            mean_lng = float(overall_summary.get("lng") or 0.0)
            # Ensure we have valid coordinates
            if mean_lat == 0.0 and mean_lng == 0.0 and key_summary['count'] > 0:
                mean_lat = float(key_summary.get("lat") or 0.0)
                mean_lng = float(key_summary.get("lng") or 0.0)
        else:
            mean_lat = float(fixed_location.get("lat") or 0.0)
            mean_lng = float(fixed_location.get("lng") or 0.0)
             
        logger.info(f"MEAN LOCATIONS : {mean_lat}, {mean_lng}")

        # Query restaurants within a bounding box (+/- 0.1 degrees is roughly +/- 11km)
        from services.postgres_services import SessionLocal
        from models.restaurant import Restaurant
        db = SessionLocal()
        try:
            db_candidates = db.query(Restaurant).filter(
                Restaurant.lat.between(mean_lat - 0.1, mean_lat + 0.1),
                Restaurant.lng.between(mean_lng - 0.1, mean_lng + 0.1)
            ).all()
            
            candidate_dicts = []
            for c in db_candidates:
                d = c.to_dict()
                d['embedding'] = c.embedding
                d['distance_km'] = self.__haversine(mean_lat, mean_lng, c.lat, c.lng)
                candidate_dicts.append(d)
        finally:
            db.close()

        restaurants_lists = pd.DataFrame(candidate_dicts)
        if restaurants_lists.empty:
            restaurants_lists = pd.DataFrame(columns=[
                'id', 'name', 'wongnai_link', 'lat', 'lng', 'price', 'category', 'rating',
                'address', 'phone_number', 'line', 'instagram', 'top_favorites', 'opening_hours',
                'parking', 'alcohols', 'breadcrumbs', 'good_fors', 'favourite_menus', 'is_pet_friendly', 'distance_km', 'embedding'
            ])

        # 4. Filter by Max Distance (10km)
        nearby_restaurants = restaurants_lists[restaurants_lists['distance_km'] <= 10.0].copy()
        logger.info(f"RESTAURANT NEARBY FROM DB: {nearby_restaurants.shape[0]}")

        # Helper for filtering logic
        def has_overlap(row_val_str, target_set):
            try:
                row_items = set()
                if isinstance(row_val_str, str):
                    row_items = set(ast.literal_eval(row_val_str))
                elif isinstance(row_val_str, list):
                    row_items = set(row_val_str)
                
                return not row_items.isdisjoint(target_set)
            except:
                return False
        
        # Filter By Avoid Category
        avoid_categories = set()
        for attendee_data in attendee_datas:
            attendee_preference = attendee_data.get("preference", {})
            avoid_categories.update(attendee_preference.get('avoid_categories', []))
        if avoid_categories:
            logger.info("Filtering by avoid categories...")
            nearby_restaurants = nearby_restaurants[
                ~nearby_restaurants['category'].apply(lambda x: has_overlap(x, avoid_categories))
            ].copy()
            logger.info(f"RESTAURANT AFTER AVOID CATEGORIES FILTER : {nearby_restaurants.shape[0]}") 

        # 4.1 Filter by Category if > 1000 (standard logic)
        if nearby_restaurants.shape[0] > 1000:
            target_categories = set(overall_summary.get('category', {}).keys())
            if target_categories:
                logger.info("Result > 1000, filtering by selected categories...")
                nearby_restaurants = nearby_restaurants[
                    nearby_restaurants['category'].apply(lambda x: has_overlap(x, target_categories))
                ].copy()
                logger.info(f"RESTAURANT AFTER CATEGORY FILTER : {nearby_restaurants.shape[0]}")

        # 4.2 Filter by Good For if > 1000 (standard logic)
        if nearby_restaurants.shape[0] > 1000:
            target_good_fors = set(overall_summary.get('unique_good_fors', {}).keys())
            if target_good_fors:
                logger.info("Result still > 1000, filtering by selected good_fors...")
                nearby_restaurants = nearby_restaurants[
                    nearby_restaurants['good_fors'].apply(lambda x: has_overlap(x, target_good_fors))
                ].copy()
                logger.info(f"RESTAURANT AFTER GOOD_FORS FILTER : {nearby_restaurants.shape[0]}")

        # 4.3 Filter by Preferred Restaurants
        suggestion_restaurants_df = pd.DataFrame(overall_summary.get("preferred_restaurants_list", []))
        if suggestion_restaurants_df.shape[0] > 0:
            nearby_restaurants = pd.concat([nearby_restaurants, suggestion_restaurants_df]).drop_duplicates(subset='id')
            logger.info(f"RESTAURANT AFTER PREFERRED RESTAURANTS FILTER : {nearby_restaurants.shape[0]}")
        
        # 4.4 Global Scoring (Score all candidates once)
        if not nearby_restaurants.empty:
            nearby_restaurants[["score", "reason"]] = nearby_restaurants.apply(
                lambda row: self._calculate_weighted_score(row, key_persons_data, general_persons_data, user_details), 
                axis=1,
                result_type='expand'
            )
            
            nearby_restaurants = nearby_restaurants.sort_values(by="score", ascending=False)

        # 5. Process Suggestions per Slot
        suggestions_map = {}
        
        for date_key, slots in attendees_availiability.items():
            date_str = date_key.strftime("%Y-%m-%d") if hasattr(date_key, 'strftime') else str(date_key)
            suggestions_map[date_str] = {}
            
            for slot in slots:
                slot_start = slot['start']
                slot_end = slot['end']
                time_key = f"""{slot_start.strftime("%H:%M")}-{slot_end.strftime("%H:%M")}"""
                
                if nearby_restaurants.empty or not suggestion_config.get("suggest_per_time"):
                    # When suggest_per_time is off or no restaurants found,
                    # keep slot metadata but skip per-slot restaurant assignment
                    suggestions_map[date_str][time_key] = {
                        "restaurants": [],
                        "scores": slot.get("scores", {}),
                        "final_score": slot.get("final_score", 0),
                        "attendees": slot.get("attendees", []),
                        "full_join": slot.get("full_join", []),
                        "partial_join": slot.get("partial_join", [])
                    }
                else:
                    # suggest_per_time is True: calculate per-slot restaurant lists
                    # Apply Opening Hours Filter
                    valid_indices = nearby_restaurants.apply(
                        lambda row: self._is_open(row, slot_start, slot_end),
                        axis=1
                    )
                    valid_restaurants = nearby_restaurants[valid_indices].copy()
                    
                    if valid_restaurants.empty:
                        suggestions_map[date_str][time_key] = {
                            "restaurants": [],
                            "scores": slot.get("scores", {}),
                            "final_score": slot.get("final_score", 0),
                            "attendees": slot.get("attendees", []),
                            "full_join": slot.get("full_join", []),
                            "partial_join": slot.get("partial_join", [])
                        }
                        continue

                    slot_attendee_ids = slot.get("attendees", [])
                    slot_attendee_datas = [d for d in attendee_datas if d.get('user_id') in slot_attendee_ids]
                    
                    slot_key_persons_data = [d for d in slot_attendee_datas if d.get('is_key_person', False)]
                    slot_general_persons_data = [d for d in slot_attendee_datas if not d.get('is_key_person', False)]
                    
                    valid_restaurants[["score", "reason"]] = valid_restaurants.apply(
                        lambda row: self._calculate_weighted_score(row, slot_key_persons_data, slot_general_persons_data, user_details),
                        axis=1,
                        result_type='expand'
                    )
                    valid_restaurants = valid_restaurants.sort_values(by="score", ascending=False)
                    top_5 = valid_restaurants.head(5)

                    # Convert to dict
                    top_5_clean = top_5.drop(columns=['embedding'], errors='ignore')
                    suggestions_map[date_str][time_key] = {
                        "restaurants": top_5_clean.replace({np.nan: None}).to_dict(orient="records"),
                        "scores": slot.get("scores", {}),
                        "final_score": slot.get("final_score", 0),
                        "attendees": slot.get("attendees", []),
                        "full_join": slot.get("full_join", []),
                        "partial_join": slot.get("partial_join", [])
                    }
        # logger.info(f"SUGGESTIONS MAP : {suggestions_map}")
        
        # Get all preferred restaurants from the summary
        attendee_preferred = overall_summary.get("preferred_restaurants_list", [])
        
        # Combine with Organizer Fixed Restaurants
        attendee_counts = overall_summary.get("preferred_restaurants", {})
        all_preferred_list = []
        seen_ids = set()
        
        # Add Organizer Fixed first
        if fixed_restaurants:
            for r in fixed_restaurants:
                r_dict = dict(r)
                rid = str(r_dict.get('id'))
                r_dict['score'] = r_dict.get('score', 100.0)
                r_dict['reason'] = r_dict.get('reason', {"Fixed": {"key_ratio": 100, "attendee_ratio": 100, "max_score": 100}})
                r_dict['suggestion_count'] = max(1, attendee_counts.get(rid, 0))
                if rid not in seen_ids:
                    all_preferred_list.append(r_dict)
                    seen_ids.add(rid)
        
        # Add Attendee Preferred
        for r in attendee_preferred:
            r_dict = dict(r)
            rid = str(r_dict.get('id'))
            if rid not in seen_ids:
                r_dict['suggestion_count'] = max(1, attendee_counts.get(rid, 0))
                all_preferred_list.append(r_dict)
                seen_ids.add(rid)

        # Sort by suggestion count desc
        all_preferred_restaurants = sorted(all_preferred_list, key=lambda x: x.get('suggestion_count', 0), reverse=True)

        # Final list of all scored restaurants (sorted by score)
        if not nearby_restaurants.empty:
            all_scored_clean = nearby_restaurants.drop(columns=['embedding'], errors='ignore')
            all_scored_restaurants = all_scored_clean.replace({np.nan: None}).to_dict(orient="records")
        else:
            all_scored_restaurants = []

        return all_preferred_restaurants, suggestions_map, all_scored_restaurants