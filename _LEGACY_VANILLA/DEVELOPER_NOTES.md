# Developer Notes & Architecture Guide

> **Created**: 2025-12-24
> **Purpose**: Document critical data flows, architectural decisions, and "gotchas" for future developers maintaining the Simple AI Coach.

---

## 1. Core Architecture Pattern

The application follows a **Unidirectional Data Flow** for generating training plans:

1.  **Input Collection (UI)**: `index.html` + `configurator-ui.js` collect user inputs (Current volume, Gym access, etc.).
2.  **Orchestration (Main)**: `main.js` receives inputs and calls the scheduling engine.
3.  **Scheduling (Logic)**: `deterministic-scheduler.js` places "blocks" (workouts) into a weekly grid based on rules (availability, phase). *Critically, this layer deals with Abstract Templates (IDs), not full text.*
4.  **Hydration (Adapter)**: `TemplateConverter.js` takes the abstract template and "hydrates" it with full descriptions, steps, and dates from `workout-library-structured.js`.
5.  **Rendering (View)**: `weekly-ui.js` renders the hydrated data to the DOM.

---

## 2. Key Flows

### A. Strength Training Generation (The "Gym Persistence" Flow)

This flow determines if and when strength sessions appear.

1.  **User Input**: `gymAccessInput` ('none' | 'basic' | 'full') in `index.html`.
2.  **Normalization (`main.js`)**:
    *   `main.js` converts this string into a numeric `gymTarget`.
    *   **Rule**: `('basic' || 'full') -> gymTarget = 2`. `('none') -> gymTarget = 0`.
    *   *Gotcha*: Historically, this logic failed for 'basic'/'full' and defaulted to 0. Always check the normalization map in `generateDeterministicWorkouts`.
3.  **Placement (`deterministic-scheduler.js`)**:
    *   The scheduler attempts to place 2 sessions if `gymTarget >= 2`.
    *   **Strategy 1 (Neural Power)**: Stacks on a **KEY Day** (Intervals/Tempo) to keep hard days hard.
    *   **Strategy 2 (Stability)**: Places on an **Empty/Easy Day** to avoid interference.
    *   **Output**: The scheduler outputs a slot with `secondary: { id: 'gym_neural', ... }` or `workout: { id: 'gym_stability', ... }`.
4.  **Hydration (`TemplateConverter.js`)**:
    *   The converter iterates through the week.
    *   It detects `WeightTraining` type or specific IDs (`gym_neural`, `gym_stability`).
    *   **Crucial Step**: It pulls the *detailed description* (steps, warmups) from the `workout-library-structured.js` (or passes through the object from scheduler) and assigns it to the final workout object.
    *   *Gotcha*: Ensure the converter **whitelist** includes all new strength IDs, otherwise they are filtered out.

### B. Workout Description Propagation

How specific text reaches the user:

*   **Source**: `js/core/workout-library-structured.js` contains the "Master Text" (e.g., "Warm-up: 1x6 @ 50%...").
*   **Transport**: The Scheduler *references* these objects by ID but doesn't deep-copy the huge strings for every calculation.
*   **Assembly**: `TemplateConverter.js` merges the library definition with the schedule slot.
    *   *Gotcha*: The converter has a fallback generator `WorkoutBuilder.buildStrengthDescription`. We modified the converter to **prefer logic**: `customDescription || genericDescription`. If descriptions disappear, check if this priority was reversed.

---

## 3. Critical Files & Responsibilities

| File | Role | Key Tags |
|------|------|----------|
| `js/core/deterministic-scheduler.js` | **Brain**. Decides *when* things happen. | `@responsibilities` : Places Big Rocks first. |
| `js/features/weekly-plan/services/TemplateConverter.js` | **Translator**. Converts "Tue: Intervals" -> "Tue: 5x1km @ 3:45". | `@responsibilities` : Hydration, Formatting for API. |
| `js/core/workout-library-structured.js` | **Dictionary**. Defines *what* things are. | `@responsibilities` : Stores static text & structures. |
| `js/main.js` | **Conductor**. Wires UI to Logic. | `@responsibilities` : State management, Init. |

---

## 4. Common Pitfalls & "Gotchas"

1.  **Scheduler Input Naming**:
    *   The scheduler function signature is `buildWeekSchedule(index, weekData, ...)` but inside the function, the inputs are often destructured.
    *   *Error Trace*: `ReferenceError: schedulerInput is not defined`.
    *   *Fix*: Ensure you are accessing properties off `weekData` (e.g., `weekData.gymTarget`), not the global input object from `main.js`.

2.  **ID Whitelisting**:
    *   If you add a new workout ID (e.g., `gym_mobility`), you **MUST** add it to the whitelist filter in `TemplateConverter.js`. If you don't, the scheduler will place it, but the converter will silently drop it.

3.  **Strength Descriptions**:
    *   Do not hardcode strength descriptions in `TemplateConverter.js`. Put them in `workout-library-structured.js`. This follows the "Single Source of Truth" principle.
