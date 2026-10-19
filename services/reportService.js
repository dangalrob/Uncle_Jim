import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { 
  Document as DocxDocument, 
  Packer as DocxPacker, 
  Paragraph as DocxParagraph, 
  TextRun as DocxTextRun, 
  ImageRun as DocxImageRun, 
  Table as DocxTable, 
  TableRow as DocxTableRow, 
  TableCell as DocxTableCell, 
  AlignmentType as DocxAlignmentType, 
  WidthType as DocxWidthType, 
  BorderStyle as DocxBorderStyle, 
  PageNumber as DocxPageNumber, 
  Header as DocxHeader,
  Footer as DocxFooter
} from 'docx';
import { cleanDescriptionText } from './itemAssessmentEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export const AVAILABLE_FIELDS = [
  { id: 'item_number', label: 'Item Number', defaultSelected: true, defaultOrder: 1, width: 14 },
  { id: 'title', label: 'Title', defaultSelected: true, defaultOrder: 2, width: 35 },
  { id: 'category', label: 'Category', defaultSelected: true, defaultOrder: 3, width: 22 },
  { id: 'normalized_description', label: 'Normalized Description', defaultSelected: true, defaultOrder: 4, width: 50 },
  { id: 'original_description', label: 'Original / Raw Legacy Description', defaultSelected: true, defaultOrder: 5, width: 50 },
  { id: 'estimated_value', label: 'Estimated Value', defaultSelected: true, defaultOrder: 6, width: 20 },
  { id: 'normalized_valuation', label: 'Normalized Valuation / Assessment', defaultSelected: false, defaultOrder: 7, width: 25 },
  { id: 'original_value', label: 'Original Recorded Value (Baseline Snapshot)', defaultSelected: false, defaultOrder: 8, width: 25 },
  { id: 'destination', label: 'Destination', defaultSelected: true, defaultOrder: 9, width: 16 },
  { id: 'institution', label: 'Institution', defaultSelected: true, defaultOrder: 10, width: 24 },
  { id: 'assigned_to', label: 'Assigned To', defaultSelected: false, defaultOrder: 11, width: 22 },
  { id: 'dimensions', label: 'Dimensions', defaultSelected: false, defaultOrder: 12, width: 20 },
  { id: 'location', label: 'Location', defaultSelected: false, defaultOrder: 13, width: 22 },
  { id: 'notes', label: 'Notes', defaultSelected: false, defaultOrder: 14, width: 35 },
  { id: 'family_status', label: 'Family Review Status', defaultSelected: false, defaultOrder: 15, width: 18 },
  { id: 'museum_photo_url', label: 'Primary Museum Photo URL', defaultSelected: false, defaultOrder: 16, width: 35 },
  { id: 'original_photo_url', label: 'Primary Original Photo URL', defaultSelected: false, defaultOrder: 17, width: 35 }
];

export const POPULATIONS = [
  {
    id: 'all',
    label: 'All Items',
    description: 'Every cataloged item in the estate inventory',
    where: '1=1'
  },
  {
    id: 'maritime',
    label: 'Maritime Museum Items',
    description: 'Items where Institutional candidate is designated as Maritime Museum',
    where: "i.institutional_candidate = 'Maritime Museum'"
  },
  {
    id: 'institution',
    label: 'Institution Items (All Candidates)',
    description: 'Items marked for institutional destination or candidate donation',
    where: "(i.destination = 'institution' OR (i.institutional_candidate IS NOT NULL AND i.institutional_candidate != '' AND i.institutional_candidate != 'None'))"
  },
  {
    id: 'institution_confirmed',
    label: 'Institution Items (Confirmed Destination Only)',
    description: 'Items where destination is strictly confirmed as institution',
    where: "i.destination = 'institution'"
  },
  {
    id: 'family',
    label: 'Family Items',
    description: 'Items designated for distribution to family members',
    where: "i.destination = 'family'"
  },
  {
    id: 'estate_sale',
    label: 'Estate Sale Items',
    description: 'Items designated for liquidation or public estate sale',
    where: "i.destination = 'estate_sale'"
  },
  {
    id: 'undecided',
    label: 'Undecided Items',
    description: 'Items whose final destination has not yet been resolved',
    where: "i.destination = 'undecided'"
  }
];

