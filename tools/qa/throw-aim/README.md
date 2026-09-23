# Arrow aiming inspired by Pebble Dash

Reference inspected directly in the playable game's Help and aiming screens: https://www.pomu.com/embed/pebble-dash . First click begins angle selection; second locks the rotating arrow's angle and starts its changing power length; third throws. Our implementation draws its own arrow, retains the game's existing angle range and over-90% foul rule, and keeps Space as an alternative to clicking/tapping. It does not copy the original art or promise identical charge timing.

The field accepts primary pointer input only during player aiming. Buttons stop propagation; bot turns cannot be controlled by clicking. Each player round waits for the first click. Angle/power stage transitions save immediately. Old saves in the previous aiming order restart the unlaunched aim stage without changing scores, money or airborne shots.

Passed in an isolated browser: field clicks advance intro → angle → power without launching early; Space launches with the locked angle; save/reload in power preserves the 42° angle; F/K acceleration and repeated-key rejection still pass. Screenshots at 1280×800 and 480×800 were inspected. JavaScript syntax and diff checks passed. Live FPS, complete tournament/economy behavior, and identical timing to the reference were not claimed or measured.

Run `node tools/test-throw-aim.mjs`. The test uses its own browser profile and does not touch the player's save. The arrow has a fixed small vector path and no extra timer, particle pool or independent render loop.
