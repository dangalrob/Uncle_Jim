// AI Assessment Service for Uncle Jim's Estate App
// Multi-modal Curatorial Assessment using the unified Item Assessment Engine (itemAssessmentEngine.js)
// Supports Intake Paths B (Existing Photos) and C (Camera Intake), as well as existing item reassessment.

import { assessItem, cleanDescriptionText } from './itemAssessmentEngine.js';

/**
 * Generate AI Assessment for an item based on photos, guided questionnaire responses, and existing item context.
 * Delegates to the unified Item Assessment Engine.
 */
export async function generateAIAssessment({
  photos = [],
  guidedAnswers = {},
  existingItem = null,
  distributionThreshold = 100,
  adminAnswers = {},
  roundNumber = 1,
  apiKey = process.env.GEMINI_API_KEY
}) {
  const mode = existingItem ? 'LEGACY_NORMALIZATION' : 'ADD_NEW_ITEM_FROM_PHOTO';

  // Merge guided answers into confirmed attributes and admin answers
  const confirmedAttributes = {
    maker: guidedAnswers.knownMaker || existingItem?.maker || null,
    origin: guidedAnswers.knownOrigin || existingItem?.origin || null,
    materials: guidedAnswers.knownMaterials || existingItem?.materials || null,
    dimensions: guidedAnswers.dimensions || existingItem?.dimensions || null,
    condition: guidedAnswers.conditionNotes || existingItem?.condition || null,
    era: existingItem?.era || null,
    identifying_marks: existingItem?.identifying_marks || null
  };

  const combinedAdminAnswers = { ...adminAnswers };
  if (guidedAnswers.familyMemories) {
    combinedAdminAnswers['q_family_memories'] = {
      status: 'ANSWERED',
      answer: guidedAnswers.familyMemories,
      evidenceType: 'FAMILY_RECOLLECTION'
    };
  }
  if (guidedAnswers.generalNotes) {
    combinedAdminAnswers['q_general_notes'] = {
      status: 'ANSWERED',
      answer: guidedAnswers.generalNotes,
      evidenceType: 'FACT'
    };
  }

  const evidence = {
    photos,
    item: existingItem || {},
    confirmedAttributes,
    adminAnswers: combinedAdminAnswers
  };

  const assessment = await assessItem({
    mode,
    evidence,
    roundNumber,
    apiKey
  });

  // Return assessment with backward-compatible aliases for AIAssessmentWizard
  return {
    ...assessment,
    proposedTitle: assessment.identification.proposedTitle,
    objectType: assessment.identification.objectType,
    cleanDescription: assessment.description.cleanDescription,
    origin: assessment.attributes.origin,
    era: assessment.attributes.era,
    materials: assessment.attributes.materials,
    maker: assessment.attributes.maker,
    model: assessment.attributes.model,
    identifyingMarks: assessment.attributes.identifyingMarks,
    dimensions: assessment.attributes.dimensions,
    condition: assessment.attributes.condition,
    provenanceNotes: assessment.provenance.jimConnectionNotes || assessment.provenance.provenanceText,
    plausibleTravelConnection: assessment.historicalContext.acquisitionContext,
    assessmentConfidence: assessment.identification.confidence,
    confidenceReason: assessment.identification.confidenceReason,
    questions: assessment.questions,
    verificationNeeded: assessment.verification.verificationNeeded,
    followUpWorthwhile: assessment.verification.followUpWorthwhile,
    appraisalRecommended: false,
    appraisalReason: null,
    // Preserve existing item value if present, otherwise null
    estimatedValueLow: existingItem?.estimated_value_low || null,
    estimatedValueHigh: existingItem?.estimated_value_high || null,
    valueBasis: existingItem?.value_basis || null,
    threshold: distributionThreshold,
    exceedsThreshold: false
  };
}
