# KHERJA branding update — KJ

This update applies the owner-approved blue KJ app mark to the passenger onboarding screen and creates install icon assets for web/PWA use.

- `app/assets/kj-icon-1024.png`: master app icon
- `app/assets/kj-icon-512.png`, `kj-icon-192.png`: web app icons
- `app/assets/apple-touch-icon.png`: iOS home-screen icon
- `app/assets/favicon-32.png`, `favicon-64.png`: browser icons
- `app/manifest.webmanifest`: web app metadata and icons
- `app/build-shell.js`: accepts the new image-based logo markup when rebuilding the shell

The passenger/driver UI accent and browser theme are blue. Admin accent was aligned with the same blue.

## Store release status

These assets do not by themselves create native Android `.aab` or iOS `.ipa` packages. The repository is a Node.js backend with HTML/CSS/JS app shells; a native wrapper/build pipeline, production hosting/provider setup, and store compliance work are still required. End-to-end browser tests require the Playwright package, which is not installed in this workspace.
