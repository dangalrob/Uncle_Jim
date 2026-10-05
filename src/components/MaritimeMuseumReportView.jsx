import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles, Building2 } from 'lucide-react';
import CachedThumbnail from './CachedThumbnail';

export default function MaritimeMuseumReportView({ currentUser, onClose }) {
  const [loadingItems, setLoadingItems] = useState(true);
  const [maritimeItems, setMaritimeItems] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchMaritimeData();
  }, []);

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
          fields: ['item_number', 'title', 'normalized_description', 'museum_photo_url', 'destination', 'institution']
        })
      });
      if (!res.ok) throw new Error('Failed to load maritime inventory');
      const data = await res.json();
      setMaritimeItems(data.sampleRows || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/admin/reports/maritime-pdf', {
        credentials: 'include'
      });

      if (!res.ok) throw new Error(`PDF generation failed (${res.status})`);

      const dateSlug = new Date().toISOString().slice(0, 10);
      let filename = `uncle-jim-maritime-museum-catalog-${dateSlug}.pdf`;
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

      setSuccessMessage(`Maritime Museum Catalog "${filename}" generated and downloaded successfully!`);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* HEADER */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button 
          className="btn-outline" 
          style={{ marginBottom: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
          onClick={onClose}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--pine-deep)', margin: '0 0 4px 0' }}>
              ⚓ Maritime Museum Curatorial Catalog
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Generate a formal museum-ready publication catalog of maritime artifacts for curator presentation and accession review.
            </p>
          </div>
          <button 
            className="btn-green"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
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
            {isGenerating ? <Loader2 size={20} className="spin" /> : <Download size={20} />}
            {isGenerating ? 'Generating Catalog...' : 'GENERATE MARITIME MUSEUM PDF'}
          </button>
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

      {/* CURATORIAL STANDARDS CARD */}
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
            <div style={{ fontWeight: 600, color: 'var(--pine-deep)', marginBottom: '0.25rem' }}>📄 Protected Pagination</div>
            <div>Dynamic height calculation ensures individual artifact photos and text blocks never split awkwardly across page breaks.</div>
          </div>
        </div>
      </div>

      {/* MARITIME ITEMS PREVIEW */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--pine-deep)' }}>
              Objects Included in Maritime Report
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Automatically selected based on institutional candidate and maritime designation fields.
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
            {maritimeItems.map((item, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  gap: '1rem', 
                  alignItems: 'flex-start', 
                  padding: '1rem', 
                  background: '#fff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px' 
                }}
              >
                <div style={{ width: '85px', height: '85px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.88rem' }}>
                      {item.item_number}
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: '4px', background: item.destination === 'Institution' ? '#dcfce7' : '#f3f4f6', color: item.destination === 'Institution' ? '#166534' : '#4b5563', fontWeight: 600 }}>
                      {item.destination}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', color: '#111827', fontWeight: 600 }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: '#4b5563', lineHeight: 1.45, maxHeight: '4.2em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.normalized_description || <span style={{ color: '#9ca3af' }}>No description recorded.</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn-green"
            onClick={handleDownloadPdf}
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
            {isGenerating ? <Loader2 size={20} className="spin" /> : <Download size={20} />}
            {isGenerating ? 'Generating Catalog...' : 'GENERATE MARITIME MUSEUM PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
