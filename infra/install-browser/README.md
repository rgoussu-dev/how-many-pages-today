# @hmpt/infra-install-browser

`createBrowserInstaller()` implements the `AppInstaller` port: it catches Chromium's
`beforeinstallprompt` (and replays it on demand), recognises iOS/iPadOS Safari (where
installing is Share → Add to Home Screen, by hand) and an already-installed app.
