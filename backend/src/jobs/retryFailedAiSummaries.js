// ─── Retry Failed AI Summaries Job ───────────────────────────────────────────
// Runs every 10 minutes. Re-attempts Mistral AI calls for symptom forms and
// visit notes where ai_status = 'failed' or 'pending'.

import prisma from "../config/db.js";
import {
  generatePreVisitSummary,
  generatePostVisitSummary,
} from "../services/mistral.service.js";

const MAX_RETRIES = 3;

export async function retryFailedAiSummaries() {
  try {
    // Retry failed pre-visit summaries
    const failedSymptomForms = await prisma.symptomForm.findMany({
      where: {
        aiStatus: { in: ["failed", "pending"] },
      },
      take: 10,
    });

    let retriedPreVisit = 0;
    for (const form of failedSymptomForms) {
      try {
        const result = await generatePreVisitSummary({
          symptoms: form.rawSymptoms,
          durationDays: form.durationDays,
          severity: form.severity,
        });

        if (result) {
          await prisma.symptomForm.update({
            where: { id: form.id },
            data: {
              urgencyLevel: result.urgencyLevel,
              chiefComplaint: result.chiefComplaint,
              suggestedQuestions: result.suggestedQuestions,
              aiStatus: "ok",
            },
          });
          retriedPreVisit++;
        }
      } catch (err) {
        console.error(
          `[RetryAI] Pre-visit retry failed for form ${form.id}:`,
          err.message
        );
      }
    }

    // Retry failed post-visit summaries
    const failedVisitNotes = await prisma.visitNote.findMany({
      where: {
        aiStatus: { in: ["failed", "pending"] },
      },
      take: 10,
    });

    let retriedPostVisit = 0;
    for (const note of failedVisitNotes) {
      try {
        const result = await generatePostVisitSummary({
          clinicalNotes: note.clinicalNotes,
          prescription: note.prescription,
        });

        if (result) {
          await prisma.visitNote.update({
            where: { id: note.id },
            data: {
              patientSummary: JSON.stringify(result),
              aiStatus: "ok",
            },
          });
          retriedPostVisit++;
        }
      } catch (err) {
        console.error(
          `[RetryAI] Post-visit retry failed for note ${note.id}:`,
          err.message
        );
      }
    }

    const total = retriedPreVisit + retriedPostVisit;
    if (total > 0) {
      console.log(
        `[RetryAI] Successfully regenerated ${retriedPreVisit} pre-visit + ${retriedPostVisit} post-visit summaries`
      );
    }

    return total;
  } catch (err) {
    console.error("[RetryAI] Error:", err.message);
    throw err;
  }
}

export default retryFailedAiSummaries;