export function cleanForMuseumCatalog(desc) {
  if (!desc) return 'No curatorial description recorded.';
  let text = desc;
  
  // Strip image markers like [image_lEcxcJ.png]
  text = text.replace(/\[image_[a-zA-Z0-9_\.]+\]/gi, '');

  // Strip ASCII art diagram boxes
  text = text.replace(/_{2,}[\s\S]*?\[\s*Original Presentation Case\s*\]/gi, '');

  // Strip valuation / market advice sections
  text = text.replace(/##?\s*(?:Market\s+Value|Valuation|Financial\s+Assessment|What\s+is\s+its\s+value\?|Market\s+Dynamics|Value\s+Drivers|Collector\s+Appeal)[\s\S]*?(?=(?:##|\n\n[A-Z]|$))/gi, '');
  text = text.replace(/\b(?:Estimated\s+)?(?:Market\s+Value|Fair\s+Market|Liquidation|Auction|Replacement)[^.\n]*\.?/gi, '');
  
  // Strip closing conversational prompts
  text = text.replace(/(?:If you would like|Are you assembling|Let me know if|To help the family|Like your other certificates)[\s\S]*$/gi, '');

  // Strip section heading hashes and leading bullet stars
  text = text.replace(/^#+\s+/gm, '');
  text = text.replace(/^\*\s+/gm, '');

  // Clean using the existing itemAssessmentEngine safety validator
  text = cleanDescriptionText(text);

  // Clean remaining punctuation & excess whitespace
  text = text.replace(/\s*–\s*$/m, '');
  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();
}

/**
 * Fetch and shape report items based on population filter and custom criteria
 */
export async function fetchReportRows({ population = 'all', customFilter = {}, estateId, dbAll }) {
  let whereClause = '1=1';
  const params = [];

  const matchedPop = POPULATIONS.find(p => p.id === population);
  if (matchedPop) {
    whereClause = matchedPop.where;
  } else if (population === 'custom') {
    const conditions = [];
    if (customFilter.destination) {
      conditions.push('i.destination = ?');
      params.push(customFilter.destination);
    }
    if (customFilter.categoryId) {
      conditions.push('i.category_id = ?');
      params.push(customFilter.categoryId);
    }
    if (customFilter.institutionalCandidate) {
      conditions.push('LOWER(COALESCE(i.institutional_candidate, "")) LIKE ?');
      params.push(`%${customFilter.institutionalCandidate.toLowerCase()}%`);
    }
    if (conditions.length > 0) {
      whereClause = conditions.join(' AND ');
    }
  }

  if (estateId) {
    whereClause = `(${whereClause}) AND (i.estate_id = ? OR i.estate_id IS NULL)`;
    params.push(estateId);
  }

  const query = `
    SELECT 
      i.id,
      i.item_number,
      i.title,
      c.name as category,
      i.description as normalized_description,
      COALESCE(s.original_description, i.legacy_assessment_notes, i.description) as original_description,
      i.value as estimated_value,
      COALESCE(s.original_value, i.value) as original_value,
      i.distribution_value,
      i.estimated_value_low,
      i.estimated_value_high,
      i.value_basis,
      i.destination,
      COALESCE(i.institutional_name, i.institutional_candidate) as institution,
      (SELECT u.name FROM assignments a JOIN users u ON a.recipient_user_id = u.id WHERE a.item_id = i.id LIMIT 1) as assigned_to,
      i.dimensions,
      i.location_in_house as location,
      COALESCE(i.special_handling_notes, i.legacy_assessment_notes) as notes,
      i.photo_review_status as family_status,
      i.museum_photo_url,
      (SELECT p.photo_url FROM item_photos p WHERE p.item_id = i.id AND p.is_primary = 1 LIMIT 1) as original_photo_url
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN item_legacy_snapshots s ON s.item_id = i.id AND s.snapshot_type = 'PRE_NORMALIZATION_BASELINE'
    ${population === 'maritime' ? 'LEFT JOIN maritime_catalog_order mco ON mco.item_id = i.id' : ''}
    WHERE ${whereClause}
    ORDER BY 
      ${population === 'maritime' ? 'CASE WHEN mco.order_index IS NOT NULL THEN 0 ELSE 1 END ASC, mco.order_index ASC,' : ''}
      CAST(SUBSTR(i.item_number, 4) AS INTEGER) ASC, i.item_number ASC
  `;

  const rawRows = await dbAll(query, params);

  // Format fields for export
  return rawRows.map(r => {
    // Format Normalized Valuation
    let normVal = '';
    if (r.distribution_value !== null && r.distribution_value !== undefined) {
      normVal = `$${Number(r.distribution_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (r.value_basis) normVal += ` (${r.value_basis})`;
    } else if (r.estimated_value_low !== null && r.estimated_value_high !== null) {
      normVal = `$${r.estimated_value_low} – $${r.estimated_value_high}`;
      if (r.value_basis) normVal += ` (${r.value_basis})`;
    } else if (r.value_basis) {
      normVal = r.value_basis;
    }

    // Format Destination
    let destLabel = r.destination || 'Undecided';
    if (destLabel === 'estate_sale') destLabel = 'Estate Sale';
    else if (destLabel === 'institution') destLabel = 'Institution';
    else if (destLabel === 'family') destLabel = 'Family';
    else if (destLabel === 'undecided') destLabel = 'Undecided';
    else if (destLabel === 'charity') destLabel = 'Charity';

    // Preserve exact stored text from items.value for Estimated Value (no conversion, no midpoints, no reformatting)
    const exactEstimatedValue = r.estimated_value !== null && r.estimated_value !== undefined ? String(r.estimated_value) : '';

    return {
      id: r.id,
      item_number: r.item_number || '',
      title: r.title || '',
      category: r.category || 'Uncategorized',
      normalized_description: r.normalized_description || '',
      original_description: r.original_description || '',
      estimated_value: exactEstimatedValue,
      value: exactEstimatedValue,
      original_value: r.original_value !== null && r.original_value !== undefined ? String(r.original_value) : '',
      normalized_valuation: normVal,
      destination: destLabel,
      institution: r.institution || '',
      assigned_to: r.assigned_to || '',
      dimensions: r.dimensions || '',
      location: r.location || '',
      notes: r.notes || '',
      family_status: r.family_status || 'Unreviewed',
      museum_photo_url: r.museum_photo_url || '',
      original_photo_url: r.original_photo_url || ''
    };
  });
}

/**
 * Generate RFC-4180 compliant CSV string
 */
export function generateCsv(rows, selectedFieldKeys) {
  const fieldDefs = selectedFieldKeys
    .map(key => AVAILABLE_FIELDS.find(f => f.id === key))
    .filter(Boolean);

  const headerLine = fieldDefs.map(f => `"${f.label.replace(/"/g, '""')}"`).join(',');
  const lines = [headerLine];

  for (const r of rows) {
    const rowValues = fieldDefs.map(f => {
      const val = r[f.id] === null || r[f.id] === undefined ? '' : String(r[f.id]);
      return `"${val.replace(/"/g, '""')}"`;
    });
    lines.push(rowValues.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Generate formatted Excel (.xlsx) buffer
 */
export async function generateExcel(rows, selectedFieldKeys, sheetTitle = 'Inventory Report') {
  const fieldDefs = selectedFieldKeys
    .map(key => AVAILABLE_FIELDS.find(f => f.id === key))
    .filter(Boolean);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Uncle Jim's Estate Management";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetTitle.slice(0, 31));

  worksheet.columns = fieldDefs.map(f => ({
    header: f.label,
    key: f.id,
    width: f.width || 25
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' } // Navy blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Add data rows
  rows.forEach(r => {
    worksheet.addRow(r);
  });

  // Style data cells
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: 'top', wrapText: true };
      row.font = { size: 10 };
      // Alternating row background for readability
      if (rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' }
        };
      }
    }
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * Helper to prepare and convert image to PNG buffer with max width 450px
 */
async function prepareCatalogImage(photoUrl) {
  if (!photoUrl) return null;
  const cleanPath = photoUrl.startsWith('/') ? photoUrl.slice(1) : photoUrl;
  const localFile = path.resolve(projectRoot, cleanPath);

  let rawBuffer = null;
  if (fs.existsSync(localFile)) {
    try {
      rawBuffer = fs.readFileSync(localFile);
    } catch (e) {
      console.warn(`Could not read local file ${localFile}:`, e.message);
    }
  }

  // Fallback to production URL if local file is missing
  if (!rawBuffer) {
    try {
      const prodUrl = `https://uncle-jim.onrender.com/${cleanPath}`;
      const res = await fetch(prodUrl);
      if (res.ok) {
        rawBuffer = Buffer.from(await res.arrayBuffer());
      }
    } catch (e) {
      // Ignore network errors gracefully
    }
  }

  if (!rawBuffer) return null;

  try {
    const pngBuffer = await sharp(rawBuffer)
      .resize({ width: 450, withoutEnlargement: true })
      .png()
      .toBuffer();
    const meta = await sharp(pngBuffer).metadata();
    return { buffer: pngBuffer, width: meta.width, height: meta.height };
  } catch (err) {
    console.warn(`Error converting image for PDF: ${cleanPath}`, err.message);
    return null;
  }
}

/**
 * Helper to prepare image for Word document with scaled dimensions
 */
async function prepareCatalogImageForWord(photoUrl) {
  if (!photoUrl) return null;
  const cleanPath = photoUrl.startsWith('/') ? photoUrl.slice(1) : photoUrl;
  const localFile = path.resolve(projectRoot, cleanPath);

  let rawBuffer = null;
  if (fs.existsSync(localFile)) {
    try {
      rawBuffer = fs.readFileSync(localFile);
    } catch (e) {
      console.warn(`Could not read local file ${localFile}:`, e.message);
    }
  }

  // Fallback to production URL if local file is missing
  if (!rawBuffer) {
    try {
      const prodUrl = `https://uncle-jim.onrender.com/${cleanPath}`;
      const res = await fetch(prodUrl);
      if (res.ok) {
        rawBuffer = Buffer.from(await res.arrayBuffer());
      }
    } catch (e) {
      // Ignore network errors gracefully
    }
  }

  if (!rawBuffer) return null;

  try {
    const pngBuffer = await sharp(rawBuffer)
      .resize({ width: 300, height: 300, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const meta = await sharp(pngBuffer).metadata();

    let targetWidth = 125;
    let targetHeight = 100;
    if (meta.width && meta.height) {
      const aspect = meta.width / meta.height;
      targetWidth = 125;
      targetHeight = Math.round(125 / aspect);
      if (targetHeight > 150) {
        targetHeight = 150;
        targetWidth = Math.round(150 * aspect);
      }
    }

    return { buffer: pngBuffer, width: targetWidth, height: targetHeight };
  } catch (err) {
    console.warn(`Error converting image for Word: ${cleanPath}`, err.message);
    return null;
  }
}

/**
 * Generate Maritime Museum Microsoft Word (.docx) Curatorial Catalog
 */
export async function generateMaritimeCatalogDocx({ estateId, dbAll }) {
  const query = `
    SELECT 
      i.id, 
      i.item_number, 
      i.title, 
      c.name as category,
      i.dimensions,
      i.description, 
      i.museum_photo_url
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN maritime_catalog_order mco ON mco.item_id = i.id
    WHERE i.institutional_candidate = 'Maritime Museum'
      ${estateId ? 'AND (i.estate_id = ? OR i.estate_id IS NULL)' : ''}
    ORDER BY 
      CASE WHEN mco.order_index IS NOT NULL THEN 0 ELSE 1 END ASC,
      mco.order_index ASC,
      CAST(SUBSTR(i.item_number, 4) AS INTEGER) ASC,
      i.item_number ASC
  `;

  const items = await dbAll(query, estateId ? [estateId] : []);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `uncle-jim-maritime-museum-catalog-${dateSlug}.docx`;

  const itemBlocks = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const imgData = await prepareCatalogImageForWord(item.museum_photo_url);

    const itemNumStr = item.item_number ? String(item.item_number) : 'CATALOG ITEM';
    const titleStr = item.title || 'Untitled Object';
    const descStr = cleanForMuseumCatalog(item.description);

    // Left column: Photo or placeholder
    const leftCellParagraphs = [];
    if (imgData) {
      leftCellParagraphs.push(
        new DocxParagraph({
          alignment: DocxAlignmentType.CENTER,
          children: [
            new DocxImageRun({
              data: imgData.buffer,
              transformation: {
                width: imgData.width,
                height: imgData.height
              }
            })
          ],
          spacing: { before: 60, after: 60 }
        })
      );
    } else {
      leftCellParagraphs.push(
        new DocxParagraph({
          alignment: DocxAlignmentType.CENTER,
          children: [
            new DocxTextRun({
              text: '[No Museum Photo]',
              italics: true,
              color: '9CA3AF',
              size: 16 // 8pt
            })
          ],
          spacing: { before: 180, after: 180 }
        })
      );
    }

    // Right column: Item Number, Title, Metadata, Description
    const rightCellParagraphs = [
      new DocxParagraph({
        children: [
          new DocxTextRun({
            text: itemNumStr,
            bold: true,
            color: '1E3A8A', // Deep navy
            size: 22 // 11pt
          })
        ],
        spacing: { before: 40, after: 40 }
      }),
      new DocxParagraph({
        children: [
          new DocxTextRun({
            text: titleStr,
            bold: true,
            color: '111827', // Charcoal
            size: 22 // 11pt
          })
        ],
        spacing: { before: 0, after: 80 }
      })
    ];

    // Optional metadata row (Category, Dimensions) if present
    const metaParts = [];
    if (item.category && item.category !== 'Uncategorized') {
      metaParts.push(`Category: ${item.category}`);
    }
    if (item.dimensions) {
      metaParts.push(`Dimensions: ${item.dimensions}`);
    }
    if (metaParts.length > 0) {
      rightCellParagraphs.push(
        new DocxParagraph({
          children: [
            new DocxTextRun({
              text: metaParts.join('   |   '),
              color: '4B5563',
              size: 18, // 9pt
              italics: true
            })
          ],
          spacing: { before: 0, after: 80 }
        })
      );
    }

    // Normalized curatorial description
    rightCellParagraphs.push(
      new DocxParagraph({
        children: [
          new DocxTextRun({
            text: descStr,
            color: '374151',
            size: 19 // 9.5pt
          })
        ],
        spacing: { line: 260, before: 0, after: 80 }
      })
    );

    // 2-column table for side-by-side artifact layout
    const itemTable = new DocxTable({
      width: { size: 100, type: DocxWidthType.PERCENTAGE },
      borders: {
        top: { style: DocxBorderStyle.NONE },
        left: { style: DocxBorderStyle.NONE },
        right: { style: DocxBorderStyle.NONE },
        bottom: { 
          style: i < items.length - 1 ? DocxBorderStyle.SINGLE : DocxBorderStyle.NONE, 
          size: 4, 
          color: 'E5E7EB' 
        },
        insideHorizontal: { style: DocxBorderStyle.NONE },
        insideVertical: { style: DocxBorderStyle.NONE }
      },
      rows: [
        new DocxTableRow({
          cantSplit: true, // Protected pagination: keep each artifact block intact
          children: [
            new DocxTableCell({
              width: { size: 24, type: DocxWidthType.PERCENTAGE },
              children: leftCellParagraphs,
              margins: { top: 120, bottom: 120, left: 100, right: 140 }
            }),
            new DocxTableCell({
              width: { size: 76, type: DocxWidthType.PERCENTAGE },
              children: rightCellParagraphs,
              margins: { top: 120, bottom: 120, left: 140, right: 100 }
            })
          ]
        })
      ]
    });

    itemBlocks.push(itemTable);
    if (i < items.length - 1) {
      itemBlocks.push(new DocxParagraph({ spacing: { before: 80, after: 80 } }));
    }
  }

  // Construct Document
  const doc = new DocxDocument({
    creator: 'Uncle Jim Estate Curatorial System',
    title: 'Uncle Jim Estate — Maritime Museum Curatorial Catalog',
    description: 'Formal publication catalog of maritime artifacts for curator presentation and accession review.',
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 20
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080,    // 0.75 inch
              bottom: 1080,
              left: 1080,
              right: 1080
            }
          }
        },
        headers: {
          default: new DocxHeader({
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.RIGHT,
                children: [
                  new DocxTextRun({
                    text: 'Uncle Jim Estate — Maritime Museum Collection',
                    italics: true,
                    color: '9CA3AF',
                    size: 16 // 8pt
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new DocxFooter({
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'Uncle Jim Estate  •  Maritime Museum Collection  •  Page ',
                    color: '9CA3AF',
                    size: 16
                  }),
                  new DocxTextRun({
                    children: [DocxPageNumber.CURRENT],
                    color: '9CA3AF',
                    size: 16
                  }),
                  new DocxTextRun({
                    text: ' of ',
                    color: '9CA3AF',
                    size: 16
                  }),
                  new DocxTextRun({
                    children: [DocxPageNumber.TOTAL_PAGES],
                    color: '9CA3AF',
                    size: 16
                  })
                ]
              })
            ]
          })
        },
        children: [
          // Title
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            children: [
              new DocxTextRun({
                text: 'UNCLE JIM ESTATE',
                bold: true,
                color: '1A2B49',
                size: 38 // 19pt
              })
            ],
            spacing: { before: 100, after: 60 }
          }),
          // Subtitle
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            children: [
              new DocxTextRun({
                text: 'MARITIME MUSEUM COLLECTION',
                bold: true,
                color: '374151',
                size: 24 // 12pt
              })
            ],
            spacing: { before: 0, after: 80 }
          }),
          // Curatorial Metadata
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            children: [
              new DocxTextRun({
                text: `Curatorial Catalog  •  Generated ${dateStr}  •  ${items.length} Cataloged Objects`,
                color: '6B7280',
                size: 19 // 9.5pt
              })
            ],
            spacing: { before: 0, after: 200 }
          }),
          // Decorative border line
          new DocxTable({
            width: { size: 100, type: DocxWidthType.PERCENTAGE },
            borders: {
              top: { style: DocxBorderStyle.SINGLE, size: 6, color: 'D1D5DB' },
              bottom: { style: DocxBorderStyle.NONE },
              left: { style: DocxBorderStyle.NONE },
              right: { style: DocxBorderStyle.NONE },
              insideHorizontal: { style: DocxBorderStyle.NONE },
              insideVertical: { style: DocxBorderStyle.NONE }
            },
            rows: [
              new DocxTableRow({
                children: [
                  new DocxTableCell({
                    children: [new DocxParagraph({ spacing: { before: 40, after: 120 } })]
                  })
                ]
              })
            ]
          }),
          // Artifact list
          ...itemBlocks
        ]
      }
    ]
  });

  const buffer = await DocxPacker.toBuffer(doc);
  return { buffer, filename };
}

