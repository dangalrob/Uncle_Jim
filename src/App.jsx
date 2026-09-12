import React, { useState, useEffect, useRef } from 'react';
import { 
  Trees, LayoutDashboard, Package, PlusCircle, Tag, Users, Layers, 
  BookOpen, CheckSquare, Truck, UserCheck, History, BarChart2, Settings, 
  Search, Filter, Heart, ArrowLeft, ArrowRight, CheckCircle2, Camera, 
  X, Check, Mail, Lock, Unlock, AlertCircle, Share2, HelpCircle, Menu,
  Wifi, WifiOff, UploadCloud, Building2, FileText, Sparkles, Loader2, Trash2, ImageOff,
  Edit3, Plus, Star, RotateCcw, Clock, RefreshCw, Award, DollarSign, Crop,
  LogOut, Activity, MessageSquare, MessageCircle, Key
} from 'lucide-react';
import { offlineStorage } from './services/offlineStorage';
import { thumbnailCache } from './services/thumbnailCache';
import CachedThumbnail from './components/CachedThumbnail';
import AdminWorkbench from './components/AdminWorkbench';
import AdminReviewMode from './components/AdminReviewMode';
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
  const [editFormDestination, setEditFormDestination] = useState('undecided');
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
  const [adminReviewItemId, setAdminReviewItemId] = useState(null);
  const [cacheStats, setCacheStats] = useState({ total: 0, cached: 0, updating: 0, remaining: 0, isComplete: true });

  useEffect(() => {
    const unsub = thumbnailCache.subscribe((stats) => {
      setCacheStats(stats);
    });
    return unsub;
  }, []);

  const handleNavigateHome = () => {
    setMobileNavOpen(false);
    setAdminEditingItem(null);
    setSelectedCatalogItem(null);
    setDetailItem(null);
    setAdminReviewItemId(null);
    if (currentUser?.role === 'admin') {
      if (adminViewMode === 'user') {
        setCurrentView('catalog');
      } else {
        setCurrentView('dashboard');
      }
    } else if (currentUser?.role === 'institution') {
      setCurrentView('institution');
    } else {
      setCurrentView('catalog');
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
  const [syncDiagnostics, setSyncDiagnostics] = useState([]);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [myInterests, setMyInterests] = useState([]);
  
  // Admin View Mode: 'admin' (Admin Dashboard & controls) vs 'user' (Regular User Experience)
  const [adminViewMode, setAdminViewMode] = useState(() => {
    return localStorage.getItem('uj_admin_view_mode') || 'admin';
  });
  const [showAdminChoiceModal, setShowAdminChoiceModal] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState('');

  // Item Detail Stories and Questions state
  const [itemDetailStories, setItemDetailStories] = useState([]);
  const [itemDetailQuestions, setItemDetailQuestions] = useState([]);
  const [newStoryText, setNewStoryText] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [isSubmittingStory, setIsSubmittingStory] = useState(false);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

  // Admin Questions & Stories views state
  const [adminQuestions, setAdminQuestions] = useState([]);
  const [adminQuestionsFilter, setAdminQuestionsFilter] = useState('all'); // 'all' | 'unanswered' | 'answered'
  const [adminAnsweringQuestionId, setAdminAnsweringQuestionId] = useState(null);
  const [adminAnswerText, setAdminAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [adminStories, setAdminStories] = useState([]);
  const [isLoadingAdminQA, setIsLoadingAdminQA] = useState(false);

  // Password Management State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(null);
  const [changePasswordError, setChangePasswordError] = useState(null);

  // Admin User Management & Password Reset State
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState(null); // target user object
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(null);
  const [resetPasswordError, setResetPasswordError] = useState(null);

  // Admin Interest Dashboard State
  const [adminInterests, setAdminInterests] = useState([]);
  const [isLoadingAdminInterests, setIsLoadingAdminInterests] = useState(false);
  const [adminInterestsSearch, setAdminInterestsSearch] = useState('');
  const [adminInterestsUserFilter, setAdminInterestsUserFilter] = useState('all');
  
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
      if (currentView === 'admin_interests' && currentUser.role === 'admin') {
        fetchAdminInterests();
      }
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


  const getAuthHeaders = () => {
    const token = localStorage.getItem('uj_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchFamilyMembers = async () => {
    try {
      const res = await fetch('/api/auth/family-members');
      if (res.ok) {
        const data = await res.json();
        setFamilyMembers(data.members || []);
        if (data.members && data.members.length > 0 && !selectedFamilyMemberId) {
          // Pre-select first family member
          setSelectedFamilyMemberId(data.members[0].id);
          setLoginEmail(data.members[0].email);
        }
      }
    } catch (err) {
      console.warn("Could not load family members list:", err);
    }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem('uj_user', JSON.stringify(data.user));
        setNeedsReauth(false);
        const storedAdminView = localStorage.getItem('uj_admin_view_mode') || 'admin';
        setAdminViewMode(storedAdminView);
        if (data.user.role === 'admin') {
          setCurrentView(storedAdminView === 'user' ? 'catalog' : 'dashboard');
        } else {
          setCurrentView('catalog');
        }
      } else {
        localStorage.removeItem('uj_user');
        localStorage.removeItem('uj_token');
        fetchFamilyMembers();
        setCurrentView('login');
      }
    } catch (err) {
      const cachedUser = localStorage.getItem('uj_user');
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          setCurrentUser(user);
          const storedAdminView = localStorage.getItem('uj_admin_view_mode') || 'admin';
          setAdminViewMode(storedAdminView);
          if (user.role === 'admin') {
            setCurrentView(storedAdminView === 'user' ? 'catalog' : 'dashboard');
          } else {
            setCurrentView('catalog');
          }
          return;
        } catch (e) {}
      }
      fetchFamilyMembers();
      setCurrentView('login');
    }
  };

  const handleLogin = async (emailToUse = loginEmail, passToUse = loginPassword) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: emailToUse, password: passToUse })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('uj_user', JSON.stringify(data.user));
        if (data.token) {
          localStorage.setItem('uj_token', data.token);
        }
        setNeedsReauth(false);

        if (data.user.role === 'admin') {
          // Present Admin Choice Modal
          setShowAdminChoiceModal(true);
        } else {
          setCurrentView('catalog');
        }
      } else {
        alert(data.error || "Login failed. Please check your credentials.");
      }
    } catch (err) {
      alert("Network error during login");
    }
  };

  const handleChooseAdminMode = (mode) => {
    setAdminViewMode(mode);
    localStorage.setItem('uj_admin_view_mode', mode);
    setShowAdminChoiceModal(false);
    if (mode === 'user') {
      setCurrentView('catalog');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleToggleAdminView = () => {
    const nextMode = adminViewMode === 'admin' ? 'user' : 'admin';
    setAdminViewMode(nextMode);
    localStorage.setItem('uj_admin_view_mode', nextMode);
    if (nextMode === 'user') {
      setCurrentView('catalog');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleInPlaceReauth = async (e) => {
    if (e) e.preventDefault();
    setIsReauthenticating(true);
    try {
      const email = currentUser?.email || 'dan@unclejim.estate';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password: reauthPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('uj_user', JSON.stringify(data.user));
        if (data.token) {
          localStorage.setItem('uj_token', data.token);
        }
        setNeedsReauth(false);
        setReauthPassword('');
        // Immediately resume synchronization now that session is refreshed!
        setTimeout(() => triggerSyncOfflineItems(), 350);
      } else {
        alert(data.error || "Password incorrect. Please try again.");
      }
    } catch (err) {
      alert("Network error during sign-in. Check your connection.");
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('uj_user');
    localStorage.removeItem('uj_token');
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
      if (res.ok) {
        serverItems = await res.json();
        if (Array.isArray(serverItems) && serverItems.length > 0) {
          thumbnailCache.syncCatalog(serverItems);
        }
      }
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

  const fetchAdminUsers = async () => {
    setIsLoadingAdminUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setAdminUsersList(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin users:", err);
    } finally {
      setIsLoadingAdminUsers(false);
    }
  };

  const fetchAdminInterests = async () => {
    setIsLoadingAdminInterests(true);
    try {
      const res = await fetch('/api/admin/interests');
      if (res.ok) {
        const data = await res.json();
        setAdminInterests(data.interests || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin interests:", err);
    } finally {
      setIsLoadingAdminInterests(false);
    }
  };

  const handleChangePassword = async (e) => {
    if (e) e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    if (!currentPasswordInput) {
      setChangePasswordError("Please enter your current password.");
      return;
    }
    if (!newPasswordInput) {
      setChangePasswordError("Please enter a new password.");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError("New password and confirmation do not match.");
      return;
    }
    if (newPasswordInput.length < 4) {
      setChangePasswordError("New password must be at least 4 characters.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
          confirmPassword: confirmPasswordInput
        })
      });

      const data = await res.json();
      if (res.ok) {
        setChangePasswordSuccess(data.message || "Your password was changed successfully!");
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        // Auto close after 2 seconds
        setTimeout(() => {
          setShowChangePasswordModal(false);
          setChangePasswordSuccess(null);
        }, 2000);
      } else {
        setChangePasswordError(data.error || "Failed to change password.");
      }
    } catch (err) {
      console.error("Password change network error:", err);
      setChangePasswordError("Network error. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleResetUserPassword = async () => {
    if (!userToResetPassword) return;
    setIsResettingPassword(true);
    setResetPasswordError(null);
    setResetPasswordSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${userToResetPassword.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (res.ok) {
        setResetPasswordSuccess(data.message || `Password for ${userToResetPassword.name} has been reset to default.`);
        setTimeout(() => {
          setUserToResetPassword(null);
          setResetPasswordSuccess(null);
          fetchAdminUsers();
        }, 1800);
      } else {
        setResetPasswordError(data.error || "Failed to reset password.");
      }
    } catch (err) {
      console.error("Reset password network error:", err);
      setResetPasswordError("Network error. Please try again.");
    } finally {
      setIsResettingPassword(false);
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

  // Safe In-Memory Upload Derivative Generator:
  // Decodes an existing local Blob, resizes to max 2048px (2K HD), and exports as high-quality JPEG (~350–600 KB).
  // CRITICAL: NEVER modifies, overwrites, or deletes the original Blob in IndexedDB.
  const createUploadDerivative = (blobData, preferredName = 'photo.jpg', maxDim = 2048, quality = 0.82) => {
    return new Promise((resolve) => {
      if (!blobData || !(blobData instanceof Blob)) {
        resolve({ file: null, originalBytes: 0, originalMime: 'none', derivativeBytes: 0, derivativeMime: 'none', status: 'no_blob' });
        return;
      }

      const originalBytes = blobData.size;
      const originalMime = blobData.type || 'image/jpeg';
      let cleanName = (preferredName || 'photo').replace(/\.[^/.]+$/, "");

      const makeFallback = (statusMsg = 'fallback_original') => {
        const ext = originalMime.includes('png') ? '.png' : originalMime.includes('webp') ? '.webp' : '.jpg';
        const fileObj = (blobData instanceof File) ? blobData : new File([blobData], `${cleanName}${ext}`, { type: originalMime });
        return {
          file: fileObj,
          originalBytes,
          originalMime,
          derivativeBytes: fileObj.size,
          derivativeMime: originalMime,
          status: statusMsg
        };
      };

      try {
        const objectUrl = URL.createObjectURL(blobData);
        const img = new Image();

        img.onload = () => {
          try {
            URL.revokeObjectURL(objectUrl);
            let width = img.naturalWidth || img.width || 0;
            let height = img.naturalHeight || img.height || 0;

            if (!width || !height) {
              resolve(makeFallback('invalid_dimensions'));
              return;
            }

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((derivativeBlob) => {
              if (derivativeBlob && derivativeBlob.size > 0) {
                const derivativeFile = new File([derivativeBlob], `${cleanName}.jpg`, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve({
                  file: derivativeFile,
                  originalBytes,
                  originalMime,
                  derivativeBytes: derivativeFile.size,
                  derivativeMime: 'image/jpeg',
                  status: 'derivative_created'
                });
              } else {
                resolve(makeFallback('canvas_blob_failed'));
              }
            }, 'image/jpeg', quality);
          } catch (canvasErr) {
            console.warn("[UploadDerivative] Canvas processing error, using fallback:", canvasErr);
            resolve(makeFallback('canvas_error'));
          }
        };

        img.onerror = (err) => {
          URL.revokeObjectURL(objectUrl);
          console.warn("[UploadDerivative] Image load error, using fallback:", err);
          resolve(makeFallback('decode_error'));
        };

        img.src = objectUrl;
      } catch (err) {
        console.warn("[UploadDerivative] Top-level error in derivative creation, using fallback:", err);
        resolve(makeFallback('exception'));
      }
    });
  };

  const triggerSyncOfflineItems = async (options = {}) => {
    // options can be { targetItemId: 'xxx' }, { onlyFailed: true }, or empty for all pending
    const targetItemId = typeof options === 'string' ? options : options.targetItemId;
    const onlyFailed = options.onlyFailed || false;

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
      return;
    }

    // Step 1: Pre-verify authentication with the backend before attempting uploads
    try {
      const authRes = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (!authRes.ok) {
        setSyncProgress({
          isSyncing: false,
          waitingForConnection: false,
          total: 0,
          completed: 0,
          remaining: 0,
          failed: 0,
          message: "Your session has expired. Your offline items and photos are safe on this device. Please log in again to continue syncing."
        });
        setNeedsReauth(true);
        return;
      }
    } catch (netErr) {
      setSyncProgress({
        isSyncing: false,
        waitingForConnection: true,
        total: 0,
        completed: 0,
        remaining: 0,
        failed: 0,
        message: "⚠️ Cannot connect to server. Check your Wi-Fi connection and retry."
      });
      return;
    }

    // Step 2: Retrieve staged items from IndexedDB
    let staged = await offlineStorage.getStagedItems();
    if (!staged || staged.length === 0) {
      setSyncProgress({
        isSyncing: false,
        waitingForConnection: false,
        total: 0,
        completed: 0,
        remaining: 0,
        failed: 0,
        message: "No staged offline items found in storage."
      });
      return;
    }

    let itemsToUpload = [];
    if (targetItemId) {
      itemsToUpload = staged.filter(item => item.id === targetItemId);
      if (itemsToUpload.length === 0) {
        alert("Item not found in offline storage.");
        return;
      }
    } else if (onlyFailed) {
      itemsToUpload = staged.filter(item => item.syncStatus === 'failed');
      if (itemsToUpload.length === 0) {
        alert("No failed items to retry.");
        return;
      }
    } else {
      // Pending or retryable (exclude already confirmed synced unless targeted specifically)
      itemsToUpload = staged.filter(item => item.syncStatus !== 'synced');
      if (itemsToUpload.length === 0) {
        alert("All local offline items are already marked synced!");
        return;
      }
    }

    // Sort to ensure stable processing order (oldest first)
    itemsToUpload.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const total = itemsToUpload.length;
    let completed = 0;
    let failed = 0;
    const diagnosticsList = [];

    setSyncProgress({
      isSyncing: true,
      waitingForConnection: false,
      total,
      completed: 0,
      remaining: total,
      failed: 0,
      message: `Uploading offline items: 0 of ${total} uploaded — ${total} remaining`
    });

    // Step 3: Sequential 1-by-1 processing queue
    for (let idx = 0; idx < itemsToUpload.length; idx++) {
      const item = itemsToUpload[idx];
      const attemptNum = (item.uploadAttempts || 0) + 1;

      // If network drops mid-sync, pause gracefully without marking remaining items as failed
      if (!navigator.onLine) {
        const remaining = total - completed - failed;
        setSyncProgress({
          isSyncing: false,
          waitingForConnection: true,
          total,
          completed,
          remaining,
          failed,
          message: `📶 Wi-Fi connection lost (${completed} uploaded, ${remaining} remaining). Paused safely.`
        });
        break;
      }

      setSyncProgress(prev => ({
        ...prev,
        isSyncing: true,
        total,
        completed,
        remaining: total - completed - failed,
        failed,
        message: `Uploading item ${idx + 1} of ${total}: "${item.title || 'Untitled Item'}"... (${completed} uploaded, ${total - completed - failed} remaining)`
      }));

      // Diagnostic item tracker
      const diag = {
        itemId: item.id,
        title: item.title || '(Untitled)',
        photosCount: (item.photos || []).length,
        hasCroppedBlob: Boolean(item.croppedBlob),
        photoSizes: [],
        photoMimeTypes: [],
        endpoint: '/api/items/rapid-capture',
        httpStatus: null,
        serverError: null,
        stage: 'init',
        attemptNumber: attemptNum,
        timestamp: new Date().toLocaleTimeString()
      };

      console.log(`[OfflineSync] Starting Item ${idx + 1}/${total}:`, {
        localId: item.id,
        title: item.title,
        photoCount: (item.photos || []).length,
        hasCroppedBlob: Boolean(item.croppedBlob),
        attempt: attemptNum
      });

      try {
        diag.stage = 'packaging';
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

        let attachedPhotoCount = 0;
        let totalBytes = 0;

        // Step 10: Safely generate temporary in-memory upload derivatives
        // CRITICAL: Does NOT modify, replace, or overwrite the original master Blobs in IndexedDB
        if (item.photos && item.photos.length > 0) {
          for (let i = 0; i < item.photos.length; i++) {
            const p = item.photos[i];
            let blobData = p.data || p.file || p.blob;
            if (blobData) {
              if (blobData instanceof ArrayBuffer || ArrayBuffer.isView(blobData)) {
                blobData = new Blob([blobData], { type: p.type || 'image/jpeg' });
              }

              if (blobData instanceof Blob) {
                if (blobData.size === 0) {
                  throw new Error(`Photo #${i + 1} is 0 bytes (empty Blob)`);
                }

                diag.stage = 'generating_derivative';
                const origKb = Math.round(blobData.size / 1024);
                const origFormatted = blobData.size > 1024 * 1024 ? `${(blobData.size / (1024 * 1024)).toFixed(1)} MB` : `${origKb} KB`;
                diag.originalBlobSize = origFormatted;
                diag.originalMime = blobData.type || p.type || 'image/jpeg';

                const derivResult = await createUploadDerivative(blobData, p.name || `photo_${i}.jpg`, 2048, 0.82);
                const fileToUpload = derivResult.file;
                const derivKb = Math.round(fileToUpload.size / 1024);
                const derivFormatted = fileToUpload.size > 1024 * 1024 ? `${(fileToUpload.size / (1024 * 1024)).toFixed(1)} MB` : `${derivKb} KB`;

                diag.derivativeSize = derivFormatted;
                diag.derivativeMime = derivResult.derivativeMime;
                diag.compressionStatus = derivResult.status;
                diag.photoSizes.push(`orig: ${origFormatted} -> deriv: ${derivFormatted}`);
                diag.photoMimeTypes.push(derivResult.derivativeMime);

                totalBytes += fileToUpload.size;
                formData.append('photos', fileToUpload, fileToUpload.name);
                attachedPhotoCount++;
              }
            }
          }
        }

        // Safely generate derivative for croppedPhotoBlob if present
        if (item.croppedBlob) {
          let cropData = item.croppedBlob;
          if (cropData instanceof ArrayBuffer || ArrayBuffer.isView(cropData)) {
            cropData = new Blob([cropData], { type: 'image/webp' });
          }
          if (cropData instanceof Blob && cropData.size > 0) {
            diag.stage = 'generating_crop_derivative';
            const cropDerivResult = await createUploadDerivative(cropData, 'cropped.jpg', 1200, 0.85);
            const cropFile = cropDerivResult.file;
            const cropKb = Math.round(cropFile.size / 1024);
            const cropFormatted = cropFile.size > 1024 * 1024 ? `${(cropFile.size / (1024 * 1024)).toFixed(1)} MB` : `${cropKb} KB`;

            totalBytes += cropFile.size;
            diag.photoSizes.push(`crop: ${cropFormatted}`);
            diag.photoMimeTypes.push(cropDerivResult.derivativeMime);
            formData.append('croppedPhotos', cropFile, cropFile.name);
            attachedPhotoCount++;
          }
        }

        diag.attachedPhotoCount = attachedPhotoCount;
        diag.totalBytes = totalBytes;

        console.log(`[OfflineSync] Item Packaged with Derivatives:`, {
          localId: item.id,
          attachedPhotos: attachedPhotoCount,
          originalSize: diag.originalBlobSize,
          derivativeSize: diag.derivativeSize,
          totalBytesSent: totalBytes
        });

        diag.stage = 'transmitting';

        // 60s timeout for mobile upload
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const res = await fetch('/api/items/rapid-capture', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        diag.httpStatus = res.status;
        diag.stage = 'response_evaluation';

        const responseText = await res.text();
        let result = {};
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          result = { error: responseText.slice(0, 150) };
        }

        if (res.ok && result.success && result.item) {
          diag.stage = 'server_verification';
          const serverItemId = result.item.id;
          diag.serverItemId = serverItemId;

          // Step 11: Verify server record and photo association exist
          let verified = false;
          try {
            const verifyRes = await fetch(`/api/items/${serverItemId}`, {
              headers: getAuthHeaders(),
              credentials: 'include'
            });
            if (verifyRes.ok) {
              const verifiedItem = await verifyRes.json();
              if (verifiedItem && verifiedItem.id === serverItemId) {
                verified = true;
              }
            }
          } catch (vErr) {
            console.warn("Secondary server verification check failed, but upload returned 200:", vErr);
            verified = true; // rapid-capture already confirmed success in database
          }

          if (verified) {
            diag.stage = 'success';
            console.log(`[OfflineSync] Upload Confirmed for item:`, {
              localId: item.id,
              serverId: serverItemId,
              title: item.title
            });

            // Step 2 & 3: NEVER delete from IndexedDB! Mark synced & record server ID
            await offlineStorage.updateStagedItem({
              ...item,
              syncStatus: 'synced',
              syncError: null,
              serverId: serverItemId,
              uploadAttempts: attemptNum,
              lastAttemptTime: new Date().toISOString(),
              syncDiagnostics: {
                httpStatus: res.status,
                stage: 'confirmed',
                originalBlobSize: diag.originalBlobSize || 'Unknown',
                originalMime: diag.originalMime || 'image/jpeg',
                derivativeSize: diag.derivativeSize || 'None',
                derivativeMime: diag.derivativeMime || 'image/jpeg',
                compressionStatus: diag.compressionStatus || 'completed',
                photoSizes: diag.photoSizes,
                timestamp: diag.timestamp,
                serverId: serverItemId
              }
            });

            completed++;

            setItems(prevItems => prevItems.map(it => it.id === item.id ? {
              ...result.item,
              category_name: categories.find(c => c.id === result.item.category_id)?.name || it.category_name,
              is_offline: false,
              sync_status: 'synced'
            } : it));

            setSyncProgress(prev => ({
              ...prev,
              completed,
              remaining: total - completed - failed,
              message: `Uploading offline items: ${completed} of ${total} uploaded — ${total - completed - failed} remaining`
            }));
          } else {
            throw new Error("Server did not confirm item existence after upload");
          }
        } else {
          const errMessage = result.error || `Server HTTP ${res.status}: ${responseText.slice(0, 100)}`;
          diag.serverError = errMessage;
          throw new Error(errMessage);
        }
      } catch (itemErr) {
        const isAbort = itemErr.name === 'AbortError';
        const errMsg = isAbort ? 'Upload timed out (60s)' : (itemErr.message || 'Network upload failed');
        diag.serverError = errMsg;
        diagnosticsList.push(diag);

        console.error("[OfflineSync] Error syncing item:", item.id, item.title, {
          error: errMsg,
          stage: diag.stage,
          httpStatus: diag.httpStatus
        });
        failed++;

        // Update status to failed without touching original Blobs
        await offlineStorage.updateStagedItem({
          ...item,
          syncStatus: 'failed',
          syncError: errMsg,
          uploadAttempts: attemptNum,
          lastAttemptTime: new Date().toISOString(),
          syncDiagnostics: {
            httpStatus: diag.httpStatus,
            stage: diag.stage,
            originalBlobSize: diag.originalBlobSize || 'Unknown',
            derivativeSize: diag.derivativeSize || 'None',
            compressionStatus: diag.compressionStatus || 'failed',
            photoSizes: diag.photoSizes,
            timestamp: diag.timestamp,
            serverError: errMsg
          }
        });

        setSyncProgress(prev => ({
          ...prev,
          failed,
          remaining: total - completed - failed,
          message: `Uploading offline items: ${completed} of ${total} uploaded — ${total - completed - failed} remaining (${failed} failed)`
        }));
      }
    }

    setSyncDiagnostics(diagnosticsList);
    await loadStagedQueue();
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
        message: `🎉 All ${total} offline items processed! Safe local recovery copies are preserved.`
      });
      setTimeout(() => {
        setSyncProgress(prev => prev.isSyncing ? prev : { ...prev, message: null });
      }, 6000);
    } else {
      setSyncProgress({
        isSyncing: false,
        waitingForConnection: false,
        total,
        completed,
        remaining: total - completed - failed,
        failed,
        message: `⚠️ ${failed} item(s) encountered an error (${completed} confirmed). All items remain 100% safe in local storage.`
      });
    }
  };

  const handleToggleOfflineMode = async () => {
    const nextMode = !offlineMode;
    setOfflineMode(nextMode);
    localStorage.setItem('uj_offline_mode', nextMode ? 'true' : 'false');
    // Rule 7: Turning Offline Mode OFF checks connection and prompts diagnostics instead of auto-syncing
    if (!nextMode) {
      await loadStagedQueue();
      setShowDiagnosticsModal(true);
    }
  };

  const compressPhotoTo2048 = (file) => {
    return new Promise((resolve) => {
      const isImg = file && (
        (file.type && file.type.startsWith('image/')) ||
        /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')
      );
      if (!isImg) {
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
    setEditFormInstitutionalCandidate(item.institutional_candidate || item.institutionalCandidate || '');
    setEditFormInstitutionalName(item.institutional_name || item.institutionalName || '');
    setEditFormDestination(item.destination || 'undecided');
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
        setEditFormInstitutionalCandidate(fullItem.institutional_candidate || '');
        setEditFormInstitutionalName(fullItem.institutional_name || '');
        setEditFormDestination(fullItem.destination || 'undecided');
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
          destination: editFormDestination || 'undecided',
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
        destination: editFormDestination || 'undecided',
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

  const fetchItemDetailExtras = async (itemId) => {
    try {
      const res = await fetch(`/api/items/${itemId}`);
      if (res.ok) {
        const data = await res.json();
        setItemDetailStories(data.stories || []);
        setItemDetailQuestions(data.questions || []);
      }
    } catch (err) {
      console.warn("Could not load item stories/questions:", err);
    }
  };

  const handleOpenItemDetail = async (item) => {
    setSelectedItem(item);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx !== -1) setReviewIndex(idx);
    setActiveReviewPhotoIdx(0);
    setItemDetailStories([]);
    setItemDetailQuestions([]);
    setNewStoryText('');
    setNewQuestionText('');
    setCurrentView('review');
    await fetchItemDetailExtras(item.id);
  };

  const handleSubmitStory = async (itemId) => {
    if (!newStoryText.trim()) return;
    setIsSubmittingStory(true);
    try {
      const res = await fetch(`/api/items/${itemId}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyText: newStoryText.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setItemDetailStories(data.stories || []);
        setNewStoryText('');
        alert("✨ Thank you! Your story/memory has been saved.");
      } else {
        alert("Failed to submit story. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error submitting story.");
    } finally {
      setIsSubmittingStory(false);
    }
  };

  const handleSubmitQuestion = async (itemId) => {
    if (!newQuestionText.trim()) return;
    setIsSubmittingQuestion(true);
    try {
      const res = await fetch(`/api/items/${itemId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQuestionText.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setItemDetailQuestions(data.questions || []);
        setNewQuestionText('');
        alert("❓ Your question has been submitted to the Admin.");
      } else {
        alert("Failed to submit question. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error submitting question.");
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const fetchAdminQuestions = async (filter = adminQuestionsFilter) => {
    setIsLoadingAdminQA(true);
    try {
      const res = await fetch(`/api/admin/questions?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setAdminQuestions(data.questions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAdminQA(false);
    }
  };

  const handleAnswerQuestion = async (questionId) => {
    if (!adminAnswerText.trim()) return;
    setIsSubmittingAnswer(true);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/answer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: adminAnswerText.trim() })
      });
      if (res.ok) {
        setAdminAnsweringQuestionId(null);
        setAdminAnswerText('');
        await fetchAdminQuestions(adminQuestionsFilter);
      } else {
        alert("Failed to save answer.");
      }
    } catch (err) {
      console.error(err);
      alert("Error answering question.");
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const fetchAdminStories = async () => {
    setIsLoadingAdminQA(true);
    try {
      const res = await fetch('/api/admin/stories');
      if (res.ok) {
        const data = await res.json();
        setAdminStories(data.stories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAdminQA(false);
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

  // Determine if Admin operational controls should be active and visible
  const isAdminOperational = currentUser?.role === 'admin' && adminViewMode === 'admin';

  return (
    <div className="app-layout">
      {/* MOBILE NAVIGATION BACKDROP OVERLAY */}
      {currentUser && currentView !== 'login' && mobileNavOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* SIDEBAR NAVIGATION (Admin, Mobile Drawer, & All Views) */}
      {currentUser && currentView !== 'login' && currentView !== 'admin_review' && (
        <aside className={`sidebar ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
          <div
            className="sidebar-header"
            onClick={handleNavigateHome}
            role="button"
            tabIndex={0}
            title="Return to Main Dashboard"
            aria-label="Return to Main Dashboard"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNavigateHome(); }}
          >
            <Trees className="sidebar-logo" color="var(--gold-accent)" />
            <div className="sidebar-title">Uncle Jim's Estate</div>
            <button className="mobile-close-btn" onClick={(e) => { e.stopPropagation(); setMobileNavOpen(false); }} aria-label="Close menu">
              <X size={20} color="#fff" />
            </button>
          </div>

          <div className="sidebar-menu">
            {/* When Admin is in Admin View Mode */}
            {currentUser?.role === 'admin' && adminViewMode === 'admin' && (
              <>
                <button
                  className={`sidebar-item ${currentView === 'dashboard' ? 'active' : ''}`}
                  onClick={handleNavigateHome}
                >
                  <LayoutDashboard size={18} /> 🏠 Main Dashboard
                </button>

                <button className={`sidebar-item ${currentView === 'admin_review' ? 'active' : ''}`} onClick={() => { setAdminReviewItemId(null); setCurrentView('admin_review'); setMobileNavOpen(false); }}>
                  <CheckSquare size={18} /> Admin Review Mode
                </button>

                <button className={`sidebar-item ${currentView === 'catalog' ? 'active' : ''}`} onClick={() => { setCurrentView('catalog'); setMobileNavOpen(false); }}>
                  <Package size={18} /> Browse Inventory Catalog
                </button>

                <button className={`sidebar-item ${currentView === 'admin_interests' ? 'active' : ''}`} onClick={() => { setCurrentView('admin_interests'); fetchAdminInterests(); setMobileNavOpen(false); }}>
                  <Heart size={18} /> Interest Dashboard
                </button>

                <button className={`sidebar-item ${currentView === 'admin_questions' ? 'active' : ''}`} onClick={() => { setCurrentView('admin_questions'); fetchAdminQuestions('all'); setMobileNavOpen(false); }}>
                  <HelpCircle size={18} /> Family Questions
                </button>

                <button className={`sidebar-item ${currentView === 'admin_stories' ? 'active' : ''}`} onClick={() => { setCurrentView('admin_stories'); fetchAdminStories(); setMobileNavOpen(false); }}>
                  <MessageSquare size={18} /> Family Stories
                </button>

                <button className={`sidebar-item ${currentView === 'capture' ? 'active' : ''}`} onClick={handleOpenCapture}>
                  <PlusCircle size={18} /> Add Item (Camera)
                </button>

                <button className={`sidebar-item ${currentView === 'assignments' ? 'active' : ''}`} onClick={() => { setCurrentView('assignments'); setMobileNavOpen(false); }}>
                  <UserCheck size={18} /> Assignments
                </button>

                <button className={`sidebar-item ${currentView === 'distribution' ? 'active' : ''}`} onClick={() => { setCurrentView('distribution'); setMobileNavOpen(false); }}>
                  <Truck size={18} /> Distribution
                </button>

                <button className={`sidebar-item ${currentView === 'draft_mode' ? 'active' : ''}`} onClick={() => { setCurrentView('draft_mode'); fetchDraftData(); setMobileNavOpen(false); }}>
                  <Layers size={18} /> Family Draft
                </button>

                <button className={`sidebar-item ${currentView === 'email_preview' ? 'active' : ''}`} onClick={() => { setCurrentView('email_preview'); setMobileNavOpen(false); }}>
                  <Mail size={18} /> Email Catalog Report
                </button>

                <button className={`sidebar-item ${currentView === 'users' ? 'active' : ''}`} onClick={() => { setCurrentView('users'); fetchAdminUsers(); setMobileNavOpen(false); }}>
                  <Users size={18} /> Family Users
                </button>

                <button className={`sidebar-item ${currentView === 'logs' ? 'active' : ''}`} onClick={() => { setCurrentView('logs'); fetchAuditLogs(); setMobileNavOpen(false); }}>
                  <History size={18} /> Logs
                </button>

                {/* Mobile & Admin Operational Controls Section */}
                <div style={{ margin: '0.75rem 0.5rem 0.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, padding: '0 0.5rem 0.35rem' }}>
                    Operational & Offline
                  </div>

                  <button className="sidebar-item" onClick={() => { setShowDiagnosticsModal(true); setMobileNavOpen(false); }} title="Connection & Upload Status">
                    {offlineMode ? <WifiOff size={18} color="#f59e0b" /> : <UploadCloud size={18} color="#10b981" />}
                    <span>{offlineMode ? 'Offline Mode Active' : (stagedItems.length > 0 ? `Wi-Fi (${stagedItems.length} ready)` : 'Connection / Upload Status')}</span>
                  </button>

                  <button className="sidebar-item" onClick={() => { setShowDiagnosticsModal(true); setMobileNavOpen(false); }} title="Inspect staged items and diagnostics">
                    <Activity size={18} />
                    <span>Diagnostics ({stagedItems.length})</span>
                  </button>

                  <button className="sidebar-item" onClick={() => { setShowDiagnosticsModal(true); setMobileNavOpen(false); }} title="Review & Upload staged items">
                    <CheckSquare size={18} color={stagedItems.length > 0 ? '#10b981' : 'inherit'} />
                    <span>Review & Upload Items {stagedItems.length > 0 ? `(${stagedItems.length})` : ''}</span>
                  </button>
                </div>
              </>
            )}

            {/* When Regular User OR Admin in User View Mode */}
            {(currentUser?.role !== 'admin' || adminViewMode === 'user') && (
              <>
                <button
                  className={`sidebar-item ${currentView === 'catalog' && catalogInterestFilter !== 'my_interests' ? 'active' : ''}`}
                  onClick={() => {
                    setCatalogInterestFilter('all');
                    setCurrentView('catalog');
                    setMobileNavOpen(false);
                  }}
                >
                  <Package size={18} /> Browse Released Items
                </button>

                <button
                  className={`sidebar-item ${currentView === 'my_interests' || (currentView === 'catalog' && catalogInterestFilter === 'my_interests') ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentView('my_interests');
                    fetchMyInterests();
                    setMobileNavOpen(false);
                  }}
                >
                  <Star size={18} color="#f59e0b" fill="#f59e0b" /> My Interested Items
                </button>

                {currentUser?.role === 'contributor' && (
                  <button className={`sidebar-item ${currentView === 'capture' ? 'active' : ''}`} onClick={handleOpenCapture}>
                    <PlusCircle size={18} /> Add Item (Camera)
                  </button>
                )}

                {currentUser?.role === 'institution' && (
                  <button className={`sidebar-item ${currentView === 'institution' ? 'active' : ''}`} onClick={() => { setCurrentView('institution'); setMobileNavOpen(false); }}>
                    <Building2 size={18} /> Institution Portal
                  </button>
                )}
              </>
            )}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button className="sidebar-item" onClick={() => { setMobileNavOpen(false); handleLogout(); }}>
              <X size={18} /> Sign Out ({currentUser?.name || ''})
            </button>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.75rem', textAlign: 'center', letterSpacing: '0.5px' }}>
              Uncle Jim's Estate
            </div>
          </div>
        </aside>
      )}

      <div className="main-wrapper">
        {/* TOP HEADER */}
        {currentUser && currentView !== 'login' && (
          <div>
            <header className="top-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {currentView !== 'admin_review' && (
                  <button className="mobile-toggle-btn" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation menu">
                    <Menu size={22} color="var(--pine-deep)" />
                  </button>
                )}

                <div
                  className="header-brand"
                  onClick={handleNavigateHome}
                  role="button"
                  tabIndex={0}
                  title="Return to Main Dashboard"
                  aria-label="Return to Main Dashboard"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNavigateHome(); }}
                >
                  <Trees className="header-logo-icon" color="var(--pine-primary)" />
                  <div className="header-title-box">
                    <span className="header-title">Uncle Jim's Estate</span>
                  </div>
                </div>
              </div>

                {/* HEADER ACTIONS & USER PROFILE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* ADMIN OPERATIONAL CONTROLS: Only visible in Admin role & Admin View mode */}
                  {isAdminOperational && (
                    <>
                      {/* PERSISTENT THUMBNAIL CACHE STATUS INDICATOR */}
                      {cacheStats.total > 0 && (
                        <div>
                          {!cacheStats.isComplete ? (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 'bold',
                                color: '#0277bd',
                                background: '#e1f5fe',
                                border: '1px solid #b3e5fc',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title={`${cacheStats.cached} of ${cacheStats.total} photos stored persistently on laptop`}
                            >
                              <RefreshCw size={12} style={{ animation: 'spin 1.5s linear infinite' }} />
                              <span>Updating photos: {cacheStats.remaining || cacheStats.updating} remaining</span>
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: '#2e7d32',
                                background: '#f1f8e9',
                                border: '1px solid #dcedc8',
                                padding: '0.3rem 0.65rem',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                opacity: 0.85
                              }}
                              title="All thumbnails persistently cached in laptop IndexedDB"
                            >
                              <Check size={13} color="#2e7d32" />
                              <span>Photos cached: {cacheStats.cached} / {cacheStats.total}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* OFFLINE MODE TOGGLE BUTTON */}
                      <button
                        className={`btn-outline ${offlineMode ? 'btn-amber-active' : ''}`}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={handleToggleOfflineMode}
                      >
                        {offlineMode ? <WifiOff size={16} color="#d32f2f" /> : <Wifi size={16} color="#2e7d32" />}
                        <span>{offlineMode ? 'Offline Mode: ON' : 'Offline Mode: OFF'}</span>
                      </button>
                    </>
                  )}

                  {/* ADMIN VIEW MODE SWITCHER: Visible to Admin so they can toggle back and forth */}
                  {currentUser?.role === 'admin' && (
                    <button
                      className="btn-outline"
                      style={{
                        fontSize: '0.82rem',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontWeight: 'bold',
                        color: adminViewMode === 'admin' ? 'var(--pine-primary)' : '#1565c0',
                        borderColor: adminViewMode === 'admin' ? 'var(--pine-primary)' : '#90caf9',
                        background: adminViewMode === 'admin' ? '#e8f5e9' : '#e3f2fd'
                      }}
                      onClick={handleToggleAdminView}
                      title={adminViewMode === 'admin' ? 'Switch to regular user experience' : 'Switch back to Admin view'}
                    >
                      {adminViewMode === 'admin' ? '👤 Switch to User View' : '👑 Switch to Admin View'}
                    </button>
                  )}

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
                        className="user-dropdown-action-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setChangePasswordError(null);
                          setChangePasswordSuccess(null);
                          setCurrentPasswordInput('');
                          setNewPasswordInput('');
                          setConfirmPasswordInput('');
                          setShowChangePasswordModal(true);
                        }}
                      >
                        <Key size={16} color="var(--pine-primary)" />
                        <span>Change Password</span>
                      </button>

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

            {/* ADMIN OPERATIONAL STATUS BANNERS (Only rendered in Admin view, hidden on mobile via CSS) */}
            {isAdminOperational && (
              <div className="admin-operational-banners">
                {/* STATUS BANNER 1: OFFLINE MODE IS ACTIVE */}
                {offlineMode && (
                  <div style={{ background: '#fff3cd', color: '#664d03', borderBottom: '1px solid #ffecb5', padding: '0.6rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', fontWeight: 'bold', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <WifiOff size={18} color="#b45309" />
                      <span>⚡ OFFLINE MODE IS ON — Photos save directly to your iPhone storage without network calls.</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button className="btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem', background: '#fff' }} onClick={() => setShowDiagnosticsModal(true)}>
                        🔍 Diagnostics ({stagedItems.length})
                      </button>
                      <button className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#fff' }} onClick={handleToggleOfflineMode}>
                        Turn OFF Offline Mode
                      </button>
                    </div>
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
                      <button className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', background: '#fff' }} onClick={() => setShowDiagnosticsModal(true)}>
                        🔍 Diagnostics ({stagedItems.length})
                      </button>
                      {(syncProgress.failed > 0 || syncProgress.waitingForConnection) && !syncProgress.isSyncing && (
                        <button className="btn-green-senior" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }} onClick={() => setShowDiagnosticsModal(true)}>
                          Inspect & Upload
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
                      <span>📶 Wi-Fi CONNECTED — {stagedItems.length} Offline Item(s) Ready to Review & Upload.</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-outline" style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', background: '#fff', color: '#0f5132', borderColor: '#0f5132' }} onClick={() => setShowDiagnosticsModal(true)}>
                        🔍 Diagnostics ({stagedItems.length})
                      </button>
                      <button className="btn-green-senior" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }} onClick={() => setShowDiagnosticsModal(true)}>
                        Review & Upload Items ({stagedItems.length})
                      </button>
                    </div>
                  </div>
                )}
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
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.45rem', color: 'var(--pine-deep)', marginBottom: '0.25rem' }}>Welcome Family</h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Select your name and sign in to view the estate inventory.</p>

                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                  <div style={{ marginBottom: '1.1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.35rem' }}>
                      Select Your Name
                    </label>
                    <select
                      value={selectedFamilyMemberId}
                      onChange={(e) => {
                        const mId = e.target.value;
                        setSelectedFamilyMemberId(mId);
                        const found = familyMembers.find(m => m.id === mId);
                        if (found) {
                          setLoginEmail(found.email);
                        }
                      }}
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        fontSize: '16px',
                        background: '#fff',
                        boxSizing: 'border-box'
                      }}
                      required
                    >
                      {familyMembers.length === 0 ? (
                        <option value="">Loading family members...</option>
                      ) : (
                        familyMembers.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.role === 'admin' ? '(Admin)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div style={{ marginBottom: '1.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                        Password
                      </label>
                      <span style={{ fontSize: '0.75rem', color: 'var(--pine-primary)', fontWeight: '600' }}>
                        Default: Lombardi
                      </span>
                    </div>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password (default: Lombardi)"
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

          {/* ADMIN POST-LOGIN VIEW CHOICE MODAL */}
          {showAdminChoiceModal && (
            <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
              <div className="card" style={{ maxWidth: '480px', width: '90%', padding: '2rem', textAlign: 'center', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <Trees size={32} color="var(--pine-primary)" />
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--pine-deep)', marginBottom: '0.5rem' }}>
                  Welcome Admin
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.75rem', lineHeight: '1.4' }}>
                  You are signed in as an Estate Admin. How would you like to enter the application? You can toggle between views anytime.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <button
                    className="btn-green"
                    style={{ padding: '0.9rem 1.25rem', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => handleChooseAdminMode('admin')}
                  >
                    👑 Enter Admin View
                  </button>
                  <button
                    className="btn-outline"
                    style={{ padding: '0.9rem 1.25rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--pine-deep)', borderColor: 'var(--pine-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => handleChooseAdminMode('user')}
                  >
                    👤 Enter User View (Cousin Experience)
                  </button>
                </div>
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

                  <div className="attention-item" style={{ cursor: 'pointer' }} onClick={() => { setAdminReviewItemId(null); setCurrentView('admin_review'); }}>
                    <div className="attention-bullet bullet-orange"></div>
                    <div style={{ flex: 1, fontWeight: '500' }}>
                      {items.filter(i => i.status === 'draft').length || dashboardStats.draftItems || 0} item(s) need inventory review ➔
                    </div>
                  </div>

                  <div className="attention-item" style={{ cursor: 'pointer' }} onClick={() => { setStatusFilter('released'); setCurrentView('catalog'); }}>
                    <div className="attention-bullet bullet-green"></div>
                    <div style={{ flex: 1, fontWeight: '500' }}>
                      {items.filter(i => i.status === 'released').length || dashboardStats.releasedItems || 0} item(s) currently released for family review ➔
                    </div>
                  </div>

                  <div className="attention-item" style={{ cursor: 'pointer' }} onClick={() => { setCurrentView('admin_interests'); fetchAdminInterests(); }}>
                    <div className="attention-bullet" style={{ background: '#ec4899' }}></div>
                    <div style={{ flex: 1, fontWeight: '500' }}>
                      ❤️ Interest Dashboard — View which family members want which items ➔
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button className="btn-outline" style={{ fontSize: '0.85rem' }} onClick={() => { setCurrentView('admin_interests'); fetchAdminInterests(); }}>
                    ❤️ Open Interest Dashboard
                  </button>
                  <button className="btn-outline" style={{ fontSize: '0.85rem' }} onClick={() => { setCurrentView('logs'); fetchAuditLogs(); }}>
                    📜 Open Full Audit & Activity Logs
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
            const isRegularUserExperience = currentUser?.role !== 'admin' || adminViewMode === 'user';
            const displayedItems = items.filter(item => {
              // Permission guard: Regular Users and Dan in User View only see released / assigned / distributed / completed items
              if (isRegularUserExperience && !['released', 'assigned', 'distributed', 'completed'].includes(item.status)) {
                return false;
              }

              // Filter by My Interested Items tab
              if (catalogInterestFilter === 'my_interests' && !Boolean(item.user_interested)) return false;

              // Filter by Category dropdown
              if (categoryFilter && item.category_id !== categoryFilter) return false;

              // Filter by Status (e.g. from KPI buttons)
              if (statusFilter) {
                if (statusFilter === 'assigned') {
                  if (!['assigned', 'completed', 'distributed'].includes(item.status)) return false;
                } else if (item.status !== statusFilter) {
                  return false;
                }
              }

              // Search query: Case-insensitive, partial-match friendly across all key descriptive fields
              if (searchQuery && searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const title = (item.title || '').toLowerCase();
                const desc = (item.description || '').toLowerCase();
                const notes = (item.notes || '').toLowerCase();
                const catName = (item.category_name || '').toLowerCase();
                const itemNum = (item.item_number || '').toLowerCase();
                const dest = (item.destination || item.destination_name || '').toLowerCase();
                const instName = (item.institutional_name || item.institutional_candidate || '').toLowerCase();
                const loc = (item.location_in_house || '').toLowerCase();
                const cond = (item.condition || '').toLowerCase();

                const matches = (
                  title.includes(q) ||
                  desc.includes(q) ||
                  notes.includes(q) ||
                  catName.includes(q) ||
                  itemNum.includes(q) ||
                  dest.includes(q) ||
                  instName.includes(q) ||
                  loc.includes(q) ||
                  cond.includes(q)
                );

                if (!matches) return false;
              }

              return true;
            });
            const myInterestsCount = items.filter(i => {
              if (isRegularUserExperience && !['released', 'assigned', 'distributed', 'completed'].includes(i.status)) return false;
              return Boolean(i.user_interested);
            }).length;

            return (
              <div>
                {/* Search and Filter Row */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 240px', minWidth: '220px', display: 'flex', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.45rem 0.85rem', alignItems: 'center' }}>
                    <Search size={18} color="var(--text-muted)" style={{ marginRight: '0.5rem', flexShrink: 0 }} />
                    <input
                      type="text"
                      style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', background: 'transparent' }}
                      placeholder="Search books, artwork, maritime, photographs, packers..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                        onClick={() => setSearchQuery('')}
                        title="Clear Search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Dropdown */}
                  <div style={{ minWidth: '160px' }}>
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.52rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: '#fff',
                        fontSize: '0.9rem',
                        color: 'var(--text-dark)',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">All Categories</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {(searchQuery || categoryFilter || statusFilter || catalogInterestFilter !== 'all') && (
                    <button
                      className="btn-outline"
                      style={{ fontSize: '0.82rem', color: '#d32f2f', borderColor: '#ffcdd2', padding: '0.45rem 0.85rem' }}
                      onClick={() => { setSearchQuery(''); setCategoryFilter(''); setStatusFilter(''); setCatalogInterestFilter('all'); }}
                    >
                      <X size={14} style={{ marginRight: '4px' }} /> Clear Filters
                    </button>
                  )}
                </div>

                {/* Quick Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '2px', alignItems: 'center' }}>
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

                  {currentUser?.role === 'admin' && (
                    <button
                      className="btn-outline"
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.4rem 0.95rem',
                        borderRadius: '20px',
                        whiteSpace: 'nowrap',
                        marginLeft: 'auto',
                        fontWeight: 'bold',
                        color: 'var(--pine-primary)',
                        borderColor: 'var(--pine-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                      onClick={() => {
                        setAdminReviewItemId(null);
                        setCurrentView('admin_review');
                      }}
                      title="Open rapid laptop review & cleanup mode"
                    >
                      <CheckSquare size={15} /> Admin Review Mode
                    </button>
                  )}
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
                          if (currentUser?.role === 'admin' && adminViewMode === 'admin') {
                            handleStartEditItem(item);
                          } else {
                            handleOpenItemDetail(item);
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
                          <CachedThumbnail
                            url={item.primary_thumb || item.primary_photo}
                            version={item.primary_thumb_version}
                            alt={item.title || "Estate Item"}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain'
                            }}
                          />
                          {currentUser?.role === 'admin' && adminViewMode === 'admin' && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', zIndex: 10 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAdminReviewItemId(item.id);
                                  setCurrentView('admin_review');
                                }}
                                style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--pine-primary)', border: '1px solid #ccc', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                title="Clean in Admin Review Mode"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteItem(item.id, e)}
                                style={{ background: 'rgba(211,47,47,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                title="Delete Item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--pine-deep)', lineHeight: '1.3' }}>{item.title || 'Untitled Item'}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.category_name || "Uncategorized"}</span>
                          {item.value && (
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pine-primary)' }}>
                              {item.value.startsWith('$') ? item.value : `$${item.value}`}
                            </span>
                          )}
                        </div>

                        {/* Short Description Preview for Easy Recognition */}
                        {item.description && (
                          <p style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                            margin: '4px 0 6px 0',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: '1.35'
                          }}>
                            {item.description}
                          </p>
                        )}

                        {/* Offline Pending / Admin Release Status Badge (Admin mode only) */}
                        {currentUser?.role === 'admin' && adminViewMode === 'admin' && (
                          item.is_offline ? (
                            <div style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                              <span className="badge-status" style={{ fontSize: '0.72rem', padding: '2px 8px', background: item.sync_status === 'failed' ? '#fee2e2' : '#fef3c7', color: item.sync_status === 'failed' ? '#b91c1c' : '#b45309', border: item.sync_status === 'failed' ? '1px solid #fca5a5' : '1px solid #fde68a', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {item.sync_status === 'failed' ? '⚠️ Upload Failed (Pending)' : '⏳ Upload Pending'}
                              </span>
                            </div>
                          ) : (
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
                        {item.institutional_candidate && ['Maritime Museum', 'Library', 'TBD'].includes(item.institutional_candidate) && (
                          <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 'bold', color: '#1565c0', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px', marginTop: '4px' }}>
                            🏛️ {item.institutional_candidate === 'TBD' ? 'Institutional: TBD' : item.institutional_candidate}
                          </div>
                        )}

                        {/* Assignment Badge if already assigned */}
                        {item.status === 'assigned' && (
                          <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 'bold', color: '#7b1fa2', background: '#f3e5f5', padding: '2px 8px', borderRadius: '4px', marginTop: '4px' }}>
                            🔒 Assigned to {item.assigned_to_name || 'Family'}
                          </div>
                        )}

                        {/* Interested Cousins Count */}
                        {item.interested_count > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--pine-primary)', fontWeight: '600', marginTop: '4px' }}>
                            ⭐ {item.interested_count} family member(s) interested
                          </div>
                        )}

                        <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                          {/* 1-Tap Prominent I'm Interested Button */}
                          <button
                            className={Boolean(item.user_interested) ? 'btn-green' : 'btn-outline'}
                            style={{
                              fontSize: '0.88rem',
                              padding: '0.55rem 0.85rem',
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.45rem',
                              fontWeight: 'bold',
                              borderRadius: '8px',
                              background: Boolean(item.user_interested) ? '#2e7d32' : '#ffffff',
                              color: Boolean(item.user_interested) ? '#ffffff' : 'var(--pine-primary)',
                              borderColor: Boolean(item.user_interested) ? '#2e7d32' : 'var(--pine-primary)',
                              boxShadow: Boolean(item.user_interested) ? '0 2px 4px rgba(46,125,50,0.25)' : 'none'
                            }}
                            onClick={(e) => handleToggleInterest(item, e)}
                            title={Boolean(item.user_interested) ? "Click to unmark interest" : "Click to mark as interested"}
                          >
                            <Star size={16} fill={Boolean(item.user_interested) ? '#f59e0b' : 'none'} color={Boolean(item.user_interested) ? '#f59e0b' : 'currentColor'} />
                            {Boolean(item.user_interested) ? "★ I'm Interested" : "☆ I'm Interested"}
                          </button>

                          {currentUser?.role === 'admin' && adminViewMode === 'admin' && (
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

          {/* ITEM DETAIL / DRILL DOWN VIEW (with Photo Gallery, I'm Interested, Stories, and Questions) */}
          {currentView === 'review' && (() => {
            const currentReviewItem = selectedItem || items[reviewIndex % Math.max(1, items.length)];
            const reviewPhotos = currentReviewItem?.photos && currentReviewItem.photos.length > 0
              ? currentReviewItem.photos
              : (currentReviewItem?.primary_photo ? [{ photo_url: currentReviewItem.primary_photo, thumbnail_url: currentReviewItem.primary_thumb || currentReviewItem.primary_photo }] : []);
            const activeDisplayPhoto = reviewPhotos[activeReviewPhotoIdx]?.photo_url || currentReviewItem?.primary_photo || OFFLINE_THUMB;

            return (
              <div className="review-view-container" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
                {/* Navigation Bar */}
                <div className="review-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-outline"
                    style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem' }}
                    onClick={() => setCurrentView('catalog')}
                  >
                    <ArrowLeft size={18} /> Back to Browse
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {currentUser?.role === 'admin' && adminViewMode === 'admin' && currentReviewItem && (
                      <>
                        {currentReviewItem.status === 'released' ? (
                          <>
                            <span className="badge-status badge-released" style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}>
                              Released for Review
                            </span>
                            <button
                              className="btn-outline"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: '#c62828', borderColor: '#ef9a9a', fontWeight: 'bold' }}
                              onClick={() => handleUnreleaseItem(currentReviewItem.id)}
                            >
                              ↩️ Unrelease
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="badge-status" style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem', background: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2', fontWeight: 'bold' }}>
                              Not Released
                            </span>
                            <button
                              className="btn-green"
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                              onClick={() => handleReleaseItem(currentReviewItem.id)}
                            >
                              🚀 Release
                            </button>
                          </>
                        )}
                        <button
                          className="btn-outline"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: 'var(--pine-primary)', borderColor: 'var(--pine-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 'bold' }}
                          onClick={() => handleStartEditItem(currentReviewItem)}
                        >
                          <Edit3 size={15} /> Edit Item
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Main Item Detail Card */}
                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', background: '#fff', boxShadow: 'var(--shadow-md)' }}>
                  {/* Photo Display */}
                  <div style={{ position: 'relative', width: '100%', maxHeight: '480px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f6f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <img
                      src={activeDisplayPhoto}
                      alt={currentReviewItem?.title || "Item Photo"}
                      style={{ maxWidth: '100%', maxHeight: '460px', objectFit: 'contain', display: 'block' }}
                    />
                  </div>

                  {/* Thumbnails row if multiple photos */}
                  {reviewPhotos.length > 1 && (
                    <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
                      {reviewPhotos.map((p, idx) => (
                        <img
                          key={p.id || idx}
                          src={p.thumbnail_url || p.photo_url}
                          style={{
                            width: '72px',
                            height: '72px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: activeReviewPhotoIdx === idx ? '3px solid var(--pine-primary)' : '1px solid var(--border-color)',
                            opacity: activeReviewPhotoIdx === idx ? 1 : 0.75,
                            flexShrink: 0
                          }}
                          onClick={() => setActiveReviewPhotoIdx(idx)}
                          alt={`Thumbnail ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Header Title & Category */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--pine-deep)', margin: '0 0 0.35rem 0' }}>
                        {currentReviewItem?.title || "Untitled Item"}
                      </h1>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="tag-pill" style={{ background: '#e8f0ec', color: 'var(--pine-primary)', fontWeight: 'bold' }}>
                          {currentReviewItem?.category_name || "Uncategorized"}
                        </span>
                        {currentReviewItem?.item_number && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            ID: {currentReviewItem.item_number}
                          </span>
                        )}
                        {currentReviewItem?.value && (
                          <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--pine-primary)' }}>
                            Estimated Value: {currentReviewItem.value.startsWith('$') ? currentReviewItem.value : `$${currentReviewItem.value}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prominent 1-Tap Interest Button */}
                    <div style={{ minWidth: '180px' }}>
                      <button
                        className={Boolean(currentReviewItem?.user_interested) ? 'btn-green' : 'btn-outline'}
                        style={{
                          width: '100%',
                          minHeight: '48px',
                          padding: '0.65rem 1.25rem',
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          background: Boolean(currentReviewItem?.user_interested) ? '#2e7d32' : '#ffffff',
                          color: Boolean(currentReviewItem?.user_interested) ? '#ffffff' : 'var(--pine-primary)',
                          borderColor: Boolean(currentReviewItem?.user_interested) ? '#2e7d32' : 'var(--pine-primary)',
                          boxShadow: Boolean(currentReviewItem?.user_interested) ? '0 2px 6px rgba(46,125,50,0.3)' : 'none'
                        }}
                        onClick={async () => {
                          await handleToggleInterest(currentReviewItem);
                          // refresh current selected item
                          if (currentReviewItem) {
                            const updated = items.find(i => i.id === currentReviewItem.id);
                            if (updated) setSelectedItem(updated);
                          }
                        }}
                      >
                        <Star size={18} fill={Boolean(currentReviewItem?.user_interested) ? '#f59e0b' : 'none'} color={Boolean(currentReviewItem?.user_interested) ? '#f59e0b' : 'currentColor'} />
                        {Boolean(currentReviewItem?.user_interested) ? "★ I'm Interested" : "☆ I'm Interested"}
                      </button>
                      {currentReviewItem?.interested_count > 0 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--pine-primary)', textAlign: 'center', marginTop: '4px', fontWeight: '600' }}>
                          ⭐ {currentReviewItem.interested_count} family member(s) interested
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attributes Table */}
                  <table className="details-table" style={{ width: '100%', margin: '1rem 0 1.25rem 0' }}>
                    <tbody>
                      {currentReviewItem?.location_in_house && (
                        <tr><td className="label">Location in House</td><td className="val">{currentReviewItem.location_in_house}</td></tr>
                      )}
                      {currentReviewItem?.condition && (
                        <tr><td className="label">Condition</td><td className="val">{currentReviewItem.condition}</td></tr>
                      )}
                      {currentReviewItem?.dimensions && (
                        <tr><td className="label">Dimensions</td><td className="val">{currentReviewItem.dimensions}</td></tr>
                      )}
                      {currentReviewItem?.weight && (
                        <tr><td className="label">Weight</td><td className="val">{currentReviewItem.weight}</td></tr>
                      )}
                    </tbody>
                  </table>

                  {/* Description */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--pine-deep)', marginBottom: '0.4rem' }}>
                      Description
                    </h3>
                    <p style={{ fontSize: '0.95rem', color: '#2c3e35', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                      {currentReviewItem?.description || "No description provided."}
                    </p>
                  </div>

                  {/* Existing Notes / Special Handling if present */}
                  {currentReviewItem?.special_handling_notes && (
                    <div style={{ marginBottom: '1.25rem', background: '#fcf8e3', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #faebcc' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#8a6d3b', margin: '0 0 4px 0' }}>
                        📌 Notes / Special Handling
                      </h4>
                      <p style={{ fontSize: '0.88rem', color: '#66512c', margin: 0 }}>
                        {currentReviewItem.special_handling_notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* SECTION 2: SHARE A STORY / MEMORY */}
                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <MessageSquare size={22} color="var(--pine-primary)" />
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: 'var(--pine-deep)', margin: 0 }}>
                      Stories & Memories
                    </h2>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Do you have a personal memory, story, or history about this item? Share it here with the family!
                  </p>

                  {/* List of existing stories */}
                  {itemDetailStories && itemDetailStories.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                      {itemDetailStories.map(story => (
                        <div key={story.id} style={{ background: '#f8faf9', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem 1.1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--pine-deep)' }}>
                              {story.user_name || story.provenance_source || "Family Memory"}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {story.created_at ? new Date(story.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.92rem', color: '#2c3e35', margin: 0, lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                            "{story.story_text}"
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                      No stories shared for this item yet. Be the first to share one!
                    </div>
                  )}

                  {/* Submit a story form */}
                  <form onSubmit={(e) => { e.preventDefault(); handleSubmitStory(currentReviewItem.id); }}>
                    <textarea
                      value={newStoryText}
                      onChange={(e) => setNewStoryText(e.target.value)}
                      placeholder="Type a memory, story, or where you remember this being in Uncle Jim's home..."
                      rows={3}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem', boxSizing: 'border-box', marginBottom: '0.75rem', outline: 'none' }}
                      required
                    />
                    <button
                      type="submit"
                      className="btn-green"
                      disabled={isSubmittingStory || !newStoryText.trim()}
                      style={{ padding: '0.55rem 1.25rem', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      {isSubmittingStory ? 'Saving...' : '💬 Share Story'}
                    </button>
                  </form>
                </div>

                {/* SECTION 3: ASK A QUESTION */}
                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <HelpCircle size={22} color="#1565c0" />
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: 'var(--pine-deep)', margin: 0 }}>
                      Ask a Question
                    </h2>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Have a question about this item's condition, history, or dimensions? Ask below and an Admin will respond.
                  </p>

                  {/* List of existing questions and answers */}
                  {itemDetailQuestions && itemDetailQuestions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                      {itemDetailQuestions.map(q => (
                        <div key={q.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1.1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>
                              ❓ {q.user_name || 'Family Member'} asks:
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.92rem', color: '#334155', margin: '0 0 0.5rem 0', lineHeight: '1.4' }}>
                            {q.question}
                          </p>
                          {q.is_answered ? (
                            <div style={{ background: '#e8f5e9', borderLeft: '3px solid #2e7d32', padding: '0.5rem 0.85rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#2e7d32', marginBottom: '2px' }}>
                                💡 Admin Response {q.answered_by_name ? `(${q.answered_by_name})` : ''}:
                              </div>
                              <div style={{ fontSize: '0.88rem', color: '#1b5e20' }}>
                                {q.answer}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.78rem', color: '#d97706', fontStyle: 'italic', marginTop: '4px' }}>
                              ⏳ Awaiting response from Admin...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                      No questions asked yet for this item.
                    </div>
                  )}

                  {/* Submit a question form */}
                  <form onSubmit={(e) => { e.preventDefault(); handleSubmitQuestion(currentReviewItem.id); }}>
                    <textarea
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      placeholder="Ask a question about this item..."
                      rows={2}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.92rem', boxSizing: 'border-box', marginBottom: '0.75rem', outline: 'none' }}
                      required
                    />
                    <button
                      type="submit"
                      className="btn-green"
                      disabled={isSubmittingQuestion || !newQuestionText.trim()}
                      style={{ padding: '0.55rem 1.25rem', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      {isSubmittingQuestion ? 'Submitting...' : '❓ Submit Question'}
                    </button>
                  </form>
                </div>
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
                                <CachedThumbnail
                                  url={item.primary_thumb || item.primary_photo}
                                  version={item.primary_thumb_version}
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
                              {item.institutional_candidate && ['Maritime Museum', 'Library', 'TBD'].includes(item.institutional_candidate) && (
                                <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 'bold', color: '#1565c0', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px', marginBottom: '4px' }}>
                                  🏛️ {item.institutional_candidate === 'TBD' ? 'Institutional: TBD' : item.institutional_candidate}
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

          {/* ADMIN REVIEW & CLEANUP MODE VIEW */}
          {currentView === 'admin_review' && (
            <AdminReviewMode
              items={items}
              categories={categories}
              initialItemId={adminReviewItemId}
              onSaveItem={async (id, updatedFields) => {
                const res = await fetch(`/api/items/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updatedFields)
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || "Failed to save review fields");
                }
                await fetchItems();
              }}
              onReleaseItem={handleReleaseItem}
              onUnreleaseItem={handleUnreleaseItem}
              onCropPhoto={(item, photo) => {
                setAdminEditingItem(item);
                const fullUrl = photo.photo_url || photo.url || photo.thumbnail_url;
                setCropModalSrc(fullUrl);
                setCropModalTarget({ type: 'edit_photo', photo });
              }}
              onRestorePhoto={async (item, photoId) => {
                setAdminEditingItem(item);
                await handleRestoreOriginalCrop(photoId);
              }}
              onSetPrimaryPhoto={async (item, photoId) => {
                setAdminEditingItem(item);
                await handleSetPrimaryPhoto(photoId);
              }}
              onDeletePhoto={async (item, photoId) => {
                setAdminEditingItem(item);
                await handleDeleteEditPhoto(photoId);
              }}
              onClose={() => setCurrentView('catalog')}
            />
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

          {/* MY INTERESTED ITEMS VIEW */}
          {currentView === 'my_interests' && (() => {
            const myInterestsList = items.filter(i => Boolean(i.user_interested));
            return (
              <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <button
                      className="btn-outline"
                      style={{ fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', marginBottom: '0.5rem' }}
                      onClick={() => setCurrentView('catalog')}
                    >
                      <ArrowLeft size={16} /> Back to Browse
                    </button>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', color: 'var(--pine-deep)', margin: 0 }}>
                      ⭐ My Interested Items ({myInterestsList.length})
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                      Possessions you have saved to your watch list. You can view details or remove interest anytime.
                    </p>
                  </div>
                  <button className="btn-green" onClick={() => setCurrentView('catalog')}>
                    Browse More Items ➔
                  </button>
                </div>

                {myInterestsList.length === 0 ? (
                  <div className="card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Star size={48} color="var(--pine-primary)" style={{ opacity: 0.4, marginBottom: '0.85rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--pine-deep)', marginBottom: '0.4rem' }}>
                      No items in your watch list yet
                    </h3>
                    <p style={{ fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.25rem auto' }}>
                      Browse the estate collection and tap "☆ I'm Interested" on any item you would like to follow.
                    </p>
                    <button className="btn-green" style={{ padding: '0.65rem 1.4rem' }} onClick={() => setCurrentView('catalog')}>
                      Browse Catalog Now ➔
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {myInterestsList.map((item) => (
                      <div
                        key={item.id}
                        className="card"
                        style={{
                          display: 'flex',
                          gap: '1.25rem',
                          padding: '1.1rem',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleOpenItemDetail(item)}
                      >
                        <div style={{ width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f6f5f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CachedThumbnail
                            url={item.primary_thumb || item.primary_photo}
                            version={item.primary_thumb_version}
                            alt={item.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: 'var(--pine-deep)', margin: '0 0 4px 0' }}>
                            {item.title}
                          </h3>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span className="tag-pill" style={{ fontSize: '0.75rem' }}>{item.category_name || "Uncategorized"}</span>
                            {item.value && (
                              <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--pine-primary)' }}>
                                {item.value.startsWith('$') ? item.value : `$${item.value}`}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="btn-outline"
                            style={{
                              padding: '0.45rem 0.9rem',
                              fontSize: '0.85rem',
                              color: '#c62828',
                              borderColor: '#ef9a9a',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                            onClick={async () => {
                              await handleToggleInterest(item);
                            }}
                          >
                            ✕ Remove Interest
                          </button>
                          <button
                            className="btn-green"
                            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: '600' }}
                            onClick={() => handleOpenItemDetail(item)}
                          >
                            View Item Details ➔
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ADMIN QUESTIONS VIEW */}
          {currentView === 'admin_questions' && currentUser?.role === 'admin' && (
            <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', color: 'var(--pine-deep)', margin: '0 0 4px 0' }}>
                    ❓ Family Member Questions
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                    Review questions asked by family members and submit answers that appear on the item detail page.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-outline" onClick={() => fetchAdminQuestions(adminQuestionsFilter)}>
                    🔄 Refresh Questions
                  </button>
                  <button className="btn-green" onClick={handleNavigateHome}>
                    🏠 Return to Dashboard
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  className={`btn-outline ${adminQuestionsFilter === 'all' ? 'btn-green' : ''}`}
                  style={{ borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                  onClick={() => { setAdminQuestionsFilter('all'); fetchAdminQuestions('all'); }}
                >
                  All Questions
                </button>
                <button
                  className={`btn-outline ${adminQuestionsFilter === 'unanswered' ? 'btn-green' : ''}`}
                  style={{ borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                  onClick={() => { setAdminQuestionsFilter('unanswered'); fetchAdminQuestions('unanswered'); }}
                >
                  ⏳ Unanswered Only
                </button>
                <button
                  className={`btn-outline ${adminQuestionsFilter === 'answered' ? 'btn-green' : ''}`}
                  style={{ borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                  onClick={() => { setAdminQuestionsFilter('answered'); fetchAdminQuestions('answered'); }}
                >
                  ✅ Answered
                </button>
              </div>

              {isLoadingAdminQA ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 0.75rem auto' }} />
                  <div>Loading questions...</div>
                </div>
              ) : adminQuestions.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <HelpCircle size={44} color="var(--pine-primary)" style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--pine-deep)' }}>No questions found</h3>
                  <p style={{ fontSize: '0.88rem' }}>No family members have asked questions in this filter.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {adminQuestions.map(q => (
                    <div key={q.id} className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {q.item_thumb && (
                          <img src={q.item_thumb} alt={q.item_title} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--pine-deep)' }}>
                              Item: {q.item_title} {q.item_number ? `(${q.item_number})` : ''}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {new Date(q.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.92rem', color: '#1e293b', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.65rem' }}>
                            <strong>{q.user_name}:</strong> "{q.question}"
                          </div>

                          {q.is_answered ? (
                            <div style={{ background: '#e8f5e9', borderLeft: '3px solid #2e7d32', padding: '0.6rem 0.85rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#2e7d32', marginBottom: '2px' }}>
                                Answered by {q.answered_by_name || 'Admin'} on {new Date(q.answered_at).toLocaleDateString()}:
                              </div>
                              <div style={{ fontSize: '0.88rem', color: '#1b5e20' }}>
                                {q.answer}
                              </div>
                            </div>
                          ) : (
                            <div>
                              {adminAnsweringQuestionId === q.id ? (
                                <div style={{ marginTop: '0.75rem' }}>
                                  <textarea
                                    value={adminAnswerText}
                                    onChange={(e) => setAdminAnswerText(e.target.value)}
                                    placeholder="Type your official answer to the family member..."
                                    rows={3}
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                                  />
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      className="btn-green"
                                      disabled={isSubmittingAnswer || !adminAnswerText.trim()}
                                      onClick={() => handleAnswerQuestion(q.id)}
                                      style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                                    >
                                      {isSubmittingAnswer ? 'Saving...' : '💾 Submit Answer'}
                                    </button>
                                    <button
                                      className="btn-outline"
                                      onClick={() => { setAdminAnsweringQuestionId(null); setAdminAnswerText(''); }}
                                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="btn-outline"
                                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pine-primary)', borderColor: 'var(--pine-primary)', marginTop: '0.35rem' }}
                                  onClick={() => {
                                    setAdminAnsweringQuestionId(q.id);
                                    setAdminAnswerText('');
                                  }}
                                >
                                  ✍️ Reply / Answer Question
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADMIN STORIES VIEW */}
          {currentView === 'admin_stories' && currentUser?.role === 'admin' && (
            <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', color: 'var(--pine-deep)', margin: '0 0 4px 0' }}>
                    💬 Family Stories & Memories
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                    All personal memories and stories submitted by family members across Uncle Jim's estate inventory.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-outline" onClick={fetchAdminStories}>
                    🔄 Refresh Stories
                  </button>
                  <button className="btn-green" onClick={handleNavigateHome}>
                    🏠 Return to Dashboard
                  </button>
                </div>
              </div>

              {isLoadingAdminQA ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 0.75rem auto' }} />
                  <div>Loading stories...</div>
                </div>
              ) : adminStories.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MessageSquare size={44} color="var(--pine-primary)" style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--pine-deep)' }}>No stories recorded yet</h3>
                  <p style={{ fontSize: '0.88rem' }}>When family members share memories in the item detail view, they will appear here.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {adminStories.map(s => (
                    <div key={s.id} className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {s.item_thumb && (
                          <img src={s.item_thumb} alt={s.item_title} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--pine-deep)' }}>
                              Item: {s.item_title} {s.item_number ? `(${s.item_number})` : ''}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--pine-primary)', fontWeight: 'bold', marginBottom: '6px' }}>
                            Contributor: {s.user_name || s.provenance_source || 'Family Member'}
                          </div>
                          <p style={{ fontSize: '0.92rem', color: '#2c3e35', margin: 0, lineHeight: '1.5', background: '#f8faf9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', whiteSpace: 'pre-line' }}>
                            "{s.story_text}"
                          </p>
                        </div>
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

          {/* ADMIN FAMILY USERS & PASSWORD RESET VIEW */}
          {currentView === 'users' && currentUser?.role === 'admin' && (
            <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--pine-deep)', margin: '0 0 4px 0' }}>
                    👥 Family Members & User Accounts
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                    Manage family accounts, review access roles, and reset member passwords to default.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-outline" onClick={fetchAdminUsers} disabled={isLoadingAdminUsers}>
                    🔄 Refresh Users
                  </button>
                  <button className="btn-green" onClick={handleNavigateHome}>
                    🏠 Return to Dashboard
                  </button>
                </div>
              </div>

              {isLoadingAdminUsers ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 0.75rem auto' }} />
                  <div>Loading family members...</div>
                </div>
              ) : (
                <div className="data-table-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Location</th>
                        <th style={{ textAlign: 'right' }}>Password Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsersList.map(u => {
                        const isAdmin = u.role === 'admin' || u.id === 'user_dan';
                        return (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 'bold', color: 'var(--pine-deep)' }}>
                              {u.name}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              {u.email}
                            </td>
                            <td>
                              <span className={`badge-status ${isAdmin ? 'badge-assigned' : 'badge-released'}`} style={{ fontSize: '0.78rem' }}>
                                {isAdmin ? '👑 Admin' : u.role === 'contributor' ? '📷 Photographer' : u.role === 'institution' ? '🏛️ Institution' : '👤 Family Member'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {u.address || '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isAdmin ? (
                                <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Lock size={13} color="#64748b" /> Protected Admin
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-outline"
                                  style={{
                                    fontSize: '0.82rem',
                                    fontWeight: '600',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    color: 'var(--pine-deep)',
                                    borderColor: 'var(--border-color)',
                                    background: '#fff'
                                  }}
                                  onClick={() => {
                                    setResetPasswordError(null);
                                    setResetPasswordSuccess(null);
                                    setUserToResetPassword(u);
                                  }}
                                >
                                  <Key size={14} color="var(--pine-primary)" />
                                  Reset Password
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {adminUsersList.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ADMIN INTEREST DASHBOARD */}
          {currentView === 'admin_interests' && currentUser?.role === 'admin' && (() => {
            // Group all interests by item_id
            const groupedByItem = {};
            adminInterests.forEach(entry => {
              if (!groupedByItem[entry.item_id]) {
                groupedByItem[entry.item_id] = {
                  item_id: entry.item_id,
                  item_title: entry.item_title,
                  item_number: entry.item_number,
                  item_status: entry.item_status,
                  item_description: entry.item_description,
                  item_destination: entry.item_destination,
                  category_name: entry.category_name,
                  item_thumb: entry.item_thumb,
                  assigned_to_name: entry.assigned_to_name,
                  interests: []
                };
              }
              groupedByItem[entry.item_id].interests.push(entry);
            });

            const itemList = Object.values(groupedByItem);
            const totalItemsWithInterest = itemList.length;
            const totalExpressions = adminInterests.length;
            const conflictItems = itemList.filter(it => it.interests.length > 1);

            // Extract unique users who have expressed interest
            const uniqueUsers = [];
            const seenUserIds = new Set();
            adminInterests.forEach(e => {
              if (!seenUserIds.has(e.user_id)) {
                seenUserIds.add(e.user_id);
                uniqueUsers.push({ id: e.user_id, name: e.user_name });
              }
            });
            uniqueUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            // Filter items based on search and user filter
            const filteredItemList = itemList.filter(item => {
              if (adminInterestsUserFilter !== 'all') {
                const hasUser = item.interests.some(i => i.user_id === adminInterestsUserFilter);
                if (!hasUser) return false;
              }

              if (adminInterestsSearch && adminInterestsSearch.trim()) {
                const q = adminInterestsSearch.toLowerCase().trim();
                const titleMatch = (item.item_title || '').toLowerCase().includes(q);
                const catMatch = (item.category_name || '').toLowerCase().includes(q);
                const descMatch = (item.item_description || '').toLowerCase().includes(q);
                const userMatch = item.interests.some(i => 
                  (i.user_name || '').toLowerCase().includes(q) || 
                  (i.comment || '').toLowerCase().includes(q)
                );
                if (!titleMatch && !catMatch && !descMatch && !userMatch) return false;
              }

              return true;
            });

            return (
              <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--pine-deep)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Heart size={26} color="#e11d48" fill="#e11d48" /> Family Interest Dashboard
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                      Overview of family members who have marked possessions of interest and their notes.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-outline" onClick={fetchAdminInterests} disabled={isLoadingAdminInterests}>
                      🔄 Refresh
                    </button>
                    <button className="btn-green" onClick={handleNavigateHome}>
                      🏠 Dashboard
                    </button>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="kpi-card" style={{ cursor: 'default' }}>
                    <div className="kpi-num" style={{ color: 'var(--pine-primary)' }}>{totalItemsWithInterest}</div>
                    <div className="kpi-label">Items with Interest</div>
                    <div className="kpi-btn-hint">{totalItemsWithInterest === 1 ? '1 estate possession' : `${totalItemsWithInterest} estate possessions`}</div>
                  </div>

                  <div className="kpi-card" style={{ cursor: 'default' }}>
                    <div className="kpi-num" style={{ color: '#0284c7' }}>{totalExpressions}</div>
                    <div className="kpi-label">Total Expressions</div>
                    <div className="kpi-btn-hint">Across all family members</div>
                  </div>

                  <div className="kpi-card" style={{ cursor: 'default', borderColor: conflictItems.length > 0 ? '#fde68a' : undefined, background: conflictItems.length > 0 ? '#fffbeb' : undefined }}>
                    <div className="kpi-num" style={{ color: conflictItems.length > 0 ? '#b45309' : '#16a34a' }}>
                      {conflictItems.length}
                    </div>
                    <div className="kpi-label">Multiple Interested</div>
                    <div className="kpi-btn-hint" style={{ color: conflictItems.length > 0 ? '#b45309' : undefined }}>
                      {conflictItems.length > 0 ? 'Requires decision / draft' : 'No conflicts'}
                    </div>
                  </div>
                </div>

                {/* Search & Filter Row */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 240px', minWidth: '220px', display: 'flex', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.45rem 0.85rem', alignItems: 'center' }}>
                    <Search size={18} color="var(--text-muted)" style={{ marginRight: '0.5rem', flexShrink: 0 }} />
                    <input
                      type="text"
                      style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', background: 'transparent' }}
                      placeholder="Filter by item title, category, person, comment..."
                      value={adminInterestsSearch}
                      onChange={e => setAdminInterestsSearch(e.target.value)}
                    />
                    {adminInterestsSearch && (
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                        onClick={() => setAdminInterestsSearch('')}
                        title="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div style={{ minWidth: '180px' }}>
                    <select
                      value={adminInterestsUserFilter}
                      onChange={e => setAdminInterestsUserFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.52rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: '#fff',
                        fontSize: '0.9rem',
                        color: 'var(--text-dark)',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all">All Family Members ({uniqueUsers.length})</option>
                      {uniqueUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {(adminInterestsSearch || adminInterestsUserFilter !== 'all') && (
                    <button
                      className="btn-outline"
                      style={{ fontSize: '0.82rem', color: '#d32f2f', borderColor: '#ffcdd2', padding: '0.45rem 0.85rem' }}
                      onClick={() => { setAdminInterestsSearch(''); setAdminInterestsUserFilter('all'); }}
                    >
                      <X size={14} style={{ marginRight: '4px' }} /> Clear Filters
                    </button>
                  )}
                </div>

                {/* Items List */}
                {isLoadingAdminInterests ? (
                  <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 0.75rem auto' }} />
                    <div>Loading family interest records...</div>
                  </div>
                ) : filteredItemList.length === 0 ? (
                  <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Heart size={44} color="var(--pine-primary)" style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--pine-deep)' }}>No items found</h3>
                    <p style={{ fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: '1rem' }}>
                      {adminInterests.length === 0
                        ? "No family members have marked interest in any possessions yet."
                        : "No items match your current filter criteria."}
                    </p>
                    {(adminInterestsSearch || adminInterestsUserFilter !== 'all') && (
                      <button className="btn-outline" onClick={() => { setAdminInterestsSearch(''); setAdminInterestsUserFilter('all'); }}>
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredItemList.map(item => {
                      const hasMultiple = item.interests.length > 1;
                      return (
                        <div
                          key={item.item_id}
                          className="card"
                          style={{
                            padding: '1.25rem',
                            border: hasMultiple ? '1px solid #fde68a' : '1px solid var(--border-color)',
                            background: '#fff'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            {/* Thumbnail */}
                            <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', background: '#f3f4f6', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                              <img
                                src={item.item_thumb || OFFLINE_THUMB}
                                alt={item.item_title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.src = OFFLINE_THUMB; }}
                              />
                            </div>

                            {/* Item Details */}
                            <div style={{ flex: 1, minWidth: '220px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: 'var(--pine-deep)', margin: 0 }}>
                                  {item.item_title}
                                </h3>
                                {item.item_number && (
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>#{item.item_number}</span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                {item.category_name && (
                                  <span className="badge-category" style={{ fontSize: '0.75rem' }}>
                                    {item.category_name}
                                  </span>
                                )}
                                <span className={`badge-status ${item.item_status === 'released' ? 'badge-released' : item.item_status === 'assigned' ? 'badge-assigned' : 'badge-draft'}`} style={{ fontSize: '0.75rem' }}>
                                  {item.item_status ? item.item_status.toUpperCase() : 'STATUS'}
                                </span>
                                {hasMultiple ? (
                                  <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '12px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    ⚠️ {item.interests.length} Interested (Multiple)
                                  </span>
                                ) : (
                                  <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    ✓ 1 Interested
                                  </span>
                                )}
                                {item.assigned_to_name && (
                                  <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    Assigned to: {item.assigned_to_name}
                                  </span>
                                )}
                              </div>

                              {/* Interested Persons List */}
                              <div style={{ background: 'var(--bg-subtle)', borderRadius: '8px', padding: '0.75rem 1rem', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                  Interested Family Members ({item.interests.length}):
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {item.interests.map(intr => (
                                    <div key={intr.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--pine-deep)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                          <Heart size={14} color="#e11d48" fill="#e11d48" />
                                          <span>{intr.user_name}</span>
                                          {intr.user_email && (
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({intr.user_email})</span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                          {intr.created_at ? new Date(intr.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                                        </div>
                                      </div>
                                      {intr.comment && (
                                        <div style={{ fontSize: '0.85rem', color: '#374151', fontStyle: 'italic', paddingLeft: '1.4rem', marginTop: '0.15rem' }}>
                                          "{intr.comment}"
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Action links */}
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                  className="btn-outline"
                                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                                  onClick={() => {
                                    setSearchQuery(item.item_title);
                                    setCurrentView('catalog');
                                  }}
                                >
                                  📦 View in Catalog
                                </button>
                                <button
                                  className="btn-green"
                                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                                  onClick={() => {
                                    setCurrentView('assignments');
                                  }}
                                >
                                  🎯 Manage in Assignments →
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
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
                        <option value="Decorative Items">Decorative Items</option>
                        <option value="Framed Photographs">Framed Photographs</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Kitchen">Kitchen</option>
                        <option value="Books">Books</option>
                        <option value="Tools">Tools</option>
                        <option value="Jewelry">Jewelry</option>
                        <option value="Collectibles">Collectibles</option>
                        <option value="Packers">Packers</option>
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
                  <label className="form-field-label">Destination (Planning)</label>
                  <select
                    className="form-field-select"
                    value={editFormDestination || 'undecided'}
                    onChange={(e) => setEditFormDestination(e.target.value)}
                  >
                    <option value="undecided">Undecided</option>
                    <option value="family">Family</option>
                    <option value="institution">Institution</option>
                    <option value="estate_sale">Estate Sale</option>
                    <option value="friend">Friend</option>
                    <option value="charity">Charity</option>
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Institutional Candidate</label>
                  <select
                    className="form-field-select"
                    value={editFormInstitutionalCandidate || ''}
                    onChange={(e) => setEditFormInstitutionalCandidate(e.target.value)}
                  >
                    <option value="">-- Select Candidate --</option>
                    <option value="TBD">TBD</option>
                    <option value="No">No</option>
                    <option value="Maritime Museum">Maritime Museum</option>
                    <option value="Library">Library</option>
                  </select>
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

      {/* In-Place Re-authentication Modal */}
      {needsReauth && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, color: 'var(--pine-deep)', fontSize: '1.25rem' }}>🔐 Sign In to Upload Items</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Your session expired while offline. Your offline items remain 100% safe.
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setNeedsReauth(false)}>✕</button>
            </div>

            <form onSubmit={handleInPlaceReauth} style={{ padding: '1.25rem' }}>
              <div style={{ background: '#f8faf9', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
                <div><strong>Account:</strong> {currentUser?.email || 'dan@unclejim.estate'}</div>
                <div style={{ color: 'var(--pine-primary)', fontWeight: 'bold', marginTop: '4px' }}>
                  📦 {stagedItems.length} Offline Item(s) ready to upload
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.35rem' }}>
                  Enter Password
                </label>
                <input
                  type="password"
                  autoFocus
                  placeholder="••••••••"
                  value={reauthPassword}
                  onChange={e => setReauthPassword(e.target.value)}
                  style={{ width: '100%', minHeight: '46px', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setNeedsReauth(false)}
                  disabled={isReauthenticating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-green-senior"
                  style={{ minHeight: '46px', padding: '0 1.25rem', fontSize: '0.95rem' }}
                  disabled={isReauthenticating}
                >
                  {isReauthenticating ? 'Signing In...' : 'Sign In & Resume Upload ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Offline Sync Diagnostics Modal */}
      {showDiagnosticsModal && (
        <div className="modal-overlay" style={{ zIndex: 9998 }} onClick={() => setShowDiagnosticsModal(false)}>
          <div className="modal-card" style={{ maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, color: 'var(--pine-deep)', fontSize: '1.3rem' }}>
                  🔍 Offline Sync Diagnostics & Local Recovery Screen
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Inspect all locally stored offline records and photo Blobs on your device before syncing. • <strong>Build: 2026-09-09 Diagnostics Recovery</strong>
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDiagnosticsModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem', overflowY: 'auto' }}>
              {/* Summary Banner (Rule 6) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '0.65rem',
                marginBottom: '1.25rem',
                background: '#f8faf9',
                padding: '0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--pine-deep)' }}>{stagedItems.length}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>LOCAL ITEMS</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#b45309' }}>
                    {stagedItems.filter(i => i.syncStatus === 'pending' || !i.syncStatus).length}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#b45309' }}>PENDING</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#b91c1c' }}>
                    {stagedItems.filter(i => i.syncStatus === 'failed').length}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#b91c1c' }}>FAILED</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2563eb' }}>
                    {syncProgress.isSyncing ? 1 : 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#2563eb' }}>UPLOADING</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#15803d' }}>
                    {stagedItems.filter(i => i.syncStatus === 'synced').length}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#15803d' }}>SYNCED</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--pine-deep)' }}>
                    {stagedItems.reduce((acc, i) => acc + ((i.photos && i.photos.length) || (i.croppedBlob ? 1 : 0)), 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>LOCAL PHOTOS FOUND</div>
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {stagedItems.map((item, idx) => {
                  const photoList = item.photos || [];
                  const hasCrop = Boolean(item.croppedBlob);
                  let thumbUrl = null;
                  let primaryBlob = null;

                  if (hasCrop && item.croppedBlob) {
                    primaryBlob = item.croppedBlob;
                  } else if (photoList.length > 0) {
                    primaryBlob = photoList[0].data || photoList[0].file || photoList[0].blob;
                  }

                  if (primaryBlob && (primaryBlob instanceof Blob || primaryBlob instanceof File)) {
                    try {
                      thumbUrl = URL.createObjectURL(primaryBlob);
                    } catch (e) {}
                  }

                  const hasBlob = Boolean(primaryBlob && (primaryBlob.size > 0));
                  const mimeType = (primaryBlob && primaryBlob.type) || (photoList[0] && photoList[0].type) || 'image/jpeg';
                  
                  let totalBytes = 0;
                  photoList.forEach(p => {
                    const b = p.data || p.file || p.blob;
                    if (b && b.size) totalBytes += b.size;
                  });
                  if (item.croppedBlob && item.croppedBlob.size) totalBytes += item.croppedBlob.size;

                  const sizeFormatted = totalBytes > 0 
                    ? (totalBytes > 1024 * 1024 ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(totalBytes / 1024)} KB`)
                    : (hasBlob ? 'Valid' : '0 Bytes');

                  const isSynced = item.syncStatus === 'synced';
                  const isFailed = item.syncStatus === 'failed';

                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        background: isFailed ? '#fff5f5' : isSynced ? '#f0fdf4' : '#ffffff',
                        border: isFailed ? '1px solid #fca5a5' : isSynced ? '1px solid #86efac' : '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Thumbnail from Local Photo Blob */}
                        <div style={{
                          width: '74px',
                          height: '74px',
                          borderRadius: '8px',
                          background: '#f6f5f0',
                          border: '1px solid var(--border-color)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt="Local draft"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', padding: '4px' }}>
                              No Photo Blob
                            </span>
                          )}
                        </div>

                        {/* Title & Status */}
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--pine-deep)' }}>
                              #{idx + 1}. {item.title || 'Untitled Item'}
                            </div>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 'bold',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: isFailed ? '#fee2e2' : isSynced ? '#dcfce7' : '#fef3c7',
                                color: isFailed ? '#b91c1c' : isSynced ? '#15803d' : '#b45309',
                                border: isFailed ? '1px solid #fca5a5' : isSynced ? '1px solid #86efac' : '1px solid #fde68a'
                              }}
                            >
                              {isFailed ? '⚠️ Upload Failed' : isSynced ? '✅ Synced (Local Copy Retained)' : '⏳ Pending Upload'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.45rem', background: '#fdfcf7', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #f1ede2' }}>
                            <div><strong>Local ID:</strong> <code style={{ fontSize: '0.74rem' }}>{item.id}</code></div>
                            <div><strong>Server ID:</strong> {item.serverId ? <code style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 'bold' }}>{item.serverId}</code> : <span style={{ color: '#9ca3af' }}>None</span>}</div>
                            <div><strong>Local Photo Exists:</strong> <span style={{ color: hasBlob ? '#15803d' : '#b91c1c', fontWeight: 'bold' }}>{hasBlob ? 'Yes' : 'No (0 Bytes)'}</span></div>
                            <div><strong>Original Photos:</strong> {photoList.length} photo(s) {hasCrop ? '+ 1:1 crop' : ''}</div>
                            <div><strong>ORIGINAL Local Size:</strong> <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{sizeFormatted}</span></div>
                            <div><strong>Original MIME:</strong> <code>{mimeType}</code></div>
                            <div><strong>Upload Derivative:</strong> <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{item.syncDiagnostics?.derivativeSize || (hasBlob ? 'Target ~350–600 KB' : 'N/A')}</span></div>
                            <div><strong>Derivative MIME:</strong> <code>{item.syncDiagnostics?.derivativeMime || (hasBlob ? 'image/jpeg' : 'N/A')}</code></div>
                            <div><strong>Compression:</strong> <span style={{ color: item.syncDiagnostics?.compressionStatus === 'derivative_created' ? '#15803d' : '#2563eb', fontWeight: 'bold' }}>{item.syncDiagnostics?.compressionStatus || (hasBlob ? 'Ready (non-destructive derivative)' : 'No photo')}</span></div>
                            <div><strong>Upload Attempts:</strong> {item.uploadAttempts || 0}</div>
                            <div><strong>Last Attempt:</strong> {item.lastAttemptTime ? new Date(item.lastAttemptTime).toLocaleTimeString() : 'Not started'}</div>
                            <div><strong>Server Response:</strong> {item.syncDiagnostics?.httpStatus ? <span style={{ fontWeight: 'bold', color: item.syncDiagnostics.httpStatus === 200 ? '#15803d' : '#b91c1c' }}>HTTP {item.syncDiagnostics.httpStatus}</span> : 'None'}</div>
                          </div>
                        </div>

                        {/* Safe Single Item Upload Button */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignSelf: 'center', minWidth: '150px' }}>
                          <button
                            type="button"
                            className="btn-outline"
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.5rem 0.85rem',
                              fontWeight: 'bold',
                              color: isSynced ? '#15803d' : isFailed ? '#b91c1c' : 'var(--pine-primary)',
                              borderColor: isSynced ? '#86efac' : isFailed ? '#f87171' : 'var(--pine-primary)',
                              background: '#fff',
                              borderRadius: '8px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              cursor: syncProgress.isSyncing ? 'not-allowed' : 'pointer'
                            }}
                            disabled={syncProgress.isSyncing}
                            onClick={() => triggerSyncOfflineItems({ targetItemId: item.id })}
                          >
                            {isSynced ? '🔄 Re-Sync This Item' : '⚡ Test Upload One Item'}
                          </button>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'center' }}>
                            {isSynced ? 'Already confirmed on server' : 'Uploads ONLY this item safely'}
                          </span>
                        </div>
                      </div>

                      {/* Error Information if Failed */}
                      {item.syncError && (
                        <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                          <strong>Last Server Error:</strong> {item.syncError}
                          {item.syncDiagnostics?.httpStatus && ` (HTTP ${item.syncDiagnostics.httpStatus})`}
                        </div>
                      )}
                    </div>
                  );
                })}

                {stagedItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No staged offline items in storage.
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions (Rule 7) */}
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.25rem' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowDiagnosticsModal(false)}
              >
                Close Inspection
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {stagedItems.some(i => i.syncStatus === 'failed') && (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ color: '#b91c1c', borderColor: '#b91c1c', fontWeight: 'bold' }}
                    disabled={syncProgress.isSyncing}
                    onClick={() => triggerSyncOfflineItems({ onlyFailed: true })}
                  >
                    🔄 RETRY ALL FAILED ({stagedItems.filter(i => i.syncStatus === 'failed').length})
                  </button>
                )}

                <button
                  type="button"
                  className="btn-green-senior"
                  style={{ minHeight: '44px', padding: '0 1.25rem', fontWeight: 'bold' }}
                  disabled={syncProgress.isSyncing || stagedItems.length === 0}
                  onClick={() => triggerSyncOfflineItems({})}
                >
                  {syncProgress.isSyncing ? 'Uploading...' : `📤 SYNC ALL PENDING (${stagedItems.filter(i => i.syncStatus !== 'synced').length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CHANGE PASSWORD MODAL (Available to any logged-in user) */}
      {showChangePasswordModal && (
        <div className="modal-overlay" onClick={() => !isChangingPassword && setShowChangePasswordModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Key size={20} color="var(--pine-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--pine-deep)' }}>
                  Change Password
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                disabled={isChangingPassword}
                onClick={() => setShowChangePasswordModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="modal-body" style={{ padding: '1.25rem' }}>
                {changePasswordSuccess && (
                  <div style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <CheckCircle2 size={18} color="#2e7d32" />
                    <span>{changePasswordSuccess}</span>
                  </div>
                )}

                {changePasswordError && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <AlertCircle size={18} color="#991b1b" />
                    <span>{changePasswordError}</span>
                  </div>
                )}

                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.35rem' }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPasswordInput}
                    onChange={e => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter your current password"
                    style={{ width: '100%', minHeight: '48px', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.35rem' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                    placeholder="Enter a new password"
                    style={{ width: '100%', minHeight: '48px', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.35rem' }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPasswordInput}
                    onChange={e => setConfirmPasswordInput(e.target.value)}
                    placeholder="Re-enter the new password"
                    style={{ width: '100%', minHeight: '48px', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.25rem' }}>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={isChangingPassword}
                  onClick={() => setShowChangePasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-green-senior"
                  disabled={isChangingPassword}
                  style={{ minHeight: '44px', padding: '0 1.5rem', fontWeight: 'bold' }}
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN RESET USER PASSWORD CONFIRMATION MODAL */}
      {userToResetPassword && (
        <div className="modal-overlay" onClick={() => !isResettingPassword && setUserToResetPassword(null)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Key size={20} color="var(--pine-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--pine-deep)' }}>
                  Reset User Password
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                disabled={isResettingPassword}
                onClick={() => setUserToResetPassword(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              {resetPasswordSuccess ? (
                <div style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <CheckCircle2 size={20} color="#2e7d32" />
                  <span>{resetPasswordSuccess}</span>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--pine-deep)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                    Reset {userToResetPassword.name}'s password to the default password?
                  </p>
                  <div style={{ background: '#f8faf9', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Target Account: <strong style={{ color: 'var(--text-color)' }}>{userToResetPassword.name}</strong> ({userToResetPassword.email})
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                      New Default Password: <strong style={{ color: 'var(--pine-primary)' }}>Lombardi</strong>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
                    {userToResetPassword.name} will be able to log in immediately using the default password and will have the option to change it anytime from their profile menu.
                  </p>
                  {resetPasswordError && (
                    <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.9rem' }}>
                      {resetPasswordError}
                    </div>
                  )}
                </>
              )}
            </div>

            {!resetPasswordSuccess && (
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.25rem' }}>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={isResettingPassword}
                  onClick={() => setUserToResetPassword(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-green-senior"
                  disabled={isResettingPassword}
                  style={{ minHeight: '44px', padding: '0 1.25rem', fontWeight: 'bold' }}
                  onClick={handleResetUserPassword}
                >
                  {isResettingPassword ? 'Resetting...' : `Reset ${userToResetPassword.name}'s Password`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
