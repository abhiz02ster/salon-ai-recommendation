import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';

const Header = ({ 
    viewMode, 
    setViewMode, 
    currentTab, 
    setCurrentTab, 
    onAnalyzeClick, 
    isAnalyzeDisabled,
    isMobile,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    onOpenProfileDrawer,
    salonName = "Master Stylist Salon",
    onLogout
}) => {
    const { 
        clientName, 
        activeConsultationId,
        showResults
    } = useSession();

    const [staffList, setStaffList] = useState([]);
    const [selectedStaffId, setSelectedStaffId] = useState(() => {
        return localStorage.getItem('logged_in_stylist_id') || "";
    });

    useEffect(() => {
        if (viewMode === 'stylist') {
            const fetchStaff = async () => {
                try {
                    const res = await fetch(`${window.location.origin}/api/staff`);
                    if (res.ok) {
                        const data = await res.json();
                        const activeStaff = data.staff || [];
                        setStaffList(activeStaff);
                        
                        if (!localStorage.getItem('logged_in_stylist_id') && activeStaff.length > 0) {
                            const defaultId = activeStaff[0].id;
                            setSelectedStaffId(defaultId.toString());
                            localStorage.setItem('logged_in_stylist_id', defaultId.toString());
                        }
                    }
                } catch (err) {
                    console.error("Failed to load staff list in Header", err);
                }
            };
            fetchStaff();
        }
    }, [viewMode]);

    const handleStaffChange = (e) => {
        const id = e.target.value;
        setSelectedStaffId(id);
        localStorage.setItem('logged_in_stylist_id', id);
    };

    const isConsoleMode = viewMode === 'admin' || viewMode === 'super-admin';

    return (
        <header className="textured-element main-header">
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {isMobile && !isConsoleMode && (
                    <button 
                        onClick={() => setMobileSidebarOpen(prev => !prev)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-bright)',
                            fontSize: '1.25rem',
                            cursor: 'pointer',
                            marginRight: '12px',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="Toggle Sidebar Menu"
                    >
                        <i className="fa-solid fa-bars"></i>
                    </button>
                )}
                <div>
                    <h1>
                        {viewMode === 'super-admin' 
                            ? "Super Admin Portal" 
                            : viewMode === 'admin' 
                                ? `${salonName} Admin Portal` 
                                : `${salonName} Style Consultant`}
                    </h1>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: 0 }}>
                        {viewMode === 'super-admin' ? (
                            <>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Owner Dashboard</span>
                                <span style={{ color: 'var(--glass-border)' }}>|</span>
                                <span>Stylist Workload, Marketing Campaigns & Salon Settings</span>
                            </>
                        ) : viewMode === 'admin' ? (
                            <>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>System Console</span>
                                <span style={{ color: 'var(--glass-border)' }}>|</span>
                                <span>Stylist CRM & Warehouse Inventory Control Console</span>
                            </>
                        ) : (
                            <>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    {clientName ? `Client: ${clientName}` : "No Client Checked In"}
                                </span>
                                {clientName && (
                                    <button
                                        onClick={onOpenProfileDrawer}
                                        style={{
                                            background: 'rgba(222, 184, 118, 0.1)',
                                            border: '1px solid var(--accent-primary)',
                                            color: 'var(--accent-primary)',
                                            borderRadius: '6px',
                                            padding: '2px 8px',
                                            fontSize: '0.7rem',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontWeight: 700,
                                            marginLeft: '4px',
                                            outline: 'none'
                                        }}
                                    >
                                        <i className="fa-solid fa-user-gear"></i> Profile Card
                                    </button>
                                )}
                                <span style={{ color: 'var(--glass-border)' }}>|</span>
                                <span>
                                    {showResults && activeConsultationId ? `Active Session: #${activeConsultationId}` : "iPad & Tablet Professional Style Consultant"}
                                </span>
                            </>
                        )}
                    </p>
                </div>
            </div>

            {/* Navigation Tabs (Admin Mode Only / Client Mode Switcher) */}
            <div className="main-header-nav" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                {viewMode === 'admin' ? (
                    <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.4)', padding: '4px', borderRadius: '14px', border: '1px solid var(--glass-border)', gap: '4px' }}>
                        <button 
                            className="btn" 
                            onClick={() => setCurrentTab('crm')} 
                            style={{ 
                                padding: '8px 16px', 
                                fontSize: '0.8rem', 
                                background: currentTab === 'crm' ? 'var(--accent-primary)' : 'transparent', 
                                color: currentTab === 'crm' ? 'var(--bg-primary)' : 'var(--text-bright)', 
                                boxShadow: 'none', 
                                borderRadius: '10px' 
                            }}
                        >
                            <i className="fa-solid fa-users" style={{ marginRight: '6px' }}></i> Clients CRM
                        </button>
                        <button 
                            className="btn" 
                            onClick={() => setCurrentTab('inventory')} 
                            style={{ 
                                padding: '8px 16px', 
                                fontSize: '0.8rem', 
                                background: currentTab === 'inventory' ? 'var(--accent-primary)' : 'transparent', 
                                color: currentTab === 'inventory' ? 'var(--bg-primary)' : 'var(--text-bright)', 
                                boxShadow: 'none', 
                                borderRadius: '10px' 
                            }}
                        >
                            <i className="fa-solid fa-boxes-stacked" style={{ marginRight: '6px' }}></i> Inventory Control
                        </button>
                    </div>
                ) : viewMode === 'stylist' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {staffList.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>Stylist:</span>
                                <select
                                    value={selectedStaffId}
                                    onChange={handleStaffChange}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--glass-border)',
                                        color: 'var(--text-bright)',
                                        background: 'rgba(255,255,255,0.05)',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    {staffList.map(st => (
                                        <option key={st.id} value={st.id} style={{ color: '#000' }}>
                                            {st.first_name} {st.last_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.4)', padding: '6px 16px', borderRadius: '14px', border: '1px solid var(--glass-border)', gap: '8px', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700, alignItems: 'center' }}>
                            <i className="fa-solid fa-user-circle"></i>
                            <span>Consultation Mode</span>
                        </div>
                    </div>
                ) : null}

                {/* Viewport switcher toggle */}
                <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                        if (isConsoleMode) {
                            setViewMode('stylist');
                        } else {
                            setViewMode('admin');
                        }
                    }}
                    style={{ 
                        padding: '6px 12px', 
                        fontSize: '0.8rem', 
                        borderRadius: '8px', 
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-bright)',
                        background: 'rgba(255,255,255,0.02)',
                        cursor: 'pointer'
                    }}
                >
                    <i className={isConsoleMode ? "fa-solid fa-scissors" : "fa-solid fa-desktop"} style={{ marginRight: '6px' }}></i>
                    {isConsoleMode ? "Stylist Console" : "Admin Portal"}
                </button>

                {/* Logout Button */}
                <button 
                    className="btn btn-secondary" 
                    onClick={onLogout}
                    style={{ 
                        padding: '6px 12px', 
                        fontSize: '0.8rem', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(255, 107, 107, 0.3)',
                        color: '#ff6b6b',
                        background: 'rgba(255, 107, 107, 0.05)',
                        cursor: 'pointer'
                    }}
                >
                    <i className="fa-solid fa-right-from-bracket" style={{ marginRight: '6px' }}></i>
                    Sign Out
                </button>

                {/* Contextual Action Button (Client Mode Only) */}
                {viewMode === 'stylist' && !showResults && (
                    <button 
                        className="btn" 
                        id="analyzeBtn" 
                        onClick={onAnalyzeClick} 
                        disabled={isAnalyzeDisabled}
                    >
                        <span>Analyze Portrait</span>
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
