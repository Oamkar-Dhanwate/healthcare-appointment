// ─── Mistral AI Service ──────────────────────────────────────────────────────
// Handles pre-visit (symptom → summary) and post-visit (notes → patient summary)
// LLM calls with timeout, retry, and graceful degradation.

import getMistralClient, {
  MISTRAL_MODEL,
  MISTRAL_TIMEOUT_MS,
} from "../config/mistral.js";

/**
 * Call Mistral AI with a prompt and return parsed JSON.
 * Implements a hard timeout and returns null on failure.
 */
async function callMistral(prompt) {
  const client = getMistralClient();
  if (!client) {
    console.warn("[Mistral] Client unavailable — skipping AI call");
    return null;
  }

  try {
    const response = await Promise.race([
      client.chat.complete({
        model: MISTRAL_MODEL,
        messages: [{ role: "user", content: prompt }],
        responseFormat: { type: "json_object" },
        temperature: 0.2,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Mistral timeout")),
          MISTRAL_TIMEOUT_MS
        )
      ),
    ]);

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error("[Mistral] Call failed:", err.message);
    return null;
  }
}

/**
 * Generate a pre-visit AI summary from patient symptoms.
 * Returns { urgencyLevel, chiefComplaint, suggestedQuestions } or null.
 */
export async function generatePreVisitSummary({
  symptoms,
  durationDays,
  severity,
}) {
  const prompt = `You are a clinical triage assistant. Analyse the symptoms below and return ONLY a JSON object
with this exact shape, no extra text:

{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "<one-line summary>",
  "suggestedQuestions": ["<question 1>", "<question 2>", "<question 3>"]
}

Symptoms: ${symptoms}
Duration: ${durationDays || "unknown"} days
Self-reported severity: ${severity || "unknown"}`;

  const aiResult = await callMistral(prompt);
  if (aiResult) return aiResult;

  // Rule-based fallback if LLM is offline/unavailable
  console.log("[Mistral] Using clinical rule-based triage fallback");
  const symLower = (symptoms || "").toLowerCase();
  
  let urgencyLevel = "Low";
  let chiefComplaint = symptoms ? `${symptoms.slice(0, 60)}${symptoms.length > 60 ? "..." : ""}` : "General checkup";
  let suggestedQuestions = [
    "Ask about duration and aggravating factors.",
    "Verify any self-treatment attempted.",
    "Review history of similar symptoms."
  ];

  // High urgency indicators
  const highIndicators = [
    "chest pain", "chest tightness", "shortness of breath", "breathing",
    "blood pressure", "160/", "170/", "180/", "150/", "blurred vision",
    "severe pain", "unconscious", "stroke", "dizziness", "nausea", "headache"
  ];
  
  const hasHighIndicator = highIndicators.some(ind => symLower.includes(ind));

  if (hasHighIndicator || severity === "severe") {
    urgencyLevel = "High";
    suggestedQuestions = [
      "Radiation to arm/jaw or neck?",
      "Current antihypertensive or cardiac medications?",
      "Consider immediate ECG or vitals check."
    ];
  } else if (severity === "moderate" || symLower.includes("pain") || symLower.includes("fever")) {
    urgencyLevel = "Medium";
    suggestedQuestions = [
      "Rate severity on 1-10 visual analog scale.",
      "Check temperature and onset speed.",
      "Are symptoms worsening with physical effort?"
    ];
  }

  return {
    urgencyLevel,
    chiefComplaint,
    suggestedQuestions
  };
}

/**
 * Generate a post-visit patient-friendly summary from clinical notes.
 * Returns { summary, medicationSchedule, followUpSteps } or null.
 */
