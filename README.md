# Healthcare Appointment & Follow-up Manager

A multi-portal healthcare platform for **Patients**, **Doctors**, and an **Admin** — covering appointment booking, AI-generated pre-visit and post-visit summaries, medication reminders, and automated email + Google Calendar notifications.

**LLM Provider:** Mistral AI (`mistral-large-latest`)
**Database:** TiDB (MySQL-compatible, distributed SQL)

> Assumption: This README assumes a Node.js/Express backend, React frontend, Prisma ORM (TiDB is MySQL-wire-compatible so Prisma's MySQL connector works natively), BullMQ + Redis for background jobs, and Nodemailer for email. Swap any of these for your actual stack — the flow, schema, and prompts below stay the same.

---

## Table of Contents

- [Preview / Screenshots](#preview--screenshots)
- [1. Project Execution Flow](#1-project-execution-flow)
- [2. Tech Stack](#2-tech-stack)
- [3. Folder Structure](#3-folder-structure)
- [4. Setup Guide](#4-setup-guide)
- [5. Environment Variables](#5-environment-variables-envexample)
- [6. Database Schema (TiDB)](#6-database-schema-tidb)
- [7. API Documentation](#7-api-documentation)
- [8. Mistral AI LLM Integration](#8-mistral-ai-llm-integration)
- [9. Google Calendar Setup](#9-google-calendar-setup-oauth-20)
- [10. Slot Conflict & Double-Booking Prevention](#10-slot-conflict--double-booking-prevention)
- [11. Notification Reliability](#11-notification-reliability-email--calendar)
- [12. Background Jobs](#12-background-jobs)
- [13. Deployment](#13-deployment)

---

## Preview / Screenshots

<p align="center">
  <img src="images/login_portal.png" alt="Login Portal" width="90%" /><br/>
  <strong>Login Portal</strong> — Provides quick access login shortcuts for Patient, Doctor, and Admin roles.
</p>

<p align="center">
  <img src="images/patient_portal.png" alt="Patient Portal" width="90%" /><br/>
  <strong>Patient Portal</strong> — Live booking flow, upcoming appointments with AI pre-visit briefs, and calendar synchronization details.
</p>

<p align="center">
  <img src="images/doctor_portal.png" alt="Doctor Portal" width="90%" /><br/>
  <strong>Doctor Portal</strong> — Appointment queue sorted by AI-computed urgency, real-time triage guidelines, clinical notes, and prescription input.
</p>

---

## 1. Project Execution Flow

This section walks through exactly how the system behaves end-to-end, in the order things actually happen.

### 1.1 Admin Flow
1. Admin logs in (role = `admin`).
2. Admin creates a **doctor profile**: name, specialisation, working hours (e.g. Mon–Fri, 10:00–17:00), slot duration (e.g. 15 min), and consultation fee.
3. Admin can mark **leave days** for a doctor.
   - If leave is marked on a date that already has confirmed bookings → system automatically triggers the **leave-conflict job** (see §1.4).
4. Admin can view all doctors, patients, and appointment logs from a dashboard.

### 1.2 Patient Flow
1. Patient registers/logs in (role = `patient`).
2. Patient searches doctors by **specialisation** and **availability**.
3. Patient selects a doctor → system shows **live open slots** for the next N days (computed from working hours − leave days − already-booked slots − active holds).
4. Patient selects a slot → backend places a **temporary hold** (see §10.2) → patient is redirected to the **symptom form**.
5. Patient fills symptoms (free text + structured fields: duration, severity, existing conditions).
6. On submit:
   - Backend calls **Mistral AI** with the pre-visit prompt → generates `urgencyLevel`, `chiefComplaint`, `suggestedQuestions`.
   - Appointment is confirmed, hold is converted into a permanent booking row.
   - Booking confirmation email sent to patient + doctor.
   - Google Calendar event created on both patient's and doctor's calendars.
7. Patient receives **reminder emails** (24h and 1h before appointment) via the scheduler.
8. After the visit, once the doctor submits notes, the patient receives a **post-visit summary** email with medication schedule.
9. Patient receives **medication reminder emails/notifications** on the frequency parsed from the prescription (e.g. "twice daily for 5 days").

### 1.3 Doctor Flow
1. Doctor logs in (role = `doctor`).
2. Doctor sees today's/upcoming appointments, each showing the **AI pre-visit summary** (urgency level + chief complaint + suggested questions) instead of raw symptom text.
3. Doctor can filter/sort appointments by urgency (High-urgency cases surfaced first).
4. After the consultation, doctor submits **clinical notes + prescription** (drug name, dosage, frequency, duration).
5. Backend calls **Mistral AI** with the post-visit prompt → generates a patient-friendly summary.
6. Post-visit summary + prescription is stored, patient is notified by email.
7. Prescription frequency is parsed into a **medication reminder schedule** and queued as background jobs.

### 1.4 System / Background Flow
- **Booking**: request → validate → acquire slot lock/hold → confirm → email + calendar (async, queued).
- **Leave conflict**: admin marks leave → job finds all confirmed appointments on that date for that doctor → notifies each patient by email (and optionally SMS) with a rebooking link → cancels/updates the corresponding calendar events.
- **Reminders**: cron job runs every few minutes, finds appointments starting in ~24h / ~1h, sends reminder emails.
- **Medication reminders**: cron job checks active prescriptions, sends a reminder at each scheduled dose time until the course ends.
- **Email retries**: every outbound email is queued; failures are retried with exponential backoff (max 5 attempts), then logged to a `notification_failures` table for manual review.
- **LLM failure handling**: if Mistral AI call fails or times out, the booking/notes-submission still succeeds — the summary field is stored as `null` with a `status = "pending_ai"` flag, and a retry job attempts regeneration later. The doctor/patient sees the raw text with a "summary generation in progress" note instead of a blocked flow.

```
Patient                Backend                  Mistral AI            Email/Calendar
   |--- book slot ------->|
   |<-- hold confirmed ---|
   |--- submit symptoms ->|
   |                      |--- pre-visit prompt --->|
   |                      |<-- urgency + summary ----|
   |                      |--- confirm booking ------------------------->|
   |<-- confirmation ------|<---------------------------------------------|
```

---

## 2. Tech Stack

| Layer            | Choice                                              |
|-------------------|-----------------------------------------------------|
| Frontend          | React + Vite, React Router, Axios                   |
| Backend            | Node.js + Express (REST API)                        |
| Database           | **TiDB** (MySQL-compatible, distributed SQL)         |
| ORM                | Prisma (MySQL connector)                             |
| Auth                | JWT + bcrypt, role-based middleware                  |
| LLM                | **Mistral AI API** (`mistral-large-latest`)          |
| Email               | Nodemailer (SMTP) / SendGrid                         |
| Calendar            | Google Calendar API (OAuth 2.0)                      |
| Background jobs     | BullMQ + Redis                                       |
| Hosting             | Render / Railway / Vercel (frontend)                 |

---

## 3. Folder Structure

```
healthcare-appointment-manager/
├── backend/
│   ├── src/
│   │   ├── config/            # db, redis, mistral, google clients
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/        # auth, role-guard, error handler
│   │   ├── services/
│   │   │   ├── mistral.service.js
│   │   │   ├── email.service.js
│   │   │   ├── calendar.service.js
│   │   │   └── slot.service.js
│   │   ├── jobs/               # BullMQ workers + schedulers
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── app.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── portals/
│   │   │   ├── patient/
│   │   │   ├── doctor/
│   │   │   └── admin/
│   │   ├── components/
│   │   └── api/
│   └── package.json
├── docs/
│   ├── api-docs.md
│   └── system-design.md
└── README.md
```

---

## 4. Setup Guide

### 4.1 Prerequisites
- Node.js ≥ 18
- A TiDB cluster (TiDB Cloud free tier, or local TiDB via `tiup playground`)
- Redis instance (Upstash/Redis Cloud free tier, or local)
- Mistral AI API key ([console.mistral.ai](https://console.mistral.ai))
- Google Cloud project with Calendar API enabled
- SMTP credentials or SendGrid API key

### 4.2 Steps

```bash
# 1. Clone
git clone <repo-url>
cd healthcare-appointment-manager

# 2. Backend setup
cd backend
cp .env.example .env       # fill in real values
npm install
npx prisma generate
npx prisma migrate deploy   # applies schema to TiDB
npm run dev                 # starts API on http://localhost:5000

# 3. Frontend setup
cd ../frontend
cp .env.example .env
npm install
npm run dev                 # starts app on http://localhost:5173

# 4. Background workers (separate process)
cd ../backend
npm run worker               # starts BullMQ workers (reminders, retries, leave-conflict)
```

### 4.3 Seeding (optional)
```bash
npx prisma db seed   # creates a sample admin, doctor, and patient
```

---

## 5. Environment Variables (`.env.example`)

```env
# --- Server ---
PORT=5000
NODE_ENV=development
JWT_SECRET=replace_with_a_long_random_string
CLIENT_URL=http://localhost:5173

# --- TiDB Database ---
# Format: mysql://<user>:<password>@<host>:<port>/<database>?sslaccept=strict
DATABASE_URL="mysql://username:password@gateway01.region.prod.aws.tidbcloud.com:4000/healthcare?sslaccept=strict"

# --- Redis (BullMQ) ---
REDIS_URL=redis://localhost:6379

# --- Mistral AI ---
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_MODEL=mistral-large-latest
MISTRAL_TIMEOUT_MS=15000

# --- Email (choose one) ---
EMAIL_PROVIDER=smtp          # smtp | sendgrid
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
SENDGRID_API_KEY=
EMAIL_FROM="Clinic Name <no-reply@clinic.com>"

# --- Google Calendar OAuth ---
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# --- Slot hold ---
SLOT_HOLD_TTL_SECONDS=300     # how long a slot is reserved during symptom-form fill-out
```

---

## 6. Database Schema (TiDB)

TiDB is MySQL wire-compatible, so standard InnoDB-style DDL applies. Key tables:

```sql
-- Users (shared auth table)
CREATE TABLE users (
  id            BIGINT AUTO_RANDOM PRIMARY KEY,   -- AUTO_RANDOM avoids TiDB hotspot writes
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','doctor','patient') NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctor profile (1:1 with users where role='doctor')
CREATE TABLE doctors (
  id               BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id          BIGINT NOT NULL,
  specialisation   VARCHAR(120) NOT NULL,
  slot_duration_min INT NOT NULL DEFAULT 15,
  working_hours    JSON NOT NULL,     -- {"mon":["10:00","17:00"], ...}
  consultation_fee DECIMAL(10,2),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_specialisation (specialisation)
);

-- Doctor leave days
CREATE TABLE doctor_leaves (
  id          BIGINT AUTO_RANDOM PRIMARY KEY,
  doctor_id   BIGINT NOT NULL,
  leave_date  DATE NOT NULL,
  reason      VARCHAR(255),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  UNIQUE KEY uq_doctor_leave (doctor_id, leave_date)
);

-- Appointment slots (pre-generated or computed on the fly) + booking state
CREATE TABLE appointments (
  id               BIGINT AUTO_RANDOM PRIMARY KEY,
  doctor_id        BIGINT NOT NULL,
  patient_id       BIGINT NOT NULL,
  slot_start       DATETIME NOT NULL,
  slot_end         DATETIME NOT NULL,
  status           ENUM('held','confirmed','cancelled','completed','leave_cancelled')
                    NOT NULL DEFAULT 'held',
  hold_expires_at  DATETIME NULL,           -- only set while status='held'
  google_event_id_patient VARCHAR(255),
  google_event_id_doctor  VARCHAR(255),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (patient_id) REFERENCES users(id),
  -- Prevents two CONFIRMED bookings on the same doctor+slot (see §10.1)
  UNIQUE KEY uq_doctor_slot_confirmed (doctor_id, slot_start, status)
);

-- Pre-visit symptom form + AI summary
CREATE TABLE symptom_forms (
  id               BIGINT AUTO_RANDOM PRIMARY KEY,
  appointment_id   BIGINT NOT NULL UNIQUE,
  raw_symptoms     TEXT NOT NULL,
  duration_days    INT,
  severity         ENUM('mild','moderate','severe'),
  urgency_level    ENUM('Low','Medium','High'),
  chief_complaint  VARCHAR(255),
  suggested_questions JSON,
  ai_status        ENUM('pending','ok','failed') DEFAULT 'pending',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Post-visit notes, prescription, AI patient summary
CREATE TABLE visit_notes (
  id                BIGINT AUTO_RANDOM PRIMARY KEY,
  appointment_id    BIGINT NOT NULL UNIQUE,
  clinical_notes    TEXT NOT NULL,
  prescription      JSON NOT NULL,     -- [{drug, dosage, frequency, duration_days}]
  patient_summary   TEXT,
  ai_status         ENUM('pending','ok','failed') DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Medication reminder schedule (expanded from prescription.frequency)
CREATE TABLE medication_reminders (
  id             BIGINT AUTO_RANDOM PRIMARY KEY,
  visit_note_id  BIGINT NOT NULL,
  patient_id     BIGINT NOT NULL,
  drug_name      VARCHAR(255) NOT NULL,
  scheduled_at   DATETIME NOT NULL,
  sent           BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (visit_note_id) REFERENCES visit_notes(id),
  INDEX idx_scheduled_pending (scheduled_at, sent)
);

-- Notification log + retry tracking
CREATE TABLE notifications (
  id            BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  type          ENUM('booking_confirmation','reminder','cancellation','leave_notice','medication') NOT NULL,
  channel       ENUM('email','calendar') NOT NULL,
  status        ENUM('queued','sent','failed') DEFAULT 'queued',
  attempts      INT DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_attempts (status, attempts)
);
```

**TiDB-specific notes:**
- `AUTO_RANDOM` is used instead of `AUTO_INCREMENT` on primary keys to avoid write hotspots on TiDB's distributed storage layer.
- The `uq_doctor_slot_confirmed` unique index is the core double-booking guard — TiDB enforces uniqueness constraints transactionally across nodes.
- TiDB supports standard `BEGIN / COMMIT` transactions with SNAPSHOT isolation, used for the slot-hold → confirm flow (see §10).

---

## 7. API Documentation

Base URL: `/api/v1`

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register patient/doctor/admin |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/google` | Start Google OAuth (calendar access) |
| GET | `/auth/google/callback` | OAuth callback, stores refresh token |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/doctors` | Create doctor profile |
| PUT | `/admin/doctors/:id` | Update doctor (hours, specialisation, slot duration) |
| POST | `/admin/doctors/:id/leaves` | Mark a leave day → triggers conflict job |
| GET | `/admin/appointments` | View all appointments |

### Patient
| Method | Endpoint | Description |
|---|---|---|
| GET | `/doctors?specialisation=&date=` | Search doctors |
| GET | `/doctors/:id/slots?date=` | Get open slots for a date |
| POST | `/appointments/hold` | Place a temporary hold on a slot |
| POST | `/appointments/:id/confirm` | Submit symptoms + confirm booking |
| POST | `/appointments/:id/cancel` | Cancel appointment |
| GET | `/appointments/me` | List own appointments |
| GET | `/appointments/:id/summary` | Get post-visit summary |

### Doctor
| Method | Endpoint | Description |
|---|---|---|
| GET | `/doctor/appointments?date=` | List appointments with AI pre-visit summary |
| POST | `/doctor/appointments/:id/notes` | Submit clinical notes + prescription |

### Sample: Confirm Appointment
```
POST /api/v1/appointments/42/confirm
{
  "symptoms": "Fever for 3 days, mild headache, no cough",
  "durationDays": 3,
  "severity": "moderate"
}

Response 200:
{
  "appointmentId": 42,
  "status": "confirmed",
  "aiSummary": {
    "urgencyLevel": "Medium",
    "chiefComplaint": "Persistent fever with headache",
    "suggestedQuestions": [
      "Any recent travel or exposure to illness?",
      "Any medication taken so far?",
      "Any accompanying symptoms like rash or body ache?"
    ]
  }
}
```

Full endpoint list with request/response schemas lives in `docs/api-docs.md`.

---

## 8. Mistral AI LLM Integration

### 8.1 Client setup
```js
// services/mistral.service.js
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

export async function callMistral(prompt) {
  const response = await Promise.race([
    client.chat.complete({
      model: process.env.MISTRAL_MODEL,
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
      temperature: 0.2,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Mistral timeout")), Number(process.env.MISTRAL_TIMEOUT_MS))
    ),
  ]);
  return JSON.parse(response.choices[0].message.content);
}
```

### 8.2 Pre-visit prompt (patient symptoms → doctor summary)
```
You are a clinical triage assistant. Analyse the symptoms below and return ONLY a JSON object
with this exact shape, no extra text:

{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "<one-line summary>",
  "suggestedQuestions": ["<question 1>", "<question 2>", "<question 3>"]
}

Symptoms: <symptoms>
Duration: <durationDays> days
Self-reported severity: <severity>
```

### 8.3 Post-visit prompt (clinical notes → patient summary)
```
You are a medical communication assistant. Convert the clinical notes and prescription below
into a warm, plain-language summary a patient with no medical background can understand.
Return ONLY a JSON object:

{
  "summary": "<2-3 sentence plain-language explanation of the diagnosis>",
  "medicationSchedule": [
    { "drug": "<name>", "instructions": "<plain-language dosing instructions>" }
  ],
  "followUpSteps": ["<step 1>", "<step 2>"]
}

Clinical notes: <notes>
Prescription: <prescription_json>
```

### 8.4 Failure handling
- Wrapped in try/catch with a hard timeout (`MISTRAL_TIMEOUT_MS`).
- On failure: the appointment/notes record is still saved; `ai_status` is set to `failed`, the raw symptoms/notes remain visible to the doctor/patient, and a BullMQ retry job re-attempts the call (max 3 retries, exponential backoff) before falling back to a static "AI summary unavailable — please review raw notes" message.
- All Mistral calls are logged (prompt hash, latency, success/failure) for observability, without storing raw PHI in logs.

---

## 9. Google Calendar Setup (OAuth 2.0)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. Enable the **Google Calendar API** under "APIs & Services → Library".
3. Configure the **OAuth consent screen** (External, add test users while in development).
4. Under "Credentials" → **Create OAuth Client ID** → type: Web application.
   - Authorized redirect URI: `http://localhost:5000/api/auth/google/callback` (and your production URL).
5. Copy the generated **Client ID** and **Client Secret** into `.env`.
6. On first login, patient/doctor is redirected to Google's consent screen; the returned `refresh_token` is stored (encrypted) against their user record.
7. Backend uses the stored refresh token to silently obtain access tokens and create/update/delete events via `calendar.events.insert / update / delete` on booking, reschedule, and cancellation.
8. If a user revokes calendar access, calendar calls fail silently (logged) and email remains the source of truth — booking flow is never blocked by calendar failures.

---

## 10. Slot Conflict & Double-Booking Prevention

### 10.1 Database-level guard
The `appointments` table has a unique constraint on `(doctor_id, slot_start, status)` scoped to confirmed bookings, so even under a race condition, TiDB's transactional engine rejects a second `CONFIRMED` row for the same doctor+slot — the losing request gets a clean `409 Conflict`.

### 10.2 Slot hold mechanism
1. When a patient selects a slot, the backend inserts a row with `status='held'` and `hold_expires_at = now() + SLOT_HOLD_TTL_SECONDS`, inside a transaction that also re-checks no confirmed/unexpired-held row exists for that slot.
2. This gives the patient a window (default 5 minutes) to complete the symptom form.
3. On successful symptom submission, the hold is atomically converted to `status='confirmed'`.
4. A scheduled job sweeps expired holds (`hold_expires_at < now()` and `status='held'`) every minute and releases them back to available.
5. Concurrent booking attempts on the same slot are naturally serialized by the unique index + transaction — the second request fails fast and the frontend prompts the patient to pick another slot.

### 10.3 Doctor leave conflicts
When a leave day is marked:
1. Query all `confirmed` appointments for that doctor on that date.
2. For each: mark `status='leave_cancelled'`, delete the associated Google Calendar events, and queue a `leave_notice` email/notification with a direct rebooking link.
3. Action is logged in `notifications` for auditability.

---

## 11. Notification Reliability (Email & Calendar)

- Every notification (email or calendar mutation) is written to the `notifications` table with `status='queued'` before being dispatched — nothing is fire-and-forget.
- A BullMQ worker consumes the queue; on success marks `sent`, on failure increments `attempts` and retries with exponential backoff (1m → 5m → 15m → 1h → 6h, max 5 attempts).
- After exhausting retries, status is set to `failed` and surfaced on the admin dashboard for manual resolution.
- Calendar failures and email failures are tracked independently per appointment, so a Calendar API outage never blocks the email confirmation (and vice versa).

---

## 12. Background Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `sweepExpiredHolds` | every 1 min | Release expired slot holds |
| `sendAppointmentReminders` | every 5 min | Email reminders at 24h / 1h before visit |
| `sendMedicationReminders` | every 5 min | Send due medication reminders |
| `retryFailedNotifications` | every 5 min | Retry queued/failed notifications |
| `retryFailedAiSummaries` | every 10 min | Re-attempt failed Mistral AI calls |

---

## 13. Deployment

- **Backend**: Render or Railway (Node service) — set all `.env` values in the platform's environment variable settings, add a separate worker service/process for BullMQ jobs.
- **Frontend**: Vercel — set `VITE_API_BASE_URL` to the deployed backend URL.
- **Database**: TiDB Cloud (Serverless tier is sufficient for demo/eval purposes) — whitelist the backend host's IP or use TiDB Cloud's connectivity options.
- **Redis**: Upstash or Redis Cloud free tier.
- Run `npx prisma migrate deploy` against the production `DATABASE_URL` as part of the deploy step.

---

## License
MIT
