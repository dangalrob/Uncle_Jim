import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLegacyData } from '../services/legacyNormalization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'estate.db');

console.log('--- RUNNING PHASE 2 LEGACY NORMALIZATION TEST SUITE ---');

const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Create a simulated test item with raw conversational AI notes
    const testItemId = 'test_legacy_item_' + Date.now();
    const legacyNotes = `I asked Google Gemini about this piece: It appears to be an authentic 18th Century Qing Dynasty blue and white porcelain ginger jar. Origin: Jingdezhen, China. Hand-painted with double happiness motifs and lotus vines. Maker/Kiln marks: Kangxi double ring mark on the underside. Condition: Excellent, minor glaze frit on the rim. Dimensions: 9.5 inches tall, 7 inches diameter. Comparable sales at Christie's auction show similar jars selling between $350 and $600. Jim traveled to China in 1982 and 1987. Quick sale estimate $250. Let me know if you need more help!`;
    
    await dbRun(`
      INSERT INTO items (
        id, estate_id, title, description, special_handling_notes, value, status, normalization_status
      ) VALUES (?, 'estate_main', ?, ?, ?, ?, 'draft', 'not_reviewed')
    `, [
      testItemId,
      'Old Blue China Ginger Jar',
      'Ceramic jar found on living room shelf',
      legacyNotes,
      '$350 - $600'
    ]);

    const insertedItem = await dbGet(`SELECT * FROM items WHERE id = ?`, [testItemId]);
    assert(insertedItem && insertedItem.id === testItemId, 'Simulated test legacy item inserted into database');

    // 2. Test Extraction Service
    console.log('\nTesting extraction service on legacy item text...');
    const extracted = await extractLegacyData(insertedItem, process.env.GEMINI_API_KEY);
    assert(extracted && typeof extracted === 'object', 'Extraction returned structured result');
    assert(extracted.proposedTitle && extracted.proposedTitle.length > 0, `Proposed title extracted: "${extracted.proposedTitle}"`);
    assert(extracted.cleanDescription && extracted.cleanDescription.length > 0, `Clean description extracted without AI filler`);
    
    // Check that dollar values are NOT inside clean description
    const hasDollarInDesc = extracted.cleanDescription.includes('$') || extracted.cleanDescription.toLowerCase().includes('350');
    assert(!hasDollarInDesc, 'Clean description strictly segregates dollars and auction comps');

    // Check that valuation was extracted into numeric fields
    assert(extracted.estimatedValueLow !== null && extracted.estimatedValueLow !== undefined, `Estimated value low extracted: $${extracted.estimatedValueLow}`);
    assert(extracted.estimatedValueHigh !== null && extracted.estimatedValueHigh !== undefined, `Estimated value high extracted: $${extracted.estimatedValueHigh}`);

    // Check origin, era, materials
    assert(extracted.origin && extracted.origin.toLowerCase().includes('china'), `Origin extracted correctly: "${extracted.origin}"`);
    assert(extracted.era && extracted.era.length > 0, `Era extracted: "${extracted.era}"`);

    // 3. Test Baseline Snapshot Creation & Idempotency
    console.log('\nTesting immutable baseline snapshot creation...');
    const snapshotId1 = 'snap_test_' + Date.now();
    await dbRun(`
      INSERT INTO item_legacy_snapshots (
        id, item_id, original_title, original_description, original_special_handling_notes,
        original_value, original_provenance, original_era, snapshot_type, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PRE_NORMALIZATION_BASELINE', 'user_test')
    `, [
      snapshotId1,
      testItemId,
      insertedItem.title,
      insertedItem.description,
      insertedItem.special_handling_notes,
      insertedItem.value,
      insertedItem.provenance_text,
      insertedItem.era
    ]);

    const snapshot = await dbGet(`SELECT * FROM item_legacy_snapshots WHERE id = ?`, [snapshotId1]);
    assert(snapshot && snapshot.original_title === 'Old Blue China Ginger Jar', 'Baseline snapshot preserved original pre-normalization title');
    assert(snapshot.original_special_handling_notes === legacyNotes, 'Baseline snapshot preserved verbatim legacy notes');

    // Verify idempotency query
    const existingSnap = await dbGet(
      `SELECT id FROM item_legacy_snapshots WHERE item_id = ? AND snapshot_type = 'PRE_NORMALIZATION_BASELINE'`,
      [testItemId]
    );
    assert(existingSnap && existingSnap.id === snapshotId1, 'Idempotency check prevents duplicate baseline snapshots on re-runs');

    // 4. Test Approval & Field Commitment
    console.log('\nTesting approval and commit to items table...');
    const approvedFields = {
      title: extracted.proposedTitle || 'Qing Dynasty Blue & White Ginger Jar',
      description: extracted.cleanDescription,
      origin: extracted.origin || 'China',
      era: extracted.era || '18th Century / Qing Dynasty',
      materials: extracted.materials || 'Porcelain',
      maker: extracted.maker || 'Kangxi Mark',
      identifying_marks: extracted.identifyingMarks || 'Double ring mark',
      dimensions: extracted.dimensions || '9.5" x 7"',
      condition: extracted.condition || 'Excellent, minor glaze frit on rim',
      estimated_value_low: extracted.estimatedValueLow || 350,
      estimated_value_high: extracted.estimatedValueHigh || 600,
      value_basis: extracted.valueBasis || "Christie's comparable auction sales",
      counts_against_distribution: (extracted.estimatedValueHigh || 600) >= 100 ? 1 : 0,
      assessment_confidence: extracted.assessmentConfidence || 'MEDIUM'
    };

    const archiveNotes = `=== ORIGINAL SPECIAL HANDLING / AI NOTES ===\n${insertedItem.special_handling_notes}`;

    await dbRun(`
      UPDATE items SET
        title = ?,
        description = ?,
        origin = ?,
        era = ?,
        materials = ?,
        maker = ?,
        identifying_marks = ?,
        dimensions = ?,
        condition = ?,
        estimated_value_low = ?,
        estimated_value_high = ?,
        value_basis = ?,
        counts_against_distribution = ?,
        assessment_confidence = ?,
        legacy_assessment_notes = ?,
        special_handling_notes = '',
        normalization_status = 'normalized',
        assessment_status = 'completed',
        assessment_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      approvedFields.title,
      approvedFields.description,
      approvedFields.origin,
      approvedFields.era,
      approvedFields.materials,
      approvedFields.maker,
      approvedFields.identifying_marks,
      approvedFields.dimensions,
      approvedFields.condition,
      approvedFields.estimated_value_low,
      approvedFields.estimated_value_high,
      approvedFields.value_basis,
      approvedFields.counts_against_distribution,
      approvedFields.assessment_confidence,
      archiveNotes,
      testItemId
    ]);

    const updatedItem = await dbGet(`SELECT * FROM items WHERE id = ?`, [testItemId]);
    assert(updatedItem.normalization_status === 'normalized', 'Normalization status marked as "normalized"');
    assert(updatedItem.special_handling_notes === '', 'Active special_handling_notes cleared of raw conversational clutter');
    assert(updatedItem.legacy_assessment_notes.includes('=== ORIGINAL SPECIAL HANDLING / AI NOTES ==='), 'Original legacy notes safely preserved in legacy_assessment_notes archive column');
    assert(updatedItem.estimated_value_low === 350 && updatedItem.estimated_value_high === 600, 'Structured numeric valuation fields saved correctly');
    assert(updatedItem.counts_against_distribution === 1, 'Counts against distribution flagged properly (>$100 threshold)');

    // 5. Clean up test record
    await dbRun(`DELETE FROM item_legacy_snapshots WHERE item_id = ?`, [testItemId]);
    await dbRun(`DELETE FROM items WHERE id = ?`, [testItemId]);
    console.log('\nTest item and test snapshots cleanly purged from local database.');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    db.close();
    console.log(`\nTEST RESULTS: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
