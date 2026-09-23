# Larval movement cadence

Cause: larvae only moved inside the 250 ms breeder interval, while adult slugs moved in the visible tank's frame loop. Zooming magnified the four position jumps per second.

Visible tank frames now own larval movement. The breeder interval skips that movement while the same tank is visible; growth continues on its original timer. Closed tanks and hidden documents retain interval movement. Held larvae still do not walk. No render interpolation state, new timers, or saved fields were added.

Passed: movement at 20/30/60 Hz covers the same distance, growth remains one second per second, timer/frame loops do not double-step, hidden/closed ownership transfers and held larvae are checked by test-larva-cadence.mjs. Isolated Chrome at 5× zoom records position changes at rendering cadence (see report.json) and captures zoom.png. The browser test also measures movement-only cost for 50 larvae; these timings are not whole-game FPS. No player save is used.

Not checked: the player's particular obstacle layout, all food-seeking paths, and live GPU FPS. Existing obstacle unstick displacement can still deliberately relocate a larva embedded in a rock; this change addresses the regular four-Hz motion.
