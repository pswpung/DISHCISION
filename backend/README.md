# DISHCISION Backend Documentation

This directory contains the Python FastAPI backend for **DISHCISION**. The system manages users, meetings, attendee schedules, and coordinates recommendation engines to solve group dining constraints.

---

## 1. REST API Endpoints Reference

The backend is modularized into FastAPI routers. The following is a detailed catalog of exposed endpoints.

### 🤖 LINE Bot Webhook Router (`/line`)
*   `POST /line/callback`
    - **Description**: Receives real-time incoming events (messages, postbacks, joins) from the LINE webhook. Validates the `X-Line-Signature` header and triggers corresponding LINE Flex layout response workflows.

### 👤 Users Router (`/users`)
*   `POST /users`
    - **Description**: Registers a new user. Returns `400` if the user is already registered.
*   `GET /users`
    - **Description**: Returns a list of registered users.
*   `GET /users/{user_id}`
    - **Description**: Fetches user profile data for a specific LINE ID.
*   `GET /users/group/{group_id}`
    - **Description**: Retrieves all users registered under a specific LINE group.
*   `PATCH /users/{user_id}`
    - **Description**: Updates user profile properties (display name, picture URL, group mapping).
*   `DELETE /users/{user_id}`
    - **Description**: Removes user registration data.

### 📅 Meetings Router (`/meetings`)
*   `POST /meetings`
    - **Description**: Creates a new group dining meeting. If attendees contain other members, it pushes an invite card (Flex Message) to the LINE group chat.
*   `GET /meetings/{meeting_id}`
    - **Description**: Fetches meeting metadata (name, config) and sanitized real-time voting states.
*   `GET /meetings/group/{group_id}`
    - **Description**: Lists all active and closed meetings created in a specific LINE group.
*   `PATCH /meetings/{meeting_id}`
    - **Description**: Modifies global meeting configuration attributes.
*   `DELETE /meetings/{meeting_id}`
    - **Description**: Deletes meeting data.
*   `POST /meetings/{meeting_id}/vote-time`
    - **Description**: Toggles user vote for a specific date-time slot key (e.g., `2026-05-28_18:00`).
*   `POST /meetings/{meeting_id}/tail-in`
    - **Description**: Toggles user upvote (prefer/like) for a restaurant candidate.
*   `POST /meetings/{meeting_id}/tail-out`
    - **Description**: Toggles user veto (dislike/avoid) for a restaurant candidate.
*   `POST /meetings/{meeting_id}/toggle-ready`
    - **Description**: Toggles user ready check status.
*   `POST /meetings/{meeting_id}/set-decision-method`
    - **Description**: Saves organizer preference for slot/restaurant selection: `"majority"`, `"wheel"`, or `"list"`.
*   `POST /meetings/{meeting_id}/spin-wheel`
    - **Description**: Commits spin wheel animations, landed result, and stop angle values to sync UI states for all group members in real-time.
*   `POST /meetings/{meeting_id}/select-wheel-restaurants`
    - **Description**: Logs a subset of user-selected restaurants to populate the tie-breaker wheel.
*   `POST /meetings/{meeting_id}/confirm-final`
    - **Description**: Locks confirmed time slot and venue selections, marks meeting status as `"closed"`, and pushes the final ticket Flex Message to the LINE group.

### 🙋 Meeting Attendees Router (`/attendee`)
*   `POST /attendee`
    - **Description**: Registers a user to a meeting.
*   `GET /attendee/{meeting_id}`
    - **Description**: Lists all attendees for a meeting.
*   `PATCH /attendee/{meeting_id}/{user_id}`
    - **Description**: Submits or updates an attendee's availability schedule and MCDM preferences. On submission, the backend checks if all invitees have completed inputs; if yes, it executes the suggestion engine in the background and sends a LINE notification.
*   `DELETE /attendee/{meeting_id}/{user_id}`
    - **Description**: Unregisters attendee from a meeting.

