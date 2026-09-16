// Legacy Data Normalization Service for Uncle Jim's Estate App
// Analyzes existing item text (description, notes, value) to extract structured fields.
// Strictly extraction of existing information — NO new web research or invented facts.

export async function extractLegacyData(item, apiKey = process.env.GEMINI_API_KEY) {
  const combinedText = [
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

  if (apiKey) {
    try {
      const result = await callGeminiStructuredExtraction(item, combinedText, apiKey);
      if (result) return result;
    } catch (err) {
      console.warn('[LegacyNormalization] Gemini API call failed or timed out, falling back to local extractor:', err.message);
    }
  }

  // Fallback heuristic extractor when API key is not present or offline
  return fallbackHeuristicExtraction(item, combinedText);
}

async function callGeminiStructuredExtraction(item, combinedText, apiKey) {
  const systemInstruction = `You are a curatorial archivist normalizing legacy estate inventory records for Uncle Jim's Estate.
Many records contain notes copied from prior AI conversations that mix physical descriptions, era, maker, valuation, comps, and conversational filler.

YOUR TASK: Extract ONLY information that is ALREADY explicitly or strongly stated in the provided text.
CRITICAL RULES:
1. EXTRACTION ONLY: Do NOT perform web research, do NOT invent facts, do NOT guess unknown makers or dates.
2. CLEAN DESCRIPTION: Generate a clean, natural object description describing:
   - What the object is
   - Approximate era/timeframe (if supported)
   - Geographic/cultural origin (if supported)
   - Physical materials (if supported)
   - Maker/artist (if supported)
   - Notable physical, artistic, or historical characteristics
   STRICTLY FORBIDDEN IN CLEAN DESCRIPTION:
   - Do NOT include dollar values, sale prices, or estate-sale estimates in the description.
   - Do NOT include AI commentary, confidence remarks, research instructions, or conversational filler.
3. VALUATION:
   - Extract numeric ranges into estimatedValueLow and estimatedValueHigh.
   - Put valuation rationale and comparable sales mentions into valueBasis.
   - Do NOT create a distribution value.
4. TRAVEL & PROVENANCE:
   - If an object is from a foreign country (e.g. China, Philippines) and dates from a period when Jim traveled, do NOT state he acquired it on a specific voyage unless explicit documentation or receipt is mentioned.
5. CONFLICTS:
   - If the existing record says one thing (e.g. Origin: China) and the notes say something contradictory (e.g. "Japanese origin"), record this in the conflicts array.
6. UNKNOWN FIELDS:
   - If a field is not supported by the text, return null. Blank is strictly preferred over hallucinated data.

Respond with strict JSON matching the requested schema.`;

  const prompt = `Analyze this existing legacy inventory record and extract structured fields:

${combinedText}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          proposedTitle: { type: "STRING" },
          cleanDescription: { type: "STRING" },
          origin: { type: "STRING", nullable: true },
          era: { type: "STRING", nullable: true },
          materials: { type: "STRING", nullable: true },
          maker: { type: "STRING", nullable: true },
          identifyingMarks: { type: "STRING", nullable: true },
          provenanceText: { type: "STRING", nullable: true },
          dimensions: { type: "STRING", nullable: true },
          condition: { type: "STRING", nullable: true },
          estimatedValueLow: { type: "NUMBER", nullable: true },
          estimatedValueHigh: { type: "NUMBER", nullable: true },
          valueBasis: { type: "STRING", nullable: true },
          assessmentConfidence: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"], nullable: true },
          confidenceReason: { type: "STRING", nullable: true },
          appraisalRecommended: { type: "BOOLEAN" },
          appraisalReason: { type: "STRING", nullable: true },
          evidence: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", nullable: true },
              description: { type: "STRING", nullable: true },
              origin: { type: "STRING", nullable: true },
              era: { type: "STRING", nullable: true },
              materials: { type: "STRING", nullable: true },
              maker: { type: "STRING", nullable: true },
              identifyingMarks: { type: "STRING", nullable: true },
              provenanceText: { type: "STRING", nullable: true },
              dimensions: { type: "STRING", nullable: true },
              condition: { type: "STRING", nullable: true },
              valuation: { type: "STRING", nullable: true },
              confidence: { type: "STRING", nullable: true }
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
        required: ["proposedTitle", "cleanDescription", "appraisalRecommended"]
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
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty Gemini response content');

      const parsed = JSON.parse(rawText);
      parsed.modelUsed = model;
      parsed.extractionMode = 'ai_gemini';
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function fallbackHeuristicExtraction(item, combinedText) {
  const text = (item.description || '') + ' ' + (item.special_handling_notes || '') + ' ' + (item.value || '');
  
  // Extract dollar figures: e.g. "$800 - $1,200" or "$300" or "$150-$250"
  let lowVal = null;
  let highVal = null;
  let valueBasis = null;
  let valuationEvidence = null;

  const rangeMatch = text.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\s*(?:-|to|–)\s*\$?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/i);
  if (rangeMatch) {
    lowVal = parseFloat(rangeMatch[1].replace(/,/g, ''));
    highVal = parseFloat(rangeMatch[2].replace(/,/g, ''));
    valuationEvidence = rangeMatch[0];
    valueBasis = `Legacy valuation notes indicate an estimated value range of ${rangeMatch[0]}.`;
  } else {
    const singleMatch = text.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/);
    if (singleMatch) {
      lowVal = parseFloat(singleMatch[1].replace(/,/g, ''));
      highVal = lowVal;
      valuationEvidence = singleMatch[0];
      valueBasis = `Legacy notes reference a valuation of ${singleMatch[0]}.`;
    }
  }

  // Extract era
  let era = item.era || null;
  let eraEvidence = null;
  const eraMatch = text.match(/(?:19th\s+century|20th\s+century|mid-(?:to-late\s+)?20th\s+century|19[2-9]0s|circa\s+[0-9]{4}|c\.\s*[0-9]{4}|WWII|[0-9]{4})/i);
  if (eraMatch && !era) {
    era = eraMatch[0];
    eraEvidence = `Extracted from legacy text: "${eraMatch[0]}"`;
  }

  // Extract materials hints
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
  if (matHints.length > 0 && !materials) {
    materials = [...new Set(matHints)].join(', ');
    matEvidence = `Mentioned materials in legacy notes: ${materials}`;
  }

  // Extract origin hints
  let origin = item.origin || null;
  let originEvidence = null;
  const originMatch = text.match(/\b(Bali|Indonesia|China|Japan|India|Philippines|Great\s+Lakes|Wisconsin|Manitowish\s+Waters|New\s+England|American)\b/i);
  if (originMatch && !origin) {
    origin = originMatch[0];
    originEvidence = `Mentioned geographic origin: "${originMatch[0]}"`;
  }

  // Generate clean description by stripping conversational filler and dollar values
  let cleanDesc = item.description || '';
  if (cleanDesc) {
    cleanDesc = cleanDesc
      .replace(/value:?\s*\$?[0-9,\s-]+/gi, '')
      .replace(/\$([0-9,]+)/g, '')
      .replace(/google\s+(?:believes|thinks|estimates)[^.]*\.?/gi, '')
      .replace(/similar\s+(?:examples|ones)\s+(?:sell|are)[^.]*\.?/gi, '')
      .replace(/quick\s+sale[^.]*\.?/gi, '')
      .replace(/need\s+picture[^.]*\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!cleanDesc || cleanDesc === 'undefined') {
    cleanDesc = `${item.title}${era ? `, dating to approximately ${era}` : ''}${materials ? `, composed of ${materials.toLowerCase()}` : ''}${origin ? `, from ${origin}` : ''}.`;
  }

  // Conflict detection
  const conflicts = [];
  if (item.origin && origin && item.origin.toLowerCase() !== origin.toLowerCase()) {
    conflicts.push({
      field: 'origin',
      existingValue: item.origin,
      extractedValue: origin,
      explanation: `Existing origin record is "${item.origin}", but legacy text references "${origin}".`
    });
  }

  return {
    proposedTitle: item.title,
    cleanDescription: cleanDesc,
    origin: origin || null,
    era: era || null,
    materials: materials || null,
    maker: item.maker || null,
    identifyingMarks: item.identifying_marks || null,
    provenanceText: item.provenance_text || null,
    dimensions: item.dimensions || null,
    condition: item.condition || null,
    estimatedValueLow: lowVal,
    estimatedValueHigh: highVal,
    valueBasis: valueBasis,
    assessmentConfidence: lowVal ? 'MEDIUM' : null,
    confidenceReason: lowVal ? 'Extracted directly from legacy appraisal figures recorded in notes.' : null,
    appraisalRecommended: false,
    appraisalReason: null,
    evidence: {
      title: 'Current item title',
      description: item.description ? 'Parsed from existing description' : null,
      origin: originEvidence,
      era: eraEvidence,
      materials: matEvidence,
      valuation: valuationEvidence
    },
    conflicts,
    modelUsed: 'heuristic_local_parser',
    extractionMode: 'deterministic_fallback'
  };
}
