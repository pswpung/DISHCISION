# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - Unreleased

### Added
- **Refined Voting Wizard**: Introduced a self-contained, state-driven `VotingForm` component (Steps 1–3) for RSVP, Availability, and Preferences, ensuring architectural parity with `CreateMeetingForm`.
- **Smart Location Sync**: Departure location now automatically synchronizes with the meeting's fixed location if provided by the organizer, including automatic geocoding for coordinates.
- **Advanced Preferences UI**: Added searchable multi-select chips for "Avoid Cuisine" and refined the "Prefer Cuisine" selection flow.
- **Availability Parser**: Added `availability-parser.ts` to support complex availability strings and parsing.
- **New Dependency**: Integrated `chrono-node` for natural language date and time parsing in the frontend.

### Changed
- **Glassmorphism Design System**: Standardized the premium "glass-panel" aesthetic across all forms, inputs, and interactive components.
- **Theme-Aware Accessibility**: Overhauled dropdown and selection chip styling using theme-aware CSS variables to ensure high contrast and legibility in both light and dark modes (addressing the "white-on-white" issue).
- **UX Flow Optimization**: If both system and user-suggested restaurants are disabled, the voting flow now skips Step 3 and presents a "Ready to Go!" completion state.
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
