# DISHCISION Backend Documentation

This directory contains the Python FastAPI backend for **DISHCISION**. The system manages users, meetings, attendee schedules, and coordinates recommendation engines to solve group dining constraints.

---

## Setup

### Prerequisites
- **Python 3.11+** (managed via `uv`)
- **Docker** (for local PostgreSQL with pgvector)
- **uv** — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`

### Quick Start

```bash
# 1. Start the database
cd deploy && docker compose up -d

# 2. Install backend dependencies
cd backend && uv sync

# 3. Run the backend (auto-reload on :8081)
uv run main.py
```

The database tables are auto-created on first startup via SQLAlchemy `Base.metadata.create_all`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:P%40ssw0rd@localhost:54321/postgres` | PostgreSQL connection string with pgvector |
| `LINE_CHANNEL_ACCESS_TOKEN` | — | LINE Messaging API channel token |
| `LINE_CHANNEL_SECRET` | — | LINE Messaging API channel secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | — | Google OAuth redirect URI |

### Project Layout

```
backend/
├── main.py                 # Entry point — starts uvicorn on :8081
├── pyproject.toml          # Dependencies (uv-managed)
├── uv.lock                 # Lockfile
├── api/                    # FastAPI routers (line, meetings, users, etc.)
├── services/               # Business logic (postgres, line, suggestion engine)
├── models/                 # SQLAlchemy ORM models
├── statics/                # Restaurant CSV data (loaded at import time)
└── utils/                  # Helpers (embeddings, time utils, MCDM weights)
```

### Notes
- Package manager is `uv` — never use `pip` or `poetry`.
- `numpy<2` pinned in `pyproject.toml`.
- Static file paths are relative to CWD (run from `backend/`).
- Timezone is hardcoded to `Asia/Bangkok`.
- **Flex Message Design**: All LINE Flex messages follow the spec in [`flex-design.md`](flex-design.md) (color palette, header/body/button patterns).

---

## 1. REST API Endpoints Reference

The backend is modularized into FastAPI routers. The following is a detailed catalog of exposed endpoints.

### 💬 LINE Bot Commands

| Command | Action |
|---------|--------|
| `#create-meeting` / `#สร้างนัด` | Sends a "Create Meeting" LIFF button flex |
| `#register` | Registers the sender's LINE profile to the database |
| `#help` | Displays the bot command list flex |
| (unknown) | Silently ignored — no reply sent |

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
*   `GET /users/{user_id}/last-preference`
    - **Description**: Fetches the last submitted MCDM preferences for a user to prefill new forms.
*   `PATCH /users/{user_id}`
    - **Description**: Updates user profile properties (display name, picture URL, group mapping).
*   `DELETE /users/{user_id}`
    - **Description**: Removes user registration data.

### 📅 Meetings Router (`/meetings`)
*   `POST /meetings`
    - **Description**: Creates a new group dining meeting. If attendees contain other members, it pushes an invite card (Flex Message) to the LINE group chat.
*   `GET /meetings/{meeting_id}`
    - **Description**: Fetches meeting metadata (name, config) and sanitized real-time voting states.
    - **Voting State JSON Structure**:
      ```json
      {
        "exclude_vetoed": false,
        "selected_restaurants": [],
        "selected_time_slots": [],
        "restaurant_preferences": {
          "Restaurant Name": ["user_id_1", "user_id_2"]
        },
        "restaurant_vetoes": {
          "Restaurant Name": 2
        },
        "restaurant_vetoes_users": {
          "Restaurant Name": ["user_id_3", "user_id_4"]
        },
        "time_slot_votes": {
          "2026-05-28_18:00": ["user_id_1"]
        },
        "ready_attendees": ["user_id_1"]
      }
      ```
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
*   `POST /meetings/{meeting_id}/reset-wheel`
    - **Description**: Resets the spin wheel state to allow spin repetition or reconfiguration.
