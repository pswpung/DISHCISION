# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - Unreleased

### Added
- **Decision Panel Page**: New `/decision` route with organizer mode (confirm & notify) and observer mode (read-only waiting state). Organizer can pick or spin wheel for both time slot and restaurant. Includes the `SpinWheel` canvas component extracted to shared `components/spin-wheel/`.
- **Auto-Trigger on All Votes**: When the last attendee submits their preference, `PATCH /attendee/{meetingId}/{userId}` now auto-triggers suggestion generation in the background.
- **Summary Flex Message**: New `push_message_decision_summary_flex` sent to LINE group when all votes are collected — shows X/Y voted, attendee names, time range, and "Review & Decide" button linking to `/decision`.
- **InfoTooltip Component**: Reusable CSS-only tooltip component for adding (i) help icons to form labels. Used on "Key Decision Makers" and "Timing Mode" fields in create-meeting form.
- **Survey mode preferences toggle**: Preferences step hidden from normal create-meeting flow, only shown when `survey_mode=true`.
- **Interactive Survey Mode**: Feedback page now has "Try it →" action cards linking to `/create-meeting`, `/availability`, and `/result` pages so testers can explore features before answering. Responses persist via `sessionStorage` across navigation. Target pages show a **Survey Mode** banner with a "← Back to Survey" button, and all submit/vote/spin actions are blocked with a preview-mode alert.
- **Context-aware Feedback Modal**: Replaced bulky inline meeting context panels in survey sections 2–3 with a 📋 info icon per question — clicking opens a scrollable modal overlay with the full time/restaurant context, then closes to continue answering. Added hint text below section headers explaining the icon.
- **Refined Voting Wizard**: Introduced a self-contained, state-driven `VotingForm` component (Steps 1–3) for RSVP, Availability, and Preferences, ensuring architectural parity with `CreateMeetingForm`.
- **Smart Location Sync**: Departure location now automatically synchronizes with the meeting's fixed location if provided by the organizer, including automatic geocoding for coordinates.
- **Advanced Preferences UI**: Added searchable multi-select chips for "Avoid Cuisine" and refined the "Prefer Cuisine" selection flow.
- **Availability Parser**: Added `availability-parser.ts` to support complex availability strings and parsing.
- **New Dependency**: Integrated `chrono-node` for natural language date and time parsing in the frontend.
- **E2E Testing Setup**: Added Playwright, `e2e/feedback.spec.ts`, and `npm run test:e2e` command.

