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
    def __init__(self, key_person, attendees, start_date, end_date, meal_time, meeting_duration_hours: int = 2, step_minutes: int = 30):
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

        # Load stations
        try:
            base_path = os.getcwd()
            with open("./statics/stations.json", "r") as f:
                self.stations = json.load(f)
        except Exception as e:
            logger.warning(f"Could not load stations.json: {e}")
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
        return available_slots
    
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

    def __get_similarity_availability(self, attendees: list, key_persons: list, attendee_availability: dict):
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
                if availiable_lists != [] and availiable_key_persons != []:
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

    def get_suggested_slots(self, attendee_availiability: dict):
        """
        Get the suggested slots for the meeting
        """
        preferred_meal_time: dict = {"Lunch": 0, "Dinner": 0, "Any": 0}
        for attendee in attendee_availiability:
            preferred_meal_time[attendee_availiability.get(attendee, {}).get("preferred_meal_time")] += 1
        # print(f"PREFEREED MEAL TIME : {preferred_meal_time}")
        # print("- " * 100)
        
        total_attendees = sum(preferred_meal_time.values())
        
        # print(f"ATTENDEE AVAILABILITY : {attendee_availiability}")
        # print("- " * 100)
        attendees_availiability: dict = self.__get_similarity_availability(attendees=self.attendees, key_persons=self.key_person, attendee_availability=attendee_availiability)
        print(f"ATTENDEES AVAILABILITY : {attendees_availiability}")
        print("- " * 100)
        
        for date, avail_times in attendees_availiability.items():
            for avail_time in avail_times:
                # 1. Get Base Scores
                points, meal_time_scores = self.__get_time_scoring(avail_time["start"], avail_time["end"], preferred_meal_time)
                avail_time["points"] = points
                avail_time["meal_time_scores"] = meal_time_scores
                
                # 2. Calculate Final Score Components (0-10 Scale)
                
                # A. Normalized Availability (Weight: 50%)
                # Formula: (KeyPerson% * 0.7 + Attendee% * 0.3) / 10 -> 0-10 Scale
                kp_ratio = avail_time.get("key_persons_ratio", 0)
                at_ratio = avail_time.get("attendee_ratio", 0)
                raw_avail = ((kp_ratio * 0.7) + (at_ratio * 0.3)) / 10.0
                # Map 0-10 to 1-10
                norm_avail = 1 + (raw_avail / 10.0) * 9.0
                
                # B. Meal Preference Alignment (Weight: 30%)
                # Max Possible Meal Score = (Duration / 30min) * Total_Attendees
                duration_minutes = (avail_time["end"] - avail_time["start"]).total_seconds() / 60
                steps = duration_minutes / 30
                max_meal_score = steps * total_attendees if total_attendees > 0 else 1
                
                raw_meal = 0
                if max_meal_score > 0:
                    raw_meal = (meal_time_scores / max_meal_score) * 10.0
                # Map 0-10 to 1-10
                norm_meal = 1 + (raw_meal / 10.0) * 9.0
                
                # C. Time Quality / Standard Hours (Weight: 20%)
                # Max Points = Steps * 2 (Since max points per 30min step is 2)
                max_points = steps * 2
                
                raw_quality = 0
                if max_points > 0:
                    raw_quality = (points / max_points) * 10.0
                # Map 0-10 to 1-10
                norm_quality = 1 + (raw_quality / 10.0) * 9.0
                
                # 3. Final Weighted Score
                # Weights: Avail=0.5, Meal=0.3, Quality=0.2
                # Since components are 1-10, final score is naturally 1-10
                final_score = (0.7 * norm_avail) + (0.2 * norm_meal) + (0.1 * norm_quality)
                
                # Store Step Scores
                avail_time["scores"] = {
                    "availability": round(norm_avail, 1),
                    # "meal_preference": round(norm_meal, 1),
                    "time_quality": round(norm_quality, 1)
                }
                
                avail_time["final_score"] = round(final_score, 1)
                
        return attendees_availiability

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
            "unique_good_fors": attendee_preferences_df["good_fors"].explode().value_counts().to_dict(),
            "parking": attendee_preferences_df["parking"].value_counts().to_dict(),
            "alcohols": attendee_preferences_df["alcohols"].value_counts().to_dict(),
            "lat": attendee_preferences_df["lat"].mean(),
            "lng": attendee_preferences_df["lng"].mean(),
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
        """Calculate distance to the nearest station in km."""
        if not self.stations:
            return 999.0 # Large distance if no stations
        
        min_dist = float('inf')
        for station in self.stations:
            d = self.__haversine(lat, lng, station['lat'], station['lng'])
            if d < min_dist:
                min_dist = d
        return min_dist

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
            # logger.error(f"Error checking opening hours: {e}")
            return True # Fail open safely

    def calculate_restaurant_score(self, summary_preference: dict, restaurant_row: list):
        """
        Calculate a dynamic score (0-100) for a restaurant based on group preferences.

        The score matches the "Popular Vote". The more users agree on a preference, 
        the higher the score for restaurants that match it.

        Scoring Logic (Total Normalized to 100%):
        -----------------------------------------
        1. User Preferences (Dynamic Weight based on popularity):
           - Price (10 pts):  Proportional to % of users who selected this price range.
           - Category (15 pts): Proportional to share of total category votes. 
                                (e.g., if 80% want Thai, Thai places get more points).
           - Good For (10 pts): Proportional to share of 'Good For' votes.
           - Parking (5 pts):   Proportional to % of users requiring parking.
           - Alcohols (5 pts):  Proportional to % of users requiring alcohols.

        2. Convenience & Quality:
           - Station Proximity (5 pts): Higher score if closer to BTS/MRT (within 2km).
           - Rating (5 pts): Based on Wongnai rating (0-5 stars scaled to 0-10 pts).

        Calculation:
        ------------
        Final Score = (Earned Points / Max Possible Points) * 100
        """
        score = 0.0
        max_score = 0.0
        reason = []
        
        total_people = summary_preference.get('count', 1)
        if total_people <= 0: total_people = 1

        # --- 1. Preferences ---
        pref_score = 0.0
        
        # A. Price (Weight: 10 pts)
        max_score += 10.0
        res_price = restaurant_row.get('price')
        price_votes = summary_preference['price'].get(res_price, 0)
        if price_votes > 0:
            p_score = (price_votes / total_people) * 10.0
            pref_score += p_score
            reason.append(f"Price: {p_score:.1f}/10")

        # B. Category (Weight: 15 pts)
        max_score += 15.0
        try:
            res_cats = set(ast.literal_eval(restaurant_row['category']))
            pref_cat_counts = summary_preference['category']
            total_cat_votes = sum(pref_cat_counts.values())
            
            if total_cat_votes > 0:
                matched_votes = sum(pref_cat_counts.get(c, 0) for c in res_cats)
                if matched_votes > 0:
                    c_score = (matched_votes / total_cat_votes) * 15.0
                    c_score = min(c_score, 15.0) 
                    pref_score += c_score
                    reason.append(f"Category: {c_score:.1f}/15")
        except:
            pass

        # C. Good Fors (Weight: 10 pts)
        max_score += 10.0
        try:
            res_gf = set(ast.literal_eval(restaurant_row['good_fors']))
            pref_gf_counts = summary_preference['unique_good_fors']
            total_gf_votes = sum(pref_gf_counts.values())
            
            if total_gf_votes > 0:
                matched_gf_votes = sum(pref_gf_counts.get(g, 0) for g in res_gf)
                if matched_gf_votes > 0:
                    gf_score = (matched_gf_votes / total_gf_votes) * 10.0
                    gf_score = min(gf_score, 10.0)
                    pref_score += gf_score
                    reason.append(f"Vibe: {gf_score:.1f}/10")
        except:
            pass

        # D. Amenities - Parking (Weight: 5 pts)
        max_score += 5.0
        res_parking = "มีที่จอดรถ" in str(restaurant_row.get('parking', ''))
        parking_votes = summary_preference['parking'].get(True, 0)
        
        if res_parking and parking_votes > 0:
            # pk_score = (parking_votes / total_people) * 5.0
            pk_score = 5.0
            pref_score += pk_score
            reason.append(f"Parking: {pk_score:.1f}/5")
        elif not res_parking and parking_votes > 0:
            pk_score = 0.0
            pref_score += pk_score
            reason.append(f"Parking: {pk_score:.1f}/5")
        else:
            pk_score = 5.0
            pref_score += pk_score
            reason.append(f"Parking (No Require Parking): {pk_score:.1f}/5")
            
        # E. Amenities - Alcohols (Weight: 5 pts)
        # Score = (Votes for Alcohol / Total People) * 5 (If restaurant has alcohol)
        # Note: restaurant['alcohols'] is a list of strings if available, or empty list.
        max_score += 5.0
        res_alcohol_list = restaurant_row.get('alcohols')
        # Check if list is not empty (truthy) and actually a list
        has_alcohol = isinstance(res_alcohol_list, list) and len(res_alcohol_list) > 0
        
        # User preference is Boolean True if checked
        alcohol_votes = summary_preference['alcohols'].get(True, 0)
        
        if has_alcohol and alcohol_votes > 0:
            # alc_score = (alcohol_votes / total_people) * 5.0
            alc_score = 5.0
            pref_score += alc_score
            reason.append(f"Alcohol: {alc_score:.1f}/5")
        elif not has_alcohol and alcohol_votes > 0:
            alc_score = 0.0
            pref_score += alc_score
            reason.append(f"Alcohol: {alc_score:.1f}/5")
        else:
            alc_score = 5.0
            pref_score += alc_score
            reason.append(f"Alcohol (No Require Alcohol): {alc_score:.1f}/5")
           
        score += pref_score

        # --- 1. Train Station Proximity (Max 5 points) ---
        max_score += 5.0
        station_dist = self._get_distance_to_nearest_station(restaurant_row['lat'], restaurant_row['lng'])
        station_pts = 0
        if station_dist < 2.0:
             # linear decay from 30 at 0km to 0 at 2km
             station_pts = (1 - (station_dist / 2.0)) * 5.0
        
        score += station_pts
        if station_pts > 0:
            reason.append(f"Station: {station_pts:.1f}/5")

        # --- 2. Rating (Max 5 points) ---
        max_score += 5.0   
        rating = restaurant_row.get('rating', 0) or 0
        score += rating
        reason.append(f"Rating: {rating:.1f}/5")

        # # --- 3. User Suggestion (Weight: ~20% -> 15 pts) ---
        # # If any suggestions exist in the group, include this component
        # preferred_counts = summary_preference.get('preferred_restaurants', {})
        # if preferred_counts:
        #      max_score += 15.0
        #      res_id = str(restaurant_row.get('id', ''))
        #      count = preferred_counts.get(res_id, 0)
             
        #      # Differential points: Key=10, General=5 (default)
        #      points_per_vote = summary_preference.get('points_per_vote', 5.0)
        #      suggestion_pts = min(count * points_per_vote, 15.0)
        #      score += suggestion_pts
             
        #      if suggestion_pts > 0:
        #           reason.append(f"Suggestion: {suggestion_pts:.1f}/15")

        # Normalize to 100
        if max_score > 0:
            final_score = (score / max_score) * 100.0
        else:
            final_score = 0.0

        # Clip to max 100
        if final_score > 100.0:
            final_score = 100.0
            
        return round(final_score, 1), reason

    def get_suggesested_restaurants(self, attendee_datas: list, attendees_availiability: dict, suggestion_config: dict, fixed_restaurants: Optional[list] = None, fixed_location: Optional[Dict[str, float]] = None):
        print(f"""      >> ALLOW OTHER SUGGESTION : {suggestion_config.get("allow_others_suggest", None)}""")
        # FAST PATH: Organizer Fixed Restaurants
        if suggestion_config.get("allow_system_suggest", None) == False and len(fixed_restaurants) > 0:
            logger.info("Fixed restaurants provided. Bypassing suggestion algorithm.")
            formatted_fixed = []
            for r in fixed_restaurants:
                r_dict = dict(r)
                r_dict['score'] = 100.0
                r_dict['reason'] = ["[Key] Organizer Fixed"]
                formatted_fixed.append(r_dict)
            
            # Append other
            for attendee_data in attendee_datas:
                attendee_preference = attendee_data.get("preference", {})
                for r in attendee_preference.get("preferred_restaurant", []):
                    r_dict = dict(r)
                    r_dict['score'] = 100.0
                    r_dict['reason'] = ["[Attendee] Attendee Suggested"]
                    formatted_fixed.append(r_dict)
            
            unique_fixed = []
            for r in formatted_fixed:
                if r['id'] not in [fr['id'] for fr in unique_fixed]:
                    unique_fixed.append(r)

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
                        "attendees": slot.get("attendees", [])
                    }
            return unique_fixed, suggestions_map

        # 1. Split Attendees & Summarize Preferences
        key_persons_data = [d for d in attendee_datas if d.get('is_key_person', False)]
        general_persons_data = [d for d in attendee_datas if not d.get('is_key_person', False)]
        
        # If no key persons declared, treat everyone as key (or general with 100% weight) -> Effectively equal weight
        # But logic: Final = 0.7 Key + 0.3 General. If Key is empty, usage general as 100%.
        
        def get_summary(datas, points_per_vote=5.0):
            if not datas:
                return {"count": 0, "price": {}, "category": {}, "unique_good_fors": {}, "parking": {}, "alcohols": {}, "lat": 0, "lng": 0, "preferred_restaurants": {}, "points_per_vote": points_per_vote }
            
            df = pd.DataFrame(datas)
            expanded_cols = pd.json_normalize(df['preference'])
            df = df.drop(columns=['preference']).join(expanded_cols)
            summary = self.__extract_preference(df)
            summary['points_per_vote'] = points_per_vote
            return summary

        key_summary = get_summary(key_persons_data, points_per_vote=10.0)
        general_summary = get_summary(general_persons_data, points_per_vote=5.0)
        
        # Merge lat/lng for center calculation (Subjective: use ALL attendees for center?)
        # Yes, location convenience should probably consider everyone equally or weighted. 
        # For simplicity, let's keep using the 'overall' mean from ALL attendees for distance filtering.
        overall_summary = get_summary(attendee_datas)
        
        # print("- " * 100)
        # print(f"KEY SUMMARY : {key_summary}")
        # print("- " * 100)
        # print(f"GENERAL SUMMARY : {general_summary}")
        # print("- " * 100)
        # print(f"OVERALL SUMMARY : {overall_summary}")
        # print("- " * 100)

        # 2. Load and Prep Data
        data_path = "./statics/restaurants_lists.csv"
        if not os.path.exists(data_path):
             if os.path.exists("../statics/restaurants_lists.csv"):
                 data_path = "../statics/restaurants_lists.csv"

        restaurants_lists = pd.read_csv(data_path)
        restaurants_lists = restaurants_lists.replace({np.nan: None})
        restaurants_lists['price'] = restaurants_lists['price'].apply(lambda x : str(x).strip())
        restaurants_lists = restaurants_lists.dropna(subset=['lat', 'lng'])

        # 3. Calculate distance from Center (Using Overall Center)
        if fixed_location is None:
            mean_lat = overall_summary.get("lat")
            mean_lng = overall_summary.get("lng")
            # Ensure we have valid coordinates
            if mean_lat == 0 and mean_lng == 0 and key_summary['count'] > 0:
                mean_lat = key_summary.get("lat")
                mean_lng = key_summary.get("lng")
        else:
            mean_lat = fixed_location.get("lat")
            mean_lng = fixed_location.get("lng")
             
        logger.info(f"MEAN LOCATIONS : {mean_lat}, {mean_lng}")
        restaurants_lists['distance_km'] = restaurants_lists.apply(
            lambda row: self.__haversine(mean_lat, mean_lng, row['lat'], row['lng']), 
            axis=1
        )

        # 4. Filter by Max Distance (10km)
        nearby_restaurants = restaurants_lists[restaurants_lists['distance_km'] <= 10.0].copy()
        logger.info(f"RESTAURANT NEARBY : {nearby_restaurants.shape[0]}")

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
        
        # if nearby_restaurants.empty:
        #     return {}

        # 5. Process Suggestions per Slot
        suggestions_map = {}
        
        for date_key, slots in attendees_availiability.items():
            date_str = date_key.strftime("%Y-%m-%d") if hasattr(date_key, 'strftime') else str(date_key)
            suggestions_map[date_str] = {}
            
            for slot in slots:
                slot_start = slot['start']
                slot_end = slot['end']
                time_key = f"""{slot_start.strftime("%H:%M")}-{slot_end.strftime("%H:%M")}"""
                # print(f"RESTAURANT LIST : {nearby_restaurants.empty}")
                if nearby_restaurants.empty:
                    # print(f"EMPTY RESTAURANT LIST - {date_str} {time_key}")
                    suggestions_map[date_str][time_key] = {
                        "restaurants": [],
                        "scores": slot.get("scores", {}),
                        "final_score": slot.get("final_score", 0),
                        "attendees": slot.get("attendees", [])
                    }
                else:
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
                            "final_score": slot.get("final_score", 0)
                        }
                        continue

                    # Score Valid Restaurants
                    # Function to calculate weighted score
                    def calculate_weighted_score(row):
                        # Key Person Score
                        score_key, reason_key = 0, []
                        if key_summary['count'] > 0:
                            score_key, reason_key = self.calculate_restaurant_score(key_summary, row)
                        
                        # General Score
                        score_gen, reason_gen = 0, []
                        if general_summary['count'] > 0:
                            score_gen, reason_gen = self.calculate_restaurant_score(general_summary, row)
                        
                        # Weights
                        final_score = 0
                        if key_summary['count'] > 0 and general_summary['count'] > 0:
                            final_score = (score_key * 0.7) + (score_gen * 0.3)
                        elif key_summary['count'] > 0:
                            final_score = score_key
                        else:
                            final_score = score_gen
                        
                        # Combine reasons (Prefixing for clarity)
                        combined_reasons = []
                        if reason_key: combined_reasons.extend([f"[Key] {r}" for r in reason_key])
                        if reason_gen: combined_reasons.extend([f"[All] {r}" for r in reason_gen])
                        
                        return round(final_score, 1), combined_reasons

                    valid_restaurants[["score", "reason"]] = valid_restaurants.apply(
                        lambda row: calculate_weighted_score(row), 
                        axis=1,
                        result_type='expand'
                    )
                    # valid_restaurants.to_csv("valid_restaurants.csv", index=False)
                    # Top 5
                    top_5 = valid_restaurants.sort_values(by="score", ascending=False).head(5)
                    
                    # Convert to dict
                    suggestions_map[date_str][time_key] = {
                        "restaurants": top_5.to_dict(orient="records"),
                        "scores": slot.get("scores", {}),
                        "final_score": slot.get("final_score", 0),
                        "attendees": slot.get("attendees", [])
                    }
        # logger.info(f"SUGGESTIONS MAP : {suggestions_map}")
        
        # Get all preferred restaurants from the summary
        attendee_preferred = overall_summary.get("preferred_restaurants_list", [])
        
        # Combine with Organizer Fixed Restaurants
        all_preferred_restaurants = []
        seen_ids = set()
        
        # Add Organizer Fixed first
        if fixed_restaurants:
            for r in fixed_restaurants:
                r_dict = dict(r)
                r_dict['score'] = r_dict.get('score', 100.0)
                r_dict['reason'] = r_dict.get('reason', ["[Key] Organizer Fixed"])
                if r_dict['id'] not in seen_ids:
                    all_preferred_restaurants.append(r_dict)
                    seen_ids.add(r_dict['id'])
        
        # Add Attendee Preferred
        for r in attendee_preferred:
            if r['id'] not in seen_ids:
                all_preferred_restaurants.append(r)
                seen_ids.add(r['id'])

        return all_preferred_restaurants, suggestions_map