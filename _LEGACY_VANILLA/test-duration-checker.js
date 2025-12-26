
// Test Script for Distance-Based Duration Logic
// Run with: node test-duration-checker.js

// --- Mocking Dependencies ---
const isCycling = false;
const thresholdPace = 300; // 5:00/km

// Mock Zones (roughly matching weekly-ui.js logic)
const paceZ1 = thresholdPace * 1.35; // 6:45/km -> ~8.8km/h
const paceZ2 = thresholdPace * 1.25; // 6:15/km -> ~9.6km/h
const paceZ3 = thresholdPace * 1.08; // 5:24/km
const paceZ4 = thresholdPace * 1.00; // 5:00/km

// Mock Structures
const mockStructures = {
    'Intervals_Distance': {
        warmup: { duration: 15 },
        main: { reps: 5, work: { distance: 1000 }, rest: { duration: 3 } }, // 5x1km
        cooldown: { duration: 10 }
    },
    'Intervals_Time': {
        warmup: { duration: 15 },
        main: { reps: 5, work: { duration: 4 }, rest: { duration: 2 } }, // 5x4min
        cooldown: { duration: 10 }
    },
    'Intervals_Short': {
        warmup: { duration: 10 },
        main: { reps: 4, work: { distance: 400 }, rest: { duration: 2 } }, // 4x400m
        cooldown: { duration: 5 }
    }
};

// --- Logic from weekly-ui.js (Simulated) ---

function calculateTestDuration(targetDistanceKm, structure) {
    if (!structure) return 0;

    // Fixed Parts
    let fixedDurationSec = 0;
    let fixedDistanceKm = 0;

    // Warmup
    if (structure.warmup?.duration) {
        fixedDurationSec += structure.warmup.duration * 60;
        fixedDistanceKm += (structure.warmup.duration * 60) / paceZ1;
    }
    // Cooldown
    if (structure.cooldown?.duration) {
        fixedDurationSec += structure.cooldown.duration * 60;
        fixedDistanceKm += (structure.cooldown.duration * 60) / paceZ1;
    }

    // Main Set
    if (structure.main.reps && (structure.main.work || structure.main.duration)) {
        const reps = structure.main.reps;
        // Work Duration (parse distance or duration)
        const work = structure.main.work || {};
        const workDur = work.duration ? work.duration * 60 : (work.distance ? (work.distance / 1000) * paceZ4 : 0); // approx Z4 for distance-based time
        const restDur = structure.main.rest?.duration ? structure.main.rest.duration * 60 : 120;

        const mainSetDuration = reps * (workDur + restDur);
        const totalFixedDur = fixedDurationSec + mainSetDuration;

        // Distances
        let workDistKm = 0;
        if (work.distance) {
            workDistKm = (work.distance / 1000) * reps;
        } else {
            // Estimate distance for time-based intervals (using Z4)
            workDistKm = reps * (workDur / paceZ4);
        }

        let restDistKm = reps * (restDur / paceZ1); // Rest at Z1

        const coveredKm = fixedDistanceKm + workDistKm + restDistKm;

        // Gap
        let gapKm = targetDistanceKm - coveredKm;
        if (gapKm < 0) gapKm = 0;

        const fillDuration = gapKm * paceZ2; // Fill at Z2

        return {
            totalDurationMin: Math.round((totalFixedDur + fillDuration) / 60),
            fixedKm: coveredKm.toFixed(2),
            gapKm: gapKm.toFixed(2),
            fillMin: Math.round(fillDuration / 60)
        };
    }
    return null;
}

// --- Test Cases ---

const testLimit = 16; // 16km Target (Long Runish Interval)
const testMedium = 10; // 10km Target
const testShort = 6;  // 6km Target

console.log("=== TEST RESULTS: Distance-Based Duration Logic ===\n");

// Case 1: 5x1km (Total fixed ~11km with warmup) vs 10km Target
// Expect: Gap = 0 (Fixed > Target)
console.log("Case 1: 5x1km Intervals (Fixed ~9-10km) vs 10km Target");
const result1 = calculateTestDuration(10, mockStructures.Intervals_Distance);
console.log(`Input: 10km | Output: ${result1.totalDurationMin}m | Fixed: ${result1.fixedKm}km | Gap: ${result1.gapKm}km | Fill: ${result1.fillMin}m`);
console.log(result1.fillMin === 0 ? "PASS" : "FAIL (Should be 0 fill)");
console.log("");

// Case 2: 5x1km vs 16km Target
// Expect: Gap ~6km -> ~35-40min fill
console.log("Case 2: 5x1km Intervals vs 16km Target");
const result2 = calculateTestDuration(16, mockStructures.Intervals_Distance);
console.log(`Input: 16km | Output: ${result2.totalDurationMin}m | Fixed: ${result2.fixedKm}km | Gap: ${result2.gapKm}km | Fill: ${result2.fillMin}m`);
console.log(result2.fillMin > 20 ? "PASS" : "FAIL (Fill too small)");
console.log("");

// Case 3: 5x4min (Time-based, ~20min work) vs 12km Target
// Expect: Significant fill
console.log("Case 3: 5x4min Time-Based (~20min hard) vs 12km Target");
const result3 = calculateTestDuration(12, mockStructures.Intervals_Time);
console.log(`Input: 12km | Output: ${result3.totalDurationMin}m | Fixed: ${result3.fixedKm}km | Gap: ${result3.gapKm}km | Fill: ${result3.fillMin}m`);
console.log(result3.fillMin > 10 ? "PASS" : "FAIL (Fill too small)");
console.log("");

// Case 4: Short Intervals (4x400m) vs 4km Target (Very short run)
// Expect: Gap ~0 or small
console.log("Case 4: 4x400m (Short) vs 4km Target");
const result4 = calculateTestDuration(4, mockStructures.Intervals_Short);
console.log(`Input: 4km | Output: ${result4.totalDurationMin}m | Fixed: ${result4.fixedKm}km | Gap: ${result4.gapKm}km | Fill: ${result4.fillMin}m`);
console.log(result4.fillMin === 0 ? "PASS" : "FAIL");

