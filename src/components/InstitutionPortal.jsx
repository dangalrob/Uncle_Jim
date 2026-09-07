import React, { useState } from 'react';
import { Building2, MessageSquare, Printer, CheckCircle, Mail, HelpCircle } from 'lucide-react';

export default function InstitutionPortal({ items, onAskQuestion, onToggleInterest }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState(false);
  const [viewEmailReport, setViewEmailReport] = useState(false);

  const institutionalItems = items.length > 0 ? items : [
    {
      id: 'inst_1',
      title: 'Egyptian Soapstone Scribe Box (c. 1980s)',
      category: 'Artifacts & Cultural Antiques',
      location: 'Study Desk',
      description: 'Hand-carved Egyptian soapstone container brought back from Cairo trip. Features classical hieroglyphic motifs.',
      primary_photo: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'inst_2',
      title: '19th Century Maritime Ship Log & Maps',
      category: 'Historical Documents & Books',
      location: 'Library Shelf',
      description: 'Original sea voyage logs and hand-drawn coastal navigation maps from North Atlantic trade routes.',
      primary_photo: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80'
    }
  ];

  const handleSendQuestion = (itemId) => {
    if (!questionText.trim()) return;
    onAskQuestion(itemId || 'general', questionText);
    setSubmittedQuestion(true);
    setQuestionText('');
  };

  if (viewEmailReport) {
    return (
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--pine-deep)' }}>🏛️ Uncle Jim's Estate — Institutional Offerings Report</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Catalog summary formatted for printing or emailing to institutional partners.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-outline" onClick={() => window.print()}><Printer size={16} /> Print Report</button>
            <button className="btn-outline" onClick={() => setViewEmailReport(false)}>Back to Portal</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {institutionalItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', background: '#fcfdfe' }}>
              <img src={item.primary_photo} style={{ width: '120px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} alt={item.title} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--pine-primary)' }}>{item.title}</h3>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Category: {item.category}</div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-dark)' }}>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.75rem', boxShadow: 'var(--shadow-md)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--bg-app)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Building2 size={32} color="var(--pine-primary)" />
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--pine-deep)' }}>
              Institutional Partner Portal
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Welcome, City Historical Museum / Library partner. Review cultural items offered for donation.
            </p>
          </div>
        </div>

        <button className="btn-outline" onClick={() => setViewEmailReport(true)} style={{ padding: '0.65rem 1.25rem' }}>
          <Mail size={18} /> View Emailable / Printable Report
        </button>
      </div>

      {/* Catalog Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {institutionalItems.map((item) => (
          <div key={item.id} className="card" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <img src={item.primary_photo} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }} alt={item.title} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--pine-deep)', marginBottom: '0.35rem' }}>{item.title}</h3>
            <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--pine-primary)', marginBottom: '0.75rem' }}>{item.category}</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>{item.description}</p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-green-senior" style={{ flex: 1, fontSize: '0.9rem', padding: '0.65rem' }} onClick={() => onToggleInterest(item.id, 'interested')}>
                💙 Indicate Interest
              </button>
              <button className="btn-outline" style={{ flex: 1, fontSize: '0.9rem', padding: '0.65rem' }} onClick={() => setSelectedItem(item)}>
                <HelpCircle size={16} /> Ask Question
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Question / Inquiry Modal */}
      {selectedItem && (
        <div style={{ background: '#f8fbf9', border: '1.5px solid var(--pine-primary)', padding: '1.5rem', borderRadius: '12px', marginTop: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            💬 Ask Question about: "{selectedItem.title}"
          </h3>
          <textarea
            className="senior-input"
            rows="3"
            placeholder="Type your question or museum accession inquiry here..."
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            style={{ marginBottom: '1rem' }}
          ></textarea>

          {submittedQuestion && (
            <div style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle size={16} /> Question sent to Dan & Frank (Estate Admins).
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-green-senior" style={{ padding: '0.75rem 1.5rem' }} onClick={() => handleSendQuestion(selectedItem.id)}>
              Send Question to Estate Admin
            </button>
            <button className="btn-outline" onClick={() => setSelectedItem(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
