import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Package, BookOpen, CheckCircle, Heart, User, Shield, 
  Search, Filter, Plus, Truck, LogOut, ArrowRight, ArrowLeft, 
  Archive, FileText, AlertCircle, Lock, Unlock, Mail, Settings, Tag, Eye
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('review'); // 'capture', 'enrichment', 'review', 'catalog', 'dashboard', 'fulfillment', 'login'
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [reviewProgress, setReviewProgress] = useState({ totalReleased: 0, reviewedByUser: 0 });
  const [reviewIndex, setReviewIndex] = useState(0);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [interestComment, setInterestComment] = useState('');
  const [rapidTitle, setRapidTitle] = useState('');
  const [rapidCategory, setRapidCategory] = useState('');
  const [rapidLocation, setRapidLocation] = useState('');
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);

  // Assignment Modal State
  const [assignModalItem, setAssignModalItem] = useState(null);
  const [assignRecipient, setAssignRecipient] = useState('');
  const [assignDestType, setAssignDestType] = useState('family');
  const [assignDestName, setAssignDestName] = useState('');

  // Interest On Behalf State
  const [behalfModalItem, setBehalfModalItem] = useState(null);
  const [behalfUserId, setBehalfUserId] = useState('');
  const [behalfComment, setBehalfComment] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchCategories();
      fetchItems();
      fetchUsers();
      fetchReviewProgress();
      if (currentUser.role === 'admin') fetchDashboardStats();
    }
  }, [currentUser, currentView]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentView('login');
      }
    } catch (err) {
      setCurrentView('login');
    }
  };

  const handleLogin = async (emailToUse = loginEmail, passToUse = loginPassword) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse, password: passToUse })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        if (data.user.role === 'admin') setCurrentView('dashboard');
        else if (data.user.role === 'contributor') setCurrentView('capture');
        else setCurrentView('review');
      } else {
        alert(data.error || "Login failed");
      }
    } catch (err) {
      alert("Network error during login");
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setCurrentView('login');
  };

  const fetchItems = async () => {
    try {
      let url = `/api/items?search=${encodeURIComponent(searchQuery)}`;
      if (categoryFilter) url += `&category=${categoryFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsersList(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReviewProgress = async () => {
    try {
      const res = await fetch('/api/reviews/progress');
      if (res.ok) setReviewProgress(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-stats');
      if (res.ok) setDashboardStats(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const loadItemDetail = async (id) => {
    try {
      const res = await fetch(`/api/items/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedItem(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------------------------------------
  // RAPID CAPTURE SUBMIT (Dan & Sarah Phone Camera Workflow)
  // -----------------------------------------------------------
  const handleRapidCaptureSubmit = async (e) => {
    e.preventDefault();
    if (capturedPhotos.length === 0) {
      alert("Please select at least 1 photo to capture an item.");
      return;
    }

    setIsCapturing(true);
    const formData = new FormData();
    formData.append('title', rapidTitle);
    formData.append('locationInHouse', rapidLocation);
    formData.append('categoryId', rapidCategory);

    for (let photo of capturedPhotos) {
      formData.append('photos', photo);
    }

    try {
      const res = await fetch('/api/items/rapid-capture', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✓ Item ${data.item.itemNumber} captured successfully as Draft!`);
        setRapidTitle('');
        setCapturedPhotos([]);
        fetchItems();
      } else {
        alert(data.error || "Capture failed");
      }
    } catch (err) {
      alert("Error saving captured item.");
    } finally {
      setIsCapturing(false);
    }
  };

  // -----------------------------------------------------------
  // SUBMIT INTEREST (Family Review Action)
  // -----------------------------------------------------------
  const handleSubmitInterest = async (itemId, interestLevel) => {
    try {
      const res = await fetch(`/api/items/${itemId}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestLevel, comment: interestComment })
      });
      if (res.ok) {
        setInterestComment('');
        fetchReviewProgress();
        fetchItems();
        if (selectedItem) loadItemDetail(itemId);
      } else {
        const data = await res.json();
        alert(data.error || "Could not record decision.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------------------------------------
  // BATCH RELEASE ACTION (Admin Workflow)
  // -----------------------------------------------------------
  const handleBatchRelease = async (itemIds) => {
    if (!window.confirm(`Release ${itemIds.length} draft items for family review? An email notification will be dispatched.`)) return;
    try {
      const res = await fetch('/api/batches/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds })
      });
      if (res.ok) {
        alert(`✓ Released ${itemIds.length} items for family review!`);
        fetchItems();
        if (currentUser.role === 'admin') fetchDashboardStats();
      }
    } catch (err) {
      alert("Failed to release items.");
    }
  };

  // -----------------------------------------------------------
  // ASSIGNMENT SUBMIT (Admin Conflict Resolution)
  // -----------------------------------------------------------
  const handleAssignSubmit = async () => {
    if (!assignModalItem) return;
    try {
      const res = await fetch(`/api/items/${assignModalItem.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: assignRecipient || null,
          destinationType: assignDestType,
          destinationName: assignDestName
        })
      });
      if (res.ok) {
        alert("✓ Assignment saved and locked!");
        setAssignModalItem(null);
        fetchItems();
        if (currentUser.role === 'admin') fetchDashboardStats();
      }
    } catch (err) {
      alert("Failed to assign item.");
    }
  };

  // -----------------------------------------------------------
  // RECORD INTEREST ON BEHALF (Admin Override)
  // -----------------------------------------------------------
  const handleBehalfSubmit = async () => {
    if (!behalfModalItem || !behalfUserId) return;
    try {
      const res = await fetch(`/api/items/${behalfModalItem.id}/interest-on-behalf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: behalfUserId,
          interestLevel: 'interested',
          comment: behalfComment
        })
      });
      if (res.ok) {
        alert("✓ Interest recorded on behalf of family member!");
        setBehalfModalItem(null);
        fetchItems();
      }
    } catch (err) {
      alert("Failed to record interest.");
    }
  };

  const releasedItems = items.filter(i => ['released', 'assigned', 'distributed', 'completed'].includes(i.status));

  // Quick Demo Accounts Array
  const demoUsers = [
    { name: 'Dan Robinson', role: 'admin', email: 'dan@unclejim.estate', badge: 'Admin / Executor' },
    { name: 'Frank Robinson', role: 'admin', email: 'frank@unclejim.estate', badge: 'Executor' },
    { name: 'Cousin Sarah', role: 'contributor', email: 'sarah@unclejim.estate', badge: 'Photographer' },
    { name: 'Aunt Jean', role: 'reviewer', email: 'jean@unclejim.estate', badge: 'Family Reviewer' },
    { name: 'Tim Robinson', role: 'reviewer', email: 'tim@unclejim.estate', badge: 'Family Reviewer' },
    { name: 'Susan Robinson', role: 'reviewer', email: 'susan@unclejim.estate', badge: 'Family Reviewer' }
  ];

  return (
    <div className="app-container">
      {/* NAVBAR Header */}
      {currentUser && (
        <nav className="navbar">
          <div className="nav-brand">
            <div className="nav-brand-icon">📜</div>
            <span>Uncle Jim's Estate</span>
          </div>

          <div className="nav-links">
            {(currentUser.role === 'admin' || currentUser.role === 'contributor') && (
              <button 
                className={`nav-item ${currentView === 'capture' ? 'active' : ''}`}
                onClick={() => setCurrentView('capture')}
              >
                <Camera size={16} /> 📸 Mobile Capture
              </button>
            )}

            {(currentUser.role === 'admin' || currentUser.role === 'contributor') && (
              <button 
                className={`nav-item ${currentView === 'enrichment' ? 'active' : ''}`}
                onClick={() => setCurrentView('enrichment')}
              >
                <FileText size={16} /> ✍️ Enrichment
              </button>
            )}

            <button 
              className={`nav-item ${currentView === 'review' ? 'active' : ''}`}
              onClick={() => setCurrentView('review')}
            >
              <BookOpen size={16} /> 📖 1-Item Review
            </button>

            <button 
              className={`nav-item ${currentView === 'catalog' ? 'active' : ''}`}
              onClick={() => setCurrentView('catalog')}
            >
              <Package size={16} /> 🖼️ Catalog
            </button>

            {currentUser.role === 'admin' && (
              <button 
                className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentView('dashboard')}
              >
                <Shield size={16} /> ⚡ Conflicts & Decisions
              </button>
            )}

            {currentUser.role === 'admin' && (
              <button 
                className={`nav-item ${currentView === 'fulfillment' ? 'active' : ''}`}
                onClick={() => setCurrentView('fulfillment')}
              >
                <Truck size={16} /> 📦 Shipping & Tracking
              </button>
            )}
          </div>

          <div className="user-badge">
            <span>{currentUser.name}</span>
            <span className={`role-tag role-${currentUser.role}`}>{currentUser.role}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ffab91', cursor: 'pointer', marginLeft: '6px' }} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </nav>
      )}

      <main className="main-content">
        {/* VIEW 0: LOGIN */}
        {currentView === 'login' && (
          <div style={{ maxWidth: '520px', margin: '3rem auto', textAlign: 'center' }}>
            <div className="card">
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📜</div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--accent-gold)' }}>
                Uncle Jim's Estate
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Private Family Estate Documentation, Review, & Preservation Portal
              </p>

              <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--accent-amber)', marginBottom: '0.5rem' }}>
                  🔑 QUICK TEST LOGIN ACCOUNTS:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {demoUsers.map((u, idx) => (
                    <button 
                      key={idx}
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.75rem', justifyContent: 'flex-start', padding: '0.4rem 0.6rem' }}
                      onClick={() => handleLogin(u.email, 'password123')}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>{u.badge}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={loginEmail} 
                    onChange={e => setLoginEmail(e.target.value)} 
                    placeholder="name@unclejim.estate"
                    required
                  />
                </div>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)} 
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                  Log In to Estate Portal
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 1: MOBILE RAPID PHOTO CAPTURE (Dan & Sarah Phone Camera Workflow) */}
        {currentView === 'capture' && (
          <div className="mobile-capture-container">
            <div className="page-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
              <div>
                <h1 className="page-title" style={{ justifyContent: 'center' }}>📸 Rapid Mobile Capture</h1>
                <p className="page-subtitle">Take photos of items around Uncle Jim's house. Capture first, enrich later!</p>
              </div>
            </div>

            <div className="card">
              <form onSubmit={handleRapidCaptureSubmit}>
                <div className="form-group">
                  <label className="form-label">Select / Take Photographs</label>
                  <input 
                    type="file" 
                    id="camera-input"
                    accept="image/*" 
                    multiple 
                    capture="environment" 
                    style={{ display: 'none' }}
                    onChange={e => setCapturedPhotos(Array.from(e.target.files))}
                  />
                  <div className="camera-preview-box" onClick={() => document.getElementById('camera-input').click()}>
                    <Camera className="camera-icon-lg" />
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                      {capturedPhotos.length > 0 ? `${capturedPhotos.length} Photo(s) Selected` : "Tap to Open Camera / Select Photos"}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Supports multiple photos per object. Auto-generates WebP thumbnails.
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Item Title (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Wooden Ship Wheel, Brass Sextant (or leave blank)" 
                    value={rapidTitle}
                    onChange={e => setRapidTitle(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Location in House (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Living Room, Study, Upstairs Bedroom" 
                    value={rapidLocation}
                    onChange={e => setRapidLocation(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Category (Optional)</label>
                  <select className="form-select" value={rapidCategory} onChange={e => setRapidCategory(e.target.value)}>
                    <option value="">-- Unassigned Category --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1.05rem', marginTop: '0.5rem' }} disabled={isCapturing}>
                  {isCapturing ? "Processing Photos..." : "⚡ Save Draft & Capture Next Item"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 2: DESKTOP INVENTORY ENRICHMENT (Dan's Laptop Editing Grid) */}
        {currentView === 'enrichment' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">✍️ Inventory Enrichment & Batch Release</h1>
                <p className="page-subtitle">Add stories, categories, dimensions, provenance, and release batches for family review.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    const draftIds = items.filter(i => i.status === 'draft').map(i => i.id);
                    if (draftIds.length > 0) handleBatchRelease(draftIds);
                    else alert("No draft items available to release.");
                  }}
                >
                  🚀 Release All Drafts ({items.filter(i => i.status === 'draft').length})
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search items..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="draft">Draft / Private</option>
                <option value="released">Released for Review</option>
                <option value="assigned">Assigned</option>
              </select>
            </div>

            {/* Inventory Enrichment Grid */}
            <div className="inventory-grid">
              {items.map(item => (
                <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <img 
                    src={item.primary_thumb || item.primary_photo || 'https://placehold.co/400x300/1c1411/fff?text=No+Photo'} 
                    alt={item.title} 
                    className="inventory-card-thumb" 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <span className={`badge badge-${item.status}`}>{item.status}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{item.item_number}</span>
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {item.title}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    📍 {item.location_in_house || "Location not specified"}
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => { setEditingItem(item); loadItemDetail(item.id); }}>
                      ✍️ Enrich
                    </button>
                    {item.status === 'draft' && (
                      <button className="btn btn-primary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleBatchRelease([item.id])}>
                        Release
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: SINGLE-ITEM FAMILY REVIEW WORKFLOW (1 Item at a Time) */}
        {currentView === 'review' && (
          <div className="review-container">
            <div className="page-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
              <div>
                <h1 className="page-title" style={{ justifyContent: 'center' }}>📖 Family Review Experience</h1>
                <p className="page-subtitle">Review Uncle Jim's possessions one item at a time. See photos, stories, and indicate your interest.</p>
              </div>
            </div>

            {/* Review Progress Tracker */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                <span>Review Progress: <strong>{reviewProgress.reviewedByUser} of {reviewProgress.totalReleased} Items Reviewed</strong></span>
                <span>{Math.round((reviewProgress.reviewedByUser / (reviewProgress.totalReleased || 1)) * 100)}% Complete</span>
              </div>
              <div className="review-progress-bar">
                <div className="review-progress-fill" style={{ width: `${(reviewProgress.reviewedByUser / (reviewProgress.totalReleased || 1)) * 100}%` }}></div>
              </div>
            </div>

            {releasedItems.length > 0 ? (
              (() => {
                const currentItem = releasedItems[reviewIndex % releasedItems.length];
                return (
                  <div className="review-card">
                    <div className="review-photo-gallery">
                      <img 
                        src={currentItem.primary_photo || 'https://placehold.co/800x600/1c1411/fff?text=No+Photo'} 
                        alt={currentItem.title} 
                        className="review-photo-main"
                      />
                      <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                        <span className={`badge badge-${currentItem.status}`}>{currentItem.status}</span>
                      </div>
                    </div>

                    <div className="review-content">
                      <h2 className="review-item-title">{currentItem.title}</h2>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        {currentItem.category_icon} {currentItem.category_name || "Uncategorized"} • 📍 {currentItem.location_in_house}
                      </div>

                      {/* Story Box */}
                      <div className="review-story-box">
                        <div className="review-story-header">📜 Uncle Jim's Connection & Provenance:</div>
                        <div className="review-story-text">
                          "{currentItem.description || "Hand-preserved item from Uncle Jim's estate."}"
                        </div>
                      </div>

                      {/* Visible Interest of Relatives */}
                      <div style={{ margin: '1rem 0' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          👥 Family Members Expressing Interest:
                        </div>
                        {currentItem.interested_count > 0 ? (
                          <div className="interest-tag-list">
                            <span className="interest-tag">
                              ❤️ {currentItem.interested_count} Family Member(s) Interested
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', italic: true }}>
                            No family members have requested this item yet. Be the first!
                          </div>
                        )}
                      </div>

                      {/* Optional Comment Input */}
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">Add a Memory or Note (Optional)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. I remember reading this book with Uncle Jim during summer visits..." 
                          value={interestComment}
                          onChange={e => setInterestComment(e.target.value)}
                        />
                      </div>

                      {/* Review Decision Controls */}
                      <div className="interest-actions">
                        <button 
                          className="btn btn-secondary" 
                          style={{ flex: 1, padding: '0.8rem' }}
                          onClick={() => {
                            handleSubmitInterest(currentItem.id, 'not_interested');
                            setReviewIndex(prev => prev + 1);
                          }}
                        >
                          ⚪ Not Interested / Pass
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1.5, padding: '0.8rem', fontSize: '1rem' }}
                          onClick={() => {
                            handleSubmitInterest(currentItem.id, 'interested');
                            setReviewIndex(prev => prev + 1);
                          }}
                        >
                          💚 I'm Interested in This Item!
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setReviewIndex(prev => Math.max(0, prev - 1))}>
                          <ArrowLeft size={14} /> Previous Item
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setReviewIndex(prev => prev + 1)}>
                          Next Item <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</div>
                <h2>No Released Items Ready for Review Yet</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Dan & Frank are currently preparing Uncle Jim's inventory. You will receive an email once items are released for review!
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: CATALOG VIEW */}
        {currentView === 'catalog' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">🖼️ Estate Catalog</h1>
                <p className="page-subtitle">Browse and search Uncle Jim's possessions.</p>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search catalog..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            <div className="inventory-grid">
              {items.map(item => (
                <div key={item.id} className="card" style={{ cursor: 'pointer' }} onClick={() => loadItemDetail(item.id)}>
                  <img src={item.primary_thumb || item.primary_photo || 'https://placehold.co/400x300/1c1411/fff?text=No+Photo'} alt={item.title} className="inventory-card-thumb" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span className={`badge badge-${item.status}`}>{item.status}</span>
                    {item.assigned_to_name && <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)' }}>Assigned: {item.assigned_to_name}</span>}
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>{item.title}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {item.location_in_house}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: ADMIN DASHBOARD & CONFLICT RESOLUTION */}
        {currentView === 'dashboard' && currentUser?.role === 'admin' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">⚡ Admin Conflicts & Decision Dashboard</h1>
                <p className="page-subtitle">Resolve competing family interest, record requests on behalf of relatives, and finalize assignments.</p>
              </div>
            </div>

            {/* Dashboard KPI Stat Cards */}
            {dashboardStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{dashboardStats.totalItems}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Inventory Items</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#bdbdbd' }}>{dashboardStats.draftItems}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Draft Items (Unreleased)</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#81c784' }}>{dashboardStats.releasedItems}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Released for Review</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#64b5f6' }}>{dashboardStats.assignedItems}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assigned Items</div>
                </div>
              </div>
            )}

            {/* "Needs Decision" Conflict Section */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle color="var(--accent-amber)" /> Items Needing Decision (Multiple Requests)
              </h2>

              {dashboardStats?.needsDecision && dashboardStats.needsDecision.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {dashboardStats.needsDecision.map(item => (
                    <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{item.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          ⚠️ {item.interest_count} Family Members have requested this item
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => { setBehalfModalItem(item); }}>
                          ✍️ Record On Behalf
                        </button>
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setAssignModalItem(item)}>
                          🎯 Assign & Lock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', italic: true }}>
                  ✓ No unassigned conflict items currently requiring decisions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 6: FULFILLMENT & SHIPPING TRACKING */}
        {currentView === 'fulfillment' && currentUser?.role === 'admin' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">📦 Execution & Shipping Tracker</h1>
                <p className="page-subtitle">Track physical movement of items to family, library, museum, or donation.</p>
              </div>
            </div>

            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--accent-gold)' }}>
                    <th style={{ padding: '0.75rem' }}>Item</th>
                    <th style={{ padding: '0.75rem' }}>Destination</th>
                    <th style={{ padding: '0.75rem' }}>Recipient</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter(i => i.status === 'assigned' || i.status === 'completed').map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{item.title}</td>
                      <td style={{ padding: '0.75rem' }}>{item.destination_name || 'Family Pickup'}</td>
                      <td style={{ padding: '0.75rem' }}>{item.assigned_to_name || 'Library / Museum'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge badge-${item.status}`}>{item.status}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => alert(`Tracking update for ${item.title}`)}>
                          Update Tracking
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ASSIGNMENT MODAL (Admin Workflow) */}
      {assignModalItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ maxWidth: '450px', width: '90%' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', marginBottom: '0.75rem' }}>
              🎯 Assign Item: {assignModalItem.title}
            </h2>

            <div className="form-group">
              <label className="form-label">Destination Type</label>
              <select className="form-select" value={assignDestType} onChange={e => setAssignDestType(e.target.value)}>
                <option value="family">Family Member</option>
                <option value="library">Manitowish Waters Library</option>
                <option value="museum">Maritime Museum</option>
                <option value="donation">Donation Organization</option>
              </select>
            </div>

            {assignDestType === 'family' ? (
              <div className="form-group">
                <label className="form-label">Assign to Family Member</label>
                <select className="form-select" value={assignRecipient} onChange={e => setAssignRecipient(e.target.value)}>
                  <option value="">-- Select Recipient --</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Institution / Destination Name</label>
                <input type="text" className="form-input" placeholder="e.g. Manitowish Waters Historical Society" value={assignDestName} onChange={e => setAssignDestName(e.target.value)} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAssignModalItem(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAssignSubmit}>Save & Send Email</button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD INTEREST ON BEHALF MODAL */}
      {behalfModalItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ maxWidth: '450px', width: '90%' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', marginBottom: '0.75rem' }}>
              ✍️ Record Interest on Behalf
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Item: <strong>{behalfModalItem.title}</strong>
            </div>

            <div className="form-group">
              <label className="form-label">Select Relatives</label>
              <select className="form-select" value={behalfUserId} onChange={e => setBehalfUserId(e.target.value)}>
                <option value="">-- Select Family Member --</option>
                {usersList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Note / Phone Recollection</label>
              <input type="text" className="form-input" placeholder="e.g. Jean called Dan to request this item..." value={behalfComment} onChange={e => setBehalfComment(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBehalfModalItem(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleBehalfSubmit}>Record Interest</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
