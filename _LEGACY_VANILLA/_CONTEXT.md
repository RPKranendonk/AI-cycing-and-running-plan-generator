# _CONTEXT.md — AI Coach Product Goals & Roadmap

> **For Technical Architecture, File Maps, and Dependency Graphs, see [ARCHITECTURE.md](ARCHITECTURE.md).**

> **For Claude Opus 4.5**: Prioritize safety, correctness, and step-by-step reasoning over speed.

---

## Section 1: The Mission

**AI Coach** is a web-based training plan generator for endurance athletes (runners and cyclists). It connects to [Intervals.icu](https://intervals.icu) to pull athlete data (CTL, zones, history) and push structured workouts back to their calendar. The core philosophy is **"Rule-Based First, AI-Enhanced"**: the app generates deterministic, progressively overloaded training weeks using code-defined algorithms (modularized scheduling engine in `js/features/scheduling/`), then *optionally* uses a Large Language Model (Gemini, Mistral, etc.) to add variety or coaching flavor. The goal is to give athletes a reliable plan without requiring a human coach, while still allowing AI creativity where it adds value.


---

## Section 2: The "80% State"

### Completed Features (✅)
- **Onboarding Wizard**: Collects Sport, Experience, Volume, Availability, and Goal Date.
- **Rule-Based Scheduler**: Generates weekly templates (Long Run, Intervals, Tempo, Easy Runs, Strength) based on availability and training phase.
- **Structured Intervals**: Hill Sprints, Strides, Fartleks have precise `steps` arrays with durations and zones.
- **Intervals.icu Integration**: Push workouts, push weekly targets (volume/long run), delete workouts.
- **Pro Mode Toggle**: Hides CTL/TSS/Ramp Rate for beginners.
- **Human-Centric Terminology**: "Progression Pace" instead of "Ramp Rate".
- **Derivation Logic**: CTL/TSS is calculated from Weekly Volume + Experience.
- **Taper Logic**: Basic 2-week taper with volume reduction.

### Pending / Incomplete (🚧)
Based on TODOs found in code:
1. **`weekly-ui.js:1760`**: AI-driven workout modification suggestions (not implemented).
2. **`suggestions-ui.js:149`**: Applying suggested plan changes to actual plan.
3. **`adjustment-suggestions.js:236`**: Implementing actual plan modification based on action type.
4. **TypeScript Migration**: `ts/` folder exists with 2 files, but project is still Vanilla JS.
5. **Tests**: `verify-build.js` exists but is minimal; no unit/integration tests.

---

## REGIONAL & FORMAT STANDARDS

| Category | Standard | Notes |
|----------|----------|-------|
| **Volume** | Always Metric (km) | Never use Imperial (miles) |
| **Time Format** | 24h or descriptive | Use "14:00" or "Morning"/"Evening". **NEVER use AM/PM** |
| **Pace** | min/km | Display as MM:SS/km (e.g., "5:30/km") |
| **Duration** | Hours & Minutes | Use "1h 30m" or "90 min" format |

### Volume vs Load (Critical Rule)

| Sport | Target Metric | Rule |
|-------|--------------|------|
| **Running** | Volume (km) | **Total workout distance (WU + Main + CD) must equal target km** |
| **Cycling** | Load (TSS) | Target is weekly TSS, distributed by workout type |

> [!IMPORTANT]
> For Running: If scheduler targets 19km, the full workout (including warmup and cooldown) must total 19km.
> The main set distance is calculated by subtracting WU+CD distance from target.

---

## DEVELOPMENT ROADMAP (EPICS)

### Epic 1: Annual Training Plan (ATP) & Season Planning

**Goal:** Enable an athlete or coach to design, adjust, and execute a full season plan that survives reality (shifting races, illness, travel).

**Product Intent:** A deterministic planning system with optional assistive automation. The ATP is a first-class object, not just workouts on a calendar.

#### Core Concepts

1.  **Annual Training Plan (ATP)**: Top-level container for a season.
    -   *Attributes*: Season name, Start/End dates, Sports, Athlete snapshot, Constraints.
    -   *Status*: Draft, Active, Archived.
2.  **Events**: Structured season anchors.
    -   *Priority*: A (taper+peak), B (partial taper), C (training race).
    -   *Attributes*: Type, Weight, Sport discipline.
3.  **Phases (Macrocycles)**: High-level blocks (Base, Build, Peak, Taper, Recovery, Transition).
    -   *Rules*: Non-overlapping, snap to weeks. Taper must precede A-events.
4.  **Mesocycles**: Sub-blocks (3-6 weeks) with specific progression logic (linear, wave) and recovery week placement.
5.  **Microcycles (Weeks)**: Operational units with planned duration/load and key sessions.

#### Functional Overview

-   **Season Creation**: Manual, Template-based, or Rule-based auto-generation.
-   **Phase Layout Engine**: Backward planning from A-events. Handles minimum taper and max build durations.
-   **Reflow Engine**: **(Critical)** preserving intent when reality changes (dates move, injury, holidays).
    -   *Behavior*: Taper remains taper. Volume compresses/expands within safe bounds.

#### User Stories

-   **Athlete**: "I want to move my race by two weeks so my plan updates without me rebuilding everything."
-   **Coach**: "I want to clone an ATP template so I can apply my philosophy across multiple athletes."
-   **Power User**: "I want to simulate 'what if I add another A-race' to see consequences."

#### UX Requirements

-   **Timeline View**: Yearly horizontal scroll, color-coded phases, zoom levels.
-   **Phase Editor**: Drag edges, change types, edit rules.
-   **Week Inspection**: Planned vs Actual, readiness flags.

#### Automation & Safety

-   **Defaults**: Base = volume; Build = intensity; Taper = recovery + intensity maintenance.
-   **Safety Rails**: Max ramp rates, mandatory recovery after A-events.
-   **Manual Override**: Every automated decision must be editable.

> **Note**: This is not just "calendar plus colors". It is stateful planning logic.
For detailed technical implementation strategy, see [ATH_TECHNICAL_DESIGN.md](ATP_TECHNICAL_DESIGN.md).

---

### Epic 2: Multi-Sport Infrastructure

**Goal:** Transition from "Runner-only" to full Triathlete support (Run + Cycle + Swim).

**Current State:** App supports Running and Cycling independently. No combined brick sessions.

| Component | Technical Consideration |
|-----------|------------------------|
| **Schema** | Add `sport_type` enum: `'run' | 'cycle' | 'swim' | 'strength' | 'brick'` |
| **Workouts** | Each workout needs `sport_type` field, not inferred from plan type |
| **Zones** | Separate zone models per sport (running pace vs cycling power vs swim CSS) |
| **Bricks** | Compound workout type with `segments[]` array |

---

### Epic 3: Real-time Notifications

**Goal:** Notify users upon workout completion (via Intervals.icu activity sync).

**Architectural Question:** Push vs Pull?

| Approach | Pros | Cons |
|----------|------|------|
| **Webhooks** | Real-time, efficient | Requires public endpoint, webhook registration |
| **Polling** | Simple, no infra | Delayed, wasteful API calls |
| **Bi-directional Sync** | Full real-time | Complex, requires WebSocket/SSE server |

**Recommendation:** Start with Intervals.icu webhooks if supported, else poll every 15 min with background worker.

---

### Epic 4: Coaching Interface (Multi-Tenancy)

**Goal:** Allow one Coach user to manage multiple Athlete users.

**Requirement:** Permission/relationship modeling with role-based access.

| Component | Implementation |
|-----------|----------------|
| **User Roles** | `athlete` (default), `coach`, `admin` |
| **Relationships** | `coach_athletes` junction table: `{coach_id, athlete_id, permissions}` |
| **Permissions** | `view_plan`, `edit_plan`, `push_workouts`, `view_activities` |
| **UI** | Coach dashboard with athlete switcher dropdown |
| **Auth Scope** | Coach tokens must include athlete context for API calls |

---

### Epic 5: Monetization (Stripe Elements)

**Goal:** Accept One-time Donations AND Monthly AND Yearly Subscriptions via single embedded UI.

**Tech Stack:** Stripe Payment Element (React) + Node.js Backend

**Architecture Pattern:** Dynamic Intent Creation

```
┌─────────────────────────────────────────────────────────┐
│  User selects "One-Time" or "Monthly/Yearly" in UI      │
│                         ↓                               │
│  Frontend calls POST /api/create-payment-intent         │
│                         ↓                               │
│  Backend creates PaymentIntent (one-time)               │
│     OR Subscription (recurring)                         │
│                         ↓                               │
│  Backend returns client_secret                          │
│                         ↓                               │
│  Frontend passes secret to <PaymentElement />           │
│  (Stripe handles both payment types automatically)      │
└─────────────────────────────────────────────────────────┘
```

**Required Environment Variables:**

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `STRIPE_PUBLISHABLE_KEY` | Public (Frontend) | Initialize Stripe.js |
| `STRIPE_SECRET_KEY` | Private (Backend) | Create intents/subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Private (Backend) | Verify `checkout.session.completed`, `invoice.paid` events |

**Webhook Events to Handle:**
- `checkout.session.completed` → Activate subscription
- `invoice.paid` → Renew subscription
- `customer.subscription.deleted` → Revoke access

---

## ADDITIONAL DOCUMENTATION NEEDED

| Document | Purpose | Priority |
|----------|---------|----------|
| `API.md` | Intervals.icu API endpoints used, auth flow, rate limits | 🟠 High |
| `CONTRIBUTING.md` | Dev setup, coding standards, PR process | 🟡 Medium |
| `TESTING.md` | How to test, what to verify, manual test cases | 🟡 Medium |
| `CHANGELOG.md` | Version history, breaking changes | 🟢 Low |
| `.env.example` | Required environment variables template | 🟠 High |

## QA & Testing Protocol

### Mandatory Scheduler Stress Test
**Trigger:** Every change to core scheduler logic (template generation, frequency optimization, or readiness engine).
**Action:** Run `stress_test_scheduler.js` in the background.
**Reporting:** Only report failures. If all pass, output: "✅ ALL SCENARIOS PASSED".

### Test Scenarios (Personas)
1. **The Rookie**: <35km, Safety Focus. Check: Max 4 running days.
2. **The Weekend Warrior**: Time-crunched Mon-Fri (45m max). Check: Effective use of limited slots vs. Weekend loading.
3. **The Regular**: 55km, 5 days. Standard Baseline.
4. **The Builder**: 85km, 6 days. Check: Min 5 running days.
5. **The Fatigue Case**: Readiness Strained. Check: Volume reduced by ~30-40% vs Baseline.

### Validation Rules (Scientific Gates)
1. **Frequency Integrity**: Rookie <= 4 days, Builder >= 5 days.
2. **Duration Safety**:
    - Easy Runs <= 70m (or 15% volume).
    - Long Run <= 35% volume (unless <30km total) AND <= 3h.
3. **Min Effective Dose**: No run < 30m (except shakeouts).
4. **Intensity Distribution**: Easy Pace 75-88% LT. Recovery < 80% LT.
5. **Readiness**: Fatigue case must show significant reduction.
