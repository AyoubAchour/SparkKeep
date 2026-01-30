# SparkKeep (Expo + Convex)

Personal idea inbox focused on instant capture.

## Quick Start

1) Install deps

```
npm install
```

2) Configure Convex URL

- Copy `.env.example` to `.env` and set `EXPO_PUBLIC_CONVEX_URL` to your Convex deployment URL (e.g. from the Convex dashboard or after `npx convex init`).

3) Run the app

```
npm run start
```

Open on your device with Expo Go.

## Scripts

- `npm run start` — start Expo dev server
- `npm run android|ios|web` — platform targets
- `npm run convex:dev` — start Convex local dev (requires `npx convex init` first)

## Next Steps

- Add Convex schema and functions in `convex/`
- Implement local-first store + outbox in `src/data/`
- Build Inbox triage & Projects views under `app/`
