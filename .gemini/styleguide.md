# Styleguide for AI Coach (Gemini 3)

> When using Gemini 3, **prioritize speed and broad context retrieval**. Use this guide to understand the project quickly and make confident changes.

---

## Tech Stack

- **Frontend**: Vanilla HTML5 + CSS3 (No React/Vue/Angular)
- **Styling**: TailwindCSS (CDN), custom CSS in `css/style.css` and `css/mobile.css`
- **Language**: JavaScript (ES6+). TypeScript config exists but is not actively used.
- **State**: Global `window.state` object (no Redux/Vuex)
- **PWA**: `service-worker.js`, `manifest.json` for installable app
- **External APIs**: Intervals.icu API (REST)
- **AI Providers**: Gemini, DeepSeek, OpenRouter, Mistral (configurable in `ai-service.js`)
- **Fonts**: Inter (UI), JetBrains Mono (monospace)
- **Icons**: Font Awesome 6

---

## Coding Standards

- **Linting**: No formal linter configured (Prettier preferred if added).
- **Naming**:
  - Functions: `camelCase` (e.g., `generateTrainingPlan()`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `WORKOUT_TYPES`)
  - DOM IDs: Kebab-case (e.g., `#wizard-content`, `#ai-loading-overlay`)
- **Comments**:
  - Use `// [FIX]` or `// [NEW]` to annotate recent changes.
  - Use `@param` and `@returns` JSDoc for public functions.
- **Global Exposure**: Core functions are attached to `window` for cross-file access (e.g., `window.generateTrainingPlan = generateTrainingPlan;`).
- **File Structure**:
  - `js/` - Root-level services (`main.js`, `ui.js`, `ai-service.js`)
  - `js/core/` - Scheduling algorithms (Rule-based logic)
  - `js/ui/` - UI components (Modals, Wizards)
  - `js/sports/` - Sport-specific adapters (RunningAdapter, CyclingAdapter)
- **Avoid**:
  - Arrow functions for top-level named functions (use `function`).
  - Inline styles; prefer Tailwind or CSS classes.

---

## Danger Zone (Do Not Refactor Lightly)

These files are load-bearing and highly coupled. Any changes require careful testing:

| File | Lines | Role |
| :--- | :--- | :--- |
| `js/intervals-service.js` | 1622 | Intervals.icu API wrapper (push, delete, fetch) |
| `js/ai-service.js` | 1126 | AI prompt generation & multi-provider API calls |
| `js/core/smart-scheduler.js` | 1122 | Rule-based weekly scheduling algorithm |
| `js/core/deterministic-scheduler.js` | 369 | Phase-based workout rotation (Hill Sprints, Strides) |
| `js/main.js` | 481 | App initialization, plan generation orchestration |
| `js/weekly-ui.js` | ~2000 | Week card rendering, drag/drop, push buttons |

---

## Key Architectural Patterns

1. **Rule-Based First**: The `smart-scheduler.js` and `deterministic-scheduler.js` generate training plans deterministically. AI is an *optional overlay*.
2. **Steps Array**: Structured workouts use a `steps` array (Warmup, Intervals, Cooldown) compatible with `formatStepsForIntervals()`.
3. **Wizard -> State Sync**: The `quick-setup-wizard.js` syncs its values to `window.state` before closing.
4. **Pro Mode Toggle**: Advanced fields are hidden behind `.pro-only` class, controlled by `settings-manager.js`.
