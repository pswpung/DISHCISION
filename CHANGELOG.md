# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-05-07

### Added
- Implemented static scoring algorithms for Time Slot and Restaurant suggestions, fully documented in `backend/SCORING.md`.
  - **Time Slot Suggestion (`get_suggested_slots`)**: Calculates scores based on Availability (50%), Meal Preference (30%), and Time Quality (20%).
  - **Restaurant Suggestion (`get_suggesested_restaurants`)**: Uses a Weighted Voting System that prioritizes Key Persons (70%) over General Attendees (30%), evaluating attributes like Price, Category, Vibe, Distance, and more.
