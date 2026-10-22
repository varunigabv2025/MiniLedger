# MiniLedger 💳

**MiniLedger** is a full-stack peer-to-peer lending ledger that helps people record money lent to friends, track repayments, and identify overdue loans. It includes a React Native app built with Expo, a TypeScript/Express REST API, and PostgreSQL persistence.

<p align="center">
  <a href="https://miniledger-mobile.vercel.app/"><strong>🌐 Open the live demo</strong></a>
  &nbsp; • &nbsp;
  <a href="https://expo.dev/accounts/varuniga/projects/miniledger/builds/b89e2e16-8414-4e44-a68d-403aa3ed1c8b"><strong>📱 Android APK (EAS build)</strong></a>
  &nbsp; • &nbsp;
  <a href="https://miniledger-mm1e.onrender.com/health"><strong>🩺 Backend health</strong></a>
  &nbsp; • &nbsp;
  <a href="https://github.com/varunigabv2025/MiniLedger"><strong>💻 Source code</strong></a>
</p>

> **Recruiter quick start:** Open the live demo and choose **⚡ Try Demo Account**. The demo login does not require an OTP or a terminal. The sample account is shared, so its data can be changed by other visitors; select **Reset Data** to restore the original sample ledger.

> **Android app:** The [Expo EAS build page](https://expo.dev/accounts/varuniga/projects/miniledger/builds/b89e2e16-8414-4e44-a68d-403aa3ed1c8b) contains the tested APK artifact. Open the page and use its download option to obtain the installer. This is a direct build-page link, not a Play Store listing.

---

## Table of contents

- [Live deployment](#-live-deployment)
- [Features](#-features)
- [Tech stack](#-tech-stack)
- [Demo account](#-recruiter-demo-account)
- [Architecture](#-architecture)
- [Getting started locally](#-getting-started-locally)
- [Environment variables](#-environment-variables)
- [Database schema](#-database-schema)
- [API reference](#-api-reference)
- [Testing](#-testing)
- [Cloud deployment](#-cloud-deployment)
- [Security and known limitations](#-security-and-known-limitations)

## 🌐 Live deployment

| Component | URL |
|---|---|
| Web app | [https://miniledger-mobile.vercel.app/](https://miniledger-mobile.vercel.app/) |
| Android APK build/download page | [Download APK from Expo EAS](https://expo.dev/accounts/varuniga/projects/miniledger/builds/b89e2e16-8414-4e44-a68d-403aa3ed1c8b) |
| Backend API base | [https://miniledger-mm1e.onrender.com](https://miniledger-mm1e.onrender.com) |
| Backend health | [GET /health](https://miniledger-mm1e.onrender.com/health) |
| Database health | [GET /health/db](https://miniledger-mm1e.onrender.com/health/db) |
| GitHub repository | [varunigabv2025/MiniLedger](https://github.com/varunigabv2025/MiniLedger) |

The deployed web app uses the API base URL `https://miniledger-mm1e.onrender.com/api`. Render free services can spin down when inactive, so the first request after a period of inactivity may take longer.

## ✨ Features

### Loan tracking
- Create a loan with a friend's name, amount in INR, and due date.
- View the loan ledger and current repayment status.
- Mark an unpaid loan as repaid; the repayment timestamp is recorded.
- Prevent duplicate repayment actions.
- Sort unpaid overdue loans first, upcoming unpaid loans next, and repaid loans last.
- Validate amounts and calendar dates.

### Financial dashboard
- Total lent.
- Total repaid.
- Total outstanding.
- Overdue amount.
- Counts of all, pending, and repaid loans.

Summary values are calculated by PostgreSQL for the signed-in user's loans.

### Authentication
- Phone-number login using a mock six-digit OTP.
- OTP values are hashed before storage, expire after the configured duration, are one-time use, and are logged to the **backend runtime logs** for this demo flow.
- JWT-based authentication for API requests.
- One-tap recruiter demo login that skips OTP.
- Session token storage through Expo SecureStore, with a web-compatible fallback.

> The OTP flow does **not** send a real SMS. For the deployed version, request an OTP from the web app and look in the Render service's **Logs** for the `[MiniLedger Mock OTP]` entry. Recruiters should use Demo Account instead.

### Receipt photos
- Optionally attach a JPEG/PNG receipt to a loan.
- Upload limit: 5 MB per image.
- View the receipt through an authenticated endpoint.
- Receipt access is checked against the authenticated loan owner.

### UI and usability
- Warm, accessible cream-and-earthy-brown color system.
- Status badges for overdue, pending, and repaid loans.
- Responsive Expo web build and React Native mobile screens.
- Dashboard refresh, loading and error feedback, and demo reset controls.

## 🧪 Recruiter demo account

1. Open [MiniLedger](https://miniledger-mobile.vercel.app/).
2. Click **⚡ Try Demo Account**.
3. Explore the seeded ledger, add a test loan, mark a loan as repaid, or upload a sample receipt.
4. Click **🔄 Reset Data** in the demo banner to restore the initial sample data.

The initial demo ledger includes:

| Sample loan | Amount | Initial status |
|---|---:|---|
| Neha Gupta (Demo) | ₹12,000 | Overdue, unpaid |
| Rohan Sharma (Demo) | ₹7,500 | Pending |
| Pooja Mehta (Demo) | ₹3,200 | Pending |
| Vikram Malhotra (Demo) | ₹4,500 | Repaid |

Initial summary: **₹27,200 total lent**, **₹4,500 repaid**, **₹22,700 outstanding**, and **₹12,000 overdue**. Dates are generated relative to the time the demo data is seeded. Since this is a shared demo account, another visitor may change the ledger; use Reset Data to return to the sample state.

## 🛠️ Tech stack

| Layer | Technologies |
|---|---|
| Mobile and web UI | React Native, Expo, TypeScript, React Native Web |
| Navigation and platform storage | State-driven screen navigation, Expo SecureStore |
| Receipt picker | Expo Image Picker |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, `pg` connection pool |
| Validation | Zod |
| Authentication | bcryptjs, JSON Web Tokens (JWT) |
| Uploads | Multer |
| Tests | Jest, Supertest |

## 🏗️ Architecture

```text
MiniLedger/
├── backend/
│   ├── src/
│   │   ├── config/       # Environment parsing and validation
│   │   ├── db/           # PostgreSQL connection pool
│   │   ├── middleware/   # Authentication, validation, errors, receipt upload
│   │   ├── routes/       # Auth, loans, summary, health
│   │   ├── services/     # Authentication and loan business logic
│   │   ├── app.ts        # Express application and API routes
│   │   └── index.ts      # Server entry point
│   ├── tests/            # Backend integration tests
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── mobile/
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # Reusable interface components
│   │   ├── navigation/   # Authentication and screen flow
│   │   ├── screens/      # Login, OTP, dashboard, add loan
│   │   ├── theme/        # Colors and design tokens
│   │   ├── types/
│   │   └── utils/        # Currency, date, and storage helpers
│   ├── App.tsx
│   ├── app.json
│   └── package.json
└── README.md
```

### Color palette

| Token | Color | Use |
|---|---|---|
| Cream | `#F8F4E1` | Main backgrounds |
| Warm taupe | `#AF8F6F` | Secondary accents and borders |
| Earthy brown | `#74512D` | Buttons and key actions |
| Dark espresso | `#543310` | Headings and primary text |
| Overdue | `#9C0006` | Overdue status |
| Repaid | `#1B5E20` | Repaid status |

## 🚀 Getting started locally

### Prerequisites
- Node.js and npm.
- PostgreSQL, unless using a remote PostgreSQL database.
- An Expo-supported browser, Android device/emulator, or iOS simulator for mobile testing.

### 1. Clone the repository

```bash
git clone https://github.com/varunigabv2025/MiniLedger.git
cd MiniLedger
```

### 2. Configure the backend

```bash
cd backend
npm ci
```

Create a local environment file from the template:

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS/Linux**
```bash
cp .env.example .env
```

Update `.env` with your local PostgreSQL credentials or a `DATABASE_URL`, plus a private development `JWT_SECRET`. Never commit `.env`.

Create the database and schema described in [Database schema](#-database-schema), then start the API:

```bash
npm run dev
```

By default the API listens on `http://localhost:5000`. Check [http://localhost:5000/health](http://localhost:5000/health) and [http://localhost:5000/health/db](http://localhost:5000/health/db).

### 3. Run the Expo app

Open a second terminal:

```bash
cd mobile
npm ci
```

For a local web session, set the API URL in the mobile app's environment (for example, create `mobile/.env` containing `EXPO_PUBLIC_API_URL=http://localhost:5000/api`) and run:

```bash
npx expo start
```

Press `w` to open the web build, or follow the Expo CLI prompts for a device or emulator. On a physical phone, `localhost` means the phone itself; use your computer's LAN IP for local testing on the same Wi-Fi, or use the deployed API URL.

For the deployed website and Android build, use:

```env
EXPO_PUBLIC_API_URL=https://miniledger-mm1e.onrender.com/api
```

Expo embeds `EXPO_PUBLIC_*` values into the client bundle at build time. This variable is a public API URL; do not put database credentials, the JWT signing key, or other secrets in it.

## 🔐 Environment variables

Backend variables are read from `backend/.env` locally and from the hosting provider's environment-variable settings in production.

| Variable | Required / default | Purpose |
|---|---|---|
| `NODE_ENV` | Defaults to `development` | Runtime mode; use `production` on Render |
| `PORT` | Defaults to `5000`; Render assigns this automatically | HTTP port |
| `DATABASE_URL` | Optional if individual `DB_*` values are supplied | PostgreSQL connection string; use the Neon connection string in production |
| `DB_HOST` | `localhost` | Local database host when not using `DATABASE_URL` |
| `DB_PORT` | `5432` | Local database port |
| `DB_NAME` | `miniledger` | Local database name |
| `DB_USER` | `postgres` | Local database user |
| `DB_PASSWORD` | Empty by default; configure locally | Local database password |
| `JWT_SECRET` | Required outside test mode | Private JWT signing secret; generate a unique production value |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime |
| `OTP_EXPIRY_MINUTES` | `5` | OTP validity period |

The mobile app uses `EXPO_PUBLIC_API_URL` to choose the API base URL. The deployed base is `https://miniledger-mm1e.onrender.com/api`.

## 🗄️ Database schema

MiniLedger uses the PostgreSQL `public` schema with three tables:

- `users`: user ID, unique phone number, creation time.
- `otp_codes`: phone number, hashed OTP, expiry, creation time.
- `loans`: owner user ID, friend name, amount, due date, repayment state/timestamp, creation time, optional receipt filename and MIME type.

For a fresh database, the following schema is compatible with the API and includes receipt metadata. Apply it to the intended database only. Do **not** drop or recreate tables on an existing installation.

```sql
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.otp_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(15) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.loans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_name VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    is_repaid BOOLEAN DEFAULT FALSE,
    repaid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    receipt_filename VARCHAR(255),
    receipt_mimetype VARCHAR(50)
);
```

If you created the core tables before adding receipt uploads, add the receipt metadata columns with this non-destructive migration:

```sql
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS receipt_filename VARCHAR(255);

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS receipt_mimetype VARCHAR(50);
```

The currently deployed Neon database was provisioned separately for this project. Check the selected Neon database and table columns before applying SQL; these statements do not migrate old records from a separate local PostgreSQL installation.

## 📡 API reference

The production API prefix is `https://miniledger-mm1e.onrender.com/api`. Authenticated endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | No | Basic API health |
| `GET` | `/health/db` | No | Check PostgreSQL connectivity |
| `POST` | `/api/auth/request-otp` | No | Request a mock OTP; body: `{ "phone": "9876543210" }` |
| `POST` | `/api/auth/verify-otp` | No | Verify OTP; body: `{ "phone": "9876543210", "otp": "123456" }` |
| `POST` | `/api/auth/demo-login` | No | Sign in to the isolated recruiter demo account |
| `POST` | `/api/auth/demo-reset` | Demo token | Restore sample demo loans |
| `GET` | `/api/loans` | Yes | List only the current user's loans |
| `POST` | `/api/loans` | Yes | Create a loan |
| `PATCH` | `/api/loans/:id/repay` | Yes | Mark a loan as repaid |
| `POST` | `/api/loans/:id/receipt` | Yes | Upload a receipt using multipart field `receipt` |
| `GET` | `/api/loans/:id/receipt` | Yes | Stream the loan's receipt image |
| `GET` | `/api/summary` | Yes | Get current user's loan totals |

### Create loan request example

```http
POST /api/loans
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "friendName": "Aarav",
  "amount": 1500,
  "dueDate": "2026-12-15"
}
```

The amount must be positive and the due date must be a valid calendar date in `YYYY-MM-DD` format. The API returns validation errors for malformed data.

## 🧪 Testing

From the backend directory:

```bash
npm test
npm run build
```

The project verification reported **75 tests across six suites passing**:

| Suite | Coverage | Tests |
|---|---|---:|
| `health.test.ts` | Health endpoints and database ping | 3 |
| `auth.test.ts` | OTP request/verification, expiry, throttling, JWT | 11 |
| `loan.test.ts` | Loan creation, repayment, ordering, summary | 21 |
| `receipt.test.ts` | Upload validation, retrieval, user isolation | 13 |
| `demo.test.ts` | Demo login, sample seeding, isolation, reset | 11 |
| `dueDate.test.ts` | Valid dates, leap years, invalid calendar dates | 16 |
| **Total** | | **75** |

These are the latest reported local verification results; run the commands above to verify the current checkout.

For the mobile app, run:

```bash
npx tsc --noEmit
npx expo-doctor
```

## ☁️ Cloud deployment

### Database — Neon

1. Create a PostgreSQL project and select the correct branch and database.
2. Apply the schema or migrations to that database.
3. Copy its connection string from Neon's **Connect** dialog.
4. Store the connection string in the backend host's private `DATABASE_URL` variable. Never commit it to GitHub.

### Backend — Render

This repository contains the Express backend in `backend/`.

| Render setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |

Set these variables in Render's service settings:

- `NODE_ENV=production`
- `DATABASE_URL=<private Neon connection string>`
- `JWT_SECRET=<strong, randomly generated private secret>`
- `JWT_EXPIRES_IN=7d`
- `OTP_EXPIRY_MINUTES=5`

Render provides `PORT`. After deployment, verify both `/health` and `/health/db`.

### Web app — Vercel

The Expo web app is in `mobile/`.

| Vercel setting | Value |
|---|---|
| Root Directory | `mobile` |
| Framework Preset | Other |
| Build Command | `npx expo export --platform web` |
| Output Directory | `dist` |
| Install Command | Default detected npm install, or `npm ci` |

Add `EXPO_PUBLIC_API_URL=https://miniledger-mm1e.onrender.com/api` as a **Production** environment variable, then deploy. Redeploy after changing an environment variable because Expo reads it during the build.

### Android APK — Expo EAS Build

An APK is the installable Android artifact; it is separate from the web deployment. To build from the local mobile workspace, make sure the Android package ID and `mobile/eas.json` preview APK profile are present and committed before building:

```bash
cd mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Choose to create/link the EAS project if prompted. Generate a new Android keystore if you do not already have one you need to reuse. When the build finishes, use the APK URL returned by EAS. A public APK URL can be added here once a successful build is available.

## 🔒 Security and known limitations

- All user loan reads, writes, repayments, summaries, and receipt operations are scoped to the authenticated user's ID.
- JWT signing secrets and database credentials belong only in backend environment variables.
- Demo login is intentionally public and uses a shared account with sample data. Do not store real or sensitive financial data in it.
- OTP is mock-only; the server does not send SMS. The OTP is emitted to backend runtime logs for development/evaluation.
- Receipt images currently use local filesystem storage in `backend/uploads/receipts/`. This is suitable for local demos, but ephemeral cloud filesystems may lose uploaded images on restarts or redeployments. Persistent production storage should use object storage (for example, S3 or Supabase Storage).
- Free hosting tiers may sleep, have resource limits, or change their terms. Check provider dashboards for current limits.
- Google Play Store publication is separate from generating and sharing an APK.

## 🗺️ Possible future improvements

- Real SMS OTP provider.
- Persistent object storage for receipt images.
- Reminder notifications for approaching and overdue due dates.
- Additional filtering, export, and reporting capabilities.
