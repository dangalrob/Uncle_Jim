import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Download, 
  FileText,
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw
} from 'lucide-react';
import CachedThumbnail from './CachedThumbnail';

export default function MaritimeMuseumReportView({ currentUser, onClose }) {
  const [loadingItems, setLoadingItems] = useState(true);
  const [maritimeItems, setMaritimeItems] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [isReordering, setIsReordering] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const draggedItemRef = useRef(null);

  useEffect(() => {
    fetchMaritimeData();
  }, []);

  // Prevent accidental navigation when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchMaritimeData = async () => {
    setLoadingItems(true);
    setError('');
    try {
      const res = await fetch('/api/admin/reports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          population: 'maritime',
          limit: 0,
          fields: ['id', 'item_number', 'title', 'normalized_description', 'museum_photo_url', 'destination', 'institution']
        })
      });
      if (!res.ok) throw new Error('Failed to load maritime inventory');
      const data = await res.json();
      const rows = data.sampleRows || [];
      setMaritimeItems(rows);
      setSavedItems(rows);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved artifact ordering changes. Discard changes and return to Dashboard?'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  const handleEnterReorder = () => {
    setIsReordering(true);
    setSavedItems([...maritimeItems]);
    setHasUnsavedChanges(false);
    setError('');
    setSuccessMessage('');
  };

  const handleCancelReorder = () => {
    setMaritimeItems([...savedItems]);
    setHasUnsavedChanges(false);
    setIsReordering(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedItemRef.current = null;
    setError('');
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    setError('');
    setSuccessMessage('');

    try {
      const itemIds = maritimeItems.map(item => item.id).filter(Boolean);
      if (itemIds.length === 0) {
        throw new Error('No valid artifact IDs to order.');
      }

      const res = await fetch('/api/admin/reports/maritime-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemIds })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save artifact order.');
      }

      setSavedItems([...maritimeItems]);
      setHasUnsavedChanges(false);
      setIsReordering(false);
      setSuccessMessage('Artifact sequence saved successfully! Catalog view and PDF report now follow this order.');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save artifact sequence.');
      // Do not exit reorder mode so the user does not lose their arranged state
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleMoveItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= maritimeItems.length) return;

    const updated = [...maritimeItems];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);

    setMaritimeItems(updated);
    setHasUnsavedChanges(true);
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    if (!isReordering) return;
    draggedItemRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e, index) => {
    if (!isReordering) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    if (!isReordering) return;
    e.preventDefault();
    const sourceIndex = draggedItemRef.current !== null ? draggedItemRef.current : draggedIndex;

    if (sourceIndex === null || sourceIndex === undefined || sourceIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      draggedItemRef.current = null;
      return;
    }

    const updated = [...maritimeItems];
    const [movedItem] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setMaritimeItems(updated);
    setHasUnsavedChanges(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedItemRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedItemRef.current = null;
  };

  const handleDownloadDocx = async () => {
    setIsGenerating(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/admin/reports/maritime-docx', {
        credentials: 'include'
      });

      if (!res.ok) throw new Error(`Word document generation failed (${res.status})`);

      const dateSlug = new Date().toISOString().slice(0, 10);
      let filename = `uncle-jim-maritime-museum-catalog-${dateSlug}.docx`;
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

      setSuccessMessage(`Maritime Museum Catalog "${filename}" generated and downloaded successfully as a Microsoft Word document (.docx)!`);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* HEADER */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button 
          className="btn-outline" 
          style={{ marginBottom: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
          onClick={handleBackToDashboard}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--pine-deep)', margin: '0 0 4px 0' }}>
              ⚓ Maritime Museum Curatorial Catalog
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Generate a formal museum-ready publication catalog of maritime artifacts in Microsoft Word format (.docx) for curator presentation, editing, and accession review.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {isAdmin && !isReordering && (
              <button
                className="btn-outline"
                onClick={handleEnterReorder}
                disabled={loadingItems || maritimeItems.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.75rem 1.15rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  background: '#fff',
                  border: '1px solid #cbd5e1'
                }}
              >
                <GripVertical size={18} color="var(--pine-primary)" />
                Reorder Artifacts
              </button>
            )}
            <button 
              className="btn-green"
              onClick={handleDownloadDocx}
              disabled={isGenerating || isReordering}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.6rem',
                padding: '0.75rem 1.4rem',
                fontSize: '1rem',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
              }}
            >
              {isGenerating ? <Loader2 size={20} className="spin" /> : <FileText size={20} />}
              {isGenerating ? 'Generating Word Document...' : 'GENERATE MARITIME MUSEUM WORD DOCUMENT (.DOCX)'}
            </button>
          </div>
        </div>
      </div>

      {/* ERROR / SUCCESS ALERTS */}
      {error && (
        <div style={{ padding: '0.85rem', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', color: '#991b1b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '0.85rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', color: '#166534', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* REORDER MODE STICKY ACTION BAR */}
      {isReordering && (
        <div 
          className="card" 
          style={{ 
            padding: '1rem 1.25rem', 
            marginBottom: '1.5rem', 
            background: '#f0f9ff', 
            border: '2px solid #0284c7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '1rem' }}>
                ⠿ Reorder Mode Active
              </span>
              {hasUnsavedChanges ? (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', fontWeight: 600 }}>
                  Unsaved Changes
                </span>
              ) : (
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: 600 }}>
                  Order Synced
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
              Drag artifacts vertically with the handle (⠿) or use the Up/Down buttons to rearrange sequence.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <button
              className="btn-outline"
              onClick={handleCancelReorder}
              disabled={isSavingOrder}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1rem',
                fontSize: '0.9rem',
                background: '#fff'
              }}
            >
              <RotateCcw size={16} /> Cancel
            </button>
            <button
              className="btn-green"
              onClick={handleSaveOrder}
              disabled={isSavingOrder || !hasUnsavedChanges}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 700
              }}
            >
              {isSavingOrder ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {isSavingOrder ? 'Saving Order...' : 'Save Order'}
            </button>
          </div>
        </div>
      )}

      {/* CURATORIAL STANDARDS CARD */}
      {!isReordering && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', border: '1px solid #bbf7d0' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} color="#16a34a" /> Publication & Museum Specifications
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.85rem', color: '#374151' }}>
            <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600, color: 'var(--pine-deep)', marginBottom: '0.25rem' }}>📸 Primary Museum Photos</div>
              <div>Formatted ~1.5 inches wide, preserving authentic aspect ratios without stretching or distortion.</div>
            </div>
            <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600, color: 'var(--pine-deep)', marginBottom: '0.25rem' }}>🏛️ Curatorial Prose Only</div>
              <div>Strictly uses normalized artifact descriptions. Excludes AI valuation, pricing estimates, and sales commentary.</div>
            </div>
            <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600, color: 'var(--pine-deep)', marginBottom: '0.25rem' }}>📄 Editable Word Format (.docx)</div>
              <div>Fully editable in Microsoft Word. Features native text, embedded museum photos, and page-break-protected layout tables.</div>
            </div>
          </div>
        </div>
      )}

      {/* MARITIME ITEMS PREVIEW & ORDERING LIST */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--pine-deep)' }}>
              Objects Included in Maritime Report
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isReordering 
                ? 'Rearrange artifacts to define the authoritative catalog sequence.'
                : 'Automatically selected based on institutional candidate = Maritime Museum.'}
            </p>
          </div>
          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.88rem', fontWeight: 600, padding: '0.35rem 0.75rem' }}>
            {maritimeItems.length} Qualifying Artifacts
          </span>
        </div>

        {loadingItems ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
            <div>Loading maritime catalog preview...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {maritimeItems.map((item, idx) => {
              const isBeingDragged = draggedIndex === idx;
              const isDropTarget = dragOverIndex === idx && draggedIndex !== idx;

              return (
                <div 
                  key={item.id || item.item_number || idx}
                  draggable={isReordering}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    alignItems: 'center', 
                    padding: '0.85rem 1rem', 
                    background: isBeingDragged ? '#f1f5f9' : '#fff', 
                    border: isDropTarget 
                      ? '2px solid #0284c7' 
                      : (isBeingDragged ? '2px dashed #94a3b8' : '1px solid #e5e7eb'),
                    borderRadius: '8px',
                    opacity: isBeingDragged ? 0.45 : 1,
                    boxShadow: isDropTarget ? '0 0 0 3px rgba(2, 132, 199, 0.2)' : 'none',
                    transition: 'border 0.15s ease, background 0.15s ease',
                    cursor: isReordering ? 'grab' : 'default'
                  }}
                >
                  {/* REORDER CONTROLS (DRAG HANDLE & UP/DOWN BUTTONS) */}
                  {isReordering && (
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.35rem', 
                        flexShrink: 0,
                        paddingRight: '0.5rem',
                        borderRight: '1px solid #e5e7eb'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div 
                        title="Drag to rearrange" 
                        style={{ 
                          cursor: 'grab', 
                          color: '#64748b', 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '0.25rem' 
                        }}
                      >
                        <GripVertical size={20} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button
                          type="button"
                          className="btn-outline"
                          title="Move Up"
                          aria-label={`Move ${item.title} up`}
                          disabled={idx === 0}
                          onClick={() => handleMoveItem(idx, -1)}
                          style={{
                            padding: '2px 4px',
                            minWidth: '24px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '3px',
                            opacity: idx === 0 ? 0.35 : 1
                          }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-outline"
                          title="Move Down"
                          aria-label={`Move ${item.title} down`}
                          disabled={idx === maritimeItems.length - 1}
                          onClick={() => handleMoveItem(idx, 1)}
                          style={{
                            padding: '2px 4px',
                            minWidth: '24px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '3px',
                            opacity: idx === maritimeItems.length - 1 ? 0.35 : 1
                          }}
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SEQUENCE BADGE */}
                  <div 
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isReordering ? '#0284c7' : '#f1f5f9',
                      color: isReordering ? '#fff' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                    title={`Sequence Position #${idx + 1}`}
                  >
                    #{idx + 1}
                  </div>

                  {/* THUMBNAIL */}
                  <div style={{ width: '75px', height: '75px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.museum_photo_url ? (
                      <img 
                        src={item.museum_photo_url} 
                        alt={item.title} 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      />
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center' }}>No Photo</span>
                    )}
                  </div>

                  {/* CONTENT */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.88rem' }}>
                        {item.item_number}
                      </span>
                      <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: '4px', background: item.destination === 'Institution' ? '#dcfce7' : '#f3f4f6', color: item.destination === 'Institution' ? '#166534' : '#4b5563', fontWeight: 600 }}>
                        {item.destination}
                      </span>
                    </div>
                    <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.98rem', color: '#111827', fontWeight: 600 }}>
                      {item.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.4, maxHeight: '2.8em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.normalized_description || <span style={{ color: '#9ca3af' }}>No description recorded.</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isReordering ? (
            <>
              <button
                className="btn-outline"
                onClick={handleCancelReorder}
                disabled={isSavingOrder}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95rem',
                  background: '#fff'
                }}
              >
                <RotateCcw size={18} /> Cancel Reordering
              </button>
              <button
                className="btn-green"
                onClick={handleSaveOrder}
                disabled={isSavingOrder || !hasUnsavedChanges}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 700
                }}
              >
                {isSavingOrder ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                {isSavingOrder ? 'Saving Order...' : 'Save Artifact Order'}
              </button>
            </>
          ) : (
            <button 
              className="btn-green"
              onClick={handleDownloadDocx}
              disabled={isGenerating}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.6rem',
                padding: '0.75rem 1.75rem',
                fontSize: '1rem',
                fontWeight: 700
              }}
            >
              {isGenerating ? <Loader2 size={20} className="spin" /> : <FileText size={20} />}
              {isGenerating ? 'Generating Word Document...' : 'GENERATE MARITIME MUSEUM WORD DOCUMENT (.DOCX)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
