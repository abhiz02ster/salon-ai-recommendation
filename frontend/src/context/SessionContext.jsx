import React, { createContext, useContext, useState, useEffect } from 'react';

const SessionContext = createContext();


export const SessionProvider = ({ children }) => {
    // Active sessions & session navigation
    const [activeSessions, setActiveSessions] = useState([]);
    const [currentSessionIndex, setCurrentSessionIndex] = useState(-1);
    
    // Active workspace state variables
    const [activeClientId, setActiveClientId] = useState(null);
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [activeConsultationId, setActiveConsultationId] = useState(null);
    const [capturedPhotos, setCapturedPhotos] = useState({ front: null });
    const [currentRecommendationsData, setCurrentRecommendationsData] = useState(null);
    const [clientHistory, setClientHistory] = useState([]);
    
    // View state
    const [showResults, setShowResults] = useState(false);
    const [showCapture, setShowCapture] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    
    // Global UI controllers
    const [checkInOpen, setCheckInOpen] = useState(false);
    const [checkoutData, setCheckoutData] = useState(null);
    const [toast, setToast] = useState({ show: false, message: "" });

    // Load active sessions from localStorage on mount
    useEffect(() => {
        const storedSessions = localStorage.getItem('salon_active_sessions');
        const storedIndex = localStorage.getItem('salon_current_session_index');

        if (storedSessions) {
            try {
                let parsed = JSON.parse(storedSessions);
                // Filter out any corrupted sessions with missing/null/undefined clientIds
                parsed = parsed.filter(s => s && s.clientId !== undefined && s.clientId !== null && !isNaN(Number(s.clientId)));
                
                setActiveSessions(parsed);
                localStorage.setItem('salon_active_sessions', JSON.stringify(parsed));

                const idx = storedIndex !== null ? parseInt(storedIndex) : -1;
                if (parsed.length > 0 && idx >= 0 && idx < parsed.length) {
                    setCurrentSessionIndex(idx);
                } else {
                    setCheckInOpen(true);
                }
            } catch (e) {
                console.error("Failed to parse stored sessions", e);
                setCheckInOpen(true);
            }
        } else {
            setCheckInOpen(true);
        }
    }, []);

    // Helper: Trigger a brief toast notification
    const showToast = (message) => {
        setToast({ show: true, message });
    };

    // Clear toast automatically
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => {
                setToast({ show: false, message: "" });
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    // Save session workspace state into the active sessions list in storage
    const saveSessionState = (sessionsList, currentIndex) => {
        if (currentIndex >= 0 && currentIndex < sessionsList.length) {
            const updated = [...sessionsList];
            updated[currentIndex] = {
                ...updated[currentIndex],
                activeConsultationId,
                capturedPhotos,
                currentRecommendations: currentRecommendationsData,
                history: clientHistory,
                workspaceState: {
                    showResults,
                    showCapture,
                    showOptions
                }
            };
            setActiveSessions(updated);
            localStorage.setItem('salon_active_sessions', JSON.stringify(updated));
            localStorage.setItem('salon_current_session_index', currentIndex);
        }
    };

    // Load a session's workspace details into active state
    const loadSessionWorkspace = (index, sessionsList = activeSessions) => {
        if (index < 0 || index >= sessionsList.length) return;
        
        setCurrentSessionIndex(index);
        localStorage.setItem('salon_current_session_index', index);
        
        const session = sessionsList[index];
        setActiveClientId(session.clientId);
        setClientName(session.clientName);
        setClientPhone(session.clientPhone);
        setActiveConsultationId(session.activeConsultationId);
        setCapturedPhotos(session.capturedPhotos || { front: null });
        setCurrentRecommendationsData(session.currentRecommendations || null);
        setClientHistory(session.history || []);
        
        const state = session.workspaceState;
        const res = state?.showResults || false;
        const cap = state?.showCapture || false;
        const opt = state ? state.showOptions : (!res && !cap);
        
        setShowResults(res);
        setShowCapture(cap);
        setShowOptions(opt);
    };

    // Switch focus between concurrent checked-in sessions
    const switchActiveSession = (index) => {
        // First save current session state
        if (currentSessionIndex >= 0 && currentSessionIndex < activeSessions.length) {
            const updated = [...activeSessions];
            updated[currentSessionIndex] = {
                ...updated[currentSessionIndex],
                activeConsultationId,
                capturedPhotos,
                currentRecommendations: currentRecommendationsData,
                history: clientHistory,
                workspaceState: {
                    showResults,
                    showCapture,
                    showOptions
                }
            };
            setActiveSessions(updated);
            localStorage.setItem('salon_active_sessions', JSON.stringify(updated));
            loadSessionWorkspace(index, updated);
        } else {
            loadSessionWorkspace(index);
        }
    };

    // Check in a client: adds a session and focus-loads it
    const registerCheckInSession = (clientData, resumeLastSession = false) => {
        const clientId = clientData.client_id || clientData.id;
        
        // Sync check-in state to complete scheduled appointments within the 2-hour window
        if (clientId) {
            fetch(`${window.location.origin}/api/crm/clients/${clientId}/check-in`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.auto_completed_appointments && data.auto_completed_appointments.length > 0) {
                        console.log(`✓ Automatically completed appointments on check-in: ${data.auto_completed_appointments}`);
                        showToast("Upcoming booking checked-in and resolved.");
                    }
                })
                .catch(err => console.error("Failed to sync check-in status:", err));
        }

        let existingIndex = activeSessions.findIndex(s => s.clientId === clientId);
        let updatedSessions = [...activeSessions];
        let targetIndex = -1;

        // 1. Create or resolve the target session structure
        if (existingIndex === -1) {
            const newSession = {
                clientId: clientId,
                clientName: `${clientData.first_name} ${clientData.last_name}`,
                clientPhone: clientData.phone,
                history: clientData.history || [],
                activeConsultationId: null,
                capturedPhotos: { front: null },
                currentRecommendations: null,
                workspaceState: {
                    showResults: false,
                    showCapture: false,
                    showOptions: true
                }
            };
            updatedSessions.push(newSession);
            targetIndex = updatedSessions.length - 1;
        } else {
            targetIndex = existingIndex;
            // Merge database history to ensure it's up to date
            updatedSessions[targetIndex].history = clientData.history || updatedSessions[targetIndex].history || [];
        }

        // 2. Save current session before loading the new one (only if switching to a different session)
        if (currentSessionIndex >= 0 && currentSessionIndex < activeSessions.length && currentSessionIndex !== targetIndex) {
            updatedSessions[currentSessionIndex] = {
                ...updatedSessions[currentSessionIndex],
                activeConsultationId,
                capturedPhotos,
                currentRecommendations: currentRecommendationsData,
                history: clientHistory,
                workspaceState: {
                    showResults,
                    showCapture,
                    showOptions
                }
            };
        }

        // 3. Update target session state immediately in the activeSessions array based on resume choice
        const targetSession = updatedSessions[targetIndex];
        if (resumeLastSession && targetSession.history && targetSession.history.length > 0) {
            const lastSession = targetSession.history[0];
            
            // Format and load recommendations from the historical item
            const formattedRecs = {
                consultation_id: lastSession.id,
                confirmed_style: lastSession.confirmed_style,
                recommendations: (lastSession.recommendations?.recommendations || []).map(r => {
                    if (r.visualization_url && !r.visualization_url.startsWith('data') && !r.visualization_url.startsWith('http')) {
                        r.visualization_url = `${window.location.origin}/${r.visualization_url}`;
                    }
                    return r;
                }),
                analysis_details: lastSession.recommendations?.analysis_details || {}
            };

            updatedSessions[targetIndex] = {
                ...targetSession,
                activeConsultationId: lastSession.id,
                capturedPhotos: lastSession.photos || { front: null },
                currentRecommendations: formattedRecs,
                workspaceState: {
                    showResults: true,
                    showCapture: false,
                    showOptions: false
                }
            };

            // Update active states
            setActiveClientId(clientId);
            setClientName(targetSession.clientName);
            setClientPhone(targetSession.clientPhone);
            setClientHistory(targetSession.history);
            
            setActiveConsultationId(lastSession.id);
            setCapturedPhotos(lastSession.photos || { front: null });
            setCurrentRecommendationsData(formattedRecs);
            setShowResults(true);
            setShowCapture(false);
            setShowOptions(false);
        } else {
            // Start new session
            updatedSessions[targetIndex] = {
                ...targetSession,
                activeConsultationId: null,
                capturedPhotos: { front: null },
                currentRecommendations: null,
                workspaceState: {
                    showResults: false,
                    showCapture: false,
                    showOptions: true
                }
            };

            // Update active states
            setActiveClientId(clientId);
            setClientName(targetSession.clientName);
            setClientPhone(targetSession.clientPhone);
            setClientHistory(targetSession.history);
            
            setCapturedPhotos({ front: null });
            setActiveConsultationId(null);
            setCurrentRecommendationsData(null);
            setShowResults(false);
            setShowCapture(false);
            setShowOptions(true);
        }

        // 4. Save to state and localStorage
        setActiveSessions(updatedSessions);
        localStorage.setItem('salon_active_sessions', JSON.stringify(updatedSessions));
        setCurrentSessionIndex(targetIndex);
        localStorage.setItem('salon_current_session_index', targetIndex);
        
        // Hide check-in modal overlay
        setCheckInOpen(false);
    };

    // Close and remove an active session
    const closeActiveSession = (index) => {
        const filtered = activeSessions.filter((_, idx) => idx !== index);
        setActiveSessions(filtered);
        localStorage.setItem('salon_active_sessions', JSON.stringify(filtered));
        
        if (filtered.length === 0) {
            setCurrentSessionIndex(-1);
            localStorage.setItem('salon_current_session_index', -1);
            
            // Reset active states
            setActiveClientId(null);
            setClientName("");
            setClientPhone("");
            setCapturedPhotos({ front: null });
            setCurrentRecommendationsData(null);
            setClientHistory([]);
            setShowResults(false);
            setShowCapture(false);
            setShowOptions(false);
            setCheckInOpen(true);
        } else {
            // Focus on next available session
            let nextIndex = index === 0 ? 0 : index - 1;
            loadSessionWorkspace(nextIndex, filtered);
        }
    };

    return (
        <SessionContext.Provider value={{
            activeSessions,
            currentSessionIndex,
            activeClientId,
            clientName,
            clientPhone,
            activeConsultationId,
            capturedPhotos,
            currentRecommendationsData,
            clientHistory,
            showResults,
            showCapture,
            showOptions,
            checkInOpen,
            toast,
            checkoutData,
            setToast,
            setCapturedPhotos,
            setCurrentRecommendationsData,
            setActiveConsultationId,
            setClientHistory,
            setShowResults,
            setShowCapture,
            setShowOptions,
            setCheckInOpen,
            setCheckoutData,
            showToast,
            saveCurrentSessionState: () => saveSessionState(activeSessions, currentSessionIndex),
            switchActiveSession,
            registerCheckInSession,
            closeActiveSession
        }}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => useContext(SessionContext);
