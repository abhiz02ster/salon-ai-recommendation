import React, { useState, useEffect, useRef } from 'react';
import { SessionProvider, useSession } from './context/SessionContext';

// Common Components
import Header from './components/common/Header';
import CheckInOverlay from './components/common/CheckInOverlay';
import CheckoutModal from './components/common/CheckoutModal';
import FeedbackOverlay from './components/common/FeedbackOverlay';
import HeroLandingPage from './components/common/HeroLandingPage';


// Client Views
import OptionsPanel from './components/client/OptionsPanel';
import CameraCapture from './components/client/CameraCapture';
import RecommendationsCarousel from './components/client/RecommendationsCarousel';

// Admin Views
import ClientDirectory from './components/admin/ClientDirectory';
import ClientProfileDetail from './components/admin/ClientProfileDetail';
import InventoryControl from './components/admin/InventoryControl';
import SuperAdminConsole from './components/admin/SuperAdminConsole';

// Client profile drawer
import ClientProfileDrawer from './components/client/ClientProfileDrawer';

const STYLING_QUOTES = [
    "“Invest in your hair, it is the crown you never take off.”",
    "“Great hair doesn't happen by chance, it happens by appointment.”",
    "“Hair style is the final tip-off whether or not a person really knows themselves.” – Hubert de Givenchy",
    "“Beauty is when you can appreciate yourself. When you love yourself, that's when you're most beautiful.” – Zoe Kravitz",
    "“Life is more beautiful when you meet the right hair stylist.”",
    "“Your hair is the ball gown you never take off.”",
    "“A woman who cuts her hair is about to change her life.” – Coco Chanel",
    "“Hairdressing is not a job, it's a craft.”",
    "“Invest in your style, express your soul.”"
];

const LOADING_PHASES = [
    "Activating AI Profiler Agent: Calibrating facial viewpoints...",
    "Profiler Agent: Scanning frontal shape outline... analyzing symmetry...",
    "Profiler Agent: Extracting facial parameters: face shape, skin undertone...",
    "Handing off to StylistAgent: Retrieving warehouse product availability...",
    "StylistAgent: Synthesizing customized hair shape recommendations...",
    "StylistAgent: Writing suitability scores and styling tips..."
];

