const WORKOUT_LIBRARY = `
### CYCLING WORKOUTS LIBRARY ###

ID: CYC_01
Name: The "Neuro" Long Ride (Gravel Specific)
Sport: Cycling
Focus: Base volume + Neuromuscular recruitment (no fatigue)
Progression Rule: Increase total duration by 30 mins per week (add extra main loop reps). Keep sprint count static (1 every 20m).

Warmup
- 20m 60-70%

Main Loop 8x
- 19m 60-70%
- 15s 40% (Slow Down)
- 6s 300% (MAX Sprint)

Cooldown
- 10m 50%

---

ID: CYC_02
Name: Steady State Zone 2
Sport: Cycling
Focus: Pure aerobic efficiency
Progression Rule: Increase main set duration by 15-30 mins per week.

Warmup
- 10m 50-65%

Main Set
- 90m 65-72%

Cooldown
- 10m 50%

---

ID: CYC_03
Name: Cadence Drills (Spin-Ups)
Sport: Cycling
Focus: Efficiency and coordination
Progression Rule: Increase the duration of the "High RPM" segments by 30s each week.

Warmup
- 15m 50-70%

Drills 4x
- 1m 110-120rpm 75%
- 4m 85-90rpm 65%

Cooldown
- 10m 50%

---

ID: CYC_04
Name: SST (Sweet Spot) Long Intervals
Sport: Cycling
Focus: Raising CTL without high fatigue
Progression Rule: Increase interval duration. Wk1: 3x10m, Wk2: 3x12m, Wk3: 3x15m.

Warmup
- 15m 50-75%

Main Set 3x
- 10m 88-94%
- 5m 50-55%

Cooldown
- 10m 50%

---

ID: CYC_05
Name: Tempo with Bursts (Group Ride Sim)
Sport: Cycling
Focus: Clearing lactate while under tension
Progression Rule: Add 1 extra repetition to the main set each week (e.g., 3x -> 4x -> 5x).

Warmup
- 15m 50-70%

Main Set 3x
- 8m 80-85%
- 30s 120%
- 4m 55%

Cooldown
- 10m 50%

---

ID: CYC_06
Name: Low Cadence "Torque" Climbs
Sport: Cycling
Focus: Strength endurance (Gym on the bike)
Progression Rule: Increase time at low cadence. Wk1: 4x6m, Wk2: 4x8m, Wk3: 3x12m.

Warmup
- 15m 50-75%

Main Set 4x
- 6m 80-85% cadence=60
- 4m 55% cadence=90

Cooldown
- 10m 50%

---

ID: CYC_07
Name: Standard Threshold (2x20)
Sport: Cycling
Focus: TTE (Time to Exhaustion) at FTP
Progression Rule: Decrease rest or extend time. Wk1: 2x15m, Wk2: 2x20m, Wk3: 3x15m.

Warmup
- 20m 50-75%

Main Set 2x
- 15m 96-100%
- 5m 50%

Cooldown
- 15m 50%

---

ID: CYC_08
Name: Over/Unders (Lactate Clearance)
Sport: Cycling
Focus: Dealing with surges and recovering at threshold
Progression Rule: Add 1 set each week. Wk1: 2 sets, Wk2: 3 sets, Wk3: 4 sets.

Warmup
- 15m 50-75%

Main Set 2x
- 2m 95%
- 1m 110%
- 2m 95%
- 1m 110%
- 2m 95%
- 5m 50%

Cooldown
- 10m 50%

---

ID: CYC_09
Name: Hard Start Threshold
Sport: Cycling
Focus: Simulating race starts (oxygen debt)
Progression Rule: Increase the duration of the "Settling" phase (95%).

Warmup
- 20m 50-75%

Main Set 3x
- 2m 120%
- 8m 95%
- 5m 50%

Cooldown
- 10m 50%

---

ID: CYC_10
Name: Classic VO2 Max (4x4)
Sport: Cycling
Focus: Raising the aerobic ceiling
Progression Rule: Increase number of intervals. Wk1: 4x4m, Wk2: 5x4m, Wk3: 6x4m.

Warmup
- 20m 50-75%

Main Set 4x
- 4m 110-120%
- 4m 50%

Cooldown
- 15m 50%

---

ID: CYC_11
Name: Ronnestad (30/15s)
Sport: Cycling
Focus: High HR with micro-recovery
Progression Rule: Increase number of sets. Wk1: 2 sets, Wk2: 3 sets, Wk3: 3 sets (but increase loop count to 15x).

Warmup
- 15m 50-75%

Main Set 2x
  Loop 13x
  - 30s 120%
  - 15s 50%
- 5m 50%

Cooldown
- 10m 50%

---

ID: CYC_12
Name: Tabata (Micro Bursts)
Sport: Cycling
Focus: Anaerobic capacity
Progression Rule: Increase reps per set. Wk1: 8 reps, Wk2: 10 reps, Wk3: 12 reps.

Warmup
- 20m 50-75%

Main Set 3x
  Loop 8x
  - 20s 150%
  - 10s 0%
- 8m 50%

Cooldown
- 10m 50%


### RUNNING WORKOUTS LIBRARY ###

ID: RUN_01
Name: Easy Aerobic Run
Sport: Running
Focus: Accumulate time on feet
Progression Rule: Increase duration by 5-10 mins per week.

Warmup
- 10m 65-75% Pace

Main Set
- 30m 70-80% Pace

Cooldown
- 5m 60-70% Pace

---

ID: RUN_02
Name: The Long Run
Sport: Running
Focus: Structural durability
Progression Rule: Increase duration by 10% per week.

Warmup
- 10m 60-70% Pace

Main Set
- 60m 70-75% Pace

Cooldown
- 5m Walk

---


ID: RUN_03
Name: Recovery Shakeout
Sport: Running
Focus: Blood flow, no stress
Progression Rule: None. Keep flat at 30 mins to ensure recovery.

Main Set
- 30m 60-70% Pace

---

ID: RUN_04
Name: Cruise Intervals (Threshold)
Sport: Running
Focus: Lactate Threshold (Run FTP)
Progression Rule: Increase reps. Wk1: 3x8m, Wk2: 4x8m, Wk3: 5x8m.

Warmup
- 15m 60-70% Pace

Main Set 3x
- 8m 95-100% Pace
- 3m 60-70% Pace

Cooldown
- 10m 60-70% Pace

---

ID: RUN_05
Name: Continuous Tempo
Sport: Running
Focus: Mental toughness and stamina
Progression Rule: Increase duration. Wk1: 20m, Wk2: 25m, Wk3: 30m.

Warmup
- 15m 60-70% Pace

Main Set
- 20m 85-90% Pace

Cooldown
- 10m 60-70% Pace

---

ID: RUN_06
Name: Progressive Run
Sport: Running
Focus: Negative splitting (finishing fast)
Progression Rule: Increase the duration of the final "Hard" block.

Warmup
- 10m 60-70% Pace

Main Set
- 15m 75% Pace
- 15m 85% Pace
- 10m 95% Pace

Cooldown
- 5m 60% Pace

---

ID: RUN_07
Name: Hill Sprints (Power)
Sport: Running
Focus: Glute activation and power (low impact)
Progression Rule: Increase reps. Wk1: 6x, Wk2: 8x, Wk3: 10x.

Warmup
- 10m 60-70% Pace
- 10m 65-75% Pace

Main Set 6x
- 20s 110% Pace (Hill)
- 130s 45-60% Pace (Walk)

Cooldown
- 10m 60-70% Pace

---

ID: RUN_08
Name: Strides (Neuromuscular)
Sport: Running
Focus: Form and turnover (not metabolic)
Progression Rule: Constant. Done after an easy run.

Warmup
- 30m 70-75% Pace

Main Set 6x
- 20s 100-110% Pace
- 40s 50-65% Pace

Cooldown
- 10m 60-70% Pace

---

ID: RUN_09
Name: Fartlek (Speed Play)
Sport: Running
Focus: Changing gears naturally
Progression Rule: Increase total volume. Wk1: 30m total, Wk2: 35m total, Wk3: 40m total.

Warmup
- 15m 60-70% Pace

Main Set 10x
- 1m 90-100% Pace
- 1m 60-70% Pace

Cooldown
- 10m 60-70% Pace

---

ID: RUN_10
Name: 1km Repeats
Sport: Running
Focus: High-end aerobic capacity
Progression Rule: Increase reps. Wk1: 3x1k, Wk2: 4x1k, Wk3: 5x1k.

Warmup
- 15m 60-70% Pace

Main Set 3x
- 1000m 102-105% Pace
- 3m 60% Pace

Cooldown
- 10m 60-70% Pace

---

ID: RUN_11
Name: 400m Track Repeats
Sport: Running
Focus: Speed economy and turnover
Progression Rule: Increase reps. Wk1: 8x400, Wk2: 10x400, Wk3: 12x400.

Warmup
- 15m 60-70% Pace

Main Set 8x
- 400m 105-110% Pace
- 90s Walk/Jog

Cooldown
- 10m 60-70% Pace

---

ID: RUN_12
Name: The "Pyramid"
Sport: Running
Focus: Mixed pacing
Progression Rule: Increase the peak duration. Wk1: Peak at 3m, Wk2: Peak at 4m, Wk3: Peak at 5m.

Warmup
- 15m 60-70% Pace

2 x Main Set
- 1m 105% Pace, 1m Recov
- 2m 100% Pace, 1m Recov
- 3m 98% Pace, 2m Recov
- 2m 100% Pace, 1m Recov
- 1m 105% Pace, 1m Recov

Cooldown
- 10m 60-70% Pace


### AI DEVELOPER NOTES ###

1. Phase Identification:
   - Week 1: Introduction
   - Week 2: Progression
   - Week 3: Peak/Overreach
   - Week 4: Recovery

2. Progression Logic:
   - When scheduling a workout for Week 1, use the "Wk1" rule (e.g., 3x8m intervals).
   - When scheduling for Week 2, use the "Wk2" rule (e.g., 4x8m intervals or 3x10m intervals).
   - When scheduling for Week 3, use the "Wk3" rule (e.g., 5x8m or 3x12m intervals).

3. Recovery Week Logic:
   - During Recovery Weeks (Week 4, 8, etc.), DO NOT use High Intensity Interval Training (HIIT).
   - Cycling: Only assign CYC_02 (Steady Z2) or CYC_03 (Cadence) and reduce duration by 40-50%.
   - Running: Only assign RUN_03 (Recovery Shakeout).

4. Intervals.icu Syntax:
   - Ensure the workout text block starting from "Warmup" is passed directly to the API description field. 
   - The metadata (Name/Sport/Focus) should be mapped to the respective API fields.
`;
