import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, AlertCircle, AlertTriangle, ArrowLeft, 
  RotateCcw, ShieldCheck, Check, Edit3, Eye, FileText, DollarSign,
  ChevronDown, ChevronUp, Loader2, Info
} from 'lucide-react';

/**
 * PHASE 2: LEGACY DATA NORMALIZATION WIZARD (Controlled 5-Item Pilot)
 * ------------------------------------------------------------------
 * - Extraction only — no new web research or invented facts
 * - Field-by-field side-by-side comparison
 * - Evidence quotes from original notes
 * - Contradiction / conflict warnings
 * - Clean Description segregation (no dollar values or AI commentary)
 * - Explicit Accept / Keep Original / Custom Edit toggles
 * - $100 Estate Distribution threshold warning
 * - Confirmation summary and before-and-after comparison
 */
export default function LegacyNormalizationWizard({
  item,
  threshold = 100,
  onClose,
  onSuccess
}) {
  const [loading, setLoading] = useState(true);
  const [extractError, setExtractError] = useState(null);
  const [snapshotId, setSnapshotId] = useState(null);
  const [createdSnapshot, setCreatedSnapshot] = useState(false);
  const [proposedData, setProposedData] = useState(null);
  const [originalData, setOriginalData] = useState(null);

  // Field values being edited/accepted
  const [fields, setFields] = useState({
    title: '',
    description: '',
    origin: '',
    era: '',
    materials: '',
    maker: '',
    identifying_marks: '',
    provenance_text: '',
    dimensions: '',
    condition: '',
    estimated_value_low: '',
    estimated_value_high: '',
    value_basis: '',
    distribution_value: '',
    counts_against_distribution: false,
    assessment_confidence: 'MEDIUM',
    confidence_reason: '',
    appraisal_recommended: false,
    appraisal_reason: ''
  });

  // Track which fields are in custom edit mode vs proposed vs original
  const [fieldMode, setFieldMode] = useState({}); // { [fieldName]: 'proposed' | 'original' | 'custom' }

  // UI accordion toggles
  const [showRawNotes, setShowRawNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(null);

  useEffect(() => {
    runExtraction();
  }, [item?.id]);

  const runExtraction = async () => {
    setLoading(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/admin/normalize/extract/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract legacy data');
      }

      setSnapshotId(data.snapshotId);
      setCreatedSnapshot(data.createdSnapshot);
      setOriginalData(data.original);
      setProposedData(data.proposed);

      // Initialize fields with proposed values
      const p = data.proposed || {};
      const o = data.original || {};

      const highVal = p.estimatedValueHigh || p.estimatedValueLow || null;
      const initialCountsAgainst = highVal && highVal >= (data.threshold || 100);

      setFields({
        title: p.proposedTitle || o.title || '',
        description: p.cleanDescription || o.description || '',
        origin: p.origin || o.origin || '',
        era: p.era || o.era || '',
        materials: p.materials || o.materials || '',
        maker: p.maker || o.maker || '',
        identifying_marks: p.identifyingMarks || o.identifying_marks || '',
        provenance_text: p.provenanceText || o.provenance_text || '',
        dimensions: p.dimensions || o.dimensions || '',
        condition: p.condition || o.condition || '',
        estimated_value_low: p.estimatedValueLow !== null && p.estimatedValueLow !== undefined ? p.estimatedValueLow : (o.estimated_value_low || ''),
        estimated_value_high: p.estimatedValueHigh !== null && p.estimatedValueHigh !== undefined ? p.estimatedValueHigh : (o.estimated_value_high || ''),
        value_basis: p.valueBasis || o.value_basis || '',
        distribution_value: o.distribution_value || '',
        counts_against_distribution: initialCountsAgainst,
        assessment_confidence: p.assessmentConfidence || 'MEDIUM',
        confidence_reason: p.confidenceReason || '',
        appraisal_recommended: Boolean(p.appraisalRecommended),
        appraisal_reason: p.appraisalReason || ''
      });

      // Default all to 'proposed'
      const modes = {};
      [
        'title', 'description', 'origin', 'era', 'materials', 'maker', 
        'identifying_marks', 'provenance_text', 'dimensions', 'condition', 
        'estimated_values', 'value_basis'
      ].forEach(k => { modes[k] = 'proposed'; });
      setFieldMode(modes);

    } catch (err) {
      console.error('Normalization extraction failed:', err);
      setExtractError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setFieldToOriginal = (fieldKey, origValue) => {
    setFields(prev => ({ ...prev, [fieldKey]: origValue || '' }));
    setFieldMode(prev => ({ ...prev, [fieldKey]: 'original' }));
  };

  const setFieldToProposed = (fieldKey, propValue) => {
    setFields(prev => ({ ...prev, [fieldKey]: propValue || '' }));
    setFieldMode(prev => ({ ...prev, [fieldKey]: 'proposed' }));
  };

  const handleFieldChange = (fieldKey, val) => {
    setFields(prev => ({ ...prev, [fieldKey]: val }));
    setFieldMode(prev => ({ ...prev, [fieldKey]: 'custom' }));
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/normalize/approve/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedFields: fields,
          snapshotId,
          fullProposedPayload: proposedData
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to commit normalization');
      }

      setCommitSuccess(data);
      if (onSuccess) {
        onSuccess(data.item);
      }
    } catch (err) {
      alert('Error approving normalization: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '3rem 2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <Loader2 size={36} color="var(--pine-primary)" style={{ animation: 'spin 1.2s linear infinite', margin: '0 auto 1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 0.5rem' }}>
          Extracting Legacy Estate Information...
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '520px', margin: '0 auto' }}>
          Analyzing original text for <strong>"{item?.title}"</strong> without inventing facts or doing web research.
          Creating an immutable pre-normalization baseline snapshot.
        </p>
      </div>
    );
  }

  if (extractError) {
    return (
      <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <AlertCircle size={22} />
          <div>
            <strong>Extraction Error:</strong> {extractError}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-green" onClick={runExtraction}>🔄 Retry Extraction</button>
          <button className="btn-outline" onClick={onClose}>Close Wizard</button>
        </div>
      </div>
    );
  }

  // SUCCESS / POST-APPROVAL COMPARISON SCREEN
  if (commitSuccess) {
    const updated = commitSuccess.item;
    return (
      <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: '16px', border: '2px solid #86efac', boxShadow: '0 4px 20px rgba(22, 101, 52, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ background: '#dcfce7', color: '#166534', padding: '10px', borderRadius: '50%' }}>
            <CheckCircle2 size={32} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', background: '#166534', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
              Normalized & Archived
            </span>
            <h2 style={{ fontFamily: 'var(--font-heading)', color: '#14532d', margin: '4px 0 0 0', fontSize: '1.5rem' }}>
              Normalization Successfully Approved!
            </h2>
          </div>
        </div>

        <p style={{ color: '#166534', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
          The structured curatorial fields have been committed to the live inventory item. Original raw notes and conversational text were preserved in <code>legacy_assessment_notes</code>, and the baseline snapshot remains permanently in <code>item_legacy_snapshots</code>.
        </p>

        {/* BEFORE & AFTER SUMMARY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Before (Legacy)</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>{originalData?.title}</div>
            <div style={{ fontSize: '0.82rem', color: '#475569', maxHeight: '140px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {originalData?.special_handling_notes || originalData?.description || '(No original notes)'}
            </div>
          </div>
          <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '0.5rem' }}>After (Clean & Structured)</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#14532d', marginBottom: '0.25rem' }}>{updated?.title}</div>
            <div style={{ fontSize: '0.82rem', color: '#166534', maxHeight: '140px', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 6px 0' }}>{updated?.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', marginTop: '6px' }}>
                {updated?.era && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Era: {updated.era}</span>}
                {updated?.origin && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Origin: {updated.origin}</span>}
                {updated?.maker && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Maker: {updated.maker}</span>}
                {updated?.estimated_value_high && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Est: ${updated.estimated_value_low || 0} - ${updated.estimated_value_high}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn-green" onClick={onClose} style={{ padding: '0.65rem 1.4rem' }}>
            ✓ Done & Return to Pilot List
          </button>
        </div>
      </div>
    );
  }

  const highVal = parseFloat(fields.estimated_value_high) || parseFloat(fields.estimated_value_low) || 0;
  const isOverThreshold = highVal >= threshold;

  return (
    <div style={{ maxWidth: '960px', margin: '1.5rem auto', padding: '2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: 'var(--pine-primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
              Phase 2 Pilot
            </span>
            <span style={{ fontSize: '0.75rem', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} /> Pre-Normalization Baseline Snapshot Secured
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--pine-deep)', margin: '4px 0 0 0' }}>
            Legacy Data Normalization Wizard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Review and approve clean structured fields extracted from existing notes. No new web research or facts were invented.
          </p>
        </div>

        <button className="btn-outline" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
          <ArrowLeft size={16} /> Cancel Pilot Review
        </button>
      </div>

      {/* CONFLICTS / DISCREPANCIES BANNER */}
      {proposedData?.conflicts && proposedData.conflicts.length > 0 && (
        <div style={{ padding: '1rem 1.25rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={18} />
            <span>Legacy Contradiction Detected ({proposedData.conflicts.length})</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
            {proposedData.conflicts.map((c, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>
                • <strong>{c.field}:</strong> Existing says "<em>{c.existingValue}</em>" while notes state "<em>{c.extractedValue}</em>" ({c.explanation})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RAW ORIGINAL NOTES ACCORDION */}
      <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowRawNotes(!showRawNotes)}
          style={{ width: '100%', padding: '0.75rem 1rem', background: '#f8fafc', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} color="var(--pine-primary)" />
            Original Unstructured Notes & AI Copy-Paste (Reference Archive)
          </span>
          {showRawNotes ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
        </button>
        {showRawNotes && (
          <div style={{ padding: '1rem', background: '#fafafa', fontSize: '0.84rem', color: '#475569', lineHeight: 1.6, maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap', borderTop: '1px solid #e2e8f0' }}>
            {originalData?.special_handling_notes && (
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: '#1e293b' }}>Special Handling / Assessment Notes:</strong>
                <div>{originalData.special_handling_notes}</div>
              </div>
            )}
            {originalData?.description && (
              <div>
                <strong style={{ color: '#1e293b' }}>Original Description:</strong>
                <div>{originalData.description}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FIELD-BY-FIELD REVIEW CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>

        {/* 1. TITLE */}
        <ReviewFieldCard
          label="Item Title"
          originalValue={originalData?.title}
          proposedValue={proposedData?.proposedTitle}
          currentValue={fields.title}
          evidenceSnippet={proposedData?.evidence?.title}
          mode={fieldMode.title}
          onChange={(val) => handleFieldChange('title', val)}
          onKeepOriginal={() => setFieldToOriginal('title', originalData?.title)}
          onAcceptProposed={() => setFieldToProposed('title', proposedData?.proposedTitle)}
        />

        {/* 2. CLEAN OBJECT DESCRIPTION (Segregated from dollars & AI chatter) */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--pine-deep)', textTransform: 'uppercase' }}>
                Clean Object Description
              </span>
              <span style={{ marginLeft: '8px', fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                Prices & AI Commentary Segregated
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn-outline ${fieldMode.description === 'proposed' ? 'active-pill' : ''}`}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                onClick={() => setFieldToProposed('description', proposedData?.cleanDescription)}
              >
                Use Clean Proposed
              </button>
              <button
                type="button"
                className={`btn-outline ${fieldMode.description === 'original' ? 'active-pill' : ''}`}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                onClick={() => setFieldToOriginal('description', originalData?.description)}
              >
                Keep Original
              </button>
            </div>
          </div>

          <textarea
            className="input"
            rows={4}
            value={fields.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            style={{ width: '100%', fontSize: '0.88rem', lineHeight: '1.5', fontFamily: 'inherit' }}
            placeholder="Clean physical/artistic description of the item only..."
          />

          {proposedData?.evidence?.description && (
            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
              <em>Evidence quote:</em> "{proposedData.evidence.description}"
            </div>
          )}
        </div>

        {/* 3. PHYSICAL ATTRIBUTES GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <ReviewFieldCard
            label="Origin / Culture"
            originalValue={originalData?.origin}
            proposedValue={proposedData?.origin}
            currentValue={fields.origin}
            evidenceSnippet={proposedData?.evidence?.origin}
            mode={fieldMode.origin}
            onChange={(val) => handleFieldChange('origin', val)}
            onKeepOriginal={() => setFieldToOriginal('origin', originalData?.origin)}
            onAcceptProposed={() => setFieldToProposed('origin', proposedData?.origin)}
          />

          <ReviewFieldCard
            label="Era / Timeframe"
            originalValue={originalData?.era}
            proposedValue={proposedData?.era}
            currentValue={fields.era}
            evidenceSnippet={proposedData?.evidence?.era}
            mode={fieldMode.era}
            onChange={(val) => handleFieldChange('era', val)}
            onKeepOriginal={() => setFieldToOriginal('era', originalData?.era)}
            onAcceptProposed={() => setFieldToProposed('era', proposedData?.era)}
          />

          <ReviewFieldCard
            label="Materials"
            originalValue={originalData?.materials}
            proposedValue={proposedData?.materials}
            currentValue={fields.materials}
            evidenceSnippet={proposedData?.evidence?.materials}
            mode={fieldMode.materials}
            onChange={(val) => handleFieldChange('materials', val)}
            onKeepOriginal={() => setFieldToOriginal('materials', originalData?.materials)}
            onAcceptProposed={() => setFieldToProposed('materials', proposedData?.materials)}
          />

          <ReviewFieldCard
            label="Maker / Artist"
            originalValue={originalData?.maker}
            proposedValue={proposedData?.maker}
            currentValue={fields.maker}
            evidenceSnippet={proposedData?.evidence?.maker}
            mode={fieldMode.maker}
            onChange={(val) => handleFieldChange('maker', val)}
            onKeepOriginal={() => setFieldToOriginal('maker', originalData?.maker)}
            onAcceptProposed={() => setFieldToProposed('maker', proposedData?.maker)}
          />

          <ReviewFieldCard
            label="Identifying Marks / Signatures"
            originalValue={originalData?.identifying_marks}
            proposedValue={proposedData?.identifyingMarks}
            currentValue={fields.identifying_marks}
            evidenceSnippet={proposedData?.evidence?.identifyingMarks}
            mode={fieldMode.identifying_marks}
            onChange={(val) => handleFieldChange('identifying_marks', val)}
            onKeepOriginal={() => setFieldToOriginal('identifying_marks', originalData?.identifying_marks)}
            onAcceptProposed={() => setFieldToProposed('identifying_marks', proposedData?.identifyingMarks)}
          />

          <ReviewFieldCard
            label="Known Provenance"
            originalValue={originalData?.provenance_text}
            proposedValue={proposedData?.provenanceText}
            currentValue={fields.provenance_text}
            evidenceSnippet={proposedData?.evidence?.provenanceText}
            mode={fieldMode.provenance_text}
            onChange={(val) => handleFieldChange('provenance_text', val)}
            onKeepOriginal={() => setFieldToOriginal('provenance_text', originalData?.provenance_text)}
            onAcceptProposed={() => setFieldToProposed('provenance_text', proposedData?.provenanceText)}
          />

          <ReviewFieldCard
            label="Dimensions"
            originalValue={originalData?.dimensions}
            proposedValue={proposedData?.dimensions}
            currentValue={fields.dimensions}
            evidenceSnippet={proposedData?.evidence?.dimensions}
            mode={fieldMode.dimensions}
            onChange={(val) => handleFieldChange('dimensions', val)}
            onKeepOriginal={() => setFieldToOriginal('dimensions', originalData?.dimensions)}
            onAcceptProposed={() => setFieldToProposed('dimensions', proposedData?.dimensions)}
          />

          <ReviewFieldCard
            label="Condition"
            originalValue={originalData?.condition}
            proposedValue={proposedData?.condition}
            currentValue={fields.condition}
            evidenceSnippet={proposedData?.evidence?.condition}
            mode={fieldMode.condition}
            onChange={(val) => handleFieldChange('condition', val)}
            onKeepOriginal={() => setFieldToOriginal('condition', originalData?.condition)}
            onAcceptProposed={() => setFieldToProposed('condition', proposedData?.condition)}
          />
        </div>

        {/* 4. VALUATION & ESTATE DISTRIBUTION SECTION */}
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <DollarSign size={20} color="var(--pine-primary)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
              Valuation & Distribution Threshold Review
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Estimated Value Low ($)
              </label>
              <input
                type="number"
                step="any"
                className="input"
                value={fields.estimated_value_low}
                onChange={(e) => setFields({ ...fields, estimated_value_low: e.target.value })}
                placeholder="e.g. 150"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Estimated Value High ($)
              </label>
              <input
                type="number"
                step="any"
                className="input"
                value={fields.estimated_value_high}
                onChange={(e) => setFields({ ...fields, estimated_value_high: e.target.value })}
                placeholder="e.g. 300"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Distribution Value ($) <span style={{ fontWeight: 400, color: '#64748b' }}>(Admin Approved)</span>
              </label>
              <input
                type="number"
                step="any"
                className="input"
                value={fields.distribution_value}
                onChange={(e) => setFields({ ...fields, distribution_value: e.target.value })}
                placeholder="Optional single amount"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Value Basis / Rationale */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Valuation Basis & Comparable Sales Mentions
            </label>
            <textarea
              className="input"
              rows={2}
              value={fields.value_basis}
              onChange={(e) => setFields({ ...fields, value_basis: e.target.value })}
              placeholder="Extracted rationale, auction comps, or condition factors..."
              style={{ width: '100%', fontSize: '0.84rem' }}
            />
          </div>

          {/* DISTRIBUTION THRESHOLD WARNING ($100) */}
          <div style={{ padding: '0.85rem 1rem', background: isOverThreshold ? '#eff6ff' : '#f1f5f9', border: isOverThreshold ? '1px solid #bfdbfe' : '1px solid #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 700, color: isOverThreshold ? '#1e40af' : '#334155' }}>
                <Info size={16} />
                <span>Estate Distribution Policy (${threshold} Threshold)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: isOverThreshold ? '#1e3a8a' : '#475569', marginTop: '2px' }}>
                {isOverThreshold ? (
                  <span>⚠️ Estimated value exceeds the estate threshold of ${threshold}. This item may count against family distribution.</span>
                ) : (
                  <span>Item estimated below ${threshold}. Standard estate distribution rules apply.</span>
                )}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
              <input
                type="checkbox"
                checked={fields.counts_against_distribution}
                onChange={(e) => setFields({ ...fields, counts_against_distribution: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--pine-primary)' }}
              />
              <span>Counts Against Distribution</span>
            </label>
          </div>
        </div>

        {/* 5. CONFIDENCE & APPRAISAL RECOMMENDATION */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Assessment Confidence
            </label>
            <select
              className="input"
              value={fields.assessment_confidence}
              onChange={(e) => setFields({ ...fields, assessment_confidence: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="HIGH">HIGH (Strong documentation / marks)</option>
              <option value="MEDIUM">MEDIUM (Plausible based on notes)</option>
              <option value="LOW">LOW (Unverified / speculative)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Formal Appraisal Recommended?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', height: '38px', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={fields.appraisal_recommended}
                  onChange={(e) => setFields({ ...fields, appraisal_recommended: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--pine-primary)' }}
                />
                <span>Recommend professional appraisal</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM APPROVAL BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
        <button className="btn-outline" onClick={onClose} disabled={saving}>
          Cancel
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn-green"
            onClick={handleApprove}
            disabled={saving}
            style={{ padding: '0.75rem 1.6rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {saving ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} />
                <span>Committing Normalization...</span>
              </>
            ) : (
              <>
                <Check size={18} strokeWidth={3} />
                <span>Approve & Commit Normalization</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Field Review Card with side-by-side comparison & toggles
function ReviewFieldCard({
  label,
  originalValue,
  proposedValue,
  currentValue,
  evidenceSnippet,
  mode,
  onChange,
  onKeepOriginal,
  onAcceptProposed
}) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--pine-deep)', textTransform: 'uppercase' }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {proposedValue && (
            <button
              type="button"
              className={`btn-outline ${mode === 'proposed' ? 'active-pill' : ''}`}
              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
              onClick={onAcceptProposed}
            >
              Use Extracted
            </button>
          )}
          {originalValue && (
            <button
              type="button"
              className={`btn-outline ${mode === 'original' ? 'active-pill' : ''}`}
              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
              onClick={onKeepOriginal}
            >
              Keep Original
            </button>
          )}
        </div>
      </div>

      <input
        type="text"
        className="input"
        value={currentValue || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', fontSize: '0.86rem' }}
        placeholder={`Enter ${label.toLowerCase()}...`}
      />

      {evidenceSnippet && (
        <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#64748b' }}>
          <em>Evidence:</em> "{evidenceSnippet}"
        </div>
      )}
    </div>
  );
}
