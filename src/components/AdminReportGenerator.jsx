import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, ArrowRight, Download, Check, RefreshCw, FileText, 
  Table, Filter, CheckSquare, Square, MoveUp, MoveDown, AlertCircle, Loader2
} from 'lucide-react';

export default function AdminReportGenerator({ currentUser, onClose }) {
  const [step, setStep] = useState(1);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [populations, setPopulations] = useState([]);
  const [allFields, setAllFields] = useState([]);
  
  // Step 1: Population Selection
  const [selectedPopulation, setSelectedPopulation] = useState('all');
  const [customFilter, setCustomFilter] = useState({ destination: '', institutionalCandidate: '' });

  // Step 2: Field Selection
  const [selectedFieldKeys, setSelectedFieldKeys] = useState([]);

  // Step 3: Field Ordering
  const [orderedFieldKeys, setOrderedFieldKeys] = useState([]);

  // Step 4: Preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState({ totalCount: 0, sampleRows: [], fields: [] });

  // Step 5: Exporting
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');
  const [exportError, setExportError] = useState('');

  // Load config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/admin/reports/config', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load report options');
      const data = await res.json();
      setPopulations(data.populations || []);
      setAllFields(data.fields || []);

      // Default selected fields
      const defaults = (data.fields || [])
        .filter(f => f.defaultSelected)
        .map(f => f.id);
      setSelectedFieldKeys(defaults);
      setOrderedFieldKeys(defaults);
    } catch (err) {
      console.error(err);
      setExportError(err.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Sync ordered keys when field selection changes
  const toggleField = (id) => {
    if (selectedFieldKeys.includes(id)) {
      const updated = selectedFieldKeys.filter(k => k !== id);
      setSelectedFieldKeys(updated);
      setOrderedFieldKeys(prev => prev.filter(k => k !== id));
    } else {
      const updated = [...selectedFieldKeys, id];
      setSelectedFieldKeys(updated);
      setOrderedFieldKeys(prev => [...prev, id]);
    }
  };

  const selectAllFields = () => {
    const all = allFields.map(f => f.id);
    setSelectedFieldKeys(all);
    setOrderedFieldKeys(all);
  };

  const clearAllFields = () => {
    setSelectedFieldKeys([]);
    setOrderedFieldKeys([]);
  };

  // Reordering helpers
  const moveField = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedFieldKeys.length) return;
    const newOrder = [...orderedFieldKeys];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setOrderedFieldKeys(newOrder);
  };

  // Fetch preview when reaching Step 4
  const loadPreview = async () => {
    setPreviewLoading(true);
    setExportError('');
    try {
      const res = await fetch('/api/admin/reports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          population: selectedPopulation,
          customFilter,
          fields: orderedFieldKeys
        })
      });
      if (!res.ok) throw new Error('Failed to load preview');
      const data = await res.json();
      setPreviewData(data);
    } catch (err) {
      console.error(err);
      setExportError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Go to next step handler
  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (selectedFieldKeys.length === 0) {
        setExportError('Please select at least one field to export.');
        return;
      }
      setExportError('');
      setStep(3);
    } else if (step === 3) {
      setStep(4);
      loadPreview();
    } else if (step === 4) {
      setStep(5);
    }
  };

  // Export CSV or Excel
  const handleExport = async (format) => {
    setIsExporting(true);
    setExportError('');
    setExportSuccess('');

    try {
      const res = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          population: selectedPopulation,
          customFilter,
          fields: orderedFieldKeys,
          format
        })
      });

      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      // Extract filename from header or build fallback
      let filename = `uncle-jim-report-${selectedPopulation}-${new Date().toISOString().slice(0, 10)}.${format}`;
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setExportSuccess(`Successfully generated and downloaded "${filename}"!`);
    } catch (err) {
      console.error(err);
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const currentPopObj = populations.find(p => p.id === selectedPopulation);
  const currentCount = currentPopObj ? currentPopObj.count : previewData.totalCount;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button 
            className="btn-outline" 
            style={{ marginBottom: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            onClick={onClose}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--pine-deep)', margin: '0 0 4px 0' }}>
            📊 Custom Report Generator
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Export tailored inventory datasets with customizable record populations, field selections, and column ordering.
          </p>
        </div>
      </div>

      {/* STEP PROGRESS INDICATOR */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: '#fff', 
        padding: '0.85rem 1.25rem', 
        borderRadius: '8px', 
        border: '1px solid #e5e7eb',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        gap: '0.5rem'
      }}>
        {[
          { num: 1, label: '1. Records' },
          { num: 2, label: '2. Fields' },
          { num: 3, label: '3. Order' },
          { num: 4, label: '4. Preview' },
          { num: 5, label: '5. Export' }
        ].map((s) => (
          <div 
            key={s.num} 
            onClick={() => s.num < step && setStep(s.num)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem',
              fontWeight: step === s.num ? 700 : 500,
              color: step === s.num ? 'var(--pine-primary)' : (step > s.num ? '#10b981' : '#9ca3af'),
              cursor: s.num < step ? 'pointer' : 'default',
              fontSize: '0.88rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '50%', 
              background: step === s.num ? 'var(--pine-primary)' : (step > s.num ? '#10b981' : '#e5e7eb'),
              color: step >= s.num ? '#fff' : '#6b7280',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              {step > s.num ? <Check size={14} /> : s.num}
            </span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ERROR / SUCCESS ALERTS */}
      {exportError && (
        <div style={{ padding: '0.85rem', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', color: '#991b1b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{exportError}</span>
        </div>
      )}
      {exportSuccess && (
        <div style={{ padding: '0.85rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', color: '#166534', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Check size={18} />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* STEP 1: SELECT RECORDS */}
      {step === 1 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--pine-deep)' }}>Step 1: Select Inventory Population</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Choose the group of inventory items you wish to export.
              </p>
            </div>
            {currentPopObj && (
              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.9rem', padding: '0.35rem 0.75rem', fontWeight: 600 }}>
                {currentPopObj.count} matching records
              </span>
            )}
          </div>

          {loadingConfig ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
              <div>Loading inventory populations...</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {populations.map((pop) => (
                <div 
                  key={pop.id}
                  onClick={() => setSelectedPopulation(pop.id)}
                  style={{
                    border: selectedPopulation === pop.id ? '2px solid var(--pine-primary)' : '1px solid #e5e7eb',
                    background: selectedPopulation === pop.id ? '#f0fdf4' : '#fff',
                    borderRadius: '8px',
                    padding: '1.1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem', color: selectedPopulation === pop.id ? 'var(--pine-deep)' : '#111827' }}>
                        {pop.label}
                      </span>
                      <span style={{ 
                        background: selectedPopulation === pop.id ? 'var(--pine-primary)' : '#e5e7eb',
                        color: selectedPopulation === pop.id ? '#fff' : '#374151',
                        borderRadius: '12px',
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.78rem',
                        fontWeight: 700
                      }}>
                        {pop.count} items
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.4 }}>
                      {pop.description}
                    </p>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', fontWeight: 600, color: selectedPopulation === pop.id ? 'var(--pine-primary)' : '#9ca3af' }}>
                    {selectedPopulation === pop.id ? '✓ Selected' : 'Click to select'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <button className="btn-green" onClick={handleNextStep} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Continue to Select Fields <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SELECT FIELDS */}
      {step === 2 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--pine-deep)' }}>Step 2: Select Fields to Export</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Choose which inventory columns should be included in your report. Note that Normalized Description and Original / Raw Legacy Description are separate distinct fields.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pine-deep)', marginRight: '0.5rem' }}>
                {selectedFieldKeys.length} of {allFields.length} selected
              </span>
              <button className="btn-outline" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }} onClick={selectAllFields}>
                Select All
              </button>
              <button className="btn-outline" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }} onClick={clearAllFields}>
                Clear All
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {allFields.map((f) => {
              const isSelected = selectedFieldKeys.includes(f.id);
              const isDescField = f.id === 'normalized_description' || f.id === 'original_description';
              const isValuationField = f.id === 'normalized_valuation' || f.id === 'original_value';

              return (
                <div 
                  key={f.id}
                  onClick={() => toggleField(f.id)}
                  style={{
                    border: isSelected ? '1.5px solid var(--pine-primary)' : '1px solid #e5e7eb',
                    background: isSelected ? '#f0fdf4' : '#fff',
                    borderRadius: '6px',
                    padding: '0.75rem 0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.1s ease'
                  }}
                >
                  <div style={{ color: isSelected ? 'var(--pine-primary)' : '#9ca3af' }}>
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? 'var(--pine-deep)' : '#374151' }}>
                      {f.label}
                    </div>
                    {isDescField && (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '1px 6px', 
                        borderRadius: '4px', 
                        background: f.id === 'normalized_description' ? '#dcfce7' : '#fef3c7',
                        color: f.id === 'normalized_description' ? '#166534' : '#92400e',
                        fontWeight: 600
                      }}>
                        {f.id === 'normalized_description' ? 'Curated / Clean' : 'Raw Legacy Baseline'}
                      </span>
                    )}
                    {isValuationField && (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '1px 6px', 
                        borderRadius: '4px', 
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontWeight: 600
                      }}>
                        {f.id === 'normalized_valuation' ? 'Distribution / Assessment' : 'Original Text Value'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <button className="btn-outline" onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="btn-green" onClick={handleNextStep} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Continue to Field Order <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: FIELD ORDER */}
      {step === 3 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--pine-deep)' }}>Step 3: Arrange Column Order</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Reorder the columns to appear in your preferred sequence in the exported report. Use the arrows to shift columns up or down.
            </p>
          </div>

          <div style={{ maxWidth: '650px', margin: '0 auto 1.5rem auto' }}>
            {orderedFieldKeys.map((key, index) => {
              const fieldObj = allFields.find(f => f.id === key);
              if (!fieldObj) return null;

              return (
                <div 
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1rem',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '4px', 
                      background: '#f3f4f6', 
                      color: '#4b5563',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                      {fieldObj.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn-outline"
                      style={{ padding: '0.25rem 0.5rem', opacity: index === 0 ? 0.3 : 1 }}
                      disabled={index === 0}
                      onClick={() => moveField(index, -1)}
                      title="Move column earlier"
                    >
                      <MoveUp size={15} />
                    </button>
                    <button
                      className="btn-outline"
                      style={{ padding: '0.25rem 0.5rem', opacity: index === orderedFieldKeys.length - 1 ? 0.3 : 1 }}
                      disabled={index === orderedFieldKeys.length - 1}
                      onClick={() => moveField(index, 1)}
                      title="Move column later"
                    >
                      <MoveDown size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <button className="btn-outline" onClick={() => setStep(2)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={16} /> Back to Fields
            </button>
            <button className="btn-green" onClick={handleNextStep} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Preview Report <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW */}
      {step === 4 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--pine-deep)' }}>Step 4: Report Data Preview</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Displaying a 5-row sample of the {previewData.totalCount} total matching records in your chosen column order.
              </p>
            </div>
            <button className="btn-outline" onClick={loadPreview} disabled={previewLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
              <RefreshCw size={14} className={previewLoading ? 'spin' : ''} /> Refresh Preview
            </button>
          </div>

          {previewLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
              <div>Generating preview data...</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                    <th style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>#</th>
                    {orderedFieldKeys.map((key) => {
                      const f = allFields.find(item => item.id === key);
                      return (
                        <th key={key} style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {f ? f.label : key}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewData.sampleRows && previewData.sampleRows.length > 0 ? (
                    previewData.sampleRows.map((row, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#9ca3af', fontWeight: 600 }}>{idx + 1}</td>
                        {orderedFieldKeys.map((key) => {
                          const val = row[key];
                          const str = val === null || val === undefined ? '' : String(val);
                          return (
                            <td 
                              key={key} 
                              style={{ 
                                padding: '0.65rem 0.85rem', 
                                maxWidth: '280px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: '#374151'
                              }}
                              title={str}
                            >
                              {str || <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={orderedFieldKeys.length + 1} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                        No records match the selected population filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <button className="btn-outline" onClick={() => setStep(3)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={16} /> Back to Order
            </button>
            <button className="btn-green" onClick={handleNextStep} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Proceed to Export <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: EXPORT */}
      {step === 5 && (
        <div className="card" style={{ padding: '1.75rem', maxWidth: '750px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              background: '#dcfce7', 
              color: '#166534', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '0.75rem'
            }}>
              <Download size={28} />
            </div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.35rem', color: 'var(--pine-deep)' }}>
              Ready to Export Report
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Your customized dataset includes <strong>{previewData.totalCount} records</strong> and <strong>{orderedFieldKeys.length} columns</strong>.
            </p>
          </div>

          {/* Export filename preview */}
          <div style={{ 
            background: '#f9fafb', 
            border: '1px solid #e5e7eb', 
            borderRadius: '6px', 
            padding: '1rem', 
            marginBottom: '1.75rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Export File Name Preview:</div>
            <div style={{ fontFamily: 'monospace', color: '#1e3a8a', background: '#fff', padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '4px' }}>
              uncle-jim-{selectedPopulation.replace(/_/g, '-')}-inventory-{new Date().toISOString().slice(0, 10)}.[csv | xlsx]
            </div>
          </div>

          {/* Download Action Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
            {/* CSV Download */}
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="btn-outline"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                border: '2px solid #e5e7eb',
                background: '#fff',
                cursor: isExporting ? 'not-allowed' : 'pointer'
              }}
            >
              <FileText size={32} color="#0284c7" />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Download CSV</span>
              <span style={{ fontSize: '0.78rem', color: '#6b7280', textAlign: 'center' }}>
                Standard comma-separated text file compatible with all database tools
              </span>
            </button>

            {/* Excel Download */}
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting}
              className="btn-outline"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                border: '2px solid #e5e7eb',
                background: '#fff',
                cursor: isExporting ? 'not-allowed' : 'pointer'
              }}
            >
              <Table size={32} color="#16a34a" />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Download Excel (.xlsx)</span>
              <span style={{ fontSize: '0.78rem', color: '#6b7280', textAlign: 'center' }}>
                Formatted Microsoft Excel workbook with styled headers and auto-wrapping
              </span>
            </button>
          </div>

          {isExporting && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--pine-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Loader2 size={18} className="spin" /> Generating export file...
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <button className="btn-outline" onClick={() => setStep(4)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={16} /> Back to Preview
            </button>
            <button className="btn-outline" onClick={onClose}>
              Done / Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