### 🍽️ Restaurant Suggestion Router (`/restaurant`)
*   `GET /restaurant/config`
    - **Description**: Exposes available values for preferences (sorted price lists, categories, parking, alcohols, vibes).
*   `POST /restaurant/suggest/{meeting_id}`
    - **Description**: Generates schedule slots and restaurant recommendations, caching them in the database.

### 📍 Location Proxy Router (`/location`)
*   `GET /location/search`
    - **Description**: Queries OpenStreetMap's Nominatim search service for coordinates matching the keyword.
*   `GET /location/reverse`
    - **Description**: Performs reverse geocoding to retrieve structured address details from lat/lng inputs.

---

## 2. Suggestion & Scheduling Algorithms

DISHCISION runs two recommendation pipelines: a scheduling engine to locate optimal times, and a Multi-Criteria Decision-Making (MCDM) model to rank dining venues.

### A. Time Slot Recommendation Algorithm (`get_suggested_slots`)

This model divides the requested meeting duration into 30-minute intervals and evaluates availability for each participant.

#### 1. Overlap Weighting
For each evaluated slot $s$, the engine calculates the overlap duration in minutes $OM_{i,s}$ for each attendee $i$. The individual overlap weight $O_{i,s}$ is defined as:

$$O_{i,s} = \frac{OM_{i,s}}{\text{Duration}_s}$$

where $\text{Duration}_s$ is the total length of the meeting slot in minutes. 
- If $O_{i,s} \ge 1.0$, the attendee is classified as **Fully Free** (Full Join).
- If $0.0 < O_{i,s} < 1.0$, the attendee is classified as **Partially Free** (Partial Join).

#### 2. Adjusted Attendee Counts and Ratios
Ratios are computed to account for partial joins.
The Adjusted Count ($AC$) for Key Persons ($kp$) and General Attendees ($at$) are:

$$AC_{kp} = \sum_{i \in \text{KP}} \mathbb{I}[O_{i,s} \ge 1.0] + \sum_{i \in \text{KP}} O_{i,s} \cdot \mathbb{I}[0.0 < O_{i,s} < 1.0]$$

$$AC_{at} = \sum_{i \in \text{AT}} \mathbb{I}[O_{i,s} \ge 1.0] + \sum_{i \in \text{AT}} O_{i,s} \cdot \mathbb{I}[0.0 < O_{i,s} < 1.0]$$

where $\mathbb{I}$ is the indicator function. The adjusted ratio percentage metrics ($R_{kp}$ and $R_{at}$) are:

$$R_{kp} = \left( \frac{AC_{kp}}{|\text{KP}|} \right) \times 100$$

$$R_{at} = \left( \frac{AC_{at}}{|\text{AT}|} \right) \times 100$$

#### 3. Scoring Components (0 to 10 Scale)
- **Availability Score ($N_{avail}$)**: 
  Weighted combination of Key Persons (70%) vs General Attendees (30%):
  $$\text{Raw Availability} = \frac{R_{kp} \times 0.7 + R_{at} \times 0.3}{10}$$
  $$N_{avail} = 1.0 + \left( \frac{\text{Raw Availability}}{10.0} \right) \times 9.0$$

- **Meal Preference Alignment ($N_{meal}$)**:
  Measures slot alignment with the dining types (Lunch/Dinner) selected by attendees:
  $$N_{meal} = 1.0 + \left( \frac{\text{Meal Score}}{\text{Max Meal Score}} \right) \times 9.0$$

- **Time Quality ($N_{quality}$)**:
  Scores the slot based on dining hour preferences (e.g. 12:00 and 18:30 get maximum points):
  $$N_{quality} = 1.0 + \left( \frac{\text{Points}}{\text{Max Points}} \right) \times 9.0$$

#### 4. Final Weighted Time Slot Score
$$\text{Final Score} = (0.7 \times N_{avail}) + (0.2 \times N_{meal}) + (0.1 \times N_{quality})$$

