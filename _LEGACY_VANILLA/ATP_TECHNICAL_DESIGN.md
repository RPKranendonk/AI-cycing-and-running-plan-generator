# ATP & Season Planning: Technical Design Document

## 1. Overview

This document outlines the technical architecture for implementing the Annual Training Plan (ATP) feature. The goal is to evolve `Simple_AI_coach` from a continuous weekly generator to a structured, race-backward season planner.

## 2. Data Models (Schema)

We will introduce strictly typed definitions (in JSDoc/TS interfaces) for the new primitives.

### 2.1 ATP Store (`ATPState`)
A global singleton (part of `window.state` or a new `SeasonService`) holding the active season.

```javascript
/**
 * @typedef {Object} ATP
 * @property {string} id - UUID
 * @property {string} name - "2025 Road Selection"
 * @property {Date} startDate
 * @property {Date} endDate
 * @property {string} status - 'draft' | 'active' | 'archived'
 * @property {Event[]} events
 * @property {Phase[]} phases
 * @property {Object} constraints - { minTaperDays: 14, maxBuildWeeks: 12 }
 */
```

### 2.2 Events (`Event`)
Anchors for the schedule.

```javascript
/**
 * @typedef {Object} Event
 * @property {string} id
 * @property {string} name
 * @property {Date} date
 * @property {'A'|'B'|'C'} priority
 * @property {'road'|'tt'|'marathon'|'ultra'} type
 */
```

### 2.3 Phases (`Phase`)
The backbone of the schedule.

```javascript
/**
 * @typedef {Object} Phase
 * @property {string} id
 * @property {'base'|'build'|'peak'|'taper'|'recovery'|'race'} type
 * @property {Date} startDate
 * @property {Date} endDate - Inclusive
 * @property {Object} focus - { primary: 'volume', secondary: 'tempo' }
 * @property {boolean} isLocked - If true, Reflow Engine won't resize this phase automatically
 */
```

## 3. Architecture Components

### 3.1 Phase Layout Engine (`js/features/atp/services/layout-engine.js`)
**Responsibility**: Generates the initial `Phase[]` array from `Event[]` and `DateRange`.

**Algorithm Strategy (Reverse Waterfall)**:
1.  **Identify A-Races**: Sort by date.
2.  **Anchor Tapers**: Place `Taper` phase (2-3 weeks) immediately before each A-Race.
3.  **Anchor Recovery**: Place `Recovery` phase (1-2 weeks) immediately after each A-Race.
4.  **Fill Gaps**:
    -   High gap (> 12 weeks): `Base` -> `Build` -> `Peak`.
    -   Medium gap (6-12 weeks): `Build` -> `Peak`.
    -   Short gap (< 6 weeks): `Peak` / `Maintenance`.
5.  **Snap to Weeks**: All phase boundaries align to Monday-Sunday logic.

### 3.2 Reflow Engine (`js/features/atp/services/reflow-engine.js`)
**Responsibility**: The "Self-Healing" logic. Called when dates change or weeks are marked "Missed".

**Logic**:
-   **Invariant**: A-Race Taper is immutable in duration unless manually overridden.
-   **Elasticity**: `Base` and `Build` phases have high elasticity (can shrink/grow). `Peak` has low elasticity.
-   **Conflict Resolution**: If two A-Races are too close (< 8 weeks), flag warning and switch to "Maintenance/Race" block profile.

### 3.3 Integration with Deterministic Scheduler
The existing `SchedulingService` (which generates weekly templates) needs to be upgraded to consume `Phase` context.

**Current**: `generateWeeklyTemplate(userInputs, currentWeekIndex)`
**New**: `generateWeeklyTemplate(atpContext, weekDate)`

`atpContext` provides:
-   Current Phase (Base 1, Build 2, etc.)
-   Proximity to Race (for intensity tuning)
-    accumulated_fatigue (calculated from actuals)

## 4. Implementation Strategy

### Phase 1: Core Primitives (No UI)
1.  Create `js/features/atp/models.js` for schemas.
2.  Implement `LayoutEngine` with unit tests (pure logic).
    -   Test: "Given A-Race at Dec 1, backfill phases."
3.  Implement `ReflowEngine`.
    -   Test: "Move A-Race forward 2 weeks -> Base phase extends."

### Phase 2: UI Foundation
1.  **Season View**: A new visualization layer (`TimelineRenderer`).
    -   Needs horizontal scrolling canvas or CSS Grid.
2.  **Event Modal**: Add/Edit Event dialog.

### Phase 3: Integration
1.  Connect `ATPState` to `SchedulingService`.
2.  The "Generate Week" button now looks up the *current week's phase* in the ATP to decide the template (e.g., if ATP says "Taper Week 1", Scheduler generates Taper template).

## 5. Migration Plan
-   **Legacy Users**: Current settings (`Goal Date`, `Experience`) are converted into a single "Season 1" ATP with one A-Race at the Goal Date.
-   **Data Storage**: ATP is saved to `localStorage` (later DB) as a JSON blob.

## 6. Risks & Mitigations
-   **Risk**: Over-engineering the "Auto-Reflow".
    -   *Mitigation*: Start with "Warn and Ask" (e.g., "Race moved. Recalculate season?" [Yes/No]) rather than silent auto-updates.
-   **Risk**: Multi-sport complexity.
    -   *Mitigation*: ATP defines the *primary* focus. Multi-sport weeks are derived from the primary phase focus.

## 7. Future Proofing
-   **Drag & Drop Phases**: The data model matches a Gantt chart, making D&D easy to implement later.
-   **Actual vs Planned**: We can overlay `Intervals.icu` data on top of the Phase blocks to show compliance.
