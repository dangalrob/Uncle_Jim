import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Check, AlertTriangle,
  Shield, ShieldCheck, Eye, Trash2, RotateCcw, Filter, Search, X, Lock,
  Camera, Images, Sparkles, AlertCircle, CheckCircle2, Info, Loader2
} from 'lucide-react';
import CachedThumbnail from './CachedThumbnail';

/**
 * Photo Review & Cleanup Component (Admin Only)
 * 
 * Allows curators/administrators to review every photograph associated with every inventory item
 * across three distinct tiers:
 * 1. Current Museum Photo (Protected from deletion)
 * 2. Original Photographs (Primary & Additional Originals; preserves at least 1 original)
 * 3. Historical / Superseded Museum Photos (Safely identified by itemId pattern)
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
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'not_reviewed' | 'reviewed' | 'multiple_originals' | 'has_historical'
  const [searchQuery, setSearchQuery] = useState('');

  // Active item index in the filtered items array
  const [currentIndex, setCurrentIndex] = useState(0);

  // Marked for deletion state for the CURRENT active item:
  // { originalPhotoIds: Set<string>, historicalFilenames: Set<string> }
  const [markedOriginalIds, setMarkedOriginalIds] = useState(new Set());
  const [markedHistoricalFilenames, setMarkedHistoricalFilenames] = useState(new Set());

  // Full-Res Preview Modal State: { url, label, filename, type }
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Deletion Confirmation Modal State: boolean
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

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
    setMarkedHistoricalFilenames(new Set());
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
        case 'not_reviewed':
          return !item.photo_review_status || item.photo_review_status === 'NOT_REVIEWED';
        case 'reviewed':
          return item.photo_review_status && item.photo_review_status !== 'NOT_REVIEWED';
        case 'multiple_originals':
          return item.hasMultipleOriginals;
        case 'has_historical':
          return item.hasHistoricalMuseum;
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
      not_reviewed: items.filter(i => !i.photo_review_status || i.photo_review_status === 'NOT_REVIEWED').length,
      reviewed: items.filter(i => i.photo_review_status && i.photo_review_status !== 'NOT_REVIEWED').length,
      multiple_originals: items.filter(i => i.hasMultipleOriginals).length,
      has_historical: items.filter(i => i.hasHistoricalMuseum).length
    };
  }, [items]);

  // Toggle deletion marking for an original photo
  const toggleMarkOriginal = (photoId) => {
    if (!currentItem) return;

    // Safety: check if this is the only remaining original photo
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

  // Toggle deletion marking for a historical museum photo
  const toggleMarkHistorical = (filename) => {
    setMarkedHistoricalFilenames(prev => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
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

    const hasMarkedDeletions = markedOriginalIds.size > 0 || markedHistoricalFilenames.size > 0;
    if (hasMarkedDeletions) {
      setShowConfirmModal(true);
    } else {
      // No deletions marked: immediately commit "REVIEWED - NO DELETIONS" and advance
      commitReviewDecisions([], []);
    }
  };

  // Execute review decision API call
  const commitReviewDecisions = async (deleteOriginalIds, deleteHistoricalNames) => {
    if (!currentItem) return;
    setSubmittingReview(true);

    try {
      const res = await fetch(`/api/admin/photo-cleanup/items/${currentItem.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteOriginalPhotoIds: deleteOriginalIds,
          deleteHistoricalFilenames: deleteHistoricalNames
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
          return {
            ...item,
            photo_review_status: result.photoReviewStatus,
            originalPhotos: result.originalPhotos,
            historicalMuseumPhotos: result.historicalMuseumPhotos,
            hasMultipleOriginals: (result.originalPhotos || []).length > 1,
            hasHistoricalMuseum: (result.historicalMuseumPhotos || []).length > 0,
            totalPhotoCount: (item.currentMuseumPhoto ? 1 : 0) + (result.originalPhotos || []).length + (result.historicalMuseumPhotos || []).length
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
                Admin Curatorial Curation & Non-Destructive Review Utility
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
              { id: 'not_reviewed', label: 'Not Reviewed', count: filterCounts.not_reviewed },
              { id: 'reviewed', label: 'Reviewed', count: filterCounts.reviewed },
              { id: 'multiple_originals', label: 'Multiple Originals', count: filterCounts.multiple_originals },
              { id: 'has_historical', label: 'Has Historical Museum', count: filterCounts.has_historical }
            ].map(tab => (
              <button
                key={tab.id}
                className={`btn-outline ${activeFilter === tab.id ? 'btn-green' : ''}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '14px',
                  fontWeight: activeFilter === tab.id ? 'bold' : 'normal'
                }}
                onClick={() => {
                  setActiveFilter(tab.id);
                  setCurrentIndex(0);
                }}
              >
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
                    <span>Total Photos: <strong>{currentItem.totalPhotoCount}</strong></span>
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

            {/* THREE PHOTO SECTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* 1. CURRENT MUSEUM PHOTO (PROTECTED) */}
              <div style={{ background: '#fff', borderRadius: '10px', border: '2px solid #10b981', padding: '1.25rem', boxShadow: '0 2px 4px rgba(16,185,129,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#059669', color: '#fff', fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Sparkles size={14} /> CURRENT MUSEUM PHOTO
                    </span>
                    <span style={{ fontSize: '0.84rem', color: '#065f46', fontWeight: 600 }}>
                      Active Catalog Presentation Image
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                    <ShieldCheck size={14} />
                    <span>Protected from deletion (Official Catalog Slot)</span>
                  </div>
                </div>

                {currentItem.currentMuseumPhoto ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
                    {/* Large Visual Thumbnail */}
                    <div 
                      style={{ width: '220px', height: '220px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #d1fae5', background: '#f9fafb', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => setPreviewPhoto({
                        url: currentItem.currentMuseumPhoto.url,
                        label: 'CURRENT MUSEUM PHOTO',
                        filename: currentItem.currentMuseumPhoto.url,
                        badgeColor: '#059669'
                      })}
                      title="Click to view full preview"
                    >
                      <CachedThumbnail
                        url={currentItem.currentMuseumPhoto.url}
                        alt="Current Museum Photo"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: '4px', padding: '3px 6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Eye size={12} /> Inspect
                      </div>
                    </div>

                    {/* Metadata & Curatorial Details */}
                    <div style={{ flex: 1, minWidth: '240px', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Storage Path / URL:</span>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#111827', background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', wordBreak: 'break-all', marginTop: '2px' }}>
                          {currentItem.currentMuseumPhoto.url}
                        </div>
                      </div>

                      {currentItem.currentMuseumPhoto.thumbUrl && currentItem.currentMuseumPhoto.thumbUrl !== currentItem.currentMuseumPhoto.url && (
                        <div>
                          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Thumbnail URL:</span>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#4b5563', background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', wordBreak: 'break-all', marginTop: '2px' }}>
                            {currentItem.currentMuseumPhoto.thumbUrl}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '4px', fontSize: '0.8rem', color: '#4b5563' }}>
                        {currentItem.currentMuseumPhoto.updatedAt && (
                          <span>Updated: <strong>{new Date(currentItem.currentMuseumPhoto.updatedAt).toLocaleString()}</strong></span>
                        )}
                        {currentItem.currentMuseumPhoto.updatedBy && (
                          <span>By: <strong>{currentItem.currentMuseumPhoto.updatedBy}</strong></span>
                        )}
                      </div>

                      <div style={{ marginTop: '0.5rem', padding: '8px 12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.78rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Lock size={14} />
                        <span>This museum image is the verified presentation photo and cannot be deleted via cleanup.</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                    No museum photo recorded for this item.
                  </div>
                )}
              </div>

              {/* 2. ORIGINAL PHOTOGRAPHS */}
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Camera size={14} /> ORIGINAL PHOTOGRAPHS
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1f2937' }}>
                      {currentItem.originalPhotos?.length || 0} Original Estate {currentItem.originalPhotos?.length === 1 ? 'Photo' : 'Photos'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                    Immutable estate documentation records from <code style={{ fontSize: '0.78rem' }}>item_photos</code>
                  </span>
                </div>

                {currentItem.originalPhotos && currentItem.originalPhotos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {currentItem.originalPhotos.map((photo, pIdx) => {
                      const isMarked = markedOriginalIds.has(photo.id);
                      const isPrimary = photo.is_primary === 1 || pIdx === 0;
                      const isOnlyOriginal = currentItem.originalPhotos.length === 1;

                      return (
                        <div 
                          key={photo.id}
                          style={{
                            border: isMarked ? '2px dashed #ef4444' : '1px solid #e5e7eb',
                            background: isMarked ? '#fef2f2' : '#fafafa',
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Photo Header & Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span 
                              style={{ 
                                fontSize: '0.72rem', 
                                fontWeight: 'bold', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                background: isPrimary ? '#dcfce7' : '#e0f2fe',
                                color: isPrimary ? '#166534' : '#075985',
                                border: isPrimary ? '1px solid #86efac' : '1px solid #7dd3fc'
                              }}
                            >
                              {isPrimary ? 'PRIMARY ORIGINAL' : `ADDITIONAL ORIGINAL #${pIdx + 1}`}
                            </span>

                            {isMarked ? (
                              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                MARKED FOR DELETION
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                                Order: {photo.display_order}
                              </span>
                            )}
                          </div>

                          {/* Image Box (Click to preview) */}
                          <div 
                            style={{ width: '100%', height: '180px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid #e5e7eb', cursor: 'pointer', position: 'relative' }}
                            onClick={() => setPreviewPhoto({
                              url: photo.photo_url,
                              label: isPrimary ? 'PRIMARY ORIGINAL' : `ADDITIONAL ORIGINAL #${pIdx + 1}`,
                              filename: photo.photo_url,
                              badgeColor: isPrimary ? '#166534' : '#075985'
                            })}
                            title="Click for full-screen preview"
                          >
                            <CachedThumbnail
                              url={photo.thumbnail_url || photo.photo_url}
                              alt={currentItem.title}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                            <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '4px', padding: '2px 5px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Eye size={12} /> Inspect
                            </div>
                          </div>

                          {/* Filename & Info */}
                          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={photo.photo_url}>
                            {photo.photo_url}
                          </div>

                          {/* Action Buttons: Keep vs Mark for Deletion */}
                          <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                            {isOnlyOriginal ? (
                              <button
                                disabled
                                style={{
                                  width: '100%',
                                  padding: '5px',
                                  fontSize: '0.76rem',
                                  borderRadius: '6px',
                                  border: '1px solid #d1d5db',
                                  background: '#f3f4f6',
                                  color: '#6b7280',
                                  cursor: 'not-allowed',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '5px'
                                }}
                                title="An item must retain at least one original photograph."
                              >
                                <Lock size={12} /> Keep (Only Original)
                              </button>
                            ) : isMarked ? (
                              <button
                                onClick={() => toggleMarkOriginal(photo.id)}
                                style={{
                                  width: '100%',
                                  padding: '5px',
                                  fontSize: '0.78rem',
                                  fontWeight: 'bold',
                                  borderRadius: '6px',
                                  border: '1px solid #22c55e',
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '5px'
                                }}
                              >
                                <RotateCcw size={14} /> Undo Deletion Mark
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleMarkOriginal(photo.id)}
                                className="btn-outline"
                                style={{
                                  width: '100%',
                                  padding: '5px',
                                  fontSize: '0.78rem',
                                  borderRadius: '6px',
                                  color: '#b91c1c',
                                  borderColor: '#fca5a5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '5px'
                                }}
                              >
                                <Trash2 size={13} /> Mark for Deletion
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#dc2626', fontStyle: 'italic' }}>
                    ⚠️ No original photographs found in item_photos for this item.
                  </div>
                )}
              </div>

              {/* 3. HISTORICAL MUSEUM PHOTOS */}
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#8b5cf6', color: '#fff', fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Images size={14} /> HISTORICAL MUSEUM PHOTOS
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1f2937' }}>
                      {currentItem.historicalMuseumPhotos?.length || 0} Superseded Museum {currentItem.historicalMuseumPhotos?.length === 1 ? 'Image' : 'Images'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                    Reliably mapped via <code style={{ fontSize: '0.78rem' }}>museum-{currentItem.id}-*</code>
                  </span>
                </div>

                {currentItem.historicalMuseumPhotos && currentItem.historicalMuseumPhotos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {currentItem.historicalMuseumPhotos.map((hist, hIdx) => {
                      const isMarked = markedHistoricalFilenames.has(hist.filename);

                      return (
                        <div
                          key={hist.id || hist.filename}
                          style={{
                            border: isMarked ? '2px dashed #ef4444' : '1px solid #e5e7eb',
                            background: isMarked ? '#fef2f2' : '#fafafa',
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                              HISTORICAL MUSEUM #{hIdx + 1}
                            </span>
                            {isMarked && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                MARKED FOR DELETION
                              </span>
                            )}
                          </div>

                          {/* Image Box */}
                          <div 
                            style={{ width: '100%', height: '180px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid #e5e7eb', cursor: 'pointer', position: 'relative' }}
                            onClick={() => setPreviewPhoto({
                              url: hist.photo_url,
                              label: `HISTORICAL MUSEUM #${hIdx + 1}`,
                              filename: hist.filename,
                              badgeColor: '#6d28d9'
                            })}
                            title="Click for full-screen preview"
                          >
                            <CachedThumbnail
                              url={hist.thumbnail_url || hist.photo_url}
                              alt="Historical Museum Photo"
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                            <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '4px', padding: '2px 5px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Eye size={12} /> Inspect
                            </div>
                          </div>

                          {/* Info */}
                          <div style={{ fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontFamily: 'monospace', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hist.filename}>
                              {hist.filename}
                            </div>
                            <div style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                              Date: {new Date(hist.timestamp).toLocaleDateString()} {new Date(hist.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {hist.sizeBytes ? ` • ${(hist.sizeBytes / 1024).toFixed(0)} KB` : ''}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                            {isMarked ? (
                              <button
                                onClick={() => toggleMarkHistorical(hist.filename)}
                                style={{
                                  width: '100%',
                                  padding: '5px',
                                  fontSize: '0.78rem',
                                  fontWeight: 'bold',
                                  borderRadius: '6px',
                                  border: '1px solid #22c55e',
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '5px'
                                }}
                              >
                                <RotateCcw size={14} /> Undo Deletion Mark
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleMarkHistorical(hist.filename)}
                                className="btn-outline"
                                style={{
                                  width: '100%',
                                  padding: '5px',
                                  fontSize: '0.78rem',
                                  borderRadius: '6px',
                                  color: '#b91c1c',
                                  borderColor: '#fca5a5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '5px'
                                }}
                              >
                                <Trash2 size={13} /> Mark for Deletion
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '1.25rem', textAlign: 'center', color: '#6b7280', fontStyle: 'italic', background: '#f9fafb', borderRadius: '6px', border: '1px dashed #e5e7eb', fontSize: '0.84rem' }}>
                    No superseded or historical museum photos found for this item.
                  </div>
                )}
              </div>

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
            {markedOriginalIds.size > 0 || markedHistoricalFilenames.size > 0 ? (
              <span style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={15} />
                {markedOriginalIds.size + markedHistoricalFilenames.size} {markedOriginalIds.size + markedHistoricalFilenames.size === 1 ? 'photo' : 'photos'} marked for deletion
              </span>
            ) : (
              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={15} /> All photos marked to KEEP
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
              background: (markedOriginalIds.size > 0 || markedHistoricalFilenames.size > 0) ? '#dc2626' : 'var(--pine-primary)',
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
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '540px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '0.85rem' }}>
              <div style={{ background: '#fee2e2', borderRadius: '50%', padding: '8px' }}>
                <Trash2 size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>
                Confirm Photo Deletions
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#374151', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
              You are about to permanently delete <strong>{markedOriginalIds.size + markedHistoricalFilenames.size}</strong> photograph(s) from <strong>{currentItem.item_number} — {currentItem.title}</strong>:
            </p>

            {/* List of items to delete */}
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
                  </div>
                );
              })}

              {Array.from(markedHistoricalFilenames).map(filename => (
                <div key={filename} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '4px 6px', background: '#fff', borderRadius: '4px', border: '1px solid #fecaca' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 'bold', background: '#ede9fe', color: '#6d28d9', padding: '2px 4px', borderRadius: '3px' }}>
                    HISTORICAL MUSEUM
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {filename}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem', color: '#991b1b', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              <strong>Safety Note:</strong> Database references will be removed and unreferenced physical image files will be deleted from disk storage. The Current Museum Photo and remaining original photo(s) are strictly protected.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn-outline"
                disabled={submittingReview}
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: '0.45rem 1rem', fontSize: '0.86rem' }}
              >
                Cancel / Keep All
              </button>

              <button
                disabled={submittingReview}
                onClick={() => commitReviewDecisions(Array.from(markedOriginalIds), Array.from(markedHistoricalFilenames))}
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
                    <Trash2 size={14} /> Confirm & Delete ({markedOriginalIds.size + markedHistoricalFilenames.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-RES PREVIEW MODAL */}
      {previewPhoto && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
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
