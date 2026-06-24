---
name: full-project-audit
description: "Thoroughly analyze an unfamiliar or returning-to codebase: read project config, scan all source directories, identify issues, then fix them one by one."
---

# Full Project Audit

A systematic workflow for getting complete context on a codebase and fixing all identified issues sequentially. Used when the user says "analyze entire project", "analyze all code", "fix all issues", or similar broad directives.

## When to use

- User says "analyze entire project" or "analyze all code"
- Returning to a project after a long gap
- First session on a new or unfamiliar codebase
- User says "fix all issues" or "fix everything"

## Workflow

### Phase 1: Read project context (ordered)

Read these files first — they contain the roadmap, conventions, and constraints:

1. `AGENTS.md` — project overview, conventions, architecture decisions
2. `package.json` — dependencies, scripts, project metadata
3. `tsconfig.json` (or equivalent config) — language/build configuration
4. `next.config.ts` / `next.config.mjs` — framework-specific config (if Next.js)
5. `.env.local.example` or `.env.example` — required environment variables
6. `sql/schema.sql` (if database project) — database schema

### Phase 2: Scan source structure

Use `glob` to discover the full file tree, then read key entry points:

1. `src/app/` or `app/` — all pages, layouts, API routes (App Router pattern)
2. `src/components/` or `components/` — all UI components
3. `src/lib/` or `lib/` — all utility/service files
4. `src/middleware.ts` or `middleware.ts` — request middleware
5. Any `*.test.*` files — existing test coverage

Read each directory listing first, then read files in order of importance:
- Routes/API handlers → Components → Library/utility files → Config files

### Phase 3: Identify issues

As you read, categorize findings:

- **Security**: exposed secrets, missing auth, unsafe patterns
- **Dead code**: unused imports, unreferenced files, dead functions
- **Errors**: missing error handling, unhandled edge cases, type errors
- **Missing pieces**: missing error boundaries, loading states, env vars
- **Code quality**: duplicated logic, inconsistent patterns
- **Bugs**: broken functionality, incorrect data flow

### Phase 4: Fix one by one

**Critical rule: complete each fix before starting the next.**

For each fix:
1. State what you're fixing and why
2. Make the change
3. Verify the change works (run relevant checks)
4. Move to the next fix

Order fixes by priority: security → bugs → missing pieces → dead code → code quality.

### Phase 5: Verification

After all fixes, run the project's verification chain:

1. `npx tsc --noEmit` — type check (if TypeScript)
2. `npm run lint` — lint check
3. `npm run build` — production build
4. `npm run test` — unit tests (if test suite exists)

Fix any issues found, then re-run until clean.

## Output

Provide a structured summary:
- **Project overview**: what it does, tech stack, architecture
- **Issues found**: categorized list
- **Fixes applied**: what was changed and why
- **Remaining items**: anything that needs user input or is deferred