export async function generatePostVisitSummary({
  clinicalNotes,
  prescription,
  patientName,
  symptoms,
  severity,
  durationDays,
}) {
  const prompt = `You are an experienced physician preparing a patient-friendly medical report.
Convert the clinical notes and prescription into a clear, professional, easy-to-understand medical report.
Use only the information provided. If information is insufficient, state that further evaluation is required.
Write in simple language a non-medical person can understand.

Return ONLY a valid JSON object with this exact shape (no extra text, no markdown):

{
  "patientSummary": {
    "mainComplaint": "<one-line chief complaint>",
    "duration": "<duration in days or 'unknown'>",
    "severity": "<mild | moderate | severe | unknown>"
  },
  "symptomsReported": "<short paragraph summarising reported symptoms>",
  "clinicalAssessment": "<paragraph discussing likely condition, reasoning, differential diagnoses if applicable>",
  "recommendedExaminations": ["<exam 1>", "<exam 2>"],
  "provisionalDiagnosis": "<most likely diagnosis, or 'Provisional diagnosis only. Further clinical evaluation is required.'>",
  "treatmentPlan": {
    "lifestyle": "<lifestyle advice>",
    "homeCare": "<home care recommendations>",
    "hydration": "<hydration advice>",
    "rest": "<rest advice>",
    "diet": "<diet advice>",
    "followUp": "<follow-up recommendation>"
  },
  "medicationSuggestions": [
    {
      "drug": "<generic medicine name>",
      "strength": "<strength e.g. 500mg>",
      "dose": "<dose e.g. 1 tablet>",
      "frequency": "<frequency e.g. twice daily>",
      "duration": "<duration e.g. 5 days>",
      "precautions": "<important precautions>"
    }
  ],
  "redFlagSymptoms": ["<red flag 1>", "<red flag 2>", "<red flag 3>"],
  "followUp": "<when should patient see doctor again>",
  "summary": "<2-3 sentence plain-language overall summary for the patient>",
  "followUpSteps": ["<step 1>", "<step 2>", "<step 3>"]
}

Patient Name: ${patientName || "Patient"}
Reported Symptoms: ${symptoms || "Not provided"}
Duration: ${durationDays || "unknown"} days
Self-reported Severity: ${severity || "unknown"}
Clinical Notes from Doctor: ${clinicalNotes}
Prescription: ${JSON.stringify(prescription)}`;

  const aiResult = await callMistral(prompt);

  // If AI returns result, ensure backward-compat fields exist
  if (aiResult) {
    // Build medicationSchedule from medicationSuggestions for backward compat
    if (!aiResult.medicationSchedule && aiResult.medicationSuggestions) {
      aiResult.medicationSchedule = aiResult.medicationSuggestions.map((m) => ({
        drug: m.drug,
        instructions: `${m.dose} ${m.strength} — ${m.frequency} for ${m.duration}. ${m.precautions || ""}`.trim(),
      }));
    }
    return aiResult;
  }

  // Fallback: build minimal structured report from raw data
  const rxList = Array.isArray(prescription) ? prescription : [];
  return {
    patientSummary: {
      mainComplaint: symptoms ? symptoms.slice(0, 80) : "General consultation",
      duration: durationDays ? `${durationDays} days` : "Not specified",
      severity: severity || "Not specified",
    },
    symptomsReported: symptoms || "Symptoms not recorded.",
    clinicalAssessment: clinicalNotes || "Clinical assessment not available.",
    recommendedExaminations: ["Physical examination", "Vital signs check"],
    provisionalDiagnosis: "Provisional diagnosis only. Further clinical evaluation is required.",
    treatmentPlan: {
      lifestyle: "Follow doctor's advice and avoid strenuous activity.",
      homeCare: "Monitor symptoms and rest adequately.",
      hydration: "Drink at least 8 glasses of water per day.",
      rest: "Get adequate sleep and avoid overexertion.",
      diet: "Eat balanced meals; avoid junk food and alcohol.",
      followUp: "Return if symptoms worsen or do not improve within 3-5 days.",
    },
    medicationSuggestions: rxList.map((rx) => ({
      drug: rx.drug,
      strength: rx.dosage || "",
      dose: "As directed",
      frequency: rx.frequency || "",
      duration: rx.duration_days ? `${rx.duration_days} days` : "",
      precautions: "Take as prescribed. Do not stop without consulting your doctor.",
    })),
    redFlagSymptoms: [
      "Severe chest pain or pressure",
      "Sudden difficulty breathing",
      "High fever above 39°C / 103°F",
      "Sudden severe headache",
      "Loss of consciousness",
    ],
    followUp: "Follow up with your doctor within 5-7 days or sooner if symptoms worsen.",
    summary: clinicalNotes || "Please follow your doctor's instructions carefully.",
    medicationSchedule: rxList.map((rx) => ({
      drug: rx.drug,
      instructions: `${rx.dosage} — ${rx.frequency} for ${rx.duration_days} days.`,
    })),
    followUpSteps: [
      "Take all medications as prescribed.",
      "Rest and stay hydrated.",
      "Return for follow-up as advised by your doctor.",
    ],
  };
}

export default { generatePreVisitSummary, generatePostVisitSummary };