/**
 * Stream Maritime Museum Microsoft Word (.docx) Catalog
 */
export async function streamMaritimeCatalogDocx(res, { estateId, dbAll }) {
  const { buffer, filename } = await generateMaritimeCatalogDocx({ estateId, dbAll });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

/**
 * Stream Maritime Museum PDF Catalog
 */
export async function streamMaritimeCatalogPdf(res, { estateId, dbAll }) {
  const query = `
    SELECT id, item_number, title, description, museum_photo_url
    FROM items i
    LEFT JOIN maritime_catalog_order mco ON mco.item_id = i.id
    WHERE i.institutional_candidate = 'Maritime Museum'
      ${estateId ? 'AND (i.estate_id = ? OR i.estate_id IS NULL)' : ''}
    ORDER BY 
      CASE WHEN mco.order_index IS NOT NULL THEN 0 ELSE 1 END ASC,
      mco.order_index ASC,
      CAST(SUBSTR(i.item_number, 4) AS INTEGER) ASC,
      i.item_number ASC
  `;

  const items = await dbAll(query, estateId ? [estateId] : []);

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 45, bottom: 50, left: 45, right: 45 },
    bufferPages: true
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `uncle-jim-maritime-museum-catalog-${dateSlug}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 45;
  const contentWidth = pageWidth - (margin * 2);
  const bottomMarginLimit = pageHeight - 50;

  // Title header
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#1A2B49').text('UNCLE JIM ESTATE', { align: 'center' });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(14).fillColor('#374151').text('MARITIME MUSEUM COLLECTION', { align: 'center' });
  doc.moveDown(0.3);

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.font('Helvetica').fontSize(10).fillColor('#6B7280').text(`Curatorial Catalog  •  Generated ${dateStr}  •  ${items.length} Cataloged Objects`, { align: 'center' });
  doc.moveDown(0.6);
  doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
  doc.moveDown(0.8);

  const imgColWidth = 108; // 1.5 inches = 108 pt
  const gap = 18;
  const textColWidth = contentWidth - imgColWidth - gap;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const imgData = await prepareCatalogImage(item.museum_photo_url);

    let renderImgWidth = imgColWidth;
    let renderImgHeight = 85;

    if (imgData && imgData.width && imgData.height) {
      const aspect = imgData.width / imgData.height;
      renderImgWidth = imgColWidth;
      renderImgHeight = imgColWidth / aspect;
      if (renderImgHeight > 140) {
        renderImgHeight = 140;
        renderImgWidth = 140 * aspect;
      }
    }

    const itemNumStr = item.item_number ? String(item.item_number) : 'CATALOG ITEM';
    const titleStr = item.title || 'Untitled Object';
    const descStr = cleanForMuseumCatalog(item.description);

    doc.font('Helvetica-Bold').fontSize(11);
    const itemNumHeight = doc.heightOfString(itemNumStr, { width: textColWidth });
    const titleHeight = doc.heightOfString(titleStr, { width: textColWidth });

    doc.font('Helvetica').fontSize(9.5).lineGap(2.5);
    const descHeight = doc.heightOfString(descStr, { width: textColWidth });

    const totalTextHeight = itemNumHeight + titleHeight + descHeight + 10;
    const itemTotalHeight = Math.max(renderImgHeight, totalTextHeight);
    const blockPadding = 20;

    // Page break prevention: do not split individual item blocks across pages
    if (doc.y + itemTotalHeight + blockPadding > bottomMarginLimit) {
      doc.addPage();
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#9CA3AF').text('Uncle Jim Estate — Maritime Museum Collection', margin, 28);
      doc.strokeColor('#E5E7EB').lineWidth(0.5).moveTo(margin, 40).lineTo(pageWidth - margin, 40).stroke();
      doc.y = 48;
    }

    const startY = doc.y;

    // LEFT: Primary Museum Photo
    if (imgData) {
      doc.image(imgData.buffer, margin, startY, {
        width: renderImgWidth,
        height: renderImgHeight
      });
    } else {
      doc.rect(margin, startY, imgColWidth, 85).fillAndStroke('#F9FAFB', '#D1D5DB');
      doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF').text('No Museum\nPhoto', margin, startY + 32, {
        width: imgColWidth,
        align: 'center'
      });
    }

    // RIGHT: Item Number, Title, Normalized Description
    const textX = margin + imgColWidth + gap;
    let currTextY = startY;

    // Item Number
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1E3A8A');
    doc.text(itemNumStr, textX, currTextY, { width: textColWidth });
    currTextY += itemNumHeight + 2;

    // Title
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
    doc.text(titleStr, textX, currTextY, { width: textColWidth });
    currTextY += titleHeight + 6;

    // Normalized Description
    doc.font('Helvetica').fontSize(9.5).fillColor('#374151').lineGap(2.5);
    doc.text(descStr, textX, currTextY, { width: textColWidth });

    // Move to next item
    doc.y = Math.max(startY + renderImgHeight, currTextY + descHeight) + 14;

    // Separator line
    if (i < items.length - 1) {
      doc.strokeColor('#E5E7EB').lineWidth(0.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
      doc.moveDown(0.8);
    }
  }

  // Number all pages in footer
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF');
    doc.text(
      `Uncle Jim Estate  •  Maritime Museum Collection  •  Page ${i + 1} of ${range.count}`,
      margin,
      pageHeight - 32,
      { width: contentWidth, align: 'center' }
    );
  }

  doc.end();
}
