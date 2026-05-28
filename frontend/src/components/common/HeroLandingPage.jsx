import React, { useState, useEffect } from 'react';

const HeroLandingPage = ({ salonName, onLoginSuccess }) => {
    const [services, setServices] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loadingServices, setLoadingServices] = useState(true);
    
    // Login Modal States
    const [loginRole, setLoginRole] = useState(null); // null | 'stylist' | 'admin' | 'super-admin'
    const [selectedStaffId, setSelectedStaffId] = useState("");
    const [passcode, setPasscode] = useState("");
    const [authError, setAuthError] = useState("");
    const [authenticating, setAuthenticating] = useState(false);
    const [adminOverride, setAdminOverride] = useState(false);

    useEffect(() => {
        // Fetch services list
        const fetchServices = async () => {
            try {
                const res = await fetch(`${window.location.origin}/api/services`);
                if (res.ok) {
                    const data = await res.json();
                    setServices(data.services || []);
                }
            } catch (err) {
                console.error("Failed to load services on landing page", err);
            } finally {
                setLoadingServices(false);
            }
        };

        // Fetch staff list
        const fetchStaff = async () => {
            try {
                const res = await fetch(`${window.location.origin}/api/staff`);
                if (res.ok) {
                    const data = await res.json();
                    const list = data.staff || [];
                    setStaffList(list);
                    if (list.length > 0) {
                        setSelectedStaffId(list[0].id.toString());
                    }
                }
            } catch (err) {
                console.error("Failed to load staff on landing page", err);
            }
        };

        fetchServices();
        fetchStaff();
    }, []);

    const getServiceIcon = (category) => {
        switch (category?.toLowerCase()) {
            case 'color': return 'fa-palette';
            case 'styling':
            case 'haircut': return 'fa-scissors';
            case 'treatment': return 'fa-spa';
            case 'grooming': return 'fa-user-tie';
            default: return 'fa-sparkles';
        }
    };

    const handleOpenLogin = (role) => {
        setLoginRole(role);
        setPasscode("");
        setAuthError("");
        setAdminOverride(role === 'admin' ? false : false);
        if (staffList.length > 0) {
            setSelectedStaffId(staffList[0].id.toString());
        }
    };

    const handleCloseLogin = () => {
        setLoginRole(null);
        setPasscode("");
        setAuthError("");
        setAdminOverride(false);
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setAuthError("");
        setAuthenticating(true);

        const payload = {
            role: loginRole,
            passcode: passcode.trim()
        };

        if (loginRole === 'stylist') {
            payload.staff_id = parseInt(selectedStaffId);
        } else if (loginRole === 'admin') {
            if (!adminOverride) {
                payload.staff_id = parseInt(selectedStaffId);
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
                // Successful login
                handleCloseLogin();
                if (onLoginSuccess) {
                    onLoginSuccess(loginRole, data.staff || null);
                }
            } else {
                setAuthError(data.detail || "Authentication failed. Incorrect passcode.");
            }
        } catch (err) {
            console.error("Login request error", err);
            setAuthError("Network error. Please try again.");
        } finally {
            setAuthenticating(false);
        }
    };

    return (
        <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '40px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '50px',
            minHeight: '100vh',
            boxSizing: 'border-box'
        }}>
            {/* HERO SECTION - SPLIT GRID */}
            <div className="hero-editorial-container">
                <div className="hero-editorial-left">
                    <div className="editorial-tag">
                        <div className="editorial-tag-dot"></div>
                        <span className="editorial-tag-text font-sans">Premium AI-Guided Hair Suite</span>
                    </div>
                    
                    <h1 className="editorial-title">
                        {salonName}
                        <span>Editorial Edition</span>
                    </h1>
                    
                    <p className="editorial-desc">
                        Welcome to the next generation of hair styling. Our collaborating AI agents analyze your face structure, hair profile, and lifestyle to synthesize recommendations designed uniquely for you.
                    </p>
                </div>
                
                <div className="hero-editorial-right">
                    <img 
                        src="/salon_hero.png" 
                        alt="Premium Luxury Salon Interior" 
                        className="hero-editorial-image"
                    />
                    <div className="hero-image-overlay">
                        <h4>Artisanal Spaces</h4>
                        <p>Experience precision styling guided by advanced facial topology recommendations.</p>
                    </div>
                </div>
            </div>

            {/* PORTAL ENTRIES CARDS */}
            <div>
                <div className="editorial-section-header">
                    <span className="editorial-section-subtitle">Workstations</span>
                    <h2 className="editorial-section-title">Access Portals</h2>
                </div>
                
                <div className="editorial-portals-grid">
                    {/* STYLIST PORTAL ENTRY */}
                    <div 
                        onClick={() => handleOpenLogin('stylist')}
                        className="editorial-portal-card textured-element"
                    >
                        <div className="editorial-portal-icon">
                            <i className="fa-solid fa-scissors"></i>
                        </div>
                        <h3 className="editorial-portal-title">
                            Stylist Consultation Portal
                        </h3>
                        <p className="editorial-portal-desc">
                            Begin client styling sessions, capture face portraits, run AI analysis agents, and manage client timeline color formula profiles.
                        </p>
                        <span className="editorial-portal-link">
                            Open Stylist Console <i className="fa-solid fa-arrow-right"></i>
                        </span>
                    </div>

                    {/* ADMIN PORTAL ENTRY */}
                    <div 
                        onClick={() => handleOpenLogin('admin')}
                        className="editorial-portal-card textured-element"
                    >
                        <div className="editorial-portal-icon">
                            <i className="fa-solid fa-desktop"></i>
                        </div>
                        <h3 className="editorial-portal-title">
                            Administrative System Portal
                        </h3>
                        <p className="editorial-portal-desc">
                            Review client directory records, monitor stylist notes and timeline formula edits, and manage warehouse stock product inventory.
                        </p>
                        <span className="editorial-portal-link">
                            Open Admin Console <i className="fa-solid fa-arrow-right"></i>
                        </span>
                    </div>

                    {/* SUPER ADMIN PORTAL ENTRY */}
                    <div 
                        onClick={() => handleOpenLogin('super-admin')}
                        className="editorial-portal-card textured-element"
                    >
                        <div className="editorial-portal-icon">
                            <i className="fa-solid fa-crown"></i>
                        </div>
                        <h3 className="editorial-portal-title">
                            Owner Configuration Portal
                        </h3>
                        <p className="editorial-portal-desc">
                            Configure theme styling, customize branding overrides, review stylist revenue performance, and dispatch promotion campaigns.
                        </p>
                        <span className="editorial-portal-link">
                            Open Owner Console <i className="fa-solid fa-arrow-right"></i>
                        </span>
                    </div>
                </div>
            </div>

            {/* SERVICES OFFERED LIST */}
            <div className="editorial-services-section">
                <div className="editorial-section-header">
                    <span className="editorial-section-subtitle">Menu</span>
                    <h2 className="editorial-section-title">Services We Offer</h2>
                </div>

                {loadingServices ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '0.9rem' }}>Loading services menu...</div>
                ) : services.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '0.9rem' }}>No active services registered.</div>
                ) : (
                    <div className="editorial-services-grid">
                        {services.map(svc => (
                            <div 
                                key={svc.id}
                                className="editorial-service-card"
                            >
                                <div className="editorial-service-header">
                                    <div className="editorial-service-icon">
                                        <i className={`fa-solid ${getServiceIcon(svc.category)}`}></i>
                                    </div>
                                    <span className="editorial-service-price">
                                        INR {svc.base_price}
                                    </span>
                                </div>
                                <h4 className="editorial-service-title">
                                    {svc.name}
                                </h4>
                                <p className="editorial-service-desc">
                                    {svc.description || "Premium salon treatment customized to your style preferences."}
                                </p>
                                <span className="editorial-service-duration">
                                    <i className="fa-regular fa-clock"></i> Duration: {svc.duration_minutes} mins
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PASSCODE LOGIN OVERLAY MODAL */}
            {loginRole && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(7, 9, 14, 0.95)',
                    backdropFilter: 'blur(20px)',
                    zIndex: 5000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div className="checkin-card textured-element" style={{
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
                    }}>
                        <i className="fa-solid fa-lock" style={{ fontSize: '3rem', color: 'var(--accent-primary)', marginBottom: '10px' }}></i>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-bright)', margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                            {loginRole === 'super-admin' ? "Owner Portal" : loginRole === 'admin' ? "Admin Portal" : "Stylist Portal"} Login
                        </h2>
                        
                        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                            {/* Stylist Selector */}
                            {loginRole === 'stylist' && staffList.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>Select Your Stylist Name</label>
                                    <select
                                        value={selectedStaffId}
                                        onChange={(e) => setSelectedStaffId(e.target.value)}
                                        style={{
                                            padding: '12px',
                                            background: 'rgba(255, 255, 255, 0.4)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '12px',
                                            color: 'var(--text-bright)',
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {staffList.map(st => (
                                            <option key={st.id} value={st.id} style={{ color: '#000' }}>
                                                {st.first_name} {st.last_name} ({st.specialty})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Admin Selector & Override Checkbox */}
                            {loginRole === 'admin' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input 
                                            type="checkbox"
                                            id="adminOverrideChk"
                                            checked={adminOverride}
                                            onChange={(e) => {
                                                setAdminOverride(e.target.checked);
                                                setPasscode("");
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <label htmlFor="adminOverrideChk" style={{ fontSize: '0.8rem', color: 'var(--text-bright)', cursor: 'pointer', fontWeight: 600 }}>
                                            System Administrator Override
                                        </label>
                                    </div>

                                    {!adminOverride && staffList.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>Select Staff Member</label>
                                            <select
                                                value={selectedStaffId}
                                                onChange={(e) => setSelectedStaffId(e.target.value)}
                                                style={{
                                                    padding: '12px',
                                                    background: 'rgba(255, 255, 255, 0.4)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '12px',
                                                    color: 'var(--text-bright)',
                                                    fontSize: '0.9rem',
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {staffList.map(st => (
                                                    <option key={st.id} value={st.id} style={{ color: '#000' }}>
                                                        {st.first_name} {st.last_name} ({st.specialty})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Passcode input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
                                    {loginRole === 'super-admin' ? "Super Admin Passcode" : "Passcode"}
                                </label>
                                <input
                                    type="password"
                                    value={passcode}
                                    onChange={(e) => setPasscode(e.target.value)}
                                    placeholder={loginRole === 'super-admin' ? "e.g. owner123" : "6-digit passcode"}
                                    required
                                    autoFocus
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.4)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '12px',
                                        color: 'var(--text-bright)',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        textAlign: 'center'
                                    }}
                                />
                            </div>

                            {authError && (
                                <span style={{ fontSize: '0.75rem', color: '#ff6b6b', fontWeight: 600, textAlign: 'center' }}>
                                    {authError}
                                </span>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleCloseLogin}
                                    disabled={authenticating}
                                    style={{ flex: 1, height: '44px', borderRadius: '12px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    disabled={authenticating}
                                    style={{ flex: 1.5, height: '44px', borderRadius: '12px' }}
                                >
                                    {authenticating ? "Logging in..." : "Access Portal"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeroLandingPage;
