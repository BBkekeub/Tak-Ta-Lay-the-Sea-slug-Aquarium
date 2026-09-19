# Rendering and performance requirements

## New feature and fix checklist

Read `manual/feature-rules/README.md` before implementing a feature or fix. Apply its universal checks and only the topic-specific checks relevant to the change. The user requested this handbook as the project's shared review rules.

- Inspect the current working tree and other contributors' progress before editing; preserve unrelated work.
- Establish observable acceptance criteria, state ownership, and affected systems before implementation.
- Use an isolated test profile/save. Never overwrite the player's save to test a change.
- Verify relevant behavior, cancellation/repetition, persistence, resource lifecycle, and simulation timing. For rendering changes, also follow the requirements below.
- Report checks as passed, failed, not checked, or not applicable. Do not claim FPS gains from polygon counts or reduced call counts alone.
- Scale verification to risk; simple text/document changes do not require new automated tests. Use `manual/feature-rules/completion-template.md` when a structured report helps.

## Rendering rules

The user requires low resource usage for every added feature. Review this on every change involving visuals or updates.

- Reuse cached images/geometry for static content. Camera pan and zoom must not rebuild static geometry or rerasterize it unnecessarily.
- Cull objects outside the viewport before expensive work. Do not render inactive scenes or a hidden document.
- Computer screens are static until an offer, quest, or special order changes their state. Animate only the visible notification while attention is needed.
- Keep cache invalidation explicit: visual state, orientation, and relevant occlusion/layout changes. Preserve correct depth, transparency, and hit targets. Bound cache memory and release obsolete entries.
- Preserve gameplay simulation separately from rendering; do not freeze timers, breeding, or customer logic simply because they are offscreen.
- Verify cache reuse during pan/zoom, zero rendering when offscreen/inactive, correct invalidation, and appearance at all four rotations. Measure new work rather than claiming speed from polygon counts alone.
- Do not add more polygons or per-frame loops without a demonstrated visual benefit and checking their cost.
