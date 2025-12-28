## 2024-05-22 - Missing Input Validation in API Routes
**Vulnerability:** Several API routes (`settings`, `cron-jobs`) were blindly trusting user input, taking fields from `req.json()` without Zod validation.
**Learning:** Even when Zod schemas exist, they might be bypassed if developers manually destructure other properties from the body.
**Prevention:** Always validate the *entire* request body against the schema and ONLY use the validated output. Avoid `...body` or manual property access on unvalidated data.
