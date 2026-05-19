# tmux-g2

> ⚠️ Work in progress — not ready for production use.

Mirror a remote `tmux` session to **Even Realities G2 smart glasses** in real-time. Code on your machine, read the terminal output on your lens.

## What it does

- Connects to a remote Mac or Linux machine over SSH
- Attaches to an existing `tmux` session (or creates one)
- Streams terminal output to the G2 display via the EvenHub SDK
- Runs as a native EvenHub plugin — works from the glasses menu even with your phone locked

## Status

| Feature | Status |
|---|---|
| EvenHub app scaffold | ✅ |
| Input event indicators (tap, double-tap, swipe) | ✅ |
| tmux SSH bridge | 🚧 planned |
| Terminal rendering on G2 | 🚧 planned |
| Voice input typing | ❌ out of scope |

## Getting started

```bash
npm install

# Dev server + QR code to sideload on device
npm run dev

# Simulator (phone view + glasses view)
npm run sim

# Build
npm run build

# Package as .ehpk for Even Hub submission
npm run pack
```

## Stack

- [`@evenrealities/even_hub_sdk`](https://hub.evenrealities.com/docs/getting-started/overview) — official EvenHub SDK
- [`@evenrealities/evenhub-cli`](https://hub.evenrealities.com) — pack, publish, QR sideload
- [`@evenrealities/evenhub-simulator`](https://hub.evenrealities.com) — local simulator
- Vite + TypeScript

## Display

G2 canvas is 576×288 px, 4-bit greyscale (green on black). No CSS, no custom fonts — everything is SDK text/image containers.

## Contributing

Early days. Open an issue if you want to collaborate.
