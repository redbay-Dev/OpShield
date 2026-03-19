End-of-session checks, documentation updates, handover report, and git commit/push.

## Steps

### 1. Run All Checks
Run these and report results (continue even if some fail):
- `pnpm lint` (if configured)
- `pnpm type-check` (if configured)
- `pnpm test` (if configured)
- `pnpm build` (if configured)

If scripts aren't configured yet, skip gracefully and note it.

### 2. Update ALL Relevant Documentation
This step is MANDATORY before committing. Review every change made during the session and update:

- **`CHANGELOG.md`**: Add an entry for this session covering:
  - Date
  - What was built, fixed, or changed
  - Any decisions made (reference DEC-XXX IDs)
  - Known issues or bugs discovered
  - What should be done next (specific and actionable — the next agent reads this to know where to start)
  - What's STILL MISSING from the spec (be honest — list unfinished work)

- **`docs/DECISION-LOG.md`**: If any architectural, product, or technical decisions were made, add them with the standard format (DEC-XXX, date, context, decision, rationale, alternatives considered).

- **Any docs that are now stale**: Check if changes made during the session affect any of the following, and update them if so:
  - `docs/00-PROJECT-OVERVIEW.md` (stack changes, new dependencies, infrastructure)
  - `CLAUDE.md` (if project structure, commands, or conventions changed)
  - Any feature docs if implementation revealed spec inaccuracies

- **Cross-reference check**: Ensure no documentation references outdated names, paths, commands, or configurations that were changed during the session.

### 3. Git Commit and Push
- Stage all relevant files (prefer explicit file names over `git add -A`)
- Review staged changes and create a descriptive conventional commit message summarising the session's work
- Default to `fix:` for 95% of commits, `feat:` only for genuinely new features
- Scopes: frontend, backend, shared, db, infra, docs
- `git push origin` to push to GitHub

### 4. Session Summary
Print a clear summary for the user:
- What was accomplished
- Check results (pass/fail for each)
- Documentation that was updated
- What the next agent should pick up (be specific — reference doc numbers and feature areas)
- Link to the commit on GitHub