Any time slots with a score greater than 0 are stored, sorted descending, and returned.

---

### B. MCDM Restaurant Scoring Algorithm (`get_suggesested_restaurants`)

The restaurant scoring pipeline ranks venues using a multi-criteria decision-making model combined with a social boost parameter.

#### 1. Rank Order Centroid (ROC) Weighting
To convert attendee's priority focus factors (e.g. Price, Category, Vibe) into mathematical weights, the system uses Rank Order Centroid (ROC).
For $k$ prioritized elements, the weight of rank position $r$ (where $r=1$ is highest priority) is defined as:

$$w_r = \frac{1}{k} \sum_{j=r}^k \frac{1}{j}$$

For example, if a user selects exactly $k=3$ priorities:
- **Priority 1**: $w_1 = \frac{1}{3} \cdot (1 + \frac{1}{2} + \frac{1}{3}) = 0.611$ (61.1% weight)
- **Priority 2**: $w_2 = \frac{1}{3} \cdot (\frac{1}{2} + \frac{1}{3}) = 0.278$ (27.8% weight)
- **Priority 3**: $w_3 = \frac{1}{3} \cdot (\frac{1}{3}) = 0.111$ (11.1% weight)
- **Unranked attributes**: weight = $0.0$.

If a user assigns multiple items to the same priority rank, the ROC weights for those rank slots are averaged across the items.

#### 2. Individual Preference Matching
The individual match score $S_{i}$ for attendee $i$ and restaurant $R$ is calculated as:

$$S_{i} = \sum_{A \in \text{Criteria}} w_{i,A} \cdot s_{i,A}$$

where $s_{i,A} \in [0.0, 100.0]$ represents the match score of attribute $A$ for restaurant $R$:
- **Price Match ($s_{i,\text{Price}}$)**: $100.0$ if the price level matches the user's preference or if preference is `"Any"`, else $0.0$.
- **Cuisine Match ($s_{i,\text{Category}}$)**: $100.0$ if there is an intersection between restaurant categories and preferred cuisines, else $0.0$.
- **Vibe Match ($s_{i,\text{Vibe}}$)**: $100.0$ if there is an intersection between restaurant descriptors and preferred vibes, else $0.0$.
- **Proximity Match ($s_{i,\text{Station}}$)**: Mapped using linear decay from transit stations:
  $$s_{i,\text{Station}} = \max\left(0.0, \, 1.0 - \frac{\text{Distance to Station}}{\text{Max Walk Distance}}\right) \times 100.0$$
- **Rating Match ($s_{i,\text{Rating}}$)**: Mapped from the Wongnai rating (0-5 stars):
  $$s_{i,\text{Rating}} = \left( \frac{\text{Wongnai Rating}}{5.0} \right) \times 100.0$$
- **Parking/Alcohol ($s_{i,\text{Parking}}, s_{i,\text{Alcohol}}$)**: $100.0$ if required and present (or not required), else $0.0$.

#### 3. Group Score Integration
The average scores for Key Persons ($Score_{kp}$) and General Attendees ($Score_{at}$) are combined using the Key Decision Weight $W_{kp}$ (defaulting to 0.7):

$$Score_{kp} = \frac{1}{|KP|} \sum_{i \in KP} S_i$$

$$Score_{at} = \frac{1}{|AT|} \sum_{i \in AT} S_i$$

$$Score_{\text{base}} = (Score_{kp} \cdot W_{kp}) + (Score_{at} \cdot [1.0 - W_{kp}])$$

#### 4. Social Recommendation Boost
If a venue was explicitly suggested/recommended by group members, the system applies a manual boost of $+15$ points:

$$Score_{\text{final}} = \min(Score_{\text{base}} + 15.0 \cdot \mathbb{I}[R \in \text{Suggested}], \, 100.0)$$
