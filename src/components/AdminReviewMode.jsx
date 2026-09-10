import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CachedThumbnail from './CachedThumbnail';
import { 
  ArrowLeft, ArrowRight, Save, Check, AlertCircle, 
  ExternalLink, ZoomIn, X, ChevronLeft, ChevronRight,
  Search, Filter, CheckCircle2, RotateCcw, Crop, Star,
  Trash2, Image, Layers, Sparkles, Building2
} from 'lucide-react';

/**
 * URL Link Detector & Renderer
 * Detects http:// and https:// URLs in plain text and renders them as clickable links
 */
export function renderTextWithLinks(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1a73e8', textDecoration: 'underline', wordBreak: 'break-all' }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/**
 * AdminReviewMode Component
 * Redesigned compact laptop inventory cleanup workspace with inline table editing,
 * live autosave, and contextual drill-down modal (Previous, Save, Save & Next, Next).
 */
export default function AdminReviewMode({
  items = [],
  categories = [],
  onSaveItem,
  onReleaseItem,
  onUnreleaseItem,
  onCropPhoto,
  onRestorePhoto,
  onSetPrimaryPhoto,
  onDeletePhoto,
  onClose,
  initialItemId = null
}) {
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'missing_cat' | 'missing_val' | 'missing_title' | 'institutional' | 'not_released' | 'upload_pending'
  const [sortField, setSortField] = useState('title'); // 'title' | 'category' | 'value' | 'status' | 'upload'
  const [sortAsc, setSortAsc] = useState(true);

  // Row inline autosave state: { [itemId]: { status: 'saving'|'saved'|'error', errorMsg: '' } }
  const [rowSaveStates, setRowSaveStates] = useState({});

  // Active Drill Down Item (if open)
  const [drillDownItemId, setDrillDownItemId] = useState(() => initialItemId || null);

  // Photo Tools Popover State: { item, photo, x, y }
  const [activePhotoTools, setActivePhotoTools] = useState(null);

  // Full-Res Photo Modal State
  const [fullResPhotoUrl, setFullResPhotoUrl] = useState(null);

  // Table container ref to maintain scroll position
  const tableContainerRef = useRef(null);

  // Compute Summary Statistics
  const stats = useMemo(() => {
    const total = items.length;
    const missingCat = items.filter(i => !i.category_id && !i.category_name).length;
    const missingVal = items.filter(i => !i.value || i.value.trim() === '').length;
    const missingTitle = items.filter(i => !i.title || i.title.trim() === '' || i.title.toLowerCase() === 'untitled item').length;
    const institutional = items.filter(i => ['Recommended', 'Requested'].includes(i.institutional_candidate || i.institutionalCandidate)).length;
    const notReleased = items.filter(i => i.status !== 'released').length;
    const uploadPending = items.filter(i => i.is_offline || i.sync_status === 'pending').length;
    
    // "Need Attention" = items missing Category, Value, or Title
    const needAttention = items.filter(i => 
      (!i.category_id && !i.category_name) || 
      (!i.value || !i.value.trim()) || 
      (!i.title || !i.title.trim() || i.title.toLowerCase() === 'untitled item')
    ).length;
    const complete = Math.max(0, total - needAttention);

    return { total, missingCat, missingVal, missingTitle, institutional, notReleased, uploadPending, needAttention, complete };
  }, [items]);

  // Filtered & Sorted items list
  const filteredItems = useMemo(() => {
    let list = items.filter(item => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const descMatch = (item.description || item.notes || '').toLowerCase().includes(q);
        const locMatch = (item.location_in_house || item.location || '').toLowerCase().includes(q);
        const catMatch = (item.category_name || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !locMatch && !catMatch) return false;
      }

      // Quick filter
      switch (quickFilter) {
        case 'missing_cat':
          return !item.category_id && !item.category_name;
        case 'missing_val':
          return !item.value || item.value.trim() === '';
        case 'missing_title':
          return !item.title || item.title.trim() === '' || item.title.toLowerCase() === 'untitled item';
        case 'institutional':
          return ['Recommended', 'Requested'].includes(item.institutional_candidate || item.institutionalCandidate);
        case 'not_released':
          return item.status !== 'released';
        case 'upload_pending':
          return item.is_offline || item.sync_status === 'pending';
        default:
          return true;
      }
    });

    // Sorting
    list.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'title') {
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
      } else if (sortField === 'category') {
        valA = (a.category_name || categories.find(c => c.id === a.category_id)?.name || '').toLowerCase();
        valB = (b.category_name || categories.find(c => c.id === b.category_id)?.name || '').toLowerCase();
      } else if (sortField === 'value') {
        valA = (a.value || '').replace(/[^0-9.]/g, '');
        valB = (b.value || '').replace(/[^0-9.]/g, '');
        const numA = parseFloat(valA) || 0;
        const numB = parseFloat(valB) || 0;
        return sortAsc ? numA - numB : numB - numA;
      } else if (sortField === 'status') {
        valA = a.status === 'released' ? 'released' : 'draft';
        valB = b.status === 'released' ? 'released' : 'draft';
      } else if (sortField === 'upload') {
        valA = a.is_offline || a.sync_status === 'pending' ? 'pending' : 'uploaded';
        valB = b.is_offline || b.sync_status === 'pending' ? 'pending' : 'uploaded';
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [items, searchQuery, quickFilter, sortField, sortAsc, categories]);

  // Current drill-down item
  const currentDrillDownItem = useMemo(() => {
    if (!drillDownItemId) return null;
    return items.find(i => i.id === drillDownItemId) || null;
  }, [drillDownItemId, items]);

  const currentDrillDownIndex = useMemo(() => {
    if (!drillDownItemId) return -1;
    return filteredItems.findIndex(i => i.id === drillDownItemId);
  }, [drillDownItemId, filteredItems]);

  // Inline table field save handler (autosaves on blur or change)
  const handleInlineSave = async (item, field, newValue) => {
    const itemId = item.id;
    const currentVal = item[field];
    if (currentVal === newValue) return;

    setRowSaveStates(prev => ({
      ...prev,
      [itemId]: { status: 'saving' }
    }));

    try {
      const payload = { [field]: newValue };
      // Map field names if necessary
      if (field === 'category_id') payload.categoryId = newValue;
      if (field === 'institutional_candidate') payload.institutionalCandidate = newValue;

      await onSaveItem(itemId, payload);

      setRowSaveStates(prev => ({
        ...prev,
        [itemId]: { status: 'saved' }
      }));

      setTimeout(() => {
        setRowSaveStates(prev => {
          if (prev[itemId]?.status === 'saved') {
            const copy = { ...prev };
            delete copy[itemId];
            return copy;
          }
          return prev;
        });
      }, 2000);
    } catch (err) {
      console.error("Inline save failed:", err);
      setRowSaveStates(prev => ({
        ...prev,
        [itemId]: { status: 'error', errorMsg: err.message || 'Save failed' }
      }));
    }
  };

  // Toggle sort direction or set field
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 90px)', minHeight: '600px', background: '#f8faf9', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      
      {/* TOP HEADER: Title, Back Button, Summary Stats */}
      <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button className="btn-outline" onClick={onClose} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ArrowLeft size={16} /> Back to Catalog
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)' }}>
                Admin Inventory Review & Cleanup
              </h2>
            </div>
          </div>

          {/* Review Progress Summary Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f8f5', border: '1px solid #c8e6c9', borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--pine-deep)' }}>{stats.total} Items</span>
            <span style={{ color: '#aaa' }}>|</span>
            <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓ {stats.complete} Complete</span>
            <span style={{ color: '#aaa' }}>|</span>
            <span style={{ color: stats.needAttention > 0 ? '#d97706' : '#2e7d32', fontWeight: 'bold' }}>
              ⚠️ {stats.needAttention} Need Attention
            </span>
          </div>
        </div>

        {/* SEARCH & QUICK FILTER CHIPS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8faf9', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.35rem 0.75rem', width: '280px' }}>
            <Search size={15} color="#6b7280" style={{ marginRight: '6px' }} />
            <input
              type="text"
              placeholder="Search title, notes, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={14} color="#6b7280" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', overflowX: 'auto', paddingBottom: '2px' }}>
            <button
              className={`btn-outline ${quickFilter === 'all' ? 'btn-green' : ''}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '16px' }}
              onClick={() => setQuickFilter('all')}
            >
              All ({stats.total})
            </button>

            <button
              className={`btn-outline ${quickFilter === 'missing_cat' ? 'btn-green' : ''}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '16px', color: stats.missingCat > 0 ? '#b45309' : undefined, borderColor: stats.missingCat > 0 ? '#fcd34d' : undefined }}
              onClick={() => setQuickFilter('missing_cat')}
            >
              ⚠️ Missing Category ({stats.missingCat})
            </button>

            <button
              className={`btn-outline ${quickFilter === 'missing_val' ? 'btn-green' : ''}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '16px', color: stats.missingVal > 0 ? '#b45309' : undefined, borderColor: stats.missingVal > 0 ? '#fcd34d' : undefined }}
              onClick={() => setQuickFilter('missing_val')}
            >
              ⚠️ Missing Value ({stats.missingVal})
            </button>

            <button
              className={`btn-outline ${quickFilter === 'missing_title' ? 'btn-green' : ''}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '16px', color: stats.missingTitle > 0 ? '#b45309' : undefined, borderColor: stats.missingTitle > 0 ? '#fcd34d' : undefined }}
              onClick={() => setQuickFilter('missing_title')}
            >
              ⚠️ Missing Title ({stats.missingTitle})
            </button>

            <button
              className={`btn-outline ${quickFilter === 'institutional' ? 'btn-green' : ''}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '16px' }}
              onClick={() => setQuickFilter('institutional')}
            >
              🏛️ Institution ({stats.institutional})
            </button>

            <button
              className={`btn-outline ${quickFilter === 'not_released' ? 'btn-green' : ''}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '16px' }}
              onClick={() => setQuickFilter('not_released')}
            >
              ⏳ Not Released ({stats.notReleased})
            </button>

            {stats.uploadPending > 0 && (
              <button
                className={`btn-outline ${quickFilter === 'upload_pending' ? 'btn-green' : ''}`}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '16px', color: '#c2410c', borderColor: '#fdba74' }}
                onClick={() => setQuickFilter('upload_pending')}
              >
                ☁️ Upload Pending ({stats.uploadPending})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: Compact Table Workspace */}
      <div ref={tableContainerRef} style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10, borderBottom: '2px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '8px 10px', width: '56px', textAlign: 'center' }}>Photo</th>
              <th style={{ padding: '8px 12px', cursor: 'pointer', minWidth: '220px' }} onClick={() => handleSort('title')}>
                Title {sortField === 'title' && (sortAsc ? '▲' : '▼')}
              </th>
              <th style={{ padding: '8px 10px', cursor: 'pointer', minWidth: '180px' }} onClick={() => handleSort('category')}>
                Category {sortField === 'category' && (sortAsc ? '▲' : '▼')}
              </th>
              <th style={{ padding: '8px 10px', cursor: 'pointer', width: '140px' }} onClick={() => handleSort('value')}>
                Estimated Value {sortField === 'value' && (sortAsc ? '▲' : '▼')}
              </th>
              <th style={{ padding: '8px 10px', width: '150px' }}>Institutional</th>
              <th style={{ padding: '8px 10px', cursor: 'pointer', width: '160px' }} onClick={() => handleSort('status')}>
                Family Review {sortField === 'status' && (sortAsc ? '▲' : '▼')}
              </th>
              <th style={{ padding: '8px 10px', cursor: 'pointer', width: '120px' }} onClick={() => handleSort('upload')}>
                Upload Status {sortField === 'upload' && (sortAsc ? '▲' : '▼')}
              </th>
              <th style={{ padding: '8px 12px', width: '140px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                  No inventory items match the current search or filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const isTitleMissing = !item.title || item.title.trim() === '' || item.title.toLowerCase() === 'untitled item';
                const isCatMissing = !item.category_id && !item.category_name;
                const isValMissing = !item.value || item.value.trim() === '';
                const isReleased = item.status === 'released';
                const isPendingUpload = item.is_offline || item.sync_status === 'pending';
                const rowState = rowSaveStates[item.id];
                const instCandidate = item.institutional_candidate || item.institutionalCandidate || 'None';

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: idx % 2 === 0 ? '#fff' : '#fafafa',
                      transition: 'background 0.15s'
                    }}
                    className="review-table-row"
                  >
                    {/* Cached Thumbnail */}
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          display: 'inline-block'
                        }}
                        onClick={() => {
                          const primaryPhoto = (item.photos && item.photos[0]) || { photo_url: item.primary_photo, thumbnail_url: item.primary_thumb };
                          setActivePhotoTools({ item, photo: primaryPhoto });
                        }}
                        title="Click for photo tools / zoom"
                      >
                        <CachedThumbnail
                          url={item.primary_thumb || item.primary_photo}
                          version={item.primary_thumb_version}
                          alt={item.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    </td>

                    {/* Title (Inline Editable) */}
                    <td style={{ padding: '6px 12px' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          defaultValue={item.title || ''}
                          key={`title-${item.id}-${item.title}`}
                          placeholder="⚠️ Enter Title"
                          onBlur={(e) => handleInlineSave(item, 'title', e.target.value.trim())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                          }}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            fontSize: '0.88rem',
                            fontWeight: '600',
                            borderRadius: '4px',
                            border: isTitleMissing ? '1px solid #f59e0b' : '1px solid transparent',
                            background: isTitleMissing ? '#fffbeb' : 'transparent',
                            color: '#1f2937'
                          }}
                          className="inline-editable-input"
                        />
                        {isTitleMissing && (
                          <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 'bold', display: 'block', marginTop: '1px' }}>
                            Missing Title
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category (Inline Select with Packers) */}
                    <td style={{ padding: '6px 10px' }}>
                      <select
                        value={item.category_id || (item.category_name ? categories.find(c => c.name === item.category_name)?.id : '') || ''}
                        onChange={(e) => handleInlineSave(item, 'category_id', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: '0.84rem',
                          borderRadius: '4px',
                          border: isCatMissing ? '1px solid #f59e0b' : '1px solid #d1d5db',
                          background: isCatMissing ? '#fffbeb' : '#fff',
                          color: isCatMissing ? '#b45309' : '#1f2937'
                        }}
                      >
                        <option value="">⚠️ Select Category</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.icon || '📦'} {c.name}</option>
                        ))}
                      </select>
                      {isCatMissing && (
                        <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 'bold', display: 'block', marginTop: '1px' }}>
                          Missing Category
                        </span>
                      )}
                    </td>

                    {/* Estimated Value (Inline Editable) */}
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="text"
                        defaultValue={item.value || ''}
                        key={`val-${item.id}-${item.value}`}
                        placeholder="⚠️ $0 or range"
                        onBlur={(e) => handleInlineSave(item, 'value', e.target.value.trim())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur();
                        }}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          borderRadius: '4px',
                          border: isValMissing ? '1px solid #f59e0b' : '1px solid #d1d5db',
                          background: isValMissing ? '#fffbeb' : '#fff',
                          color: item.value ? 'var(--pine-primary)' : '#b45309'
                        }}
                        className="inline-editable-input"
                      />
                      {isValMissing && (
                        <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 'bold', display: 'block', marginTop: '1px' }}>
                          Missing Value
                        </span>
                      )}
                    </td>

                    {/* Institutional Candidate (Inline Select) */}
                    <td style={{ padding: '6px 10px' }}>
                      <select
                        value={instCandidate}
                        onChange={(e) => handleInlineSave(item, 'institutional_candidate', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: '0.82rem',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: instCandidate !== 'None' ? '#f0fdf4' : '#fff',
                          color: instCandidate !== 'None' ? '#15803d' : '#4b5563',
                          fontWeight: instCandidate !== 'None' ? 'bold' : 'normal'
                        }}
                      >
                        <option value="None">None (Family)</option>
                        <option value="Recommended">🏛️ Recommended</option>
                        <option value="Requested">🏛️ Requested</option>
                      </select>
                      {instCandidate !== 'None' && item.institutional_name && (
                        <span style={{ fontSize: '0.7rem', color: '#15803d', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.institutional_name}
                        </span>
                      )}
                    </td>

                    {/* Family Review Status (Release / Unrelease) */}
                    <td style={{ padding: '6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isReleased ? (
                          <>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#15803d', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                              Released
                            </span>
                            <button
                              onClick={() => onUnreleaseItem(item.id)}
                              style={{
                                fontSize: '0.72rem',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                background: '#fff',
                                borderRadius: '4px',
                                padding: '2px 5px',
                                cursor: 'pointer'
                              }}
                              title="Unrelease from catalog"
                            >
                              Unrelease
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                              Draft
                            </span>
                            <button
                              onClick={() => onReleaseItem(item.id)}
                              style={{
                                fontSize: '0.72rem',
                                color: '#15803d',
                                border: '1px solid #86efac',
                                background: '#f0fdf4',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                              title="Release item to family catalog"
                            >
                              🚀 Release
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Upload Status */}
                    <td style={{ padding: '6px 10px' }}>
                      {isPendingUpload ? (
                        <span style={{ fontSize: '0.74rem', fontWeight: 'bold', color: '#c2410c', background: '#ffedd5', padding: '3px 7px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ⏳ Pending
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: '#4b5563', background: '#f3f4f6', padding: '3px 7px', borderRadius: '4px' }}>
                          ✓ Uploaded
                        </span>
                      )}
                    </td>

                    {/* Actions & Inline Save Feedback */}
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {/* Row Autosave Feedback */}
                        {rowState?.status === 'saving' && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--pine-primary)', fontWeight: 'bold' }}>
                            Saving…
                          </span>
                        )}
                        {rowState?.status === 'saved' && (
                          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Check size={12} /> Saved
                          </span>
                        )}
                        {rowState?.status === 'error' && (
                          <span
                            style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 'bold', cursor: 'pointer' }}
                            title={rowState.errorMsg || 'Save failed'}
                          >
                            ⚠️ Retry
                          </span>
                        )}

                        {/* Drill Down Action Button */}
                        <button
                          className="btn-outline"
                          onClick={() => setDrillDownItemId(item.id)}
                          style={{
                            fontSize: '0.78rem',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                          title="Open detailed editor (Notes, Photos, Story)"
                        >
                          Edit Details ➔
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DRILL DOWN / EDIT DETAILS MODAL (Preserves current filtered context) */}
      {currentDrillDownItem && (
        <DrillDownModal
          item={currentDrillDownItem}
          categories={categories}
          currentIndex={currentDrillDownIndex}
          totalInFilter={filteredItems.length}
          onSave={onSaveItem}
          onRelease={onReleaseItem}
          onUnrelease={onUnreleaseItem}
          onCropPhoto={onCropPhoto}
          onRestorePhoto={onRestorePhoto}
          onSetPrimaryPhoto={onSetPrimaryPhoto}
          onDeletePhoto={onDeletePhoto}
          onPrevious={() => {
            if (currentDrillDownIndex > 0) {
              setDrillDownItemId(filteredItems[currentDrillDownIndex - 1].id);
            }
          }}
          onNext={() => {
            if (currentDrillDownIndex < filteredItems.length - 1) {
              setDrillDownItemId(filteredItems[currentDrillDownIndex + 1].id);
            }
          }}
          onSaveAndNext={async (updatedData) => {
            await onSaveItem(currentDrillDownItem.id, updatedData);
            if (currentDrillDownIndex < filteredItems.length - 1) {
              setDrillDownItemId(filteredItems[currentDrillDownIndex + 1].id);
            } else {
              setDrillDownItemId(null);
            }
          }}
          onClose={() => setDrillDownItemId(null)}
          onViewFullRes={(url) => setFullResPhotoUrl(url)}
        />
      )}

      {/* PHOTO TOOLS POPOVER (Triggered by clicking any thumbnail) */}
      {activePhotoTools && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setActivePhotoTools(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              maxWidth: '340px',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Photo Tools</div>
              <button onClick={() => setActivePhotoTools(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ width: '100%', height: '160px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', background: '#f5f5f0' }}>
              <CachedThumbnail
                url={activePhotoTools.photo.thumbnail_url || activePhotoTools.photo.photo_url}
                version={activePhotoTools.photo.photo_version || activePhotoTools.item.primary_thumb_version}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="btn-outline"
                style={{ fontSize: '0.85rem', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem' }}
                onClick={() => {
                  const p = activePhotoTools.photo;
                  const item = activePhotoTools.item;
                  setActivePhotoTools(null);
                  onCropPhoto(item, p);
                }}
              >
                <Crop size={16} /> Crop / Re-crop Image
              </button>

              <button
                className="btn-outline"
                style={{ fontSize: '0.85rem', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem' }}
                onClick={() => {
                  const p = activePhotoTools.photo;
                  const item = activePhotoTools.item;
                  setActivePhotoTools(null);
                  onRestorePhoto(item, p.id);
                }}
              >
                <RotateCcw size={16} /> Restore Original Framing
              </button>

              {activePhotoTools.item.photos && activePhotoTools.item.photos.length > 1 && !activePhotoTools.photo.is_primary && (
                <button
                  className="btn-outline"
                  style={{ fontSize: '0.85rem', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem' }}
                  onClick={() => {
                    const p = activePhotoTools.photo;
                    const item = activePhotoTools.item;
                    setActivePhotoTools(null);
                    onSetPrimaryPhoto(item, p.id);
                  }}
                >
                  <Star size={16} color="#f59e0b" /> Set as Primary Photo
                </button>
              )}

              {activePhotoTools.photo.photo_url && (
                <button
                  className="btn-outline"
                  style={{ fontSize: '0.85rem', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem' }}
                  onClick={() => {
                    const url = activePhotoTools.photo.photo_url;
                    setActivePhotoTools(null);
                    setFullResPhotoUrl(url);
                  }}
                >
                  <ZoomIn size={16} /> View Full Resolution
                </button>
              )}

              {activePhotoTools.item.photos && activePhotoTools.item.photos.length > 1 && (
                <button
                  className="btn-outline"
                  style={{ fontSize: '0.85rem', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                  onClick={() => {
                    const p = activePhotoTools.photo;
                    const item = activePhotoTools.item;
                    setActivePhotoTools(null);
                    onDeletePhoto(item, p.id);
                  }}
                >
                  <Trash2 size={16} /> Delete Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL RES PHOTO MODAL */}
      {fullResPhotoUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
          onClick={() => setFullResPhotoUrl(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setFullResPhotoUrl(null)}
              style={{ position: 'absolute', top: '-36px', right: 0, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={28} />
            </button>
            <img
              src={fullResPhotoUrl}
              alt="Full Resolution Photo"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DrillDownModal Component
 * Comprehensive full-item editor that preserves current filter/sort context:
 * - Previous, Save, Save & Next, Next controls
 * - Full-width 10-15 line Description & Notes textarea
 * - URL preservation with clickable Link Preview
 * - Simplified photo thumbnails (120x120px) with popover actions
 */
function DrillDownModal({
  item,
  categories,
  currentIndex,
  totalInFilter,
  onSave,
  onRelease,
  onUnrelease,
  onCropPhoto,
  onRestorePhoto,
  onSetPrimaryPhoto,
  onDeletePhoto,
  onPrevious,
  onNext,
  onSaveAndNext,
  onClose,
  onViewFullRes
}) {
  // Form State
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
    story: '',
    institutionalCandidate: 'None',
    institutionalName: '',
    status: 'draft'
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(null);
  const [selectedPhotoForTools, setSelectedPhotoForTools] = useState(null);

  // Sync item data into form
  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title || '',
        categoryId: item.category_id || (item.category_name ? categories.find(c => c.name === item.category_name)?.id : '') || '',
        value: item.value || '',
        era: item.era || '',
        locationInHouse: item.location_in_house || item.location || '',
        condition: item.condition || '',
        dimensions: item.dimensions || '',
        weight: item.weight || '',
        description: item.description || item.special_handling_notes || item.notes || '',
        story: item.story || item.story_text || '',
        institutionalCandidate: item.institutional_candidate || item.institutionalCandidate || 'None',
        institutionalName: item.institutional_name || item.institutionalName || '',
        status: item.status || 'draft'
      });
      setIsDirty(false);
      setSaveToast(null);
      setSelectedPhotoForTools(null);
    }
  }, [item?.id, categories]);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    setIsDirty(true);
  };

  const handleSave = async (advanceNext = false) => {
    setIsSaving(true);
    try {
      if (advanceNext) {
        await onSaveAndNext(formData);
      } else {
        await onSave(item.id, formData);
        setIsDirty(false);
        setSaveToast('Saved ✓');
        setTimeout(() => setSaveToast(null), 2500);
      }
    } catch (err) {
      console.error(err);
      setSaveToast('⚠️ Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard Shortcuts: Ctrl+Enter (Save & Next), Ctrl+S (Save), Alt+Left/Right (Navigate)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevious();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, item?.id, currentIndex, totalInFilter]);

  const photos = item.photos && item.photos.length > 0
    ? item.photos
    : (item.primary_photo || item.primary_thumb ? [{
        id: 'primary',
        photo_url: item.primary_photo || item.primary_thumb,
        thumbnail_url: item.primary_thumb || item.primary_photo,
        is_primary: 1
      }] : []);

  const isSinglePhoto = photos.length <= 1;

  // Detect URLs in Description for read-only preview
  const detectedUrls = useMemo(() => {
    if (!formData.description) return [];
    const matches = formData.description.match(/(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g);
    return matches ? Array.from(new Set(matches)) : [];
  }, [formData.description]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '95%',
          maxWidth: '920px',
          height: '90vh',
          maxHeight: '850px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP MODAL ACTION BAR */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn-outline"
              onClick={onPrevious}
              disabled={currentIndex <= 0}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: currentIndex <= 0 ? 0.4 : 1 }}
              title="Previous item in active filter (Alt + Left)"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#4b5563' }}>
              Item {currentIndex + 1} of {totalInFilter} (Filtered)
            </span>

            <button
              className="btn-outline"
              onClick={onNext}
              disabled={currentIndex >= totalInFilter - 1}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: currentIndex >= totalInFilter - 1 ? 0.4 : 1 }}
              title="Next item in active filter (Alt + Right)"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {isDirty && (
              <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 'bold' }}>
                • Unsaved edits
              </span>
            )}
            {saveToast && (
              <span style={{ fontSize: '0.8rem', color: saveToast.includes('✓') ? '#15803d' : '#b91c1c', fontWeight: 'bold' }}>
                {saveToast}
              </span>
            )}

            <button
              className="btn-outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 'bold' }}
              title="Save changes (Ctrl+S)"
            >
              <Save size={14} style={{ marginRight: '4px' }} /> Save
            </button>

            <button
              className="btn-green"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              style={{ padding: '0.4rem 0.95rem', fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Save and advance to next item (Ctrl+Enter)"
            >
              <Save size={14} /> Save & Next <ArrowRight size={14} />
            </button>

            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', marginLeft: '0.5rem' }}>
              <X size={20} color="#6b7280" />
            </button>
          </div>
        </div>

        {/* MODAL BODY (Scrollable Structured Sections) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* SECTION 1: BASIC INFORMATION */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1. Basic Information
            </h4>
            
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '3px' }}>Item Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g. Hand-Carved Teak Ship Wheel"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.95rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '3px' }}>Category *</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => handleChange('categoryId', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.86rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff' }}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon || '📦'} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '3px' }}>Estimated Value / Range</label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => handleChange('value', e.target.value)}
                  placeholder="e.g. $150 - $250 or $300"
                  style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.86rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '3px' }}>Age / Period / Era</label>
                <input
                  type="text"
                  value={formData.era}
                  onChange={(e) => handleChange('era', e.target.value)}
                  placeholder="e.g. c. 1940s, Victorian, Mid-Century"
                  style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.86rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CLASSIFICATION, LOCATION & STATUS */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              2. Classification, Status & Location
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.85rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '3px' }}>Location in Residence</label>
                <input
                  type="text"
                  value={formData.locationInHouse}
                  onChange={(e) => handleChange('locationInHouse', e.target.value)}
                  placeholder="e.g. Living Room Mantle, Workshop"
                  style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.86rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '3px' }}>Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => handleChange('condition', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.86rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff' }}
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
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '3px' }}>Dimensions & Weight</label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => handleChange('dimensions', e.target.value)}
                  placeholder="e.g. 24 x 18 in, 8 lbs"
                  style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.86rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              {/* Institutional Candidate */}
              <div style={{ padding: '0.65rem', background: '#f8faf9', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  🏛️ Institutional Candidate
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={formData.institutionalCandidate}
                    onChange={(e) => handleChange('institutionalCandidate', e.target.value)}
                    style={{ padding: '0.4rem', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff' }}
                  >
                    <option value="None">None (Family)</option>
                    <option value="Recommended">Recommended for Museum</option>
                    <option value="Requested">Requested by Museum</option>
                  </select>
                  {formData.institutionalCandidate !== 'None' && (
                    <input
                      type="text"
                      value={formData.institutionalName}
                      onChange={(e) => handleChange('institutionalName', e.target.value)}
                      placeholder="Institution Name..."
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  )}
                </div>
              </div>

              {/* Family Release Status */}
              <div style={{ padding: '0.65rem', background: '#f8faf9', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Family Catalog Release</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    {formData.status === 'released' ? 'Visible to family members' : 'Draft only (hidden from family)'}
                  </div>
                </div>
                {formData.status === 'released' ? (
                  <button
                    className="btn-outline"
                    onClick={async () => {
                      await onUnrelease(item.id);
                      handleChange('status', 'draft');
                    }}
                    style={{ fontSize: '0.78rem', color: '#b91c1c', borderColor: '#fca5a5', padding: '0.35rem 0.65rem' }}
                  >
                    ↩️ Unrelease
                  </button>
                ) : (
                  <button
                    className="btn-green"
                    onClick={async () => {
                      await onRelease(item.id);
                      handleChange('status', 'released');
                    }}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', fontWeight: 'bold' }}
                  >
                    🚀 Release for Review
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: SIMPLIFIED PHOTO CONTROLS */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                3. Photographs ({photos.length})
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Click a photo to crop, restore, or manage
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {photos.map((p, idx) => {
                const isPrimary = !isSinglePhoto && (p.is_primary || idx === 0);

                return (
                  <div
                    key={p.id || idx}
                    style={{
                      position: 'relative',
                      width: '120px',
                      height: '120px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: isPrimary ? '2px solid var(--pine-primary)' : '1px solid #d1d5db',
                      background: '#f3f4f6',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onClick={() => setSelectedPhotoForTools(p)}
                    title="Click for crop and photo actions"
                  >
                    <CachedThumbnail
                      url={p.thumbnail_url || p.photo_url}
                      version={p.photo_version || item.primary_thumb_version}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    {/* Primary Badge (Only shown if multiple photos exist) */}
                    {isPrimary && (
                      <span style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: '4px',
                        background: 'var(--pine-primary)',
                        color: '#fff',
                        fontSize: '0.68rem',
                        fontWeight: 'bold',
                        padding: '1px 5px',
                        borderRadius: '3px'
                      }}>
                        ★ Primary
                      </span>
                    )}

                    {/* Hover Zoom Icon */}
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ZoomIn size={12} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* In-Modal Photo Action Popover */}
            {selectedPhotoForTools && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Photo Actions:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn-outline"
                    style={{ fontSize: '0.76rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      onCropPhoto(item, selectedPhotoForTools);
                      setSelectedPhotoForTools(null);
                    }}
                  >
                    <Crop size={13} /> Crop / Re-crop
                  </button>

                  <button
                    className="btn-outline"
                    style={{ fontSize: '0.76rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={async () => {
                      await onRestorePhoto(item, selectedPhotoForTools.id);
                      setSelectedPhotoForTools(null);
                    }}
                  >
                    <RotateCcw size={13} /> Restore Original
                  </button>

                  {!isSinglePhoto && !selectedPhotoForTools.is_primary && (
                    <button
                      className="btn-outline"
                      style={{ fontSize: '0.76rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={async () => {
                        await onSetPrimaryPhoto(item, selectedPhotoForTools.id);
                        setSelectedPhotoForTools(null);
                      }}
                    >
                      <Star size={13} color="#f59e0b" /> Set Primary
                    </button>
                  )}

                  {selectedPhotoForTools.photo_url && (
                    <button
                      className="btn-outline"
                      style={{ fontSize: '0.76rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => onViewFullRes(selectedPhotoForTools.photo_url)}
                    >
                      <ZoomIn size={13} /> Full Res
                    </button>
                  )}

                  {!isSinglePhoto && (
                    <button
                      className="btn-outline"
                      style={{ fontSize: '0.76rem', padding: '4px 8px', color: '#b91c1c', borderColor: '#fca5a5' }}
                      onClick={async () => {
                        await onDeletePhoto(item, selectedPhotoForTools.id);
                        setSelectedPhotoForTools(null);
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedPhotoForTools(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: EXPANDED DESCRIPTION & NOTES (10-15 lines, Resizable, URL rendering) */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                4. Description & Assessment Notes
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Comfortably edit several paragraphs; remove conversational filler
              </span>
            </div>

            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Verified item description, history, markings, and condition notes..."
              rows={12}
              style={{
                width: '100%',
                minHeight: '240px',
                padding: '0.75rem',
                fontSize: '0.92rem',
                lineHeight: '1.5',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />

            {/* Clickable URL Preview Section */}
            {detectedUrls.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  🔗 Detected Web Links (Click to verify):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {detectedUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', color: '#1a73e8', textDecoration: 'underline', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {url} <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: FAMILY STORY / HISTORY */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--pine-deep)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              5. Family Story & Provenance
            </h4>
            <textarea
              value={formData.story}
              onChange={(e) => handleChange('story', e.target.value)}
              placeholder="Family memories, stories Uncle Jim told, original purchase context..."
              rows={6}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.75rem',
                fontSize: '0.92rem',
                lineHeight: '1.5',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

        </div>

        {/* BOTTOM FIXED ACTION BAR */}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            className="btn-outline"
            onClick={onPrevious}
            disabled={currentIndex <= 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: currentIndex <= 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn-outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              style={{ fontWeight: 'bold' }}
            >
              <Save size={15} style={{ marginRight: '5px' }} /> Save
            </button>

            <button
              className="btn-green"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              style={{ fontWeight: 'bold', padding: '0.55rem 1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={15} /> Save & Next <ArrowRight size={15} />
            </button>

            <button
              className="btn-outline"
              onClick={onNext}
              disabled={currentIndex >= totalInFilter - 1}
              style={{ opacity: currentIndex >= totalInFilter - 1 ? 0.4 : 1 }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
