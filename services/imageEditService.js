/**
 * Reusable OpenAI Images Edit Service
 *
 * Provides a clean, modular interface to OpenAI's /v1/images/edits endpoint.
 * Agnostic of application-specific domain logic, with curatorial museum photo helpers.
 */

import fs from 'fs';
import path from 'path';

export const MUSEUM_PHOTO_PROMPT = `Create a professional museum-catalog photograph of the exact artifact shown in the supplied source photograph.
The supplied photograph is the source of truth. Preserve the artifact's identity, geometry, proportions, construction, materials, colors, surface texture, decoration, text, labels, signatures, numbers, damage, scratches, wear, stains, chips, patina and all identifying characteristics.
Do not restore, repair, redesign, embellish, modernize, reinterpret or invent any portion of the artifact.
Change only the photographic presentation. Remove the household/environmental background and present the artifact on a neutral light-gray seamless museum studio background with soft diffuse professional lighting, realistic color, subtle natural contact shadow and a clean centered catalog composition.
If a ruler, yardstick, tape measure or other measuring device appears in the source photograph, remove it completely. Do not create a replacement ruler, scale, measurement markings or measurement text.
The result must depict the same physical artifact shown in the source photograph.`;

export const MUSEUM_BASE_PROMPT = MUSEUM_PHOTO_PROMPT;

/**
 * Determine MIME type based on file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Core generic image edit function.
 * Accepts one or multiple image paths/buffers and sends a multipart request to OpenAI.
 *
 * @param {Object} params
 * @param {Array<string|{buffer: Buffer, filename: string, mimeType?: string}>} params.images - Image file paths or buffer objects
 * @param {string} params.prompt - Prompt instruction
 * @param {Object} [params.options] - Optional override parameters
 * @param {string} [params.options.model='gpt-image-2.5-sunburst']
 * @param {string} [params.options.quality='high']
 * @param {number} [params.options.n=1]
 * @param {number} [params.options.timeoutMs=120000]
 * @param {string} [params.apiKey] - OpenAI API key (defaults to process.env.OPENAI_API_KEY)
 * @returns {Promise<{imageBuffer: Buffer, usage: Object|null}>}
 */
export async function editImages({
  images = [],
  prompt,
  options = {},
  apiKey = process.env.OPENAI_API_KEY
}) {
  const activeKey = apiKey || process.env.OPENAI_API_KEY;
  if (!activeKey || activeKey.trim() === '') {
    throw new Error('OPENAI_API_KEY is not configured in the environment.');
  }

  if (!images || images.length === 0) {
    throw new Error('At least one source image must be provided.');
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    throw new Error('A text prompt instruction is required.');
  }

  const model = options.model || 'gpt-image-2.5-sunburst';
  const quality = options.quality || 'high';
  const n = options.n || 1;
  const timeoutMs = options.timeoutMs || 120000;

  const formData = new FormData();
  formData.append('model', model);
  formData.append('prompt', prompt.trim());
  formData.append('quality', quality);
  formData.append('n', String(n));

  // Attach images
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    let fileBuffer;
    let filename;
    let mimeType;

    if (typeof item === 'string') {
      if (!fs.existsSync(item)) {
        throw new Error(`Source image file does not exist: ${item}`);
      }
      fileBuffer = fs.readFileSync(item);
      filename = path.basename(item);
      mimeType = getMimeType(item);
    } else if (item && item.buffer) {
      fileBuffer = item.buffer;
      filename = item.filename || `image_${i}.png`;
      mimeType = item.mimeType || 'image/png';
    } else {
      throw new Error(`Invalid image descriptor at index ${i}`);
    }

    const blob = new Blob([fileBuffer], { type: mimeType });

    // Single image uses 'image', multiple images use 'image[]' array syntax supported by gpt-image-2.5-sunburst
    if (images.length === 1) {
      formData.append('image', blob, filename);
    } else {
      formData.append('image[]', blob, filename);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeKey.trim()}`
      },
      body: formData,
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timer);
    if (netErr.name === 'AbortError') {
      throw new Error(`OpenAI Images Edit API timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw new Error(`Network failure communicating with OpenAI: ${netErr.message}`);
  } finally {
    clearTimeout(timer);
  }

  const rawText = await response.text();
  let jsonResult;
  try {
    jsonResult = JSON.parse(rawText);
  } catch (parseErr) {
    throw new Error(`OpenAI API returned non-JSON response (HTTP ${response.status}): ${rawText.slice(0, 300)}`);
  }

  if (!response.ok) {
    const errorMsg = jsonResult.error?.message || jsonResult.error || JSON.stringify(jsonResult);
    throw new Error(`OpenAI API error (HTTP ${response.status}): ${errorMsg}`);
  }

  if (!jsonResult.data || !Array.isArray(jsonResult.data) || jsonResult.data.length === 0) {
    throw new Error('OpenAI API returned an empty image data array.');
  }

  const firstItem = jsonResult.data[0];
  let imageBuffer = null;

  if (firstItem.b64_json) {
    imageBuffer = Buffer.from(firstItem.b64_json, 'base64');
  } else if (firstItem.url) {
    const downloadRes = await fetch(firstItem.url);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download image from OpenAI result URL (HTTP ${downloadRes.status})`);
    }
    const arrBuf = await downloadRes.arrayBuffer();
    imageBuffer = Buffer.from(arrBuf);
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('OpenAI API returned unreadable or empty image data.');
  }

  return {
    imageBuffer,
    usage: jsonResult.usage || null
  };
}

/**
 * Generate initial museum catalog photo from a single original photograph.
 */
export async function generateMuseumPhoto({
  originalImagePath,
  options = {},
  apiKey
}) {
  return editImages({
    images: [originalImagePath],
    prompt: MUSEUM_PHOTO_PROMPT,
    options,
    apiKey
  });
}

/**
 * Revise an existing museum photo draft using dual-image anchoring:
 * Image 1: The original photograph (source of truth for physical artifact identity)
 * Image 2: The current draft museum photo (presentation to be adjusted)
 */
export async function reviseMuseumPhoto({
  originalImagePath,
  currentDraftPath,
  instruction,
  options = {},
  apiKey
}) {
  if (!instruction || typeof instruction !== 'string' || instruction.trim() === '') {
    throw new Error('Revision instructions cannot be empty.');
  }

  const revisionPrompt = `Image 1 is the original source artifact photograph and the primary reference for the physical object's identity, geometry, proportions, construction, materials, colors, surface texture, decoration, text, labels, signatures, numbers, wear, and identifying details.
Image 2 is the current draft museum photograph.
Revise the photographic presentation of Image 2 according to these specific instructions:
${instruction.trim()}

Curatorial requirements:
- The supplied photograph (Image 1) is the source of truth. Preserve the artifact's identity, geometry, proportions, construction, materials, colors, surface texture, decoration, text, labels, signatures, numbers, damage, scratches, wear, stains, chips, patina and all identifying characteristics.
- Do not restore, repair, redesign, embellish, modernize, reinterpret or invent any portion of the artifact.
- Maintain the neutral light-gray seamless museum studio background, soft diffuse professional lighting, realistic color, subtle natural contact shadow, and a clean centered catalog composition.
- If a ruler, yardstick, tape measure or other measuring device appears, remove it completely. Do not create a replacement ruler, scale, or markings.
- The output must depict the exact physical artifact shown in Image 1.`;

  return editImages({
    images: [originalImagePath, currentDraftPath],
    prompt: revisionPrompt,
    options,
    apiKey
  });
}
