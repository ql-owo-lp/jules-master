# Bolt's Journal

## 2025-12-22 - Optimizing ActivityFeed
**Learning:** React components that depend on a `countdown` or similar rapidly changing prop will re-render their entire subtree. Even if the child list hasn't changed, React will still iterate over it to create the virtual DOM.
**Action:** Extract the list into a `memo`ized component. This allows the parent to re-render (e.g. updating the timer in the header) without forcing the heavy list to re-render.
**Surprise:** I also learned that verifying frontend changes in this environment requires checking the port, as Next.js might pick a random port if 3000 is busy (it picked 9002 here).
