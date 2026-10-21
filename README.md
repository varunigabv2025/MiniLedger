# MiniLedger 💳

A full-stack, personal finance and peer-to-peer loan tracking application built for the Full Stack Development internship assignment.

---

## 📌 Project Overview
MiniLedger helps individuals track peer loans lent to friends and acquaintances. It provides clear visibility over outstanding balances, repayment statuses, and overdue payments with a modern mobile interface and a secure, transactional PostgreSQL backend.

---

## 🎨 Design System & Palette

MiniLedger follows a warm, sophisticated, minimalist personal-finance aesthetic using a strict 4-color foundation:

| Token | HEX Code | Role & Usage |
| :--- | :--- | :--- |
| **Cream** | `#F8F4E1` | Primary screen background, light surfaces, and spacious cards |
| **Warm Taupe** | `#AF8F6F` | Secondary surfaces, muted accents, decorative elements, and border dividers |
| **Earthy Brown** | `#74512D` | Primary interactive buttons, secondary headings, active navigation, and icons |
| **Dark Espresso** | `#543310` | Primary text, prominent headings, portfolio hero card, and key metrics |

### Semantic Indicators
- **Overdue Loans:** Muted red (`#9C0006`) with a clear `⚠️ OVERDUE` badge label.
- **Repaid Loans:** Muted green (`#1B5E20`) with a clear `✓ REPAID` badge label.
- **Pending Loans:** Earthy brown (`#74512D`) with a `⏳ PENDING` badge label.

---

## ⚡ Instant Recruiter Demo Access (No Setup or Terminal Required)

For evaluators and recruiters who want to explore MiniLedger immediately without configuring PostgreSQL or checking backend terminal logs:

1. Launch the mobile app (or open `http://localhost:8081` in your browser).
2. On the **Login screen**, tap the prominent **⚡ Try Demo Account** button.
3. You will immediately be authenticated via `POST /api/auth/demo-login` and directed to the Dashboard with pre-seeded sample data:
   - **Overdue Loan:** *Neha Gupta (Demo)* — ₹12,000 (highlighted in red, prioritized first).
   - **Pending Loans:** *Rohan Sharma (Demo)* (₹7,500) and *Pooja Mehta (Demo)* (₹3,200).
   - **Settled Loan:** *Vikram Malhotra (Demo)* — ₹4,500 with settlement timestamp.
   - **Live SQL Aggregation:** ₹27,200 Total Lent, ₹4,500 Repaid, ₹22,700 Outstanding, and ₹12,000 Overdue.
4. **Interactive & Resettable:**
   - Feel free to record new loans, attach receipt photos, or mark loans as repaid.
   - All actions are strictly isolated to the demo account (`+910000000000`). Real user records can never be viewed or modified.
   - Tap **🔄 Reset Data** in the top demo banner anytime to restore the clean sample state.

---

## ✨ Key Features
- **Recruiter Demo Mode:** One-click instant login without OTP, populated with rich sample loans and one-click data reset.
- **Phone Number Authentication:** Passwordless login using a mock 6-digit OTP printed securely to backend server logs.
- **Peer Loan Ledger:** Create, view, and track loans lent to friends.
- **Optional Receipt Photo Upload (Bonus Feature):**
  - Attach an optional receipt or promissory note photo (JPEG/PNG up to 5MB) when recording a loan.
  - View secure receipts directly within the app through an authenticated image viewer modal.
  - Strict row-level ownership isolation preventing other users from viewing or modifying receipts (HTTP 403 Forbidden).
  - Preserves local filesystem privacy: internal disk paths and raw image binaries are never exposed in JSON responses or server logs.
- **Overdue Prioritization:** Unpaid loans whose due date has passed are highlighted in red and ordered first.
- **Financial Summary Dashboard:** Real-time metrics for Total Lent, Total Repaid, Total Outstanding, and Overdue Amount computed directly via SQL aggregation.
- **One-Tap Repayment:** Mark outstanding loans as repaid with duplicate repayment prevention.
- **Data Isolation:** Row-level security through user-scoped queries—users can only access and manage their own financial data.
- **Session Persistence:** Cross-platform secure token storage using `expo-secure-store`.

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js (v22+)
- **Framework:** Express.js with TypeScript
- **Execution & Dev Server:** `tsx`
- **Database:** PostgreSQL 18 with `pg` connection pool
- **File Uploads:** `multer` (MIME and size validation, isolated storage)
- **Validation:** Zod
- **Security & Utilities:** `cors`, `dotenv`, `jsonwebtoken`, `bcryptjs`
- **Testing:** Jest & Supertest (47 automated integration tests)

### Mobile App
- **Framework:** React Native with Expo (SDK 58, TypeScript)
- **Image Picker:** `expo-image-picker` with client-side file size and MIME checks
- **State & Navigation:** State-driven native navigation with hardware `BackHandler` support
- **Secure Storage:** `expo-secure-store`
- **API Client:** Configurable native fetch client with automatic Bearer JWT attachment and Blob/DataURI receipt streaming
- **UI:** Custom theme system implementing the 4-color palette

