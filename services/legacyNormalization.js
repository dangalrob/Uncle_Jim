// Legacy Data Normalization Service for Uncle Jim's Estate App
// Multi-tier curatorial extraction engine supporting adaptive research depth:
// BASIC, STANDARD, and HISTORICAL / COLLECTIBLE tiers.
// Enforces strict separation between clean descriptions, Jim provenance, acquisition context,
// valuation thresholds, and structured research sources.

import fs from 'fs';
import path from 'path';

/**
 * URL Extractor & Resolver:
 * Extracts URLs from text, resolves Google redirect parameters if possible,
 * but NEVER discards the original URL if resolution fails.
 */
export function extractAndResolveUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"'()]+/gi;
  const matches = text.match(urlRegex) || [];
  const uniqueUrls = [...new Set(matches)];
  
  return uniqueUrls.map(rawUrl => {
    let resolvedUrl = rawUrl;
    
    // Check if it is a Google search/shopping redirect or tracking URL
    try {
      if (rawUrl.includes('google.com/url?') || rawUrl.includes('google.com/search?') || rawUrl.includes('google.com/shopping/')) {
        const urlObj = new URL(rawUrl);
        const targetQ = urlObj.searchParams.get('url') || urlObj.searchParams.get('q');
        if (targetQ && /^https?:\/\//i.test(targetQ)) {
          // Successfully and reliably resolved destination URL
          resolvedUrl = targetQ;
        }
      }
    } catch (e) {
      // If resolution fails, preserve the original URL
      resolvedUrl = rawUrl;
    }
    
    // Determine website / organization name from hostname
    let websiteOrOrg = 'Web Source';
    try {
      const parsed = new URL(resolvedUrl);
      const host = parsed.hostname.replace(/^www\./i, '');
      if (host.includes('ebay')) websiteOrOrg = 'eBay';
      else if (host.includes('liveauctioneers')) websiteOrOrg = 'LiveAuctioneers';
      else if (host.includes('invaluable')) websiteOrOrg = 'Invaluable';
      else if (host.includes('etsy')) websiteOrOrg = 'Etsy';
      else if (host.includes('worthpoint')) websiteOrOrg = 'WorthPoint';
      else if (host.includes('google')) websiteOrOrg = 'Google';
      else websiteOrOrg = host;
    } catch (e) {}

    // Determine source type
    let sourceType = 'General Web Reference';
    if (resolvedUrl.includes('ebay.com/itm') || resolvedUrl.includes('ebay.com/sch')) {
      sourceType = text.toLowerCase().includes('sold') ? 'Completed eBay Sale' : 'Active eBay Listing';
    } else if (resolvedUrl.includes('liveauctioneers') || resolvedUrl.includes('invaluable')) {
      sourceType = 'Auction Result';
    } else if (resolvedUrl.includes('museum') || resolvedUrl.includes('metmuseum') || resolvedUrl.includes('si.edu')) {
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
      relevance: 'Extracted from legacy research notes',
      used_for: 'Valuation',
      notes: null
    };
  });
}

/**
 * Clean description helper: strictly strips URLs, citation markers like [1], [2],
 * shopping references, dollar values, valuation commentary, and conversational AI filler.
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
    // 6. Strip valuation commentary & malformed remnants
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
 * Determine recommended research level based on item attributes and notes
 */
