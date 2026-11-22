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

## Vercel Serverless Functions (`api/`)

Push notifications and Messenger integration run as Vercel Serverless Functions (free on Hobby plan) instead of Firebase Cloud Functions.

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables in **Vercel Project Settings → Environment Variables**:
   - `FIREBASE_PROJECT_ID` — your Firebase project ID
   - `FIREBASE_CLIENT_EMAIL` — Firebase service account client email
   - `FIREBASE_PRIVATE_KEY` — Firebase service account private key (with `\n` line breaks)
   - `FACEBOOK_PAGE_ACCESS_TOKEN` — from Facebook App → Messenger → Settings → Token Generation
   - `MESSENGER_VERIFY_TOKEN` — any string (webhook verification)
   - `APP_URL` — your Vercel app URL (e.g. `https://your-app.vercel.app`)
   - `VITE_FIREBASE_VAPID_KEY` — from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates

3. Generate a Firebase service account key:
   - Go to Firebase Console → **Project Settings** → **Service Accounts**
   - Click **Generate New Private Key**
   - Copy the JSON values into the env vars above

4. Deploy to Vercel:
   ```bash
   vercel deploy
   ```
   Or connect your Git repo to Vercel for automatic deploys.

### Required environment variables (`.env` for local, Vercel dashboard for production)

See `.env.example` for frontend variables. For the serverless API functions, set these in Vercel:
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FACEBOOK_PAGE_ACCESS_TOKEN=your_facebook_page_access_token
MESSENGER_VERIFY_TOKEN=your_webhook_verify_token
APP_URL=https://your-app.vercel.app
```

## Facebook Messenger Setup

Patients can follow up on their queue status via Messenger by tapping a static button like "followup appointment" or sending their HRN.

### 1. Create a Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com) and create a new app
2. Add the **Messenger** product to your app
3. Select or create a Facebook Page that patients will message
4. Generate a **Page Access Token** (Messenger → Settings → Token Generation)
5. Copy the token into `FACEBOOK_PAGE_ACCESS_TOKEN` env var

### 2. Configure the Webhook

**Find your webhook URL:**

1. Deploy to Vercel first
2. Your webhook URL will be: `https://your-app.vercel.app/api/messenger-webhook`
3. In your Facebook App → **Messenger** → **Settings** → **Webhooks**, click **Add Callback**
4. **Callback URL:** `https://your-app.vercel.app/api/messenger-webhook`
5. **Verify token:** any string (must match `MESSENGER_VERIFY_TOKEN`)
6. **Subscription fields:** `messages`, `messaging_postbacks`
7. Select your Page and click **Save**
8. **Subscribe to your Page:** click **Subscribe** next to your Page name

### 3. Deploy

Push your code to the branch connected to Vercel, or run `vercel deploy`.

### How it works

- Patient messages your Page → bot replies with their queue number, position, status, and doctor
- Patient taps "followup appointment" → bot finds their HRN via their Messenger PSID and looks up their queue, then sends a deep link to register push notifications
- Patient sends their HRN directly (e.g. `HRN12345`) → bot links their PSID to that patient profile and returns queue info
- Commands: `help`, `menu`, `start` show available options

### Push notification registration via Messenger deep link

When a patient taps "followup appointment", the bot sends a link like:

```
https://your-app.vercel.app/patient?hrn=HRN12345&registerPush=1
```

When the patient opens this link on Android or desktop Chrome:
1. The Patient Page auto-fills their HRN
2. Automatically prompts for notification permission
3. Saves their FCM token to `fcmTokens/{hrn}/devices/{token}`
4. Future queue updates (added, serving) send push to their device

On iOS, the link opens the app but web push is not supported (Apple limitation); Messenger messages are used instead.

### Limitations

- Patients must message your Page first (to establish a Page-Scoped ID)
- You can only reply within 24 hours of the patient's last message unless using Message Tags
- Not available on iOS web push (use Messenger as the iOS notification channel instead)
- Vercel Hobby plan has serverless function limits (10s execution time, 1024 MB memory)