*   `POST /meetings/{meeting_id}/select-wheel-restaurants`
    - **Description**: Logs a subset of user-selected restaurants to populate the tie-breaker wheel.
*   `POST /meetings/{meeting_id}/toggle-exclude-vetoed`
    - **Description**: Toggles whether restaurants containing any vetoes (Tail Out) should be excluded from the results list for this meeting.
*   `POST /meetings/{meeting_id}/confirm-final`
    - **Description**: Locks confirmed time slot and venue selections, marks meeting status as `"closed"`, and pushes the final ticket Flex Message to the LINE group.
*   `POST /meetings/{meeting_id}/submit-votes`
    - **Description**: Batch saves a user's voted time slots (`voted_slots`) and restaurants (`voted_restaurants`). Adds user to `votes_submitted` list. When all joined attendees have submitted, sends `push_message_decision_summary_flex` to the LINE group.
*   `POST /meetings/{meeting_id}/select-wheel-time-slots`
    - **Description**: Saves which time slots the organizer selected for the spin wheel.
*   `POST /meetings/{meeting_id}/feedback`
    - **Description**: Submits beta user feedback answers and saves them as a structured JSON object in the database's `feedbacks` table.
*   `GET /meetings/{meeting_id}/feedback/{user_id}`
    - **Description**: Fetches feedback submitted by a specific user for a specific meeting.


### 🙋 Meeting Attendees Router (`/attendee`)
*   `POST /attendee`
    - **Description**: Registers a user to a meeting.
*   `GET /attendee/{meeting_id}`
    - **Description**: Lists all attendees for a meeting.
*   `PATCH /attendee/{meeting_id}/{user_id}`
    - **Description**: Submits or updates an attendee's availability schedule and MCDM preferences (`is_joined`, `avaliable_at`, `preference`). When all invited attendees have submitted (`preference is not None`), auto-triggers the suggestion engine as a background task. If zero attendees joined (`is_joined == True`), sends `push_message_all_declined_flex` instead — no scoring occurs. Scoring and flex messages exclude declined (`is_joined = False`) attendees.
*   `DELETE /attendee/{meeting_id}/{user_id}`
    - **Description**: Unregisters attendee from a meeting.

### 🍽️ Restaurant Suggestion Router (`/restaurant`)
*   `GET /restaurant/config`
    - **Description**: Exposes available values for preferences (sorted price lists, categories, parking, alcohols, vibes).
*   `POST /restaurant/suggest/{meeting_id}`
    - **Description**: Generates schedule slots and restaurant recommendations, caching them in the database.
*   `GET /restaurant/search`
    - **Description**: Performs a hybrid vector search or fast name-based query against the database using a search keyword.

### 🧪 Playground Router (`/playground`)
*   `POST /playground/calculate`
    - **Description**: Accepts a simulated list of attendees (each with custom priorities, price, categories, vibes, parking, alcohol, location coords, and max walk distance) and a candidate restaurant, returning overall score, individual match score details, dynamic weights, and criteria summaries.

### 📍 Location Proxy Router (`/location`)
*   `GET /location/search`
    - **Description**: Queries OpenStreetMap's Nominatim search service for coordinates matching the keyword.
*   `GET /location/reverse`
    - **Description**: Performs reverse geocoding to retrieve structured address details from lat/lng inputs.

---

## 2. Suggestion & Scheduling Algorithms

DISHCISION runs two recommendation pipelines: a scheduling engine to locate optimal times, and a Multi-Criteria Decision-Making (MCDM) model to rank dining venues.

## Algorithm I : Time Suggestion
---
The system evaluates every possible 30-minute slot within the meeting date range and assigns a **Final Score (1-10)** based on three weighted components.

