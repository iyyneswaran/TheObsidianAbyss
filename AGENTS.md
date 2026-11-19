# Verification for future milestones

- Implement and run Vitest unit tests for new utilities and game logic. Add integration tests for interactions across Phaser, Colyseus, Fastify, and shared packages where the feature crosses those boundaries.
- Use Playwright against the actual browser application for routes, controls, and game interactions. Capture screenshots for the user's visual review. The coding agent owns functional verification and does not delegate manual testing to the user.
- Add deterministic gameplay simulations for movement, collisions, combat, AI, and multiplayer as each mechanic is introduced. Keep previous milestone tests passing.
- Run formatting checks, typecheck, lint, production build, and the full automated suite. Fix failures and rerun the affected checks and full suite before committing a completed milestone.
- Report actual pass and fail counts, coverage when measured, and anything that remains unverified. Commit a completed milestone only after its mandatory checks pass.
- Create `docs/milestone-N.md` for each completed milestone. Record what shipped, actual automated test results, screenshots or other evidence, unresolved issues, and Git details.
