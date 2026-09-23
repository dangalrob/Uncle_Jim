// Item Assessment Engine for Uncle Jim's Estate
// Unified curatorial assessment engine supporting:
// 1. LEGACY_NORMALIZATION (One-time inventory conversion)
// 2. ADD_NEW_ITEM_FROM_PHOTO (Existing photo intake)
// 3. CAMERA_INTAKE (Live mobile/tablet camera intake)
//
// Key Principles:
// - Evidence Discipline: Physical evidence facts (e.g. "Label reads 'Bali 1968'") are separated from historical conclusions.
// - Newly Composed Descriptions: Descriptions are newly composed from evidence, not sanitized legacy prose.
// - Uncertainty Honesty: Description and structured fields match the certainty of available evidence.
// - Question Rounds: Up to 5 questions per round; Admin can always "Prepare Record Now" or "Don't Know".
// - Restricted Fallback: If Gemini is unavailable, deterministic logic preserves evidence and formats obvious fields,
//   but NEVER fabricates historical or curatorial intelligence.
// - Zero Valuation: Final monetary valuation is deferred to a future phase. Existing recorded values are preserved.

import fs from 'fs';
import path from 'path';

/**
 * URL Extractor & Resolver:
 * Extracts URLs from text, resolves Google redirect parameters if possible,
 * preserving original URLs for research provenance.
 */
export function extractAndResolveUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"'()]+/gi;
  const matches = text.match(urlRegex) || [];
  const uniqueUrls = [...new Set(matches)];

  return uniqueUrls.map(rawUrl => {
    let resolvedUrl = rawUrl;
    try {
      if (rawUrl.includes('google.com/url?') || rawUrl.includes('google.com/search?') || rawUrl.includes('google.com/shopping/')) {
        const urlObj = new URL(rawUrl);
        const targetQ = urlObj.searchParams.get('url') || urlObj.searchParams.get('q');
        if (targetQ && /^https?:\/\//i.test(targetQ)) {
          resolvedUrl = targetQ;
        }
      }
    } catch (e) {
      resolvedUrl = rawUrl;
    }

    let websiteOrOrg = 'Web Source';
    try {
      const parsed = new URL(resolvedUrl);
      const host = parsed.hostname.replace(/^www\./i, '');
      if (host.includes('ebay')) websiteOrOrg = 'eBay';
      else if (host.includes('liveauctioneers')) websiteOrOrg = 'LiveAuctioneers';
      else if (host.includes('invaluable')) websiteOrOrg = 'Invaluable';
      else if (host.includes('etsy')) websiteOrOrg = 'Etsy';
      else if (host.includes('worthpoint')) websiteOrOrg = 'WorthPoint';
      else if (host.includes('metmuseum') || host.includes('si.edu') || host.includes('museum')) websiteOrOrg = 'Museum Collection';
      else websiteOrOrg = host;
    } catch (e) {}

    let sourceType = 'General Web Reference';
    if (resolvedUrl.includes('ebay.com/itm') || resolvedUrl.includes('ebay.com/sch')) {
      sourceType = text.toLowerCase().includes('sold') ? 'Completed eBay Sale' : 'Active eBay Listing';
    } else if (resolvedUrl.includes('liveauctioneers') || resolvedUrl.includes('invaluable')) {
      sourceType = 'Auction Result';
    } else if (resolvedUrl.includes('museum') || resolvedUrl.includes('si.edu') || resolvedUrl.includes('metmuseum')) {
      sourceType = 'Museum Collection';
    }

    return {
      id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      url: resolvedUrl,
      original_url: rawUrl,
      website_or_org: websiteOrOrg,
      source_type: sourceType,
      title: `${websiteOrOrg} Reference`,
      source_date: null,
      listing_date: null,
      date_accessed: new Date().toISOString().split('T')[0],
      asking_price: null,
      sold_price: null,
      currency: 'USD',
      status: 'reference',
      relevance: 'Extracted from research notes',
      used_for: 'Identification',
      notes: null
    };
  });
}

