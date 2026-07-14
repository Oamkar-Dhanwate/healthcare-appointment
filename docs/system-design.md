# Healthcare Appointment Manager — System Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Patient   │  │ Doctor   │  │ Admin    │  ← Role-based portals│
│  │ Portal    │  │ Portal   │  │ Portal   │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       └──────────────┼──────────────┘                            │
│                      │ Axios (JWT)                               │
└──────────────────────┼───────────────────────────────────────────┘
                       │ HTTP REST
┌──────────────────────┼───────────────────────────────────────────┐
│              Backend (Node.js + Express)                          │
│  ┌───────────────────┴───────────────────┐                       │
│  │           API Routes Layer             │                       │
│  │  auth │ admin │ patient │ doctor       │                       │
│  └───┬───────┬──────────┬────────┬───────┘                       │
│      │       │          │        │                                │
│  ┌───┴───┐ ┌─┴──┐  ┌───┴───┐ ┌──┴──┐                           │
│  │ Auth  │ │Slot│  │Mistral│ │Email│  ← Service Layer           │
│  │ JWT   │ │Svc │  │AI Svc │ │ Svc │                            │
│  └───┬───┘ └─┬──┘  └───┬───┘ └──┬──┘                           │
│      │       │          │        │     ┌─────────┐               │
│      └───────┼──────────┼────────┼─────┤Calendar │               │
│              │          │        │     │  Svc    │               │
│              │          │        │     └─────────┘               │
│  ┌───────────┴──────────┴────────┴───────────────┐               │
│  │              Prisma ORM (MySQL connector)      │               │
│  └──────────────────────┬────────────────────────┘               │
│                         │                                         │
│  ┌──────────────────────┴────────────────────────┐               │
│  │         BullMQ Workers (Background Jobs)       │               │
│  │  sweep │ reminders │ medication │ retry │ AI   │               │
│  └──────────────────────┬────────────────────────┘               │
│                         │                                         │
└─────────────────────────┼─────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────┴────┐     ┌──────┴─────┐    ┌─────┴─────┐
   │  TiDB   │     │   Redis    │    │ Mistral   │
   │(MySQL)  │     │  (BullMQ)  │    │ AI API    │
   └─────────┘     └────────────┘    └───────────┘
```

## Data Flow

### Appointment Booking Flow
1. Patient searches doctors → `GET /doctors?specialisation=`
2. Patient views slots → `GET /doctors/:id/slots?date=`
3. Patient holds slot → `POST /appointments/hold` (creates `held` row + TTL)
4. Patient submits symptoms → `POST /appointments/:id/confirm`
5. Backend calls Mistral AI → generates pre-visit summary
6. Appointment confirmed → email + calendar event created
7. Background cron → sends 24h + 1h reminders

### Doctor Visit Flow
1. Doctor views appointments with AI summaries → `GET /doctor/appointments`
2. Doctor examines patient (offline)
3. Doctor submits notes + prescription → `POST /doctor/appointments/:id/notes`
4. Backend calls Mistral AI → generates patient-friendly post-visit summary
5. Prescription parsed → medication reminders scheduled
6. Patient receives post-visit summary email

### Leave Conflict Flow
1. Admin marks leave → `POST /admin/doctors/:id/leaves`
2. System finds conflicting confirmed appointments
3. Appointments auto-cancelled (`leave_cancelled`)
4. Patients notified via email with rebooking link
5. Google Calendar events deleted

## Database Schema
See [schema.prisma](../backend/src/prisma/schema.prisma) for the complete schema with 8 models:
- **User** — shared auth table (admin, doctor, patient)
- **Doctor** — profile with working hours + specialisation
- **DoctorLeave** — leave day records
- **Appointment** — bookings with hold/confirm/cancel state machine
- **SymptomForm** — pre-visit symptoms + AI summary
- **VisitNote** — clinical notes + prescription + AI summary
- **MedicationReminder** — scheduled dose reminders
- **Notification** — email/calendar log with retry tracking

## Background Jobs
| Job | Interval | Purpose |
|-----|----------|---------|
| sweepExpiredHolds | 1 min | Release expired slot holds |
| sendAppointmentReminders | 5 min | 24h + 1h email reminders |
| sendMedicationReminders | 5 min | Dose-time medication reminders |
| retryFailedNotifications | 5 min | Exponential backoff retries (max 5) |
| retryFailedAiSummaries | 10 min | Re-attempt failed Mistral AI calls |
| leaveConflict | On-demand | Cancel appointments on leave day |

## Failure Handling
- **Mistral AI**: Timeout + graceful degradation. Booking never blocked. Retry job re-attempts.
- **Email**: Queued with exponential backoff (1m→5m→15m→1h→6h). Failed after 5 attempts.
- **Calendar**: Silent failure. Email remains source of truth.
- **Double Booking**: Unique constraint on `(doctor_id, slot_start, status)`. Race conditions get 409.
