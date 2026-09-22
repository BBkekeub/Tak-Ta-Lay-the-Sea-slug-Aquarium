# Collector hat fitting

The old fixed crown was narrower and lower than the actual head/hair. The hat now uses cached head/hair bounds, a ten-sided enclosing ellipse, and body-width scaling. The brim sits higher, with clearance above the hair. Existing head movement and pose caching remain in use; the six rings and polygon count are unchanged.

Passed: isolated browser gallery of four body variants at four directions with head yaw; visually inspected all 16 views for exposed scalp/hair through the crown. Pan/zoom pose reuse, offscreen pose reuse, fit cache reuse, JavaScript syntax and diff checks passed. Live FPS, hidden-tab rendering and in-shop furniture occlusion were not remeasured for this change. Player save data was not used.

Run `node tools/test-hat-fit.mjs` to regenerate the gallery and report.
