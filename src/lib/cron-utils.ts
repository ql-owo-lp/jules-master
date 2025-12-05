
import cronParser from 'cron-parser';

export function parseCronExpression(expression: string) {
    const parser = cronParser as any;
    if (parser.parse) {
        return parser.parse(expression);
    } else if (parser.parseExpression) {
        return parser.parseExpression(expression);
    } else if (parser.default && parser.default.parse) {
        return parser.default.parse(expression);
    } else if (parser.default && parser.default.parseExpression) {
        return parser.default.parseExpression(expression);
    }
    // Fallback attempts
    try {
        return (cronParser as any).parse(expression);
    } catch {
        return (cronParser as any).default.parse(expression);
    }
}