export function determineResearchLevel(item, combinedText = '') {
  const text = ((item.title || '') + ' ' + (item.description || '') + ' ' + (item.special_handling_notes || '') + ' ' + combinedText).toLowerCase();
  
  // Historical / Collectible patterns
  const historicalPatterns = [
    /\b(antique|maritime|sextant|compass|navigation|nautical|ship|vessel|great lakes|wwii|carving|carved|bali|indonesia|japan|japanese|china|chinese|asia|asian|philippines|ethnographic|tribal|sculpture|painting|oil on canvas|lithograph|pipe|meerschaum|libyan|desert glass|impactite|meteorite|fossil|specimen|bronze|sterling silver|voyage|sea captain|merchant marine|confucius|buddha)\b/i,
    /\b(18th\s+century|19th\s+century|early\s+20th\s+century|circa\s+18\d\d|circa\s+19[0-4]\d)\b/i
  ];
  
  // Standard patterns
  const standardPatterns = [
    /\b(furniture|camera|lens|video|electronics|printer|audio|stereo|speaker|appliance|equipment|dresser|desk|table|credenza|hp|nikon|canon|sony|panasonic|vintage 19[7-9]\d)\b/i
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
 * Calculate financial value threshold status
 */
export function calculateThresholdStatus(lowVal, highVal, threshold = 100) {
  const low = lowVal !== null && lowVal !== undefined && !isNaN(lowVal) ? parseFloat(lowVal) : null;
  const high = highVal !== null && highVal !== undefined && !isNaN(highVal) ? parseFloat(highVal) : null;

  if (low === null && high === null) return 'unknown';
  if (high !== null && high < threshold && (low === null || low < threshold)) return 'below_100';
  if (low !== null && low >= threshold) return 'above_100';
  if ((low !== null && low < threshold && high !== null && high >= threshold) || (low === null && high >= threshold)) {
    return 'possibly_100_plus';
  }
  return 'unknown';
}

/**
 * Main Extraction Entry Point
 * Supports both standalone item rows and rich Evidence Bundles containing:
 * - immutable PRE_NORMALIZATION_BASELINE
 * - approved factual attributes (maker, model, dimensions, origin, era)
 * - structured research sources
 */
export async function extractLegacyData(itemOrBundle, apiKey = process.env.GEMINI_API_KEY, overrideResearchLevel = null) {
  const item = itemOrBundle?.item || itemOrBundle;
  const baseline = itemOrBundle?.baseline || null;
  const isRenormalization = Boolean(itemOrBundle?.isRenormalization || (baseline && baseline.original_description));
  const existingSources = itemOrBundle?.researchSources || [];

  // Build combined evidence text:
  // For Re-Review of previously normalized items, assemble from baseline evidence + confirmed factual attributes
  let combinedText = '';
  if (isRenormalization && (baseline || item.legacy_assessment_notes)) {
    const textPieces = [];
    textPieces.push(`=== PRE-NORMALIZATION ORIGINAL BASELINE EVIDENCE ===`);
    const origTitle = baseline?.original_title || item.title;
    if (origTitle) textPieces.push(`Original Title: ${origTitle}`);

    const origDesc = baseline?.original_description || '';
    if (origDesc) textPieces.push(`Original Pre-Normalization Description: ${origDesc}`);

    const origNotes = baseline?.original_special_handling_notes || item.special_handling_notes || '';
    if (origNotes) textPieces.push(`Original Notes & Research: ${origNotes}`);

    if (item.legacy_assessment_notes && !origNotes && !origDesc) {
      textPieces.push(`Archived Legacy Notes: ${item.legacy_assessment_notes}`);
    }

    const origVal = baseline?.original_value || item.value;
    if (origVal) textPieces.push(`Original Value Reference: ${origVal}`);

    textPieces.push(`\n=== CURRENT APPROVED / CONFIRMED FACTUAL ATTRIBUTES ===`);
    if (item.maker) textPieces.push(`Confirmed Maker: ${item.maker}`);
    if (item.model) textPieces.push(`Confirmed Model: ${item.model}`);
    if (item.materials) textPieces.push(`Confirmed Materials: ${item.materials}`);
    if (item.origin) textPieces.push(`Confirmed Origin: ${item.origin}`);
    if (item.era) textPieces.push(`Confirmed Era: ${item.era}`);
    if (item.dimensions) textPieces.push(`Confirmed Dimensions: ${item.dimensions}`);
    if (item.condition) textPieces.push(`Confirmed Condition: ${item.condition}`);
    if (item.identifying_marks) textPieces.push(`Identifying Marks / Stamps: ${item.identifying_marks}`);

    if (existingSources.length > 0) {
      textPieces.push(`\n=== RECORDED RESEARCH SOURCES ===`);
      existingSources.forEach(s => {
        textPieces.push(`- ${s.website_or_org || s.source_name || 'Source'}: ${s.title || ''} (${s.url || s.original_url || ''}) ${s.asking_price ? `Asking: $${s.asking_price}` : ''} ${s.sold_price ? `Sold: $${s.sold_price}` : ''}`);
      });
    }

    combinedText = textPieces.join('\n\n');
  } else {
    // Standard / first-time normalization
    combinedText = [
      item.title ? `Title: ${item.title}` : '',
      item.description ? `Description: ${item.description}` : '',
      item.special_handling_notes ? `Assessment / Handling Notes: ${item.special_handling_notes}` : '',
      item.value ? `Current Value String: ${item.value}` : '',
      item.era ? `Current Era: ${item.era}` : '',
      item.origin ? `Current Origin: ${item.origin}` : '',
      item.maker ? `Current Maker: ${item.maker}` : '',
      item.materials ? `Current Materials: ${item.materials}` : '',
      item.dimensions ? `Current Dimensions: ${item.dimensions}` : '',
      item.condition ? `Current Condition: ${item.condition}` : '',
      item.location_in_house ? `Location in House: ${item.location_in_house}` : ''
    ].filter(Boolean).join('\n\n');
  }

  // Determine research level
  const recommendedLevel = determineResearchLevel(item, combinedText);
  const activeLevel = overrideResearchLevel || recommendedLevel;

  // Extract structured research sources from URLs in raw notes & baseline
  const legacySources = extractAndResolveUrls(combinedText);

  if (apiKey) {
    try {
      const result = await callGeminiStructuredExtraction(itemOrBundle, combinedText, apiKey, activeLevel, recommendedLevel, legacySources);
      if (result) return result;
    } catch (err) {
      console.warn('[LegacyNormalization] Gemini API call failed or timed out, falling back to local extractor:', err.message);
    }
  }

  // Fallback heuristic extractor when API key is missing or offline
  return fallbackHeuristicExtraction(itemOrBundle, combinedText, activeLevel, recommendedLevel, legacySources);
}

/**
 * Gemini Structured Multi-tier Extraction Call
 */
async function callGeminiStructuredExtraction(itemOrBundle, combinedText, apiKey, activeLevel, recommendedLevel, legacySources) {
  const item = itemOrBundle?.item || itemOrBundle;
  const isRenormalization = Boolean(itemOrBundle?.isRenormalization);

  const systemInstruction = `You are an expert museum curator and archivist normalizing legacy estate inventory records for Uncle Jim's Estate.
The estate contains diverse objects: ordinary household items, novelty items, modern furniture, electronics, antiques, artwork, maritime equipment, souvenirs, carvings, books, collectibles, and objects from decades of international travel.

RESEARCH DEPTH LEVEL: "${activeLevel}" (Recommended: "${recommendedLevel}")
1. BASIC: Novelty signs, ordinary household items, cheap decor.
   - Requires: clean concise 1-sentence normalized description, estimated value, $100 threshold status.
   - Do NOT waste time researching exact age, materials, origin, or historical context unless relevant to identification or value.
2. STANDARD: Modern furniture, electronics, cameras, equipment, better household goods.
   - Requires: identification, maker/manufacturer, model, approximate age, materials, normalized description, estimated value, $100 threshold status.
   - Origin is optional.
3. HISTORICAL / COLLECTIBLE: Antiques, maritime objects, sextants/navigation equipment, artwork, carvings, pipes, ethnographic/travel objects, unusual specimens (e.g. Libyan Desert Glass).
   - Requires: identification, age/period, maker, materials, geographic/cultural origin, historical context, general acquisition context, estimated value, research sources, separate confidence ratings, possible Jim connection, and verification needed.

CRITICAL CURATORIAL RULES:
1. NORMALIZED DESCRIPTION:
   - Must be clean, factual, concise, and suitable as authoritative virtual museum foundation.
   - Answers relevant portions of: What is it? Where is it from? When is it from? What is it made from? What is historically useful to know about it?
   - DO NOT pad descriptions with irrelevant fields.
   - STRICT PROHIBITION: NO dollar amounts, NO price ranges, NO URLs, NO citations (e.g. "[1] google.com"), NO conversational filler ("Here is the assessment").
   - NEVER recycle older conversational AI prose (e.g. NEVER write "If this is authentic...", "Estimated to +", "priced by weight"). Describe the physical specimen directly, and reflect any authenticity uncertainty in "identificationConfidence" and "verificationNeeded".
2. GENERAL ACQUISITION CONTEXT vs JIM-SPECIFIC PROVENANCE:
   - General Acquisition Context describes how/where objects of this type were reasonably acquired during their period (e.g. "Sold to international travelers and merchant seamen in Indonesian ports during the 1960s-1970s").
   - NEVER convert general acquisition context into a factual claim about Jim (do NOT say "Jim purchased this in Indonesia in 1968" unless documentary proof exists).
   - Jim-Specific Provenance must be stored separately with explicit classification:
     * FACT: Documented receipt, logbook entry, or verified family record.
     * REASONABLE INFERENCE: Reasonable overlap between known voyage/travel dates and object origin.
     * UNKNOWN: No specific connection documented.
3. VALUATION & $100 THRESHOLD:
   - Provide realistic numeric low and high value estimates (USD).
   - Classify threshold status: "below_100", "possibly_100_plus", "above_100", or "unknown".
   - CRITICAL RULE: If an item is comfortably below $100, do not perform excessive valuation research.
   - However, financial value does NOT limit historical or provenance research! A $30 maritime object can have significant legacy interest.
4. CONFIDENCE RATINGS:
   - Separate "identificationConfidence" (HIGH / MEDIUM / LOW) from "valueConfidence" (HIGH / MEDIUM / LOW).
5. VERIFICATION NEEDED & QUESTIONS:
   - If identification or authenticity requires verification (e.g. Libyan Desert Glass, maker's marks, hallmarks, signatures), explain what evidence, photos, measurements, or expert testing would improve confidence.
   - If you need details from the Admin, formulate specific questions in "adminQuestions".
6. RESEARCH SOURCES:
   - Do NOT put URLs in the description. URLs and comps belong in "researchSources".

Respond with strict JSON matching the schema.`;

  const prompt = `Analyze this legacy inventory record under research level "${activeLevel}":\n\n${combinedText}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          researchLevel: { type: "STRING", enum: ["BASIC", "STANDARD", "HISTORICAL_COLLECTIBLE"] },
          researchLevelReason: { type: "STRING" },
          proposedTitle: { type: "STRING" },
          cleanDescription: { type: "STRING" },
          origin: { type: "STRING", nullable: true },
          era: { type: "STRING", nullable: true },
          materials: { type: "STRING", nullable: true },
          maker: { type: "STRING", nullable: true },
          model: { type: "STRING", nullable: true },
          identifyingMarks: { type: "STRING", nullable: true },
          acquisitionContext: { type: "STRING", nullable: true },
          jimConnectionType: { type: "STRING", enum: ["FACT", "REASONABLE_INFERENCE", "UNKNOWN"] },
          jimConnectionNotes: { type: "STRING", nullable: true },
          provenanceText: { type: "STRING", nullable: true },
          dimensions: { type: "STRING", nullable: true },
          condition: { type: "STRING", nullable: true },
          estimatedValueLow: { type: "NUMBER", nullable: true },
          estimatedValueHigh: { type: "NUMBER", nullable: true },
          thresholdStatus: { type: "STRING", enum: ["below_100", "possibly_100_plus", "above_100", "unknown"] },
          valueBasis: { type: "STRING", nullable: true },
          legacySignificance: { type: "STRING", enum: ["none", "possible", "significant", "unknown"] },
          legacySignificanceReason: { type: "STRING", nullable: true },
          identificationConfidence: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
          identificationConfidenceReason: { type: "STRING", nullable: true },
          valueConfidence: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
          valueConfidenceReason: { type: "STRING", nullable: true },
          verificationNeeded: { type: "STRING", nullable: true },
          adminQuestions: {
            type: "ARRAY",
            items: { type: "STRING" }
          },
          appraisalRecommended: { type: "BOOLEAN" },
          appraisalReason: { type: "STRING", nullable: true },
          researchSources: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                sourceType: { type: "STRING" },
                websiteOrOrg: { type: "STRING" },
                title: { type: "STRING" },
                url: { type: "STRING", nullable: true },
                originalUrl: { type: "STRING", nullable: true },
                sourceDate: { type: "STRING", nullable: true },
                listingDate: { type: "STRING", nullable: true },
                askingPrice: { type: "NUMBER", nullable: true },
                soldPrice: { type: "NUMBER", nullable: true },
                currency: { type: "STRING" },
                status: { type: "STRING" },
                relevance: { type: "STRING" },
                usedFor: { type: "STRING" },
                notes: { type: "STRING", nullable: true }
              },
              required: ["sourceType", "websiteOrOrg", "title", "usedFor"]
            }
          },
          evidence: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", nullable: true },
              description: { type: "STRING", nullable: true },
              origin: { type: "STRING", nullable: true },
              era: { type: "STRING", nullable: true },
              materials: { type: "STRING", nullable: true },
              maker: { type: "STRING", nullable: true },
              valuation: { type: "STRING", nullable: true }
            }
          },
          conflicts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                field: { type: "STRING" },
                existingValue: { type: "STRING" },
                extractedValue: { type: "STRING" },
                explanation: { type: "STRING" }
              },
              required: ["field", "existingValue", "extractedValue", "explanation"]
            }
          }
        },
        required: [
          "researchLevel", "proposedTitle", "cleanDescription",
          "thresholdStatus", "identificationConfidence", "valueConfidence",
          "jimConnectionType", "legacySignificance"
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
        signal: AbortSignal.timeout(18000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty Gemini response content');

      const parsed = JSON.parse(rawText);

      // Clean description of any stray URLs or citations
      parsed.cleanDescription = cleanDescriptionText(parsed.cleanDescription);

      // Merge any parsed legacy sources that Gemini might have missed
      const mergedSources = [...(parsed.researchSources || [])];
      for (const legSrc of legacySources) {
        if (!mergedSources.some(s => s.url === legSrc.url || s.originalUrl === legSrc.original_url)) {
          mergedSources.push({
            sourceType: legSrc.source_type,
            websiteOrOrg: legSrc.website_or_org,
            title: legSrc.title,
            url: legSrc.url,
            originalUrl: legSrc.original_url,
            sourceDate: null,
            listingDate: null,
            askingPrice: null,
            soldPrice: null,
            currency: 'USD',
            status: 'reference',
            relevance: legSrc.relevance,
            usedFor: legSrc.used_for,
            notes: null
          });
        }
      }
      parsed.researchSources = mergedSources;

      parsed.recommendedResearchLevel = recommendedLevel;
      parsed.activeResearchLevel = activeLevel;
      parsed.modelUsed = model;
      parsed.extractionMode = 'ai_gemini';
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

/**
 * Fallback Heuristic Curatorial Extractor
 * Fully satisfies all requirements deterministically when offline or API key is absent.
 * Uses immutable baseline evidence when re-normalizing, preventing recursive reliance on old AI prose.
 */
function fallbackHeuristicExtraction(itemOrBundle, combinedText, activeLevel, recommendedLevel, legacySources) {
  const item = itemOrBundle?.item || itemOrBundle;
  const baseline = itemOrBundle?.baseline || null;
  const isRenormalization = Boolean(itemOrBundle?.isRenormalization || (baseline && baseline.original_description));

  // Determine text for evidence search:
  // Include baseline notes, legacy assessment notes, item notes, and combinedText
  const text = [
    baseline?.original_description || '',
    baseline?.original_special_handling_notes || '',
    item.legacy_assessment_notes || '',
    item.special_handling_notes || '',
    item.value || '',
    combinedText || ''
  ].join(' ');
  
  // Extract dollar figures: e.g. "$800 - $1,200" or "$300" or "$150-$250"
  let lowVal = item.estimated_value_low !== null && item.estimated_value_low !== undefined ? item.estimated_value_low : null;
  let highVal = item.estimated_value_high !== null && item.estimated_value_high !== undefined ? item.estimated_value_high : null;
  let valueBasis = item.value_basis || null;
  let valuationEvidence = null;

  if (lowVal === null && highVal === null) {
    const rangeMatch = text.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\s*(?:-|to|–)\s*\$?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/i);
    if (rangeMatch) {
      lowVal = parseFloat(rangeMatch[1].replace(/,/g, ''));
      highVal = parseFloat(rangeMatch[2].replace(/,/g, ''));
      valuationEvidence = rangeMatch[0];
      valueBasis = `Legacy valuation notes indicate estimated range of ${rangeMatch[0]}.`;
    } else {
      const singleMatch = text.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/);
      if (singleMatch) {
        lowVal = parseFloat(singleMatch[1].replace(/,/g, ''));
        highVal = lowVal;
        valuationEvidence = singleMatch[0];
        valueBasis = `Legacy notes reference valuation of ${singleMatch[0]}.`;
      }
    }
  }

  // Calculate threshold status
  const thresholdStatus = calculateThresholdStatus(lowVal, highVal, 100);

  // Extract era (preserve confirmed item.era if present)
  let era = item.era || null;
  let eraEvidence = null;
  const eraMatch = text.match(/(?:19th\s+century|20th\s+century|mid-(?:to-late\s+)?20th\s+century|19[2-9]0s|circa\s+[0-9]{4}|c\.\s*[0-9]{4}|WWII|[0-9]{4})/i);
  if (eraMatch && !era) {
    era = eraMatch[0];
    eraEvidence = `Extracted from legacy text: "${eraMatch[0]}"`;
  }

  // Extract materials hints (preserve confirmed item.materials if present)
  let materials = item.materials || null;
  let matEvidence = null;
  const matHints = [];
  if (/brass/i.test(text)) matHints.push('Brass');
  if (/wood|teak|cedar|pine|oak|mahogany/i.test(text)) {
    const w = text.match(/\b(teak|cedar|pine|oak|mahogany|hardwood|wood)\b/i);
    matHints.push(w ? w[0].charAt(0).toUpperCase() + w[0].slice(1).toLowerCase() : 'Wood');
  }
  if (/leather/i.test(text)) matHints.push('Leather');
  if (/silver/i.test(text)) matHints.push('Sterling silver');
  if (/canvas/i.test(text)) matHints.push('Canvas');
  if (/bronze/i.test(text)) matHints.push('Bronze');
  if (/desert glass|impactite|silica/i.test(text)) matHints.push('Natural silica-rich desert glass / cosmic impactite');
  if (matHints.length > 0 && !materials) {
    materials = [...new Set(matHints)].join(', ');
    matEvidence = `Mentioned materials in legacy notes: ${materials}`;
  }

  // Extract origin hints (preserve confirmed item.origin if present)
  let origin = item.origin || null;
  let originEvidence = null;
  const originMatch = text.match(/\b(Bali|Indonesia|China|Japan|India|Philippines|Great\s+Lakes|Wisconsin|Manitowish\s+Waters|New\s+England|Libyan\s+Desert|Egypt|American)\b/i);
  if (originMatch && !origin) {
    origin = originMatch[0];
    originEvidence = `Mentioned geographic origin: "${originMatch[0]}"`;
  }

  // Clean description assembly:
  // For Re-Review, NEVER use item.description if it was previous AI prose!
  // Instead, use baseline.original_description or parse original raw description from legacy notes.
  let rawDesc = '';
  if (isRenormalization) {
    if (baseline?.original_description) {
      rawDesc = baseline.original_description;
    } else if (item.legacy_assessment_notes) {
      const rawMatch = item.legacy_assessment_notes.match(/=== ORIGINAL RAW DESCRIPTION ===\s*([\s\S]*?)(?:===|$)/i);
      rawDesc = rawMatch ? rawMatch[1].trim() : '';
    }
  }

  // If never normalized, or if no baseline description exists, use item.description
  if (!rawDesc && (!isRenormalization || item.normalization_status !== 'normalized')) {
    rawDesc = item.description || '';
  }

  let cleanDesc = cleanDescriptionText(rawDesc);

  // If clean description is empty, too short, or was conversational filler,
  // synthesize authoritative curatorial description using confirmed facts:
  if (!cleanDesc || cleanDesc.length < 5) {
    const makerStr = item.maker ? ` manufactured by ${item.maker}` : '';
    const dimStr = item.dimensions ? ` (${item.dimensions})` : '';

    if (activeLevel === 'BASIC') {
      cleanDesc = `${item.title || 'Household item'}, ordinary estate decorative or utilitarian object.`;
    } else if (activeLevel === 'STANDARD') {
      cleanDesc = `${item.title || 'Estate equipment'}${makerStr}${era ? `, circa ${era}` : ''}${materials ? `, composed of ${materials.toLowerCase()}` : ''}${dimStr}.`;
    } else {
      // Historical / Collectible
      if (/desert glass|impactite/i.test(text + ' ' + (item.title || ''))) {
        cleanDesc = `Natural specimen of Libyan Desert Glass (cosmic impactite silica glass)${origin ? `, originating from the ${origin}` : ' from the Great Sand Sea region'}${dimStr}.`;
      } else {
        cleanDesc = `${item.title || 'Estate artifact'}${origin ? `, from ${origin}` : ''}${era ? `, likely dating to ${era}` : ''}${materials ? `. Handcrafted or manufactured from ${materials.toLowerCase()}` : ''}${dimStr}.`;
      }
    }
  }

  // Final validation pass through cleanDescriptionText
  cleanDesc = cleanDescriptionText(cleanDesc);

  // Acquisition context (only for Historical/Collectible or Standard items)
  let acquisitionContext = null;
  if (activeLevel === 'HISTORICAL_COLLECTIBLE') {
    if (/bali|indonesia/i.test(origin || text)) {
      acquisitionContext = "Carved decorative objects of this style were widely produced in Bali and made available to international travelers, tourists, and merchant seamen visiting Indonesian ports during the 1960s and 1970s.";
    } else if (/great\s+lakes|navigation|maritime/i.test(text)) {
      acquisitionContext = "Maritime equipment and navigational records of this period were standard fixtures aboard commercial Great Lakes transport vessels and port facilities.";
    } else if (/libyan|desert glass/i.test(text)) {
      acquisitionContext = "Specimens of Libyan Desert Glass have been collected by geological expeditions, travelers, and desert traders in the Great Sand Sea region between Egypt and Libya.";
    } else if (origin) {
      acquisitionContext = `Objects of this type were typically acquired in regional markets or port cities in ${origin} during the mid-20th century.`;
    }
  }

  // Jim-specific provenance
  let jimConnectionType = 'UNKNOWN';
  let jimConnectionNotes = null;
  if (/maritime|ship|great\s+lakes|navigation|sextant/i.test(text)) {
    jimConnectionType = 'REASONABLE_INFERENCE';
    jimConnectionNotes = "Uncle Jim served in the merchant marine and lived near maritime waterways; this equipment is consistent with maritime service, though direct vessel assignment logs are unverified.";
  } else if (/bali|indonesia|india|china|philippines/i.test(origin || text)) {
    jimConnectionType = 'REASONABLE_INFERENCE';
    jimConnectionNotes = `Uncle Jim's international voyages included calls in this region. The period of the item is consistent with his travel timeframe, although specific purchase receipts have not been located.`;
  } else {
    jimConnectionType = 'UNKNOWN';
    jimConnectionNotes = "No specific documentation or family story currently connects this object to a documented voyage or event.";
  }

  // Legacy / Collection significance
  let legacySignificance = 'none';
  let legacySignificanceReason = null;
  if (activeLevel === 'HISTORICAL_COLLECTIBLE') {
    legacySignificance = 'significant';
    legacySignificanceReason = "Candidate for Jim's life & travel collection due to historical, maritime, or ethnographic characteristics.";
  } else if (activeLevel === 'STANDARD') {
    legacySignificance = 'possible';
    legacySignificanceReason = "Functional or vintage household equipment with potential secondary estate interest.";
  } else {
    legacySignificance = 'none';
    legacySignificanceReason = "Ordinary estate item; standard family distribution.";
  }

  // Separate confidence ratings
  let identificationConfidence = 'MEDIUM';
  let identificationConfidenceReason = 'Identified from legacy title and record context.';
  let valueConfidence = lowVal ? 'MEDIUM' : 'LOW';
  let valueConfidenceReason = lowVal ? 'Estimated from legacy notes appraisal figures.' : 'No recorded pricing in legacy notes.';

  // Verification needed
  let verificationNeeded = null;
  const adminQuestions = [];
  if (/desert glass/i.test(text)) {
    identificationConfidence = 'LOW';
    identificationConfidenceReason = 'Desert glass identification requires verification of specific gravity and gemological characteristics.';
    verificationNeeded = "Visual inspection and specific gravity or refractive testing needed to confirm natural impactite vs synthetic glass.";
    adminQuestions.push("Do you have documentation, accession tags, or a test report for this specimen?");
  } else if (activeLevel === 'HISTORICAL_COLLECTIBLE') {
    if (!item.identifying_marks && !/mark|signature/i.test(text)) {
      verificationNeeded = "Check underside or reverse for maker's marks, signatures, or workshop stamps to increase attribution confidence.";
      adminQuestions.push("Is there any stamp, signature, or serial number on the base or reverse?");
    }
  }

  // Conflicts
  const conflicts = [];
  if (item.origin && origin && item.origin.toLowerCase() !== origin.toLowerCase()) {
    conflicts.push({
      field: 'origin',
      existingValue: item.origin,
      extractedValue: origin,
      explanation: `Existing origin record is "${item.origin}", but legacy text references "${origin}".`
    });
  }

  // Build research sources array from legacy sources
  const formattedSources = legacySources.map(s => ({
    sourceType: s.source_type,
    websiteOrOrg: s.website_or_org,
    title: s.title,
    url: s.url,
    originalUrl: s.original_url,
    sourceDate: s.source_date,
    listingDate: s.listing_date,
    askingPrice: s.asking_price,
    soldPrice: s.sold_price,
    currency: s.currency,
    status: s.status,
    relevance: s.relevance,
    usedFor: s.used_for,
    notes: s.notes
  }));

  return {
    researchLevel: activeLevel,
    researchLevelReason: `Classified as ${activeLevel} based on item characteristics and curatorial significance.`,
    recommendedResearchLevel: recommendedLevel,
    activeResearchLevel: activeLevel,
    proposedTitle: item.title,
    cleanDescription: cleanDesc,
    origin: origin || null,
    era: era || null,
    materials: materials || null,
    maker: item.maker || null,
    model: item.model || null,
    identifyingMarks: item.identifying_marks || null,
    acquisitionContext,
    jimConnectionType,
    jimConnectionNotes,
    provenanceText: item.provenance_text || null,
    dimensions: item.dimensions || null,
    condition: item.condition || null,
    estimatedValueLow: lowVal,
    estimatedValueHigh: highVal,
    thresholdStatus,
    valueBasis,
    legacySignificance,
    legacySignificanceReason,
    identificationConfidence,
    identificationConfidenceReason,
    valueConfidence,
    valueConfidenceReason,
    verificationNeeded,
    adminQuestions,
    appraisalRecommended: Boolean(highVal && highVal >= 1000),
    appraisalReason: highVal && highVal >= 1000 ? 'High-value threshold exceeded ($1,000+)' : null,
    researchSources: formattedSources,
    evidence: {
      title: 'Current item title',
      description: item.description ? 'Parsed from legacy text' : null,
      origin: originEvidence,
      era: eraEvidence,
      materials: matEvidence,
      valuation: valuationEvidence
    },
    conflicts,
    modelUsed: 'curatorial_heuristic_engine_v2',
    extractionMode: 'deterministic_fallback'
  };
}
