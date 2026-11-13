# KeyHop

**KeyHop** is a free, open-source, fullscreen-first piano sight-reading web application inspired by interactive music flashcard games. Place your laptop, tablet, or phone on a piano music stand, enter fullscreen, and play notes on your real **acoustic or digital piano** via **Microphone** or **Web MIDI**.

## Features

- **Piano-First Curriculum:** Built-in levels across **Grand Staff**, **Treble Clef**, and **Bass Clef** (`Landmarks`, `Starter`, `Part Staff`, `Whole Staff`, `Just Ledgers`, `Grand Challenge`, `Sharps & Flats`, and `0T–6T` / `0B–6B` drills).
- **Acoustic Microphone Pitch Recognition:** Uses the McLeod Pitch Method (`pitchy`) over a 4096-sample buffer with noise gating, stability debouncing, and low-piano sub-harmonic octave protection, plus `"Play G to Start!"` calibration for pianos tuned slightly sharp or flat.
- **Direct Web MIDI Support:** Plug in a USB/Bluetooth MIDI digital piano (in Chrome, Edge, or Firefox on desktop, or Chrome on Android) for instant silent practice with headphones. *(Safari/iOS uses Microphone mode natively.)*
- **Landmark Pedagogy Hints:** Toggleable amber guide bands and badges for **Bass C**, **Bass F**, **Middle C**, **Treble G**, and **Treble C**.
- **10 Playful Vector Themes:** *Fruit Smash*, *Cute Bird*, *Space*, *Classic*, *Ladybug*, *Basketball*, *Soccer*, *Chalkboard*, *Spooky*, and *Pastel*, paired with synthesized Web Audio sound effects.
- **Blueprint Level Designer & QR Sharing:** Build custom drills with naturals, sharps, and flats across the grand staff, and share them with students via compressed URLs or QR codes—no backend required.
- **Fullscreen & Offline PWA:** One-click Fullscreen (`F` shortcut), Screen Wake Lock during rounds, and offline caching via service worker.

## Getting Started

```bash
npm install
npm run dev
```

### Scripts

- `npm run dev` — Start local Vite development server
- `npm run build` — Type-check and build production bundle + PWA service worker
- `npm test` — Run Vitest unit tests (music notation math, DSP pitch detection, scoring, URL level sharing)
- `npm run lint` — Run `oxlint`