> **Note:** All component scores are first calculated on a 0-10 scale and then mapped to a 1-10 scale using linear scaling: 
>
> $$S_{\text{scaled}} = 1 + \left( \frac{S_{\text{raw}}}{10} \times 9 \right)$$
>
> Where:
> - $S_{\text{scaled}}$: The scaled component score mapped to the final 1–10 rating.
> - $S_{\text{raw}}$: The raw component score calculated on a 0–10 scale.

### Formula
---
$$S_{\text{final}} = (S_{\text{avail}} \times 0.7) + (S_{\text{meal}} \times 0.2) + (S_{\text{quality}} \times 0.1)$$

Where:
- $S_{\text{final}}$: The final score of the time slot (1–10).
- $S_{\text{avail}}$: The Availability Score of the group (0–10).
- $S_{\text{meal}}$: The Meal Preference Score (0–10).
- $S_{\text{quality}}$: The Time Quality Score (0–10).

### Components
---
#### A. Availability Score (70%)
Measures how many people can attend, prioritizing Key Persons over General Attendees. Rather than evaluating attendance as binary (1 or 0), the system dynamically computes **Full Joins** and **Partial Joins** based on the overlap between an attendee's availability and the candidate slot's duration:

*   **Full Join**: The attendee is available for the entire duration of the slot.
*   **Partial Join**: The attendee is available for part of the slot. A fractional weight is assigned:
    $$\text{weight}_p = \frac{\text{overlap\_minutes}}{\text{slot\_duration\_minutes}}$$

These weights are used to calculate the adjusted ratios of Key Persons and General Attendees:

$$S_{\text{avail}} = \left( (R_{\text{kp}} \times W_{\text{kp}}) + (R_{\text{gen}} \times W_{\text{gen}}) \right) \times 10$$

Where:
- $S_{\text{avail}}$: The calculated availability score (0–10).
- $R_{\text{kp}}$: The adjusted ratio of available Key Persons:
  $$R_{\text{kp}} = \frac{\text{full\_kp\_count} + \sum_{p \in \text{partial\_kp}} \text{weight}_p}{\text{Total Key Persons}}$$
- $R_{\text{gen}}$: The adjusted ratio of available General Attendees:
  $$R_{\text{gen}} = \frac{\text{full\_at\_count} + \sum_{p \in \text{partial\_at}} \text{weight}_p}{\text{Total Attendees}}$$
- $W_{\text{kp}}$: The weight assigned to Key Persons (default is $0.7$).
- $W_{\text{gen}}$: The weight assigned to General Attendees (default is $0.3$).

*Example: If a 2-hour slot is evaluated, and the only Key Person ($N_{\text{kp}} = 1$) can join for only 1.5 hours ($\text{weight}_p = 0.75$), the adjusted ratio $R_{\text{kp}}$ is $0.75$ instead of $0$ (which would occur if full attendance was strictly required).*

#### B. Meal Preference Score (20%)
Measures if the slot duration matches the group's meal preferences (e.g., Lunch or Dinner).
- **Goal:** Suggest a slot long enough for a proper meal.
- **Max Score:** Based on total attendee count multiplied by ideal duration steps (e.g., 2 hours = 4 steps).

$$S_{\text{meal}} = \frac{P_{\text{accumulated}}}{P_{\text{max}}} \times 10$$

Where:
- $S_{\text{meal}}$: The meal preference score (0–10).
- $P_{\text{accumulated}}$: Total accumulated points based on overlap with the ideal meal hours requested by attendees.
- $P_{\text{max}}$: The maximum possible points for the slot duration (total attendee count $\times$ ideal duration steps).

#### C. Time Quality Score (10%)
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
## Algorithm II : Restaurant Suggestion
---
The system ranks restaurants using a **Weighted Decision-Making System** that prioritizes Key Decision Makers.

