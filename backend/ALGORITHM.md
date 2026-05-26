# Dishcision Backend Recommendation & Selection Algorithms

This document provides a technical summary of the algorithms implemented in the Dishcision backend to suggest optimal **Meeting Time Slots** and rank **Restaurants**.

---

## 1. Time Slot Recommendation Algorithm (`get_suggested_slots`)

The scheduling engine processes invitee calendar inputs to determine the most convenient meeting times. It evaluates all 30-minute window steps in the requested range and computes a **Final Score (1-10)** using a linear mapping.

### A. Availability Evaluation (Full & Partial Joins)
For each evaluated slot, the engine identifies how participants can join:
*   **Full Join**: The attendee has marked the entire slot duration (e.g., 2 hours) as available, or their calendar overlaps the slot duration by $\ge \text{Slot Duration Minutes}$.
*   **Partial Join**: The attendee cannot join the full slot but overlaps it by $> 0$ minutes. The overlap weight is calculated as:
    $$\text{Overlap Weight} = \frac{\text{Overlap Minutes}}{\text{Slot Duration Minutes}}$$

### B. Validation & Skipping
To ensure a valid group meeting:
*   If the overall meeting has **more than 1 invitee** (`len(self.attendees) > 1`), any slot where the total number of participants (Full Joins + Partial Joins) is **$\le 1$** is skipped.

### C. Adjusted Ratios & Scoring Components
The engine computes adjusted attendance ratios by counting full joins as $1.0$ and partial joins proportionally:

*   **Adjusted Key Person Ratio (`kp_ratio`)**:
    $$\text{kp\_ratio} = \left( \frac{\text{Full Key Joins} + \sum \text{Overlap Weights of Partial Key Joins}}{\text{Total Key Persons}} \right) \times 100$$
*   **Adjusted General Attendee Ratio (`at_ratio`)**:
    $$\text{at\_ratio} = \left( \frac{\text{Full Attendee Joins} + \sum \text{Overlap Weights of Partial Attendee Joins}}{\text{Total Attendees}} \right) \times 100$$

#### Final Score Formula (0-10 Scale)
$$\text{Final Score} = (0.7 \times \text{Normalized Availability}) + (0.2 \times \text{Meal Preference Alignment}) + (0.1 \times \text{Time Quality})$$

1.  **Normalized Availability** (50% original weight, mapped: `0.7` scaling):
    Calculates weighted availability of Key Persons (70% weight) vs General Attendees (30% weight):
    $$\text{Raw Availability} = \frac{(\text{kp\_ratio} \times 0.7) + (\text{at\_ratio} \times 0.3)}{10}$$
    $$\text{Normalized Availability} = 1 + \left( \frac{\text{Raw Availability}}{10} \right) \times 9$$
2.  **Meal Preference Alignment** (30% original weight, mapped: `0.2` scaling):
    Measures if the slot aligns with the group's preferred dining type (Lunch vs. Dinner).
3.  **Time Quality / Eating Habits** (20% original weight, mapped: `0.1` scaling):
    Scores the slot based on optimal dining hours (e.g., 11:00–13:00 for Lunch, 18:00–20:00 for Dinner get maximum points).

---

## 2. Restaurant Suggestion Algorithm (`get_suggested_restaurants`)

The recommendation system uses a Multi-Criteria Decision-Making (MCDM) framework to score, sort, and suggest the top 5 venues per slot.

### A. Candidate Filtering (Pre-scoring)
To optimize performance and relevance, candidate venues undergo three stages of filtering:
1.  **Distance Filter**: Venues must be within **10km** of the group's centroid (mean coordinates of all participants).
2.  **Avoid Penalties**: Venues belonging to cuisines explicitly marked in "Avoid Categories" are excluded.
3.  **Heuristic Narrowing**: If candidates exceed 1,000, the list is narrowed down using the union of preferred cuisines and vibes.

### B. Dynamic MCDM Criteria Weighting
Weights are adjusted dynamically for each meeting based on the priorities declared by attendees:
*   **Base Weights**: Price (10.0), Category (10.0), Vibe (10.0), BTS/MRT Station Proximity (5.0), Rating (5.0), Ancillary Amenities (10.0).
*   **Booster Points**: Priorities declared in the top 3 focus factors add booster points: Rank 1 (+5.0), Rank 2 (+3.0), Rank 3 (+1.0).
*   **Final Weights**: $\text{Base Weight} + \text{Average Boost of All Attendees}$.

### C. Individual Group Scoring (0-100)
Points are awarded for each attribute and normalized:
*   **Price (10 pts)**: Proportional to votes for the venue's price tier.
*   **Category (10 pts)**: Proportional to cuisine match (50% penalty if it matches any "avoid" tags).
*   **Vibe / Good For (10 pts)**: Matching tag frequency.
*   **Amenities (10 pts)**: 5 pts each for Parking and Alcohol if requested.
*   **Proximity (5 pts)**: Proportional to transit proximity (linear decay: $1 - \text{distance}/3\text{km}$; 0 points if $> 3\text{km}$).
*   **Rating (5 pts)**: Mapped directly from the Wongnai rating (0-5 stars).
*   **Explicit Suggestion (15 pts)**: Added if the restaurant is manually suggested.

$$\text{Group Score} = \left( \frac{\text{Accumulated Points}}{\text{Max Attribute Points}} \right) \times 100$$

### D. Multi-Group Combiner & Sorting
The final score of a restaurant combines the Key Persons' alignment (70%) and General Attendees' alignment (30%):
$$\text{Final Score} = (\text{Key Group Score} \times 0.7) + (\text{General Group Score} \times 0.3)$$

#### Suggestion Boost
Venues explicitly suggested by users receive a manual recommendation boost ($+15$ pts, capped at 100).

#### Final Selection
*   Venues are sorted globally by score and recommended.
*   Suggestions are mapped to their respective slots by checking dynamic opening hours.
*   Slots are sorted by:
    1.  `final_score` (descending)
    2.  `len(attendees)` (fully available, descending)
    3.  `len(partial_join)` (partially available, descending)
