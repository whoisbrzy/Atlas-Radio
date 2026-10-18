# Atlas Desktop — Phase 5 Release Candidate

This is a separate Electron + React desktop client. It uses the Atlas logo but
does not embed the landing page or behave like a website. Atlas is a text-to-speech app for people
using their normal Discord account and Discord client. It will output generated
speech through an Atlas virtual microphone that the user selects in Discord.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Build an unsigned Windows installer (`desktop-app/release/Atlas Desktop-Setup-0.2.3.exe`):

```sh
npm run package:windows
```

Windows may show a SmartScreen warning because this installer is not code-signed.
Only install builds obtained from a source you trust. A signed publisher
certificate is needed before distributing this as a broadly trusted release.

## Phase 1 decisions

- Desktop shell: Electron, React, TypeScript, and electron-vite.
- Initial development target: Windows desktop; the shell itself remains portable.
- Discord integration: optional Discord OAuth sign-in at `atlasvc.vercel.app` uses the Atlas Vercel
  session to show your profile and accessible servers. It requests `identify` and `guilds`. Atlas will not
  automate a user account, join channels as a bot, or use Discord voice APIs.
- Audio routing: the user keeps using Discord normally and selects the VB-CABLE
  recording endpoint as their Discord input device.
- Security: the renderer has no Node integration and runs in an isolated,
  sandboxed Electron window. OAuth stays in a restricted sign-in window; Discord
  tokens never enter the renderer.
- Speech is generated locally; Atlas does not automate a Discord account. The
  optional VB-Audio driver is installed separately.

## Phases

1. Foundation and app shell — this milestone.
2. TTS and virtual microphone prototype — Windows local speech synthesis plus
   selectable playback output. For the Discord path, install VB-Audio Virtual
   Cable separately, select `CABLE Input` as Atlas's playback output, and select
   `CABLE Output` as Discord's microphone input.
3. Voice MVP — installed Windows voice options, press-and-hold push-to-talk,
   and audio device disconnect/reconnect status.
4. ER:LC controls — department phrase presets and radio-friendly controls.
5. Release readiness — Windows installer packaging, offline-safe styling,
   keyboard cancellation for push-to-talk, and a restrictive renderer CSP.

## Phase 2 prototype setup

On Windows, install VB-Audio Virtual Cable from its publisher, then restart Atlas
so Windows exposes the new audio endpoints. Use **Choose output** and pick
`CABLE Input (VB-Audio Virtual Cable)`. In Discord Voice Settings, set Input
Device to `CABLE Output (VB-Audio Virtual Cable)`. Speak messages in Atlas; the
app uses Windows' installed `System.Speech` voice and routes the resulting audio
to the selected output. The third-party cable driver is not bundled by Atlas.

The prototype supports Windows only and sends to the selected playback device.
Choosing ordinary speakers will play the speech locally; choosing `CABLE Input`
routes it to Discord when Discord is configured with `CABLE Output` as its mic.
Phase 3 lists voices installed in Windows. Type a message and hold **Hold to
speak** (or hold Space while that button is focused); releasing stops playback.
If Windows reports that the selected output disappeared, Atlas stops speech and
offers a reconnect action. Generated audio remains local to the computer.

Atlas verifies an active connection to its sign-in service before opening the
radio desk, and rechecks periodically while running. Discord sign-in opens in your
default browser and returns to Atlas through its `atlas-radio://` app link. Speech
remains local, but account verification and Discord sign-in require the internet. In **Audio Setup**,
choose a Windows voice, select a Natural/Dispatch/Calm/Urgent profile, or tune
pace and pitch. Use **Add Windows voices** to open Windows speech settings, then
refresh the list after installing additional system voices. Voice tuning is saved
on this device.

Phase 4 adds quick phrases for Police, Sheriff, Fire / EMS, and DOT. Select a
phrase to load it into the composer, optionally include a unit/callsign and an
“over” sign-off, then use push-to-talk as usual. Custom phrases can be saved and
removed; they stay in this Windows user profile and are not synced or sent
anywhere except as audio through the output device while you hold to speak. Server
preferences edited in the website dashboard are loaded on sign-in and when changing
the selected server; configure the Vercel KV / Upstash REST environment values in the
root README to enable this shared storage.
