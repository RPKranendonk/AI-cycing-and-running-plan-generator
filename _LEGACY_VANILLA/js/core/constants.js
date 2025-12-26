// ==========================================
// CONSTANTS & TEMPLATES
// Training tips, strength templates, and other static data
// ==========================================

// ==========================================
// TERMINOLOGY RULES
// IMPORTANT: Use these terms consistently throughout the app
// ==========================================
const TERMINOLOGY = {
    // NEVER use "AM" or "PM" - always use "Morning" and "Evening"
    MORNING: 'Morning',     // ☀️ First workout slot of the day
    EVENING: 'Evening',     // 🌙 Second workout slot of the day

    // Other standardized terms
    LONG_RUN: 'Long Run',   // Not "LR" or "Long"
    STRENGTH: 'Strength',   // Not "Gym" or "Weight Training" (UI uses WeightTraining for API)
};

const PHASES = {
    BASE: 'Base',
    BUILD: 'Build',
    PEAK: 'Peak',
    TAPER: 'Taper',
    RACE: 'Race',
    RECOVERY: 'Recovery'
};

const TRAINING_TIPS = [
    "Rest weeks are not weakness. Joop Zoetemelk said it best: you win the Tour in bed.",
    "We increase volume slowly so your tendons keep up with your lungs. Burnout is not heroic.",
    "Tapering removes fatigue so fitness can finally show up. Many races are lost by overtraining late.",
    "Keep easy days embarrassingly easy so hard days can be properly hard. Eliud Kipchoge calls this discipline.",
    "Consistency beats hero workouts. Injured athletes have great excuses and zero fitness.",
    "Zone 2 feels too slow on purpose. Tadej Pogačar builds his engine on endless aerobic hours.",
    "Base training still includes intensity. Mathieu van der Poel never fully drops high-intensity work.",
    "Long steady efforts build mitochondria. This is how endurance athletes earn durability.",
    "High-intensity intervals raise VO₂max and lactate threshold. Sifan Hassan uses them year-round.",
    "Strength training improves economy and injury resistance. Jonas Abrahamsen lifts. So should you.",
    "Warm-ups and cool-downs are mandatory. Skipping them borrows time from your future body.",
    "Neuromuscular strides teach speed without strain. Faith Kipyegon uses them to stay fast and relaxed.",
    "Most adaptation happens during sleep. Skip sleep and you are just exercising.",
    "Soreness is normal. Sharp pain is your body shouting. Learn the language early.",
    "Cross-training keeps fitness high while sparing joints. Paula Radcliffe relied on it to survive mileage.",
    "Fuel the work. Eat carbs 2 to 3 hours before hard sessions or expect disappointment.",
    "Hydration starts yesterday. Consistency matters more than mid-workout panic drinking.",
    "Protein within 30 minutes after strength work accelerates repair. Muscles are impatient.",
    "Feeling empty or heavy usually means you under-fueled yesterday, not today.",
    "Never try new nutrition on race day. Champions rehearse fueling like choreography.",
    "Mental stress counts as training load. Training plans ignore life at their own risk.",
    "Mobility is maintenance, not training. Ten minutes while watching TV is enough to stay functional.",
    "Alcohol hurts sleep and recovery. You can drink or adapt faster. Pick one occasionally.",
    "A 20-minute nap boosts alertness and lowers perceived effort. Many champions protect naps fiercely.",
    "Recovery is where fitness appears. The workout just opens the door."
];

const STRENGTH_A = `STRENGTH SESSION A – Neural Power
Warm-Up (10–12 min)
• 3min Cardio
• Dynamic mobility (swings, rocks)
• Activation (clamshells, glute bridge)

Main Lifts
• Overhead Press: 4x5 @ RPE 8
• High-Bar Back Squat: 4x6 @ RPE 8
• Trap Bar Deadlift: 4x5 @ RPE 8

Accessories
• Bulgarian Split Squat: 3x8/leg
• SA Row: 3x8/side
• Side Plank: 3x30s
• Farmer's Carry: 3x20m`;

const STRENGTH_B = `STRENGTH SESSION B – Stability
Warm-Up (10 min)
• 3min Cardio
• Leg swings, monster walks

Main Work
• Box Step-Downs: 3x12/leg
• SL RDL: 3x12/leg
• Wall Sit w/ Squeeze: 3x30s
• Side-Lying Abductions: 3x15/leg
• Pallof Press: 3x12/side
• Bird Dog: 3x6 (3s hold)`;

// --- Time Constants ---
const msPerDay = 86400000;
const daysPerWeek = 7;

// Expose to window for global access
window.TRAINING_TIPS = TRAINING_TIPS;
window.PHASES = PHASES;
window.STRENGTH_A = STRENGTH_A;
window.STRENGTH_B = STRENGTH_B;
window.msPerDay = msPerDay;
window.daysPerWeek = daysPerWeek;