---

## 🏛️ Architecture & Folder Structure

```text
MiniLedger/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variable parser and Zod validator
│   │   ├── db/              # PostgreSQL pool client and connection lifecycle
│   │   ├── middleware/      # Auth, error, upload, and Zod validation middleware
│   │   ├── routes/          # Auth, loan, and summary Express routes
│   │   ├── services/        # Business logic and database query operations
│   │   ├── app.ts           # Express app setup and middleware pipeline
│   │   └── index.ts         # Server entrypoint with graceful shutdown
│   ├── tests/               # Jest & Supertest integration tests (47 tests)
│   ├── uploads/receipts/    # Local demo storage for uploaded receipts (gitignored)
│   ├── .env.example         # Environment template
│   ├── package.json
│   └── tsconfig.json
├── mobile/
│   ├── src/
│   │   ├── api/             # API client, receipt upload, and streaming helpers
│   │   ├── components/      # Reusable UI cards, headers, inputs, and buttons
│   │   ├── navigation/      # Screen routing and session management
│   │   ├── screens/         # Login, OTP, Dashboard, and Add Loan screens
│   │   ├── theme/           # Color palette, spacing, and shadows
│   │   ├── types/           # Shared TypeScript interfaces
│   │   └── utils/           # Currency, date, and secure storage helpers
│   ├── App.tsx
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
├── README.md
└── .gitignore
```

---

## 📋 Prerequisites
- **Node.js:** v18+ (tested on v22.x)
- **npm:** v10+
- **PostgreSQL:** 18+ (running locally on port 5432)
- **Expo Go** app on iOS / Android or an emulator / web browser for mobile testing

---

## 🗄️ PostgreSQL Setup & Database Schema

The application connects to a local database named `miniledger` with the following tables in schema `public`:

```sql
-- users: user accounts identified by unique phone number
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- otp_codes: stores hashed OTPs with expiry timestamps
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- loans: peer loans tracked per user with optional receipt attachments
CREATE TABLE IF NOT EXISTS public.loans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_name VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    is_repaid BOOLEAN DEFAULT FALSE NOT NULL,
    repaid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    receipt_filename VARCHAR(255),
    receipt_mimetype VARCHAR(50)
);
```

### Safe Additive Migration
If updating an existing installation from Phase 4, the database migration is completely additive and non-destructive:
```sql
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS receipt_filename VARCHAR(255);
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS receipt_mimetype VARCHAR(50);
```

---

## ⚙️ Backend Setup & Environment Variables

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the template to create `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your PostgreSQL credentials:
   ```env
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=miniledger
   DB_USER=postgres
   DB_PASSWORD=your_actual_postgres_password
   JWT_SECRET=your_secure_jwt_secret_key
   JWT_EXPIRES_IN=7d
   OTP_EXPIRY_MINUTES=5
   ```
   > ⚠️ **Important:** Never commit the `.env` file to Git.

4. Start the development server:
   ```bash
   npm run dev
   ```
   The backend server runs at `http://localhost:5000`.

---

## 📱 Mobile App Setup & API Configuration

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   npm install
   ```

2. **Configure Backend URL in `mobile/src/api/client.ts`:**
   - **Android Emulator:** `http://10.0.2.2:5000/api` (Default for Android)
   - **iOS Simulator / Web:** `http://localhost:5000/api` (Default for iOS / Web)
   - **Physical Device (via Expo Go):** Change `DEFAULT_URL` to `http://<YOUR_COMPUTER_LAN_IP>:5000/api` (e.g. `http://192.168.1.15:5000/api`). Ensure your computer and phone are connected to the same Wi-Fi network.

3. Start Expo:
   ```bash
   npx expo start
   ```
   - Press `w` to open in your web browser.
   - Press `a` to open in Android Emulator.
   - Scan the QR code with **Expo Go** on Android/iOS.

---

## 📎 Receipt Upload Bonus Feature & Storage Strategy

### Architecture & Endpoints
- **Upload Endpoint:** `POST /api/loans/:id/receipt`
  - Accepts `multipart/form-data` with single file field `receipt`.
  - Enforces MIME validation (`image/jpeg`, `image/png`) and 5MB size limit.
  - Assigns a cryptographic random filename (e.g., `receipt_1729528000_a3f...jpg`) to prevent collisions and path traversal.
  - Updates `receipt_filename` and `receipt_mimetype` in PostgreSQL.
- **Viewing Endpoint:** `GET /api/loans/:id/receipt`
  - Protected endpoint requiring Bearer JWT.
  - Strictly verifies that `loan.user_id === req.user.userId`. Unauthorized access returns `HTTP 403 Forbidden`.
  - Streams file directly with appropriate `Content-Type` header (`res.sendFile`).
  - Never leaks local filesystem paths or binary data into API JSON payloads or server logs.

