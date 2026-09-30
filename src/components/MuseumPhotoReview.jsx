import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ArrowLeft, ArrowRight, Save, Check, AlertCircle, 
  Upload, Camera, Copy, Download, Trash2, Edit3, 
  Sparkles, CheckCircle2, X, RefreshCw, Loader2,
  Image as ImageIcon, HelpCircle, Layers, ArrowUpRight
} from 'lucide-react';

/**
 * Format Estimated Value from item fields
 */
export function formatEstimatedValue(item) {
  if (!item) return 'Value not estimated';
  if (item.value && String(item.value).trim() !== '') {
    const val = String(item.value).trim();
    return val.startsWith('$') ? val : `$${val}`;
  }
  if (item.estimated_value_low != null && item.estimated_value_high != null) {
    return `$${item.estimated_value_low}–$${item.estimated_value_high}`;
  }
  if (item.estimated_value_low != null) {
    return `$${item.estimated_value_low}`;
  }
  return 'Value not estimated';
}

/**
 * Helper to copy image to clipboard as PNG
 */
async function copyImageToClipboard(imageUrl) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image for copying'));
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not convert image to PNG blob');

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch (err) {
    console.error('Clipboard copy error:', err);
    throw err;
  }
}

/**
 * Helper to download an image file
 */
async function triggerImageDownload(imageUrl, filename = 'photo.webp') {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Download error:', err);
    window.open(imageUrl, '_blank');
  }
}