### High-Level Logic
---
1.  **Filter Candidates**:
    *   **Distance**: Must be within **10km** of the group's meeting location center. The center coordinates $(\text{Lat}_{\text{center}}, \text{Lng}_{\text{center}})$ are calculated as:
        1. If the organizer has fixed the meeting place/coordinates, the fixed location is used.
        2. Otherwise, it defaults to the average coordinates of the preferred locations submitted by all attendees:
           $$\text{Lat}_{\text{center}} = \frac{\sum_{i=1}^{N} \text{Lat}_i}{N}, \quad \text{Lng}_{\text{center}} = \frac{\sum_{i=1}^{N} \text{Lng}_i}{N}$$
           Where $N$ is the total number of attendees, and $(\text{Lat}_i, \text{Lng}_i)$ is attendee $i$'s preferred location (which defaults to their current GPS coordinates if not customized).
    *   **Avoid Categories (Veto List)**: The system aggregates the `avoid_categories` lists submitted by all attendees. Any restaurant whose category matches any category in this compiled group-wide avoid list is immediately filtered out of the candidate pool.
    *   **Category/Good For**: If the candidate list is still very large (> 1000) after location and avoid filtering, it filters by the *union* of group preferences (preferred categories and vibes) to narrow down candidates.
2.  **Calculate Base Scores (0-100)** for two groups separately:
    *   **Key Persons Group** (Organizer + VIPs)
    *   **General Attendees Group** (Everyone else)
3.  **Weighted Combination**:

$$S_{\text{final}} = (S_{\text{key}} \times W_{\text{kp\_stakeholder}}) + (S_{\text{gen}} \times W_{\text{gen\_stakeholder}})$$

Where:
- $S_{\text{final}}$: The combined final decision score of the restaurant (0–100).
- $S_{\text{key}}$: The base score of the restaurant for the Key Persons group (0–100).
- $S_{\text{gen}}$: The base score of the restaurant for the General Attendees group (0–100).
- $W_{\text{kp\_stakeholder}}$: Stakeholder weight for Key Persons (default is $0.7$, adjustable between $0.7 - 0.9$).
- $W_{\text{gen\_stakeholder}}$: Stakeholder weight for General Attendees (defined as $1 - W_{\text{kp\_stakeholder}}$, default is $0.3$).

### Base Score Calculation (0-100)
---
For *each group* (Key or General), the group score is the average of the individual attendee scores in that group:

$$S_{\text{group}} = \frac{\sum_{i=1}^{N_{\text{group}}} S_{\text{attendee}, i}}{N_{\text{group}}}$$

Where:
- $S_{\text{group}}$: The score for the group ($S_{\text{key}}$ or $S_{\text{gen}}$).
- $N_{\text{group}}$: The total number of attendees in the group.
- $S_{\text{attendee}, i}$: The individual score calculated for attendee $i$ (0–100).

#### Individual Attendee Score ($S_{\text{attendee}}$)
Each attendee's score is computed using their personalized Reciprocal Rank Centroid (ROC) weights:

$$S_{\text{attendee}} = \sum_{f \in F} w_f \times s_f$$

Where:
- $F$: The set of criteria factors: $\{\text{Price, Category, Vibe, Station, Rating, Parking, Alcohol, AICraving}\}$.
- $w_f$: The individual ROC weight for factor $f$, calculated based on the attendee's ranked priorities.
- $s_f$: The match score of the restaurant for factor $f$ (0 or 100, except for continuous metrics like Station Proximity and Rating):

##### 1. Individual ROC Weight Calculation ($w_f$):
The software offers three modes for factor weight determination:
- **AI Craving Mode**: If the attendee provides a non-empty `free_text` query, the prioritization process is bypassed entirely. The `AICraving` factor receives a weight of `1.0`, and all other factors are set to `0.0`.
- **Normal Mode**: Allows attendees to strictly drag-and-drop or select one factor per rank level (no ties).
- **Advanced Mode**: Allows attendees to group multiple factors together in the same rank tier (creating tied priorities).

