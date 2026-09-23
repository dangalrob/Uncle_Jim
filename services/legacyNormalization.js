// Legacy Data Normalization Service for Uncle Jim's Estate App
// Re-routes all curatorial assessments through the unified Item Assessment Engine (itemAssessmentEngine.js)
// Preserves shared safety utilities and backwards-compatible response shaping.

import {
  assessItem,
  extractAndResolveUrls,
  cleanDescriptionText,
  determineAssessmentDepth
} from './itemAssessmentEngine.js';

export { extractAndResolveUrls, cleanDescriptionText, determineAssessmentDepth as determineResearchLevel };

/**
 * Main Extraction Entry Point for Legacy Normalization
 * Delegates directly to the reusable Item Assessment Engine.
 */
export async function extractLegacyData(itemOrBundle, apiKey = process.env.GEMINI_API_KEY, overrideResearchLevel = null, adminAnswers = {}, roundNumber = 1) {
  const item = itemOrBundle?.item || itemOrBundle;
  const baseline = itemOrBundle?.baseline || null;
  const researchSources = itemOrBundle?.researchSources || [];
  const photos = itemOrBundle?.photos || [];

  const evidence = {
    item,
    baseline,
    photos,
    researchSources,
    adminAnswers: adminAnswers || itemOrBundle?.adminAnswers || {},
    confirmedAttributes: {
      maker: item.maker,
      model: item.model,
      materials: item.materials,
      origin: item.origin,
      era: item.era,
      dimensions: item.dimensions,
      condition: item.condition,
      identifying_marks: item.identifying_marks
    }
  };

  const assessment = await assessItem({
    mode: 'LEGACY_NORMALIZATION',
    evidence,
    researchLevelOverride: overrideResearchLevel,
    roundNumber,
    apiKey
  });

  // Backward-compatible flat mapping alongside structured V1 schema
  return {
    ...assessment,
    // Top-level aliases for legacy UI compatibility
    researchLevel: assessment.metadata.assessmentDepth,
    activeResearchLevel: assessment.metadata.assessmentDepth,
    recommendedResearchLevel: assessment.metadata.recommendedDepth,
    researchLevelReason: assessment.identification.confidenceReason || '',
    proposedTitle: assessment.identification.proposedTitle,
    objectType: assessment.identification.objectType,
    cleanDescription: assessment.description.cleanDescription,
    origin: assessment.attributes.origin,
    era: assessment.attributes.era,
    materials: assessment.attributes.materials,
    maker: assessment.attributes.maker,
    model: assessment.attributes.model,
    dimensions: assessment.attributes.dimensions,
    condition: assessment.attributes.condition,
    identifyingMarks: assessment.attributes.identifyingMarks,
    acquisitionContext: assessment.historicalContext.acquisitionContext,
    historicalCulturalContext: assessment.historicalContext.historicalCulturalContext,
    jimConnectionType: assessment.provenance.jimConnectionType,
    jimConnectionNotes: assessment.provenance.jimConnectionNotes,
    legacySignificance: assessment.legacy.significance,
    legacySignificanceReason: assessment.legacy.significanceReason,
    identificationConfidence: assessment.identification.confidence,
    identificationConfidenceReason: assessment.identification.confidenceReason,
    verificationNeeded: assessment.verification.verificationNeeded,
    followUpWorthwhile: assessment.verification.followUpWorthwhile,
    adminQuestions: assessment.questions.map(q => q.question),
    questions: assessment.questions,
    researchSources: assessment.researchSources,
    modelUsed: assessment.metadata.modelUsed,
    extractionMode: assessment.metadata.engine,
    aiUnavailable: assessment.metadata.aiUnavailable
  };
}
