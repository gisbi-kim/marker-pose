# Marker Pose
Phone-camera relative pose estimation, entirely in the browser.

**Live:** https://gisbi-kim.github.io/marker-pose/

## Use
1. Download or print the marker from the page on another device.
2. Measure the black square outer edge (exclude white quiet zone); enter millimeters.
3. Open the HTTPS live page on mobile Safari/Chrome and allow camera access.
4. Point the rear camera at the marker. Select the matching ID.
5. Read position, distance, ZYX Euler angles, or export the current transform as JSON.

Supported dictionary: **ARUCO_MIP_36h12**, IDs 0–249. Other ArUco / AprilTag dictionaries are not interchangeable.

## Geometry
Forward transform: p_camera = R p_marker + t.
Camera: x right, y down, z forward.
Marker: origin at center; x right, y down, z into marker.
Units: meters, degrees. R = Rz(yaw) Ry(pitch) Rx(roll).
Inverse transform uses R^T and -R^T t.
Overlay blue arrow indicates **negative marker Z**, toward the observer.

## Camera calibration and limitations
Default horizontal FOV 65 degrees is an assumption, not a calibrated phone model.
Enter fx, fy, cx, cy and calibration image dimensions for better metric accuracy.
K is scaled to processing resolution. Lens, crop and image aspect ratio must match.
Manual-K mode assumes zero distortion. Browser calibration profiles apply Brown-Conrady distortion correction to detected corners and to overlay/reprojection calculations.
Planar pose ambiguity, distant or small markers, blur and rolling shutter reduce accuracy.
Reprojection RMS measures fit, not absolute accuracy.
Detection processes frames up to 960 pixels wide; photos up to 1280.
The browser does not upload images. Basic tracking needs no CDN. Calibration loads pinned @deluksic/opencv-calibration-wasm 0.2.5 from jsDelivr; no image or corner data is uploaded.
A single requested marker ID is tracked; lost detections clear live values.

## Development and validation
Static HTML/CSS/JS; no build step. Serve over localhost or HTTPS.
Run `node test.cjs` for synthetic non-square-intrinsics pose, inverse, immutability,
and end-to-end raster marker detection tests at IDs 0, 42, 249.
The in-page sample test uses the real detector and pose solver with a synthetic marker;
it is explicitly labeled SAMPLE and is not a real camera measurement.
Real phone-camera accuracy requires physical testing and calibration.

## Credits
Vendored MIT-licensed [js-aruco2](https://github.com/damianofalcioni/js-aruco2),
copyright Damiano Falcioni and Juan Mellado, fetched 2026-10-19.
Upstream copyright/license notices are retained in vendor files.
Coplanar POSIT: Oberkampf, DeMenthon and Davis.

## Automatic calibration
Print the app's dedicated 3x4 ARUCO_MIP_36h12 board (IDs 0-11).
Marker black edge: 35 mm; gap: 10 mm. Use 100% uniform print scale and a rigid flat backing.
Hold the board still and move the phone (or vice versa), pausing at varied viewpoints.
The collector requires all 12 markers (48 corners), sufficient size/sharpness/stability,
and diverse positions/tilts. Goal: 24 views; minimum: 18.
OpenCV calibrateCameraRO with iFixedPoint=-1 uses the fixed-board calibration method:
LM joint reprojection optimization of fx, fy, cx, cy, k1, k2, p1, p2 and per-view extrinsics.
Skew and k3 are fixed at zero. Every fifth view is withheld from intrinsic calibration
and evaluated using solvePnP/projectPoints. Fits above 1.5 px training or 2 px holdout RMS
and implausible parameters are rejected. These gates do not guarantee absolute accuracy.
The solve runs in a module Web Worker. Cancel/timeout terminates the worker.
Save/apply stores the profile in localStorage and auto-applies only for matching
deviceId, capture dimensions and reported zoom. Focus/crop changes not exposed by the
browser cannot be detected; keep physical lens, zoom and capture settings unchanged.
Saved profiles are intentionally not auto-applied to uploaded photos.
The synthetic optimization test never overwrites or saves a real calibration profile.
Run node test-calibration.cjs for distortion, board detection and sampling-gate checks.
Actual printed-board phone performance still requires a physical validation session.

Calibration WASM package: https://github.com/deluksic/opencv-calibration-wasm (MIT wrapper; OpenCV).
