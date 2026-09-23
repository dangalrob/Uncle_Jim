import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, CheckCircle2, AlertCircle, AlertTriangle, ArrowLeft, ArrowRight,
  RotateCcw, ShieldCheck, Check, Edit3, Eye, FileText,
  ChevronDown, ChevronUp, Loader2, Info, ExternalLink, Plus, Trash2, 
  HelpCircle, Compass, Tag, Globe, Link as LinkIcon, Camera, Upload, ImageIcon
} from 'lucide-react';

/**
 * LEGACY DATA NORMALIZATION WIZARD (V2 - 5-Step Curatorial Flow)
 * ----------------------------------------------------------------
 * Reusable Item Assessment Engine Consumer:
 * Step 1: Examine (Initial assessment, photos, evidence indicators, depth classification)
 * Step 2: Help Me Verify (Interactive questions: 0-5 questions/round, "Don't Know", photo uploads)
 * Step 3: Re-evaluating with Admin Answers as structured evidence
 * Step 4: Review Proposed Record (Harmonized description and structured fields, side-by-side)
 * Step 5: Approve & Complete Permanent Inventory Record
 */
export default function LegacyNormalizationWizard({
  item,
  threshold = 100,
  onClose,
  onSuccess
}) {
  // Wizard Navigation: 1: 'examine', 2: 'verify_questions', 3: 'evaluating', 4: 'review_record', 5: 'approved'
  const [wizardStep, setWizardStep] = useState(1);
  const [roundNumber, setRoundNumber] = useState(1);

  const [loading, setLoading] = useState(true);
  const [extractError, setExtractError] = useState(null);
  const [snapshotId, setSnapshotId] = useState(null);
  const [createdSnapshot, setCreatedSnapshot] = useState(false);
  const [proposedData, setProposedData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [evidenceSources, setEvidenceSources] = useState(null);

  // Active Assessment Depth (UNASSESSED, BASIC, STANDARD, HISTORICAL_COLLECTIBLE)
  const [researchLevel, setResearchLevel] = useState('UNASSESSED');
  const [recommendedLevel, setRecommendedLevel] = useState('BASIC');
  const [researchLevelReason, setResearchLevelReason] = useState('');

  // Structured Questions & Admin Answers State
  const [questions, setQuestions] = useState([]);
  const [adminAnswers, setAdminAnswers] = useState({}); // qid -> { status: 'ANSWERED'|'UNKNOWN', answer: '', evidenceType: 'FACT'|'FAMILY_RECOLLECTION'|'REASONABLE_INFERENCE', photoFile: null, photoPreview: null }
  const [hasFollowUpOption, setHasFollowUpOption] = useState(false);

  // Permanent Record Fields
  const [fields, setFields] = useState({
    title: '',
    object_type: '',
    description: '',
    origin: '',
    era: '',
    materials: '',
    maker: '',
    model: '',
    identifying_marks: '',
    historical_cultural_context: '',
    acquisition_context: '',
    jim_connection_type: 'UNKNOWN',
    jim_connection_notes: '',
    provenance_text: '',
    dimensions: '',
    condition: '',
    legacy_significance: 'none',
    legacy_significance_reason: '',
    identification_confidence: 'MEDIUM',
    identification_confidence_reason: '',
    verification_needed: '',
    follow_up_worthwhile: '',
    // Existing values preserved
    estimated_value_low: '',
    estimated_value_high: '',
    distribution_value: '',
    counts_against_distribution: false,
    value_basis: '',
    appraisal_recommended: false,
    appraisal_reason: ''
  });

  // Research Sources State
  const [researchSources, setResearchSources] = useState([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({
    sourceType: 'General Web Reference',
    websiteOrOrg: '',
    title: '',
    url: '',
    originalUrl: '',
    sourceDate: '',
    listingDate: '',
    askingPrice: '',
    soldPrice: '',
    currency: 'USD',
    status: 'reference',
    usedFor: 'Identification',
    relevance: '',
    notes: ''
  });

  // Track field modes for side-by-side editing: 'proposed' | 'original' | 'custom'
  const [fieldMode, setFieldMode] = useState({});
  const [showRawNotes, setShowRawNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(null);

  // Initial load: Run engine extraction for legacy item
  useEffect(() => {
    runExtraction();
  }, [item?.id]);

  const runExtraction = async (levelOverride = null, answers = {}, round = 1) => {
    setLoading(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/admin/normalize/extract/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideResearchLevel: levelOverride,
          adminAnswers: answers,
          roundNumber: round
        })
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
      setResearchLevelReason(p.researchLevelReason || p.identificationConfidenceReason || '');

      // Set research sources
      setResearchSources(p.researchSources || []);

      // Set questions
      const incomingQuestions = p.questions || [];
      setQuestions(incomingQuestions);

      // Initialize answers state for new questions
      const initialAnswers = { ...answers };
      incomingQuestions.forEach(q => {
        if (!initialAnswers[q.questionId]) {
          initialAnswers[q.questionId] = {
            status: 'UNANSWERED',
            answer: '',
            evidenceType: 'FACT',
            photoFile: null,
            photoPreview: null
          };
        }
      });
      setAdminAnswers(initialAnswers);

      // Populate editable permanent record fields
      setFields({
        title: p.proposedTitle || o.title || '',
        object_type: p.objectType || o.object_type || '',
        description: p.cleanDescription || o.description || '',
        origin: p.origin || o.origin || '',
        era: p.era || o.era || '',
        materials: p.materials || o.materials || '',
        maker: p.maker || o.maker || '',
        model: p.model || o.model || '',
        identifying_marks: p.identifyingMarks || o.identifying_marks || '',
        historical_cultural_context: p.historicalCulturalContext || o.historical_cultural_context || '',
        acquisition_context: p.acquisitionContext || o.acquisition_context || '',
        jim_connection_type: p.jimConnectionType || o.jim_connection_type || 'UNKNOWN',
        jim_connection_notes: p.jimConnectionNotes || o.jim_connection_notes || '',
        provenance_text: p.provenanceText || o.provenance_text || '',
        dimensions: p.dimensions || o.dimensions || '',
        condition: p.condition || o.condition || '',
        legacy_significance: p.legacySignificance || o.legacy_significance || 'none',
        legacy_significance_reason: p.legacySignificanceReason || o.legacy_significance_reason || '',
        identification_confidence: p.identificationConfidence || o.identification_confidence || 'MEDIUM',
        identification_confidence_reason: p.identificationConfidenceReason || '',
        verification_needed: p.verificationNeeded || o.verification_needed || '',
        follow_up_worthwhile: p.followUpWorthwhile || o.follow_up_worthwhile || '',
        // Existing valuation preserved
        estimated_value_low: o.estimated_value_low || '',
        estimated_value_high: o.estimated_value_high || '',
        distribution_value: o.distribution_value || '',
        counts_against_distribution: Boolean(o.counts_against_distribution),
        value_basis: o.value_basis || '',
        appraisal_recommended: Boolean(o.appraisal_recommended),
        appraisal_reason: o.appraisal_reason || ''
      });

      // Default modes to 'proposed'
      const modes = {};
      [
        'title', 'object_type', 'description', 'origin', 'era', 'materials', 'maker', 'model',
        'identifying_marks', 'historical_cultural_context', 'acquisition_context', 'jim_connection',
        'provenance_text', 'dimensions', 'condition', 'legacy_significance', 'verification_needed',
        'follow_up_worthwhile'
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
    runExtraction(newLevel, adminAnswers, roundNumber);
  };

  // Answering questions in Step 2
  const handleAnswerChange = (questionId, text, evidenceType = null) => {
    setAdminAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        status: 'ANSWERED',
        answer: text,
        evidenceType: evidenceType || prev[questionId]?.evidenceType || 'FACT'
      }
    }));
  };

  const handleDontKnow = (questionId) => {
    setAdminAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        status: 'UNKNOWN',
        answer: 'Don\'t Know',
        evidenceType: 'UNKNOWN'
      }
    }));
  };

  const handleQuestionPhotoUpload = (questionId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAdminAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        status: 'ANSWERED',
        answer: prev[questionId]?.answer || 'Photo provided',
        photoFile: file,
        photoPreview: previewUrl
      }
    }));
  };

  // Re-evaluation with answers (Step 3)
  const handleContinueAssessment = async () => {
    setWizardStep(3); // 'evaluating'
    try {
      const formData = new FormData();
      formData.append('itemId', item.id);
      formData.append('mode', 'LEGACY_NORMALIZATION');
      formData.append('researchLevelOverride', researchLevel);
      formData.append('roundNumber', roundNumber + 1);
      formData.append('adminAnswersJson', JSON.stringify(adminAnswers));

      // Append any newly uploaded photos from questions
      Object.entries(adminAnswers).forEach(([qid, ans]) => {
        if (ans.photoFile) {
          formData.append('photos', ans.photoFile);
        }
      });

      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/assessment/evaluate', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to re-evaluate assessment');

      const a = data.assessment || {};
      setProposedData(prev => ({ ...prev, ...a }));

      // Update fields with new curatorial conclusions
      setFields(prev => ({
        ...prev,
        title: a.identification?.proposedTitle || a.proposedTitle || prev.title,
        object_type: a.identification?.objectType || a.objectType || prev.object_type,
        description: a.description?.cleanDescription || a.cleanDescription || prev.description,
        origin: a.attributes?.origin || a.origin || prev.origin,
        era: a.attributes?.era || a.era || prev.era,
        materials: a.attributes?.materials || a.materials || prev.materials,
        maker: a.attributes?.maker || a.maker || prev.maker,
        model: a.attributes?.model || a.model || prev.model,
        identifying_marks: a.attributes?.identifyingMarks || a.identifyingMarks || prev.identifying_marks,
        dimensions: a.attributes?.dimensions || a.dimensions || prev.dimensions,
        condition: a.attributes?.condition || a.condition || prev.condition,
        historical_cultural_context: a.historicalContext?.historicalCulturalContext || a.historicalCulturalContext || prev.historical_cultural_context,
        acquisition_context: a.historicalContext?.acquisitionContext || a.acquisitionContext || prev.acquisition_context,
        jim_connection_type: a.provenance?.jimConnectionType || a.jimConnectionType || prev.jim_connection_type,
        jim_connection_notes: a.provenance?.jimConnectionNotes || a.jimConnectionNotes || prev.jim_connection_notes,
        legacy_significance: a.legacy?.significance || a.legacySignificance || prev.legacy_significance,
        legacy_significance_reason: a.legacy?.significanceReason || a.legacySignificanceReason || prev.legacy_significance_reason,
        identification_confidence: a.identification?.confidence || a.identificationConfidence || prev.identification_confidence,
        identification_confidence_reason: a.identification?.confidenceReason || a.identificationConfidenceReason || '',
        verification_needed: a.verification?.verificationNeeded || a.verificationNeeded || prev.verification_needed,
        follow_up_worthwhile: a.verification?.followUpWorthwhile || a.followUpWorthwhile || prev.follow_up_worthwhile
      }));

      // If follow-up questions were generated for round 2, give option to continue or prepare now
      const newQs = a.questions || [];
      if (newQs.length > 0 && roundNumber < 2) {
        setQuestions(newQs);
        setRoundNumber(prev => prev + 1);
        setHasFollowUpOption(true);
      } else {
        setHasFollowUpOption(false);
        setWizardStep(4); // proceed to review record
      }
    } catch (err) {
      console.error('Re-evaluation error:', err);
      alert('Error updating assessment: ' + err.message);
      setWizardStep(4); // proceed to review anyway so admin is not blocked
    }
  };

  // Field manipulation helpers for Step 4
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
      title: p.proposedTitle || p.identification?.proposedTitle || prev.title,
      object_type: p.objectType || p.identification?.objectType || prev.object_type,
      description: p.cleanDescription || p.description?.cleanDescription || prev.description,
      origin: p.origin || p.attributes?.origin || prev.origin,
      era: p.era || p.attributes?.era || prev.era,
      materials: p.materials || p.attributes?.materials || prev.materials,
      maker: p.maker || p.attributes?.maker || prev.maker,
      model: p.model || p.attributes?.model || prev.model,
      identifying_marks: p.identifyingMarks || p.attributes?.identifyingMarks || prev.identifying_marks,
      historical_cultural_context: p.historicalCulturalContext || p.historicalContext?.historicalCulturalContext || prev.historical_cultural_context,
      acquisition_context: p.acquisitionContext || p.historicalContext?.acquisitionContext || prev.acquisition_context,
      jim_connection_type: p.jimConnectionType || p.provenance?.jimConnectionType || prev.jim_connection_type,
      jim_connection_notes: p.jimConnectionNotes || p.provenance?.jimConnectionNotes || prev.jim_connection_notes,
      dimensions: p.dimensions || p.attributes?.dimensions || prev.dimensions,
      condition: p.condition || p.attributes?.condition || prev.condition,
      legacy_significance: p.legacySignificance || p.legacy?.significance || prev.legacy_significance,
      legacy_significance_reason: p.legacySignificanceReason || p.legacy?.significanceReason || prev.legacy_significance_reason,
      identification_confidence: p.identificationConfidence || p.identification?.confidence || prev.identification_confidence,
      verification_needed: p.verificationNeeded || p.verification?.verificationNeeded || prev.verification_needed,
      follow_up_worthwhile: p.followUpWorthwhile || p.verification?.followUpWorthwhile || prev.follow_up_worthwhile
    }));

    const modes = {};
    [
      'title', 'object_type', 'description', 'origin', 'era', 'materials', 'maker', 'model',
      'identifying_marks', 'historical_cultural_context', 'acquisition_context', 'jim_connection',
      'provenance_text', 'dimensions', 'condition', 'legacy_significance', 'verification_needed',
      'follow_up_worthwhile'
    ].forEach(k => { modes[k] = 'proposed'; });
    setFieldMode(modes);
  };

  // Research Sources manager helpers
  const handleAddSourceSubmit = (e) => {
    if (e) e.preventDefault();
    if (!newSource.title && !newSource.url) {
      alert('Please provide at least a source title or URL');
      return;
    }
    const created = {
      id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      sourceType: newSource.sourceType,
      websiteOrOrg: newSource.websiteOrOrg || 'Web Source',
      title: newSource.title || 'Reference Link',
      url: newSource.url || null,
      originalUrl: newSource.url || null,
      sourceDate: newSource.sourceDate || null,
      listingDate: newSource.listingDate || null,
      askingPrice: newSource.askingPrice ? parseFloat(newSource.askingPrice) : null,
      soldPrice: newSource.soldPrice ? parseFloat(newSource.soldPrice) : null,
      currency: newSource.currency || 'USD',
      status: newSource.status || 'reference',
      usedFor: newSource.usedFor || 'Identification',
      relevance: newSource.relevance || '',
      notes: newSource.notes || null,
      dateAccessed: new Date().toISOString().split('T')[0]
    };
    setResearchSources(prev => [created, ...prev]);
    setNewSource({
      sourceType: 'General Web Reference',
      websiteOrOrg: '',
      title: '',
      url: '',
      originalUrl: '',
      sourceDate: '',
      listingDate: '',
      askingPrice: '',
      soldPrice: '',
      currency: 'USD',
      status: 'reference',
      usedFor: 'Identification',
      relevance: '',
      notes: ''
    });
    setShowAddSource(false);
  };

  const handleRemoveSource = (idxToRemove) => {
    setResearchSources(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Final Approval Commit (Step 5)
  const handleApprove = async () => {
    setSaving(true);
    try {
      const payloadFields = {
        title: fields.title,
        object_type: fields.object_type,
        description: fields.description,
        origin: fields.origin,
        era: fields.era,
        materials: fields.materials,
        maker: fields.maker,
        model: fields.model,
        identifying_marks: fields.identifying_marks,
        historical_cultural_context: fields.historical_cultural_context,
        acquisition_context: fields.acquisition_context,
        jim_connection_type: fields.jim_connection_type,
        jim_connection_notes: fields.jim_connection_notes,
        provenance_text: fields.provenance_text,
        dimensions: fields.dimensions,
        condition: fields.condition,
        legacy_significance: fields.legacy_significance,
        legacy_significance_reason: fields.legacy_significance_reason,
        identification_confidence: fields.identification_confidence,
        identification_confidence_reason: fields.identification_confidence_reason,
        verification_needed: fields.verification_needed,
        follow_up_worthwhile: fields.follow_up_worthwhile,
        research_level: researchLevel,
        assessment_version: 'ITEM_ASSESSMENT_V1',
        // Existing valuation preserved
        estimated_value_low: fields.estimated_value_low,
        estimated_value_high: fields.estimated_value_high,
        distribution_value: fields.distribution_value,
        counts_against_distribution: fields.counts_against_distribution,
        value_basis: fields.value_basis,
        appraisal_recommended: fields.appraisal_recommended,
        appraisal_reason: fields.appraisal_reason
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
      setWizardStep(5); // 'approved'
      if (onSuccess) {
        onSuccess(data.item);
      }
    } catch (err) {
      alert('Error approving normalization: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '3.5rem 2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Loader2 size={40} color="var(--pine-primary)" style={{ animation: 'spin 1.2s linear infinite', margin: '0 auto 1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 0.5rem' }}>
          Normalizing Legacy Estate Record...
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem', maxWidth: '580px', margin: '0 auto 1.5rem' }}>
          Examining authentic physical evidence for <strong>"{item?.title}"</strong>,
          separating facts from conclusions, securing an immutable baseline snapshot, and formulating curatorial proposals.
        </p>
      </div>
    );
  }

  // Error Screen
  if (extractError) {
    return (
      <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '1.25rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <AlertCircle size={24} />
          <div>
            <strong>Normalization Error:</strong> {extractError}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-green" onClick={() => runExtraction(researchLevel)}>🔄 Retry Extraction</button>
          <button className="btn-outline" onClick={onClose}>Close Wizard</button>
        </div>
      </div>
    );
  }

  // STEP 5: SUCCESS / POST-APPROVAL SCREEN
  if (wizardStep === 5 && commitSuccess) {
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
                Normalized & Permanent
              </span>
              <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Depth: {updated?.research_level || researchLevel}
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', color: '#14532d', margin: '4px 0 0 0', fontSize: '1.6rem' }}>
              Permanent Record Approved!
            </h2>
          </div>
        </div>

        <p style={{ color: '#166534', fontSize: '0.94rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          The clean curatorial description and structured fields are now the authoritative permanent inventory record for this item.
          Raw text was archived in <code>legacy_assessment_notes</code>, and the baseline snapshot remains permanently secured.
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
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '0.5rem' }}>After (Clean Permanent Record)</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#14532d', marginBottom: '0.35rem' }}>{updated?.title}</div>
            <div style={{ fontSize: '0.84rem', color: '#166534', maxHeight: '180px', overflowY: 'auto', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px 0' }}>{updated?.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', marginTop: '8px' }}>
                {updated?.object_type && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Type: {updated.object_type}</span>}
                {updated?.era && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Era: {updated.era}</span>}
                {updated?.origin && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Origin: {updated.origin}</span>}
                {updated?.maker && <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Maker: {updated.maker}</span>}
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

  // STEP 3: EVALUATING TRANSITION SCREEN
  if (wizardStep === 3) {
    if (hasFollowUpOption) {
      return (
        <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '2.5rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ background: '#eff6ff', color: '#1d4ed8', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <HelpCircle size={28} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 0.5rem' }}>
            Follow-Up Questions Available
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '560px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Based on your answers, {questions.length} optional follow-up question{questions.length > 1 ? 's' : ''} could further refine this record.
            You can continue research or prepare the permanent record now with your current level of certainty.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button className="btn-outline" onClick={() => setWizardStep(4)} style={{ padding: '0.7rem 1.4rem' }}>
              Prepare Record Now →
            </button>
            <button className="btn-green" onClick={() => setWizardStep(2)} style={{ padding: '0.7rem 1.4rem' }}>
              Continue Research (Round 2)
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '3.5rem 2rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
        <Loader2 size={40} color="var(--pine-primary)" style={{ animation: 'spin 1.2s linear infinite', margin: '0 auto 1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 0.5rem' }}>
          Re-evaluating Evidence...
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem' }}>
          Synthesizing Admin responses into authentic evidence and drafting updated curatorial record...
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1020px', margin: '1.5rem auto', padding: '2.25rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 28px rgba(0,0,0,0.08)' }}>
      {/* STEPPER PROGRESS HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: 'var(--pine-primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
              Legacy Normalization Wizard
            </span>
            <span style={{ fontSize: '0.75rem', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} /> Baseline Secured
            </span>
            {proposedData?.metadata?.aiUnavailable && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                AI Offline: Evidence Preserved
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.55rem', color: 'var(--pine-deep)', margin: '2px 0 0 0' }}>
            {item?.title || 'Normalize Item'}
          </h1>
        </div>

        {/* 4-Step Interactive Bar */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
          <button
            type="button"
            onClick={() => setWizardStep(1)}
            style={{ border: 'none', background: wizardStep === 1 ? 'var(--pine-primary)' : '#f1f5f9', color: wizardStep === 1 ? '#fff' : '#64748b', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            1. Examine
          </button>
          <ArrowRight size={14} color="#94a3b8" />
          <button
            type="button"
            onClick={() => setWizardStep(2)}
            style={{ border: 'none', background: wizardStep === 2 ? 'var(--pine-primary)' : '#f1f5f9', color: wizardStep === 2 ? '#fff' : '#64748b', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            2. Help Me Verify {questions.length > 0 ? `(${questions.length})` : ''}
          </button>
          <ArrowRight size={14} color="#94a3b8" />
          <button
            type="button"
            onClick={() => setWizardStep(4)}
            style={{ border: 'none', background: wizardStep === 4 ? 'var(--pine-primary)' : '#f1f5f9', color: wizardStep === 4 ? '#fff' : '#64748b', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            3. Review Record
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* STEP 1: EXAMINE (Evidence Overview & Assessment Depth)        */}
      {/* ============================================================== */}
      {wizardStep === 1 && (
        <div>
          {/* RESEARCH DEPTH CONTROL */}
          <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Assessment Depth Level</div>
              <div style={{ fontSize: '0.9rem', color: '#1e293b', marginTop: '2px' }}>
                Active: <strong style={{ color: researchLevel === 'HISTORICAL_COLLECTIBLE' ? '#7c2d12' : (researchLevel === 'STANDARD' ? '#1e40af' : '#15803d') }}>{researchLevel}</strong>
                {recommendedLevel && recommendedLevel !== researchLevel && (
                  <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '8px' }}>(AI recommended: {recommendedLevel})</span>
                )}
              </div>
              {researchLevelReason && (
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>{researchLevelReason}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>Change Depth:</span>
              <select
                value={researchLevel}
                onChange={e => handleOverrideResearchLevel(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              >
                <option value="BASIC">BASIC (Concise household/novelty)</option>
                <option value="STANDARD">STANDARD (Equipment/furniture)</option>
                <option value="HISTORICAL_COLLECTIBLE">HISTORICAL / COLLECTIBLE (Museum deep)</option>
              </select>
            </div>
          </div>

          {/* INITIAL EVIDENCE & PRELIMINARY ASSESSMENT SUMMARY */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Left: Preliminary Assessment */}
            <div style={{ background: '#fdfbf7', padding: '1.25rem', borderRadius: '12px', border: '1px solid #fed7aa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c2410c', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                <Compass size={16} /> Preliminary Object Identification
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1c1917', marginBottom: '0.35rem' }}>
                {proposedData?.proposedTitle || proposedData?.identification?.proposedTitle || item.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem', fontSize: '0.82rem' }}>
                <span style={{ background: '#fed7aa', color: '#7c2d12', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Type: {proposedData?.objectType || proposedData?.identification?.objectType || 'General Object'}
                </span>
                <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Confidence: {proposedData?.identificationConfidence || proposedData?.identification?.confidence || 'MEDIUM'}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#431407', lineHeight: 1.5, background: '#fff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fdba74' }}>
                <p style={{ margin: 0 }}>
                  {proposedData?.cleanDescription || proposedData?.description?.cleanDescription || 'Initial curatorial assessment pending review.'}
                </p>
              </div>
            </div>

            {/* Right: Original Evidence & Notes */}
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Original Raw Legacy Record
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                {originalData?.title}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#475569', maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5, background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {originalData?.special_handling_notes || originalData?.description || '(No legacy notes recorded)'}
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                Original Recorded Value: <strong>{originalData?.value || 'None'}</strong>
              </div>
            </div>
          </div>

          {/* ACTION NAVIGATION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-outline"
                onClick={() => setWizardStep(4)}
                style={{ padding: '0.65rem 1.25rem' }}
              >
                Skip to Review Record →
              </button>
              {questions.length > 0 ? (
                <button
                  className="btn-green"
                  onClick={() => setWizardStep(2)}
                  style={{ padding: '0.65rem 1.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <HelpCircle size={16} /> Help Me Verify ({questions.length} Question{questions.length > 1 ? 's' : ''})
                </button>
              ) : (
                <button
                  className="btn-green"
                  onClick={() => setWizardStep(4)}
                  style={{ padding: '0.65rem 1.4rem' }}
                >
                  Proceed to Review Record →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 2: HELP ME VERIFY (Interactive Purposeful Questions)    */}
      {/* ============================================================== */}
      {wizardStep === 2 && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 0.35rem', fontSize: '1.35rem' }}>
              Curatorial Verification & Questions
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>
              The engine identified specific details that could materially improve the record.
              Answer what you know, upload requested photos if available, or click <strong>"Don't Know"</strong> to proceed.
            </p>
          </div>

          {questions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
              <CheckCircle2 size={36} color="#15803d" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 600, color: '#166534', fontSize: '1rem', marginBottom: '4px' }}>
                No Additional Questions Needed
              </div>
              <div style={{ fontSize: '0.88rem', color: '#64748b' }}>
                The available evidence is sufficient for this item under {researchLevel} depth.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
              {questions.map((q, idx) => {
                const ansState = adminAnswers[q.questionId] || {};
                const isUnknown = ansState.status === 'UNKNOWN';

                return (
                  <div
                    key={q.questionId || idx}
                    style={{
                      background: isUnknown ? '#f8fafc' : '#fff',
                      border: isUnknown ? '1px dashed #cbd5e1' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.65rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', background: q.importance === 'HIGH' ? '#fee2e2' : '#f1f5f9', color: q.importance === 'HIGH' ? '#b91c1c' : '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                            {q.importance || 'STANDARD'} IMPORTANCE
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Question {idx + 1} of {questions.length}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1e293b' }}>
                          {q.question}
                        </div>
                        {q.reason && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                            <strong>Why this matters:</strong> {q.reason}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDontKnow(q.questionId)}
                        style={{
                          background: isUnknown ? '#f1f5f9' : '#fff',
                          border: isUnknown ? '1px solid #94a3b8' : '1px solid #cbd5e1',
                          color: isUnknown ? '#0f172a' : '#64748b',
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: isUnknown ? 700 : 500,
                          flexShrink: 0
                        }}
                      >
                        {isUnknown ? '✓ Marked Unknown' : 'Don\'t Know'}
                      </button>
                    </div>

                    {/* INPUT SECTION BASED ON RESPONSE TYPE */}
                    {!isUnknown && (
                      <div style={{ marginTop: '0.75rem' }}>
                        {/* 1. Yes / No */}
                        {q.responseType === 'yes_no' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => handleAnswerChange(q.questionId, 'Yes', 'FACT')}
                              style={{
                                padding: '0.45rem 1.25rem',
                                borderRadius: '6px',
                                border: ansState.answer === 'Yes' ? '2px solid var(--pine-primary)' : '1px solid #cbd5e1',
                                background: ansState.answer === 'Yes' ? '#dcfce7' : '#fff',
                                fontWeight: ansState.answer === 'Yes' ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAnswerChange(q.questionId, 'No', 'FACT')}
                              style={{
                                padding: '0.45rem 1.25rem',
                                borderRadius: '6px',
                                border: ansState.answer === 'No' ? '2px solid var(--pine-primary)' : '1px solid #cbd5e1',
                                background: ansState.answer === 'No' ? '#fee2e2' : '#fff',
                                fontWeight: ansState.answer === 'No' ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              No
                            </button>
                          </div>
                        )}

                        {/* 2. Multiple Choice */}
                        {q.responseType === 'multiple_choice' && Array.isArray(q.options) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {q.options.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleAnswerChange(q.questionId, opt, 'FACT')}
                                style={{
                                  padding: '0.4rem 0.85rem',
                                  borderRadius: '6px',
                                  border: ansState.answer === opt ? '2px solid var(--pine-primary)' : '1px solid #cbd5e1',
                                  background: ansState.answer === opt ? '#dcfce7' : '#fff',
                                  fontWeight: ansState.answer === opt ? 700 : 500,
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* 3. Photo Request */}
                        {q.responseType === 'photo' && (
                          <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--pine-primary)', color: '#fff', padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                                <Camera size={16} /> Take / Upload Requested Photo
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={e => handleQuestionPhotoUpload(q.questionId, e)}
                                  style={{ display: 'none' }}
                                />
                              </label>

                              {ansState.photoPreview && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <img src={ansState.photoPreview} alt="Uploaded detail" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                                  <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>✓ Photo Attached</span>
                                </div>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="Optional note about this photo or mark..."
                              value={ansState.answer === 'Photo provided' ? '' : (ansState.answer || '')}
                              onChange={e => handleAnswerChange(q.questionId, e.target.value)}
                              style={{ width: '100%', marginTop: '0.5rem', padding: '0.4rem 0.65rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            />
                          </div>
                        )}

                        {/* 4. Free Text or Numeric */}
                        {(q.responseType === 'text' || q.responseType === 'numeric' || !q.responseType) && (
                          <div>
                            <input
                              type={q.responseType === 'numeric' ? 'number' : 'text'}
                              placeholder="Enter detail here..."
                              value={ansState.answer || ''}
                              onChange={e => handleAnswerChange(q.questionId, e.target.value)}
                              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginBottom: '0.4rem' }}
                            />
                            {/* Evidence Classification Selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                              <span>Evidence Nature:</span>
                              <select
                                value={ansState.evidenceType || 'FACT'}
                                onChange={e => handleAnswerChange(q.questionId, ansState.answer || '', e.target.value)}
                                style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                              >
                                <option value="FACT">Documented Fact (Receipt / Label)</option>
                                <option value="FAMILY_RECOLLECTION">Family Recollection / Story</option>
                                <option value="REASONABLE_INFERENCE">Reasonable Inference</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 2 ACTIONS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
            <button className="btn-outline" onClick={() => setWizardStep(1)}>
              ← Back to Examine
            </button>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-outline" onClick={() => setWizardStep(4)}>
                Skip to Review Record →
              </button>
              {questions.length > 0 && (
                <button
                  className="btn-green"
                  onClick={handleContinueAssessment}
                  style={{ padding: '0.65rem 1.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={16} /> Submit Answers & Re-evaluate
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 4: REVIEW PROPOSED RECORD (Side-by-side or Edit)         */}
      {/* ============================================================== */}
      {wizardStep === 4 && (
        <div>
          {/* TOOLBAR CONTROLS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 2px', fontSize: '1.35rem' }}>
                Review Permanent Inventory Record
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Compare original legacy data with proposed curatorial record. Edit any fields prior to approval.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-green"
                onClick={handleAcceptAllProposed}
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Check size={16} /> Accept All Proposed
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowRawNotes(!showRawNotes)}
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FileText size={16} /> {showRawNotes ? 'Hide Raw Notes' : 'View Raw Notes'}
              </button>
            </div>
          </div>

          {/* COLLAPSIBLE RAW NOTES */}
          {showRawNotes && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.5rem', fontSize: '0.84rem' }}>
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Original Raw Notes & Description:</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#475569', maxHeight: '180px', overflowY: 'auto' }}>
                {originalData?.special_handling_notes || originalData?.description || '(No legacy notes recorded)'}
              </pre>
            </div>
          )}

          {/* UNCERTAINTY / CONFIDENCE STATUS BANNER */}
          <div style={{ background: fields.identification_confidence === 'LOW' ? '#fef3c7' : '#f0fdf4', border: `1px solid ${fields.identification_confidence === 'LOW' ? '#fcd34d' : '#bbf7d0'}`, borderRadius: '10px', padding: '0.85rem 1.15rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color={fields.identification_confidence === 'LOW' ? '#b45309' : '#15803d'} />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: fields.identification_confidence === 'LOW' ? '#92400e' : '#14532d' }}>
                  Identification Certainty: {fields.identification_confidence || 'MEDIUM'}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#475569', marginLeft: '8px' }}>
                  {fields.identification_confidence_reason || 'Curatorial assessment grounded in authentic physical evidence.'}
                </span>
              </div>
            </div>
            {fields.follow_up_worthwhile && (
              <span style={{ fontSize: '0.75rem', background: '#fff', padding: '2px 8px', borderRadius: '4px', color: '#92400e', border: '1px solid #fcd34d' }}>
                Follow-up noted for later
              </span>
            )}
          </div>

          {/* MAIN PROPOSAL EDIT SECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            {/* 1. TITLE & OBJECT TYPE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px', color: '#1e293b' }}>
                  Standardized Object Title *
                </label>
                <input
                  type="text"
                  value={fields.title}
                  onChange={e => handleFieldChange('title', e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px', color: '#1e293b' }}>
                  Object Type Classification
                </label>
                <input
                  type="text"
                  placeholder="e.g. Carved Sculpture, Navigational Instrument"
                  value={fields.object_type}
                  onChange={e => handleFieldChange('object_type', e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {/* 2. NEWLY COMPOSED CURATORIAL DESCRIPTION */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
                  Newly Composed Curatorial Description *
                </label>
                <span style={{ fontSize: '0.75rem', color: '#166534', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  Validated: No URLs or Prices
                </span>
              </div>
              <textarea
                rows={4}
                value={fields.description}
                onChange={e => handleFieldChange('description', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.92rem', lineHeight: 1.5, fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Newly composed from structured facts and uncertainty levels. Free of prices, URLs, and AI filler.
              </div>
            </div>

            {/* 3. STRUCTURED ATTRIBUTES GRID */}
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', marginBottom: '0.85rem' }}>
                Structured Attributes
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Maker / Manufacturer</label>
                  <input
                    type="text"
                    placeholder="Null if unknown"
                    value={fields.maker}
                    onChange={e => handleFieldChange('maker', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Model / Pattern</label>
                  <input
                    type="text"
                    placeholder="Optional model"
                    value={fields.model}
                    onChange={e => handleFieldChange('model', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Approximate Era / Date</label>
                  <input
                    type="text"
                    placeholder="e.g. Mid-20th century, c. 1965"
                    value={fields.era}
                    onChange={e => handleFieldChange('era', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Geographic / Cultural Origin</label>
                  <input
                    type="text"
                    placeholder="e.g. Bali, Indonesia; Great Lakes"
                    value={fields.origin}
                    onChange={e => handleFieldChange('origin', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Physical Materials</label>
                  <input
                    type="text"
                    placeholder="e.g. Teak wood, Brass, Silica glass"
                    value={fields.materials}
                    onChange={e => handleFieldChange('materials', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Dimensions / Measurements</label>
                  <input
                    type="text"
                    placeholder="e.g. 14 in H x 5 in W x 4 in D"
                    value={fields.dimensions}
                    onChange={e => handleFieldChange('dimensions', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Physical Condition</label>
                  <input
                    type="text"
                    placeholder="e.g. Good vintage condition"
                    value={fields.condition}
                    onChange={e => handleFieldChange('condition', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Identifying Marks / Hallmarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Handwritten label 'Bali 1968'"
                    value={fields.identifying_marks}
                    onChange={e => handleFieldChange('identifying_marks', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>
            </div>

            {/* 4. CONTEXT & JIM-SPECIFIC PROVENANCE */}
            <div style={{ background: '#fdfbf7', padding: '1.25rem', borderRadius: '10px', border: '1px solid #fed7aa' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#9a3412', textTransform: 'uppercase', marginBottom: '0.85rem' }}>
                Context & Jim-Specific Provenance (Evidence Discipline)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#7c2d12', marginBottom: '2px' }}>
                    General Acquisition Context
                  </label>
                  <input
                    type="text"
                    placeholder="Market or trade circumstances for objects of this type during their period..."
                    value={fields.acquisition_context}
                    onChange={e => handleFieldChange('acquisition_context', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fdba74', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#7c2d12', marginBottom: '2px' }}>
                      Jim Connection Type
                    </label>
                    <select
                      value={fields.jim_connection_type}
                      onChange={e => handleFieldChange('jim_connection_type', e.target.value)}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fdba74', fontSize: '0.88rem' }}
                    >
                      <option value="FACT">FACT (Documented receipt/logbook)</option>
                      <option value="REASONABLE_INFERENCE">REASONABLE INFERENCE (Voyage overlap)</option>
                      <option value="UNKNOWN">UNKNOWN (No specific proof)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#7c2d12', marginBottom: '2px' }}>
                      Jim Connection Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Evidence grounding Jim's connection..."
                      value={fields.jim_connection_notes}
                      onChange={e => handleFieldChange('jim_connection_notes', e.target.value)}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fdba74', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. LEGACY SIGNIFICANCE & FOLLOW-UP WORTHWHILE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Legacy & Collection Significance</label>
                <select
                  value={fields.legacy_significance}
                  onChange={e => handleFieldChange('legacy_significance', e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', marginBottom: '6px' }}
                >
                  <option value="none">None / Ordinary Estate Item</option>
                  <option value="possible">Possible Legacy Interest</option>
                  <option value="significant">Significant Legacy Interest (Museum candidate)</option>
                  <option value="unknown">Unknown / Needs Research</option>
                </select>
                <input
                  type="text"
                  placeholder="Rationale for significance..."
                  value={fields.legacy_significance_reason}
                  onChange={e => handleFieldChange('legacy_significance_reason', e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Follow-Up Worthwhile Note</label>
                <textarea
                  rows={2}
                  placeholder="What missing evidence would materially improve this record later..."
                  value={fields.follow_up_worthwhile}
                  onChange={e => handleFieldChange('follow_up_worthwhile', e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                  Allows approval now while noting follow-up items for future research.
                </div>
              </div>
            </div>

            {/* 6. STRUCTURED RESEARCH SOURCES MANAGER */}
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>
                    Structured Research Sources ({researchSources.length})
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>
                    Auction comps, eBay sales, and museum links preserved separately from description prose.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSource(!showAddSource)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Add Source
                </button>
              </div>

              {/* Add Source Form */}
              {showAddSource && (
                <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Title or description of reference"
                      value={newSource.title}
                      onChange={e => setNewSource(prev => ({ ...prev, title: e.target.value }))}
                      style={{ padding: '0.4rem 0.65rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                    <input
                      type="text"
                      placeholder="URL (https://...)"
                      value={newSource.url}
                      onChange={e => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                      style={{ padding: '0.4rem 0.65rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button type="button" className="btn-outline" onClick={() => setShowAddSource(false)} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>Cancel</button>
                    <button type="button" className="btn-green" onClick={handleAddSourceSubmit} style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>Save Source</button>
                  </div>
                </div>
              )}

              {/* Sources List */}
              {researchSources.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No research sources attached to this record.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {researchSources.map((s, sIdx) => (
                    <div key={s.id || sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LinkIcon size={14} color="#64748b" />
                        <div>
                          <strong>{s.title || s.websiteOrOrg || 'Reference'}</strong>
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', marginLeft: '6px' }}>
                              View Link <ExternalLink size={10} style={{ display: 'inline' }} />
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(sIdx)}
                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        title="Remove source"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* APPROVAL FOOTER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
            <button className="btn-outline" onClick={() => setWizardStep(questions.length > 0 ? 2 : 1)}>
              ← Back
            </button>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-green"
                disabled={saving}
                onClick={handleApprove}
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} />
                    Saving Permanent Record...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Approve & Save Permanent Record
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
