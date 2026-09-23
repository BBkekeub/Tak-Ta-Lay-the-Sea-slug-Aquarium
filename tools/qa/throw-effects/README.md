# Throw close-up and wave feedback

Boost now zooms to 3.2–5 and follows the airborne stone's height. The waves phase widens to 2.2–4.3 to show incoming crests; aiming/results retain the field view. Twelve moving wind streaks follow actual speed, with a short flash on accepted F/K presses. Filled curling waves replace line arcs, with timing still driven by the existing wave arrival times. Physics, scoring and input rules are unchanged.

Passed: isolated-profile browser screenshots at 1280×800 and 480×800 for boost/waves; accepted F increases velocity, repeated F is rejected; cached wave bitmap identity stays the same; no page errors; syntax/diff checks. The bitmap is allocated lazily once (160×140, about 90 KB RGBA); no particle pool, timer, or extra animation loop. Existing hidden-scene rendering guards remain in place.

Measured only the stone/boost drawing call in a headless browser: p50 0.04 ms, p95 0.10 ms per call over 80 batches of 20. This is not whole-game frame time or a live FPS claim. The 3D-slug readiness check timed out in the first run; screenshots use the working fallback slug renderer. Live GPU performance, full-match transitions, and background-tab scheduling were not measured. This tank camera does not expose four view rotations.

Run `node tools/test-throw-effects.mjs`; it creates a separate browser profile and does not access the player's save.
