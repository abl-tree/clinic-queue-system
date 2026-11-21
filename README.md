# SPMC Queueing System

A React + Vite queue management application for the Southern Philippines Medical Center (SPMC) cancer center. Tracks patient queues across multiple stations (reception, doctor, lab, pharmacy) using Firebase Firestore in real time.

## Tech Stack

- React 19 + Vite 8
- React Router 7
- Firebase (Firestore, Auth)
- Oxlint

## Getting Started

```bash
npm install
cp .env.example .env
# fill in your Firebase config values
npm run dev
```

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — run oxlint

## Environment Variables

See `.env.example` for required Firebase configuration variables.