const AppContent = () => {
    const {
        activeClientId,
        clientName,
        clientPhone,
        activeConsultationId,
        capturedPhotos,
        currentRecommendationsData,
        setCurrentRecommendationsData,
        clientHistory,
        setClientHistory,
        showResults,
        showCapture,
        showOptions,
        checkInOpen,
        toast,
        setToast,
        setCapturedPhotos,
        setActiveConsultationId,
        setShowResults,
        setShowCapture,
        setShowOptions,
        setCheckInOpen,
        showToast,
        activeSessions,
        currentSessionIndex,
        switchActiveSession,
        closeActiveSession,
        saveCurrentSessionState
    } = useSession();

    // Viewport switcher states
    const [viewMode, setViewMode] = useState(() => {
        const path = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        if (path.endsWith('/super-admin') || search.includes('mode=superadmin') || search.includes('mode=super-admin')) {
            return 'super-admin';
        }
        if (path.endsWith('/admin') || search.includes('mode=admin')) {
            return 'admin';
        }
        if (path.endsWith('/stylist') || search.includes('mode=stylist')) {
            return 'stylist';
        }
        
        // Restore active session if present
        const sAuth = sessionStorage.getItem('salon_stylist_auth') === 'true';
        const aAuth = sessionStorage.getItem('salon_admin_auth') === 'true';
        const saAuth = sessionStorage.getItem('salon_superadmin_auth') === 'true';
        
        if (saAuth) return 'super-admin';
        if (aAuth) return 'admin';
        if (sAuth) return 'stylist';
        
        return 'landing';
    });

    const isAdmin = viewMode === 'admin';
    const isSuperAdmin = viewMode === 'super-admin';
    const isConsoleMode = isAdmin || isSuperAdmin;

    const [adminTab, setAdminTab] = useState('crm');
    const [selectedCrmClientId, setSelectedCrmClientId] = useState(null);
    const [alertsCount, setAlertsCount] = useState(0);

    // Profile drawer state
    const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

    // Salon settings overrides
    const [salonName, setSalonName] = useState("Master Stylist Salon");
    const [activeTheme, setActiveTheme] = useState("theme-alabaster-gold");

    // Passcode auth states
    const [showAuthModal, setShowAuthModal] = useState(null); // null | 'admin' | 'super-admin'
    const [stylistAuth, setStylistAuth] = useState(() => sessionStorage.getItem('salon_stylist_auth') === 'true');
    const [adminAuth, setAdminAuth] = useState(() => sessionStorage.getItem('salon_admin_auth') === 'true');
    const [superAdminAuth, setSuperAdminAuth] = useState(() => sessionStorage.getItem('salon_superadmin_auth') === 'true');
    const [passcodeInput, setPasscodeInput] = useState("");
    const [authError, setAuthError] = useState("");

    // Inactivity Auto-Logout (10 minutes)
    const lastActivityRef = useRef(Date.now());
    
    const handleLogout = () => {
        sessionStorage.removeItem('salon_stylist_auth');
        sessionStorage.removeItem('salon_admin_auth');
        sessionStorage.removeItem('salon_superadmin_auth');
        setStylistAuth(false);
        setAdminAuth(false);
        setSuperAdminAuth(false);
        
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        url.pathname = '/';
        window.history.replaceState({}, '', url.toString());
        
        setViewMode('landing');
        showToast("Logged out successfully.");
    };

    useEffect(() => {
        if (viewMode === 'landing') return;

        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        window.addEventListener('mousemove', updateActivity);
        window.addEventListener('keydown', updateActivity);
        window.addEventListener('click', updateActivity);
        window.addEventListener('scroll', updateActivity);

        const checkInactivity = setInterval(() => {
            const timePassed = Date.now() - lastActivityRef.current;
            if (timePassed >= 10 * 60 * 1000) { // 10 minutes in ms
                handleLogout();
                showToast("Logged out due to inactivity.");
            }
        }, 10000); // check every 10s

        return () => {
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
            window.removeEventListener('click', updateActivity);
            window.removeEventListener('scroll', updateActivity);
            clearInterval(checkInactivity);
        };
    }, [viewMode]);

    // Fetch initial config on mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`${window.location.origin}/api/config`);
                if (res.ok) {
                    const data = await res.json();
                    const sName = data.salon_name || "Master Stylist Salon";
                    const aTheme = data.active_theme || "theme-alabaster-gold";
                    setSalonName(sName);
                    setActiveTheme(aTheme);
                    
                    document.title = sName;
                    document.body.className = aTheme;
                }
            } catch (err) {
                console.error("Failed to fetch salon configs on load", err);
            }
        };
        fetchConfig();
    }, []);

    // Configuration updater callback
    const handleConfigUpdate = (newName, newTheme) => {
        setSalonName(newName);
        setActiveTheme(newTheme);
        document.title = newName;
        document.body.className = newTheme;
    };

    // Authenticate routing on viewMode change
    useEffect(() => {
        if (viewMode === 'super-admin' && !superAdminAuth) {
            setShowAuthModal('super-admin');
        } else if (viewMode === 'admin' && !adminAuth) {
            setShowAuthModal('admin');
        } else if (viewMode === 'stylist' && !stylistAuth) {
            setViewMode('landing');
        } else {
            setShowAuthModal(null);
        }
    }, [viewMode, stylistAuth, adminAuth, superAdminAuth]);

    const handleLoginSuccess = (role, staffMember) => {
        if (role === 'stylist') {
            sessionStorage.setItem('salon_stylist_auth', 'true');
            setStylistAuth(true);
            if (staffMember && staffMember.id) {
                localStorage.setItem('logged_in_stylist_id', staffMember.id.toString());
            }
            setViewMode('stylist');
        } else if (role === 'admin') {
            sessionStorage.setItem('salon_admin_auth', 'true');
            setAdminAuth(true);
            setViewMode('admin');
        } else if (role === 'super-admin') {
            sessionStorage.setItem('salon_superadmin_auth', 'true');
            setSuperAdminAuth(true);
            setViewMode('super-admin');
        }
        showToast("Logged in successfully.");
    };

    const handleAuthSuccess = (mode) => {
        if (mode === 'admin') {
            sessionStorage.setItem('salon_admin_auth', 'true');
            setAdminAuth(true);
        } else if (mode === 'super-admin') {
            sessionStorage.setItem('salon_superadmin_auth', 'true');
            setSuperAdminAuth(true);
        }
        setShowAuthModal(null);
    };

    const handleAuthCancel = () => {
        let targetPath = '/';
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        url.pathname = targetPath;
        window.history.replaceState({}, '', url.toString());

        setViewMode('landing');
        setShowAuthModal(null);
    };


    // Responsive layout states
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setMobileSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Multi-Agent processing loading screen states
    const [refinementRunning, setRefinementRunning] = useState(false);
    const [loadingTitle, setLoadingTitle] = useState("Running Multi-Agent Synthesis");
    const [loadingPhase, setLoadingPhase] = useState("");
    const [loadingQuote, setLoadingQuote] = useState("");

    // Sync viewMode changes to storage
    useEffect(() => {
        localStorage.setItem('salon_isAdmin', viewMode === 'admin');
    }, [viewMode]);

    // Load active client history logs when client ID changes
    const fetchHistory = async (clientId = activeClientId) => {
        if (!clientId) return;
        try {
            const res = await fetch(`${window.location.origin}/history?client_id=${clientId}`);
            if (res.ok) {
                const data = await res.json();
                setClientHistory(data.history || []);
            }
        } catch (err) {
            console.error("Failed to load client history log:", err);
        }
    };

    useEffect(() => {
        if (activeClientId) {
            fetchHistory(activeClientId);
        } else {
            setClientHistory([]);
        }
    }, [activeClientId]);

    // Run Gemini Multi-Agent Analysis
    const handleAnalyzePortrait = async () => {
        if (!capturedPhotos.front || !activeClientId) {
            showToast("Missing client portrait or selection.");
            return;
        }

        setLoadingTitle("Running Multi-Agent Synthesis");
        setRefinementRunning(true);

        const formData = new FormData();
        formData.append('file_front', capturedPhotos.front, 'front.jpg');
        formData.append('client_id', activeClientId);

        try {
            const response = await fetch(`${window.location.origin}/analyze`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Facial analysis failed: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Wait slightly for a premium loading effect transition
            setTimeout(async () => {
                setRefinementRunning(false);
                setActiveConsultationId(data.consultation_id);
                setCurrentRecommendationsData(data);
                
                setShowResults(true);
                setShowCapture(false);
                setShowOptions(false);
                
                showToast("Stylist recommendation report ready!");
                await fetchHistory(activeClientId);
            }, 1200);

        } catch (err) {
            console.error(err);
            setRefinementRunning(false);
            showToast("Consultation analysis failed: " + err.message);
        }
    };

    // Load past historical consultation details into workspace
    const loadPastConsultation = async (id) => {
        if (!activeClientId) return;
        try {
            const res = await fetch(`${window.location.origin}/history?client_id=${activeClientId}`);
            if (res.ok) {
                const data = await res.json();
                const matched = data.history.find(h => h.id === id);
                if (matched) {
                    const mockResponse = {
                        consultation_id: matched.id,
                        confirmed_style: matched.confirmed_style,
                        recommendations: matched.recommendations.recommendations.map(r => {
                            if (r.visualization_url && !r.visualization_url.startsWith('data') && !r.visualization_url.startsWith('http')) {
                                r.visualization_url = `${window.location.origin}/${r.visualization_url}`;
                            }
                            return r;
                        }),
                        analysis_details: matched.recommendations.analysis_details
                    };
                    
                    setActiveConsultationId(matched.id);
                    setCurrentRecommendationsData(mockResponse);
                    
                    setShowResults(true);
                    setShowCapture(false);
                    setShowOptions(false);
                    
                    showToast(`Loaded historical session #${matched.id}`);
                }
            }
        } catch (err) {
            console.error("Failed to load historical consultation:", err);
            showToast("Could not load past session details.");
        }
    };

    // Cycle agent logs and styling quotes during processing overlay
    useEffect(() => {
        let phaseIndex = 0;
        let logsTimer = null;
        let quotesTimer = null;

        if (refinementRunning) {
            setLoadingPhase(LOADING_PHASES[0]);
            setLoadingQuote(STYLING_QUOTES[Math.floor(Math.random() * STYLING_QUOTES.length)]);

            logsTimer = setInterval(() => {
                phaseIndex++;
                if (phaseIndex < LOADING_PHASES.length) {
                    setLoadingPhase(LOADING_PHASES[phaseIndex]);
                }
            }, 2500);

            quotesTimer = setInterval(() => {
                setLoadingQuote(STYLING_QUOTES[Math.floor(Math.random() * STYLING_QUOTES.length)]);
            }, 4500);
        }

        return () => {
            clearInterval(logsTimer);
            clearInterval(quotesTimer);
        };
    }, [refinementRunning]);

    // Handle switching client profiles via Directory or switch option
    const handleSwitchProfile = () => {
        setCheckInOpen(true);
    };

    if (viewMode === 'landing') {
        return (
            <div className="app-wrapper" style={{ minHeight: '100vh', height: 'auto', width: '100vw', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                <HeroLandingPage salonName={salonName} onLoginSuccess={handleLoginSuccess} />
                
                {toast.show && (
                    <div 
                        id="toastNotification" 
                        className="toast show"
                        style={{
                            position: 'fixed',
                            bottom: '30px',
                            right: '30px',
                            zIndex: 3000,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--accent-primary)',
                            color: 'var(--text-bright)',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(222, 184, 118, 0.15)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            animation: 'slideInUp 0.3s ease-out'
                        }}
                    >
                        <i className="fa-solid fa-info-circle" style={{ color: 'var(--accent-primary)' }}></i>
                        <span>{toast.message}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="app-wrapper" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            
            {/* Left Sidebar (Stylist Consultation mode only) */}
            {viewMode === 'stylist' && (
                <div className={`sidebar ${mobileSidebarOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    
                    {/* Active Concurrent Sessions list */}
                    <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch', borderBottom: '1px solid var(--glass-border)', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <h2 style={{ fontSize: '1rem', color: 'var(--accent-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <i className="fa-solid fa-users"></i> Active Clients
                            </h2>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setCheckInOpen(true)}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', cursor: 'pointer', background: 'transparent' }}
                            >
                                <i className="fa-solid fa-plus"></i> Check In
                            </button>
                        </div>
                        
                        <div id="activeSessionsList" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', marginTop: '10px' }}>
                            {activeSessions.length === 0 ? (
                                <div style={{ color: 'var(--text-main)', fontSize: '0.75rem', textAlign: 'center', padding: '10px' }}>
                                    No active sessions
                                </div>
                            ) : (
                                activeSessions.map((session, idx) => {
                                    const isActive = idx === currentSessionIndex;
                                    const initials = ((session.clientName?.[0] || '') + (session.clientName?.split(' ')[1]?.[0] || '')).toUpperCase();
                                    return (
                                        <div 
                                            key={idx}
                                            onClick={() => switchActiveSession(idx)}
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                background: isActive ? 'rgba(222, 184, 118, 0.1)' : 'rgba(255, 255, 255, 0.01)',
                                                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-secondary) 0%, var(--accent-primary) 100%)', color: '#07090e', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0 }}>
                                                    {initials}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-bright)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {session.clientName}
                                                    </span>
                                                    <span style={{ fontSize: '0.65rem', color: session.currentRecommendations ? '#5cd699' : 'var(--text-main)', opacity: 0.8 }}>
                                                        {session.currentRecommendations ? '✓ Styling ready' : 'Awaiting profiling'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    closeActiveSession(idx);
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6, padding: '2px' }}
                                                className="close-session-btn"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Client Consultation History */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContainer: 'space-between', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-main)', margin: 0 }}>
                                    Client History
                                </h2>
                                {currentSessionIndex >= 0 && (
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={() => closeActiveSession(currentSessionIndex)}
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                                        title="Close Current Session"
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                            
                            {activeClientId && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={handleSwitchProfile}
                                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700, border: '1px solid var(--accent-primary)', background: 'rgba(222, 184, 118, 0.05)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                                    >
                                        <i className="fa-solid fa-arrows-spin"></i> Switch Family Member
                                    </button>
                                    <button 
                                        className="btn" 
                                        onClick={() => setProfileDrawerOpen(true)}
                                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                                    >
                                        <i className="fa-solid fa-user-gear"></i> View Hair Profile Card
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* History Items list */}
                        <div className="history-list" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {clientHistory.length === 0 ? (
                                <div style={{ textParagraph: 'center', color: 'var(--text-main)', paddingTop: '40px', fontSize: '0.85rem', textAlign: 'center' }}>
                                    No past sessions found
                                </div>
                            ) : (
                                clientHistory.map(h => {
                                    const dateObj = new Date(h.created_at);
                                    const isCurrent = h.id === activeConsultationId;
                                    return (
                                        <div 
                                            key={h.id}
                                            onClick={() => loadPastConsultation(h.id)}
                                            style={{ 
                                                padding: '10px 12px', 
                                                background: isCurrent ? 'rgba(222, 184, 118, 0.05)' : 'rgba(255, 255, 255, 0.02)', 
                                                border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)', 
                                                borderRadius: '10px', 
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                transition: 'all 0.2s ease'
                                            }}
                                            className="history-item-card"
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-main)' }}>
                                                <span>📅 {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                {h.confirmed_style && (
                                                    <span style={{ color: '#56db95' }} title="Confirmed Styling choice">
                                                        <i className="fa-solid fa-circle-check"></i>
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                                                {h.confirmed_style || "Selected Hairstyle"}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Sidebar Backdrop Overlay */}
            {isMobile && viewMode === 'stylist' && mobileSidebarOpen && (
                <div 
                    onClick={() => setMobileSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.15)',
                        zIndex: 999,
                        backdropFilter: 'blur(2px)'
                    }}
                />
            )}

            {/* Main Content Pane */}
            <div className="workspace" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
                
                {/* Header */}
                <Header 
                    viewMode={viewMode} 
                    setViewMode={setViewMode}
                    currentTab={adminTab} 
                    setCurrentTab={setAdminTab} 
                    onAnalyzeClick={handleAnalyzePortrait}
                    isAnalyzeDisabled={!capturedPhotos.front || refinementRunning}
                    isMobile={isMobile}
                    mobileSidebarOpen={mobileSidebarOpen}
                    setMobileSidebarOpen={setMobileSidebarOpen}
                    onOpenProfileDrawer={() => setProfileDrawerOpen(true)}
                    salonName={salonName}
                    onLogout={handleLogout}
                />

                {/* Sub-viewport workspace body */}
                <div style={{ flex: 1, padding: isMobile ? '12px' : '30px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                    
                    {/* View mode 1: Stylist Consultation viewport */}
                    {viewMode === 'stylist' && (
                        <div style={{ height: '100%' }}>
                            {showOptions && <OptionsPanel />}
                            {showCapture && <CameraCapture />}
                            {showResults && (
                                <RecommendationsCarousel 
                                    onRefineStart={() => {
                                        setLoadingTitle("Refining Recommendations");
                                        setRefinementRunning(true);
                                    }}
                                    onRefineEnd={() => {
                                        setRefinementRunning(false);
                                    }}
                                />
                            )}
                            
                            {/* Empty state: No client checked in at all */}
                            {!showOptions && !showCapture && !showResults && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', color: 'var(--text-main)', textAlign: 'center', gap: '16px' }}>
                                    <i className="fa-solid fa-scissors" style={{ fontSize: '4rem', color: 'var(--glass-border)' }}></i>
                                    <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-bright)', margin: 0 }}>
                                        Ready for consultation
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '340px', lineHeight: '1.6' }}>
                                        Click "+ Check In" in the left sidebar to enter a client phone number and start AI-powered styling recommendations.
                                    </p>
                                    <button className="btn" onClick={() => setCheckInOpen(true)} style={{ marginTop: '10px' }}>
                                        Check In Client
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* View mode 2: Administrative Console viewport */}
                    {viewMode === 'admin' && (
                        <div style={{ height: '100%' }}>
                            {adminTab === 'crm' ? (
                                <div className="crm-panel-grid" style={{ height: '100%' }}>
                                    <ClientDirectory 
                                        selectedClientId={selectedCrmClientId}
                                        onSelectClient={setSelectedCrmClientId}
                                    />
                                    <ClientProfileDetail 
                                        clientId={selectedCrmClientId}
                                        onProfileUpdate={() => {
                                            // Trigger profile details re-fetch
                                            const temp = selectedCrmClientId;
                                            setSelectedCrmClientId(null);
                                            setTimeout(() => setSelectedCrmClientId(temp), 50);
                                        }}
                                    />
                                </div>
                            ) : (
                                <InventoryControl 
                                    onAlertCountChange={(count) => {
                                        setAlertsCount(count);
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {/* View mode 3: Super Admin Console viewport */}
                    {viewMode === 'super-admin' && (
                        <div style={{ height: '100%' }}>
                            <SuperAdminConsole onConfigUpdate={handleConfigUpdate} />
                        </div>
                    )}
                </div>
            </div>

            {/* Check-In Modal overlay */}
            <CheckInOverlay viewMode={viewMode} />

            {/* Checkout Billing Modal overlay */}
            <CheckoutModal />

            {/* Feedback Review Modal overlay */}
            <FeedbackOverlay />

            {/* Toast Notification HUD */}
            {toast.show && (
                <div 
                    id="toastNotification" 
                    className="toast show"
                    style={{
                        position: 'fixed',
                        bottom: '30px',
                        right: '30px',
                        zIndex: 3000,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--text-bright)',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(222, 184, 118, 0.15)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        animation: 'slideInUp 0.3s ease-out'
                    }}
                >
                    <i className="fa-solid fa-info-circle" style={{ color: 'var(--accent-primary)' }}></i>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Multi-Agent Analysis Processing Overlay */}
            {refinementRunning && (
                <div 
                    className="loading-overlay show" 
                    id="loadingOverlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100vh',
                        background: 'rgba(250, 249, 246, 0.88)',
                        backdropFilter: 'blur(12px)',
                        zIndex: 4000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div 
                        className="checkin-card textured-element" 
                        style={{ 
                            maxWidth: '450px', 
                            textAlign: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '20px', 
                            padding: '30px', 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: '20px',
                            background: 'var(--glass-bg)' 
                        }}
                    >
                        <h2 
                            id="loadingTitle" 
                            style={{ 
                                fontFamily: "'Outfit', sans-serif", 
                                fontSize: '1.5rem', 
                                fontWeight: 800, 
                                color: 'var(--accent-primary)', 
                                margin: 0 
                            }}
                        >
                            {loadingTitle}
                        </h2>
                        
                        {/* Spinning loader */}
                        <div className="loader-container" style={{ margin: '15px 0' }}>
                            <div className="double-bounce1" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', opacity: 0.6, position: 'absolute', left: '50%', transform: 'translateX(-50%)', animation: 'bounce 2.0s infinite ease-in-out' }}></div>
                            <div className="double-bounce2" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-secondary)', opacity: 0.6, position: 'absolute', left: '50%', transform: 'translateX(-50%)', animation: 'bounce 2.0s infinite ease-in-out', animationDelay: '-1.0s' }}></div>
                            <div style={{ height: '40px' }}></div>
                        </div>

                        {/* Simulated Agent logs */}
                        <div 
                            id="loadingStatusText" 
                            style={{ 
                                color: 'var(--text-bright)', 
                                fontSize: '0.85rem', 
                                minHeight: '40px',
                                fontFamily: 'monospace',
                                background: 'rgba(0,0,0,0.04)',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid var(--glass-border)',
                                lineHeight: '1.4'
                            }}
                        >
                            {loadingPhase}
                        </div>

                        {/* Random Quote */}
                        <p 
                            id="loadingQuoteText" 
                            style={{ 
                                color: 'var(--text-main)', 
                                fontStyle: 'italic', 
                                fontSize: '0.8rem', 
                                margin: '5px 0 0 0',
                                transition: 'opacity 0.3s ease',
                                minHeight: '38px',
                                lineHeight: '1.4' 
                            }}
                        >
                            {loadingQuote}
                        </p>
                    </div>
                </div>
            )}

            {/* Client Profile Drawer slide-out */}
            <ClientProfileDrawer 
                isOpen={profileDrawerOpen}
                onClose={() => setProfileDrawerOpen(false)}
                clientId={activeClientId}
            />

            {/* Passcode Authentication Login dialog overlay */}
            {showAuthModal && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(7, 9, 14, 0.95)',
                        backdropFilter: 'blur(20px)',
                        zIndex: 5000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div 
                        className="checkin-card textured-element"
                        style={{
                            width: '90%',
                            maxWidth: '400px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '24px',
                            padding: '30px',
                            boxShadow: '0 20px 40px rgba(176, 142, 81, 0.15)',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            maxHeight: '85vh',
                            overflowY: 'auto'
                        }}
                    >
                        <i className="fa-solid fa-lock" style={{ fontSize: '3rem', color: 'var(--accent-primary)', marginBottom: '10px' }}></i>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-bright)', margin: 0 }}>
                            {showAuthModal === 'super-admin' ? "Super Admin Portal" : "Administrative Portal"}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>
                            Please enter the {showAuthModal === 'super-admin' ? "Owner" : "Admin"} passcode to continue.
                        </p>
                        
                        <form 
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setAuthError("");
                                const isSuper = showAuthModal === 'super-admin';
                                const role = isSuper ? 'super-admin' : 'admin';
                                const payload = {
                                    role: role,
                                    passcode: passcodeInput.trim()
                                };
                                if (role === 'admin' && passcodeInput.trim() !== 'admin123') {
                                    const activeStylistId = localStorage.getItem('logged_in_stylist_id');
                                    if (activeStylistId) {
                                        payload.staff_id = parseInt(activeStylistId);
                                    }
                                }
                                
                                try {
                                    const res = await fetch(`${window.location.origin}/api/auth/login`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                    });
                                    const data = await res.json();
                                    if (res.ok && data.success) {
                                        handleAuthSuccess(showAuthModal);
                                        setPasscodeInput("");
                                        setAuthError("");
                                    } else {
                                        setAuthError(data.detail || "Incorrect passcode. Please try again.");
                                    }
                                } catch (err) {
                                    setAuthError("Network error. Please try again.");
                                }
                            }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                        >
                            <input 
                                type="password"
                                value={passcodeInput}
                                onChange={(e) => setPasscodeInput(e.target.value)}
                                placeholder="Enter Passcode"
                                required
                                autoFocus
                                style={{ 
                                    width: '100%', 
                                    padding: '12px 16px', 
                                    background: 'rgba(255, 255, 255, 0.4)', 
                                    border: '1px solid var(--glass-border)', 
                                    borderRadius: '12px', 
                                    color: 'var(--text-bright)', 
                                    fontSize: '0.95rem', 
                                    outline: 'none',
                                    textAlign: 'center',
                                    boxSizing: 'border-box'
                                }}
                            />
                            {authError && (
                                <span style={{ fontSize: '0.75rem', color: '#ff6b6b', fontWeight: 600 }}>
                                    {authError}
                                </span>
                            )}
                            
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={handleAuthCancel}
                                    style={{ flex: 1, height: '42px', borderRadius: '8px' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn"
                                    style={{ flex: 1, height: '42px', borderRadius: '8px' }}
                                >
                                    Authenticate
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const App = () => {
    return (
        <SessionProvider>
            <AppContent />
        </SessionProvider>
    );
};

export default App;
