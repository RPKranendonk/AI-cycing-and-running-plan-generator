
import { WorkoutHydrationService } from './workout-hydration';

const testString = "r~2100~70-80%|6x(r~20~100-110%+rec~40~50-65%)|3x(r~480~85-95%+rec~180~50-65%)";

console.log("Testing Parser with string:", testString);

const result = WorkoutHydrationService.parseSteps(testString);

console.log("Result JSON:");
console.log(JSON.stringify(result, null, 2));

// Additional check for generating description
console.log("\nGenerated Description:");
console.log(WorkoutHydrationService.generateDescription(result));
