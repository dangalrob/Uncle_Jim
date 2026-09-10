import React, { useState, useEffect, useCallback } from 'react';
import CachedThumbnail from './CachedThumbnail';
import { 
  ArrowLeft, ArrowRight, Save, Check, AlertCircle, 
  ExternalLink, ZoomIn, Sparkles, X, ChevronLeft, ChevronRight 
} from 'lucide-react';

/**
 * AdminReviewMode Component
 * Optimized for laptops over tethered connections:
 * - Displays cached thumbnails with zero repeated network downloads
 * - Clean structured fields for cleaning Google-generated assessments
 * - Previous, Save, Save & Next, and Next workflows with keyboard shortcuts
 */
export default function AdminReviewMode({
  items = [],
  categories = [],
  onSaveItem,
  onClose,
  initialItemId = null
}) {
  const [filterMode, setFilterMode] = useState('all');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showFullPhotoModal, setShowFullPhotoModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const [isDirty, setIsDirty] = useState(false);

  // Filtered items list
  const filteredItems = React.useMemo(() => {
    switch (filterMode) {
      case 'unreleased':
        return items.filter(i => i.status !== 'released');
      case 'missing_value':
        return items.filter(i => !i.value || i.value.trim() === '');
      case 'missing_era':
        return items.filter(i => !i.era || i.era.trim() === '');
      default:
        return items;
    }
  }, [items, filterMode]);

  // Current item index in filtered list
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialItemId) {
      const idx = filteredItems.findIndex(i => i.id === initialItemId);
      if (idx !== -1) return idx;
    }
    return 0;
  });

  const currentItem = filteredItems[currentIndex] || filteredItems[0] || null;

  // Structured field form state
  const [formData, setFormData] = useState({
    title: '',
    categoryId: '',
    value: '',
    era: '',
    locationInHouse: '',
    condition: '',
    dimensions: '',
    weight: '',
    description: '',
    institutionalCandidate: 'None',
    institutionalName: '',
    status: 'draft'
  });

  // Populate form when current item changes
  useEffect(() => {
    if (currentItem) {
      setFormData({
        title: currentItem.title || '',
        categoryId: currentItem.category_id || '',
        value: currentItem.value || '',
        era: currentItem.era || '',
        locationInHouse: currentItem.location_in_house || '',
        condition: currentItem.condition || '',
        dimensions: currentItem.dimensions || '',
        weight: currentItem.weight || '',
        description: currentItem.description || '',
        institutionalCandidate: currentItem.institutional_candidate || currentItem.institutionalCandidate || 'None',
        institutionalName: currentItem.institutional_name || currentItem.institutionalName || '',
        status: currentItem.status || 'draft'
      });
      setActivePhotoIdx(0);
      setIsDirty(false);
      setSaveStatus(null);
    }
  }, [currentItem?.id]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveStatus(null);
  };

  // Save current item
  const handleSave = async (advanceNext = false) => {
    if (!currentItem) return;
    setSaveStatus('saving');

    try {
      await onSaveItem(currentItem.id, {
        title: formData.title,
        categoryId: formData.categoryId,
        value: formData.value,
        era: formData.era,
        locationInHouse: formData.locationInHouse,
        condition: formData.condition,
        dimensions: formData.dimensions,
        weight: formData.weight,
        description: formData.description,
        institutionalCandidate: formData.institutionalCandidate,
        institutionalName: formData.institutionalName,
        status: formData.status
      });

      setIsDirty(false);
      setSaveStatus('saved');

      if (advanceNext) {
        setTimeout(() => {
          handleNext(true);
        }, 150);
      } else {
        setTimeout(() => setSaveStatus(null), 2500);
      }
    } catch (err) {
      console.error("Failed to save review item:", err);
      setSaveStatus('error');
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = (force = false) => {
    if (currentIndex < filteredItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Keyboard shortcuts (Ctrl+S = Save, Ctrl+Enter = Save & Next, Alt+Left/Right = Navigate)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Save & Next
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave(true);
      }
      // Save
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
      // Alt + Arrow Left = Previous
      else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      }
      // Alt + Arrow Right = Next
      else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredItems.length, formData, currentItem]);

  if (!currentItem) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '12px' }}>
        <h3>No items match the selected filter.</h3>
        <button className="btn-outline" onClick={() => setFilterMode('all')} style={{ marginTop: '1rem' }}>
          Show All Items
        </button>
      </div>
    );
  }

  // Photos for current item
  const itemPhotos = currentItem.photos && currentItem.photos.length > 0
    ? currentItem.photos
    : (currentItem.primary_thumb || currentItem.primary_photo ? [{
        id: 'primary',
        thumbnail_url: currentItem.primary_thumb || currentItem.primary_photo,
        photo_url: currentItem.primary_photo || currentItem.primary_thumb,
        photo_version: currentItem.primary_thumb_version || '1'
      }] : []);

  const activePhoto = itemPhotos[activePhotoIdx] || itemPhotos[0] || null;
  const progressPercent = Math.round(((currentIndex + 1) / Math.max(1, filteredItems.length)) * 100);

  // Helper chip for extracting era from description if present
  const eraMatchInDesc = !formData.era && formData.description && formData.description.match(/(?:Era|Period|Age|circa|c\.)[:\s]+([^\n.,|]+)/i);
  const detectedEra = eraMatchInDesc ? eraMatchInDesc[1].trim() : null;

  // Helper chip for extracting value from description if present
  const valueMatchInDesc = !formData.value && formData.description && formData.description.match(/\$([0-9,]+(?:\s*-\s*\$[0-9,]+)?)/);
  const detectedValue = valueMatchInDesc ? `$${valueMatchInDesc[1].trim()}` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '650px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      {/* Top Header Bar */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: '#faf9f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-outline" onClick={onClose} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Back to Catalog
          </button>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--pine-primary)' }}>
              Laptop Review & Cleanup Mode
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Item {currentIndex + 1} of {filteredItems.length} ({progressPercent}%)
            </div>
          </div>
        </div>

        {/* Filter & Jump selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            value={filterMode}
            onChange={(e) => { setFilterMode(e.target.value); setCurrentIndex(0); }}
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff' }}
          >
            <option value="all">All Items ({items.length})</option>
            <option value="unreleased">Unreleased Items ({items.filter(i => i.status !== 'released').length})</option>
            <option value="missing_value">Missing Value ({items.filter(i => !i.value).length})</option>
            <option value="missing_era">Missing Era ({items.filter(i => !i.era).length})</option>
          </select>

          {/* Release toggle */}
          <button
            onClick={() => handleFieldChange('status', formData.status === 'released' ? 'draft' : 'released')}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: formData.status === 'released' ? '#e8f5e9' : '#fff3e0',
              color: formData.status === 'released' ? '#2e7d32' : '#e65100'
            }}
          >
            {formData.status === 'released' ? '✓ Catalog Released' : '⏳ Draft / Needs Review'}
          </button>
        </div>
      </div>

      {/* Progress Bar Line */}
      <div style={{ height: '3px', width: '100%', background: '#e0e0e0' }}>
        <div style={{ height: '100%', width: `${progressPercent}%`, background: 'var(--pine-primary)', transition: 'width 0.3s' }} />
      </div>

      {/* Main Review Workbench (Two Column) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Cached Thumbnail & Photos */}
        <div style={{ width: '42%', minWidth: '320px', maxWidth: '480px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '1.25rem', background: '#fafafa', overflowY: 'auto' }}>
          
          {/* Main Photo Preview */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0', backgroundColor: '#f5f5f0' }}>
            {activePhoto ? (
              <CachedThumbnail
                url={activePhoto.thumbnail_url || activePhoto.photo_url}
                version={activePhoto.photo_version || currentItem.primary_thumb_version}
                alt={formData.title}
                priority={true}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                No Photo Available
              </div>
            )}

            {/* View Full Resolution Button */}
            {activePhoto?.photo_url && (
              <button
                onClick={() => setShowFullPhotoModal(true)}
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 9px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Loads full camera resolution on demand"
              >
                <ZoomIn size={14} /> Full Res
              </button>
            )}
          </div>

          {/* Thumbnail Gallery (if multiple photos) */}
          {itemPhotos.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {itemPhotos.map((p, idx) => (
                <div
                  key={p.id || idx}
                  onClick={() => setActivePhotoIdx(idx)}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: activePhotoIdx === idx ? '2px solid var(--pine-primary)' : '1px solid #ccc',
                    flexShrink: 0
                  }}
                >
                  <CachedThumbnail
                    url={p.thumbnail_url || p.photo_url}
                    version={p.photo_version || '1'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Item Meta & Location Badge */}
          <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Location in Residence</div>
            <div style={{ fontWeight: 'bold', fontSize: '0.92rem', marginTop: '2px' }}>
              📍 {formData.locationInHouse || 'Location not recorded'}
            </div>
            {currentItem.item_number && (
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                Inventory Tag: <strong>#{currentItem.item_number}</strong>
              </div>
            )}
          </div>

          {/* Quick External Research Links */}
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Quick Visual Verification:</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent((formData.title || 'Estate item') + ' antique vintage identifier')}&tbm=isch`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.75rem', color: '#1a73e8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                Google Images <ExternalLink size={12} />
              </a>
              <span style={{ color: '#ccc' }}>•</span>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent((formData.title || 'Estate item') + ' maker history value')}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.75rem', color: '#1a73e8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                Web Search <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Editable Structured Fields */}
        <div style={{ flex: 1, padding: '1.25rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Title Field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', marginBottom: '4px' }}>
              Item Title / Identification *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="e.g. Hand-Carved Wooden Ship Wheel"
              style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>

          {/* Category, Value Range, Era Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            {/* Category */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleFieldChange('categoryId', e.target.value)}
                style={{ width: '100%', padding: '0.55rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #ccc', background: '#fff' }}
              >
                <option value="">-- Select Category --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon || '📦'} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Value / Range */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Estimated Value / Range
                </label>
                {detectedValue && (
                  <button
                    type="button"
                    onClick={() => handleFieldChange('value', detectedValue)}
                    style={{ fontSize: '0.7rem', color: '#1565c0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Copy {detectedValue}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => handleFieldChange('value', e.target.value)}
                placeholder="e.g. $150 - $250 or $300"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            {/* Age / Period / Era */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Age / Period / Era
                </label>
                {detectedEra && (
                  <button
                    type="button"
                    onClick={() => handleFieldChange('era', detectedEra)}
                    style={{ fontSize: '0.7rem', color: '#1565c0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Copy {detectedEra}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={formData.era}
                onChange={(e) => handleFieldChange('era', e.target.value)}
                placeholder="e.g. c. 1940s, Mid-Century, Victorian"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>
          </div>

          {/* Location, Condition, Dimensions Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Location in House
              </label>
              <input
                type="text"
                value={formData.locationInHouse}
                onChange={(e) => handleFieldChange('locationInHouse', e.target.value)}
                placeholder="e.g. Living Room Mantle, Workshop"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Condition
              </label>
              <select
                value={formData.condition}
                onChange={(e) => handleFieldChange('condition', e.target.value)}
                style={{ width: '100%', padding: '0.55rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #ccc', background: '#fff' }}
              >
                <option value="">Unspecified</option>
                <option value="Pristine / Mint">Pristine / Mint</option>
                <option value="Excellent">Excellent</option>
                <option value="Very Good">Very Good</option>
                <option value="Good (Minor Wear)">Good (Minor Wear)</option>
                <option value="Fair">Fair (Noticeable Wear)</option>
                <option value="Needs Repair / Restoration">Needs Repair</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Dimensions & Weight
              </label>
              <input
                type="text"
                value={formData.dimensions}
                onChange={(e) => handleFieldChange('dimensions', e.target.value)}
                placeholder="e.g. 24 x 18 in, 8 lbs"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>
          </div>

          {/* Description & Google Assessment Notes */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>
                Description & Historical Notes (Clean Extraneous AI Conversational Text)
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Keep genuine historical facts; remove chatbot introductory chatter
              </span>
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Verified item description, maker details, markings, and provenance notes..."
              rows={6}
              style={{
                width: '100%',
                flex: 1,
                minHeight: '130px',
                padding: '0.75rem',
                fontSize: '0.92rem',
                lineHeight: '1.45',
                borderRadius: '6px',
                border: '1px solid #ccc',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Institutional Candidate Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.65rem 0.85rem', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #eee' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>🏛️ Institutional Candidate?</span>
            <select
              value={formData.institutionalCandidate}
              onChange={(e) => handleFieldChange('institutionalCandidate', e.target.value)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="None">No (Family Only)</option>
              <option value="Recommended">Recommended for Museum</option>
              <option value="Requested">Requested by Museum</option>
            </select>
            {formData.institutionalCandidate !== 'None' && (
              <input
                type="text"
                value={formData.institutionalName}
                onChange={(e) => handleFieldChange('institutionalName', e.target.value)}
                placeholder="Target institution name (e.g. Manitowish Waters Historical Society)"
                style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            )}
          </div>

        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div style={{
        padding: '0.75rem 1.5rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#faf9f6'
      }}>
        {/* Previous Button */}
        <button
          className="btn-outline"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: currentIndex === 0 ? 0.5 : 1 }}
          title="Shortcut: Alt + Left Arrow"
        >
          <ChevronLeft size={18} /> Previous
        </button>

        {/* Status / Feedback Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDirty && (
            <span style={{ fontSize: '0.8rem', color: '#e65100', fontWeight: 'bold' }}>
              • Unsaved changes
            </span>
          )}
          {saveStatus === 'saving' && (
            <span style={{ fontSize: '0.82rem', color: 'var(--pine-primary)', fontWeight: 'bold' }}>
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontSize: '0.82rem', color: '#2e7d32', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={16} /> Saved!
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: '0.82rem', color: '#c62828', fontWeight: 'bold' }}>
              Error saving item. Please retry.
            </span>
          )}
        </div>

        {/* Action Buttons: Save, Save & Next, Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn-outline"
            onClick={() => handleSave(false)}
            disabled={saveStatus === 'saving'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            title="Save changes (Ctrl+S)"
          >
            <Save size={16} /> Save
          </button>

          <button
            className="btn-green"
            onClick={() => handleSave(true)}
            disabled={saveStatus === 'saving'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', padding: '0.55rem 1.25rem' }}
            title="Save & Advance to next item (Ctrl+Enter)"
          >
            <Save size={16} /> Save & Next <ArrowRight size={16} />
          </button>

          <button
            className="btn-outline"
            onClick={() => handleNext(false)}
            disabled={currentIndex >= filteredItems.length - 1}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: currentIndex >= filteredItems.length - 1 ? 0.5 : 1 }}
            title="Skip to next item without saving (Alt + Right Arrow)"
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* FULL RESOLUTION PHOTO MODAL (Loads original camera photo strictly on-demand) */}
      {showFullPhotoModal && activePhoto?.photo_url && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '2rem'
          }}
          onClick={() => setShowFullPhotoModal(false)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowFullPhotoModal(false)}
              style={{
                position: 'absolute',
                top: '-36px',
                right: '0',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <X size={28} />
            </button>
            <img
              src={activePhoto.photo_url}
              alt={formData.title}
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
            />
            <div style={{ color: '#fff', textAlign: 'center', marginTop: '8px', fontSize: '0.85rem' }}>
              Original High-Resolution Photo • Press Esc or click outside to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
