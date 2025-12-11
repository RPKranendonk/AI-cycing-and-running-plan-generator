
const { WorkoutHydrationService } = require('./workout-hydration.js');

const testString = "r~2100~70-80%|6x(r~20~100-110%+rec~40~50-65%)|3x(r~480~85-95%+rec~180~50-65%)";

console.log("Testing Compiled JS Parser...");
const result = WorkoutHydrationService.parseSteps(testString);

console.log("\nGenerated Description:");
const desc = WorkoutHydrationService.generateDescription(result);
console.log(desc);

// Check if description has double newlines
if (desc.includes('\n\n')) {
    console.log("\nSUCCESS: Description contains empty lines between blocks.");
} else {
    console.error("\nFAILURE: Description does NOT contain empty lines between blocks.");
    process.exit(1);
}
