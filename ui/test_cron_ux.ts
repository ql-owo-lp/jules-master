import { format } from "date-fns";
import cronParser from "cron-parser";

// Simulate the logic in the component
const schedule = "0 0 * * 0";
try {
  // @ts-ignore
  const parser = cronParser;
  // @ts-ignore
  const expression = parser.parseExpression ? parser.parseExpression(schedule) : parser.parse(schedule);
  const nextRun = expression.next().toDate();
  console.log("Formatted Next Run:", format(nextRun, "PPpp"));
} catch (err) {
  console.error("Error:", err);
}
