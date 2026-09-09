import React, { useState, useEffect, useRef } from 'react';
import { 
  Trees, LayoutDashboard, Package, PlusCircle, Tag, Users, Layers, 
  BookOpen, CheckSquare, Truck, UserCheck, History, BarChart2, Settings, 
  Search, Filter, Heart, ArrowLeft, ArrowRight, CheckCircle2, Camera, 
  X, Check, Mail, Lock, Unlock, AlertCircle, Share2, HelpCircle, Menu,
  Wifi, WifiOff, UploadCloud, Building2, FileText, Sparkles, Loader2, Trash2, ImageOff,
  Edit3, Plus, Star, RotateCcw, Clock, RefreshCw, Award, DollarSign, Crop,
  LogOut
} from 'lucide-react';
import { offlineStorage } from './services/offlineStorage';
import AdminWorkbench from './components/AdminWorkbench';
import InstitutionPortal from './components/InstitutionPortal';
import PhotoCropperModal from './components/PhotoCropperModal';

export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good morning';
  } else if (hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

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
  const [itemValue, setItemValue] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemInstitutionalCandidate, setItemInstitutionalCandidate] = useState('None');
  const [itemInstitutionalName, setItemInstitutionalName] = useState('');
  const [activeReviewPhotoIdx, setActiveReviewPhotoIdx] = useState(0);

  // Photo Cropper Modal State
  const [cropModalSrc, setCropModalSrc] = useState(null); // image URL being cropped
  const [cropModalTarget, setCropModalTarget] = useState(null); // 'capture_primary' | { type: 'edit_photo', photo: photoObj }
  const [croppedPhotoBlob, setCroppedPhotoBlob] = useState(null); // Blob for rapid capture primary photo
  const [croppedPhotoPreview, setCroppedPhotoPreview] = useState(null); // ObjectURL for rapid capture preview


  // Admin Item Edit Modal State
  const [adminEditingItem, setAdminEditingItem] = useState(null);
  const [editFormTitle, setEditFormTitle] = useState('');
  const [editFormCategory, setEditFormCategory] = useState('');
  const [editFormValue, setEditFormValue] = useState('');
  const [editFormLocation, setEditFormLocation] = useState('');
  const [editFormCondition, setEditFormCondition] = useState('');
  const [editFormDimensions, setEditFormDimensions] = useState('');
  const [editFormWeight, setEditFormWeight] = useState('');
  const [editFormStatus, setEditFormStatus] = useState('draft');
  const [editFormDescription, setEditFormDescription] = useState('');
  const [editFormStory, setEditFormStory] = useState('');
  const [editFormPhotos, setEditFormPhotos] = useState([]);
  const [editFormInstitutionalCandidate, setEditFormInstitutionalCandidate] = useState('None');
  const [editFormInstitutionalName, setEditFormInstitutionalName] = useState('');
  const [isSavingItemEdits, setIsSavingItemEdits] = useState(false);
  const [isUploadingEditPhotos, setIsUploadingEditPhotos] = useState(false);
  const editPhotoInputRef = useRef(null);

  // Catalog Filter ('all' | 'my_interests')
  const [catalogInterestFilter, setCatalogInterestFilter] = useState('all');

  // Draft Mode State
  const [draftState, setDraftState] = useState({
    draftOrder: [],
    activePickCount: 0,
    currentRound: 1,
    currentTurnIndex: 0,
    currentPicker: null,
    isCurrentUserTurn: false,
    isAdmin: false
  });
  const [draftHistory, setDraftHistory] = useState([]);
  const [draftSummary, setDraftSummary] = useState([]);
  const [draftSubTab, setDraftSubTab] = useState('board'); // 'board' | 'history' | 'summary'
  const [draftItemFilter, setDraftItemFilter] = useState('all'); // 'interested' | 'all'
  const [draftSearch, setDraftSearch] = useState('');
  const [draftCategoryFilter, setDraftCategoryFilter] = useState('');
  const [confirmingDraftPick, setConfirmingDraftPick] = useState(null); // { item, picker }
  const [confirmingReversePick, setConfirmingReversePick] = useState(null); // pick object
  const [isReorderingDraft, setIsReorderingDraft] = useState(false);
  const [reorderOrder, setReorderOrder] = useState([]);
  const [isProcessingDraftAction, setIsProcessingDraftAction] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userDecision, setUserDecision] = useState('interested');
  const [userComment, setUserComment] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
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
  const [offlineMode, setOfflineMode] = useState(() => {
    return localStorage.getItem('uj_offline_mode') === 'true';
  });
  const [stagedItems, setStagedItems] = useState([]);
  const [savedWasOffline, setSavedWasOffline] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    isSyncing: false,
    waitingForConnection: false,
    total: 0,
    completed: 0,
    remaining: 0,
    failed: 0,
    message: null
  });
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
      if (String(itemId).startsWith('offline_') || String(itemId).startsWith('staged_')) {
        await offlineStorage.deleteStagedItem(itemId);
        await fetchItems();
        await loadStagedQueue();
        return;
      }

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

  // Close user dropdown menu when tapping/clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (currentUser) {
      fetchCategories();
      fetchItems();
      fetchUsers();
      fetchReviewProgress();
      fetchDashboardStats();
    }
  }, [currentUser, currentView]);

  // Restore in-progress capture draft when entering Add Item view
  useEffect(() => {
    const restoreActiveDraft = async () => {
      if (currentView === 'capture' && capturedPhotos.length === 0) {
        const draft = await offlineStorage.getActiveDraft();
        if (draft && draft.photos && draft.photos.length > 0) {
          const restored = draft.photos.map(p => ({
            ...p,
            file: p.data || p.file,
            data: p.data || p.file,
            url: p.data ? URL.createObjectURL(p.data) : (p.url || p.previewUrl)
          }));
          setCapturedPhotos(restored);
          if (draft.croppedBlob) {
            setCroppedPhotoBlob(draft.croppedBlob);
            setCroppedPhotoPreview(URL.createObjectURL(draft.croppedBlob));
          }
          if (draft.title) setItemTitle(draft.title);
          if (draft.categoryId) setItemCategory(draft.categoryId);
          if (draft.locationInHouse) setItemLocation(draft.locationInHouse);
          if (draft.notes) setItemNotes(draft.notes);
          if (draft.value) setItemValue(draft.value);
          setCaptureStep(draft.captureStep || 'enter_details');
        }
      }
    };
    restoreActiveDraft();
  }, [currentView]);


  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem('uj_user', JSON.stringify(data.user));
        setCurrentView(prev => (prev === 'login' ? (data.user.role === 'admin' ? 'dashboard' : 'review') : prev));
      } else {
        localStorage.removeItem('uj_user');
        setCurrentView('login');
      }
    } catch (err) {
      const cachedUser = localStorage.getItem('uj_user');
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          setCurrentUser(user);
          setCurrentView(prev => (prev === 'login' ? (user.role === 'admin' ? 'dashboard' : 'review') : prev));
          return;
        } catch (e) {}
      }
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
        localStorage.setItem('uj_user', JSON.stringify(data.user));
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
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('uj_user');
    setCurrentUser(null);
    setCurrentView('login');
  };

  const fetchItems = async () => {
    let serverItems = [];
    try {
      let url = `/api/items?search=${encodeURIComponent(searchQuery)}`;
      if (categoryFilter) url += `&category=${categoryFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) serverItems = await res.json();
    } catch (err) {
      console.warn("Could not fetch server items (may be offline):", err);
    }

    try {
      const staged = await offlineStorage.getStagedItems();
      setStagedItems(staged || []);

      const offlineFormatted = (staged || []).map(st => {
        let photoUrl = null;
        if (st.croppedBlob) {
          photoUrl = URL.createObjectURL(st.croppedBlob);
        } else if (st.photos && st.photos.length > 0 && st.photos[0].data) {
          photoUrl = URL.createObjectURL(st.photos[0].data);
        }

        return {
          id: st.id,
          clientId: st.clientId || st.id,
          item_number: '(Offline Draft)',
          itemNumber: '(Offline Draft)',
          title: st.title || 'Untitled Offline Item',
          category_id: st.categoryId,
          category_name: categories.find(c => c.id === st.categoryId)?.name || st.category_name || 'Uncategorized',
          value: st.value,
          location_in_house: st.locationInHouse,
          description: st.description || st.notes,
          notes: st.notes,
          condition: st.condition || '',
          dimensions: st.dimensions || '',
          weight: st.weight || '',
          status: 'draft',
          institutional_candidate: st.institutionalCandidate || 'None',
          institutional_name: st.institutionalName || '',
          is_offline: true,
          sync_status: st.syncStatus || 'pending',
          sync_error: st.syncError,
          primary_photo: photoUrl || OFFLINE_THUMB,
          primary_thumb: photoUrl || OFFLINE_THUMB,
          photos: st.photos || [],
          croppedBlob: st.croppedBlob || null
        };
      });

      const filteredOffline = offlineFormatted.filter(item => {
        if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (categoryFilter && item.category_id !== categoryFilter) return false;
        if (statusFilter && statusFilter !== 'draft') return false;
        return true;
      });

      setItems([...filteredOffline, ...serverItems]);
    } catch (dbErr) {
      console.error("Error reading staged items from IndexedDB:", dbErr);
      setItems(serverItems);
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

  const handlePhotosSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newPhotos = files.map(file => ({
        file,
        data: file,
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file)
      }));
      const updatedPhotos = [...capturedPhotos, ...newPhotos];
      setCapturedPhotos(updatedPhotos);
      setCaptureStep('enter_details');

      // Immediately open the interactive crop modal for the primary/newly added photo
      if (newPhotos[0]?.url) {
        setCropModalSrc(newPhotos[0].url);
        setCropModalTarget('capture_primary');
      }

      // Persist active draft to IndexedDB immediately
      await offlineStorage.saveActiveDraft({
        photos: updatedPhotos.map(p => ({
          name: p.name || p.file?.name || 'photo.jpg',
          type: p.type || p.file?.type || 'image/jpeg',
          data: p.data || p.file
        })),
        croppedBlob: croppedPhotoBlob,
        title: itemTitle,
        categoryId: itemCategory,
        locationInHouse: itemLocation,
        notes: itemNotes,
        value: itemValue,
        captureStep: 'enter_details'
      });
    }
    e.target.value = null;
  };

  useEffect(() => {
    if (currentView === 'capture' && captureStep === 'enter_details') {
      const timer = setTimeout(() => {
        offlineStorage.saveActiveDraft({
          photos: capturedPhotos.map(p => ({
            name: p.name || p.file?.name || 'photo.jpg',
            type: p.type || p.file?.type || 'image/jpeg',
            data: p.data || p.file
          })),
          croppedBlob: croppedPhotoBlob,
          title: itemTitle,
          categoryId: itemCategory,
          locationInHouse: itemLocation,
          notes: itemNotes,
          value: itemValue,
          captureStep: 'enter_details'
        });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentView, captureStep, capturedPhotos, croppedPhotoBlob, itemTitle, itemCategory, itemLocation, itemNotes, itemValue]);

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

  const handleOpenCapture = async () => {
    // Check if there is already an active draft with a photo
    const draft = await offlineStorage.getActiveDraft();
    if (draft && draft.photos && draft.photos.length > 0) {
      const restored = draft.photos.map(p => ({
        ...p,
        file: p.data || p.file,
        data: p.data || p.file,
        url: p.data ? URL.createObjectURL(p.data) : (p.url || p.previewUrl)
      }));
      setCapturedPhotos(restored);
      if (draft.croppedBlob) {
        setCroppedPhotoBlob(draft.croppedBlob);
        setCroppedPhotoPreview(URL.createObjectURL(draft.croppedBlob));
      } else {
        setCroppedPhotoBlob(null);
        setCroppedPhotoPreview(null);
      }
      setItemTitle(draft.title || '');
      setItemLocation(draft.locationInHouse || '');
      setItemCategory(draft.categoryId || '');
      setItemNotes(draft.notes || '');
      setItemValue(draft.value || '');
      setCaptureStep(draft.captureStep || 'enter_details');
    } else {
      setCapturedPhotos([]);
      setCroppedPhotoBlob(null);
      setCroppedPhotoPreview(null);
      setItemTitle('');
      setItemLocation('');
      setItemCategory('');
      setItemNotes('');
      setItemValue('');
      setCaptureStep('take_photo');
    }
    setCurrentView('capture');
    setMobileNavOpen(false);
  };

  const handleCancelCapture = async () => {
    await offlineStorage.clearActiveDraft();
    setCapturedPhotos([]);
    setCroppedPhotoBlob(null);
    setCroppedPhotoPreview(null);
    setItemTitle('');
    setItemLocation('');
    setItemCategory('');
    setItemNotes('');
    setItemValue('');
    setCaptureStep('take_photo');
    handleNavigateHome();
  };

  const handleSimulateCapture = async () => {
    const samplePhotos = [
      { url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80' },
      { url: 'https://images.unsplash.com/photo-1580481072645-022f9a6d8310?auto=format&fit=crop&w=600&q=80' }
    ];
    setCapturedPhotos(prev => (prev.length > 0 ? prev : samplePhotos));
    setCaptureStep('enter_details');
    setCropModalSrc(samplePhotos[0].url);
    setCropModalTarget('capture_primary');
  };

  const triggerSyncOfflineItems = async () => {
    if (!navigator.onLine) {
      setSyncProgress({
        isSyncing: false,
        waitingForConnection: true,
        total: 0,
        completed: 0,
        remaining: 0,
        failed: 0,
        message: "Waiting for network connection to upload offline items..."
      });
      window.addEventListener('online', () => triggerSyncOfflineItems(), { once: true });
      return;
    }

    const staged = await offlineStorage.getStagedItems();
    if (staged.length === 0) {
      setSyncProgress({
        isSyncing: false,
        waitingForConnection: false,
        total: 0,
        completed: 0,
        remaining: 0,
        failed: 0,
        message: null
      });
      return;
    }

    const total = staged.length;
    let completed = 0;
    let failed = 0;

    setSyncProgress({
      isSyncing: true,
      waitingForConnection: false,
      total,
      completed: 0,
      remaining: total,
      failed: 0,
      message: `Uploading offline items: 0 of ${total} complete — ${total} remaining`
    });

    for (let item of staged) {
      try {
        const formData = new FormData();
        formData.append('clientId', item.id);
        formData.append('title', item.title || '');
        formData.append('locationInHouse', item.locationInHouse || '');
        formData.append('categoryId', item.categoryId || '');
        formData.append('description', item.description || item.notes || '');
        formData.append('notes', item.notes || item.description || '');
        formData.append('value', item.value || '');
        formData.append('institutionalCandidate', item.institutionalCandidate || 'None');
        formData.append('institutionalName', item.institutionalName || '');

        if (item.photos && item.photos.length > 0) {
          for (let p of item.photos) {
            if (p.data) {
              const fileObj = p.data instanceof File ? p.data : new File([p.data], p.name || 'photo.jpg', { type: p.type || 'image/jpeg' });
              formData.append('photos', fileObj);
            }
          }
        }

        if (item.croppedBlob) {
          formData.append('croppedPhotos', item.croppedBlob, 'cropped.webp');
        }

        const res = await fetch('/api/items/rapid-capture', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            // Remove from local IndexedDB only AFTER confirmed server success!
            await offlineStorage.deleteStagedItem(item.id);
            completed++;
            const remaining = total - completed - failed;
            setSyncProgress(prev => ({
              ...prev,
              completed,
              remaining,
              message: `Uploading offline items: ${completed} of ${total} complete — ${remaining} remaining`
            }));

            // Update item in local items state immediately so Upload Pending is removed without duplication
            setItems(prevItems => prevItems.map(it => it.id === item.id ? {
              ...result.item,
              category_name: categories.find(c => c.id === result.item.category_id)?.name || it.category_name,
              is_offline: false,
              sync_status: 'synced'
            } : it));
          } else {
            throw new Error(result.error || "Server rejected item");
          }
        } else {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
      } catch (itemErr) {
        console.error("Failed to sync item:", item.id, itemErr);
        failed++;
        const remaining = total - completed - failed;
        await offlineStorage.updateStagedItem({
          ...item,
          syncStatus: 'failed',
          syncError: itemErr.message || "Network upload failed"
        });
        setSyncProgress(prev => ({
          ...prev,
          failed,
          remaining,
          message: `Uploading offline items: ${completed} of ${total} complete — ${remaining} remaining (${failed} failed)`
        }));
      }
    }

    await fetchItems();
    await fetchDashboardStats();

    if (failed === 0) {
      setSyncProgress({
        isSyncing: false,
        waitingForConnection: false,
        total,
        completed,
        remaining: 0,
        failed: 0,
        message: `🎉 All ${total} offline items uploaded successfully!`
      });
      setTimeout(() => {
        setSyncProgress(prev => prev.isSyncing ? prev : { ...prev, message: null });
      }, 4000);
    } else {
      setSyncProgress({
        isSyncing: false,
        waitingForConnection: false,
        total,
        completed,
        remaining: 0,
        failed,
        message: `⚠️ ${failed} offline item(s) failed to upload. They remain saved locally and can be retried.`
      });
    }
  };

  const handleToggleOfflineMode = async () => {
    const nextMode = !offlineMode;
    setOfflineMode(nextMode);
    localStorage.setItem('uj_offline_mode', nextMode ? 'true' : 'false');
    if (!nextMode) {
      await triggerSyncOfflineItems();
    }
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

  const handleStartEditItem = async (item) => {
    if (!item) return;
    setAdminEditingItem(item);
    setEditFormTitle(item.title || '');
    setEditFormCategory(item.category_id || (item.category_name ? categories.find(c => c.name === item.category_name)?.id : '') || '');
    setEditFormValue(item.value || '');
    setEditFormLocation(item.location_in_house || item.location || '');
    setEditFormCondition(item.condition || '');
    setEditFormDimensions(item.dimensions || '');
    setEditFormWeight(item.weight || '');
    setEditFormStatus(item.status || 'draft');
    setEditFormDescription(item.description || item.special_handling_notes || item.notes || '');
    setEditFormStory(item.story || item.story_text || '');
    setEditFormInstitutionalCandidate(item.institutional_candidate || item.institutionalCandidate || 'None');
    setEditFormInstitutionalName(item.institutional_name || item.institutionalName || '');
    setEditFormPhotos(item.photos || (item.primary_photo ? [{ id: 'prim', photo_url: item.primary_photo, thumbnail_url: item.primary_thumb || item.primary_photo, is_primary: 1 }] : []));

    if (item.is_offline) {
      // Offline item: local record already has all available details
      return;
    }

    try {
      const res = await fetch(`/api/items/${item.id}`);
      if (res.ok) {
        const fullItem = await res.json();
        setAdminEditingItem(fullItem);
        setEditFormTitle(fullItem.title || '');
        setEditFormCategory(fullItem.category_id || (fullItem.category_name ? categories.find(c => c.name === fullItem.category_name)?.id : '') || '');
        setEditFormValue(fullItem.value || '');
        setEditFormLocation(fullItem.location_in_house || fullItem.location || '');
        setEditFormCondition(fullItem.condition || '');
        setEditFormDimensions(fullItem.dimensions || '');
        setEditFormWeight(fullItem.weight || '');
        setEditFormStatus(fullItem.status || 'draft');
        setEditFormDescription(fullItem.description || fullItem.special_handling_notes || '');
        const story = fullItem.stories && fullItem.stories.length > 0 ? fullItem.stories[0].story_text : (fullItem.story || '');
        setEditFormStory(story || '');
        setEditFormInstitutionalCandidate(fullItem.institutional_candidate || 'None');
        setEditFormInstitutionalName(fullItem.institutional_name || '');
        setEditFormPhotos(fullItem.photos || []);
      }
    } catch (err) {
      console.error("Failed to load full item for editing:", err);
    }
  };

  const handleReleaseItem = async (itemId) => {
    try {
      // Optimistic update for instant response
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'released' } : item));
      if (adminEditingItem && adminEditingItem.id === itemId) {
        setEditFormStatus('released');
        setAdminEditingItem(prev => (prev ? { ...prev, status: 'released' } : prev));
      }
      setSelectedItem(prev => (prev && prev.id === itemId ? { ...prev, status: 'released' } : prev));

      const res = await fetch(`/api/items/${itemId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        await fetchItems();
        await fetchDashboardStats();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to release item.");
        await fetchItems();
      }
    } catch (err) {
      console.error("Error releasing item:", err);
      alert("Error releasing item.");
      await fetchItems();
    }
  };

  const handleUnreleaseItem = async (itemId) => {
    const confirmed = window.confirm(
      "Are you sure you want to unrelease this item? It will no longer be visible to family members in the catalog."
    );
    if (!confirmed) return;

    try {
      // Optimistic update
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'draft' } : item));
      if (adminEditingItem && adminEditingItem.id === itemId) {
        setEditFormStatus('draft');
        setAdminEditingItem(prev => (prev ? { ...prev, status: 'draft' } : prev));
      }
      setSelectedItem(prev => (prev && prev.id === itemId ? { ...prev, status: 'draft' } : prev));

      const res = await fetch(`/api/items/${itemId}/unrelease`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        await fetchItems();
        await fetchDashboardStats();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to unrelease item.");
        await fetchItems();
      }
    } catch (err) {
      console.error("Error unreleasing item:", err);
      alert("Error unreleasing item.");
      await fetchItems();
    }
  };

  const handleSaveItemEdits = async () => {
    if (!adminEditingItem) return;
    setIsSavingItemEdits(true);
    try {
      if (adminEditingItem.is_offline) {
        const existingStaged = await offlineStorage.getStagedItem(adminEditingItem.id);
        const updatedRecord = {
          ...(existingStaged || adminEditingItem),
          title: editFormTitle,
          categoryId: editFormCategory || null,
          category_id: editFormCategory || null,
          category_name: categories.find(c => c.id === editFormCategory)?.name || '',
          value: editFormValue,
          locationInHouse: editFormLocation,
          location_in_house: editFormLocation,
          condition: editFormCondition,
          dimensions: editFormDimensions,
          weight: editFormWeight,
          status: editFormStatus,
          description: editFormDescription,
          notes: editFormDescription,
          story: editFormStory,
          institutionalCandidate: editFormInstitutionalCandidate,
          institutional_candidate: editFormInstitutionalCandidate,
          institutionalName: editFormInstitutionalCandidate === 'Other' ? editFormInstitutionalName : '',
          institutional_name: editFormInstitutionalCandidate === 'Other' ? editFormInstitutionalName : '',
          syncStatus: 'pending',
          syncError: null
        };
        await offlineStorage.updateStagedItem(updatedRecord);
        setAdminEditingItem(null);
        await fetchItems();
        return;
      }

      const payload = {
        title: editFormTitle,
        categoryId: editFormCategory || null,
        value: editFormValue,
        locationInHouse: editFormLocation,
        location: editFormLocation,
        condition: editFormCondition,
        dimensions: editFormDimensions,
        weight: editFormWeight,
        status: editFormStatus,
        description: editFormDescription,
        storyText: editFormStory,
        institutionalCandidate: editFormInstitutionalCandidate,
        institutionalName: editFormInstitutionalCandidate === 'Other' ? editFormInstitutionalName : ''
      };

      const res = await fetch(`/api/items/${adminEditingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setAdminEditingItem(null);
        await fetchItems();
        await fetchDashboardStats();
      } else {
        alert("Failed to save item changes.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving item changes.");
    } finally {
      setIsSavingItemEdits(false);
    }
  };


  const fetchDraftData = async () => {
    try {
      const [stateRes, historyRes, summaryRes] = await Promise.all([
        fetch('/api/draft/state'),
        fetch('/api/draft/history'),
        fetch('/api/draft/summary-by-person')
      ]);
      if (stateRes.ok) {
        const data = await stateRes.json();
        setDraftState(data);
        if (data.draftOrder) {
          setReorderOrder(data.draftOrder.map(d => d.user_id));
        }
      }
      if (historyRes.ok) {
        const hist = await historyRes.json();
        setDraftHistory(hist);
      }
      if (summaryRes.ok) {
        const summ = await summaryRes.json();
        setDraftSummary(summ);
      }
      await fetchItems();
    } catch (err) {
      console.error("Error loading draft data:", err);
    }
  };

  const handleToggleInterest = async (item, e) => {
    if (e) e.stopPropagation();
    const isCurrentlyInterested = Boolean(item.user_interested);
    try {
      if (isCurrentlyInterested) {
        await fetch(`/api/items/${item.id}/interest`, {
          method: 'DELETE'
        });
      } else {
        await fetch(`/api/items/${item.id}/interest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interestLevel: 'interested' })
        });
      }
      await fetchItems();
      if (currentView === 'my_interests') {
        await fetchMyInterests();
      }
      if (currentView === 'draft_mode') {
        await fetchDraftData();
      }
    } catch (err) {
      console.error("Failed to toggle interest:", err);
    }
  };

  const handleExecuteDraftPick = async () => {
    if (!confirmingDraftPick) return;
    setIsProcessingDraftAction(true);
    try {
      const res = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: confirmingDraftPick.item.id,
          targetUserId: confirmingDraftPick.picker.user_id || confirmingDraftPick.picker.id
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to make draft pick");
      } else {
        setConfirmingDraftPick(null);
        await fetchDraftData();
      }
    } catch (err) {
      console.error("Draft pick failed:", err);
      alert("Error submitting draft pick.");
    } finally {
      setIsProcessingDraftAction(false);
    }
  };

  const handleExecuteReversePick = async () => {
    if (!confirmingReversePick) return;
    setIsProcessingDraftAction(true);
    try {
      const res = await fetch(`/api/draft/picks/${confirmingReversePick.id}/reverse`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to reverse pick");
      } else {
        setConfirmingReversePick(null);
        await fetchDraftData();
      }
    } catch (err) {
      console.error("Reverse pick failed:", err);
      alert("Error reversing draft pick.");
    } finally {
      setIsProcessingDraftAction(false);
    }
  };

  const handleSaveDraftOrder = async () => {
    setIsProcessingDraftAction(true);
    try {
      const res = await fetch('/api/draft/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: reorderOrder })
      });
      if (res.ok) {
        setIsReorderingDraft(false);
        await fetchDraftData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update draft order");
      }
    } catch (err) {
      alert("Error saving draft order");
    } finally {
      setIsProcessingDraftAction(false);
    }
  };

  const handleAddPhotosToEditItem = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !adminEditingItem) return;
    setIsUploadingEditPhotos(true);
    try {
      const formData = new FormData();
      for (const file of files) {
        const compFile = await compressPhotoTo2048(file);
        formData.append('photos', compFile);
      }

      const res = await fetch(`/api/items/${adminEditingItem.id}/photos`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setEditFormPhotos(data.photos || []);
        await fetchItems();
      } else {
        alert("Failed to upload new photos.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading photos.");
    } finally {
      setIsUploadingEditPhotos(false);
      e.target.value = null;
    }
  };

  const handleDeletePhotoFromEditItem = async (photoId) => {
    if (!adminEditingItem) return;
    if (!window.confirm("Are you sure you want to delete this photo from the item?")) return;
    try {
      const res = await fetch(`/api/items/${adminEditingItem.id}/photos/${photoId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setEditFormPhotos(data.photos || []);
        await fetchItems();
      } else {
        alert("Failed to delete photo.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting photo.");
    }
  };

  const handleSetPrimaryPhoto = async (photoId) => {
    if (!adminEditingItem) return;
    try {
      const res = await fetch(`/api/items/${adminEditingItem.id}/photos/${photoId}/set-primary`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setEditFormPhotos(data.photos || []);
        await fetchItems();
      } else {
        alert("Failed to set primary photo.");
      }
    } catch (err) {
      console.error(err);
      alert("Error setting primary photo.");
    }
  };

  const handleRestoreOriginalCrop = async (photoId) => {
    if (!adminEditingItem) return;
    try {
      const res = await fetch(`/api/items/${adminEditingItem.id}/photos/${photoId}/restore-crop`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setEditFormPhotos(data.photos || []);
        await fetchItems();
      } else {
        alert("Failed to restore original photo framing.");
      }
    } catch (err) {
      console.error(err);
      alert("Error restoring photo framing.");
    }
  };

  const handleCropModalConfirm = async ({ blob, previewUrl }) => {
    if (!cropModalTarget) return;

    if (cropModalTarget === 'capture_primary') {
      setCroppedPhotoBlob(blob);
      setCroppedPhotoPreview(previewUrl);
      setCropModalSrc(null);
      setCropModalTarget(null);
    } else if (cropModalTarget.type === 'edit_photo') {
      const { photo } = cropModalTarget;
      try {
        const formData = new FormData();
        formData.append('croppedImage', blob, 'cropped.webp');
        const res = await fetch(`/api/items/${adminEditingItem.id}/photos/${photo.id}/crop`, {
          method: 'PUT',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setEditFormPhotos(data.photos || []);
          await fetchItems();
        } else {
          alert("Failed to save cropped photo.");
        }
      } catch (err) {
        console.error(err);
        alert("Error saving cropped photo.");
      } finally {
        setCropModalSrc(null);
        setCropModalTarget(null);
      }
    }
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
            name: compFile.name,
            type: compFile.type,
            file: compFile,
            data: compFile,
            url: URL.createObjectURL(compFile)
          });
        } else if (p.data) {
          compressedList.push(p);
        } else {
          compressedList.push(p);
        }
      }

      if (offlineMode) {
        setSavedWasOffline(true);
        // Save locally to IndexedDB staging store
        await offlineStorage.saveStagedItem({
          title: itemTitle,
          locationInHouse: itemLocation,
          categoryId: itemCategory,
          notes: itemNotes,
          value: itemValue,
          institutionalCandidate: itemInstitutionalCandidate,
          institutionalName: itemInstitutionalName
        }, compressedList, croppedPhotoBlob);

        await offlineStorage.clearActiveDraft();
        await fetchItems();
        setCaptureStep('saved_confirmation');
        return;
      }

      setSavedWasOffline(false);
      const formData = new FormData();
      formData.append('title', itemTitle);
      formData.append('locationInHouse', itemLocation);
      formData.append('categoryId', itemCategory);
      formData.append('notes', itemNotes);
      formData.append('value', itemValue);
      formData.append('institutionalCandidate', itemInstitutionalCandidate);
      formData.append('institutionalName', itemInstitutionalName);

      for (let p of compressedList) {
        if (p.file) {
          formData.append('photos', p.file);
        } else if (p.data) {
          const fileObj = p.data instanceof File ? p.data : new File([p.data], p.name || 'photo.jpg', { type: p.type || 'image/jpeg' });
          formData.append('photos', fileObj);
        }
      }
      if (croppedPhotoBlob) {
        formData.append('croppedPhotos', croppedPhotoBlob, 'cropped.webp');
      }

      const res = await fetch('/api/items/rapid-capture', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error("Server error during rapid capture");
      }

      await offlineStorage.clearActiveDraft();
      setCaptureStep('saved_confirmation');
      await fetchItems();
    } catch (err) {
      console.warn("Rapid capture failed online, saving offline:", err);
      // Fallback to offline staging if network error occurs
      setSavedWasOffline(true);
      await offlineStorage.saveStagedItem({
        title: itemTitle,
        locationInHouse: itemLocation,
        categoryId: itemCategory,
        notes: itemNotes,
        value: itemValue,
        institutionalCandidate: itemInstitutionalCandidate,
        institutionalName: itemInstitutionalName
      }, capturedPhotos, croppedPhotoBlob);
      await offlineStorage.clearActiveDraft();
      await fetchItems();
      setCaptureStep('saved_confirmation');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleSyncStagedBatch = async () => {
    await triggerSyncOfflineItems();
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

            {(currentUser?.role === 'admin' || currentUser?.role === 'reviewer' || currentUser?.role === 'contributor') && (
              <button className={`sidebar-item ${currentView === 'draft_mode' ? 'active' : ''}`} onClick={() => { setCurrentView('draft_mode'); fetchDraftData(); setMobileNavOpen(false); }}>
                <Layers size={18} /> Family Draft
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
                  onClick={handleToggleOfflineMode}
                >
                  {offlineMode ? <WifiOff size={16} color="#d32f2f" /> : <Wifi size={16} color="#2e7d32" />}
                  <span>{offlineMode ? 'Offline Mode: ON' : 'Offline Mode: OFF'}</span>
                </button>

                <div className="header-user-container" ref={userMenuRef}>
                  <button
                    type="button"
                    className="header-user-btn"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-label="User account menu"
                    aria-expanded={userMenuOpen}
                    title="Account & Sign Out"
                  >
                    <div className="user-avatar">
                      {(currentUser?.name || 'User').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="user-info-text">
                      <div style={{ fontWeight: 'bold' }}>{currentUser?.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {currentUser?.role === 'contributor' ? 'Photographer' : currentUser?.role}
                      </div>
                    </div>
                  </button>

                  {userMenuOpen && (
                    <div className="user-dropdown-menu">
                      <div className="user-dropdown-header">
                        <div className="user-dropdown-name">{currentUser?.name}</div>
                        <div className="user-dropdown-email">{currentUser?.email}</div>
                        <div style={{ marginTop: '6px' }}>
                          <span className="user-dropdown-role-badge">
                            {currentUser?.role === 'admin' ? '👑 Admin' :
                             currentUser?.role === 'contributor' ? '📷 Photographer' :
                             currentUser?.role === 'institution' ? '🏛️ Institution' :
                             '👤 Family Reviewer'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="user-dropdown-logout-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        <LogOut size={16} />
                        <span>Log Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* STATUS BANNER 1: OFFLINE MODE IS ACTIVE */}
            {offlineMode && (
              <div style={{ background: '#fff3cd', color: '#664d03', borderBottom: '1px solid #ffecb5', padding: '0.6rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', fontWeight: 'bold', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <WifiOff size={18} color="#b45309" />
                  <span>⚡ OFFLINE MODE IS ON — Photos save directly to your iPhone storage without network calls.</span>
                </div>
                <button className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#fff' }} onClick={handleToggleOfflineMode}>
                  Turn OFF Offline Mode
                </button>
              </div>
            )}

            {/* STATUS BANNER 2: SYNC PROGRESS / CONNECTION / ERROR */}
            {syncProgress.message && (
              <div style={{
                background: syncProgress.failed > 0 ? '#fee2e2' : (syncProgress.isSyncing ? '#eff6ff' : (syncProgress.waitingForConnection ? '#fef3c7' : '#d1e7dd')),
                color: syncProgress.failed > 0 ? '#991b1b' : (syncProgress.isSyncing ? '#1e40af' : (syncProgress.waitingForConnection ? '#92400e' : '#0f5132')),
                borderBottom: '1px solid rgba(0,0,0,0.1)',
                padding: '0.65rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {syncProgress.isSyncing ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : syncProgress.failed > 0 ? (
                    <AlertCircle size={18} />
                  ) : syncProgress.waitingForConnection ? (
                    <WifiOff size={18} />
                  ) : (
                    <UploadCloud size={18} />
                  )}
                  <span>{syncProgress.message}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {(syncProgress.failed > 0 || syncProgress.waitingForConnection) && !syncProgress.isSyncing && (
                    <button className="btn-green-senior" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }} onClick={triggerSyncOfflineItems}>
                      🔄 Retry Upload
                    </button>
                  )}
                  {!syncProgress.isSyncing && (
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={() => setSyncProgress(prev => ({ ...prev, message: null }))} title="Dismiss">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STATUS BANNER 3: STAGED ITEMS PENDING UPLOAD (IDLE) */}
            {!offlineMode && !syncProgress.message && stagedItems.length > 0 && (
              <div style={{ background: '#d1e7dd', color: '#0f5132', borderBottom: '1px solid #badbcc', padding: '0.65rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UploadCloud size={20} />
                  <span>📶 Wi-Fi CONNECTED — {stagedItems.length} Offline Item(s) Ready to Upload.</span>
                </div>
                <button className="btn-green-senior" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }} onClick={triggerSyncOfflineItems} disabled={syncProgress.isSyncing}>
                  {syncProgress.isSyncing ? 'Uploading...' : `📤 UPLOAD NOW (${stagedItems.length} ITEMS)`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="page-container">
          {/* MOCKUP 1: LOGIN / WELCOME SCREEN */}
          {currentView === 'login' && (
            <div className="login-card-grid">
              {/* Lake and Trees Hero Image Banner */}
              <div className="login-hero-banner">
                <div className="login-hero-overlay">
                  <Trees size={34} color="#f59e0b" style={{ filter: 'drop-shadow(0 2px 5px rgba(0, 0, 0, 0.6))', flexShrink: 0 }} />
                  <div>
                    <div className="login-hero-title">UNCLE JIM’S ESTATE</div>
                    <div className="login-hero-subtitle">Manitowish Waters, Wisconsin</div>
                  </div>
                </div>
              </div>

              {/* Login Form Container */}
              <div className="login-form-container">
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.45rem', color: 'var(--pine-deep)', marginBottom: '0.25rem' }}>Welcome</h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Sign in to access the estate inventory.</p>

                {/* Quick Test Logins */}
                <div className="login-test-accounts-box" style={{ background: 'var(--bg-subtle)', padding: '0.75rem 0.85rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--pine-primary)', marginBottom: '0.45rem', letterSpacing: '0.5px' }}>⚡ QUICK TEST LOGIN ACCOUNTS (PASSWORD: password123):</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', textAlign: 'left', background: '#fff', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      onClick={() => { setLoginEmail('dan@unclejim.estate'); setLoginPassword('password123'); handleLogin('dan@unclejim.estate', 'password123'); }}
                    >
                      <span style={{ fontWeight: 'bold', color: 'var(--pine-primary)' }}>👑 Dan (Admin)</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>dan@unclejim.estate</span>
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', textAlign: 'left', background: '#fff', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      onClick={() => { setLoginEmail('sarah@unclejim.estate'); setLoginPassword('password123'); handleLogin('sarah@unclejim.estate', 'password123'); }}
                    >
                      <span style={{ fontWeight: 'bold', color: 'var(--pine-primary)' }}>📷 Sarah (Photographer)</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>sarah@unclejim.estate</span>
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', textAlign: 'left', background: '#fff', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      onClick={() => { setLoginEmail('jean@unclejim.estate'); setLoginPassword('password123'); handleLogin('jean@unclejim.estate', 'password123'); }}
                    >
                      <span style={{ fontWeight: 'bold', color: 'var(--pine-primary)' }}>👤 Jean (Reviewer)</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>jean@unclejim.estate</span>
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', textAlign: 'left', background: '#fff', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      onClick={() => { setLoginEmail('museum@unclejim.estate'); setLoginPassword('password123'); handleLogin('museum@unclejim.estate', 'password123'); }}
                    >
                      <span style={{ fontWeight: 'bold', color: 'var(--pine-primary)' }}>🏛️ Museum (Institution)</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>museum@unclejim.estate</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.3rem' }}>
                      Email Address
                    </label>
                    <input
                      type="text"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. dan@unclejim.estate"
                      style={{ width: '100%', minHeight: '48px', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.3rem' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ width: '100%', minHeight: '48px', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-green-senior"
                    style={{ width: '100%', minHeight: '50px', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    Sign In
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* MOCKUP 2: ADMIN DASHBOARD (HOME) */}
          {currentView === 'dashboard' && currentUser?.role === 'admin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--pine-deep)' }}>{getGreeting()}, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Dan'}</h1>
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
                <div className="camera-screen-dark" style={{ padding: '1rem' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
                    <button className="btn-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', fontSize: '0.85rem', padding: '0.35rem 0.7rem' }} onClick={handleNavigateHome}>
                      ← Return Home
                    </button>
                    <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#ffffff' }}>Add New Item</span>
                    <div style={{ width: '10px' }}></div>
                  </div>

                  <label className="viewfinder-box" style={{ cursor: 'pointer', background: '#14241c', border: '2px dashed var(--gold-accent)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', width: '100%', margin: 0 }}>
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotosSelected} style={{ display: 'none' }} />
                    {capturedPhotos[0]?.url ? (
                      <img src={capturedPhotos[0].url} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px' }} alt="Captured Preview" />
                    ) : (
                      <>
                        <Camera size={52} color="var(--gold-accent)" style={{ marginBottom: '0.75rem' }} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>Tap to Take Photo or Upload</div>
                        <div style={{ fontSize: '0.82rem', color: '#b8ccbf', marginTop: '4px' }}>Optimized 2K HD Instant Capture</div>
                      </>
                    )}
                  </label>

                  {/* 2 Prominent Senior-Friendly Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%', marginTop: '1.25rem' }}>
                    
                    {/* CAMERA LABEL - Bypasses iOS click() bugs */}
                    <label className="btn-green-senior" style={{ width: '100%', minHeight: '56px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: 0 }}>
                      <Camera size={22} style={{ marginRight: '8px' }} /> 📷 TAKE PHOTO WITH CAMERA
                      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotosSelected} style={{ display: 'none' }} />
                    </label>

                    {/* LIBRARY LABEL */}
                    <label className="btn-outline" style={{ width: '100%', minHeight: '54px', fontSize: '0.95rem', fontWeight: 'bold', background: '#ffffff', color: 'var(--pine-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: 0 }}>
                      🖼️ CHOOSE FROM PHOTO LIBRARY
                      <input ref={libraryInputRef} type="file" accept="image/*" multiple onChange={handlePhotosSelected} style={{ display: 'none' }} />
                    </label>

                    <button className="btn-outline" style={{ width: '100%', minHeight: '46px', color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)', background: 'transparent', justifyContent: 'center', marginTop: '0.5rem' }} onClick={handleNavigateHome}>
                      🏠 Cancel & Return to Main Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3B: ADD MORE PHOTOS OR PROCEED */}
              {captureStep === 'add_more' && (
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <button className="btn-outline" style={{ fontSize: '0.88rem', padding: '0.4rem 0.75rem', minHeight: '40px' }} onClick={handleNavigateHome}>
                      ← Return Home
                    </button>
                    <span style={{ color: 'var(--pine-primary)', fontWeight: 'bold', fontSize: '0.95rem' }}>{capturedPhotos.length} Photo(s) Selected</span>
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
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <button className="btn-outline" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', minHeight: '38px' }} onClick={() => setCaptureStep('add_more')}>
                      ← Back to Photos
                    </button>
                    <button className="btn-outline" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', minHeight: '38px' }} onClick={handleCancelCapture}>
                      Cancel
                    </button>
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--pine-deep)', marginBottom: '1rem' }}>
                    New Item Details
                  </h2>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{
                      position: 'relative',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      background: '#f6f5f0',
                      minHeight: '190px',
                      maxHeight: '260px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={croppedPhotoPreview || capturedPhotos[0]?.url || OFFLINE_THUMB}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '260px',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                        alt="Item Preview"
                      />

                      {croppedPhotoPreview && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          background: 'rgba(37, 99, 235, 0.9)',
                          color: '#fff',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backdropFilter: 'blur(2px)'
                        }}>
                          ✂️ Custom Crop Applied
                        </div>
                      )}
                    </div>

                    {/* Photo Action Controls */}
                    <div style={{ display: 'grid', gridTemplateColumns: croppedPhotoPreview ? '1fr 1fr' : '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: '600',
                          color: 'var(--pine-deep)',
                          borderColor: 'var(--pine-primary)',
                          background: '#fff',
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        onClick={() => {
                          if (capturedPhotos[0]?.url) {
                            setCropModalSrc(capturedPhotos[0].url);
                            setCropModalTarget('capture_primary');
                          }
                        }}
                      >
                        <Crop size={16} />
                        {croppedPhotoPreview ? 'Re-crop Photo' : 'Crop / Adjust Photo'}
                      </button>

                      {croppedPhotoPreview ? (
                        <button
                          type="button"
                          className="btn-outline"
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            color: '#6b7280',
                            borderColor: '#d1d5db',
                            background: '#fff',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                          }}
                          onClick={() => {
                            setCroppedPhotoBlob(null);
                            setCroppedPhotoPreview(null);
                          }}
                        >
                          <RotateCcw size={15} />
                          Reset Framing
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline"
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            color: 'var(--pine-deep)',
                            borderColor: 'var(--border-color)',
                            background: '#fff',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                          }}
                          onClick={handleTriggerLibrary}
                        >
                          🖼️ + Add Photos
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label className="form-field-label">Title (optional)</label>
                    <input type="text" className="form-field-input" value={itemTitle} placeholder="e.g. Vintage Wooden Rocking Chair" onChange={e => setItemTitle(e.target.value)} />
                  </div>

                  <div className="form-field-group">
                    <label className="form-field-label">Category (optional)</label>
                    <select className="form-field-select" value={itemCategory} onChange={e => setItemCategory(e.target.value)}>
                      <option value="">-- Select Category (Optional) --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label className="form-field-label">Estimated Value (optional)</label>
                    <input type="text" className="form-field-input" value={itemValue} placeholder="e.g. $450" onChange={e => setItemValue(e.target.value)} />
                  </div>

                  <div className="form-field-group">
                    <label className="form-field-label">Quick Notes (optional)</label>
                    <textarea className="form-field-textarea" rows="3" value={itemNotes} placeholder="General description, details, provenance notes..." onChange={e => setItemNotes(e.target.value)}></textarea>
                  </div>

                  <div className="form-field-group">
                    <label className="form-field-label">Location in House (optional)</label>
                    <input type="text" className="form-field-input" value={itemLocation} placeholder="e.g. Living Room, Attic, Master Bedroom" onChange={e => setItemLocation(e.target.value)} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1.5rem' }}>
                    <button
                      className="btn-modal-primary"
                      style={{ width: '100%', minHeight: '52px', fontSize: '1.05rem', background: isSavingItem ? '#e69c24' : 'var(--pine-primary)' }}
                      onClick={handleSaveItemCapture}
                      disabled={isSavingItem}
                    >
                      {isSavingItem ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                          <Loader2 className="animate-spin" size={22} />
                          <span>⏳ Saving & Compressing Photos...</span>
                        </div>
                      ) : (
                        <span>💾 Save Item to Inventory</span>
                      )}
                    </button>

                    <button className="btn-modal-secondary" style={{ width: '100%', minHeight: '48px', justifyContent: 'center' }} onClick={handleCancelCapture}>
                      Cancel & Return to Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3D: NEW ITEM CREATED CONFIRMATION */}
              {captureStep === 'saved_confirmation' && (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                  <div className="check-circle-lg" style={{ background: savedWasOffline ? '#fff3cd' : '#d1e7dd', color: savedWasOffline ? '#b45309' : '#0f5132' }}>
                    {savedWasOffline ? '⚡' : '✓'}
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--pine-deep)', fontSize: '1.6rem' }}>
                    {savedWasOffline ? 'Item Saved Offline!' : 'Item Saved!'}
                  </h2>
                  <p style={{
                    fontSize: '0.92rem',
                    color: savedWasOffline ? '#856404' : 'var(--text-muted)',
                    marginBottom: '1.5rem',
                    background: savedWasOffline ? '#fff3cd' : 'transparent',
                    padding: savedWasOffline ? '0.75rem 1rem' : '0',
                    borderRadius: '8px',
                    border: savedWasOffline ? '1px solid #ffeeba' : 'none',
                    fontWeight: savedWasOffline ? '600' : 'normal'
                  }}>
                    {savedWasOffline
                      ? 'Item saved offline. Photo and changes will upload when Offline Mode is turned off.'
                      : 'Your item has been saved to the estate inventory queue.'}
                  </p>

                  <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '10px', display: 'flex', gap: '0.85rem', alignItems: 'center', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid var(--border-color)' }}>
                    <img src={croppedPhotoPreview || capturedPhotos[0]?.url || OFFLINE_THUMB} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
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
          {currentView === 'catalog' && (() => {
            const displayedItems = items.filter(item => {
              if (catalogInterestFilter === 'my_interests' && !Boolean(item.user_interested)) return false;
              return true;
            });
            const myInterestsCount = items.filter(i => Boolean(i.user_interested)).length;

            return (
              <div>
                {/* Search and Filter Row */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px', display: 'flex', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', alignItems: 'center' }}>
                    <Search size={18} color="var(--text-muted)" style={{ marginRight: '0.5rem' }} />
                    <input type="text" style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem' }} placeholder="Search books, artwork, maritime..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
                    {searchQuery && (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }} onClick={() => setSearchQuery('')} title="Clear Search">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {(searchQuery || categoryFilter || statusFilter || catalogInterestFilter !== 'all') && (
                    <button className="btn-outline" style={{ fontSize: '0.82rem', color: '#d32f2f', borderColor: '#ffcdd2' }} onClick={() => { setSearchQuery(''); setCategoryFilter(''); setStatusFilter(''); setCatalogInterestFilter('all'); }}>
                      <X size={14} style={{ marginRight: '4px' }} /> Clear Filters
                    </button>
                  )}
                </div>

                {/* Quick Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '2px' }}>
                  <button
                    className={`btn-outline ${catalogInterestFilter === 'all' ? 'btn-green' : ''}`}
                    style={{ fontSize: '0.88rem', padding: '0.4rem 0.9rem', borderRadius: '20px', whiteSpace: 'nowrap' }}
                    onClick={() => setCatalogInterestFilter('all')}
                  >
                    📦 All Items ({items.length})
                  </button>
                  <button
                    className={`btn-outline ${catalogInterestFilter === 'my_interests' ? 'btn-green' : ''}`}
                    style={{ fontSize: '0.88rem', padding: '0.4rem 0.9rem', borderRadius: '20px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => setCatalogInterestFilter('my_interests')}
                  >
                    <Star size={15} fill={catalogInterestFilter === 'my_interests' ? '#fff' : '#f59e0b'} color="#f59e0b" />
                    My Interested Items ({myInterestsCount})
                  </button>
                </div>

                {displayedItems.length === 0 ? (
                  <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Search size={48} color="var(--pine-primary)" style={{ opacity: 0.4, marginBottom: '1rem' }} />
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--pine-deep)' }}>No items found</h3>
                    <p style={{ fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: '1.25rem' }}>
                      {catalogInterestFilter === 'my_interests'
                        ? "You haven't marked any possessions as interested yet."
                        : "No catalog possessions match your current search or filter criteria."}
                    </p>
                    <button className="btn-green" style={{ padding: '0.65rem 1.25rem' }} onClick={() => { setSearchQuery(''); setCategoryFilter(''); setStatusFilter(''); setCatalogInterestFilter('all'); }}>
                      🔄 Reset All Search & Filters
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    {displayedItems.map(item => (
                      <div
                        key={item.id}
                        className="card"
                        style={{ padding: '0.85rem', cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column' }}
                        onClick={() => {
                          if (currentUser?.role === 'admin') {
                            handleStartEditItem(item);
                          } else {
                            const idx = items.findIndex(i => i.id === item.id);
                            if (idx !== -1) setReviewIndex(idx);
                            setActiveReviewPhotoIdx(0);
                            setSelectedItem(item);
                            setCurrentView('review');
                          }
                        }}
                      >
                        <div style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: '#f6f5f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '0.65rem'
                        }}>
                          <img
                            src={item.primary_thumb || item.primary_photo || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block'
                            }}
                            alt={item.title || "Estate Item"}
                          />
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
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{item.title || 'Untitled Item'}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.category_name || "Uncategorized"}</span>
                          {item.value && (
                            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--pine-primary)' }}>
                              {item.value.startsWith('$') ? item.value : `$${item.value}`}
                            </span>
                          )}
                        </div>

                        {/* Offline Pending / Admin Release Status Badge */}
                        {item.is_offline ? (
                          <div style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                            <span className="badge-status" style={{ fontSize: '0.72rem', padding: '2px 8px', background: item.sync_status === 'failed' ? '#fee2e2' : '#fef3c7', color: item.sync_status === 'failed' ? '#b91c1c' : '#b45309', border: item.sync_status === 'failed' ? '1px solid #fca5a5' : '1px solid #fde68a', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {item.sync_status === 'failed' ? '⚠️ Upload Failed (Pending)' : '⏳ Upload Pending'}
                            </span>
                          </div>
                        ) : (
                          currentUser?.role === 'admin' && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '6px', gap: '4px' }}>
                              {item.status === 'released' ? (
                                <span className="badge-status badge-released" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                  ✅ Released for Review
                                </span>
                              ) : item.status === 'assigned' || item.status === 'completed' ? (
                                <span className="badge-status badge-assigned" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                  🔒 Assigned
                                </span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                                  <span className="badge-status" style={{ fontSize: '0.72rem', padding: '2px 8px', background: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2', fontWeight: 'bold' }}>
                                    ⏳ Not Released
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-quick-release"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReleaseItem(item.id);
                                    }}
                                    title="Release item immediately to Family Review"
                                  >
                                    🚀 Release
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        )}


                        {/* Institutional Candidate Badge */}
                        {item.institutional_candidate && item.institutional_candidate !== 'None' && (
                          <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 'bold', color: '#1565c0', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px', marginTop: '4px' }}>
                            🏛️ {item.institutional_candidate === 'Other' ? (item.institutional_name || 'Institution') : item.institutional_candidate}
                          </div>
                        )}

                        {/* Assignment Badge if already assigned */}
                        {item.status === 'assigned' && (
                          <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 'bold', color: '#7b1fa2', background: '#f3e5f5', padding: '2px 8px', borderRadius: '4px', marginTop: '4px' }}>
                            🔒 Assigned to {item.assigned_to_name || 'Family'}
                          </div>
                        )}

                        {/* Interested Cousins List */}
                        {item.interested_names && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            ⭐ Interested: {item.interested_names}
                          </div>
                        )}

                        <div style={{ marginTop: 'auto', paddingTop: '0.6rem' }}>
                          {/* Family Interest Toggle Button */}
                          <button
                            className={Boolean(item.user_interested) ? 'btn-green' : 'btn-outline'}
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.45rem 0.65rem',
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              fontWeight: Boolean(item.user_interested) ? 'bold' : 'normal',
                              background: Boolean(item.user_interested) ? 'var(--pine-primary)' : '#fff'
                            }}
                            onClick={(e) => handleToggleInterest(item, e)}
                          >
                            <Star size={15} fill={Boolean(item.user_interested) ? '#f59e0b' : 'none'} color={Boolean(item.user_interested) ? '#f59e0b' : 'var(--pine-primary)'} />
                            {Boolean(item.user_interested) ? "Interested (Tap to Remove)" : "I'm Interested"}
                          </button>

                          {currentUser?.role === 'admin' && (
                            <button
                              className="btn-outline"
                              style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', marginTop: '0.4rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--pine-primary)', borderColor: 'var(--pine-primary)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditItem(item);
                              }}
                            >
                              <Edit3 size={14} /> Edit Item & Pictures
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* MOCKUP 6 & 7: FAMILY MEMBER REVIEW ITEM (ONE AT A TIME) */}
          {currentView === 'review' && (() => {
            const currentReviewItem = items[reviewIndex % Math.max(1, items.length)];
            const reviewPhotos = currentReviewItem?.photos && currentReviewItem.photos.length > 0
              ? currentReviewItem.photos
              : (currentReviewItem?.primary_photo ? [{ photo_url: currentReviewItem.primary_photo, thumbnail_url: currentReviewItem.primary_thumb || currentReviewItem.primary_photo }] : []);
            const activeDisplayPhoto = reviewPhotos[activeReviewPhotoIdx]?.photo_url || currentReviewItem?.primary_photo || "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80";

            return (
              <div className="review-view-container">
                <div className="review-top-bar">
                  <button className="btn-outline" onClick={() => setCurrentView('catalog')}><ArrowLeft size={16} /> Back to Browse</button>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Item {(reviewIndex % Math.max(1, items.length)) + 1} of {items.length || 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {currentUser?.role === 'admin' && currentReviewItem && (
                      <>
                        {currentReviewItem.status === 'released' ? (
                          <>
                            <span className="badge-status badge-released" style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}>
                              Released for Review
                            </span>
                            <button
                              className="btn-outline"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: '#c62828', borderColor: '#ef9a9a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              onClick={() => handleUnreleaseItem(currentReviewItem.id)}
                            >
                              ↩️ Unrelease Item
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="badge-status" style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem', background: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2', fontWeight: 'bold' }}>
                              Not Released
                            </span>
                            <button
                              className="btn-green"
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              onClick={() => handleReleaseItem(currentReviewItem.id)}
                            >
                              🚀 Release for Family Review
                            </button>
                          </>
                        )}
                        <button
                          className="btn-outline"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: 'var(--pine-primary)', borderColor: 'var(--pine-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 'bold' }}
                          onClick={() => handleStartEditItem(currentReviewItem)}
                          title="Edit this item and its pictures"
                        >
                          <Edit3 size={15} /> Edit Item & Pictures
                        </button>
                      </>
                    )}
                    <button className="btn-outline" style={{ padding: '0.4rem 0.6rem' }} onClick={() => { setActiveReviewPhotoIdx(0); setReviewIndex(prev => (prev - 1 + Math.max(1, items.length)) % Math.max(1, items.length)); }} title="Previous Item"><ArrowLeft size={16} /></button>
                    <button className="btn-outline" style={{ padding: '0.4rem 0.6rem' }} onClick={() => { setActiveReviewPhotoIdx(0); setReviewIndex(prev => (prev + 1) % Math.max(1, items.length)); }} title="Next Item"><ArrowRight size={16} /></button>
                  </div>
                </div>

                {!decisionRecorded ? (
                  <div>
                    {/* Mockup 6 Main Card */}
                    <div className="review-main-card">
                      <div className="review-left-gallery">
                        <img src={activeDisplayPhoto} className="review-main-img" alt={currentReviewItem?.title || "Item Preview"} />
                        {reviewPhotos.length <= 1 ? (
                          <div className="review-thumbs-row" style={{ alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                            {reviewPhotos.length === 1 && (
                              <img src={reviewPhotos[0].thumbnail_url || reviewPhotos[0].photo_url} className="review-thumb active" alt="Primary Photo" />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0f4f2', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              <ImageOff size={18} />
                              <span>No other pictures</span>
                            </div>
                          </div>
                        ) : (
                          <div className="review-thumbs-row">
                            {reviewPhotos.map((p, idx) => (
                              <img
                                key={p.id || idx}
                                src={p.thumbnail_url || p.photo_url}
                                className={`review-thumb ${activeReviewPhotoIdx === idx ? 'active' : ''}`}
                                onClick={() => setActiveReviewPhotoIdx(idx)}
                                alt={`Thumb ${idx + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="review-right-info">
                        <div className="review-item-header">
                          <h2 className="review-item-name">{currentReviewItem?.title || "Untitled Item"}</h2>
                          <Heart size={22} color="#d32f2f" fill="#d32f2f" />
                        </div>

                        <table className="details-table">
                          <tbody>
                            <tr><td className="label">Category</td><td className="val">{currentReviewItem?.category_name || "—"}</td></tr>
                            <tr><td className="label">Location</td><td className="val">{currentReviewItem?.location_in_house || "—"}</td></tr>
                            <tr><td className="label">Value</td><td className="val">{currentReviewItem?.value ? (currentReviewItem.value.startsWith('$') ? currentReviewItem.value : `$${currentReviewItem.value}`) : "—"}</td></tr>
                            <tr><td className="label">Dimensions</td><td className="val">{currentReviewItem?.dimensions || "—"}</td></tr>
                            <tr><td className="label">Condition</td><td className="val">{currentReviewItem?.condition || "—"}</td></tr>
                          </tbody>
                        </table>

                        <div className="review-section-title">Description</div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                          {currentReviewItem?.description || "No description provided."}
                        </div>

                        {(currentReviewItem?.story || currentReviewItem?.story_text) && (
                          <>
                            <div className="review-section-title">Story / History</div>
                            <div className="review-story-text">
                              "{currentReviewItem.story || currentReviewItem.story_text}"
                            </div>
                          </>
                        )}

                        {currentReviewItem?.category_name && (
                          <div className="tags-row">
                            <span className="tag-pill">{currentReviewItem.category_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mockup 7: Who's Interested & Decision Panel */}
                    <div className="decision-panel">
                      {currentReviewItem?.institutional_candidate && currentReviewItem.institutional_candidate !== 'None' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold', color: '#1565c0', background: '#e3f2fd', padding: '4px 10px', borderRadius: '6px', marginBottom: '0.75rem' }}>
                          🏛️ Institutional Candidate: {currentReviewItem.institutional_candidate === 'Other' ? (currentReviewItem.institutional_name || 'Institution') : currentReviewItem.institutional_candidate}
                        </div>
                      )}

                      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', marginBottom: '0.85rem' }}>Who's interested?</h3>
                      {currentReviewItem?.interested_count > 0 ? (
                        <div style={{ fontSize: '0.9rem', color: 'var(--pine-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                          ❤️ {currentReviewItem.interested_count} family member(s) marked interest in this item.
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                          No family members have marked interest yet.
                        </div>
                      )}
                      {currentReviewItem?.interested_names && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                          ⭐ Interested family members: <strong>{currentReviewItem.interested_names}</strong>
                        </div>
                      )}

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

                      <button className="btn-green" style={{ width: '100%', padding: '0.8rem' }} onClick={() => handleSaveFamilyDecision(currentReviewItem?.id || 'item_101')}>
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

                    <button className="btn-green" style={{ width: '100%', padding: '0.85rem' }} onClick={() => { setDecisionRecorded(false); setActiveReviewPhotoIdx(0); setReviewIndex(prev => (prev + 1) % Math.max(1, items.length)); }}>
                      Proceed to Next Item ➔
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

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

          {/* FAMILY ESTATE DRAFT VIEW */}
          {currentView === 'draft_mode' && (() => {
            const availableItems = items.filter(i => i.status === 'released' || (i.status !== 'assigned' && i.status !== 'completed' && i.status !== 'draft'));
            const currentPickerName = draftState.currentPicker?.name || '';
            
            // Current picker's interested items
            const pickerInterestedItems = availableItems.filter(i => {
              if (!currentPickerName) return false;
              if (i.interested_names && i.interested_names.toLowerCase().includes(currentPickerName.toLowerCase())) return true;
              if (draftState.isCurrentUserTurn && Boolean(i.user_interested)) return true;
              return false;
            });

            const displayedDraftItems = (draftItemFilter === 'interested' ? pickerInterestedItems : availableItems).filter(item => {
              if (draftSearch) {
                const q = draftSearch.toLowerCase();
                const matchTitle = (item.title || '').toLowerCase().includes(q);
                const matchNum = (item.item_number || '').toLowerCase().includes(q);
                const matchCat = (item.category_name || '').toLowerCase().includes(q);
                const matchDesc = (item.description || '').toLowerCase().includes(q);
                if (!matchTitle && !matchNum && !matchCat && !matchDesc) return false;
              }
              if (draftCategoryFilter && item.category_id !== draftCategoryFilter) return false;
              return true;
            });

            return (
              <div>
                {/* DRAFT HEADER BANNER */}
                <div style={{
                  background: draftState.isCurrentUserTurn 
                    ? 'linear-gradient(135deg, #1b3d2b 0%, #29573e 100%)' 
                    : 'var(--pine-deep)',
                  color: '#fff',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  marginBottom: '1.25rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  border: draftState.isCurrentUserTurn ? '2px solid #f59e0b' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <Layers size={22} color={draftState.isCurrentUserTurn ? '#f59e0b' : '#a3c2b1'} />
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>
                          Uncle Jim's Estate Draft
                        </h1>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#c4dbce' }}>
                        Round {draftState.currentRound} | Overall Pick #{draftState.activePickCount + 1}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {currentUser?.role === 'admin' && (
                        <button
                          className="btn-outline"
                          style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', fontSize: '0.82rem', padding: '0.35rem 0.75rem', minHeight: '36px' }}
                          onClick={() => setIsReorderingDraft(true)}
                        >
                          <Settings size={15} style={{ marginRight: '4px' }} /> Reorder Draft
                        </button>
                      )}
                      <button
                        className="btn-outline"
                        style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', fontSize: '0.82rem', padding: '0.35rem 0.75rem', minHeight: '36px' }}
                        onClick={fetchDraftData}
                        title="Refresh draft board"
                      >
                        <RefreshCw size={15} />
                      </button>
                    </div>
                  </div>

                  {/* TURN STATUS HIGHLIGHT */}
                  <div style={{
                    background: draftState.isCurrentUserTurn ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.08)',
                    border: draftState.isCurrentUserTurn ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>{draftState.isCurrentUserTurn ? '⭐' : '🎯'}</span>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: draftState.isCurrentUserTurn ? '#fcd34d' : '#fff' }}>
                          {draftState.isCurrentUserTurn ? "IT'S YOUR TURN TO PICK!" : `On The Clock: ${currentPickerName || 'Waiting...'}`}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#c4dbce' }}>
                          {draftState.isCurrentUserTurn 
                            ? "Browse items below and choose your selection for this round."
                            : currentUser?.role === 'admin'
                              ? `Admin Mode: You may record a pick on behalf of ${currentPickerName}.`
                              : `Please wait while ${currentPickerName} makes their draft selection.`}
                        </div>
                      </div>
                    </div>
                    <span className="badge-status" style={{ background: '#fff', color: 'var(--pine-deep)', fontWeight: 'bold', padding: '0.35rem 0.75rem' }}>
                      Pick #{draftState.activePickCount + 1}
                    </span>
                  </div>

                  {/* DRAFT ORDER RIBBON */}
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a3c2b1', marginBottom: '0.45rem', fontWeight: 'bold' }}>
                      Draft Order Sequence:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
                      {draftState.draftOrder.map((participant, idx) => {
                        const isCurrent = draftState.currentPicker?.user_id === participant.user_id;
                        return (
                          <div
                            key={participant.user_id}
                            style={{
                              background: isCurrent ? '#f59e0b' : 'rgba(255,255,255,0.12)',
                              color: isCurrent ? '#1a3323' : '#fff',
                              borderRadius: '20px',
                              padding: '0.25rem 0.75rem',
                              fontSize: '0.82rem',
                              fontWeight: isCurrent ? 'bold' : 'normal',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              whiteSpace: 'nowrap',
                              boxShadow: isCurrent ? '0 0 8px rgba(245, 158, 11, 0.6)' : 'none'
                            }}
                          >
                            <span>{idx + 1}.</span>
                            <span>{participant.name}</span>
                            {isCurrent && <span>★</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* DRAFT SUB-TABS NAVIGATION */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                  <button
                    className={`btn-outline ${draftSubTab === 'board' ? 'btn-green' : ''}`}
                    style={{ fontSize: '0.9rem', padding: '0.45rem 1rem', borderRadius: '8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => setDraftSubTab('board')}
                  >
                    🎯 Draft Board (Pick Items)
                  </button>
                  <button
                    className={`btn-outline ${draftSubTab === 'history' ? 'btn-green' : ''}`}
                    style={{ fontSize: '0.9rem', padding: '0.45rem 1rem', borderRadius: '8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => setDraftSubTab('history')}
                  >
                    📜 Draft History & Log ({draftHistory.length})
                  </button>
                  <button
                    className={`btn-outline ${draftSubTab === 'summary' ? 'btn-green' : ''}`}
                    style={{ fontSize: '0.9rem', padding: '0.45rem 1rem', borderRadius: '8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => setDraftSubTab('summary')}
                  >
                    📊 Items Drafted by Person
                  </button>
                </div>

                {/* TAB 1: DRAFT BOARD */}
                {draftSubTab === 'board' && (
                  <div>
                    {/* Filter Pills: Current Picker's Interests vs All Available Items */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        className={`btn-outline ${draftItemFilter === 'interested' ? 'btn-green' : ''}`}
                        style={{ fontSize: '0.88rem', padding: '0.4rem 0.9rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        onClick={() => setDraftItemFilter('interested')}
                      >
                        <Star size={15} fill={draftItemFilter === 'interested' ? '#fff' : '#f59e0b'} color="#f59e0b" />
                        {currentPickerName}'s Interested Items ({pickerInterestedItems.length})
                      </button>
                      <button
                        className={`btn-outline ${draftItemFilter === 'all' ? 'btn-green' : ''}`}
                        style={{ fontSize: '0.88rem', padding: '0.4rem 0.9rem', borderRadius: '20px' }}
                        onClick={() => setDraftItemFilter('all')}
                      >
                        📦 All Available Items ({availableItems.length})
                      </button>
                    </div>

                    {/* Search and Category Filter for Draft */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '220px', display: 'flex', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', alignItems: 'center' }}>
                        <Search size={18} color="var(--text-muted)" style={{ marginRight: '0.5rem' }} />
                        <input
                          type="text"
                          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                          placeholder="Search available inventory during draft..."
                          value={draftSearch}
                          onChange={e => setDraftSearch(e.target.value)}
                        />
                        {draftSearch && (
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }} onClick={() => setDraftSearch('')}>
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      <select
                        style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '0.9rem', outline: 'none' }}
                        value={draftCategoryFilter}
                        onChange={e => setDraftCategoryFilter(e.target.value)}
                      >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    {/* Available Items Grid */}
                    {displayedDraftItems.length === 0 ? (
                      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Package size={48} color="var(--pine-primary)" style={{ opacity: 0.4, marginBottom: '1rem' }} />
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--pine-deep)' }}>No available items</h3>
                        <p style={{ fontSize: '0.9rem', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
                          {draftItemFilter === 'interested'
                            ? `${currentPickerName} has no remaining unassigned interested items matching this search.`
                            : "No available inventory items match your search or filter criteria."}
                        </p>
                        {draftItemFilter === 'interested' && (
                          <button className="btn-green" style={{ padding: '0.6rem 1.25rem' }} onClick={() => setDraftItemFilter('all')}>
                            View All Available Items ➔
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
                        {displayedDraftItems.map(item => {
                          const canPick = currentUser?.role === 'admin' || draftState.isCurrentUserTurn;

                          return (
                            <div
                              key={item.id}
                              className="card"
                              style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', position: 'relative' }}
                            >
                              <div style={{ position: 'relative' }}>
                                <img
                                  src={item.primary_photo || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'}
                                  style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }}
                                  alt={item.title || "Estate Item"}
                                />
                                {item.item_number && (
                                  <span style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.72rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>
                                    {item.item_number}
                                  </span>
                                )}
                              </div>

                              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '2px' }}>
                                {item.title || 'Untitled Item'}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.category_name || "Uncategorized"}</span>
                                {item.value && (
                                  <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: 'var(--pine-primary)' }}>
                                    {item.value.startsWith('$') ? item.value : `$${item.value}`}
                                  </span>
                                )}
                              </div>

                              {/* Institutional Candidate Tag */}
                              {item.institutional_candidate && item.institutional_candidate !== 'None' && (
                                <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 'bold', color: '#1565c0', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px', marginBottom: '4px' }}>
                                  🏛️ {item.institutional_candidate === 'Other' ? (item.institutional_name || 'Institution') : item.institutional_candidate}
                                </div>
                              )}

                              {/* Interested Cousins List */}
                              {item.interested_names ? (
                                <div style={{ fontSize: '0.78rem', color: '#555', background: '#f8faf9', padding: '0.35rem 0.5rem', borderRadius: '4px', margin: '4px 0 8px 0' }}>
                                  ⭐ <strong>Interested:</strong> {item.interested_names}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0 8px 0' }}>
                                  No family interest expressed yet
                                </div>
                              )}

                              {/* Draft Action Button */}
                              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                                <button
                                  className={canPick ? "btn-green-senior" : "btn-outline"}
                                  style={{
                                    width: '100%',
                                    minHeight: '48px',
                                    fontSize: '0.92rem',
                                    fontWeight: 'bold',
                                    justifyContent: 'center',
                                    opacity: canPick ? 1 : 0.6,
                                    cursor: canPick ? 'pointer' : 'not-allowed'
                                  }}
                                  disabled={!canPick}
                                  onClick={() => setConfirmingDraftPick({ item, picker: draftState.currentPicker })}
                                >
                                  {canPick 
                                    ? `🎯 Draft to ${currentPickerName}` 
                                    : `⏳ Waiting for ${currentPickerName}'s turn`}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: DRAFT HISTORY & REVERSALS */}
                {draftSubTab === 'history' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--pine-deep)', margin: 0 }}>
                          📜 Permanent Draft History Log
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                          Chronological immutable record of all draft selections and admin corrections.
                        </p>
                      </div>
                    </div>

                    {draftHistory.length === 0 ? (
                      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Clock size={44} color="var(--pine-primary)" style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--pine-deep)' }}>No picks made yet</h3>
                        <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>The draft log will record each pick as it is confirmed.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {draftHistory.map(pick => (
                          <div
                            key={pick.id}
                            className="card"
                            style={{
                              padding: '1rem',
                              borderLeft: pick.is_reversed ? '4px solid #d32f2f' : '4px solid var(--pine-primary)',
                              background: pick.is_reversed ? '#fffafa' : '#fff'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--pine-deep)' }}>
                                  Pick #{pick.pick_number}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  (Round {pick.round_number})
                                </span>
                              </div>
                              {pick.is_reversed ? (
                                <span className="badge-status" style={{ background: '#ffebee', color: '#c62828', fontWeight: 'bold', fontSize: '0.72rem' }}>
                                  ⚠️ REVERSED
                                </span>
                              ) : (
                                <span className="badge-status badge-released" style={{ fontSize: '0.75rem' }}>
                                  ✅ Drafted
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.35rem' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#1a1a1a' }}>
                                  {pick.item_title}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  Item ID: {pick.item_id}
                                </div>
                              </div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--pine-primary)', whiteSpace: 'nowrap' }}>
                                {pick.item_value ? (pick.item_value.startsWith('$') ? pick.item_value : `$${pick.item_value}`) : '—'}
                              </div>
                            </div>

                            <div style={{ fontSize: '0.88rem', color: '#333', marginBottom: '0.25rem' }}>
                              Drafted to: <strong style={{ color: 'var(--pine-primary)' }}>{pick.user_name}</strong>
                            </div>

                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                              <div>
                                <span>Confirmed by {pick.confirmed_by_name || 'System'}</span> • {new Date(pick.created_at).toLocaleString()}
                              </div>
                              {pick.is_reversed && (
                                <div style={{ color: '#c62828', width: '100%', fontWeight: '500' }}>
                                  Correction logged by {pick.reversed_by_name || 'Admin'} on {new Date(pick.reversed_at).toLocaleString()}
                                </div>
                              )}
                              {currentUser?.role === 'admin' && !pick.is_reversed && (
                                <button
                                  className="btn-outline"
                                  style={{ color: '#d32f2f', borderColor: '#ffcdd2', fontSize: '0.78rem', padding: '0.35rem 0.75rem', marginLeft: 'auto', marginTop: '4px' }}
                                  onClick={() => setConfirmingReversePick(pick)}
                                >
                                  ↩️ Reverse Pick
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: ITEMS DRAFTED BY PERSON & VALUE REPORTING */}
                {draftSubTab === 'summary' && (
                  <div>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--pine-deep)', margin: 0 }}>
                        📊 Items Drafted by Person & Total Values
                      </h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                        Estate accounting summary calculating total appraised/estimated possession values received by each cousin.
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                      {draftSummary.map(person => (
                        <div key={person.userId} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.15rem', color: 'var(--pine-deep)' }}>
                              {person.name}
                            </div>
                            <span className="badge-status" style={{ background: '#f0f4f2', color: 'var(--pine-primary)', fontWeight: 'bold' }}>
                              {person.itemCount} Item{person.itemCount !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Total Value Banner */}
                          <div style={{
                            background: '#f4f8f5',
                            border: '1px solid #d1e3d7',
                            borderRadius: '8px',
                            padding: '0.65rem 0.85rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem'
                          }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--pine-deep)' }}>Total Appraised Value:</span>
                            <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--pine-primary)' }}>
                              {person.formattedTotalValue}
                            </span>
                          </div>

                          {/* Itemized List */}
                          <div style={{ flex: 1 }}>
                            {person.items && person.items.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {person.items.map(item => (
                                  <div
                                    key={item.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.65rem',
                                      background: '#fff',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '6px',
                                      padding: '0.45rem 0.65rem'
                                    }}
                                  >
                                    <img
                                      src={item.photo_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=150&q=80'}
                                      style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px' }}
                                      alt={item.item_title}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '600', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.item_title}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {item.item_number ? `${item.item_number} • ` : ''}Pick #{item.pick_number} (Round {item.round_number})
                                      </div>
                                    </div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: 'var(--pine-primary)', whiteSpace: 'nowrap' }}>
                                      {item.item_value ? (item.item_value.startsWith('$') ? item.item_value : `$${item.item_value}`) : '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.88rem', fontStyle: 'italic' }}>
                                No items drafted yet.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '1.5rem', padding: '0.85rem', background: '#f8faf9', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      ℹ️ <em>Notice: Total values are calculated for estate accounting and inventory reporting purposes. Final inheritance and cash distributions are handled separately by the estate executor.</em>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* CONFIRM DRAFT PICK MODAL */}
          {confirmingDraftPick && (
            <div className="modal-overlay" onClick={() => !isProcessingDraftAction && setConfirmingDraftPick(null)}>
              <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                  <h3 style={{ margin: 0, color: 'var(--pine-deep)', fontSize: '1.2rem' }}>Confirm Draft Pick</h3>
                  <button className="modal-close-btn" onClick={() => !isProcessingDraftAction && setConfirmingDraftPick(null)}>✕</button>
                </div>
                <div className="modal-body" style={{ padding: '1.25rem' }}>
                  <p style={{ fontSize: '1.05rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                    Are you sure you want to draft <strong>{confirmingDraftPick.item.title}</strong>
                    {confirmingDraftPick.item.value ? ` (Value: ${confirmingDraftPick.item.value.startsWith('$') ? confirmingDraftPick.item.value : '$' + confirmingDraftPick.item.value})` : ''} to <strong>{confirmingDraftPick.picker.name}</strong>?
                  </p>
                  <div style={{ background: '#f4f8f5', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.85rem', color: 'var(--pine-deep)', marginBottom: '1.25rem' }}>
                    📌 <strong>What happens when confirmed:</strong>
                    <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
                      <li>Item will be assigned to {confirmingDraftPick.picker.name} and locked from future draft picks.</li>
                      <li>All prior interest records are permanently preserved in historical data.</li>
                      <li>Transaction is recorded in the permanent Draft History log.</li>
                      <li>Draft immediately advances to the next cousin.</li>
                    </ul>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button className="btn-outline" onClick={() => setConfirmingDraftPick(null)} disabled={isProcessingDraftAction}>Cancel</button>
                    <button className="btn-green-senior" style={{ minHeight: '44px', padding: '0.6rem 1.25rem' }} onClick={handleExecuteDraftPick} disabled={isProcessingDraftAction}>
                      {isProcessingDraftAction ? 'Processing Pick...' : '✅ Confirm Draft Pick'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRM REVERSE PICK MODAL */}
          {confirmingReversePick && (
            <div className="modal-overlay" onClick={() => !isProcessingDraftAction && setConfirmingReversePick(null)}>
              <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                  <h3 style={{ margin: 0, color: '#d32f2f', fontSize: '1.2rem' }}>⚠️ Reverse Draft Pick</h3>
                  <button className="modal-close-btn" onClick={() => !isProcessingDraftAction && setConfirmingReversePick(null)}>✕</button>
                </div>
                <div className="modal-body" style={{ padding: '1.25rem' }}>
                  <p style={{ fontSize: '1rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                    Are you sure you want to reverse Pick #{confirmingReversePick.pick_number} (<strong>{confirmingReversePick.item_title}</strong> to <strong>{confirmingReversePick.user_name}</strong>)?
                  </p>
                  <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '0.85rem', fontSize: '0.85rem', color: '#b71c1c', marginBottom: '1.25rem' }}>
                    ⚠️ <strong>Permanent Audit Trail:</strong>
                    <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
                      <li>The item will become available for drafting again.</li>
                      <li>This record is <strong>NOT</strong> deleted — the correction will be permanently marked in Draft History and logged in the estate audit trail with your admin ID and timestamp.</li>
                    </ul>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button className="btn-outline" onClick={() => setConfirmingReversePick(null)} disabled={isProcessingDraftAction}>Cancel</button>
                    <button className="btn-outline" style={{ background: '#d32f2f', color: '#fff', borderColor: '#d32f2f', minHeight: '44px', padding: '0.6rem 1.25rem', fontWeight: 'bold' }} onClick={handleExecuteReversePick} disabled={isProcessingDraftAction}>
                      {isProcessingDraftAction ? 'Reversing...' : '⚠️ Confirm Reversal'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN REORDER DRAFT MODAL */}
          {isReorderingDraft && (
            <div className="modal-overlay" onClick={() => !isProcessingDraftAction && setIsReorderingDraft(false)}>
              <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                  <h3 style={{ margin: 0, color: 'var(--pine-deep)', fontSize: '1.2rem' }}>⚙️ Establish Draft Order</h3>
                  <button className="modal-close-btn" onClick={() => !isProcessingDraftAction && setIsReorderingDraft(false)}>✕</button>
                </div>
                <div className="modal-body" style={{ padding: '1.25rem' }}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Use the arrows to set the draft order for all participants. The draft follows this order each round.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {reorderOrder.map((userId, idx) => {
                      const participant = draftState.draftOrder.find(d => d.user_id === userId) || usersList.find(u => u.id === userId);
                      return (
                        <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8faf9', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.85rem' }}>
                          <span style={{ fontWeight: 'bold', width: '24px', color: 'var(--pine-primary)' }}>{idx + 1}.</span>
                          <span style={{ flex: 1, fontWeight: '500' }}>{participant?.name || userId}</span>
                          <button
                            type="button"
                            className="btn-outline"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', minHeight: '32px' }}
                            disabled={idx === 0}
                            onClick={() => {
                              const next = [...reorderOrder];
                              const temp = next[idx - 1];
                              next[idx - 1] = next[idx];
                              next[idx] = temp;
                              setReorderOrder(next);
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="btn-outline"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', minHeight: '32px' }}
                            disabled={idx === reorderOrder.length - 1}
                            onClick={() => {
                              const next = [...reorderOrder];
                              const temp = next[idx + 1];
                              next[idx + 1] = next[idx];
                              next[idx] = temp;
                              setReorderOrder(next);
                            }}
                          >
                            ▼
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button className="btn-outline" onClick={() => setIsReorderingDraft(false)} disabled={isProcessingDraftAction}>Cancel</button>
                    <button className="btn-green" onClick={handleSaveDraftOrder} disabled={isProcessingDraftAction}>
                      {isProcessingDraftAction ? 'Saving...' : '💾 Save Draft Order'}
                    </button>
                  </div>
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
                        <button className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }} onClick={() => { const idx = items.findIndex(i => i.id === item.id); if (idx !== -1) setReviewIndex(idx); setActiveReviewPhotoIdx(0); setSelectedItem(item); setCurrentView('review'); }}>
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

      {/* Admin Item & Pictures Edit Modal */}
      {adminEditingItem && (
        <div className="modal-overlay" onClick={() => setAdminEditingItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--pine-deep)' }}>
                  Edit Item: {adminEditingItem.title}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Update item details, manage photos, and save changes.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAdminEditingItem(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Item Release Status & Workflow Control */}
              <div style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                borderRadius: '10px',
                border: editFormStatus === 'released' ? '1px solid #c8e6c9' : '1px solid #ffe0b2',
                background: editFormStatus === 'released' ? '#f1f8e9' : '#fff8e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.85rem'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Family Visibility:
                    </span>
                    {editFormStatus === 'released' ? (
                      <span className="badge-status badge-released" style={{ fontSize: '0.85rem', padding: '0.25rem 0.65rem' }}>
                        Released for Review
                      </span>
                    ) : (
                      <span className="badge-status" style={{ fontSize: '0.85rem', padding: '0.25rem 0.65rem', background: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2', fontWeight: 'bold' }}>
                        Not Released
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.84rem', color: editFormStatus === 'released' ? '#2e7d32' : '#b78103' }}>
                    {editFormStatus === 'released'
                      ? 'Visible to family members when browsing the estate inventory.'
                      : 'Hidden from standard family users until released for review.'}
                  </span>
                </div>

                <div style={{ width: '100%', maxWidth: '320px' }}>
                  {editFormStatus === 'released' ? (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        padding: '0 1rem',
                        fontSize: '0.92rem',
                        fontWeight: 'bold',
                        color: '#c62828',
                        borderColor: '#ef9a9a',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleUnreleaseItem(adminEditingItem.id)}
                    >
                      ↩️ Unrelease Item
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-green"
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        padding: '0 1.25rem',
                        fontSize: '0.95rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 2px 6px rgba(46,125,50,0.3)',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleReleaseItem(adminEditingItem.id)}
                    >
                      🚀 Release for Family Review
                    </button>
                  )}
                </div>
              </div>

              {/* Photo Management Section */}
              <div style={{ marginBottom: '1.5rem', background: '#fcfbf7', border: '1px solid #ebd8be', padding: '1rem', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--pine-deep)' }}>Photos ({editFormPhotos.length})</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Add or delete item pictures
                    </span>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={editPhotoInputRef}
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAddPhotosToEditItem}
                    />
                    <button
                      type="button"
                      className="btn-modal-secondary"
                      style={{ minHeight: '40px', height: '40px', padding: '0 0.85rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                      disabled={isUploadingEditPhotos}
                      onClick={() => editPhotoInputRef.current && editPhotoInputRef.current.click()}
                    >
                      <Plus size={16} />
                      {isUploadingEditPhotos ? 'Uploading...' : 'Add Pictures'}
                    </button>
                  </div>
                </div>

                {editFormPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    <ImageOff size={28} style={{ opacity: 0.4, marginBottom: '0.35rem' }} />
                    <div>No photos uploaded for this item yet.</div>
                  </div>
                ) : (
                  <div className="edit-photos-grid">
                    {editFormPhotos.map((photo) => (
                      <div key={photo.id} className="edit-photo-card" style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', padding: '6px' }}>
                        <div style={{ position: 'relative', width: '100%', height: '120px', background: '#f6f5f0', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img
                            src={photo.thumbnail_url || photo.photo_url || photo.url}
                            alt="Item photo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                          {Boolean(photo.is_primary) && (
                            <span className="edit-photo-primary-badge" style={{ position: 'absolute', top: '6px', left: '6px', margin: 0 }}>
                              ★ Primary
                            </span>
                          )}
                          <button
                            type="button"
                            className="edit-photo-delete-btn"
                            title="Delete photo"
                            onClick={() => handleDeletePhotoFromEditItem(photo.id)}
                            style={{ position: 'absolute', top: '6px', right: '6px' }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Photo Action Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                          {!Boolean(photo.is_primary) && (
                            <button
                              type="button"
                              className="btn-outline"
                              style={{
                                fontSize: '0.74rem',
                                padding: '3px 6px',
                                minHeight: '28px',
                                justifyContent: 'center',
                                color: 'var(--pine-primary)',
                                borderColor: 'var(--pine-primary)',
                                background: '#fff'
                              }}
                              onClick={() => handleSetPrimaryPhoto(photo.id)}
                            >
                              ★ Set as Primary
                            </button>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn-outline"
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 4px',
                                minHeight: '28px',
                                justifyContent: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#f8faf9'
                              }}
                              onClick={() => {
                                const fullUrl = photo.photo_url || photo.url || photo.thumbnail_url;
                                setCropModalSrc(fullUrl);
                                setCropModalTarget({ type: 'edit_photo', photo });
                              }}
                              title="Crop or adjust framing"
                            >
                              <Crop size={12} />
                              Re-crop
                            </button>
                            <button
                              type="button"
                              className="btn-outline"
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 4px',
                                minHeight: '28px',
                                justifyContent: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                color: '#6b7280',
                                background: '#f8faf9'
                              }}
                              onClick={() => handleRestoreOriginalCrop(photo.id)}
                              title="Restore full uncropped framing"
                            >
                              <RotateCcw size={12} />
                              Restore
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Editable Fields */}
              <div className="edit-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="form-field-group">
                  <label className="form-field-label">Title *</label>
                  <input
                    type="text"
                    className="form-field-input"
                    value={editFormTitle}
                    onChange={(e) => setEditFormTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Category</label>
                  <select
                    className="form-field-select"
                    value={editFormCategory}
                    onChange={(e) => setEditFormCategory(e.target.value)}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.length > 0 ? (
                      categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Furniture">Furniture</option>
                        <option value="Decor">Decor</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Kitchen">Kitchen</option>
                        <option value="Books">Books</option>
                        <option value="Tools">Tools</option>
                        <option value="Jewelry">Jewelry</option>
                        <option value="Collectibles">Collectibles</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Estimated Value</label>
                  <input
                    type="text"
                    className="form-field-input"
                    placeholder="e.g. $450"
                    value={editFormValue}
                    onChange={(e) => setEditFormValue(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Current Status</label>
                  <select
                    className="form-field-select"
                    value={editFormStatus}
                    onChange={(e) => setEditFormStatus(e.target.value)}
                  >
                    <option value="draft">Not Released</option>
                    <option value="released">Released for Review</option>
                    <option value="assigned">Assigned</option>
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Institutional Candidate</label>
                  <select
                    className="form-field-select"
                    value={editFormInstitutionalCandidate}
                    onChange={(e) => setEditFormInstitutionalCandidate(e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="Manitowish Waters Library">Manitowish Waters Library</option>
                    <option value="Maritime Museum">Maritime Museum</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {editFormInstitutionalCandidate === 'Other' && (
                  <div className="form-field-group">
                    <label className="form-field-label">Custom Institution Name</label>
                    <input
                      type="text"
                      className="form-field-input"
                      placeholder="e.g. Northwoods Historical Society"
                      value={editFormInstitutionalName}
                      onChange={(e) => setEditFormInstitutionalName(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-field-group">
                  <label className="form-field-label">Location in Estate</label>
                  <input
                    type="text"
                    className="form-field-input"
                    placeholder="e.g. Living Room, Attic"
                    value={editFormLocation}
                    onChange={(e) => setEditFormLocation(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Condition</label>
                  <input
                    type="text"
                    className="form-field-input"
                    placeholder="e.g. Excellent, Minor wear"
                    value={editFormCondition}
                    onChange={(e) => setEditFormCondition(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Dimensions</label>
                  <input
                    type="text"
                    className="form-field-input"
                    placeholder="e.g. 36W x 24D x 48H"
                    value={editFormDimensions}
                    onChange={(e) => setEditFormDimensions(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Weight</label>
                  <input
                    type="text"
                    className="form-field-input"
                    placeholder="e.g. 25 lbs"
                    value={editFormWeight}
                    onChange={(e) => setEditFormWeight(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-field-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-field-label">Description & Notes</label>
                <textarea
                  className="form-field-textarea"
                  rows={3}
                  value={editFormDescription}
                  onChange={(e) => setEditFormDescription(e.target.value)}
                  placeholder="General description, provenance notes, details..."
                />
              </div>

              <div className="form-field-group">
                <label className="form-field-label">Family Story / History</label>
                <textarea
                  className="form-field-textarea"
                  rows={3}
                  value={editFormStory}
                  onChange={(e) => setEditFormStory(e.target.value)}
                  placeholder="Memories, who gave this to Jim, historical significance..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-secondary"
                onClick={() => setAdminEditingItem(null)}
                disabled={isSavingItemEdits}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-primary"
                onClick={handleSaveItemEdits}
                disabled={isSavingItemEdits}
              >
                {isSavingItemEdits ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Cropper Modal */}
      {cropModalSrc && (
        <PhotoCropperModal
          imageSrc={cropModalSrc}
          onConfirm={handleCropModalConfirm}
          onCancel={() => {
            setCropModalSrc(null);
            setCropModalTarget(null);
          }}
        />
      )}
    </div>
  );
}
