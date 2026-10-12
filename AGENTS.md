<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TimeTracker

## Product Goal
- Build a modular personal productivity app for a solo user or student.
- The product should be calendar-first and focused on time blocking, task execution, planned vs actual time, and analytics.
- It should feel clean, modern, useful as a real personal tool, and credible as a portfolio project.

## Stack
- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- `react-hook-form` + `zod` for forms and validation
- `date-fns`, `lucide-react`, and `recharts` for time handling, icons, and analytics UI
- Start with local mock data and mock integration services unless the user explicitly requests real backend or external API work

## UI Rules
- Do not turn this into a bloated workspace clone.
- Favor a calendar-first UX with strong hierarchy, fast scanability, and clear planned vs actual time cues.
- Keep the visual system clean, modern, and consistent across dashboard, calendar, tasks, analytics, and settings.
- Reuse shared components and consistent category colors instead of page-specific styling drift.
- Desktop should feel primary, but all core views must still work on mobile widths.

## Architecture Rules
- Read the relevant local Next.js docs in `node_modules/next/dist/docs/` before changing framework patterns.
- Keep domain types centralized under `lib/domain`.
- Keep mock data, selectors, and integration adapters out of route files when possible.
- Prefer modular components and thin pages; avoid large pages that mix UI, data shaping, and business rules.
- Prefer Server Components for static/data assembly and Client Components only where interactivity is required.
- Design Phase 1 so mock services can later be replaced by real integrations without rewriting the UI surface.

## Scope Limits
- Phase 1 includes: app shell, dashboard, calendar, tasks with kanban + list views, analytics, settings/integrations, task and time-block creation flows, categories/tags, planned vs actual time, in-app timer, and mock data/services.
- Do not build in Phase 1: team collaboration, billing, chat/comments, AI scheduling, native mobile apps, full auth, heavy backend business logic, live external integrations, or full browser-extension implementation.

## Integration Philosophy
- Use interface-driven adapters for Google Calendar and future providers.
- Keep provider-specific logic behind `lib/integrations`.
- Mock first; no live OAuth or real sync unless explicitly requested.
- The UI may expose connection state, sync state, and future capabilities, but Phase 1 should not depend on networked integrations.

## Validation Steps
- After changes, run targeted validation when allowed: `npm run lint`.
- Run `npm run build` when changes affect routing, types, or shared architecture and the extra check is practical.
- Manually verify key flows after UI work: navigation, task creation, time-block creation, timer start/stop, analytics rendering, and settings/integration states.
- If validation is skipped or blocked, state that clearly in the handoff.
