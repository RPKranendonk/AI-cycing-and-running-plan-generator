/**
 * @file test-validator.js
 * @description Test harness for EnduranceValidator logic.
 * Run this in browser console or node (if window mocked).
 */

// Mock window if needed for Node execution (simple harness)
if (typeof window === 'undefined') {
    global.window = {};
    // Load the validator file content manually or assume it's pasted/loaded in environment
    try {
        const validator = require('./services/endurance-validator.js');
        window.EnduranceValidator = validator;
    } catch (e) {
        console.log("Could not require validator, assuming it is loaded globally or mock is failing", e);
    }
}

const mockWorkouts = {
    // 1. Simple Z1/Z2 Run (30m total)
    simpleAerobic: {
        type: 'Run',
        structure: {
            warmup: { duration: 5, zone: 'Z1' },
            main: { duration: 20, zone: 'Z2' },
            cooldown: { duration: 5, zone: 'Z1' }
        }
    },
    // 2. Interval Session (Z5a)
    // 5x 3min Z5a (15m work), 3min Z1 rest (15m rest). + 10w/10c. 
    // Total: 65 mins. Work: 15m (Z3), Rest/Warm/Cool: 50m (Z1)
    intervals: {
        type: 'Run',
        steps: [
            { duration: 10, zone: 'Z1', type: 'Warmup' },
            {
                reps: 5,
                active: { duration: 3, zone: 'Z5a' },
                recovery: { duration: 3, zone: 'Z1' }
            },
            { duration: 10, zone: 'Z1', type: 'Cooldown' }
        ]
    }
};

function runTest() {
    console.log("=== STARTING VALIDATOR TEST ===");

    if (!window.EnduranceValidator) {
        console.error("EnduranceValidator not found on window object!");
        console.log("Window keys:", Object.keys(window));
        return;
    }
    const V = window.EnduranceValidator;
    console.log('Validator Object:', V);

    // TEST 1: IDM Determination
    console.log("\n--- TEST 1: IDM Determination ---");
    const lowVol = V.determineIDM(4, 'Running');
    console.log(`Run 4h (Low): ${lowVol.name} - Expected Low Vol`);

    const midVol = V.determineIDM(6, 'Running');
    console.log(`Run 6h (Mid): ${midVol.name} - Expected Mid Vol`);

    const highVol = V.determineIDM(10, 'Running');
    console.log(`Run 10h (High): ${highVol.name} - Expected High Vol`);

    // TEST 2: TiZ Calculation - Simple
    console.log("\n--- TEST 2: TiZ Simple ---");
    const wiz1 = V.calculateWorkoutTiZ(mockWorkouts.simpleAerobic);
    console.log("Simple Z2 Run (30m):", JSON.stringify(wiz1));
    // Expected: Z1: 10 (warm/cool), Z2(Sci Z1): 20. Total Sci Z1: 30.
    // Wait, mapFrielToSci says Z2 -> SCI_Z1. 
    // So entire 30m should be SCI_Z1.
    if (wiz1.SCI_Z1 === 30) console.log("PASSED: All 30m in SCI_Z1");
    else console.error("FAILED: Expected 30m SCI_Z1");

    // TEST 3: TiZ Calculation - Intervals
    console.log("\n--- TEST 3: TiZ Intervals ---");
    const wiz2 = V.calculateWorkoutTiZ(mockWorkouts.intervals);
    console.log("Intervals (65m):", JSON.stringify(wiz2));
    // Work: 5 * 3 = 15m (Z5a -> SCI_Z3)
    // Rest: 5 * 3 = 15m (Z1 -> SCI_Z1)
    // Warm/Cool: 10+10 = 20m (Z1 -> SCI_Z1)
    // Total SCI_Z1 = 35m. Total SCI_Z3 = 15m.
    if (wiz2.SCI_Z3 === 15 && wiz2.SCI_Z1 === 35) console.log("PASSED: 15m Z3, 35m Z1");
    else console.error(`FAILED: Expected 15/35. Got ${wiz2.SCI_Z3}/${wiz2.SCI_Z1}`);

    // TEST 4: Validation Logic (Trigger Correction)
    console.log("\n--- TEST 4: Week Validation ---");
    // Create a week of purely easy runs (Low Vol)
    const weakWeek = [
        mockWorkouts.simpleAerobic, // 30m Z1
        mockWorkouts.simpleAerobic, // 30m Z1
        mockWorkouts.simpleAerobic  // 30m Z1
    ];
    // Total 1.5h. All SCI_Z1. SCI_Z2 = 0%. 
    // Low Vol requires SCI_Z2 40%.

    const res = V.validateWeek(weakWeek, 1.5, 'Running');
    console.log("Validation Result:", res.passed ? "PASSED" : "FAILED (As Expected)");
    if (!res.passed && res.corrections.length > 0) {
        console.log("Corrections Found:", res.corrections.length);
        console.log("Correction 1:", res.corrections[0].diagnosis);
        console.log("Action:", res.corrections[0].action);
        if (res.corrections[0].type === 'INTENSITY_UPGRADE') console.log("PASSED: Correct Trigger");
        else console.error("FAILED: Wrogn correction type");
    } else {
        console.error("FAILED: Should have triggered correction for 0% Z2");
    }

    console.log("=== TEST COMPLETE ===");
}

// Auto-run if possible
runTest();