/**
 * Safety Validator:
 * Strictly strips URLs, bracket citations ([1]), dollar values, shopping links,
 * and conversational AI filler from descriptions.
 * NOT used as a description generator; used exclusively as a post-generation validation check.
 */
export function cleanDescriptionText(text) {
  if (!text) return '';
  return text
    // 1. Strip markdown links: [label](url) -> label
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^\)]+\)/gi, '$1')
    // 2. Strip bracketed citation numbers or URLs: [1], [2], [1] google.com/..., [https://...]
    .replace(/\[\d+\]\s*(?:(?:https?:\/\/|www\.)[^\s\]]+)?/gi, '')
    .replace(/\[(?:https?:\/\/|www\.)[^\]]+\]/gi, '')
    .replace(/\[\d+\]/gi, '')
    // 3. Strip standalone URLs & www links
    .replace(/https?:\/\/[^\s<>"'()]+/gi, '')
    .replace(/\bwww\.[^\s<>"'()]+\.[^\s<>"'()]+/gi, '')
    // 4. Strip Google Shopping / Search references
    .replace(/\bgoogle\s+(?:shopping|search|lens|comp|estimates?|believes?|thinks?)[^.\n]*\.?/gi, '')
    .replace(/\bgoogle\s+shopping\b:?/gi, '')
    .replace(/\bgoogle\s+search\b:?/gi, '')
    // 5. Strip AI conversational hedging and filler
    .replace(/\bif\s+this\s+is\s+authentic[^,.]*[,.]?\s*/gi, '')
    .replace(/\bif\s+genuine[^,.]*[,.]?\s*/gi, '')
    .replace(/\bbased\s+on\s+(?:the\s+)?(?:ai|legacy|google)\s+(?:analysis|assessment|notes)[^,.]*[,.]?\s*/gi, '')
    .replace(/\bhere\s+is\s+the\s+assessment[^.]*\.?/gi, '')
    .replace(/\bi\s+have\s+analyzed[^.]*\.?/gi, '')
    .replace(/\bsimilar\s+(?:examples|ones)\s+(?:sell|are)[^.]*\.?/gi, '')
    .replace(/\bquick\s+sale[^.]*\.?/gi, '')
    .replace(/\bneed\s+picture[^.]*\.?/gi, '')
    // 6. Strip valuation commentary & price figures
    .replace(/\bpriced\s+by\s+weight\b[^,.]*[,.]?/gi, '')
    .replace(/\bestimated\s+to\s*\+?\s*(?:\$[0-9,]+|\babove\b|\bbelow\b)?[^,.]*[,.]?/gi, '')
    .replace(/\bestimated\s+(?:value|at|range)?\s*:?\s*\$?[0-9,]+(?:\s*(?:-|to|–)\s*\$?[0-9,]+)?\+?[^,.]*[,.]?/gi, '')
    .replace(/\bvalue:?\s*\$?[0-9,\s-]+/gi, '')
    .replace(/\$(?:[0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.[0-9]{2})?/g, '')
    // 7. Strip trailing empty brackets or parenthesis
    .replace(/\(\s*see:?\s*\)/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    // 8. Clean leftover punctuation & whitespace
    .replace(/\s*,\s*,+/g, ',')
    .replace(/^\s*[,.;:]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Determine recommended assessment depth based on item characteristics
 */
export function determineAssessmentDepth(item, combinedText = '') {
  const text = ((item?.title || '') + ' ' + (item?.description || '') + ' ' + (item?.special_handling_notes || '') + ' ' + combinedText).toLowerCase();

  // Museum / Historical / Collectible / Maritime
  const historicalPatterns = [
    /\b(antique|maritime|sextant|compass|navigation|nautical|ship|vessel|great lakes|wwii|carving|carved|bali|indonesia|japan|japanese|china|chinese|asia|asian|philippines|ethnographic|tribal|sculpture|painting|oil on canvas|lithograph|pipe|meerschaum|libyan|desert glass|impactite|meteorite|fossil|specimen|bronze|sterling silver|voyage|sea captain|merchant marine)\b/i,
    /\b(18th\s+century|19th\s+century|early\s+20th\s+century|circa\s+18\d\d|circa\s+19[0-4]\d)\b/i
  ];

  // Standard Equipment / Modern Furniture
  const standardPatterns = [
    /\b(furniture|camera|lens|video|electronics|printer|audio|stereo|speaker|appliance|equipment|dresser|desk|table|credenza|hp|nikon|canon|sony|panasonic)\b/i
  ];

  for (const p of historicalPatterns) {
    if (p.test(text)) return 'HISTORICAL_COLLECTIBLE';
  }
  for (const p of standardPatterns) {
    if (p.test(text)) return 'STANDARD';
  }
  return 'BASIC';
}

/**
 * Core Assessment Entry Point
 *
 * @param {Object} params
 * @param {string} params.mode - 'LEGACY_NORMALIZATION' | 'ADD_NEW_ITEM_FROM_PHOTO' | 'CAMERA_INTAKE'
 * @param {Object} params.evidence - Bundle of authentic evidence:
 *   - photos: Array of { path, base64, mimetype, label }
 *   - baseline: Baseline snapshot row (for legacy conversion)
 *   - item: Current item row (if existing)
 *   - confirmedAttributes: Object of known facts (maker, model, materials, dimensions, marks, etc.)
 *   - legacyNotes: Raw archived notes
 *   - researchSources: Array of existing research sources
 *   - adminAnswers: Object mapping questionId -> { status, answer, evidenceType, newPhotoPath }
 * @param {string} [params.researchLevelOverride] - 'BASIC' | 'STANDARD' | 'HISTORICAL_COLLECTIBLE' | null
 * @param {number} [params.roundNumber=1] - Current question round (1-indexed)
 * @param {string} [params.apiKey=process.env.GEMINI_API_KEY]
 * @returns {Promise<Object>} Structured Curatorial Assessment (ITEM_ASSESSMENT_V1)
 */
export async function assessItem({
  mode = 'LEGACY_NORMALIZATION',
  evidence = {},
  researchLevelOverride = null,
  roundNumber = 1,
  apiKey = process.env.GEMINI_API_KEY
}) {
  const item = evidence.item || {};
  const baseline = evidence.baseline || null;
  const photos = evidence.photos || [];
  const adminAnswers = evidence.adminAnswers || {};
  const existingSources = evidence.researchSources || [];
  const confirmedAttrs = evidence.confirmedAttributes || {};

  // Build combined evidence text representation
  const textPieces = [];

  if (mode === 'LEGACY_NORMALIZATION') {
    textPieces.push(`=== INTAKE MODE: LEGACY INVENTORY NORMALIZATION ===`);
    const origTitle = baseline?.original_title || item.title || '';
    if (origTitle) textPieces.push(`Original Title: ${origTitle}`);

    const origDesc = baseline?.original_description || (item.normalization_status !== 'normalized' ? item.description : '') || '';
    if (origDesc) textPieces.push(`Original Raw Description: ${origDesc}`);

    const origNotes = baseline?.original_special_handling_notes || item.special_handling_notes || item.legacy_assessment_notes || '';
    if (origNotes) textPieces.push(`Original Raw Notes: ${origNotes}`);
  } else {
    textPieces.push(`=== INTAKE MODE: ${mode} ===`);
    if (item.title) textPieces.push(`Item Working Title: ${item.title}`);
  }

  // Include Confirmed Physical Facts (Attribute Level)
  const facts = [];
  const makerVal = confirmedAttrs.maker || item.maker;
  if (makerVal) facts.push(`Confirmed Maker: ${makerVal}`);
  const modelVal = confirmedAttrs.model || item.model;
  if (modelVal) facts.push(`Confirmed Model: ${modelVal}`);
  const matVal = confirmedAttrs.materials || item.materials;
  if (matVal) facts.push(`Confirmed Materials: ${matVal}`);
  const origVal = confirmedAttrs.origin || item.origin;
  if (origVal) facts.push(`Known Origin: ${origVal}`);
  const eraVal = confirmedAttrs.era || item.era;
  if (eraVal) facts.push(`Estimated Era: ${eraVal}`);
  const dimVal = confirmedAttrs.dimensions || item.dimensions;
  if (dimVal) facts.push(`Physical Dimensions: ${dimVal}`);
  const condVal = confirmedAttrs.condition || item.condition;
  if (condVal) facts.push(`Condition Notes: ${condVal}`);
  const marksVal = confirmedAttrs.identifying_marks || item.identifying_marks;
  if (marksVal) facts.push(`Physical Marks / Stamps / Labels: ${marksVal}`);

  if (facts.length > 0) {
    textPieces.push(`\n=== CONFIRMED PHYSICAL EVIDENCE FACTS ===\n${facts.join('\n')}`);
  }

  // Include Admin Answers from previous rounds (with evidence discipline)
  const answerEntries = Object.entries(adminAnswers);
  if (answerEntries.length > 0) {
    const answerTexts = [];
    for (const [qid, ans] of answerEntries) {
      if (ans.status === 'UNKNOWN' || ans.answer === 'Don\'t Know' || ans.answer === 'Unknown') {
        answerTexts.push(`Question [${qid}]: Admin reported UNKNOWN / Cannot Determine.`);
      } else if (ans.answer) {
        const evType = ans.evidenceType || 'FACT';
        answerTexts.push(`Question [${qid}] (${evType}): "${ans.answer}"`);
      }
    }
    if (answerTexts.length > 0) {
      textPieces.push(`\n=== ADMIN ANSWERS & EVIDENCE REVELATIONS ===\n${answerTexts.join('\n')}`);
    }
  }

  const combinedEvidenceText = textPieces.join('\n\n');

  // Determine assessment depth
  const recommendedDepth = determineAssessmentDepth(item, combinedEvidenceText);
  const activeDepth = researchLevelOverride || recommendedDepth;

  // Extract structured research sources from raw text & baseline if present
  const extractedSources = extractAndResolveUrls(combinedEvidenceText);

  // Call Gemini if API Key is present
  if (apiKey) {
    try {
      const result = await callGeminiCuratorialAssessment({
        mode,
        combinedEvidenceText,
        photos,
        activeDepth,
        recommendedDepth,
        roundNumber,
        adminAnswers,
        extractedSources,
        existingSources,
        item,
        apiKey
      });
      if (result) return result;
    } catch (err) {
      console.warn('[ItemAssessmentEngine] Gemini API call failed or timed out:', err.message);
    }
  }

  // Restricted Deterministic Fallback:
  // When AI is unavailable, preserve data and format obvious fields,
  // but strictly DO NOT fabricate curatorial intelligence.
  return restrictedDeterministicFallback({
    mode,
    item,
    baseline,
    activeDepth,
    recommendedDepth,
    combinedEvidenceText,
    extractedSources,
    existingSources,
    adminAnswers
  });
}

/**
 * Gemini Multimodal Curatorial Assessment Call
 */
async function callGeminiCuratorialAssessment({
  mode,
  combinedEvidenceText,
  photos,
  activeDepth,
  recommendedDepth,
  roundNumber,
  adminAnswers,
  extractedSources,
  existingSources,
  item,
  apiKey
}) {
  const systemInstruction = `You are the expert curatorial assessment engine for Uncle Jim's Estate inventory.
Uncle Jim was a merchant mariner and world traveler who voyaged across the globe (including Asia, Europe, and the Americas).
Your objective is to produce a high-quality, permanent, Admin-approved inventory record for this item.

ASSESSMENT DEPTH: "${activeDepth}" (Recommended: "${recommendedDepth}")
Adapt your depth and style accordingly:
- MUSEUM / HISTORICAL / COLLECTIBLE / MARITIME: Deep curatorial examination. Answer: What is it? Where is it from? When is it from? What is it made from? What historical or cultural context is useful to understand?
- MODERN FURNITURE / ELECTRONICS / EQUIPMENT: Practical identification, maker, model, approximate decade, materials, dimensions, and condition without forced museum prose or forced provenance research.
- ORDINARY HOUSEHOLD / NOVELTY / RESALE: Concise 1-sentence normalized description (e.g. "Decorative novelty metal sign with intentionally distressed finish, modern production."), 0 forced historical research, and 0 questions.

CORE CURATORIAL PRINCIPLES:
1. EVIDENCE DISCIPLINE (Physical Evidence Facts vs Historical Conclusions):
   - A physical evidence fact (e.g., "A handwritten label on the base reads 'Bali 1968'") is a FACT about the physical evidence itself.
   - It does NOT by itself establish as historical fact that the object was made, purchased, or acquired in Bali in 1968.
   - Reason separately about what evidence exists and what conclusions that evidence supports.
   - Separate Jim-Specific Provenance strictly into:
     * FACT: Documented receipt, logbook entry, or verified family record.
     * REASONABLE_INFERENCE: Logical overlap between known voyage/travel dates and object origin.
     * UNKNOWN: No specific connection documented.
   - NEVER state as fact that "Jim purchased this in..." unless explicit documentation establishes that.
2. NEWLY COMPOSED DESCRIPTION:
   - WRITE a new curatorial description directly from the structured evidence.
   - DO NOT sanitize or concatenate older AI prose.
   - Scale description length with the object:
     * Novelty/Ordinary: 1 clean sentence.
     * Collectible/Historical/Maritime: 2 to 4 informative curatorial sentences.
   - UNCERTAINTY HONESTY:
     * If identification is uncertain or tentative (e.g., Libyan Desert Glass without lab assay), use tentative phrasing: "Yellow-green translucent glass specimen, tentatively identified as Libyan Desert Glass, a naturally occurring silica-rich cosmic impactite..."
     * The description and structured fields MUST match the certainty of the evidence. Structured fields must not assert greater certainty than the description.
   - STRICT PROHIBITIONS IN DESCRIPTION:
     * NO dollar amounts or price ranges.
     * NO URLs or web links.
     * NO bracketed citations (e.g. "[1]").
     * NO conversational AI filler ("Here is the assessment", "If this is authentic...").
3. PURPOSEFUL INTERACTIVE QUESTIONS (ROUND ${roundNumber}):
   - Formulate 0 to 5 targeted questions ONLY if the answers could materially improve:
     * identification, normalized description, maker/model, age, origin, materials, historical context, or provenance.
   - For BASIC or already clear items, return an EMPTY ARRAY of questions (0 questions).
   - Maximum 5 questions per round.
   - Each question must include:
     * questionId (e.g. "q_maker_mark", "q_dimensions", "q_documentation")
     * question (concise, direct)
     * reason (why this materially improves the record)
     * importance ("HIGH" | "MEDIUM" | "LOW")
     * responseType ("text" | "yes_no" | "multiple_choice" | "numeric" | "photo")
     * options (array of strings if multiple_choice)
     * allowsUnknown (true)
     * requestedPhotoType (e.g. "makers_mark", "underside", "lighting_angle", "detail" if responseType is "photo")
   - If missing information could materially improve the record but cannot be answered now, note it in "followUpWorthwhile".
4. ZERO VALUATION IN THIS PHASE:
   - Do NOT estimate dollar values or generate price comps. Valuation is handled in a separate phase.
   - Focus 100% on identification, curatorial description, physical attributes, and historical significance.

Respond with strict JSON matching the schema.`;

  const promptText = `Please assess this item under mode "${mode}" and depth "${activeDepth}":\n\n${combinedEvidenceText}`;

  // Assemble multimodal parts (text + images)
  const parts = [{ text: promptText }];

  for (const photo of photos) {
    let base64Data = photo.base64;
    let mimeType = photo.mimetype || 'image/jpeg';

    if (!base64Data && photo.path && fs.existsSync(photo.path)) {
      try {
        const fileBuf = fs.readFileSync(photo.path);
        base64Data = fileBuf.toString('base64');
        const ext = path.extname(photo.path).toLowerCase();
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      } catch (e) {
        console.warn('[ItemAssessmentEngine] Could not read photo file for Gemini payload:', photo.path, e.message);
      }
    }

    if (base64Data) {
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }
  }

  const requestBody = {
    contents: [{ parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          assessmentDepth: { type: 'STRING', enum: ['BASIC', 'STANDARD', 'HISTORICAL_COLLECTIBLE'] },
          assessmentDepthReason: { type: 'STRING' },
          proposedTitle: { type: 'STRING' },
          objectType: { type: 'STRING' },
          cleanDescription: { type: 'STRING' },
          origin: { type: 'STRING', nullable: true },
          era: { type: 'STRING', nullable: true },
          materials: { type: 'STRING', nullable: true },
          maker: { type: 'STRING', nullable: true },
          model: { type: 'STRING', nullable: true },
          dimensions: { type: 'STRING', nullable: true },
          condition: { type: 'STRING', nullable: true },
          identifyingMarks: { type: 'STRING', nullable: true },
          evidenceFacts: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          historicalConclusions: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          historicalCulturalContext: { type: 'STRING', nullable: true },
          acquisitionContext: { type: 'STRING', nullable: true },
          jimConnectionType: { type: 'STRING', enum: ['FACT', 'REASONABLE_INFERENCE', 'UNKNOWN'] },
          jimConnectionNotes: { type: 'STRING', nullable: true },
          legacySignificance: { type: 'STRING', enum: ['none', 'possible', 'significant', 'unknown'] },
          legacySignificanceReason: { type: 'STRING', nullable: true },
          identificationConfidence: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          identificationConfidenceReason: { type: 'STRING', nullable: true },
          verificationNeeded: { type: 'STRING', nullable: true },
          followUpWorthwhile: { type: 'STRING', nullable: true },
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                questionId: { type: 'STRING' },
                question: { type: 'STRING' },
                reason: { type: 'STRING' },
                importance: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                responseType: { type: 'STRING', enum: ['text', 'yes_no', 'multiple_choice', 'numeric', 'photo'] },
                options: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
                allowsUnknown: { type: 'BOOLEAN' },
                requestedPhotoType: { type: 'STRING', nullable: true }
              },
              required: ['questionId', 'question', 'reason', 'importance', 'responseType', 'allowsUnknown']
            }
          }
        },
        required: [
          'assessmentDepth', 'proposedTitle', 'objectType', 'cleanDescription',
          'identificationConfidence', 'jimConnectionType', 'legacySignificance', 'questions'
        ]
      }
    }
  };

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(22000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty Gemini response content');

      const parsed = JSON.parse(rawText);

      // Enforce Safety Validator on cleanDescription
      parsed.cleanDescription = cleanDescriptionText(parsed.cleanDescription);

      // Cap questions at maximum 5 per round
      if (Array.isArray(parsed.questions)) {
        parsed.questions = parsed.questions.slice(0, 5);
      } else {
        parsed.questions = [];
      }

      // Merge research sources
      const allSources = [...existingSources];
      for (const legSrc of extractedSources) {
        if (!allSources.some(s => s.url === legSrc.url || s.original_url === legSrc.original_url)) {
          allSources.push(legSrc);
        }
      }

      return {
        metadata: {
          assessmentVersion: 'ITEM_ASSESSMENT_V1',
          assessmentMode: mode,
          assessmentDepth: parsed.assessmentDepth || activeDepth,
          recommendedDepth,
          roundNumber,
          engine: 'ai_gemini',
          modelUsed: model,
          aiUnavailable: false
        },
        identification: {
          proposedTitle: parsed.proposedTitle || item.title || 'Untitled Item',
          objectType: parsed.objectType || 'General Object',
          confidence: parsed.identificationConfidence || 'MEDIUM',
          confidenceReason: parsed.identificationConfidenceReason || ''
        },
        description: {
          cleanDescription: parsed.cleanDescription
        },
        attributes: {
          maker: parsed.maker || null,
          model: parsed.model || null,
          era: parsed.era || null,
          origin: parsed.origin || null,
          materials: parsed.materials || null,
          dimensions: parsed.dimensions || null,
          condition: parsed.condition || null,
          identifyingMarks: parsed.identifyingMarks || null
        },
        evidenceDiscipline: {
          evidenceFacts: parsed.evidenceFacts || [],
          historicalConclusions: parsed.historicalConclusions || []
        },
        historicalContext: {
          historicalCulturalContext: parsed.historicalCulturalContext || null,
          acquisitionContext: parsed.acquisitionContext || null
        },
        provenance: {
          jimConnectionType: parsed.jimConnectionType || 'UNKNOWN',
          jimConnectionNotes: parsed.jimConnectionNotes || null
        },
        legacy: {
          significance: parsed.legacySignificance || 'none',
          significanceReason: parsed.legacySignificanceReason || null
        },
        verification: {
          verificationNeeded: parsed.verificationNeeded || null,
          followUpWorthwhile: parsed.followUpWorthwhile || null
        },
        questions: parsed.questions,
        adminAnswers,
        researchSources: allSources
      };
    } catch (err) {
      console.warn(`[ItemAssessmentEngine] Attempt with ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError;
}

/**
 * Restricted Deterministic Fallback:
 * If Gemini/AI is unavailable, do NOT fabricate curatorial intelligence from heuristics.
 * Preserves evidence, sanitizes existing text, extracts obvious fields, and clearly reports
 * that AI assessment was unavailable.
 */
function restrictedDeterministicFallback({
  mode,
  item = {},
  baseline = null,
  activeDepth,
  recommendedDepth,
  combinedEvidenceText,
  extractedSources = [],
  existingSources = [],
  adminAnswers = {}
}) {
  const isLegacy = mode === 'LEGACY_NORMALIZATION';
  const rawDesc = baseline?.original_description || item.description || '';
  const sanitizedDesc = cleanDescriptionText(rawDesc);

  // Preserve obvious confirmed attributes
  const title = baseline?.original_title || item.title || 'Untitled Item';
  const maker = item.maker || null;
  const model = item.model || null;
  const era = item.era || null;
  const origin = item.origin || null;
  const materials = item.materials || null;
  const dimensions = item.dimensions || null;
  const condition = item.condition || null;
  const marks = item.identifying_marks || null;

  // Build research sources
  const allSources = [...existingSources];
  for (const src of extractedSources) {
    if (!allSources.some(s => s.url === src.url || s.original_url === src.original_url)) {
      allSources.push(src);
    }
  }

  // Construct conservative description stating AI unavailable if sanitized text is empty
  const cleanDescription = sanitizedDesc || (
    activeDepth === 'BASIC'
      ? `${title}, ordinary estate decorative or household item.`
      : `${title}. Curatorial description pending AI assessment.`
  );

  return {
    metadata: {
      assessmentVersion: 'ITEM_ASSESSMENT_V1',
      assessmentMode: mode,
      assessmentDepth: activeDepth,
      recommendedDepth,
      roundNumber: 1,
      engine: 'restricted_fallback',
      modelUsed: 'deterministic_safety_only',
      aiUnavailable: true,
      aiUnavailableNotice: 'AI assessment service is offline or unavailable. Evidence was safely preserved without fabricated curatorial claims.'
    },
    identification: {
      proposedTitle: title,
      objectType: activeDepth === 'BASIC' ? 'Household Object' : 'Uncategorized Estate Object',
      confidence: 'LOW',
      confidenceReason: 'AI assessment was unavailable; attributes are preserved directly from existing record.'
    },
    description: {
      cleanDescription
    },
    attributes: {
      maker,
      model,
      era,
      origin,
      materials,
      dimensions,
      condition,
      identifyingMarks: marks
    },
    evidenceDiscipline: {
      evidenceFacts: ['Preserved from pre-existing estate record'],
      historicalConclusions: []
    },
    historicalContext: {
      historicalCulturalContext: null,
      acquisitionContext: null
    },
    provenance: {
      jimConnectionType: item.jim_connection_type || 'UNKNOWN',
      jimConnectionNotes: item.jim_connection_notes || null
    },
    legacy: {
      significance: item.legacy_significance || 'none',
      significanceReason: 'Preserved from current record.'
    },
    verification: {
      verificationNeeded: 'AI assessment service was unavailable. Re-run assessment when Gemini API connection is restored.',
      followUpWorthwhile: 'Re-evaluation with active AI service recommended.'
    },
    questions: [], // Never interrogate Admin in offline fallback
    adminAnswers,
    researchSources: allSources
  };
}
