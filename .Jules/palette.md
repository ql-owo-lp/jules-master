## 2024-05-22 - Improved Repository Refresh Button and Schedule Input Accessibility
**Learning:** Icon-only buttons can be confusing without tooltips. Adding tooltips clarifies the action. Input fields with complex formats (like cron expressions) benefit from `aria-describedby` linking to helper text.
**Action:** Always check for icon-only buttons and add tooltips. Ensure helper text is programmatically associated with inputs.