For any prioritized list of lists in Normal or Advanced Mode (where rank 1 is highest priority), the ROC weight for a factor at rank slot position $r$ out of $k$ total prioritized items is:
$$w_r = \frac{1}{k} \sum_{j=r}^{k} \frac{1}{j}$$

- **Tied-Rank Weight Adjustment (Advanced Mode)**: When multiple factors share the same priority tier $T$, they share the average of the ROC weights of the rank slots they span. For a tier $T$ covering rank slots from $r_{\text{start}}$ to $r_{\text{end}}$:
  $$w_f = \frac{1}{|T|} \sum_{i=r_{\text{start}}}^{r_{\text{end}}} w_i, \quad \forall f \in T$$
  Where $|T| = r_{\text{end}} - r_{\text{start}} + 1$ is the number of factors in that tier.
- **Unranked Fallback**: Factors not prioritized by the attendee receive a weight of $0.0$. If no priorities are specified at all (and no `free_text` is provided), all standard factors share equal weight ($1/7$ or $\approx 14.3\%$).

###### **Normal Mode Example (Strict Ordering: One factor per rank)**
Suppose a user prioritizes exactly three single factors: Rank 1 = $\text{Category}$, Rank 2 = $\text{Price}$, Rank 3 = $\text{Vibe}$.
- Here, $k = 3$ total items.
- **Rank 1 ($\text{Category}$)**:
  $$w_1 = \frac{1}{3} \left( \frac{1}{1} + \frac{1}{2} + \frac{1}{3} \right) = \frac{1}{3} \left( 1 + 0.5 + 0.333 \right) \approx 0.611 \text{ (61.1\% weight)}$$
- **Rank 2 ($\text{Price}$)**:
  $$w_2 = \frac{1}{3} \left( \frac{1}{2} + \frac{1}{3} \right) = \frac{1}{3} \left( 0.5 + 0.333 \right) \approx 0.278 \text{ (27.8\% weight)}$$
- **Rank 3 ($\text{Vibe}$)**:
  $$w_3 = \frac{1}{3} \left( \frac{1}{3} \right) \approx 0.111 \text{ (11.1\% weight)}$$
- **All other unranked factors** (Station, Rating, Parking, Alcohol, AICraving) receive $w_f = 0.0$.

###### **Advanced Mode Example (Tied Ordering: Multiple factors per rank)**
Suppose a user prioritizes three factors but groups two of them together: Rank 1 = $[\text{Price}, \text{Category}]$, Rank 2 = $[\text{Vibe}]$.
- Total items $k = 3$. The raw ROC weights for ranks 1, 2, and 3 are calculated as $w_1 = 0.611$, $w_2 = 0.278$, and $w_3 = 0.111$ (identical to Normal Mode).
- **Rank 1 Tier ($\text{Price}$ and $\text{Category}$)** spans slots 1 and 2. They share the average weight of these slots:
  $$w_{\text{Price}} = w_{\text{Category}} = \frac{w_1 + w_2}{2} = \frac{0.611 + 0.278}{2} \approx 0.444 \text{ (44.4\% weight each)}$$
- **Rank 2 Tier ($\text{Vibe}$)** spans slot 3:
  $$w_{\text{Vibe}} = w_3 \approx 0.111 \text{ (11.1\% weight)}$$
- **All other unranked factors** receive $w_f = 0.0$.


##### 2. Match Scores ($s_f$):
- **Price Match ($s_{\text{Price}}$)**:
  $$s_{\text{Price}} = \begin{cases} 100 & \text{if preference is "Any" or matches restaurant price tier} \\ 0 & \text{otherwise} \end{cases}$$
- **Category Match ($s_{\text{Category}}$)**:
  $$s_{\text{Category}} = \begin{cases} 100 & \text{if any preferred category overlaps restaurant category list or if preference list is empty} \\ 0 & \text{otherwise} \end{cases}$$
