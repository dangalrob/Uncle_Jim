import React, { useState, useEffect, useRef } from 'react';
import { 
  Trees, LayoutDashboard, Package, PlusCircle, Tag, Users, Layers, 
  BookOpen, CheckSquare, Truck, UserCheck, History, BarChart2, Settings, 
  Search, Filter, Heart, ArrowLeft, ArrowRight, CheckCircle2, Camera, 
  X, Check, Mail, Lock, Unlock, AlertCircle, Share2, HelpCircle, Menu,
  Wifi, WifiOff, UploadCloud, Building2, FileText, Sparkles, Loader2, Trash2
} from 'lucide-react';
import { offlineStorage } from './services/offlineStorage';
import AdminWorkbench from './components/AdminWorkbench';
import InstitutionPortal from './components/InstitutionPortal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // Default to login state until auth check completes
  const [captureStep, setCaptureStep] = useState('take_photo'); // 'take_photo', 'add_more', 'enter_details', 'saved_confirmation'
  const [decisionRecorded, setDecisionRecorded] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [itemTitle, setItemTitle] = useState('');
  const [itemLocation, setItemLocation] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userDecision, setUserDecision] = useState('interested');
  const [userComment, setUserComment] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);

  const handleNavigateHome = () => {
    setMobileNavOpen(false);
    if (currentUser?.role === 'admin') {
      setCurrentView('dashboard');
    } else if (currentUser?.role === 'institution') {
      setCurrentView('institution');
    } else {
      setCurrentView('review');
    }
  };

  // Offline Mode & Staging State
  const [offlineMode, setOfflineMode] = useState(false);
  const [stagedItems, setStagedItems] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [myInterests, setMyInterests] = useState([]);
  
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [reviewProgress, setReviewProgress] = useState({ totalReleased: 0, reviewedByUser: 0 });
  const [reviewIndex, setReviewIndex] = useState(0);

  const [dashboardStats, setDashboardStats] = useState({
    totalItems: 0,
    draftItems: 0,
    releasedItems: 0,
    assignedItems: 0,
    completedItems: 0,
    needsDecision: [],
    categories: [],
    users: [],
    recentAudit: []
  });

  const [auditLogs, setAuditLogs] = useState([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    loadStagedQueue();
  }, []);

  const loadStagedQueue = async () => {
    try {
      const staged = await offlineStorage.getStagedItems();
      setStagedItems(staged || []);
    } catch (err) {
      console.error("IndexedDB error:", err);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-stats');
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleDeleteItem = async (itemId, e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!window.confirm("Are you sure you want to delete this item? This action cannot be undone.")) return;
    
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchItems();
        fetchDashboardStats(); // Update dashboard counts
      } else {
        alert("Failed to delete item.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting item.");
    }
  };

  const handleClearInventory = async () => {
    if (!window.confirm("Are you sure you want to clear all inventory items? This will remove test items so you can start with a 100% clean estate database.")) return;
    try {
      const res = await fetch('/api/admin/clear-inventory', { method: 'POST' });
      if (res.ok) {
        alert("🎉 Success! Estate inventory reset to 0 items.");
        fetchItems();
        fetchDashboardStats();
      }
    } catch (err) {
      alert("Error clearing inventory");
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchCategories();
      fetchItems();
      fetchUsers();
      fetchReviewProgress();
      fetchDashboardStats();
    }
  }, [currentUser, currentView]);

  // Auto-engage iPhone camera file picker when entering Add Item view
  useEffect(() => {
    if (currentView === 'capture' && captureStep === 'take_photo' && capturedPhotos.length === 0) {
      const timer = setTimeout(() => {
        if (cameraInputRef.current) {
          cameraInputRef.current.click();
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentView, captureStep, capturedPhotos]);

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
      if (res.ok) setItems(await res.json());
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



  const handlePhotosSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newPhotos = files.map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));
      setCapturedPhotos(prev => [...prev, ...newPhotos]);
      setCaptureStep('enter_details');
    }
    // Crucial fix: Reset the input value so subsequent camera captures 
    // (which often have the same filename like "image.jpg") will trigger onChange again.
    e.target.value = null;
  };

  const handleTriggerCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    } else {
      handleSimulateCapture();
    }
  };

  const handleTriggerLibrary = () => {
    if (libraryInputRef.current) {
      libraryInputRef.current.click();
    } else {
      handleSimulateCapture();
    }
  };

  const handleOpenCapture = () => {
    setCapturedPhotos([]);
    setItemTitle('');
    setItemLocation('');
    setItemCategory('');
    setItemNotes('');
    setCaptureStep('take_photo');
    setCurrentView('capture');
    setMobileNavOpen(false);
    setTimeout(() => {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }, 150);
  };

  const handleSimulateCapture = () => {
    const samplePhotos = [
      { url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80' },
      { url: 'https://images.unsplash.com/photo-1580481072645-022f9a6d8310?auto=format&fit=crop&w=600&q=80' }
    ];
    setCapturedPhotos(prev => (prev.length > 0 ? prev : samplePhotos));
    setCaptureStep('enter_details');
  };

  const compressPhotoTo2048 = (file) => {
    return new Promise((resolve) => {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 2048; // 2K HD target (high detail + fast 0.4s upload)
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name ? file.name.replace(/\.[^/.]+$/, "") + ".jpg" : "photo.jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleSaveItemCapture = async () => {
    if (isSavingItem) return;
    setIsSavingItem(true);

    try {
      // Step 1: Instant client-side compression to 2048px 2K HD (~350KB)
      const compressedList = [];
      for (let p of capturedPhotos) {
        if (p.file) {
          const compFile = await compressPhotoTo2048(p.file);
          compressedList.push({
            file: compFile,
            url: URL.createObjectURL(compFile)
          });
        } else {
          compressedList.push(p);
        }
      }

      if (offlineMode) {
        // Save locally to IndexedDB staging store on iPhone
        await offlineStorage.saveStagedItem({
          title: itemTitle || 'Staged Item',
          locationInHouse: itemLocation || 'House',
          categoryId: itemCategory,
          notes: itemNotes
        }, compressedList);
        await loadStagedQueue();
        setCaptureStep('saved_confirmation');
        return;
      }

      const formData = new FormData();
      formData.append('title', itemTitle || 'Dining Chair');
      formData.append('locationInHouse', itemLocation || 'Dining room');
      formData.append('categoryId', itemCategory);
      for (let p of compressedList) {
        if (p.file) formData.append('photos', p.file);
      }

      await fetch('/api/items/rapid-capture', {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      // Fallback to offline staging if network error occurs
      await offlineStorage.saveStagedItem({
        title: itemTitle || 'Staged Item',
        locationInHouse: itemLocation || 'House',
        categoryId: itemCategory,
        notes: itemNotes
      }, capturedPhotos);
      await loadStagedQueue();
    } finally {
      setIsSavingItem(false);
    }
    setCaptureStep('saved_confirmation');
    fetchItems();
  };

  const handleSyncStagedBatch = async () => {
    if (stagedItems.length === 0) return;
    setIsSyncing(true);
    try {
      const formData = new FormData();
      const itemsMeta = [];

      for (let item of stagedItems) {
        itemsMeta.push({
          title: item.title,
          locationInHouse: item.locationInHouse,
          categoryId: item.categoryId,
          notes: item.notes
        });
        if (item.photos) {
          for (let p of item.photos) {
            if (p.data) formData.append('photos', p.data, p.name || 'staged.jpg');
          }
        }
      }

      formData.append('items', JSON.stringify(itemsMeta));

      const res = await fetch('/api/items/batch-sync', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        await offlineStorage.clearStagedQueue();
        await loadStagedQueue();
        fetchItems();
        alert(`🎉 Success! Synced ${stagedItems.length} staged items to estate cloud.`);
      }
    } catch (err) {
      alert("Error syncing staged items. Please check Wi-Fi connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveFamilyDecision = async (itemId) => {
    try {
      const res = await fetch(`/api/items/${itemId}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestLevel: userDecision, comment: userComment })
      });
      if (res.ok) {
        setDecisionRecorded(true);
        setUserComment('');
        fetchReviewProgress();
        fetchItems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyInterests = async () => {
    try {
      const res = await fetch('/api/reports/my-interests');
      if (res.ok) setMyInterests(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  // Offline SVG Placeholder for sample items when offline
  const OFFLINE_THUMB = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23234e38"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23d4af37" font-family="serif" font-size="20">Uncle Jim's Estate Photo</text></svg>`;

  const demoUsers = [
    { name: 'Dan Robinson', role: 'admin', email: 'dan@unclejim.estate', badge: '👑 Admin (Dan)' },
    { name: 'Cousin Sarah', role: 'contributor', email: 'sarah@unclejim.estate', badge: '📸 Photographer (Sarah)' },
    { name: 'Aunt Jean', role: 'reviewer', email: 'jean@unclejim.estate', badge: '💙 Standard User (Aunt Jean)' },
    { name: 'City Historical Museum', role: 'institution', email: 'museum@unclejim.estate', badge: '🏛️ Institution (Museum)' }
  ];

  const releasedItems = items.filter(i => ['released', 'assigned', 'distributed', 'completed'].includes(i.status));

  return (
    <div className="app-layout">
      {/* MOBILE NAVIGATION BACKDROP OVERLAY */}
      {currentUser && currentView !== 'login' && mobileNavOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* SIDEBAR NAVIGATION (Admin, Mobile Drawer, & All Views) */}
      {currentUser && currentView !== 'login' && (
        <aside className={`sidebar ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
          <div className="sidebar-header">
            <Trees className="sidebar-logo" color="var(--gold-accent)" />
            <div className="sidebar-title">Uncle Jim's Estate</div>
            <button className="mobile-close-btn" onClick={() => setMobileNavOpen(false)}>
              <X size={20} color="#fff" />
            </button>
          </div>

          <div className="sidebar-menu">
            {/* UNIVERSAL HOME / MAIN MENU BUTTON FOR ALL ROLES */}
            <button
              className={`sidebar-item ${['dashboard', 'review'].includes(currentView) ? 'active' : ''}`}
              onClick={handleNavigateHome}
            >
              <LayoutDashboard size={18} /> 🏠 Main Dashboard
            </button>

            {currentUser?.role === 'admin' && (
              <button className={`sidebar-item ${currentView === 'workbench' ? 'active' : ''}`} onClick={() => { setCurrentView('workbench'); setMobileNavOpen(false); }}>
                <Sparkles size={18} /> AI Research Workbench
              </button>
            )}

            {(currentUser?.role === 'admin' || currentUser?.role === 'reviewer' || currentUser?.role === 'contributor') && (
              <button className={`sidebar-item ${currentView === 'catalog' ? 'active' : ''}`} onClick={() => { setCurrentView('catalog'); setMobileNavOpen(false); }}>
                <Package size={18} /> Inventory Catalog
              </button>
            )}

            {(currentUser?.role === 'admin' || currentUser?.role === 'contributor') && (
              <button className={`sidebar-item ${currentView === 'capture' ? 'active' : ''}`} onClick={handleOpenCapture}>
                <PlusCircle size={18} /> Add Item (Camera)
              </button>
            )}

            {(currentUser?.role === 'admin' || currentUser?.role === 'reviewer') && (
              <button className={`sidebar-item ${currentView === 'review' ? 'active' : ''}`} onClick={() => { setCurrentView('review'); setDecisionRecorded(false); setMobileNavOpen(false); }}>
                <BookOpen size={18} /> Family Review (1-by-1)
              </button>
            )}

            {currentUser?.role === 'reviewer' && (
              <button className={`sidebar-item ${currentView === 'my_interests' ? 'active' : ''}`} onClick={() => { setCurrentView('my_interests'); fetchMyInterests(); setMobileNavOpen(false); }}>
                <Heart size={18} /> My Interested Items
              </button>
            )}

            {(currentUser?.role === 'admin' || currentUser?.role === 'institution') && (
              <button className={`sidebar-item ${currentView === 'institution' ? 'active' : ''}`} onClick={() => { setCurrentView('institution'); setMobileNavOpen(false); }}>
                <Building2 size={18} /> Institution Portal
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button className={`sidebar-item ${currentView === 'assignments' ? 'active' : ''}`} onClick={() => { setCurrentView('assignments'); setMobileNavOpen(false); }}>
                <UserCheck size={18} /> Assignments
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button className={`sidebar-item ${currentView === 'distribution' ? 'active' : ''}`} onClick={() => { setCurrentView('distribution'); setMobileNavOpen(false); }}>
                <Truck size={18} /> Distribution
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button className={`sidebar-item ${currentView === 'draft_mode' ? 'active' : ''}`} onClick={() => { setCurrentView('draft_mode'); setMobileNavOpen(false); }}>
                <Layers size={18} /> Draft Mode
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button className={`sidebar-item ${currentView === 'email_preview' ? 'active' : ''}`} onClick={() => { setCurrentView('email_preview'); setMobileNavOpen(false); }}>
                <Mail size={18} /> Email Catalog Report
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button className={`sidebar-item ${currentView === 'logs' ? 'active' : ''}`} onClick={() => { setCurrentView('logs'); fetchAuditLogs(); setMobileNavOpen(false); }}>
                <History size={18} /> Logs
              </button>
            )}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button className="sidebar-item" onClick={() => { setMobileNavOpen(false); handleLogout(); }}>
              <X size={18} /> Sign Out ({currentUser?.name || ''})
            </button>
          </div>
        </aside>
      )}

      <div className="main-wrapper">
        {/* TOP HEADER */}
        {currentUser && currentView !== 'login' && (
          <div>
            <header className="top-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className="mobile-toggle-btn" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
                  <Menu size={22} color="var(--pine-deep)" />
                </button>

                <div className="header-brand">
                  <Trees className="header-logo-icon" color="var(--pine-primary)" />
                  <div className="header-title-box">
                    <span className="header-title">Uncle Jim's Estate</span>
                  </div>
                </div>
              </div>

              {/* OFFLINE MODE TOGGLE SWITCH & STAGED QUEUE BANNER */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  className={`btn-outline ${offlineMode ? 'btn-amber-active' : ''}`}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => setOfflineMode(!offlineMode)}
                >
                  {offlineMode ? <WifiOff size={16} color="#d32f2f" /> : <Wifi size={16} color="#2e7d32" />}
                  <span>{offlineMode ? 'Offline Mode: ON' : 'Offline Mode: OFF'}</span>
                </button>

                <div className="header-user-menu">
                  <div className="user-avatar">{(currentUser?.name || 'User').split(' ').map(n=>n[0]).join('')}</div>
                  <div className="user-info-text">
                    <div style={{ fontWeight: 'bold' }}>{currentUser?.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{currentUser?.role}</div>
                  </div>
                </div>
              </div>
            </header>

            {/* STATUS BANNER 1: OFFLINE MODE IS ACTIVE */}
            {offlineMode && (
              <div style={{ background: '#fff3cd', color: '#664d03', borderBottom: '1px solid #ffecb5', padding: '0.6rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', fontWeight: 'bold' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <WifiOff size={18} />
                  <span>⚡ OFFLINE MODE IS ON — Photos save directly to your iPhone storage without network calls.</span>
                </div>
                <button className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={() => setOfflineMode(false)}>
                  Turn OFF Offline Mode
                </button>
              </div>
            )}

            {/* STATUS BANNER 2: STAGED ITEMS PENDING UPLOAD */}
            {!offlineMode && stagedItems.length > 0 && (
              <div style={{ background: '#d1e7dd', color: '#0f5132', borderBottom: '1px solid #badbcc', padding: '0.65rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UploadCloud size={20} />
                  <span>📶 Wi-Fi CONNECTED — {stagedItems.length} Staged Items Ready to Upload to Cloud.</span>
                </div>
                <button className="btn-green-senior" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }} onClick={handleSyncStagedBatch} disabled={isSyncing}>
                  {isSyncing ? 'Uploading...' : `📤 UPLOAD BATCH (${stagedItems.length} ITEMS)`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="page-container">
          {/* MOCKUP 1: LOGIN / WELCOME SCREEN */}
          {currentView === 'login' && (
            <div className="login-card-grid">
              {/* Left Lake Photo Banner */}
              <div className="login-banner-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Trees size={32} color="var(--gold-accent)" />
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 'bold' }}>Uncle Jim's Estate</div>
                  </div>
                </div>
              </div>

              {/* Right Login Form */}
              <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--pine-deep)', marginBottom: '0.3rem' }}>Welcome</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Sign in to access the estate inventory.</p>

                {/* Quick Test Logins */}
                <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--pine-primary)', marginBottom: '0.4rem' }}>⚡ QUICK TEST LOGIN ACCOUNTS:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {demoUsers.map((u, idx) => (
                      <button key={idx} className="btn-outline" style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem', justifyContent: 'flex-start' }} onClick={() => handleLogin(u.email, 'password123')}>
                        {u.badge}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Email</label>
                    <input type="email" style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="dan@example.com" required />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Password</label>
                    <input type="password" style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn-green" style={{ width: '100%', padding: '0.75rem' }}>Sign In</button>
                </form>
              </div>
            </div>
          )}

          {/* MOCKUP 2: ADMIN DASHBOARD (HOME) */}
          {currentView === 'dashboard' && currentUser?.role === 'admin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--pine-deep)' }}>Good morning, Dan</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Here's the latest indicative status of Uncle Jim's estate inventory.</p>
                </div>
                <button className="btn-green" onClick={handleOpenCapture}>
                  + Add Item
                </button>
              </div>

              {/* 4 Indicative KPI Stat Buttons - CLICK TO VIEW FILTERED ITEMS */}
              <div className="kpi-grid">
                <button
                  className="kpi-card"
                  onClick={() => { setStatusFilter(''); setSearchQuery(''); setCurrentView('catalog'); }}
                  title="Click to view all estate inventory items"
                >
                  <div className="kpi-num">{items.length > 0 ? items.length : (dashboardStats.totalItems || 0)}</div>
                  <div className="kpi-label">Total Items</div>
                  <div className="kpi-btn-hint">View all items →</div>
                </button>

                <button
                  className="kpi-card"
                  onClick={() => { setStatusFilter('draft'); setSearchQuery(''); setCurrentView('catalog'); }}
                  title="Click to view draft items awaiting research & enrichment"
                >
                  <div className="kpi-num" style={{ color: '#6a7b72' }}>
                    {items.length > 0 ? items.filter(i => i.status === 'draft').length : (dashboardStats.draftItems || 0)}
                  </div>
                  <div className="kpi-label">Draft</div>
                  <div className="kpi-btn-hint">View draft queue →</div>
                </button>

                <button
                  className="kpi-card"
                  onClick={() => { setStatusFilter('released'); setSearchQuery(''); setCurrentView('catalog'); }}
                  title="Click to view released items for family review"
                >
                  <div className="kpi-num" style={{ color: '#2e7d32' }}>
                    {items.length > 0 ? items.filter(i => i.status === 'released').length : (dashboardStats.releasedItems || 0)}
                  </div>
                  <div className="kpi-label">Released</div>
                  <div className="kpi-btn-hint">View released catalog →</div>
                </button>

                <button
                  className="kpi-card"
                  onClick={() => { setStatusFilter('assigned'); setSearchQuery(''); setCurrentView('catalog'); }}
                  title="Click to view assigned & distributed items"
                >
                  <div className="kpi-num" style={{ color: '#1565c0' }}>
                    {items.length > 0 ? items.filter(i => ['assigned', 'completed', 'distributed'].includes(i.status)).length : (dashboardStats.assignedItems || 0)}
                  </div>
                  <div className="kpi-label">Assigned</div>
                  <div className="kpi-btn-hint">View assignments →</div>
                </button>
              </div>

              {/* Needs Your Attention & Management Panel */}
              <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
                <div className="dash-card-header">
                  <div className="dash-card-title">Needs Your Attention</div>
                  <button
                    className="btn-outline"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    onClick={() => { setCurrentView('logs'); fetchAuditLogs(); }}
                  >
                    📋 View Logs in Menu →
                  </button>
                </div>

                <div>
                  {dashboardStats.needsDecision && dashboardStats.needsDecision.length > 0 ? (
                    <div className="attention-item" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('assignments')}>
                      <div className="attention-bullet bullet-red"></div>
                      <div style={{ flex: 1, fontWeight: '500' }}>
                        {dashboardStats.needsDecision.length} item(s) with multiple interested family members waiting for assignment decision ➔
                      </div>
                    </div>
                  ) : (
                    <div className="attention-item">
                      <div className="attention-bullet bullet-green"></div>
                      <div style={{ flex: 1, fontWeight: '500' }}>
                        All item assignments and reviews are up to date!
                      </div>
                    </div>
                  )}

                  <div className="attention-item" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('workbench')}>
                    <div className="attention-bullet bullet-orange"></div>
                    <div style={{ flex: 1, fontWeight: '500' }}>
                      {items.filter(i => i.status === 'draft').length || dashboardStats.draftItems || 0} item(s) in Draft queue waiting for AI Workbench visual research ➔
                    </div>
                  </div>

                  <div className="attention-item" style={{ cursor: 'pointer' }} onClick={() => { setStatusFilter('released'); setCurrentView('catalog'); }}>
                    <div className="attention-bullet bullet-green"></div>
                    <div style={{ flex: 1, fontWeight: '500' }}>
                      {items.filter(i => i.status === 'released').length || dashboardStats.releasedItems || 0} item(s) currently released for family review ➔
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button className="btn-outline" style={{ fontSize: '0.85rem' }} onClick={() => { setCurrentView('logs'); fetchAuditLogs(); }}>
                    📜 Open Full Audit & Activity Logs
                  </button>
                  <button className="btn-outline" style={{ fontSize: '0.8rem', color: '#d32f2f', borderColor: '#ffcdd2' }} onClick={handleClearInventory}>
                    🗑️ Reset & Clear Inventory Database
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MOBILE ITEM CAPTURE FLOW */}
          {currentView === 'capture' && (
            <div className="mobile-frame">
              {/* Hidden File Inputs for Camera and Photo Library */}
              <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handlePhotosSelected} style={{ display: 'none' }} />
              <input type="file" ref={libraryInputRef} accept="image/*" multiple onChange={handlePhotosSelected} style={{ display: 'none' }} />

              {/* STEPPER PROGRESS BAR */}
              <div style={{ display: 'flex', background: '#1c3628', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', gap: '0.5rem' }}>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', padding: '0.4rem', borderRadius: '6px', background: ['take_photo', 'add_more'].includes(captureStep) ? 'var(--gold-accent)' : 'rgba(255,255,255,0.1)', color: ['take_photo', 'add_more'].includes(captureStep) ? '#1a3323' : '#b8ccbf' }}>
                  1. Photo
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', padding: '0.4rem', borderRadius: '6px', background: captureStep === 'enter_details' ? 'var(--gold-accent)' : 'rgba(255,255,255,0.1)', color: captureStep === 'enter_details' ? '#1a3323' : '#b8ccbf' }}>
                  2. Details
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', padding: '0.4rem', borderRadius: '6px', background: captureStep === 'saved_confirmation' ? 'var(--gold-accent)' : 'rgba(255,255,255,0.1)', color: captureStep === 'saved_confirmation' ? '#1a3323' : '#b8ccbf' }}>
                  3. Saved
                </div>
              </div>

              {/* STEP 3A: TAKE OR SELECT A PHOTO */}
              {captureStep === 'take_photo' && (
                <div className="camera-screen-dark" style={{ padding: '1.25rem' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button className="btn-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', fontSize: '0.9rem', padding: '0.4rem 0.8rem' }} onClick={handleNavigateHome}>
                      ← Return to Main Menu
                    </button>
                    <span style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>Add New Item</span>
                    <div style={{ width: '40px' }}></div>
                  </div>

                  <div className="viewfinder-box" onClick={handleTriggerCamera} style={{ cursor: 'pointer', background: '#14241c', border: '2px dashed var(--gold-accent)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', width: '100%' }}>
                    {capturedPhotos[0]?.url ? (
                      <img src={capturedPhotos[0].url} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px' }} alt="Captured Preview" />
                    ) : (
                      <>
                        <Camera size={52} color="var(--gold-accent)" style={{ marginBottom: '0.75rem' }} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>Tap to Take Photo or Upload</div>
                        <div style={{ fontSize: '0.82rem', color: '#b8ccbf', marginTop: '4px' }}>Optimized 2K HD Instant Capture</div>
                      </>
                    )}
                  </div>

                  {/* 2 Prominent Senior-Friendly Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%', marginTop: '1.25rem' }}>
                    <button className="btn-green-senior" style={{ width: '100%', minHeight: '56px', fontSize: '1rem' }} onClick={handleTriggerCamera}>
                      <Camera size={22} /> 📷 TAKE PHOTO WITH CAMERA
                    </button>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '54px', fontSize: '0.95rem', fontWeight: 'bold', background: '#ffffff', color: 'var(--pine-deep)', justifyContent: 'center' }} onClick={handleTriggerLibrary}>
                      🖼️ CHOOSE FROM PHOTO LIBRARY
                    </button>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '46px', color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)', background: 'transparent', justifyContent: 'center', marginTop: '0.5rem' }} onClick={handleNavigateHome}>
                      🏠 Cancel & Return to Main Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3B: ADD MORE PHOTOS OR PROCEED */}
              {captureStep === 'add_more' && (
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1rem' }}>
                    <button className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={handleNavigateHome}>
                      ← Return to Main Menu
                    </button>
                    <span style={{ color: 'var(--pine-primary)', fontWeight: 'bold' }}>{capturedPhotos.length} Photo(s) Selected</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {capturedPhotos.map((p, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img src={p.url} style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                        <button
                          style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(211,47,47,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          onClick={() => setCapturedPhotos(prev => prev.filter((_, i) => i !== idx))}
                          title="Remove Photo"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn-outline" style={{ width: '100%', minHeight: '50px', justifyContent: 'center', fontSize: '0.92rem', fontWeight: '600' }} onClick={handleTriggerCamera}>
                      📷 Take Another Photo with Camera
                    </button>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '50px', justifyContent: 'center', fontSize: '0.92rem', fontWeight: '600' }} onClick={handleTriggerLibrary}>
                      🖼️ Choose Another from Photo Library
                    </button>

                    <button className="btn-green-senior" style={{ width: '100%', minHeight: '56px', fontSize: '1rem', marginTop: '0.5rem' }} onClick={() => setCaptureStep('enter_details')}>
                      Next: Enter Item Details ➔
                    </button>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '48px', justifyContent: 'center', fontSize: '0.92rem', fontWeight: 'bold' }} onClick={handleNavigateHome}>
                      🏠 Return to Main Menu / Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3C: ENTER BASIC DETAILS */}
              {captureStep === 'enter_details' && (
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    <button className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }} onClick={() => setCaptureStep('add_more')}>
                      ← Back to Photos
                    </button>
                    <span>New Item Details</span>
                    <button className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }} onClick={handleNavigateHome}>
                      Cancel
                    </button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <img src={capturedPhotos[0]?.url || OFFLINE_THUMB} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px' }} />
                    <button style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={handleTriggerLibrary}>
                      🖼️ + Add Photos
                    </button>
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>Title (optional)</label>
                    <input type="text" className="senior-input" value={itemTitle} placeholder="Vintage Nautical Telescope" onChange={e=>setItemTitle(e.target.value)} />
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>Category (optional)</label>
                    <select className="senior-input" value={itemCategory} onChange={e=>setItemCategory(e.target.value)}>
                      <option value="">Furniture & Decor</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>Quick Notes (optional)</label>
                    <textarea className="senior-input" rows="2" value={itemNotes} placeholder="Brass & mahogany telescope on wooden tripod. Excellent condition." onChange={e=>setItemNotes(e.target.value)}></textarea>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>Location in House (optional)</label>
                    <input type="text" className="senior-input" value={itemLocation} placeholder="Study Desk / Living Room" onChange={e=>setItemLocation(e.target.value)} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                      className="btn-green-senior"
                      style={{ width: '100%', minHeight: '56px', background: isSavingItem ? '#e69c24' : 'var(--pine-primary)' }}
                      onClick={handleSaveItemCapture}
                      disabled={isSavingItem}
                    >
                      {isSavingItem ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                          <Loader2 className="animate-spin" size={22} />
                          <span>⏳ Saving & Compressing Photos...</span>
                        </div>
                      ) : (
                        <span>💾 SAVE ITEM TO INVENTORY</span>
                      )}
                    </button>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '48px', justifyContent: 'center', fontSize: '0.92rem', fontWeight: 'bold' }} onClick={handleNavigateHome}>
                      🏠 Cancel & Return to Main Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3D: NEW ITEM CREATED CONFIRMATION */}
              {captureStep === 'saved_confirmation' && (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                  <div className="check-circle-lg">✓</div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', fontSize: '1.6rem' }}>Item Saved!</h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Your item has been saved to the estate inventory queue.</p>

                  <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '10px', display: 'flex', gap: '0.85rem', alignItems: 'center', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid var(--border-color)' }}>
                    <img src={capturedPhotos[0]?.url || OFFLINE_THUMB} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{itemTitle || 'New Estate Item'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{capturedPhotos.length || 1} photo(s) saved</div>
                    </div>
                  </div>

                  {/* 3 Clear Senior-Friendly Exit Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <button className="btn-green-senior" style={{ width: '100%', minHeight: '54px' }} onClick={handleOpenCapture}>
                      ➕ ADD ANOTHER ITEM
                    </button>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '50px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 'bold' }} onClick={handleNavigateHome}>
                      🏠 RETURN TO MAIN MENU / DASHBOARD
                    </button>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '48px', justifyContent: 'center', fontSize: '0.95rem' }} onClick={() => setCurrentView('catalog')}>
                      📋 VIEW INVENTORY CATALOG
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MOCKUP 5: FAMILY MEMBER BROWSE & SEARCH */}
          {currentView === 'catalog' && (
            <div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, display: 'flex', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', alignItems: 'center' }}>
                  <Search size={18} color="var(--text-muted)" style={{ marginRight: '0.5rem' }} />
                  <input type="text" style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem' }} placeholder="Search books, artwork, maritime..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
                  {searchQuery && (
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }} onClick={() => setSearchQuery('')} title="Clear Search">
                      <X size={16} />
                    </button>
                  )}
                </div>
                {(searchQuery || categoryFilter || statusFilter) && (
                  <button className="btn-outline" style={{ fontSize: '0.82rem', color: '#d32f2f', borderColor: '#ffcdd2' }} onClick={() => { setSearchQuery(''); setCategoryFilter(''); setStatusFilter(''); }}>
                    <X size={14} style={{ marginRight: '4px' }} /> Clear Filters
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Search size={48} color="var(--pine-primary)" style={{ opacity: 0.4, marginBottom: '1rem' }} />
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--pine-deep)' }}>No items found</h3>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: '1.25rem' }}>No catalog possessions match your current search or filter criteria.</p>
                  <button className="btn-green" style={{ padding: '0.65rem 1.25rem' }} onClick={() => { setSearchQuery(''); setCategoryFilter(''); setStatusFilter(''); }}>
                    🔄 Reset All Search & Filters
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  {items.map(item => (
                    <div key={item.id} className="card" style={{ padding: '0.85rem', cursor: 'pointer', position: 'relative' }} onClick={() => { setSelectedItem(item); setCurrentView('review'); }}>
                      <div style={{ position: 'relative' }}>
                        <img src={item.primary_photo || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }} />
                        <Heart size={18} color="#d32f2f" style={{ position: 'absolute', bottom: '12px', right: '12px', background: '#fff', borderRadius: '50%', padding: '3px' }} />
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(211,47,47,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
                            title="Delete Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{item.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.category_name || "Books"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MOCKUP 6 & 7: FAMILY MEMBER REVIEW ITEM (ONE AT A TIME) */}
          {currentView === 'review' && (
            <div className="review-view-container">
              <div className="review-top-bar">
                <button className="btn-outline" onClick={() => setCurrentView('catalog')}><ArrowLeft size={16} /> Back to Browse</button>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Item {(reviewIndex % Math.max(1, items.length)) + 1} of {items.length || 1}</span>
                <div>
                  <button className="btn-outline" style={{ padding: '0.4rem 0.6rem' }} onClick={() => setReviewIndex(prev => (prev - 1 + Math.max(1, items.length)) % Math.max(1, items.length))} title="Previous Item"><ArrowLeft size={16} /></button>
                  <button className="btn-outline" style={{ padding: '0.4rem 0.6rem', marginLeft: '4px' }} onClick={() => setReviewIndex(prev => (prev + 1) % Math.max(1, items.length))} title="Next Item"><ArrowRight size={16} /></button>
                </div>
              </div>

              {!decisionRecorded ? (
                <div>
                  {/* Mockup 6 Main Card */}
                  <div className="review-main-card">
                    <div className="review-left-gallery">
                      <img src={(items[reviewIndex % Math.max(1, items.length)]?.primary_photo) || "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80"} className="review-main-img" alt="Item Preview" />
                      <div className="review-thumbs-row">
                        <img src={(items[reviewIndex % Math.max(1, items.length)]?.primary_photo) || "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80"} className="review-thumb active" alt="Thumb 1" />
                        <img src="https://images.unsplash.com/photo-1580481072645-022f9a6d8310?auto=format&fit=crop&w=400&q=80" className="review-thumb" alt="Thumb 2" />
                        <img src="https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=400&q=80" className="review-thumb" alt="Thumb 3" />
                      </div>
                    </div>

                    <div className="review-right-info">
                      <div className="review-item-header">
                        <h2 className="review-item-name">{items[reviewIndex % Math.max(1, items.length)]?.title || "Dining Chair"}</h2>
                        <Heart size={22} color="#d32f2f" fill="#d32f2f" />
                      </div>

                      <table className="details-table">
                        <tbody>
                          <tr><td className="label">Category</td><td className="val">{items[reviewIndex % Math.max(1, items.length)]?.category_name || "Furniture"}</td></tr>
                          <tr><td className="label">Location</td><td className="val">{items[reviewIndex % Math.max(1, items.length)]?.location_in_house || "Dining Room"}</td></tr>
                          <tr><td className="label">Dimensions</td><td className="val">{items[reviewIndex % Math.max(1, items.length)]?.dimensions || "18\" W x 18\" D x 36\" H"}</td></tr>
                          <tr><td className="label">Condition</td><td className="val">{items[reviewIndex % Math.max(1, items.length)]?.condition || "Good"}</td></tr>
                        </tbody>
                      </table>

                      <div className="review-section-title">Description</div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                        {items[reviewIndex % Math.max(1, items.length)]?.description || "Solid wood dining chair from the lake house. Classic style, very sturdy."}
                      </div>

                      <div className="review-section-title">Story / History</div>
                      <div className="review-story-text">
                        "These chairs were at the cabin for as long as I can remember. Uncle Jim used them for big family dinners every summer."
                      </div>

                      <div className="tags-row">
                        <span className="tag-pill">dining</span>
                        <span className="tag-pill">wood</span>
                        <span className="tag-pill">lake house</span>
                      </div>
                    </div>
                  </div>

                  {/* Mockup 7: Who's Interested & Decision Panel */}
                  <div className="decision-panel">
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', marginBottom: '0.85rem' }}>Who's interested?</h3>
                    <div className="interested-relatives-list">
                      <div className="relative-interest-row">
                        <div className="user-avatar" style={{ background: '#1976d2' }}>JH</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Jean</div>
                        <Heart size={16} color="#d32f2f" fill="#d32f2f" />
                        <div className="relative-comment">"I remember sitting in this chair as a kid."</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sep 3</div>
                      </div>
                      <div className="relative-interest-row">
                        <div className="user-avatar" style={{ background: '#7b1fa2' }}>TM</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Tim</div>
                        <Heart size={16} color="#d32f2f" fill="#d32f2f" />
                        <div className="relative-comment">"Love this chair!"</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sep 3</div>
                      </div>
                      <div className="relative-interest-row">
                        <div className="user-avatar" style={{ background: '#388e3c' }}>SB</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Susan</div>
                        <Heart size={16} color="#d32f2f" fill="#d32f2f" />
                        <div className="relative-comment">"Would be perfect in our sunroom."</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sep 2</div>
                      </div>
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', marginBottom: '0.85rem' }}>Your decision</h3>
                    <div className="decision-btn-group">
                      <button className={`btn-decision ${userDecision === 'interested' ? 'active-interested' : ''}`} onClick={() => setUserDecision('interested')}>
                        💙 I'm Interested
                      </button>
                      <button className={`btn-decision ${userDecision === 'not_interested' ? 'active-pass' : ''}`} onClick={() => setUserDecision('not_interested')}>
                        🚫 Not Interested
                      </button>
                      <button className="btn-decision" onClick={() => setUserDecision('skip')}>
                        ⏰ Skip for Now
                      </button>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <input type="text" className="form-input" style={{ width: '100%' }} placeholder="Add an optional comment..." value={userComment} onChange={e=>setUserComment(e.target.value)} />
                    </div>

                    <button className="btn-green" style={{ width: '100%', padding: '0.8rem' }} onClick={() => handleSaveFamilyDecision(items[reviewIndex % Math.max(1, items.length)]?.id || 'item_101')}>
                      Save My Decision
                    </button>
                  </div>
                </div>
              ) : (
                /* MOCKUP 8: DECISION RECORDED CONFIRMATION */
                <div className="confirmation-card">
                  <div className="check-circle-lg">✓</div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: 'var(--pine-deep)' }}>Thanks!</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Your decision has been recorded.</p>

                  <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>You marked:</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2e7d32', marginTop: '4px' }}>
                      {userDecision === 'interested' ? "❤️ I'm Interested" : userDecision === 'not_interested' ? "🚫 Not Interested" : "⏰ Skipped"}
                    </div>
                  </div>

                  <button className="btn-green" style={{ width: '100%', padding: '0.85rem' }} onClick={() => { setDecisionRecorded(false); setReviewIndex(prev => (prev + 1) % Math.max(1, items.length)); }}>
                    Proceed to Next Item ➔
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MOCKUP 9: ADMIN ASSIGNMENTS */}
          {currentView === 'assignments' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">🎯 Assignments</h1>
                  <p className="page-subtitle">Assign items to family members or institutions and lock finalized choices.</p>
                </div>
                <button className="btn-outline">Export</button>
              </div>

              <div className="data-table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Interested</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Dining Chair</td>
                      <td>Furniture</td>
                      <td><span style={{ color: '#d32f2f', fontWeight: 'bold' }}>3</span></td>
                      <td>—</td>
                      <td><span className="badge-status badge-needs-decision">Needs Decision</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Vintage Compass</td>
                      <td>Maritime</td>
                      <td>2</td>
                      <td>Jean</td>
                      <td><span className="badge-status badge-assigned">Assigned</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Sailing Print</td>
                      <td>Artwork</td>
                      <td>1</td>
                      <td>Tim</td>
                      <td><span className="badge-status badge-assigned">Assigned</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MOCKUP 10: ADMIN DISTRIBUTION / SHIPPING */}
          {currentView === 'distribution' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">🚚 Distribution</h1>
                  <p className="page-subtitle">Track pickup, packing, and shipment status.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button className={`btn-outline ${distributionTab === 'all' ? 'btn-green' : ''}`} onClick={()=>setDistributionTab('all')}>All (76)</button>
                <button className="btn-outline">Waiting (12)</button>
                <button className="btn-outline">Shipping (10)</button>
                <button className="btn-outline">Completed (54)</button>
              </div>

              <div className="data-table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Recipient</th>
                      <th>Status</th>
                      <th>Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Sailing Print</td>
                      <td>Tim</td>
                      <td><span className="badge-status badge-ready">Ready for Pickup</span></td>
                      <td>—</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Box of Books</td>
                      <td>Library</td>
                      <td><span className="badge-status badge-shipped">Shipped</span></td>
                      <td><code>1Z99AA101234</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MOCKUP 11: DRAFT MODE (OPTIONAL FANTASY DRAFT) */}
          {currentView === 'draft_mode' && (
            <div>
              <div style={{ background: 'var(--pine-primary)', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>Estate Draft</span>
                <span className="badge-status" style={{ background: '#fff', color: 'var(--pine-primary)' }}>Draft Mode</span>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>Round 1 of 5 | Tim's Pick</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span className="btn-green" style={{ padding: '0.4rem 0.85rem' }}>1 Tim</span>
                  <span className="btn-outline" style={{ padding: '0.4rem 0.85rem' }}>2 Jean</span>
                  <span className="btn-outline" style={{ padding: '0.4rem 0.85rem' }}>3 Susan</span>
                  <span className="btn-outline" style={{ padding: '0.4rem 0.85rem' }}>4 Matt</span>
                </div>
              </div>
            </div>
          )}

          {/* MOCKUP 12: EMAIL NOTIFICATION PREVIEW */}
          {currentView === 'email_preview' && (
            <div className="email-preview-card">
              <div className="email-meta-header">
                <div>From: <strong>Uncle Jim's Estate &lt;noreply@unclejimestate.com&gt;</strong></div>
                <div>To: <strong>tim@example.com</strong></div>
                <div>Subject: <strong>An item from Uncle Jim's estate has been assigned to you</strong></div>
              </div>

              <div className="email-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Trees color="var(--pine-primary)" size={24} />
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 'bold', fontSize: '1.1rem' }}>Uncle Jim's Estate</span>
                </div>

                <p style={{ marginBottom: '1rem' }}>Hi Tim,</p>
                <p style={{ marginBottom: '1rem' }}>An item from Uncle Jim's estate has been assigned to you.</p>

                <div className="email-item-banner">
                  <img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80" style={{ width: '80px', height: '65px', objectFit: 'cover', borderRadius: '6px' }} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Dining Chair</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Furniture</div>
                  </div>
                  <button className="btn-green" style={{ marginLeft: 'auto', fontSize: '0.82rem' }}>View Item in the App</button>
                </div>
              </div>
            </div>
          )}

          {/* AI RESEARCH WORKBENCH VIEW */}
          {currentView === 'workbench' && (
            <AdminWorkbench
              items={items.filter(i => i.status === 'draft' || !i.status || i.status === 'released')}
              onApproveEnrichment={async (id, enrichedData) => {
                try {
                  await fetch(`/api/items/${id}/enrich`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(enrichedData)
                  });
                  await fetchItems();
                  await fetchDashboardStats();
                  alert(`🎉 Approved "${enrichedData.title}" and released to family catalog!`);
                } catch (err) {
                  alert("Failed to save approved record");
                }
              }}
              onDeleteItem={async (id) => {
                try {
                  const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
                  if (res.ok) {
                    await fetchItems();
                    await fetchDashboardStats();
                  }
                } catch (err) {
                  alert("Failed to delete item");
                }
              }}
            />
          )}

          {/* INSTITUTION PARTNER PORTAL VIEW */}
          {currentView === 'institution' && (
            <InstitutionPortal
              items={items.filter(i => i.status === 'released' || i.status === 'draft')}
              onAskQuestion={async (itemId, q) => {
                await fetch('/api/items/inquiry', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ itemId, question: q })
                });
              }}
              onToggleInterest={async (itemId, level) => {
                await handleSaveFamilyDecision(itemId);
              }}
            />
          )}

          {/* MY INTERESTED ITEMS REPORT VIEW FOR STANDARD USERS */}
          {currentView === 'my_interests' && (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.75rem', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--bg-app)', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--pine-deep)' }}>
                    💙 My Interested Items Report
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    Items you have marked interest in. You can change your decision or update comments anytime.
                  </p>
                </div>
                <button className="btn-outline" onClick={fetchMyInterests}>Refresh Report</button>
              </div>

              {myInterests.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Heart size={48} color="var(--pine-primary)" style={{ opacity: 0.5, marginBottom: '0.85rem' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>You haven't requested any items yet</div>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.3rem' }}>Browse the catalog or Family Review to indicate items you are interested in.</p>
                  <button className="btn-green-senior" style={{ marginTop: '1.25rem', padding: '0.75rem 1.5rem' }} onClick={() => setCurrentView('catalog')}>
                    Browse Catalog Now ➔
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {myInterests.map((item) => (
                    <div key={item.id} style={{ display: 'flex', gap: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', background: '#f9fbf9', alignItems: 'center' }}>
                      <img src={item.primary_photo || OFFLINE_THUMB} style={{ width: '100px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} alt={item.title} />
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--pine-deep)' }}>{item.title}</h3>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Location: {item.location_in_house}</div>
                        {item.comment && (
                          <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: '#234e38', background: '#e8f0ec', padding: '0.4rem 0.75rem', borderRadius: '6px', display: 'inline-block' }}>
                            "{item.comment}"
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                        <span className={`badge-status ${item.interest_level === 'interested' ? 'badge-released' : 'badge-draft'}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                          {item.interest_level === 'interested' ? '❤️ Marked Interested' : '🚫 Pass'}
                        </span>
                        <button className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }} onClick={() => { setSelectedItem(item); setCurrentView('review'); }}>
                          Change Decision ➔
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADMIN AUDIT & ACTIVITY LOGS VIEW (ACCESSED VIA MENU) */}
          {currentView === 'logs' && currentUser?.role === 'admin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--pine-deep)' }}>📋 Activity & Audit Logs</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time chronological log of all estate inventory actions, reviews, assignments, and updates.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-outline" onClick={fetchAuditLogs}>
                    🔄 Refresh Logs
                  </button>
                  <button className="btn-green" onClick={handleNavigateHome}>
                    🏠 Return to Dashboard
                  </button>
                </div>
              </div>

              {/* Search & Filter Logs Bar */}
              <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search logs by user, action, target item, or notes..."
                    value={logSearchQuery}
                    onChange={e => setLogSearchQuery(e.target.value)}
                    style={{ width: '100%', paddingLeft: '2.4rem' }}
                  />
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  {logSearchQuery && (
                    <button
                      onClick={() => setLogSearchQuery('')}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Showing {auditLogs.filter(log => {
                    if (!logSearchQuery) return true;
                    const q = logSearchQuery.toLowerCase();
                    const action = (log.action || '').toLowerCase();
                    const user = (log.user_name || log.user_email || log.user_id || '').toLowerCase();
                    const details = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
                    const target = (log.target_type || '').toLowerCase();
                    return action.includes(q) || user.includes(q) || details.includes(q) || target.includes(q);
                  }).length} event(s)
                </span>
              </div>

              {/* Logs Data Table Card */}
              <div className="logs-card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="log-table">
                    <thead>
                      <tr>
                        <th style={{ width: '170px' }}>Timestamp</th>
                        <th style={{ width: '150px' }}>User</th>
                        <th style={{ width: '140px' }}>Action</th>
                        <th style={{ width: '150px' }}>Target</th>
                        <th>Details & Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs
                        .filter(log => {
                          if (!logSearchQuery) return true;
                          const q = logSearchQuery.toLowerCase();
                          const action = (log.action || '').toLowerCase();
                          const user = (log.user_name || log.user_email || log.user_id || '').toLowerCase();
                          const details = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
                          const target = (log.target_type || '').toLowerCase();
                          return action.includes(q) || user.includes(q) || details.includes(q) || target.includes(q);
                        })
                        .map((log, idx) => {
                          const act = (log.action || '').toUpperCase();
                          let badgeClass = 'other';
                          if (act.includes('CREATE') || act.includes('ADD') || act.includes('UPLOAD')) badgeClass = 'create';
                          else if (act.includes('DELETE') || act.includes('CLEAR') || act.includes('REMOVE')) badgeClass = 'delete';
                          else if (act.includes('ENRICH') || act.includes('UPDATE') || act.includes('EDIT')) badgeClass = 'enrich';
                          else if (act.includes('INTEREST') || act.includes('DECISION')) badgeClass = 'interest';
                          else if (act.includes('ASSIGN') || act.includes('FULFILL') || act.includes('SHIP')) badgeClass = 'assign';

                          let formattedDetails = log.details;
                          try {
                            if (typeof log.details === 'string' && (log.details.startsWith('{') || log.details.startsWith('['))) {
                              const parsed = JSON.parse(log.details);
                              formattedDetails = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(' | ');
                            }
                          } catch (e) {
                            formattedDetails = log.details;
                          }

                          return (
                            <tr key={idx}>
                              <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td style={{ fontWeight: '600', color: 'var(--pine-deep)' }}>
                                {log.user_name || log.user_email || log.user_id || 'System'}
                              </td>
                              <td>
                                <span className={`log-badge log-badge-${badgeClass}`}>
                                  {log.action ? log.action.replace('_', ' ') : 'EVENT'}
                                </span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {log.target_type ? `${log.target_type} ${log.target_id ? `(#${log.target_id})` : ''}` : 'Estate'}
                              </td>
                              <td style={{ fontSize: '0.86rem', color: '#2c3e35' }}>
                                {formattedDetails || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            <History size={36} color="var(--pine-primary)" style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                            <div>{isLoadingLogs ? 'Loading activity logs...' : 'No activity recorded yet in the audit log.'}</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
