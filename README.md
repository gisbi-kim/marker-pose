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
Lens distortion is NOT corrected in this version. Use low-distortion/rectified imagery.
Planar pose ambiguity, distant or small markers, blur and rolling shutter reduce accuracy.
Reprojection RMS measures fit, not absolute accuracy.
Detection processes frames up to 960 pixels wide; photos up to 1280.
The browser does not upload images. Third-party runtime CDNs are not required.
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