### Changed
- **Glassmorphism Design System**: Standardized the premium "glass-panel" aesthetic across all forms, inputs, and interactive components.
- **Theme-Aware Accessibility**: Overhauled dropdown and selection chip styling using theme-aware CSS variables to ensure high contrast and legibility in both light and dark modes (addressing the "white-on-white" issue).
- **UX Flow Optimization**: If both system and user-suggested restaurants are disabled, the voting flow now skips Step 3 and presents a "Ready to Go!" completion state.
- **Voting UI Optimization**: Removed Decision tab/panel from `/result` page (voting page). Introduced sticky bottom action footer that handles voter readiness (`handleToggleReady`) with a success banner when votes are submitted, and options to edit preferences. Added "Go to Decision Page" button for the Organizer.
- **Slots Voting Layout**: Relocated the time slot vote buttons to the bottom of each slot card as full-width modern glass buttons matching `design.md` baseline for improved visibility.
- **Database Table Creation Order**: Moved `Base.metadata.create_all(bind=engine)` before the manual migration queries in [main.py](file:///Users/pasawee.p/Second%20Brain/1.%20Projects/Restaurant%20Suggestion/dishcision-line-bot/backend/main.py). This ensures that on a clean database start, all tables are fully created before any `ALTER TABLE` queries run, preventing `RelationNotFound` errors.
- **Python Version Pinning**: Constrained the Python version in [pyproject.toml](file:///Users/pasawee.p/Second%20Brain/1.%20Projects/Restaurant%20Suggestion/dishcision-line-bot/backend/pyproject.toml) to `requires-python = ">=3.11,<3.13"`. This forces `uv` to use Python 3.12 (instead of a newer unreleased version like 3.14), ensuring that prebuilt wheels for `numpy` and other scientific packages are fetched directly, avoiding local source compilation and the need for development compilers like `gcc`.
- **Database Driver Dependency**: Swapped `psycopg2` for `psycopg2-binary` in [pyproject.toml](file:///Users/pasawee.p/Second%20Brain/1.%20Projects/Restaurant%20Suggestion/dishcision-line-bot/backend/pyproject.toml) to prevent source-compilation errors (`pg_config executable not found`) on production/deployment environments lacking PostgreSQL development libraries.
- **Unique Feedback Validation**: Handled backend-returned `409 Conflict` status errors inside the feedback page's submission loop, alerting users with a localized message (`คุณเคยทำแบบประเมินสำหรับกิจกรรมนี้แล้ว`) if they attempt a duplicate submission.
- **Decision Page Survey Mode**: Added support for local simulation overrides when `survey_mode=true` is present in the URL on `/decision`. Forced `isOrganizer` to `true` to let survey responders try organizer capabilities (decision methods, wheels, selections) while safety-blocking actual API database modifications, disabling the confirmation action with a preview label, and displaying the sticky `SurveyModeBanner` header at the top.
- **Survey Return Navigation**: Replaced the bottom "Back" button on the `/decision` page with a prominent `← กลับสู่แบบสอบถาม (Back to Survey)` action button when in survey mode to return the user directly back to the active questionnaire.
- **Match Score Display**: Displayed the calculated system match score next to each restaurant candidate on the decision page (both in the main list and in the wheel selection settings) to aid organizers in choosing.
- **Spin Wheel Stop Transition**: Created a new `/reset-wheel` endpoint to transition `wheel_state.status` to `idle` on completion, resolving the bug where buttons would continue displaying "Spinning..." after the wheel animation came to a stop.
- **Confirm Meeting Plan Fix**: Appended missing keys (`final_score`, `restaurants`, `attendee_names`) to the finalized slot payload on meeting confirmation, preventing a backend `KeyError` that was crashing the final LINE Flex Message delivery.
- **Vibrant Call-To-Action (CTA) Styles**: Upgraded timeslot and restaurant voting buttons with glowing outline borders, premium hover states, and descriptive labels (`Select This Time`, `Prefer`, etc.) to significantly improve user affordance and visual hierarchy.
- **Result Page Filter Collapser**: Introduced a premium "Show Filters" / "Hide Filters" toggle to collapse or expand the Cuisine and Vibe filter lists on the result page, keeping the view clean.
- **Conditional Refine Search Row**: Configured the "Refine Search" filter drawer trigger row to automatically hide when the **Slots** tab is active, displaying only when looking at **Restaurants**.
- **State Overwrite Safeguard**: Configured synchronization hooks to safeguard local pending slot and restaurant selections from being overwritten by 3-second background database polling while the user is actively editing/voting.
- **Batch Restaurant Voting**: Unified restaurant voting with timeslots, storing preferred selections in a local state pending set and committing them to the database in a single transaction via `apiService.submitVotes` upon clicking the "Submit My Votes" button.
- **Decision Page Profiles**: Enriched attendee information using group users to display actual user profiles/names instead of raw user IDs in the voting summary table.
- **Decision Page Attendee Layout**: Upgraded the text-list of attendee statuses in the voting summary section on the `/decision` page to match the premium flex attendee chips layout (with profile picture support and custom borders) used in `/result` for layout cohesion.
- **Meeting Creation Submission Lock**: Implemented `isSubmitting` state lock to disable further action during submission, preventing duplicate meeting invitations/flex messages from being pushed on double-clicks.
- **Spin Wheel Filters**: Added a filter switch ("Voted Slots Only" / "All Slots") on the organizer decision spin wheel to allow easily restricting candidates to only slots that have votes.
- **Finalized Meeting Flex Message**: Updated `push_message_result_flex` to show a primary "Review Final Details" button linking to the decision dashboard on finalized meetings, alongside a secondary "View on Wongnai" button if a restaurant link is available. If `ENABLE_BETA_SURVEY` is active, a dedicated beta feedback survey bubble is automatically appended to the LINE carousel.
- **Backend Developer Experience**: Enabled auto-reload in `main.py` for the uvicorn development server.

### Fixed
- Resolved JSX compilation errors in `VotingForm.tsx` caused by orphaned container tags.
- Corrected contrast issues where selected chips were unreadable in dark mode.
- Improved coordinate validation for geocoding results to ensure they fall within the Bangkok & Vicinity service area.

## [1.0.0] - 2026-05-07

### Added
- Implemented static scoring algorithms for Time Slot and Restaurant suggestions, fully documented in `backend/SCORING.md`.
  - **Time Slot Suggestion (`get_suggested_slots`)**: Calculates scores based on Availability (50%), Meal Preference (30%), and Time Quality (20%).
  - **Restaurant Suggestion (`get_suggesested_restaurants`)**: Uses a Weighted Voting System that prioritizes Key Persons (70%) over General Attendees (30%), evaluating attributes like Price, Category, Vibe, Distance, and more.
