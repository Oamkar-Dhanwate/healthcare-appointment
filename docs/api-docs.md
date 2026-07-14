# Healthcare Appointment Manager — API Documentation

**Base URL:** `/api/v1`

---

## Authentication

All protected endpoints require a `Bearer` token in the `Authorization` header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Auth Endpoints

### POST `/auth/register`
Register a new user.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe",
  "phone": "+919876543210",
  "role": "patient"
}
```
**Response:** `201 Created`
```json
{
  "message": "Registration successful",
  "token": "<JWT>",
  "user": { "id": 1, "email": "...", "fullName": "...", "role": "patient" }
}
```

---

### POST `/auth/login`
Login and receive a JWT token.

**Body:**
```json
{ "email": "user@example.com", "password": "securepassword" }
```
**Response:** `200 OK` — same shape as register.

---

### GET `/auth/me` 🔒
Returns the authenticated user's profile.

---

### GET `/auth/google` 🔒
Returns a URL to redirect the user to Google's OAuth consent screen.

### GET `/auth/google/callback`
Handles Google's OAuth callback. Stores the refresh token.

---

## Admin Endpoints 🔒 (role: `admin`)

### GET `/admin/dashboard`
Returns platform stats.

### POST `/admin/doctors`
Create a doctor profile.

**Body:**
```json
{
  "email": "doctor@clinic.com",
  "password": "securepass",
  "fullName": "Dr. Smith",
  "specialisation": "Cardiology",
  "slotDurationMin": 15,
  "workingHours": {"mon":["10:00","17:00"],"tue":["10:00","17:00"]},
  "consultationFee": 500
}
```

### PUT `/admin/doctors/:id`
Update a doctor's profile.

### GET `/admin/doctors`
List all doctors.

### POST `/admin/doctors/:id/leaves`
Mark a leave day. Triggers conflict resolution.

**Body:**
```json
{ "leaveDate": "2026-07-15", "reason": "Conference" }
```

### GET `/admin/appointments?status=&date=&page=&limit=`
List all appointments with pagination.

### GET `/admin/notifications/failed`
List failed notifications for manual review.

---

## Patient Endpoints

### GET `/doctors?specialisation=&date=`
Search doctors (public).

### GET `/doctors/:id/slots?date=`
Get available slots for a doctor on a date (public).

### POST `/appointments/hold` 🔒 (role: `patient`)
Hold a slot temporarily.

**Body:**
```json
{
  "doctorId": 1,
  "slotStart": "2026-07-15T10:00:00.000Z",
  "slotEnd": "2026-07-15T10:15:00.000Z"
}
```

### POST `/appointments/:id/confirm` 🔒 (role: `patient`)
Submit symptoms and confirm appointment.

**Body:**
```json
{
  "symptoms": "Fever for 3 days, mild headache",
  "durationDays": 3,
  "severity": "moderate"
}
```

**Response:**
```json
{
  "appointmentId": 42,
  "status": "confirmed",
  "aiSummary": {
    "urgencyLevel": "Medium",
    "chiefComplaint": "Persistent fever with headache",
    "suggestedQuestions": ["Any recent travel?", "Medication taken?"]
  }
}
```

### POST `/appointments/:id/cancel` 🔒 (role: `patient`)
Cancel an appointment.

### GET `/appointments/me` 🔒 (role: `patient`)
List own appointments.

### GET `/appointments/:id/summary` 🔒 (role: `patient`)
Get post-visit summary.

---

## Doctor Endpoints 🔒 (role: `doctor`)

### GET `/doctor/appointments?date=&sortByUrgency=true`
List appointments with AI pre-visit summaries.

### GET `/doctor/appointments/:id`
Get detailed appointment view.

### POST `/doctor/appointments/:id/notes`
Submit clinical notes and prescription.

**Body:**
```json
{
  "clinicalNotes": "Patient presents with...",
  "prescription": [
    { "drug": "Paracetamol", "dosage": "500mg", "frequency": "twice daily", "duration_days": 5 }
  ]
}
```

---

## Health Check

### GET `/api/health`
```json
{ "status": "ok", "service": "Healthcare Appointment Manager" }
```