### Storage Strategy & Production Limitations
- **Current Local Strategy:** Uploaded receipts are saved to `backend/uploads/receipts/` on the local filesystem. This directory is gitignored and ideal for local offline development, testing, and assessment demo.
- **Production Cloud Considerations:** In production containerized environments (such as Docker, Kubernetes, AWS ECS, or Heroku), container local disks are ephemeral and will be wiped upon restarting or redeploying. Production implementations should replace local disk storage with cloud object storage (e.g., AWS S3, Google Cloud Storage, or Supabase Storage) using presigned upload/download URLs.

---

## 🧪 Automated Testing

Run the full integration test suite (covering health, auth/OTP, loans CRUD, repayments, duplicate repayments, summary calculations, receipt uploads, cross-user isolation, and recruiter demo accounts):
```bash
cd backend
npm test
```

### Test Suite Summary (75 passing tests):
- `health.test.ts`: Health check & PostgreSQL ping status (3 tests)
- `auth.test.ts`: Mock OTP generation, rate limits, expiry, bcrypt verification, and JWT issuance (11 tests)
- `loan.test.ts`: Loan creation, date validation, overdue sorting, duplicate repayment prevention, and SQL aggregate summary (21 tests)
- `receipt.test.ts`: Receipt file upload, MIME type filter, 5MB limit rejection, cross-user 403 isolation, and photo retrieval (13 tests)
- `demo.test.ts`: One-click recruiter demo authentication, non-duplicating sample loan seeding, strict cross-user isolation, and pristine sample data reset (11 tests)
- `dueDate.test.ts`: Calendar due-date validation, leap year checks, impossible calendar dates rejection (16 tests)

---

## 🔑 How the Mock OTP Flow Works

1. Enter your phone number on the mobile Login screen and tap **Get OTP Code**.
2. Switch to your backend server terminal. You will see a log output like:
   ```text
   [MiniLedger Mock OTP] Phone: 9876543210 | Code: 295855 (Valid for 5 min)
   ```
3. Enter `295855` into the mobile app OTP screen and tap **Verify & Continue**.
4. The backend verifies the bcrypt hash, deletes the OTP to prevent reuse, creates the user account if new, and returns a signed JWT.
5. The mobile app stores the token in secure storage and navigates to the Dashboard.

---

## 🌐 Cloud Deployment Guide (Beyond Localhost)

To share a live public demo with recruiters without requiring them to run code locally or connect to `localhost`:

### 1. Database Deployment (Free Managed PostgreSQL)
Deploy a managed PostgreSQL database using [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Render PostgreSQL](https://render.com):
1. Create a new database project named `miniledger`.
2. Open the SQL Editor and run the table creation scripts from the [PostgreSQL Setup & Database Schema](#-postgresql-setup--database-schema) section.
3. Copy your external connection string:
   ```text
   DATABASE_URL=postgres://user:password@ep-cool-fog-12345.us-east-2.aws.neon.tech/miniledger?sslmode=require
   ```

### 2. Backend Deployment (Render / Railway / Fly.io)
Deploy the Node.js + Express backend to a cloud container host:
1. Push your repository to GitHub.
2. In [Render](https://render.com), create a new **Web Service** connected to your repository.
3. Configure the service settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
4. Set Environment Variables in Render:
   ```env
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgres://user:password@host/miniledger?sslmode=require
   JWT_SECRET=your_super_strong_production_jwt_secret_key_minimum_32_characters
   JWT_EXPIRES_IN=7d
   OTP_EXPIRY_MINUTES=5
   ```
5. Deploy the service. Render will provide a public HTTPS URL (e.g., `https://miniledger-api.onrender.com`).
6. Test your public endpoint:
   ```bash
   curl https://miniledger-api.onrender.com/health
   ```

### 3. Mobile Web App Deployment (Vercel / Netlify)
Allow recruiters to access the mobile app directly via web browser without installing Expo:
1. In the `mobile` directory, create a `.env.production` file (or set the build environment variable):
   ```env
   EXPO_PUBLIC_API_URL=https://miniledger-api.onrender.com/api
   ```
2. Build the static production bundle:
   ```bash
   cd mobile
   npx expo export --platform web
   ```
3. Deploy the resulting `mobile/dist` directory to [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
4. Recruiters can open the deployed URL, tap **⚡ Try Demo Account**, and test the full live application instantly with no installation!

---

## 📝 Limitations & Future Improvements
- Production SMS gateway integration (e.g., Twilio/AWS SNS) to replace mock console OTP.
- Cloud object storage (AWS S3 / GCS) with presigned URLs for persistent, scalable receipt photo storage.
- Push notifications for upcoming and overdue loan reminders.
- Multi-currency support.

