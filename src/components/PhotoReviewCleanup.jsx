import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Check, AlertTriangle,
  Shield, ShieldCheck, Eye, Trash2, RotateCcw, Filter, Search, X, Lock,
  Camera, Images, Sparkles, AlertCircle, CheckCircle2, Info, Loader2,
  RefreshCw, Plus
} from 'lucide-react';
import CachedThumbnail from './CachedThumbnail';

/**
 * Photo Review & Cleanup Component (Admin Only)
 * 
 * Side-by-side direct comparison layout:
 * - Row 1: Primary Original vs Primary Museum Photo
 * - Rows 2+: Additional Original #N vs Additional Museum #N (with Create/Revise Museum workflow)
 * - Focused filter: "Needs Additional Museum Photo"
 * - Original photographs preserved by default; deletion is secondary and protected by confirmation.
 */
export default function PhotoReviewCleanup({
  currentUser,
  onClose,
  onUpdateItem
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active filter & search
  // 'all' | 'needs_additional' | 'multiple_originals' | 'not_reviewed' | 'reviewed'
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active item index in the filtered items array
  const [currentIndex, setCurrentIndex] = useState(0);

  // Marked for deletion state for the CURRENT active item (originalPhotoIds)
  const [markedOriginalIds, setMarkedOriginalIds] = useState(new Set());

  // Full-Res Preview Modal State: { url, label, filename, badgeColor }
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Deletion Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Additional Photo Museum Converter Studio Modal State:
  // null | { photo: Object, itemId: string, itemNumber: string, itemTitle: string, draftUrl: string|null, isGenerating: boolean, isRevising: boolean, isApproving: boolean, revisionPrompt: string, error: string|null }
  const [converterState, setConverterState] = useState(null);

  // Remove Additional Museum Confirmation State:
  // null | { photo: Object, isRemoving: boolean }
  const [removeMuseumTarget, setRemoveMuseumTarget] = useState(null);

  // Fetch items from backend
  const fetchCleanupItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/photo-cleanup/items');
      if (!res.ok) {
        throw new Error(`Failed to load items (HTTP ${res.status})`);
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Fetch cleanup items error:', err);
      setError(err.message || 'Failed to load photo cleanup items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCleanupItems();
  }, [fetchCleanupItems]);

  // Reset marked deletions whenever active item changes
  useEffect(() => {
    setMarkedOriginalIds(new Set());
  }, [currentIndex]);

  // Compute filtered items list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search query filter (item_number or title)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (item.item_number || '').toLowerCase().includes(q);
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const catMatch = (item.category_name || '').toLowerCase().includes(q);
        if (!numMatch && !titleMatch && !catMatch) return false;
      }

      // Filter tabs
      switch (activeFilter) {
        case 'needs_additional':
          return item.originalPhotos?.length > 1 && item.originalPhotos.slice(1).some(p => !p.museum_photo_url);
        case 'multiple_originals':
          return item.hasMultipleOriginals;
        case 'not_reviewed':
          return !item.photo_review_status || item.photo_review_status === 'NOT_REVIEWED';
        case 'reviewed':
          return item.photo_review_status && item.photo_review_status !== 'NOT_REVIEWED';
        default:
          return true;
      }
    });
  }, [items, searchQuery, activeFilter]);

  // Ensure current index stays within valid range
  useEffect(() => {
    if (currentIndex >= filteredItems.length && filteredItems.length > 0) {
      setCurrentIndex(filteredItems.length - 1);
    }
  }, [filteredItems.length, currentIndex]);

  const currentItem = filteredItems[currentIndex] || null;

  // Global counts for filter badges
  const filterCounts = useMemo(() => {
    return {
      all: items.length,
      needs_additional: items.filter(i => i.originalPhotos?.length > 1 && i.originalPhotos.slice(1).some(p => !p.museum_photo_url)).length,
      multiple_originals: items.filter(i => i.hasMultipleOriginals).length,
      not_reviewed: items.filter(i => !i.photo_review_status || i.photo_review_status === 'NOT_REVIEWED').length,
      reviewed: items.filter(i => i.photo_review_status && i.photo_review_status !== 'NOT_REVIEWED').length
    };
  }, [items]);

  // Toggle deletion marking for an original photo (exceptional cleanup action)
  const toggleMarkOriginal = (photoId) => {
    if (!currentItem) return;

    // Safety check: an item must always retain at least one original photograph
    const totalOriginals = currentItem.originalPhotos?.length || 0;
    const isCurrentlyMarked = markedOriginalIds.has(photoId);

    if (!isCurrentlyMarked) {
      const currentlyMarkedCount = markedOriginalIds.size;
      if (totalOriginals - currentlyMarkedCount <= 1) {
        alert("Safety Protection: An inventory item must retain at least one original photograph. You cannot delete the only remaining original.");
        return;
      }
    }

    setMarkedOriginalIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentIndex < filteredItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Save & Next flow
  const handleSaveAndNextClick = () => {
    if (!currentItem) return;

    if (markedOriginalIds.size > 0) {
      setShowConfirmModal(true);
    } else {
      // Default path: Keep all originals intact and advance
      commitReviewDecisions([]);
    }
  };

  // Execute review decision API call
  const commitReviewDecisions = async (deleteOriginalIds) => {
    if (!currentItem) return;
    setSubmittingReview(true);

    try {
      const res = await fetch(`/api/admin/photo-cleanup/items/${currentItem.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteOriginalPhotoIds: deleteOriginalIds,
          deleteHistoricalFilenames: []
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Review failed with status ${res.status}`);
      }

      const result = await res.json();

      // Update local state with the newly updated item
      setItems(prev => prev.map(item => {
        if (item.id === currentItem.id) {
          const updatedOriginals = result.originalPhotos || [];
          return {
            ...item,
            photo_review_status: result.photoReviewStatus,
            originalPhotos: updatedOriginals,
            hasMultipleOriginals: updatedOriginals.length > 1,
            needsAdditionalMuseum: updatedOriginals.length > 1 && updatedOriginals.slice(1).some(p => !p.museum_photo_url),
            totalPhotoCount: (item.currentMuseumPhoto ? 1 : 0) + updatedOriginals.length
          };
        }
        return item;
      }));

      if (onUpdateItem) {
        onUpdateItem({ id: currentItem.id, photo_review_status: result.photoReviewStatus });
      }

      setShowConfirmModal(false);

      // Advance to next item if available
      if (currentIndex < filteredItems.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to commit photo review:', err);
      alert(`Error saving photo review: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Reset review status to NOT_REVIEWED
  const handleResetReviewStatus = async () => {
    if (!currentItem) return;
    if (!window.confirm(`Reset review status for ${currentItem.item_number || currentItem.title} back to "NOT REVIEWED"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/photo-cleanup/items/${currentItem.id}/reset`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to reset review status");

      setItems(prev => prev.map(item => {
        if (item.id === currentItem.id) {
          return { ...item, photo_review_status: 'NOT_REVIEWED' };
        }
        return item;
      }));
    } catch (err) {
      alert(`Error resetting status: ${err.message}`);
    }
  };

  // ----------------------------------------------------
  // ADDITIONAL PHOTO MUSEUM CONVERTER WORKFLOW
  // ----------------------------------------------------

  // Start conversion for an additional original photo
  const handleStartPhotoConversion = async (photo) => {
    if (!currentItem || !photo) return;

    setConverterState({
      photo,
      itemId: currentItem.id,
      itemNumber: currentItem.item_number,
      itemTitle: currentItem.title,
      draftUrl: null,
      isGenerating: true,
      isRevising: false,
      isApproving: false,
      revisionPrompt: '',
      error: null
    });

    try {
      const res = await fetch(`/api/admin/items/${currentItem.id}/photos/${photo.id}/museum-photo/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate museum version.");

      setConverterState(prev => prev ? {
        ...prev,
        draftUrl: data.draftUrl,
        isGenerating: false,
        error: null
      } : null);
    } catch (err) {
      console.error("Generate additional museum photo error:", err);
      setConverterState(prev => prev ? {
        ...prev,
        isGenerating: false,
        error: err.message
      } : null);
    }
  };

  // Revise current draft
  const handleRevisePhotoDraft = async () => {
    if (!converterState || !converterState.draftUrl || !converterState.revisionPrompt.trim()) return;

    setConverterState(prev => ({ ...prev, isRevising: true, error: null }));

    try {
      const res = await fetch(`/api/admin/items/${converterState.itemId}/photos/${converterState.photo.id}/museum-photo/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: converterState.revisionPrompt.trim(),
          draftUrl: converterState.draftUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revise museum version.");

      setConverterState(prev => prev ? {
        ...prev,
        draftUrl: data.draftUrl,
        isRevising: false,
        revisionPrompt: '',
        error: null
      } : null);
    } catch (err) {
      console.error("Revise additional museum photo error:", err);
      setConverterState(prev => prev ? {
        ...prev,
        isRevising: false,
        error: err.message
      } : null);
    }
  };

  // Approve current draft and save to item_photos
  const handleApprovePhotoDraft = async () => {
    if (!converterState || !converterState.draftUrl) return;

    setConverterState(prev => ({ ...prev, isApproving: true, error: null }));

    try {
      const res = await fetch(`/api/admin/items/${converterState.itemId}/photos/${converterState.photo.id}/museum-photo/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftUrl: converterState.draftUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve museum version.");

      const updatedPhoto = data.photo;

      // Update in items state
      setItems(prev => prev.map(it => {
        if (it.id === converterState.itemId) {
          const updatedOriginals = (it.originalPhotos || []).map(p => 
            p.id === updatedPhoto.id ? { ...p, ...updatedPhoto } : p
          );
          return {
            ...it,
            originalPhotos: updatedOriginals,
            needsAdditionalMuseum: updatedOriginals.length > 1 && updatedOriginals.slice(1).some(p => !p.museum_photo_url)
          };
        }
        return it;
      }));

      setConverterState(null);
    } catch (err) {
      console.error("Approve additional museum photo error:", err);
      setConverterState(prev => prev ? {
        ...prev,
        isApproving: false,
        error: err.message
      } : null);
    }
  };

  // Cancel and discard draft
  const handleCancelPhotoConverter = async () => {
    if (!converterState) return;
    const { itemId, photo } = converterState;

    try {
      await fetch(`/api/admin/items/${itemId}/photos/${photo.id}/museum-photo/draft`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn("Could not discard draft on server:", e);
    }

    setConverterState(null);
  };

  // Remove Additional Museum Version (keeping original intact)
  const handleConfirmRemoveMuseumVersion = async () => {
    if (!removeMuseumTarget || !currentItem) return;
    const { photo } = removeMuseumTarget;

    setRemoveMuseumTarget(prev => ({ ...prev, isRemoving: true }));

    try {
      const res = await fetch(`/api/admin/items/${currentItem.id}/photos/${photo.id}/museum-photo`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove museum version.");

      const updatedPhoto = data.photo;

      setItems(prev => prev.map(it => {
        if (it.id === currentItem.id) {
          const updatedOriginals = (it.originalPhotos || []).map(p => 
            p.id === updatedPhoto.id ? { ...p, ...updatedPhoto } : p
          );
          return {
            ...it,
            originalPhotos: updatedOriginals,
            needsAdditionalMuseum: updatedOriginals.length > 1 && updatedOriginals.slice(1).some(p => !p.museum_photo_url)
          };
        }
        return it;
      }));

      setRemoveMuseumTarget(null);
    } catch (err) {
      alert(`Error removing museum version: ${err.message}`);
      setRemoveMuseumTarget(null);
    }
  };

  // Helper badge for review status
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'REVIEWED_PHOTOS_DELETED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
            <Trash2 size={12} /> REVIEWED - PHOTOS DELETED
          </span>
        );
      case 'REVIEWED_NO_DELETIONS':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
            <CheckCircle2 size={12} /> REVIEWED - NO DELETIONS
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
            <AlertCircle size={12} /> NOT REVIEWED
          </span>
        );
    }
  };

  // Primary original vs additional originals
  const primaryOriginal = currentItem?.originalPhotos?.[0] || null;
  const additionalOriginals = currentItem?.originalPhotos ? currentItem.originalPhotos.slice(1) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 90px)', minHeight: '650px', background: '#f8faf9', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      
      {/* HEADER BAR */}
      <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button className="btn-outline" onClick={onClose} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ArrowLeft size={16} /> Back to Catalog
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Images size={20} color="var(--gold-accent)" /> Photo Review & Cleanup Studio
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                Side-by-Side Review & Additional Museum Photo Converter
              </span>
            </div>
          </div>

          {/* Quick Item Counter & Progress */}
          {filteredItems.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: 'var(--pine-deep)' }}>
                  Item {currentIndex + 1} of {filteredItems.length}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>
                  ({filterCounts.reviewed} of {filterCounts.all} reviewed overall)
                </span>
              </div>
              <div style={{ width: '120px', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${filterCounts.all > 0 ? (filterCounts.reviewed / filterCounts.all) * 100 : 0}%`, 
                    height: '100%', 
                    background: 'var(--pine-primary)', 
                    transition: 'width 0.3s' 
                  }} 
                />
              </div>
            </div>
          )}
        </div>

        {/* SEARCH & FILTERS ROW */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', paddingTop: '0.4rem', borderTop: '1px solid #edf2f0' }}>
          {/* Segmented Filter Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={14} /> Filter:
            </span>
            {[
              { id: 'all', label: 'All Items', count: filterCounts.all },
              { id: 'needs_additional', label: 'Needs Additional Museum Photo', count: filterCounts.needs_additional, highlight: true },
              { id: 'multiple_originals', label: 'Multiple Originals', count: filterCounts.multiple_originals },
              { id: 'not_reviewed', label: 'Not Reviewed', count: filterCounts.not_reviewed },
              { id: 'reviewed', label: 'Reviewed', count: filterCounts.reviewed }
            ].map(tab => (
              <button
                key={tab.id}
                className={`btn-outline ${activeFilter === tab.id ? 'btn-green' : ''}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '14px',
                  fontWeight: activeFilter === tab.id ? 'bold' : 'normal',
                  borderColor: tab.highlight && activeFilter !== tab.id ? '#f59e0b' : undefined,
                  color: tab.highlight && activeFilter !== tab.id ? '#b45309' : undefined,
                  background: tab.highlight && activeFilter !== tab.id ? '#fef3c7' : undefined
                }}
                onClick={() => {
                  setActiveFilter(tab.id);
                  setCurrentIndex(0);
                }}
              >
                {tab.highlight && <Sparkles size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />}
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search UJ-# or title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentIndex(0);
              }}
              style={{
                width: '100%',
                padding: '5px 10px 5px 30px',
                fontSize: '0.82rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: '#fff'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN REVIEW WORKSPACE */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>
            <Loader2 className="spin" size={32} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--pine-primary)' }} />
            Loading photo review catalog...
          </div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#dc2626' }}>
            <AlertTriangle size={36} style={{ margin: '0 auto 1rem', display: 'block' }} />
            <p style={{ fontWeight: 'bold' }}>{error}</p>
            <button className="btn-outline" onClick={fetchCleanupItems} style={{ marginTop: '0.75rem' }}>
              Retry Loading
            </button>
          </div>
        ) : !currentItem ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <Images size={48} style={{ margin: '0 auto 1rem', display: 'block', color: '#9ca3af' }} />
            <h3>No inventory items match the current filter or search.</h3>
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>Try selecting "All Items" or clearing your search query.</p>
            <button className="btn-outline" onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}>
              Show All Items
            </button>
          </div>
        ) : (
          <>
            {/* CURRENT ITEM BANNER */}
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--pine-deep)', background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  {currentItem.item_number || 'NO-ID'}
                </span>
                <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: '#1f2937' }}>
                    {currentItem.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#6b7280' }}>
                    <span>Category: <strong>{currentItem.category_icon || '📦'} {currentItem.category_name || 'Uncategorized'}</strong></span>
                    <span>•</span>
                    <span>Total Associated Photos: <strong>{currentItem.totalPhotoCount}</strong></span>
                    {additionalOriginals.length > 0 && (
                      <span style={{ color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        {additionalOriginals.length} Additional {additionalOriginals.length === 1 ? 'Original' : 'Originals'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {renderStatusBadge(currentItem.photo_review_status)}
                {currentItem.photo_review_status && currentItem.photo_review_status !== 'NOT_REVIEWED' && (
                  <button
                    onClick={handleResetReviewStatus}
                    className="btn-outline"
                    style={{ fontSize: '0.72rem', padding: '2px 6px', color: '#6b7280' }}
                    title="Reset back to Not Reviewed"
                  >
                    <RotateCcw size={12} /> Reset Status
                  </button>
                )}
              </div>
            </div>

            {/* SIDE-BY-SIDE COMPARISON WORKSPACE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* ---------------------------------------------------- */}
              {/* ROW 1: PRIMARY ORIGINAL vs CURRENT / PRIMARY MUSEUM */}
              {/* ---------------------------------------------------- */}
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Primary Presentation Comparison
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      (Direct side-by-side comparison of original artifact against its active museum conversion)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  
                  {/* LEFT: PRIMARY ORIGINAL */}
                  <div style={{
                    border: primaryOriginal && markedOriginalIds.has(primaryOriginal.id) ? '2px dashed #ef4444' : '1px solid #bfdbfe',
                    background: primaryOriginal && markedOriginalIds.has(primaryOriginal.id) ? '#fef2f2' : '#f0f9ff',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ background: '#0284c7', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Camera size={13} /> {additionalOriginals.length > 0 ? 'PRIMARY ORIGINAL PHOTO' : 'ORIGINAL PHOTO'}
                      </span>
                      {primaryOriginal && markedOriginalIds.has(primaryOriginal.id) ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                          MARKED FOR DELETION
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 600 }}>
                          Documentary Source Record
                        </span>
                      )}
                    </div>

                    {primaryOriginal ? (
                      <>
                        <div 
                          style={{ width: '100%', height: '300px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid #e0f2fe', position: 'relative', cursor: 'pointer' }}
                          onClick={() => setPreviewPhoto({
                            url: primaryOriginal.photo_url,
                            label: additionalOriginals.length > 0 ? 'PRIMARY ORIGINAL PHOTO' : 'ORIGINAL PHOTO',
                            filename: primaryOriginal.photo_url,
                            badgeColor: '#0284c7'
                          })}
                          title="Click to view full preview"
                        >
                          <CachedThumbnail
                            url={primaryOriginal.photo_url}
                            alt="Primary Original Photo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                          <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: '4px', padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={13} /> Inspect Full Size
                          </div>
                        </div>

                        <div style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#4b5563', background: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={primaryOriginal.photo_url}>
                          {primaryOriginal.photo_url}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                          {additionalOriginals.length === 0 ? (
                            <div style={{ padding: '6px 10px', background: '#e0f2fe', borderRadius: '6px', border: '1px solid #bae6fd', fontSize: '0.76rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldCheck size={14} />
                              <span>Sole Original Photograph (Protected from deletion)</span>
                            </div>
                          ) : markedOriginalIds.has(primaryOriginal.id) ? (
                            <button
                              onClick={() => toggleMarkOriginal(primaryOriginal.id)}
                              style={{ width: '100%', padding: '6px', fontSize: '0.8rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid #22c55e', background: '#dcfce7', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                            >
                              <RotateCcw size={14} /> Undo Deletion Mark
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleMarkOriginal(primaryOriginal.id)}
                              className="btn-outline"
                              style={{ width: '100%', padding: '6px', fontSize: '0.78rem', borderRadius: '6px', color: '#b91c1c', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                              title="Delete only if genuinely unnecessary"
                            >
                              <Trash2 size={13} /> Mark for Deletion (Exceptional Action)
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '3rem', textAlign: 'center', color: '#dc2626', fontStyle: 'italic' }}>
                        No original photo found in item_photos.
                      </div>
                    )}
                  </div>

                  {/* RIGHT: CURRENT / PRIMARY MUSEUM PHOTO */}
                  <div style={{
                    border: '2px solid #10b981',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ background: '#059669', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Sparkles size={13} /> PRIMARY MUSEUM PHOTO
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: '#047857', fontWeight: 600 }}>
                        <ShieldCheck size={13} /> Protected Slot
                      </div>
                    </div>

                    {currentItem.currentMuseumPhoto ? (
                      <>
                        <div 
                          style={{ width: '100%', height: '300px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid #d1fae5', position: 'relative', cursor: 'pointer' }}
                          onClick={() => setPreviewPhoto({
                            url: currentItem.currentMuseumPhoto.url,
                            label: 'PRIMARY MUSEUM PHOTO',
                            filename: currentItem.currentMuseumPhoto.url,
                            badgeColor: '#059669'
                          })}
                          title="Click to view full preview"
                        >
                          <CachedThumbnail
                            url={currentItem.currentMuseumPhoto.url}
                            alt="Primary Museum Photo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                          <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: '4px', padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={13} /> Inspect Full Size
                          </div>
                        </div>

                        <div style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#166534', background: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentItem.currentMuseumPhoto.url}>
                          {currentItem.currentMuseumPhoto.url}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: '#166534' }}>
                          <span>Updated: <strong>{currentItem.currentMuseumPhoto.updatedAt ? new Date(currentItem.currentMuseumPhoto.updatedAt).toLocaleDateString() : 'Active'}</strong></span>
                          <span>By: <strong>{currentItem.currentMuseumPhoto.updatedBy || 'Curator'}</strong></span>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                        No museum photo recorded for this item.
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* ROWS 2+: ADDITIONAL ORIGINALS & THEIR MUSEUM COUNTERPARTS */}
              {/* ---------------------------------------------------- */}
              {additionalOriginals.length > 0 && (
                <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Additional Original Photographs ({additionalOriginals.length})
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                        (Secondary angles, maker marks, inscriptions, or detail shots with individual museum conversions)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {additionalOriginals.map((photo, aIdx) => {
                      const photoNum = aIdx + 1;
                      const isMarked = markedOriginalIds.has(photo.id);
                      const hasMuseumVersion = !!photo.museum_photo_url;

                      return (
                        <div 
                          key={photo.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '1rem',
                            background: '#f8fafc'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#334155' }}>
                              Pair #{photoNum}: Additional Angle / Detail Photo
                            </span>
                            {hasMuseumVersion ? (
                              <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                ✓ Museum Conversion Available
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                ⚠️ Needs Museum Version
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                            
                            {/* LEFT: ADDITIONAL ORIGINAL */}
                            <div style={{
                              border: isMarked ? '2px dashed #ef4444' : '1px solid #cbd5e1',
                              background: isMarked ? '#fef2f2' : '#fff',
                              borderRadius: '8px',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ background: '#475569', color: '#fff', fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Camera size={12} /> ADDITIONAL ORIGINAL #{photoNum}
                                </span>
                                {isMarked ? (
                                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                    MARKED FOR DELETION
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Documentary Record
                                  </span>
                                )}
                              </div>

                              <div 
                                style={{ width: '100%', height: '260px', borderRadius: '6px', overflow: 'hidden', background: '#fafafa', border: '1px solid #e2e8f0', position: 'relative', cursor: 'pointer' }}
                                onClick={() => setPreviewPhoto({
                                  url: photo.photo_url,
                                  label: `ADDITIONAL ORIGINAL #${photoNum}`,
                                  filename: photo.photo_url,
                                  badgeColor: '#475569'
                                })}
                                title="Click to inspect full size"
                              >
                                <CachedThumbnail
                                  url={photo.photo_url}
                                  alt={`Additional Original #${photoNum}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                                <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Eye size={12} /> Inspect
                                </div>
                              </div>

                              <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b', background: '#f8fafc', padding: '3px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={photo.photo_url}>
                                {photo.photo_url}
                              </div>

                              {/* Warning if marked for deletion and has museum version */}
                              {isMarked && hasMuseumVersion && (
                                <div style={{ fontSize: '0.74rem', color: '#b91c1c', background: '#fee2e2', padding: '6px 8px', borderRadius: '4px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                  <span>Deleting this original will also remove its associated Museum version.</span>
                                </div>
                              )}

                              <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                                {isMarked ? (
                                  <button
                                    onClick={() => toggleMarkOriginal(photo.id)}
                                    style={{ width: '100%', padding: '5px', fontSize: '0.78rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid #22c55e', background: '#dcfce7', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                  >
                                    <RotateCcw size={13} /> Undo Deletion Mark
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => toggleMarkOriginal(photo.id)}
                                    className="btn-outline"
                                    style={{ width: '100%', padding: '5px', fontSize: '0.78rem', borderRadius: '6px', color: '#b91c1c', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                    title="Mark for deletion only if genuinely unnecessary"
                                  >
                                    <Trash2 size={13} /> Mark Unnecessary Photo for Deletion
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* RIGHT: ADDITIONAL MUSEUM VERSION (or Create Museum Version Card) */}
                            <div style={{
                              border: hasMuseumVersion ? '1px solid #86efac' : '1px dashed #cbd5e1',
                              background: hasMuseumVersion ? '#f0fdf4' : '#fff',
                              borderRadius: '8px',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ background: hasMuseumVersion ? '#059669' : '#64748b', color: '#fff', fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Sparkles size={12} /> ADDITIONAL MUSEUM #{photoNum}
                                </span>
                                {hasMuseumVersion ? (
                                  <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>
                                    Dedicated Conversion
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    Not Created Yet
                                  </span>
                                )}
                              </div>

                              {hasMuseumVersion ? (
                                <>
                                  <div 
                                    style={{ width: '100%', height: '260px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid #d1fae5', position: 'relative', cursor: 'pointer' }}
                                    onClick={() => setPreviewPhoto({
                                      url: photo.museum_photo_url,
                                      label: `ADDITIONAL MUSEUM PHOTO #${photoNum}`,
                                      filename: photo.museum_photo_url,
                                      badgeColor: '#059669'
                                    })}
                                    title="Click to inspect full size"
                                  >
                                    <CachedThumbnail
                                      url={photo.museum_photo_url}
                                      alt={`Additional Museum Photo #${photoNum}`}
                                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    />
                                    <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <Eye size={12} /> Inspect
                                    </div>
                                  </div>

                                  <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#166534', background: '#fff', padding: '3px 6px', borderRadius: '4px', border: '1px solid #bbf7d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={photo.museum_photo_url}>
                                    {photo.museum_photo_url}
                                  </div>

                                  <div style={{ marginTop: 'auto', paddingTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                      onClick={() => handleStartPhotoConversion(photo)}
                                      className="btn-outline"
                                      style={{ flex: 1, padding: '5px 8px', fontSize: '0.76rem', borderRadius: '6px', color: '#047857', borderColor: '#a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                      title="Revise or regenerate this museum version"
                                    >
                                      <RefreshCw size={12} /> Revise / Re-convert
                                    </button>

                                    <button
                                      onClick={() => setRemoveMuseumTarget({ photo, isRemoving: false })}
                                      className="btn-outline"
                                      style={{ padding: '5px 8px', fontSize: '0.76rem', borderRadius: '6px', color: '#b91c1c', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                      title="Remove only the museum version (keeps original photo)"
                                    >
                                      <Trash2 size={12} /> Clear Museum Version
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1', padding: '1rem', textAlign: 'center' }}>
                                  <Sparkles size={32} color="#f59e0b" />
                                  <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#334155' }}>
                                      No Museum Version Created
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b', maxWidth: '240px' }}>
                                      Convert this additional original into an isolated museum catalog image.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleStartPhotoConversion(photo)}
                                    style={{
                                      padding: '8px 16px',
                                      fontSize: '0.82rem',
                                      fontWeight: 'bold',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: 'var(--pine-primary)',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    <Sparkles size={15} /> CREATE MUSEUM VERSION
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {/* FOOTER ACTION BAR */}
      {currentItem && (
        <div style={{ padding: '0.85rem 1.25rem', background: '#fff', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '5px', opacity: currentIndex === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <button
              className="btn-outline"
              onClick={handleSkip}
              disabled={currentIndex >= filteredItems.length - 1}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '5px', opacity: currentIndex >= filteredItems.length - 1 ? 0.5 : 1 }}
            >
              Skip <ChevronRight size={16} />
            </button>
          </div>

          {/* Center Summary Indicator */}
          <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>
            {markedOriginalIds.size > 0 ? (
              <span style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={15} />
                {markedOriginalIds.size} {markedOriginalIds.size === 1 ? 'photo' : 'photos'} marked for deletion
              </span>
            ) : (
              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={15} /> All documentary original photos preserved
              </span>
            )}
          </div>

          {/* Primary Save & Next Button */}
          <button
            onClick={handleSaveAndNextClick}
            disabled={submittingReview}
            style={{
              padding: '0.55rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              borderRadius: '6px',
              border: 'none',
              background: markedOriginalIds.size > 0 ? '#dc2626' : 'var(--pine-primary)',
              color: '#fff',
              cursor: submittingReview ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {submittingReview ? (
              <>
                <Loader2 className="spin" size={16} /> Saving Review...
              </>
            ) : (
              <>
                Save & Next <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR DELETIONS */}
      {showConfirmModal && currentItem && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => !submittingReview && setShowConfirmModal(false)}
        >
          <div 
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '560px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '0.85rem' }}>
              <div style={{ background: '#fee2e2', borderRadius: '50%', padding: '8px' }}>
                <Trash2 size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>
                Confirm Exceptional Photo Deletions
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#374151', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
              You are about to permanently delete <strong>{markedOriginalIds.size}</strong> photograph(s) from <strong>{currentItem.item_number} — {currentItem.title}</strong>:
            </p>

            {/* List of photos to delete */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.5rem', marginBottom: '1rem', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Array.from(markedOriginalIds).map(id => {
                const photo = currentItem.originalPhotos?.find(p => p.id === id);
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '4px 6px', background: '#fff', borderRadius: '4px', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 'bold', background: '#fee2e2', color: '#991b1b', padding: '2px 4px', borderRadius: '3px' }}>
                      ORIGINAL
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {photo?.photo_url || id}
                    </span>
                    {photo?.museum_photo_url && (
                      <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                        + Associated Museum Version
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Warning if any photo has an associated museum version */}
            {Array.from(markedOriginalIds).some(id => currentItem.originalPhotos?.find(p => p.id === id)?.museum_photo_url) && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', fontSize: '0.8rem', color: '#b45309', marginBottom: '1rem', lineHeight: '1.4' }}>
                <strong>⚠️ Notice:</strong> One or more selected original photos have an associated Museum version. Because the Museum version is associated with this original photo record, deleting the original will also remove its associated Museum version.
              </div>
            )}

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem', color: '#991b1b', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              <strong>Safety Note:</strong> Database references will be removed and unreferenced physical image files will be deleted from disk storage. The primary Museum photo and remaining original photo(s) are strictly protected.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn-outline"
                disabled={submittingReview}
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: '0.45rem 1rem', fontSize: '0.86rem' }}
              >
                Cancel / Keep All Originals
              </button>

              <button
                disabled={submittingReview}
                onClick={() => commitReviewDecisions(Array.from(markedOriginalIds))}
                style={{
                  padding: '0.45rem 1.1rem',
                  fontSize: '0.86rem',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  cursor: submittingReview ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {submittingReview ? (
                  <>
                    <Loader2 className="spin" size={14} /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirm & Delete ({markedOriginalIds.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADDITIONAL PHOTO CONVERTER & REVISION MODAL */}
      {converterState && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => !converterState.isGenerating && !converterState.isRevising && !converterState.isApproving && handleCancelPhotoConverter()}
        >
          <div 
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} color="var(--gold-accent)" /> Museum Photo Converter — Additional Photo
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Item: <strong>{converterState.itemNumber}</strong> — {converterState.itemTitle}
                </span>
              </div>
              <button 
                onClick={handleCancelPhotoConverter}
                disabled={converterState.isGenerating || converterState.isRevising || converterState.isApproving}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {converterState.error && (
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '0.82rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                <span>{converterState.error}</span>
              </div>
            )}

            {/* Side-by-Side: Source Original vs AI Museum Draft */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              
              {/* Left: Source Photo */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                  Source Original Photograph
                </div>
                <div style={{ width: '100%', height: '280px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid #cbd5e1' }}>
                  <CachedThumbnail
                    url={converterState.photo.photo_url}
                    alt="Source Original"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {converterState.photo.photo_url}
                </div>
              </div>

              {/* Right: AI Generated Draft */}
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#166534', textTransform: 'uppercase' }}>
                    AI Museum Draft (OpenAI Sunburst)
                  </span>
                  {converterState.draftUrl && !converterState.isGenerating && !converterState.isRevising && (
                    <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
                      Draft Ready for Review
                    </span>
                  )}
                </div>

                <div style={{ width: '100%', height: '280px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid #bbf7d0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {converterState.isGenerating ? (
                    <div style={{ textAlign: 'center', color: '#047857' }}>
                      <Loader2 className="spin" size={32} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Generating initial museum conversion...</span>
                    </div>
                  ) : converterState.isRevising ? (
                    <div style={{ textAlign: 'center', color: '#047857' }}>
                      <Loader2 className="spin" size={32} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Revising presentation draft...</span>
                    </div>
                  ) : converterState.draftUrl ? (
                    <img 
                      src={converterState.draftUrl} 
                      alt="Museum Draft" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                      No draft available.
                    </div>
                  )}
                </div>

                {converterState.draftUrl && (
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {converterState.draftUrl}
                  </div>
                )}
              </div>

            </div>

            {/* Revision Instruction Box (Dual-Image Anchoring) */}
            {converterState.draftUrl && !converterState.isGenerating && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#334155' }}>
                  Revise Draft (Optional Instruction):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. adjust lighting, sharpen detail markings, lighten background..."
                    value={converterState.revisionPrompt}
                    onChange={(e) => setConverterState(prev => prev ? { ...prev, revisionPrompt: e.target.value } : null)}
                    disabled={converterState.isRevising || converterState.isApproving}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && converterState.revisionPrompt.trim()) {
                        handleRevisePhotoDraft();
                      }
                    }}
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    onClick={handleRevisePhotoDraft}
                    disabled={!converterState.revisionPrompt.trim() || converterState.isRevising || converterState.isApproving}
                    className="btn-outline"
                    style={{ padding: '7px 14px', fontSize: '0.82rem', fontWeight: 'bold', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    {converterState.isRevising ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                    Revise
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                className="btn-outline"
                onClick={handleCancelPhotoConverter}
                disabled={converterState.isGenerating || converterState.isRevising || converterState.isApproving}
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              >
                Discard & Close
              </button>

              <button
                onClick={handleApprovePhotoDraft}
                disabled={!converterState.draftUrl || converterState.isGenerating || converterState.isRevising || converterState.isApproving}
                style={{
                  padding: '0.55rem 1.4rem',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--pine-primary)',
                  color: '#fff',
                  cursor: (!converterState.draftUrl || converterState.isGenerating || converterState.isRevising || converterState.isApproving) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {converterState.isApproving ? (
                  <>
                    <Loader2 className="spin" size={15} /> Saving Museum Version...
                  </>
                ) : (
                  <>
                    <Check size={16} /> Approve & Save Museum Version
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL TO REMOVE ADDITIONAL MUSEUM VERSION */}
      {removeMuseumTarget && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => !removeMuseumTarget.isRemoving && setRemoveMuseumTarget(null)}
        >
          <div 
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '0.85rem' }}>
              <div style={{ background: '#fee2e2', borderRadius: '50%', padding: '8px' }}>
                <Trash2 size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-heading)' }}>
                Remove Museum Version Only
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#374151', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
              Are you sure you want to remove this Museum version?
            </p>

            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '8px 12px', fontSize: '0.8rem', color: '#166534', marginBottom: '1.25rem' }}>
              <strong>Safe Operation:</strong> The documentary original photograph will be completely preserved. Only the generated museum version will be unlinked and cleared.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn-outline"
                disabled={removeMuseumTarget.isRemoving}
                onClick={() => setRemoveMuseumTarget(null)}
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>

              <button
                disabled={removeMuseumTarget.isRemoving}
                onClick={handleConfirmRemoveMuseumVersion}
                style={{
                  padding: '0.45rem 1.1rem',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  cursor: removeMuseumTarget.isRemoving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {removeMuseumTarget.isRemoving ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                Confirm & Remove Museum Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-RES PREVIEW MODAL */}
      {previewPhoto && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div 
            style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', background: previewPhoto.badgeColor || '#059669', padding: '3px 8px', borderRadius: '4px' }}>
                {previewPhoto.label}
              </span>
              <button 
                onClick={() => setPreviewPhoto(null)} 
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <img
              src={previewPhoto.url}
              alt={previewPhoto.label}
              style={{ maxWidth: '85vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', background: '#111' }}
            />

            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#9ca3af', fontFamily: 'monospace', textAlign: 'center', wordBreak: 'break-all' }}>
              {previewPhoto.filename}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
