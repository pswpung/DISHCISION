# TDD Coding Loop

When I ask you to build or change something, follow this loop in order.

## Phase 1: Plan — load `brainstorm` skill first
Load the **brainstorm** skill. Explore the codebase and produce a checklist with:
- What to build, files to touch, exact changes per file
- Trade-offs and rationale
- Edge cases and failure modes
- What existing tests cover (or don't) — check `backend/tests/` and `frontend/__tests__/` if they exist

## Phase 2: Review
Load Ponytail (full). Review Phase 1: ✅ Keep / 🔧 Simplify / ❌ Remove. Present final plan.

## Phase 3: TDD (Red → Green → Refactor)
For each task in the plan, work in three sub-phases:

### a. RED — Write a failing test first
- Write the smallest test that defines the expected behavior
- Run it — it must fail (proves the test can catch a missing implementation)
- If no test framework exists, use `assert`-based inline checks or a standalone script

### b. GREEN — Make it pass
- Write the minimal implementation to pass the test
- Run the test — it must pass
- Do not add code beyond what the test requires

### c. REFACTOR — Clean up, keep green
- Refactor while keeping all tests passing
- Run lint/typecheck after each chunk
- One task green + refactored → move to the next

## Phase 4: Final verification
- Run ALL tests one final time
- Run lint/typecheck
- Fix any failures before proceeding

## Phase 5: Document
Update CHANGELOG.md, save to agentmemory, run /graphify, update README.md if needed.
