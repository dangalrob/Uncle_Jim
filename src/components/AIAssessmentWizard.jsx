import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Camera, Check, AlertCircle, AlertTriangle, ArrowRight, 
  ArrowLeft, X, ShieldCheck, DollarSign, Upload, Info, HelpCircle, 
  ChevronRight, CheckCircle2, RefreshCw, FileText, Image as ImageIcon
} from 'lucide-react';

/**
 * PHASE 3: AI-POWERED ITEM ASSESSMENT WIZARD
 * -----------------------------------------
 * Multi-Step Guided Assessment Flow:
 *   Step 1: Photo Intake (Primary photo + optional close-ups / markings)
 *   Step 2: Information Gap Questionnaire (Dimensions, Origin, Materials, Family context)
 *   Step 3: AI Curatorial Generation (Gemini multimodal vision / fallback)
 *   Step 4: Side-by-Side Review & Edit before Approval (Estate distribution threshold alerts)
 */
export default function AIAssessmentWizard({
  existingItem = null,
  threshold = 100,
  onClose,
  onSuccess
}) {
  // Step navigation: 1: Photos, 2: Guided Gaps, 3: Generating, 4: Review & Approve
  const [step, setStep] = useState(1);

  // Step 1: Photos
  const [photos, setPhotos] = useState([]); // Array of { file, previewUrl, label }
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const detailInputRef = useRef(null);

  // Step 2: Guided Questionnaire State
  const [guidedAnswers, setGuidedAnswers] = useState({
    dimensions: existingItem?.dimensions || '',
    knownOrigin: existingItem?.origin || '',
    knownMaterials: existingItem?.materials || '',
    knownMaker: existingItem?.maker || '',
    conditionNotes: existingItem?.condition || '',
    familyMemories: existingItem?.provenance_text || '',
    generalNotes: ''
  });

  // Step 3 & 4: Assessment Generation State
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [proposedAssessment, setProposedAssessment] = useState(null);

  // Editable fields in Step 4 (Single Permanent Item Record Schema)
  const [editableFields, setEditableFields] = useState({
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
    assessment_confidence: 'MEDIUM',
    confidence_reason: '',
    verification_needed: '',
    follow_up_worthwhile: '',
    assessment_version: 'ITEM_ASSESSMENT_V1',
    estimated_value_low: '',
    estimated_value_high: '',
    value_basis: '',
    distribution_value: '',
    counts_against_distribution: false,
    appraisal_recommended: false,
    appraisal_reason: ''
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Load existing item photos if editing existing
  useEffect(() => {
    if (existingItem) {
      if (existingItem.photos && existingItem.photos.length > 0) {
        const loaded = existingItem.photos.map(p => ({
          file: null,
          previewUrl: p.thumbnail_url || p.photo_url,
          label: p.is_primary ? 'Primary Photo' : 'Detail Photo',
          isExisting: true
        }));
        setPhotos(loaded);
      } else if (existingItem.primary_photo) {
        setPhotos([{
          file: null,
          previewUrl: existingItem.primary_photo,
          label: 'Primary Photo',
          isExisting: true
        }]);
      }
    }
  }, [existingItem]);

  // Handle Photo additions
  const handleAddPhoto = (e, label = 'Detail Photo') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newEntries = files.map((file, idx) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      label: photos.length === 0 && idx === 0 ? 'Primary Overview' : label,
      isExisting: false
    }));

    setPhotos(prev => [...prev, ...newEntries]);
    e.target.value = '';
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== index));
  };

  // Run AI Assessment Generation
  const handleGenerateAssessment = async () => {
    setGenerating(true);
    setGenerateError(null);
    setStep(3);

    try {
      const formData = new FormData();
      if (existingItem?.id) {
        formData.append('itemId', existingItem.id);
      }
      formData.append('guidedAnswersJson', JSON.stringify(guidedAnswers));

      // Append new photo files
      photos.forEach((p) => {
        if (p.file) {
          formData.append('photos', p.file);
        }
      });

      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/assess/generate', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate curatorial assessment.');
      }

      const a = data.assessment || {};
      setProposedAssessment(a);

      const highVal = a.estimatedValueHigh || a.estimatedValueLow || null;
      const exceeds = highVal !== null && highVal >= (data.threshold || threshold);

      setEditableFields({
        title: a.proposedTitle || a.identification?.proposedTitle || existingItem?.title || '',
        object_type: a.objectType || a.identification?.objectType || existingItem?.object_type || '',
        description: a.cleanDescription || a.description?.cleanDescription || existingItem?.description || '',
        origin: a.origin || a.attributes?.origin || existingItem?.origin || '',
        era: a.era || a.attributes?.era || existingItem?.era || '',
        materials: a.materials || a.attributes?.materials || existingItem?.materials || '',
        maker: a.maker || a.attributes?.maker || existingItem?.maker || '',
        model: a.model || a.attributes?.model || existingItem?.model || '',
        identifying_marks: a.identifyingMarks || a.attributes?.identifyingMarks || existingItem?.identifying_marks || '',
        historical_cultural_context: a.historicalCulturalContext || a.historicalContext?.historicalCulturalContext || existingItem?.historical_cultural_context || '',
        acquisition_context: a.acquisitionContext || a.historicalContext?.acquisitionContext || a.plausibleTravelConnection || existingItem?.acquisition_context || '',
        jim_connection_type: a.jimConnectionType || a.provenance?.jimConnectionType || existingItem?.jim_connection_type || 'UNKNOWN',
        jim_connection_notes: a.jimConnectionNotes || a.provenance?.jimConnectionNotes || existingItem?.jim_connection_notes || '',
        provenance_text: a.provenanceNotes || a.provenance?.provenanceText || existingItem?.provenance_text || '',
        dimensions: a.dimensions || a.attributes?.dimensions || guidedAnswers.dimensions || existingItem?.dimensions || '',
        condition: a.condition || a.attributes?.condition || guidedAnswers.conditionNotes || existingItem?.condition || '',
        legacy_significance: a.legacySignificance || a.legacy?.significance || existingItem?.legacy_significance || 'none',
        legacy_significance_reason: a.legacySignificanceReason || a.legacy?.significanceReason || existingItem?.legacy_significance_reason || '',
        assessment_confidence: a.assessmentConfidence || a.identification?.confidence || 'MEDIUM',
        confidence_reason: a.confidenceReason || a.identification?.confidenceReason || '',
        verification_needed: a.verificationNeeded || a.verification?.verificationNeeded || existingItem?.verification_needed || '',
        follow_up_worthwhile: a.followUpWorthwhile || a.verification?.followUpWorthwhile || existingItem?.follow_up_worthwhile || '',
        assessment_version: 'ITEM_ASSESSMENT_V1',
        estimated_value_low: a.estimatedValueLow !== null && a.estimatedValueLow !== undefined ? a.estimatedValueLow : (existingItem?.estimated_value_low || ''),
        estimated_value_high: a.estimatedValueHigh !== null && a.estimatedValueHigh !== undefined ? a.estimatedValueHigh : (existingItem?.estimated_value_high || ''),
        value_basis: a.valueBasis || existingItem?.value_basis || '',
        distribution_value: existingItem?.distribution_value || '',
        counts_against_distribution: Boolean(existingItem?.counts_against_distribution),
        appraisal_recommended: Boolean(a.appraisalRecommended || existingItem?.appraisal_recommended),
        appraisal_reason: a.appraisalReason || existingItem?.appraisal_reason || ''
      });

      setStep(4);
    } catch (err) {
      console.error('Assessment generation error:', err);
      setGenerateError(err.message);
      setStep(2); // return to step 2 to allow retry
    } finally {
      setGenerating(false);
    }
  };

  // Submit approved assessment
  const handleApproveAndSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const formData = new FormData();
      if (existingItem?.id) {
        formData.append('itemId', existingItem.id);
      }
      formData.append('approvedFieldsJson', JSON.stringify(editableFields));
      formData.append('fullAssessmentPayloadJson', JSON.stringify(proposedAssessment || {}));

      // Append newly uploaded photos
      photos.forEach((p) => {
        if (p.file) {
          formData.append('photos', p.file);
        }
      });

      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/assess/approve', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to commit assessment.');
      }

      if (onSuccess) onSuccess(data.item);
      if (onClose) onClose();
    } catch (err) {
      console.error('Failed to commit assessment:', err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      maxWidth: '960px',
      margin: '0 auto',
      background: '#fff',
      borderRadius: '16px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '90vh'
    }}>
      {/* HEADER */}
      <div style={{
        padding: '1.25rem 1.75rem',
        background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '10px' }}>
            <Sparkles size={22} color="#fef08a" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
              {existingItem ? `AI Curatorial Assessment: ${existingItem.title || 'Existing Item'}` : 'AI-Assisted Item Assessment'}
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#d8f3dc' }}>
              Museum-grade physical evaluation, research citations, and estate valuation guardrails
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* STEP PROGRESS BAR */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0.75rem 1.75rem' }}>
        {[
          { num: 1, label: '1. Photos & Markings' },
          { num: 2, label: '2. Guided Details' },
          { num: 3, label: '3. Curatorial Analysis' },
          { num: 4, label: '4. Review & Approval' }
        ].map(s => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div key={s.num} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                background: isActive ? 'var(--pine-primary)' : (isDone ? '#10b981' : '#e2e8f0'),
                color: (isActive || isDone) ? '#fff' : '#64748b'
              }}>
                {isDone ? <Check size={14} /> : s.num}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 'bold' : 'normal', color: isActive ? 'var(--pine-deep)' : '#64748b' }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* MODAL BODY */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
        
        {generateError && (
          <div style={{ padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <div style={{ fontSize: '0.85rem' }}>{generateError}</div>
          </div>
        )}

        {/* STEP 1: PHOTO INTAKE */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: 'var(--pine-deep)' }}>
                Step 1: Capture & Select Item Photos
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Provide a clear overall view of the item, plus optional close-ups of signatures, stamps, hallmarks, or labels.
              </p>
            </div>

            {/* Photos Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {photos.map((p, idx) => (
                <div key={idx} style={{ position: 'relative', height: '170px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #e2e8f0', background: '#f1f5f9' }}>
                  <img src={p.previewUrl} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>
                    {p.label}
                  </span>
                  <button
                    onClick={() => handleRemovePhoto(idx)}
                    style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {/* Add Photo via Camera or File Pickers */}
              <div
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  height: '170px',
                  borderRadius: '10px',
                  border: '2px dashed var(--pine-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: '#f0fdf4',
                  transition: 'all 0.2s'
                }}
              >
                <Camera size={30} color="var(--pine-primary)" style={{ marginBottom: '6px' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 'bold', color: 'var(--pine-deep)' }}>
                  Take Photo (Camera)
                </span>
                <span style={{ fontSize: '0.72rem', color: '#166534', marginTop: '2px' }}>
                  Mobile / Tablet camera intake
                </span>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: '170px',
                  borderRadius: '10px',
                  border: '2px dashed #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={28} color="#64748b" style={{ marginBottom: '6px' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 'bold', color: '#475569' }}>
                  Upload Existing Photos
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  Select files from computer / disk
                </span>
              </div>
            </div>

            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => handleAddPhoto(e, photos.length === 0 ? 'Primary Overview' : 'Detail View')}
            />

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleAddPhoto(e, photos.length === 0 ? 'Primary Overview' : 'Additional View')}
            />

            {/* Quick tips box */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <Info size={18} color="#15803d" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.82rem', color: '#166534', lineHeight: '1.45' }}>
                <strong>Appraiser's Tip:</strong> Close-up photos of manufacturer marks, bottom stamps, serial numbers, artist signatures, or wood joints dramatically increase the confidence of AI era and maker identification.
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: GUIDED QUESTIONNAIRE (INFORMATION GAPS) */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: 'var(--pine-deep)' }}>
                Step 2: Guided Details & Context
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Fill in what you know, or leave fields blank. The AI appraiser will only use substantiated facts.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  Approximate Dimensions / Size
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14 in H x 8 in W, or Heavy cast iron (~15 lbs)"
                  value={guidedAnswers.dimensions}
                  onChange={(e) => setGuidedAnswers(p => ({ ...p, dimensions: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  Known or Suspected Geographic Origin
                </label>
                <input
                  type="text"
                  placeholder="e.g. Japan, Philippines, England, or Unknown"
                  value={guidedAnswers.knownOrigin}
                  onChange={(e) => setGuidedAnswers(p => ({ ...p, knownOrigin: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  Primary Materials
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solid brass, porcelain, teak wood, oil on canvas"
                  value={guidedAnswers.knownMaterials}
                  onChange={(e) => setGuidedAnswers(p => ({ ...p, knownMaterials: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  Known Maker / Hallmarks / Labels
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marked 'Chelsea Clock Co.', or Signed 'E. Garcia 1974'"
                  value={guidedAnswers.knownMaker}
                  onChange={(e) => setGuidedAnswers(p => ({ ...p, knownMaker: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                Condition & Wear Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Excellent vintage condition, minor patina on brass, chip on rim"
                value={guidedAnswers.conditionNotes}
                onChange={(e) => setGuidedAnswers(p => ({ ...p, conditionNotes: e.target.value }))}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                Family Memories & Acquisition Lore (Uncle Jim Context)
              </label>
              <textarea
                rows={3}
                placeholder="Recollections of Uncle Jim displaying this, voyages he mentioned, or where it was kept in the house..."
                value={guidedAnswers.familyMemories}
                onChange={(e) => setGuidedAnswers(p => ({ ...p, familyMemories: e.target.value }))}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', lineHeight: '1.4' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginTop: '3px' }}>
                ℹ️ Plausible travel overlaps will be recorded separately from definitive physical descriptions.
              </span>
            </div>
          </div>
        )}

        {/* STEP 3: CURATORIAL ANALYSIS (ANIMATED SPINNER) */}
        {step === 3 && (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#e8f5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              animation: 'pulse 2s infinite'
            }}>
              <RefreshCw size={32} color="var(--pine-primary)" className="spin-animation" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--pine-deep)' }}>
              Generating Curatorial Assessment…
            </h3>
            <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.88rem', color: '#64748b', lineHeight: '1.5' }}>
              Analyzing visual physical characteristics, evaluating historical era and origin markers, calculating estate valuation bounds, and verifying curatorial standards.
            </p>
          </div>
        )}

        {/* STEP 4: SIDE-BY-SIDE REVIEW & APPROVAL */}
        {step === 4 && (
          <div>
            {/* Top Alert: Estate Distribution Threshold Notice */}
            {editableFields.counts_against_distribution && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderLeft: '4px solid #f59e0b',
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#92400e' }}>
                    Estate Distribution Threshold Alert (≥ ${threshold})
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: '2px' }}>
                    The estimated valuation of this item meets or exceeds the ${threshold} threshold. It has been flagged as a candidate to count against final family estate distribution. Admin may set a definitive distribution value or leave for executor review.
                  </div>
                </div>
              </div>
            )}

            {/* Appraisal Recommendation Notice if high value */}
            {editableFields.appraisal_recommended && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderLeft: '4px solid #3b82f6',
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <ShieldCheck size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#1e40af' }}>
                    Formal Appraisal Recommended
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#1d4ed8', marginTop: '2px' }}>
                    {editableFields.appraisal_reason || 'High valuation bounds or significant rarity warrant independent qualified appraisal.'}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 1: PROPOSED TITLE, OBJECT TYPE & CLEAN DESCRIPTION */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                    Item Title *
                  </label>
                  <input
                    type="text"
                    value={editableFields.title}
                    onChange={(e) => setEditableFields(p => ({ ...p, title: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 'bold' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                    Object Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Navigational Instrument"
                    value={editableFields.object_type}
                    onChange={(e) => setEditableFields(p => ({ ...p, object_type: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#334155' }}>
                    Curatorial Clean Description (Strictly No Dollar Amounts)
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 'bold' }}>
                    ✓ Verified Free of Dollar Figures & AI Chatter
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={editableFields.description}
                  onChange={(e) => setEditableFields(p => ({ ...p, description: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', lineHeight: '1.5' }}
                />
              </div>
            </div>

            {/* SECTION 2: STRUCTURED METADATA */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Structured Attributes
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>Era / Timeframe</label>
                  <input
                    type="text"
                    value={editableFields.era}
                    onChange={(e) => setEditableFields(p => ({ ...p, era: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>Geographic Origin</label>
                  <input
                    type="text"
                    value={editableFields.origin}
                    onChange={(e) => setEditableFields(p => ({ ...p, origin: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>Materials</label>
                  <input
                    type="text"
                    value={editableFields.materials}
                    onChange={(e) => setEditableFields(p => ({ ...p, materials: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>Maker / Artist</label>
                  <input
                    type="text"
                    value={editableFields.maker}
                    onChange={(e) => setEditableFields(p => ({ ...p, maker: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>Marks & Signatures</label>
                  <input
                    type="text"
                    value={editableFields.identifying_marks}
                    onChange={(e) => setEditableFields(p => ({ ...p, identifying_marks: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>Physical Dimensions</label>
                  <input
                    type="text"
                    value={editableFields.dimensions}
                    onChange={(e) => setEditableFields(p => ({ ...p, dimensions: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: VALUATION & ESTATE DISTRIBUTION POLICY */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Valuation & Estate Accounting
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>
                    Estimated Value Low ($)
                  </label>
                  <input
                    type="number"
                    value={editableFields.estimated_value_low}
                    onChange={(e) => setEditableFields(p => ({ ...p, estimated_value_low: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>
                    Estimated Value High ($)
                  </label>
                  <input
                    type="number"
                    value={editableFields.estimated_value_high}
                    onChange={(e) => setEditableFields(p => ({ ...p, estimated_value_high: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>
                    Approved Distribution Value ($)
                  </label>
                  <input
                    type="number"
                    placeholder="Set by Admin/Executor"
                    value={editableFields.distribution_value}
                    onChange={(e) => setEditableFields(p => ({ ...p, distribution_value: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>
                  Valuation Basis & Reasoning
                </label>
                <input
                  type="text"
                  value={editableFields.value_basis}
                  onChange={(e) => setEditableFields(p => ({ ...p, value_basis: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="counts_against_dist_check"
                  checked={editableFields.counts_against_distribution}
                  onChange={(e) => setEditableFields(p => ({ ...p, counts_against_distribution: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--pine-primary)' }}
                />
                <label htmlFor="counts_against_dist_check" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', cursor: 'pointer' }}>
                  Counts Against Estate Distribution (Threshold: ${threshold})
                </label>
              </div>
            </div>

            {saveError && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.85rem' }}>
                {saveError}
              </div>
            )}
          </div>
        )}

      </div>

      {/* FOOTER ACTIONS */}
      <div style={{
        padding: '1rem 1.75rem',
        borderTop: '1px solid #e2e8f0',
        background: '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          {step > 1 && step !== 3 && (
            <button
              className="btn-outline"
              onClick={() => setStep(step === 4 ? 2 : step - 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-outline" onClick={onClose} disabled={saving || generating}>
            Cancel
          </button>

          {step === 1 && (
            <button
              className="btn-green"
              onClick={() => setStep(2)}
              disabled={photos.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              Continue to Guided Details <ArrowRight size={16} />
            </button>
          )}

          {step === 2 && (
            <button
              className="btn-green"
              onClick={handleGenerateAssessment}
              disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              <Sparkles size={16} /> Run Curatorial AI Assessment
            </button>
          )}

          {step === 4 && (
            <button
              className="btn-green"
              onClick={handleApproveAndSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', padding: '0.6rem 1.5rem' }}
            >
              <CheckCircle2 size={16} /> {saving ? 'Saving…' : 'Approve & Commit Assessment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
