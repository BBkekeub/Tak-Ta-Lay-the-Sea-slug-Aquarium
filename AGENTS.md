# Rendering and performance requirements

The user requires low resource usage for every added feature. Review this on every change involving visuals or updates.

- Reuse cached images/geometry for static content. Camera pan and zoom must not rebuild static geometry or rerasterize it unnecessarily.
- Cull objects outside the viewport before expensive work. Do not render inactive scenes or a hidden document.
- Computer screens are static until an offer, quest, or special order changes their state. Animate only the visible notification while attention is needed.
- Keep cache invalidation explicit: visual state, orientation, and relevant occlusion/layout changes. Preserve correct depth, transparency, and hit targets. Bound cache memory and release obsolete entries.
- Preserve gameplay simulation separately from rendering; do not freeze timers, breeding, or customer logic simply because they are offscreen.
- Verify cache reuse during pan/zoom, zero rendering when offscreen/inactive, correct invalidation, and appearance at all four rotations. Measure new work rather than claiming speed from polygon counts alone.
- Do not add more polygons or per-frame loops without a demonstrated visual benefit and checking their cost.