- **Vibe Match ($s_{\text{Vibe}}$)**:
  $$s_{\text{Vibe}} = \begin{cases} 100 & \text{if preference list is empty or restaurant has no vibe tags} \\ 0 & \text{if } N_{\text{overlap}} = 0 \\ 100 & \text{if } N_{\text{preferred}} = 1 \text{ and } N_{\text{overlap}} = 1 \\ 70 + \left( \frac{N_{\text{overlap}} - 1}{N_{\text{preferred}} - 1} \right) \times 30 & \text{otherwise} \end{cases}$$
  Where $N_{\text{overlap}}$ is the number of matching vibes between the restaurant and the attendee's preference list, and $N_{\text{preferred}}$ is the total number of preferred vibes requested. This awards a strong baseline score of $70$ for the first match, and dynamically scales the remaining $30$ points for subsequent matches.
- **Station Proximity ($s_{\text{Station}}$)**:
  $$s_{\text{Station}} = \begin{cases} \left( 1 - \frac{d}{d_{\text{max\_walk}}} \right) \times 100 & \text{if } d < d_{\text{max\_walk}} \\ 0 & \text{otherwise} \end{cases}$$
  Where $d$ is geodesic distance to nearest BTS/MRT station, and $d_{\text{max\_walk}}$ is the attendee's custom walk limit in km (default $1.0\text{ km}$).
- **Rating Match ($s_{\text{Rating}}$)**:
  $$s_{\text{Rating}} = \frac{R}{5.0} \times 100$$
  Where $R$ is the restaurant's rating (0.0 to 5.0).
- **Parking Match ($s_{\text{Parking}}$)**:
  $$s_{\text{Parking}} = \begin{cases} 100 & \text{if parking is not required or restaurant has parking} \\ 0 & \text{otherwise} \end{cases}$$
- **Alcohol Match ($s_{\text{Alcohol}}$)**:
  $$s_{\text{Alcohol}} = \begin{cases} 100 & \text{if alcohol is not required or restaurant has alcohol} \\ 0 & \text{otherwise} \end{cases}$$
- **AI Craving Match ($s_{\text{AICraving}}$)**:
  $$s_{\text{AICraving}} = \begin{cases} \max(0, \cos(\theta)) \times 100 & \text{if free-text query exists} \\ 100 & \text{otherwise} \end{cases}$$
  Where $\cos(\theta)$ is the cosine similarity between the attendee's request embedding and the restaurant description embedding.

### Example
---
Suppose a group has 1 Key Person (with stakeholder weight $0.7$) and 1 General Attendee (with stakeholder weight $0.3$).
- **Key Person**: Prioritizes $\text{Category}$ (Rank 1). ROC weight $w_{\text{Category}} = 1.0$, all other weights $0.0$.
  - Wants **Italian** category.
- **General Attendee**: Prioritizes $\text{Category}$ (Rank 1). ROC weight $w_{\text{Category}} = 1.0$, all other weights $0.0$.
  - Wants **Japanese** category.

Scoring a candidate **Italian** restaurant:
- **Key Person Score**: $S_{\text{KeyPerson}} = w_{\text{Category}} \times s_{\text{Category}} = 1.0 \times 100 = 100.0$.
- **General Attendee Score**: $S_{\text{General}} = w_{\text{Category}} \times s_{\text{Category}} = 1.0 \times 0 = 0.0$.
- **Weighted Score**: $S_{\text{final}} = (100.0 \times 0.7) + (0.0 \times 0.3) = 70.0$.

Scoring a candidate **Japanese** restaurant:
- **Key Person Score**: $S_{\text{KeyPerson}} = 1.0 \times 0 = 0.0$.
- **General Attendee Score**: $S_{\text{General}} = 1.0 \times 100 = 100.0$.
- **Weighted Score**: $S_{\text{final}} = (0.0 \times 0.7) + (100.0 \times 0.3) = 30.0$.

Result: The **Italian** restaurant wins because the Key Person's preference dominates through the group weights.

