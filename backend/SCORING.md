# Dishcision Scoring Algorithms

This document details the algorithms used to calculate suggestions for both **Meeting Time Slots** and **Restaurants**.

---

## 1. Time Slot Suggestion (`get_suggested_slots`)

The system evaluates every possible 30-minute slot within the meeting date range and assigns a **Final Score (1-10)** based on three weighted components.

**Note:** All component scores are first calculated on a 0-10 scale and then mapped to a 1-10 scale using linear scaling: 
`Scaled_Score = 1 + (Raw_Score / 10 * 9)`

### Formula
```
Final Score = (Availability_Score * 0.5) + (Meal_Preference_Score * 0.3) + (Time_Quality_Score * 0.2)
```

### Components

#### A. Availability Score (50%)
Measures how many people can attend.
- **Key Person Weight:** 70%
- **General Attendee Weight:** 30%
```
Availability_Score = ((Key_Person_Ratio * 0.7) + (General_Attendee_Ratio * 0.3)) / 10
```
*Example: If all Key Persons are available (1.0) and 50% of others are available (0.5), the score is `(0.7 + 0.15) * 10 = 8.5`.*

#### B. Meal Preference Score (30%)
Measures if the slot duration fits the group's meal preference (Lunch/Dinner).
- **Goal:** Suggest a slot long enough for a proper meal.
- **Max Score:** Based on total attendee count * ideal duration steps (2 hours = 4 steps).
```
Meal_Score = (Accumulated_Meal_Points / Max_Possible_Points) * 10
```

#### C. Time Quality Score (20%)
Measures the "quality" of the time based on standard eating habits.

| Time Range | Points | Meal Type |
| :--- | :--- | :--- |
| **11:00 - 13:00** | **2** (High) | Lunch |
| 10:00 - 11:00 | 1 | Lunch |
| 13:00 - 15:00 | 1 | Lunch |
| **18:00 - 20:00** | **2** (Medium) | Dinner |
| 15:00 - 18:00 | 1 | Dinner |
| 20:00 - 23:00 | 1 | Dinner |

---

## 2. Restaurant Suggestion (`get_suggesested_restaurants`)

The system ranks restaurants using a **Weighted Voting System** that prioritizes Key Decision Makers.

### High-Level Logic
1.  **Filter Candidates**:
    *   **Distance**: Must be within **10km** of the group's center (average location of all attendees).
    *   **Category/Good For**: If the result set is large (> 1000), it filters by the *union* of group preferences to narrow down impactful options.
2.  **Calculate Base Scores (0-100)** for two groups separately:
    *   **Key Persons Group** (Organizer + VIPs)
    *   **General Attendees Group** (Everyone else)
3.  **Weighted Combination**:
    ```
    Final Score = (Key_Group_Score * 0.7) + (General_Group_Score * 0.3)
    ```

### Base Score Calculation (0-100)
For *each group* (Key or General), a restaurant's base score is calculated by summing points from its attributes. This score represents "how well this restaurant fits THIS group's specific desires."

| Attribute | Points (Max) | Logic |
| :--- | :--- | :--- |
| **Price** | **10** | `(Votes_for_Price_Range / Total_Group_Size) * 10` |
| **Category** | **10** | `(Votes_for_Category / Total_Group_Category_Votes) * 10` |
| **Good For** | **10** | `(Votes_for_Tag / Total_Group_Tag_Votes) * 10` |
| **Parking** | **5** | `(Votes_for_Parking / Total_Group_Size) * 5` (if venue has parking) |
| **Alcohol** | **5** | `(Votes_for_Alcohol / Total_Group_Size) * 5` (if venue has alcohol) |
| **Station** | **5** | **Linear Decay**: `(1 - Distance/5km) * 5`. 0 pts if > 5km. |
| **Rating** | **5** | `Rating (0-5)` directly added. |
| **Suggestion** | **15** | `min(votes * points, 15)`. Key: 10pts, General: 5pts. (~21% Weight) |

**Total Max Points:** 50 + 15 = **65 Points**

**Normalization Formula:**
```
Group_Score = (Accumulated_Points / Total_Max_Points) * 100
```
*Note: Total_Max_Points is 70 if suggestions exist, otherwise 55.*

### Example
If **Key Person** (weighted 70%) wants *Italian* and **10 Friends** (weighted 30%) want *Japanese*:
- An **Italian** restaurant will score very high on the Key Person component (e.g., 100/100) and low on the General component (e.g., 20/100).
- Weighted Score: `(100 * 0.7) + (20 * 0.3) = 76`.
- A **Japanese** restaurant will score low on Key (0) and high on General (100).
- Weighted Score: `(0 * 0.7) + (100 * 0.3) = 30`.
> Result: The Italian restaurant wins.

### Reason Format
Each restaurant in the results includes a `reason` array showing how it scored across different components. The format is:
```
"Component: earned_points/max_points"
```

**Example:**
```json
["Price: 8.0/10", "Category: 12.5/15", "Vibe: 7.0/10", "Station: 3.2/5", "Rating: 4.5/5"]
```

This makes it easy to:
- **Understand** why a restaurant was recommended
- **Reverse-calculate** the total score
- **Debug** scoring logic

**Components:**
- `Price: X/10` - How well the price matches group preferences
- `Category: X/15` - How well the cuisine matches group preferences
- `Vibe: X/10` - How well the atmosphere/tags match group preferences
- `Parking: X/5` - Parking availability (if requested)
- `Alcohol: X/5` - Alcohol availability (if requested)
- `Station: X/5` - Proximity to BTS/MRT stations
- `Rating: X/5` - Wongnai rating (0-5 stars)
- `Suggestion: X/15` - Bonus for suggestions (Key: 10pts/vote, General: 5pts/vote)
