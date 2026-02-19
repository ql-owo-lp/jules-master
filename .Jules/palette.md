## 2025-05-23 - Accessibility of Tooltip Triggers
**Learning:** Tooltip triggers must be keyboard focusable. Using icon components (SVGs) directly as triggers prevents keyboard users from accessing the tooltip content.
**Action:** Wrap icon-only tooltip triggers in a `<Button>` component (e.g., ghost variant) with appropriate `aria-label` or `sr-only` text to ensure they are focusable and accessible.