export default function MuseumPhotoReview({
  items = [],
  categories = [],
  currentUser,
  onUpdateItem,
  onEditItem,
  onClose
}) {
  const [filterMode, setFilterMode] = useState('needs_photo'); // 'needs_photo' | 'completed' | 'all'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stagedPhoto, setStagedPhoto] = useState(null); // { file?: File, dataUrl: string } | null
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null); // { type: 'success' | 'error' | 'info', message: string }
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  const showToast = (message, type = 'success') => {
    setFeedbackToast({ message, type });
  };

  // Filtered items list
  const filteredItems = useMemo(() => {
    if (filterMode === 'needs_photo') {
      return items.filter(it => !it.museum_photo_url);
    }
    if (filterMode === 'completed') {
      return items.filter(it => !!it.museum_photo_url);
    }
    return items;
  }, [items, filterMode]);

  // Overall counts for progress bar & tabs
  const countCompleted = useMemo(() => items.filter(it => !!it.museum_photo_url).length, [items]);
  const countNeeds = useMemo(() => items.filter(it => !it.museum_photo_url).length, [items]);
  const percentCompleted = items.length > 0 ? Math.round((countCompleted / items.length) * 100) : 0;

  // Active current item
  const currentItem = filteredItems[currentIndex] || null;

  // Clear staged photo whenever active item changes
  useEffect(() => {
    setStagedPhoto(null);
  }, [currentItem?.id]);

  // Ensure currentIndex stays within bounds when list length changes
  useEffect(() => {
    if (filteredItems.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= filteredItems.length) {
      setCurrentIndex(filteredItems.length - 1);
    }
  }, [filteredItems.length, currentIndex]);

  // Handle file staging from File object
  const stageFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setStagedPhoto({
        file,
        dataUrl: e.target.result
      });
      showToast('Image staged! Review the preview and click Save or Save & Next.', 'info');
    };
    reader.readAsDataURL(file);
  }, []);

  // Global Paste Listener (Ctrl+V anywhere on this review screen)
  useEffect(() => {
    const handlePaste = (e) => {
      // Don't intercept paste if user is typing in an input or textarea
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            stageFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [stageFile]);

  // Keyboard navigation (Left / Right arrows when not typing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredItems.length, stagedPhoto]);

  const handlePrevious = () => {
    if (stagedPhoto) {
      if (!window.confirm('You have an unsaved staged photo. Discard it and go to the previous item?')) {
        return;
      }
      setStagedPhoto(null);
    }
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (stagedPhoto) {
      if (!window.confirm('You have an unsaved staged photo. Discard it and go to the next item?')) {
        return;
      }
      setStagedPhoto(null);
    }
    if (currentIndex < filteredItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Upload/Save staged photo
  const handleSave = async (andNext = false) => {
    if (!currentItem || !stagedPhoto) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/items/${currentItem.id}/museum-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64: stagedPhoto.dataUrl
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save museum photo');
      }

      if (onUpdateItem && data.item) {
        onUpdateItem(data.item);
      }

      setStagedPhoto(null);

      if (andNext) {
        // Advance to the next item that does not yet have a museum photo
        // Look ahead in all items for the next item without a museum photo
        const allItems = items.map(it => it.id === data.item.id ? data.item : it);
        const currentAllIdx = allItems.findIndex(it => it.id === currentItem.id);
        
        let nextIncompleteItem = null;
        // Search forwards from current item
        for (let i = currentAllIdx + 1; i < allItems.length; i++) {
          if (!allItems[i].museum_photo_url) {
            nextIncompleteItem = allItems[i];
            break;
          }
        }
        // If not found after, wrap around to beginning
        if (!nextIncompleteItem) {
          for (let i = 0; i < currentAllIdx; i++) {
            if (!allItems[i].museum_photo_url) {
              nextIncompleteItem = allItems[i];
              break;
            }
          }
        }

        if (nextIncompleteItem) {
          showToast('Museum photo saved! Jumped to next item.', 'success');
          // If we are currently in 'needs_photo' filter mode, recalculate index
          if (filterMode === 'needs_photo') {
            const nextFilteredList = allItems.filter(it => !it.museum_photo_url);
            const nextIdx = nextFilteredList.findIndex(it => it.id === nextIncompleteItem.id);
            setCurrentIndex(nextIdx !== -1 ? nextIdx : 0);
          } else {
            const nextIdx = filteredItems.findIndex(it => it.id === nextIncompleteItem.id);
            if (nextIdx !== -1) {
              setCurrentIndex(nextIdx);
            } else {
              setFilterMode('needs_photo');
              setCurrentIndex(0);
            }
          }
        } else {
          showToast('Museum photo saved! All items now have museum photos! 🎉', 'success');
        }
      } else {
        showToast('Museum photo saved successfully!', 'success');
      }
    } catch (err) {
      console.error('Save museum photo error:', err);
      showToast('Error saving museum photo: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Discard staged photo without altering saved database photo
  const handleCancelStaging = () => {
    setStagedPhoto(null);
    showToast('Staged changes discarded. Existing saved photo preserved.', 'info');
  };

  // Remove saved museum photo from DB
  const handleDeleteSavedPhoto = async () => {
    if (!currentItem || !currentItem.museum_photo_url) return;
    if (!window.confirm(`Are you sure you want to remove the museum photo for "${currentItem.title}"?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/items/${currentItem.id}/museum-photo`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove museum photo');
      }
      if (onUpdateItem && data.item) {
        onUpdateItem(data.item);
      }
      showToast('Museum photo removed.', 'info');
    } catch (err) {
      console.error('Delete museum photo error:', err);
      showToast('Error removing museum photo: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy button handlers
  const handleCopyOriginal = async () => {
    const photoUrl = currentItem?.primary_photo || currentItem?.photos?.[0]?.photo_url;
    if (!photoUrl) {
      showToast('No original photo available to copy.', 'error');
      return;
    }
    try {
      await copyImageToClipboard(photoUrl);
      showToast('Original photo copied to clipboard! Paste into your background remover (Ctrl+V).', 'success');
    } catch (err) {
      showToast('Could not copy image to clipboard: ' + err.message, 'error');
    }
  };

  const handleCopyMuseum = async () => {
    const photoUrl = stagedPhoto?.dataUrl || currentItem?.museum_photo_url;
    if (!photoUrl) {
      showToast('No museum photo available to copy.', 'error');
      return;
    }
    try {
      await copyImageToClipboard(photoUrl);
      showToast('Museum photo copied to clipboard!', 'success');
    } catch (err) {
      showToast('Could not copy image to clipboard: ' + err.message, 'error');
    }
  };

  // Download button handlers
  const handleDownloadOriginal = () => {
    const photoUrl = currentItem?.primary_photo || currentItem?.photos?.[0]?.photo_url;
    if (!photoUrl) return;
    const cleanTitle = (currentItem.title || 'original-photo').replace(/[^a-zA-Z0-9_-]/g, '_');
    triggerImageDownload(photoUrl, `original_${cleanTitle}.webp`);
  };

  const handleDownloadMuseum = () => {
    const photoUrl = currentItem?.museum_photo_url;
    if (!photoUrl) return;
    const cleanTitle = (currentItem.title || 'museum-photo').replace(/[^a-zA-Z0-9_-]/g, '_');
    triggerImageDownload(photoUrl, `museum_${cleanTitle}.webp`);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      stageFile(files[0]);
    }
  };

  // Empty state when filtered list has 0 items
  if (!currentItem && filteredItems.length === 0) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: 'var(--gold-accent)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                Admin Curatorial Studio
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--pine-deep)', margin: 0 }}>
              Museum Photo Review
            </h1>
          </div>
          <button className="btn-outline" onClick={onClose}>
            ← Back to Dashboard
          </button>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <button
            className={`btn-outline ${filterMode === 'needs_photo' ? 'active' : ''}`}
            style={{ borderRadius: '20px', padding: '6px 16px', background: filterMode === 'needs_photo' ? 'var(--pine-primary)' : '#fff', color: filterMode === 'needs_photo' ? '#fff' : 'inherit' }}
            onClick={() => { setFilterMode('needs_photo'); setCurrentIndex(0); }}
          >
            Needs Museum Photo ({countNeeds})
          </button>
          <button
            className={`btn-outline ${filterMode === 'completed' ? 'active' : ''}`}
            style={{ borderRadius: '20px', padding: '6px 16px', background: filterMode === 'completed' ? 'var(--pine-primary)' : '#fff', color: filterMode === 'completed' ? '#fff' : 'inherit' }}
            onClick={() => { setFilterMode('completed'); setCurrentIndex(0); }}
          >
            Completed ({countCompleted})
          </button>
          <button
            className={`btn-outline ${filterMode === 'all' ? 'active' : ''}`}
            style={{ borderRadius: '20px', padding: '6px 16px', background: filterMode === 'all' ? 'var(--pine-primary)' : '#fff', color: filterMode === 'all' ? '#fff' : 'inherit' }}
            onClick={() => { setFilterMode('all'); setCurrentIndex(0); }}
          >
            All Items ({items.length})
          </button>
        </div>

        <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <CheckCircle2 size={48} color="#166534" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', marginBottom: '0.5rem' }}>
            {filterMode === 'needs_photo' ? 'All Items Have Museum Photos!' : 'No items match this filter'}
          </h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            {filterMode === 'needs_photo'
              ? 'Great work! Every inventory item has been paired with an isolated museum photograph.'
              : 'Try selecting a different filter above to review items.'}
          </p>
          <button
            className="btn-green"
            onClick={() => { setFilterMode('all'); setCurrentIndex(0); }}
          >
            View All Items ({items.length})
          </button>
        </div>
      </div>
    );
  }

  const originalPhotoUrl = currentItem?.primary_photo || currentItem?.photos?.[0]?.photo_url;
  const originalThumbUrl = currentItem?.primary_thumb || originalPhotoUrl;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1rem 1.25rem 4rem' }}>
      {/* Toast Notification */}
      {feedbackToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          background: feedbackToast.type === 'error' ? '#fee2e2' : feedbackToast.type === 'info' ? '#eff6ff' : '#dcfce7',
          color: feedbackToast.type === 'error' ? '#991b1b' : feedbackToast.type === 'info' ? '#1e40af' : '#166534',
          border: `1px solid ${feedbackToast.type === 'error' ? '#f87171' : feedbackToast.type === 'info' ? '#93c5fd' : '#86efac'}`,
          fontWeight: 500,
          fontSize: '0.9rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {feedbackToast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedbackToast.message}</span>
          <button
            onClick={() => setFeedbackToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '6px', color: 'inherit' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* TOP HEADER & CONTROLS */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1rem 1.5rem', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        {/* Row 1: Studio Badge & Home button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--gold-accent)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
              Admin Studio
            </span>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: 'var(--pine-deep)', margin: 0, fontWeight: 700 }}>
              Museum Photo Review
            </h1>
          </div>

          <button className="btn-outline" onClick={onClose} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
            ← Exit to Dashboard
          </button>
        </div>

        {/* Row 2: Navigation (Previous | Item X of Y | Next) + Progress + Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
          {/* Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn-outline"
              onClick={handlePrevious}
              disabled={currentIndex <= 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', opacity: currentIndex <= 0 ? 0.4 : 1 }}
              title="Previous Item (Left Arrow)"
            >
              <ArrowLeft size={16} /> Previous Item
            </button>

            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--pine-deep)', padding: '0 4px', whiteSpace: 'nowrap' }}>
              Item <span style={{ color: 'var(--gold-accent)', fontWeight: 700 }}>{filteredItems.length > 0 ? currentIndex + 1 : 0}</span> of {filteredItems.length}
            </span>

            <button
              className="btn-outline"
              onClick={handleNext}
              disabled={currentIndex >= filteredItems.length - 1}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', opacity: currentIndex >= filteredItems.length - 1 ? 0.4 : 1 }}
              title="Next Item (Right Arrow)"
            >
              Next Item <ArrowRight size={16} />
            </button>
          </div>

          {/* Progress Indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              <span>Museum Photos:</span>
              <span style={{ color: 'var(--pine-deep)' }}>
                {countCompleted} of {items.length} completed ({percentCompleted}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${percentCompleted}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '3px', borderRadius: '24px' }}>
            <button
              style={{
                border: 'none',
                background: filterMode === 'needs_photo' ? 'var(--pine-primary)' : 'transparent',
                color: filterMode === 'needs_photo' ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '5px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                if (stagedPhoto && !window.confirm('Discard unsaved staged photo?')) return;
                setFilterMode('needs_photo');
                setCurrentIndex(0);
              }}
            >
              Needs Museum Photo ({countNeeds})
            </button>

            <button
              style={{
                border: 'none',
                background: filterMode === 'completed' ? 'var(--pine-primary)' : 'transparent',
                color: filterMode === 'completed' ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '5px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                if (stagedPhoto && !window.confirm('Discard unsaved staged photo?')) return;
                setFilterMode('completed');
                setCurrentIndex(0);
              }}
            >
              Completed ({countCompleted})
            </button>

            <button
              style={{
                border: 'none',
                background: filterMode === 'all' ? 'var(--pine-primary)' : 'transparent',
                color: filterMode === 'all' ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '5px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                if (stagedPhoto && !window.confirm('Discard unsaved staged photo?')) return;
                setFilterMode('all');
                setCurrentIndex(0);
              }}
            >
              All ({items.length})
            </button>
          </div>
        </div>
      </div>

      {/* ITEM TITLE & METADATA BAR */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#e0e7ff', color: '#3730a3', padding: '3px 10px', borderRadius: '12px' }}>
              {currentItem.category_name || 'Uncategorized'}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
              Item #{currentItem.item_number || currentItem.id}
            </span>
            {currentItem.museum_photo_url && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '3px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={13} /> Museum Photo Added
              </span>
            )}
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--pine-deep)', margin: 0, fontWeight: 700 }}>
            {currentItem.title || 'Untitled Item'}
          </h2>
        </div>

        {onEditItem && (
          <button
            className="btn-outline"
            onClick={() => onEditItem(currentItem)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px' }}
          >
            <Edit3 size={16} /> Edit Item Details
          </button>
        )}
      </div>

      {/* THREE-COLUMN WORKSPACE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.5rem',
        alignItems: 'start'
      }}>
        {/* COLUMN 1: ORIGINAL PHOTO */}
        <div className="card" style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Original Photo
            </span>
            {currentItem.photos && currentItem.photos.length > 1 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                {currentItem.photos.length} photos
              </span>
            )}
          </div>

          {/* Photo Display Card */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            aspectRatio: '4/3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '1rem'
          }}>
            {originalPhotoUrl ? (
              <img
                src={originalPhotoUrl}
                alt={currentItem.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                <ImageIcon size={48} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>No original photo available</p>
              </div>
            )}
          </div>

          {/* Column 1 Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: 'auto' }}>
            <button
              className="btn-outline"
              onClick={handleCopyOriginal}
              disabled={!originalPhotoUrl}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
              title="Copy photo to clipboard (for pasting in background remover)"
            >
              <Copy size={15} /> Copy Original
            </button>

            <button
              className="btn-outline"
              onClick={handleDownloadOriginal}
              disabled={!originalPhotoUrl}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
              title="Download original full-resolution photo"
            >
              <Download size={15} /> Download
            </button>
          </div>
        </div>

        {/* COLUMN 2: ITEM INFO (DESCRIPTION + STRUCTURED ATTRIBUTES) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
          {/* DESCRIPTION CARD */}
          <div className="card" style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Description
            </span>
            <div style={{
              fontSize: '0.95rem',
              lineHeight: 1.6,
              color: 'var(--text-dark)',
              maxHeight: '220px',
              overflowY: 'auto',
              background: '#f8fafc',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid #f1f5f9'
            }}>
              {currentItem.description || currentItem.special_handling_notes || (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No description provided for this item.
                </span>
              )}
            </div>
          </div>

          {/* STRUCTURED ATTRIBUTES CARD */}
          <div className="card" style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', flex: 1 }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Structured Attributes
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Material</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', fontWeight: 500, textAlign: 'right' }}>
                  {currentItem.materials || currentItem.material || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Origin</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', fontWeight: 500, textAlign: 'right' }}>
                  {currentItem.origin || currentItem.geographic_origin || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Age</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', fontWeight: 500, textAlign: 'right' }}>
                  {currentItem.era || currentItem.age || currentItem.approximate_date || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dimensions</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', fontWeight: 500, textAlign: 'right' }}>
                  {currentItem.dimensions || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                <span style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 700 }}>Estimated Value</span>
                <span style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 700, textAlign: 'right' }}>
                  {formatEstimatedValue(currentItem)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Condition</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', fontWeight: 500, textAlign: 'right' }}>
                  {currentItem.condition || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: MUSEUM PHOTO (UPLOAD / PREVIEW / ACTION) */}
        <div className="card" style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold-accent)' }}>
                Museum Photo
              </span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Isolated object on clean background
              </span>
            </div>

            {/* Status Pill */}
            {stagedPhoto ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '10px' }}>
                Staged (Unsaved)
              </span>
            ) : currentItem.museum_photo_url ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Check size={12} /> Added
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                Not Added
              </span>
            )}
          </div>

          {/* Hidden File Input for browsing */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                stageFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          {/* STATE A: STAGED PHOTO PREVIEW (UNSAVED) */}
          {stagedPhoto ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                border: '2px dashed #f59e0b',
                overflow: 'hidden',
                aspectRatio: '4/3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: '0.75rem'
              }}>
                <img
                  src={stagedPhoto.dataUrl}
                  alt="Staged Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }}
                />
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  Unsaved Preview
                </div>
              </div>

              {/* Informational Staging Warning */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 12px', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
                <strong>⚠️ Staged preview:</strong> Existing photo is unchanged until you click Save. Click Cancel to discard.
              </div>

              {/* Staged Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
                <button
                  className="btn-green"
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', fontWeight: 600 }}
                  title="Save museum photo and jump to next item needing one"
                >
                  {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                  <span>Save & Next</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    className="btn-outline"
                    onClick={() => handleSave(false)}
                    disabled={isSaving}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    {isSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save
                  </button>

                  <button
                    className="btn-outline"
                    onClick={handleCancelStaging}
                    disabled={isSaving}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', color: '#dc2626' }}
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : currentItem.museum_photo_url ? (
            /* STATE B: EXISTING SAVED MUSEUM PHOTO */
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                aspectRatio: '4/3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: '1rem',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.02)'
              }}>
                <img
                  src={currentItem.museum_photo_url}
                  alt="Saved Museum View"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'rgba(22, 101, 52, 0.9)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Check size={11} /> Museum Spec
                </div>
              </div>

              {/* Action Buttons for Existing Museum Photo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
                <button
                  className="btn-green"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <RefreshCw size={15} /> Replace Museum Photo
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    className="btn-outline"
                    onClick={handleCopyMuseum}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
                    title="Copy museum photo to clipboard"
                  >
                    <Copy size={14} /> Copy
                  </button>

                  <button
                    className="btn-outline"
                    onClick={handleDownloadMuseum}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
                    title="Download museum photo"
                  >
                    <Download size={14} /> Download
                  </button>
                </div>

                <button
                  className="btn-outline"
                  onClick={handleDeleteSavedPhoto}
                  disabled={isDeleting}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', color: '#dc2626', border: '1px solid #fecaca' }}
                >
                  {isDeleting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Remove Photo
                </button>
              </div>
            </div>
          ) : (
            /* STATE C: EMPTY DROP & PASTE ZONE */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                minHeight: '260px',
                border: `2px dashed ${isDragging ? 'var(--pine-primary)' : '#cbd5e1'}`,
                background: isDragging ? '#f0fdf4' : '#f8fafc',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem 1.5rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: isDragging ? '#dcfce7' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: isDragging ? 'var(--pine-primary)' : 'var(--text-muted)'
              }}>
                <Upload size={26} />
              </div>

              <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
                Paste, Drop, or Upload Museum Photo
              </h4>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem', maxWidth: '260px' }}>
                Press <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Ctrl+V</kbd> anywhere, or drag an isolated photo file here
              </p>

              <button
                className="btn-outline"
                type="button"
                style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '6px', pointerEvents: 'none' }}
              >
                Browse Files...
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM INFORMATIONAL BANNER: 4 STEPS TO CREATE A MUSEUM PHOTO */}
      <div className="card" style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.5rem 1.75rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Sparkles size={20} color="var(--gold-accent)" />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--pine-deep)', margin: 0, fontWeight: 700 }}>
            ✦ How to create a museum photo
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--pine-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
              1
            </div>
            <div>
              <h5 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--pine-deep)', fontWeight: 600 }}>
                Copy or Download Original
              </h5>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Click <strong>Copy Original</strong> or <strong>Download</strong> on the left column to extract the raw photo.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--pine-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
              2
            </div>
            <div>
              <h5 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--pine-deep)', fontWeight: 600 }}>
                Remove Background
              </h5>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Use Photoroom, remove.bg, Photoshop, or Apple Photos cutout to cleanly isolate the object.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--pine-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
              3
            </div>
            <div>
              <h5 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--pine-deep)', fontWeight: 600 }}>
                Paste or Drop Here
              </h5>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Press <strong>Ctrl+V</strong> anywhere on this screen, or drag and drop the cutout into the Museum Photo box.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--pine-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
              4
            </div>
            <div>
              <h5 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--pine-deep)', fontWeight: 600 }}>
                Click Save & Next
              </h5>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Review the staged preview, then click <strong>Save & Next</strong> to advance directly to the next pending item.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