## High-Level Flow Diagram
---
```mermaid
sequenceDiagram
    autonumber
    participant Att as Attendee (via PATCH)
    participant API as API Handler
    participant DB as PostgreSQL
    participant LINE as LINE Messaging API

    Att->>API: PATCH /attendee/{meetingId}/{userId}
    API->>DB: Save is_joined, preference, avaliable_at

    API->>DB: Query ALL attendees for preference is None
    alt Not all voted (someone has preference = None)
        API-->>Att: Return ok, no further action
    else All have preference (not None)
        API->>DB: Count is_joined == True
        alt Zero joined (all declined)
            API->>LINE: push_message_all_declined_flex
        else Some joined
            API-->>API: background_generate_suggestion
            Note over API,LINE: [runs with is_joined == True filter — declined excluded]
            API->>LINE: push_message_result_flex ("Suggestions Ready, Let's Vote.")
        end
    end

    rect rgb(240, 240, 240)
    Note over API,LINE: Step 3 — Vote on Result Page
    Att->>API: POST /meetings/{id}/submit-votes
    API->>DB: Save voted_slots, voted_restaurants
    API->>DB: Check all joined attendees submitted
    alt All submitted
        API->>LINE: push_message_decision_summary_flex
    end
    end

    rect rgb(230, 240, 250)
    Note over API,LINE: Step 4 — Organizer Confirms
    Att->>API: POST /meetings/{id}/confirm-final
    API->>DB: Save final_decision, set status=closed
    API->>LINE: push_message_result_flex ("📍 Finalized Meeting")
    end
```

## Technical Sequence Diagram — Suggestion Algorithm
---
```mermaid
sequenceDiagram
    autonumber
    participant API as API Handler
    participant DB as PostgreSQL Database
    participant SW as Suggestion Workflow
    participant AM as Appointment Manager
    participant DS as Scoring Logic
    participant LINE as LINE Messaging API

    API->>DB: Query MeetingDetail, MeetingAttendee preferences, & UserDetail profiles
    DB-->>API: Return meeting & attendee metadata
    
    API->>SW: get_suggestion(meeting, attendees, user_details)
    activate SW
    SW->>AM: Initialize Appointment_Manager with config & key_weight

    alt Timing Mode is "fixed"
        SW->>SW: Construct static time slot containing all attendees
    else Timing Mode is "period"
        SW->>AM: get_suggested_slots(availabilities, config)
        activate AM
        AM->>AM: Evaluate 30-min slots (Availability, Meal preference, Time quality)
        AM-->>SW: Return attendees_availability with slot scores
        deactivate AM
    end

    SW->>AM: get_suggested_restaurants(attendees, availability, fixed_location)
    activate AM
    
    AM->>DB: Query candidate restaurants within 11km bounding box
    DB-->>AM: Return raw candidates
    AM->>AM: Filter by Geodesic Distance (<= 10km) & Avoid Categories
    
    loop For each nearby restaurant per time slot
        AM->>DS: _calculate_weighted_score(restaurant)
        activate DS
        Note right of DS: Computes individual attendee weights<br/>using ROC model. Averages scores<br/>for Key and General groups.
        DS->>DS: S_attendee = sum(w_f * s_f)
        DS->>DS: S_final = (S_key * W_kp) + (S_gen * W_gen)
        DS-->>AM: Return Restaurant Score (0-100)
        deactivate DS
    end
    
    AM->>AM: Map Top 5 Restaurants per time slot (Open Hours Check)
    AM-->>SW: Return preferred, suggested, & all scored lists
    deactivate AM

    SW-->>API: Return recommendation results dict
    deactivate SW

    API->>DB: Cache results in MeetingDetail.suggestion_detail
    DB-->>API: Confirm database commit
    
    API->>LINE: push_message_result_flex(top_slots, friend_recommends, discovery)
    API-->>User: Display Suggestions
```
