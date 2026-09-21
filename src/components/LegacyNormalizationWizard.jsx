import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, AlertCircle, AlertTriangle, ArrowLeft, 
  RotateCcw, ShieldCheck, Check, Edit3, Eye, FileText, DollarSign,
  ChevronDown, ChevronUp, Loader2, Info, ExternalLink, Plus, Trash2, 
  HelpCircle, Compass, Tag, Globe, Link, HelpCircle as QuestionIcon
} from 'lucide-react';

/**
 * LEGACY DATA NORMALIZATION WIZARD
 * ---------------------------------
 * Multi-tier curatorial normalization engine:
 * 1. Adaptive Research Level: BASIC, STANDARD, HISTORICAL / COLLECTIBLE (defaults to UNASSESSED)
 * 2. Clean Normalized Description: Strictly factual; NO dollar values, NO URLs, NO citations
 * 3. Acquisition Context vs. Jim-Specific Provenance (FACT, REASONABLE INFERENCE, UNKNOWN)
 * 4. Value Assessment & $100 Threshold Tracking (Below $100, Possibly $100+, Above $100, Unknown)
 * 5. Legacy & Collection Significance for Jim's virtual museum
 * 6. Separate Identification Confidence vs. Value Confidence
 * 7. Verification Needed & AI Questions for Admin
 * 8. Structured Research Sources manager (preserving canonical and original URLs)
 * 9. Baseline Snapshot & Raw Legacy Notes preservation
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
  const [evidenceSources, setEvidenceSources] = useState(null);

  // Active Research Level State (Supports UNASSESSED, BASIC, STANDARD, HISTORICAL_COLLECTIBLE)
  const [researchLevel, setResearchLevel] = useState('UNASSESSED');
  const [recommendedLevel, setRecommendedLevel] = useState('BASIC');
  const [researchLevelReason, setResearchLevelReason] = useState('');

  // Field values being edited/accepted
  const [fields, setFields] = useState({
    title: '',
    description: '',
    origin: '',
    era: '',
    materials: '',
    maker: '',
    model: '',
    identifying_marks: '',
    acquisition_context: '',
    jim_connection_type: 'UNKNOWN',
    jim_connection_notes: '',
    provenance_text: '',
    dimensions: '',
    condition: '',
    estimated_value_low: '',
    estimated_value_high: '',
    threshold_status: 'unknown',
    value_basis: '',
    distribution_value: '',
    counts_against_distribution: false,
    legacy_significance: 'none',
    legacy_significance_reason: '',
    identification_confidence: 'MEDIUM',
    identification_confidence_reason: '',
    value_confidence: 'LOW',
    value_confidence_reason: '',
    verification_needed: '',
    appraisal_recommended: false,
    appraisal_reason: ''
  });

  // Structured Research Sources State
  const [researchSources, setResearchSources] = useState([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({
    sourceType: 'Completed eBay Sale',
    websiteOrOrg: '',
    title: '',
    url: '',
    originalUrl: '',
    sourceDate: '',
    listingDate: '',
    askingPrice: '',
    soldPrice: '',
    currency: 'USD',
    status: 'sold',
    usedFor: 'Valuation',
    relevance: '',
    notes: ''
  });

  // AI Questions State
  const [adminQuestions, setAdminQuestions] = useState([]);

  // Track which fields are in custom edit mode vs proposed vs original
  const [fieldMode, setFieldMode] = useState({}); // { [fieldName]: 'proposed' | 'original' | 'custom' }

  // UI toggles
  const [showRawNotes, setShowRawNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(null);

  useEffect(() => {
    runExtraction();
  }, [item?.id]);

  const runExtraction = async (levelOverride = null) => {
    setLoading(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/admin/normalize/extract/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideResearchLevel: levelOverride })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract legacy data');
      }

      setSnapshotId(data.snapshotId);
      setCreatedSnapshot(data.createdSnapshot);
      setOriginalData(data.original);
      setProposedData(data.proposed);
      setEvidenceSources(data.evidenceSources || null);

      const p = data.proposed || {};
      const o = data.original || {};

      // Set research levels
      const initialActiveLevel = p.activeResearchLevel || p.researchLevel || o.research_level || 'BASIC';
      setResearchLevel(initialActiveLevel);
      setRecommendedLevel(p.recommendedResearchLevel || 'BASIC');
      setResearchLevelReason(p.researchLevelReason || '');

      // Set research sources
      setResearchSources(p.researchSources || []);

      // Set AI questions
      setAdminQuestions(p.adminQuestions || []);

      const highVal = p.estimatedValueHigh || p.estimatedValueLow || null;
      const initialCountsAgainst = highVal && highVal >= (data.threshold || 100);

      setFields({
        title: p.proposedTitle || o.title || '',
        description: p.cleanDescription || o.description || '',
        origin: p.origin || o.origin || '',
        era: p.era || o.era || '',
        materials: p.materials || o.materials || '',
        maker: p.maker || o.maker || '',
        model: p.model || o.model || '',
        identifying_marks: p.identifyingMarks || o.identifying_marks || '',
        acquisition_context: p.acquisitionContext || o.acquisition_context || '',
        jim_connection_type: p.jimConnectionType || o.jim_connection_type || 'UNKNOWN',
        jim_connection_notes: p.jimConnectionNotes || o.jim_connection_notes || '',
        provenance_text: p.provenanceText || o.provenance_text || '',
        dimensions: p.dimensions || o.dimensions || '',
        condition: p.condition || o.condition || '',
        estimated_value_low: p.estimatedValueLow !== null && p.estimatedValueLow !== undefined ? p.estimatedValueLow : (o.estimated_value_low || ''),
        estimated_value_high: p.estimatedValueHigh !== null && p.estimatedValueHigh !== undefined ? p.estimatedValueHigh : (o.estimated_value_high || ''),
        threshold_status: p.thresholdStatus || o.threshold_status || 'unknown',
        value_basis: p.valueBasis || o.value_basis || '',
        distribution_value: o.distribution_value || '',
        counts_against_distribution: o.counts_against_distribution ? true : initialCountsAgainst,
        legacy_significance: p.legacySignificance || o.legacy_significance || 'none',
        legacy_significance_reason: p.legacySignificanceReason || o.legacy_significance_reason || '',
        identification_confidence: p.identificationConfidence || o.identification_confidence || 'MEDIUM',
        identification_confidence_reason: p.identificationConfidenceReason || '',
        value_confidence: p.valueConfidence || o.value_confidence || 'LOW',
        value_confidence_reason: p.valueConfidenceReason || '',
        verification_needed: p.verificationNeeded || o.verification_needed || '',
        appraisal_recommended: Boolean(p.appraisalRecommended || o.appraisal_recommended),
        appraisal_reason: p.appraisalReason || o.appraisal_reason || ''
      });

      // Default modes to 'proposed'
      const modes = {};
      [
        'title', 'description', 'origin', 'era', 'materials', 'maker', 'model',
        'identifying_marks', 'acquisition_context', 'jim_connection', 'provenance_text', 
        'dimensions', 'condition', 'estimated_values', 'value_basis', 'legacy_significance',
        'verification_needed'
      ].forEach(k => { modes[k] = 'proposed'; });
      setFieldMode(modes);

    } catch (err) {
      console.error('Normalization extraction failed:', err);
      setExtractError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideResearchLevel = (newLevel) => {
    setResearchLevel(newLevel);
    runExtraction(newLevel);
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

  const handleAcceptAllProposed = () => {
    if (!proposedData) return;
    const p = proposedData;
    setFields(prev => ({
      ...prev,
      title: p.proposedTitle || prev.title,
      description: p.cleanDescription || prev.description,
      origin: p.origin || prev.origin,
      era: p.era || prev.era,
      materials: p.materials || prev.materials,
      maker: p.maker || prev.maker,
      model: p.model || prev.model,
      identifying_marks: p.identifyingMarks || prev.identifying_marks,
      acquisition_context: p.acquisitionContext || prev.acquisition_context,
      jim_connection_type: p.jimConnectionType || prev.jim_connection_type,
      jim_connection_notes: p.jimConnectionNotes || prev.jim_connection_notes,
      provenance_text: p.provenanceText || prev.provenance_text,
      dimensions: p.dimensions || prev.dimensions,
      condition: p.condition || prev.condition,
      estimated_value_low: p.estimatedValueLow !== null && p.estimatedValueLow !== undefined ? p.estimatedValueLow : prev.estimated_value_low,
      estimated_value_high: p.estimatedValueHigh !== null && p.estimatedValueHigh !== undefined ? p.estimatedValueHigh : prev.estimated_value_high,
      threshold_status: p.thresholdStatus || prev.threshold_status,
      value_basis: p.valueBasis || prev.value_basis,
      legacy_significance: p.legacySignificance || prev.legacy_significance,
      legacy_significance_reason: p.legacySignificanceReason || prev.legacy_significance_reason,
      identification_confidence: p.identificationConfidence || prev.identification_confidence,
      value_confidence: p.valueConfidence || prev.value_confidence,
      verification_needed: p.verificationNeeded || prev.verification_needed
    }));

    const modes = {};
    [
      'title', 'description', 'origin', 'era', 'materials', 'maker', 'model',
      'identifying_marks', 'acquisition_context', 'jim_connection', 'provenance_text', 
      'dimensions', 'condition', 'estimated_values', 'value_basis', 'legacy_significance',
      'verification_needed'
    ].forEach(k => { modes[k] = 'proposed'; });
    setFieldMode(modes);
  };

  const handleAddSourceSubmit = (e) => {
    if (e) e.preventDefault();
    if (!newSource.title && !newSource.url) {
      alert("Please enter at least a title or URL for the research source.");
      return;
    }
    const created = {
      ...newSource,
      id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      originalUrl: newSource.url,
      dateAccessed: newSource.dateAccessed || new Date().toISOString().split('T')[0]
    };
    setResearchSources(prev => [created, ...prev]);
    setNewSource({
      sourceType: 'Completed eBay Sale',
      websiteOrOrg: '',
      title: '',
      url: '',
      originalUrl: '',
      sourceDate: '',
      listingDate: '',
      askingPrice: '',
      soldPrice: '',
      currency: 'USD',
      status: 'sold',
      usedFor: 'Valuation',
      relevance: '',
      notes: ''
    });
    setShowAddSource(false);
  };

  const handleDeleteSource = (idx) => {
    setResearchSources(prev => prev.filter((_, i) => i !== idx));
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const payloadFields = {
        ...fields,
        research_level: researchLevel
      };

      const res = await fetch(`/api/admin/normalize/approve/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedFields: payloadFields,
          snapshotId,
          fullProposedPayload: proposedData,
          researchSources
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
      <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '3.5rem 2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Loader2 size={40} color="var(--pine-primary)" style={{ animation: 'spin 1.2s linear infinite', margin: '0 auto 1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 0.5rem' }}>
          Normalizing Legacy Estate Record...
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem', maxWidth: '580px', margin: '0 auto 1.5rem' }}>
          Classifying research depth, extracting clean factual attributes for <strong>"{item?.title}"</strong>,
          separating general acquisition context from Jim-specific provenance, and securing an immutable baseline snapshot.
        </p>
      </div>
    );
  }

  if (extractError) {
    return (
      <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '1.25rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <AlertCircle size={24} />
          <div>
            <strong>Normalization Extraction Error:</strong> {extractError}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-green" onClick={() => runExtraction(researchLevel)}>🔄 Retry Extraction</button>
          <button className="btn-outline" onClick={onClose}>Close Wizard</button>
        </div>
      </div>
    );
  }

  // SUCCESS / POST-APPROVAL SCREEN
  if (commitSuccess) {
    const updated = commitSuccess.item;
    return (
      <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '2.5rem', background: '#fff', borderRadius: '16px', border: '2px solid #86efac', boxShadow: '0 6px 30px rgba(22, 101, 52, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '50%' }}>
            <CheckCircle2 size={36} />
          </div>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: '#166534', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                Normalized & Archived
              </span>
              <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Depth: {updated?.research_level || researchLevel}
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', color: '#14532d', margin: '4px 0 0 0', fontSize: '1.6rem' }}>
              Record Normalized Successfully!
            </h2>
          </div>
        </div>

        <p style={{ color: '#166534', fontSize: '0.94rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          The clean normalized description is now the authoritative object description for inventory and future virtual museum display.
          Original raw text and links were safely preserved in <code>legacy_assessment_notes</code>, and the baseline snapshot remains permanently in <code>item_legacy_snapshots</code>.
        </p>

        {/* BEFORE & AFTER SUMMARY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Before (Legacy Raw Text)</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>{originalData?.title}</div>
            <div style={{ fontSize: '0.82rem', color: '#475569', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {originalData?.special_handling_notes || originalData?.description || '(No legacy notes recorded)'}
            </div>
          </div>
          <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '0.5rem' }}>After (Clean Normalized Description)</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#14532d', marginBottom: '0.35rem' }}>{updated?.title}</div>
            <div style={{ fontSize: '0.84rem', color: '#166534', maxHeight: '180px', overflowY: 'auto', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px 0' }}>{updated?.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', marginTop: '8px' }}>
                {updated?.era && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Era: {updated.era}</span>}
                {updated?.origin && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Origin: {updated.origin}</span>}
                {updated?.maker && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Maker: {updated.maker}</span>}
                {updated?.estimated_value_high && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Est: ${updated.estimated_value_low || 0}–${updated.estimated_value_high}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn-green" onClick={onClose} style={{ padding: '0.75rem 1.6rem', fontSize: '0.95rem' }}>
            ✓ Return to Normalization List
          </button>
        </div>
      </div>
    );
  }

  const highVal = parseFloat(fields.estimated_value_high) || parseFloat(fields.estimated_value_low) || 0;
  const isOverThreshold = highVal >= threshold;

  return (
    <div style={{ maxWidth: '1000px', margin: '1.5rem auto', padding: '2.25rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 28px rgba(0,0,0,0.08)' }}>
      {/* HEADER */}
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: 'var(--pine-primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                Legacy Normalization Wizard
              </span>
              <span style={{ fontSize: '0.75rem', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> Baseline Snapshot Secured
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--pine-deep)', margin: '4px 0 0 0' }}>
              {item?.title || 'Normalize Item'}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-green"
              onClick={handleAcceptAllProposed}
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Accept all proposed extracted fields at once"
            >
              <Check size={16} /> Accept All Proposed
            </button>
            <button className="btn-outline" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}>
              <ArrowLeft size={16} /> Close
            </button>
          </div>
        </div>

        {/* RESEARCH DEPTH LEVEL SELECTOR & OVERRIDE */}
        <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Current Research Depth Level
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                AI Recommendation: <strong style={{ color: '#0f172a' }}>{recommendedLevel}</strong>
                {researchLevelReason && ` — ${researchLevelReason}`}
              </div>
            </div>

            {/* Level Selector Buttons */}
            <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => handleOverrideResearchLevel('BASIC')}
                style={{
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: researchLevel === 'BASIC' ? '#fff' : 'transparent',
                  color: researchLevel === 'BASIC' ? 'var(--pine-deep)' : '#64748b',
                  boxShadow: researchLevel === 'BASIC' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                BASIC
              </button>
              <button
                type="button"
                onClick={() => handleOverrideResearchLevel('STANDARD')}
                style={{
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: researchLevel === 'STANDARD' ? '#fff' : 'transparent',
                  color: researchLevel === 'STANDARD' ? 'var(--pine-deep)' : '#64748b',
                  boxShadow: researchLevel === 'STANDARD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                STANDARD
              </button>
              <button
                type="button"
                onClick={() => handleOverrideResearchLevel('HISTORICAL_COLLECTIBLE')}
                style={{
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: researchLevel === 'HISTORICAL_COLLECTIBLE' ? 'var(--pine-primary)' : 'transparent',
                  color: researchLevel === 'HISTORICAL_COLLECTIBLE' ? '#fff' : '#64748b',
                  boxShadow: researchLevel === 'HISTORICAL_COLLECTIBLE' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                HISTORICAL / COLLECTIBLE
              </button>
            </div>
          </div>
        </div>

        {/* EVIDENCE SOURCE TRANSPARENCY INDICATOR */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.65rem 1rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 600 }}>
            <ShieldCheck size={16} />
            <span>Normalization based on:</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {evidenceSources?.isRenormalization ? (
              <>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  🛡️ Original Baseline
                </span>
                {evidenceSources?.hasApprovedFacts && (
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    🏷️ Current Approved Item Data
                  </span>
                )}
                {evidenceSources?.hasResearchSources && (
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    🔗 Research Sources
                  </span>
                )}
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  ✏️ Admin Updates
                </span>
              </>
            ) : (
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                📜 Original Estate Record
              </span>
            )}
          </div>
        </div>
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

      {/* AI QUESTIONS & VERIFICATION NEEDED CALLOUT */}
      {(adminQuestions.length > 0 || fields.verification_needed) && (
        <div style={{ padding: '1rem 1.25rem', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '10px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f766e', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.4rem' }}>
            <QuestionIcon size={18} />
            <span>Curatorial Verification & Questions</span>
          </div>
          {fields.verification_needed && (
            <div style={{ fontSize: '0.85rem', color: '#115e59', marginBottom: adminQuestions.length > 0 ? '0.5rem' : 0 }}>
              <strong>Verification needed:</strong> {fields.verification_needed}
            </div>
          )}
          {adminQuestions.map((q, idx) => (
            <div key={idx} style={{ fontSize: '0.84rem', color: '#134e4a', padding: '4px 0', borderTop: idx > 0 ? '1px dashed #ccfbf1' : 'none' }}>
              👉 <em>{q}</em>
            </div>
          ))}
        </div>
      )}

      {/* FIELD-BY-FIELD REVIEW CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* 1. OBJECT IDENTIFICATION & CLEAN NORMALIZED DESCRIPTION */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
            1. Object Identification & Clean Description
          </h3>

          {/* Title */}
          <div style={{ marginBottom: '1.25rem' }}>
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
          </div>

          {/* Clean Normalized Description */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--pine-deep)', textTransform: 'uppercase' }}>
                  Normalized Object Description
                </span>
                <span style={{ marginLeft: '8px', fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Factual Foundation • No URLs or Dollar Amounts
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn-outline ${fieldMode.description === 'proposed' ? 'active-pill' : ''}`}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  onClick={() => setFieldToProposed('description', proposedData?.cleanDescription)}
                >
                  Use Proposed
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
              style={{ width: '100%', fontSize: '0.9rem', lineHeight: '1.55', fontFamily: 'inherit' }}
              placeholder="Factual curatorial description answering what, where, when, materials, and historical significance..."
            />

            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              Answers: <em>What is it? Where is it from? When is it from? What is it made from? What is historically useful?</em> (Only include elements relevant to this item).
            </div>
          </div>
        </div>

        {/* 2. PHYSICAL & CURATORIAL ATTRIBUTES */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
            2. Physical & Curatorial Attributes
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <ReviewFieldCard
              label="Maker / Artist / Manufacturer"
              originalValue={originalData?.maker}
              proposedValue={proposedData?.maker}
              currentValue={fields.maker}
              evidenceSnippet={proposedData?.evidence?.maker}
              mode={fieldMode.maker}
              onChange={(val) => handleFieldChange('maker', val)}
              onKeepOriginal={() => setFieldToOriginal('maker', originalData?.maker)}
              onAcceptProposed={() => setFieldToProposed('maker', proposedData?.maker)}
            />

            {researchLevel === 'STANDARD' && (
              <ReviewFieldCard
                label="Model / Catalog Number"
                originalValue={originalData?.model}
                proposedValue={proposedData?.model}
                currentValue={fields.model}
                mode={fieldMode.model}
                onChange={(val) => handleFieldChange('model', val)}
                onKeepOriginal={() => setFieldToOriginal('model', originalData?.model)}
                onAcceptProposed={() => setFieldToProposed('model', proposedData?.model)}
              />
            )}

            <ReviewFieldCard
              label="Approximate Era / Period"
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
              label="Geographic / Cultural Origin"
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
              label="Identifying Marks / Labels"
              originalValue={originalData?.identifying_marks}
              proposedValue={proposedData?.identifyingMarks}
              currentValue={fields.identifying_marks}
              mode={fieldMode.identifying_marks}
              onChange={(val) => handleFieldChange('identifying_marks', val)}
              onKeepOriginal={() => setFieldToOriginal('identifying_marks', originalData?.identifying_marks)}
              onAcceptProposed={() => setFieldToProposed('identifying_marks', proposedData?.identifyingMarks)}
            />

            <ReviewFieldCard
              label="Dimensions"
              originalValue={originalData?.dimensions}
              proposedValue={proposedData?.dimensions}
              currentValue={fields.dimensions}
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
              mode={fieldMode.condition}
              onChange={(val) => handleFieldChange('condition', val)}
              onKeepOriginal={() => setFieldToOriginal('condition', originalData?.condition)}
              onAcceptProposed={() => setFieldToProposed('condition', proposedData?.condition)}
            />
          </div>
        </div>

        {/* 3. ACQUISITION CONTEXT & JIM-SPECIFIC PROVENANCE */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
            3. Acquisition Context & Jim-Specific Provenance
          </h3>

          {/* General Acquisition Context */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--pine-deep)', textTransform: 'uppercase', marginBottom: '4px' }}>
              General Historical Acquisition Context
            </label>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
              Describes how or where objects of this type could reasonably have been acquired during their period (e.g. ports, international travel).
            </div>
            <textarea
              className="input"
              rows={2}
              value={fields.acquisition_context}
              onChange={(e) => handleFieldChange('acquisition_context', e.target.value)}
              placeholder="e.g. Objects of this type were commonly sold to international travelers and merchant seamen in Indonesian ports during the 1960s..."
              style={{ width: '100%', fontSize: '0.88rem' }}
            />
          </div>

          {/* Possible Jim Connection / Provenance */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--pine-deep)', textTransform: 'uppercase' }}>
                  Possible Jim Connection / Provenance
                </span>
                <span style={{ marginLeft: '8px', fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Never Present Inference as Fact
                </span>
              </div>

              {/* Status Radio Pills */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {['FACT', 'REASONABLE_INFERENCE', 'UNKNOWN'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleFieldChange('jim_connection_type', type)}
                    style={{
                      border: '1px solid var(--border-color)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: fields.jim_connection_type === type ? (type === 'FACT' ? '#166534' : type === 'REASONABLE_INFERENCE' ? '#0369a1' : '#64748b') : '#fff',
                      color: fields.jim_connection_type === type ? '#fff' : '#475569'
                    }}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="input"
              rows={3}
              value={fields.jim_connection_notes}
              onChange={(e) => handleFieldChange('jim_connection_notes', e.target.value)}
              placeholder="e.g. Jim's voyage records document a call at Surabaya in 1968, which falls within the estimated production period. Possible acquisition during this voyage..."
              style={{ width: '100%', fontSize: '0.88rem' }}
            />
          </div>
        </div>

        {/* 4. VALUATION & $100 THRESHOLD SECTION */}
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={22} color="var(--pine-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
                4. Valuation & Estate Distribution Policy ($100 Threshold)
              </h3>
            </div>

            {/* Threshold Status Pill */}
            <div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '12px',
                background: fields.threshold_status === 'below_100' ? '#dcfce7' : fields.threshold_status === 'possibly_100_plus' ? '#fef3c7' : fields.threshold_status === 'above_100' ? '#dbeafe' : '#f1f5f9',
                color: fields.threshold_status === 'below_100' ? '#166534' : fields.threshold_status === 'possibly_100_plus' ? '#92400e' : fields.threshold_status === 'above_100' ? '#1e40af' : '#475569'
              }}>
                Threshold: {fields.threshold_status.replace('_', ' ')}
              </span>
            </div>
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
                onChange={(e) => handleFieldChange('estimated_value_low', e.target.value)}
                placeholder="e.g. 20"
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
                onChange={(e) => handleFieldChange('estimated_value_high', e.target.value)}
                placeholder="e.g. 45"
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
                onChange={(e) => handleFieldChange('distribution_value', e.target.value)}
                placeholder="Optional single value"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Valuation Basis */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Valuation Basis & Comparable Sales Mentions
            </label>
            <textarea
              className="input"
              rows={2}
              value={fields.value_basis}
              onChange={(e) => handleFieldChange('value_basis', e.target.value)}
              placeholder="Extracted rationale, comps, or market observations..."
              style={{ width: '100%', fontSize: '0.86rem' }}
            />
          </div>

          {/* Distribution Policy Note */}
          <div style={{ padding: '0.85rem 1rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', fontWeight: 700, color: '#334155' }}>
                <Info size={16} color="var(--pine-primary)" />
                <span>$100 Threshold Rule</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                The $100 threshold controls valuation research depth, not historical research depth. A $30 maritime object can have significant legacy interest.
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
              <input
                type="checkbox"
                checked={fields.counts_against_distribution}
                onChange={(e) => handleFieldChange('counts_against_distribution', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--pine-primary)' }}
              />
              <span>Counts Against Distribution</span>
            </label>
          </div>
        </div>

        {/* 5. LEGACY / COLLECTION SIGNIFICANCE */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
            5. Legacy & Virtual Museum Collection Significance
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { id: 'none', label: 'None / Ordinary Estate Item' },
              { id: 'possible', label: 'Possible Interest' },
              { id: 'significant', label: 'Significant Legacy Interest' },
              { id: 'unknown', label: 'Unknown / Needs Research' }
            ].map(sig => (
              <label
                key={sig.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: fields.legacy_significance === sig.id ? '2px solid var(--pine-primary)' : '1px solid var(--border-color)',
                  background: fields.legacy_significance === sig.id ? '#f0fdf4' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="legacy_significance"
                  value={sig.id}
                  checked={fields.legacy_significance === sig.id}
                  onChange={() => handleFieldChange('legacy_significance', sig.id)}
                  style={{ accentColor: 'var(--pine-primary)' }}
                />
                <span style={{ fontSize: '0.84rem', fontWeight: fields.legacy_significance === sig.id ? 700 : 500, color: '#1e293b' }}>
                  {sig.label}
                </span>
              </label>
            ))}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Significance Rationale / Collection Factors
            </label>
            <input
              type="text"
              className="input"
              value={fields.legacy_significance_reason}
              onChange={(e) => handleFieldChange('legacy_significance_reason', e.target.value)}
              placeholder="e.g. Maritime navigational tool related to Jim's merchant marine career..."
              style={{ width: '100%', fontSize: '0.88rem' }}
            />
          </div>
        </div>

        {/* 6. SEPARATE CONFIDENCE RATINGS */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
            6. Confidence Ratings & Appraisal Recommendation
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Identification Confidence
              </label>
              <select
                className="input"
                value={fields.identification_confidence}
                onChange={(e) => handleFieldChange('identification_confidence', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="HIGH">HIGH (Strong documentation / clear marks)</option>
                <option value="MEDIUM">MEDIUM (Probable identification based on style/notes)</option>
                <option value="LOW">LOW (Uncertain / tentative attribution)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Valuation Confidence
              </label>
              <select
                className="input"
                value={fields.value_confidence}
                onChange={(e) => handleFieldChange('value_confidence', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="HIGH">HIGH (Established market comps / appraisals)</option>
                <option value="MEDIUM">MEDIUM (Plausible secondary market estimate)</option>
                <option value="LOW">LOW (Wide variance / unverified estimate)</option>
              </select>
            </div>
          </div>

          <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600, color: '#1e293b' }}>
              <input
                type="checkbox"
                checked={fields.appraisal_recommended}
                onChange={(e) => handleFieldChange('appraisal_recommended', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--pine-primary)' }}
              />
              <span>Recommend formal professional appraisal</span>
            </label>
          </div>
        </div>

        {/* 7. STRUCTURED RESEARCH SOURCES MANAGER */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--pine-deep)', fontFamily: 'var(--font-heading)' }}>
                7. Structured Research Sources ({researchSources.length})
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                External evidence and citations stored separately from the object description.
              </div>
            </div>

            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowAddSource(!showAddSource)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> Add Research Source
            </button>
          </div>

          {/* Inline Add Source Form */}
          {showAddSource && (
            <form onSubmit={handleAddSourceSubmit} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: '0.75rem' }}>Add External Research Source</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Source Type</label>
                  <select
                    className="input"
                    value={newSource.sourceType}
                    onChange={(e) => setNewSource({ ...newSource, sourceType: e.target.value })}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  >
                    <option value="Completed eBay Sale">Completed eBay Sale</option>
                    <option value="Active eBay Listing">Active eBay Listing</option>
                    <option value="Auction Result">Auction Result</option>
                    <option value="Dealer / Retail Listing">Dealer / Retail Listing</option>
                    <option value="Museum Collection">Museum Collection</option>
                    <option value="Library / Archive">Library / Archive</option>
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Scholarly Reference">Scholarly Reference</option>
                    <option value="General Web Reference">General Web Reference</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Website / Organization</label>
                  <input
                    type="text"
                    className="input"
                    value={newSource.websiteOrOrg}
                    onChange={(e) => setNewSource({ ...newSource, websiteOrOrg: e.target.value })}
                    placeholder="e.g. LiveAuctioneers, Met Museum"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Source Title / Listing Name</label>
                  <input
                    type="text"
                    className="input"
                    value={newSource.title}
                    onChange={(e) => setNewSource({ ...newSource, title: e.target.value })}
                    placeholder="e.g. 19th Century Marine Sextant"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Direct URL</label>
                  <input
                    type="url"
                    className="input"
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                    placeholder="https://..."
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Source / Sale Date</label>
                  <input
                    type="text"
                    className="input"
                    value={newSource.sourceDate}
                    onChange={(e) => setNewSource({ ...newSource, sourceDate: e.target.value })}
                    placeholder="e.g. 2024-03-15 or c. 2020"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={newSource.soldPrice}
                    onChange={(e) => setNewSource({ ...newSource, soldPrice: e.target.value })}
                    placeholder="e.g. 150.00"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-outline" onClick={() => setShowAddSource(false)} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>Cancel</button>
                <button type="submit" className="btn-green" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>Save Source</button>
              </div>
            </form>
          )}

          {/* Sources List */}
          {researchSources.length === 0 ? (
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              No structured research sources currently attached.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {researchSources.map((s, idx) => (
                <div key={s.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                        {s.sourceType || s.source_type}
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                        {s.title || s.websiteOrOrg || s.website_or_org || 'Web Citation'}
                      </strong>
                      {(s.soldPrice || s.sold_price || s.askingPrice || s.asking_price) && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                          ${s.soldPrice || s.sold_price || s.askingPrice || s.asking_price}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {s.websiteOrOrg || s.website_or_org ? <span>Org: {s.websiteOrOrg || s.website_or_org}</span> : null}
                      {s.sourceDate || s.source_date ? <span>Evidence Date: {s.sourceDate || s.source_date}</span> : null}
                      {s.dateAccessed || s.date_accessed ? <span>Accessed: {s.dateAccessed || s.date_accessed}</span> : null}
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pine-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'underline' }}>
                          Direct Link <ExternalLink size={11} />
                        </a>
                      )}
                      {s.originalUrl && s.originalUrl !== s.url && (
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }} title={`Raw URL: ${s.originalUrl}`}>
                          [Preserved raw URL]
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSource(idx)}
                    style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px' }}
                    title="Remove source"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 8. RAW ORIGINAL NOTES & BASELINE ACCORDION */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          <button
            onClick={() => setShowRawNotes(!showRawNotes)}
            style={{ width: '100%', padding: '0.75rem 1rem', background: '#f8fafc', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} color="var(--pine-primary)" />
              Original Legacy Raw Notes & Conversational Text (Permanently Archived)
            </span>
            {showRawNotes ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
          </button>
          {showRawNotes && (
            <div style={{ padding: '1rem', background: '#fafafa', fontSize: '0.84rem', color: '#475569', lineHeight: 1.6, maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap', borderTop: '1px solid #e2e8f0' }}>
              {originalData?.special_handling_notes && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#1e293b' }}>Legacy Assessment / Special Handling Notes:</strong>
                  <div>{originalData.special_handling_notes}</div>
                </div>
              )}
              {originalData?.description && (
                <div>
                  <strong style={{ color: '#1e293b' }}>Legacy Description:</strong>
                  <div>{originalData.description}</div>
                </div>
              )}
            </div>
          )}
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
            style={{ padding: '0.75rem 1.8rem', fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
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

// Helper Subcomponent: Field Review Card with side-by-side comparison & toggles
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

