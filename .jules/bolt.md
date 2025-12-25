## 2025-02-14 - Memoization of Activity List
**Learning:** React functional components in this project often combine frequent updates (like countdown timers) with heavy rendering lists (like activity feeds) in the same component. This causes unnecessary re-renders of the list.
**Action:** Splitting components into smaller parts and using `React.memo` on the heavy parts (the list) effectively isolates the frequent updates to only the header/timer part, significantly reducing the rendering work per second.
