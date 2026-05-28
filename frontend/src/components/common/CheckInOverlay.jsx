import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';

const validateIndianPhone = (phone) => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    const indianRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
    return {
        isValid: indianRegex.test(cleaned),
        cleaned: cleaned
    };
};

const getCorePhone = (phone) => {
    const cleaned = (phone || "").replace(/[^\d]/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return cleaned.substring(2);
    }
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        return cleaned.substring(1);
    }
    return cleaned;
};

const CheckInOverlay = ({ viewMode }) => {
    const { 
        checkInOpen, 
        setCheckInOpen, 
        registerCheckInSession, 
        showToast,
        clientPhone
    } = useSession();

    const [phoneInput, setPhoneInput] = useState("");
    const [searching, setSearching] = useState(false);
    const [phoneValid, setPhoneValid] = useState(true);

    // States for navigation views
    const [view, setView] = useState("search"); // "search" | "profiles" | "register" | "edit" | "resume"
    const [familyProfiles, setFamilyProfiles] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);

    // States for registration
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    // States for editing name
    const [editingClientId, setEditingClientId] = useState(null);
    const [editFirstName, setEditFirstName] = useState("");
    const [editLastName, setEditLastName] = useState("");

    // Autocomplete states
    const [allClients, setAllClients] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Fetch all clients list for autocomplete lookup when overlay opens
    React.useEffect(() => {
        if (checkInOpen) {
            const fetchClients = async () => {
                try {
                    const res = await fetch(`${window.location.origin}/api/crm/clients`);
                    if (res.ok) {
                        const data = await res.json();
                        setAllClients(data.clients || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch clients for autocomplete:", err);
                }
            };
            fetchClients();
        }
    }, [checkInOpen]);

    // Auto-search effect for switching family members
    React.useEffect(() => {
        if (checkInOpen && clientPhone) {
            setPhoneInput(clientPhone);
            const autoSearch = async () => {
                setSearching(true);
                try {
                    const res = await fetch(`${window.location.origin}/api/crm/clients/search-by-phone?phone=${encodeURIComponent(clientPhone)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.found && data.clients && data.clients.length > 0) {
                            setFamilyProfiles(data.clients);
                            setView("profiles");
                        }
                    }
                } catch (e) {
                    console.error("Auto-search failed", e);
                } finally {
                    setSearching(false);
                }
            };
            autoSearch();
        } else if (checkInOpen) {
            setPhoneInput("");
            setView("search");
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [checkInOpen, clientPhone]);

    if (!checkInOpen || (viewMode && viewMode !== 'stylist')) return null;

    // Search client profiles by phone number
    const performSearch = async (phoneStr, skipValidation = false) => {
        let cleaned = phoneStr.replace(/[^\d+]/g, '');
        if (!skipValidation) {
            const validation = validateIndianPhone(phoneStr);
            if (!validation.isValid) {
                setPhoneValid(false);
                return;
            }
            cleaned = validation.cleaned;
        }

        setPhoneValid(true);
        setSearching(true);

        try {
            const res = await fetch(`${window.location.origin}/api/crm/clients/search-by-phone?phone=${encodeURIComponent(cleaned)}`);
            if (!res.ok) {
                throw new Error(`Search request failed with status ${res.status}`);
            }

            const data = await res.json();
            if (data.found && data.clients && data.clients.length > 0) {
                // Populate profile cards list
                setFamilyProfiles(data.clients);
                setView("profiles");
            } else {
                // Not found: switch to registration form
                setFamilyProfiles([]);
                setFirstName("");
                setLastName("");
                setView("register");
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to lookup profile: " + err.message);
        } finally {
            setSearching(false);
        }
    };

    const handleSearchPhone = (e) => {
        if (e) e.preventDefault();
        performSearch(phoneInput);
    };

    // Handle input change and suggestions filtering
    const handlePhoneChange = (val) => {
        setPhoneInput(val);
        const cleanedQuery = val.replace(/[^\d]/g, '');
        if (cleanedQuery.length >= 1) {
            const queryCore = getCorePhone(val);
            const filtered = allClients.filter(c => {
                const cleanedPhone = (c.phone || "").replace(/[^\d]/g, '');
                const phoneCore = getCorePhone(c.phone);
                return cleanedPhone.includes(cleanedQuery) || phoneCore.includes(queryCore);
            });

            // Sort suggestions by closeness (where matches start earlier in the phone string)
            const sorted = [...filtered].sort((a, b) => {
                const cleanedA = (a.phone || "").replace(/[^\d]/g, '');
                const cleanedB = (b.phone || "").replace(/[^\d]/g, '');
                const coreA = getCorePhone(a.phone);
                const coreB = getCorePhone(b.phone);

                const indexA = cleanedA.indexOf(cleanedQuery);
                const indexB = cleanedB.indexOf(cleanedQuery);

                const coreIndexA = coreA.indexOf(queryCore);
                const coreIndexB = coreB.indexOf(queryCore);

                // Use the smallest matching index (earliest in the string)
                const bestA = coreIndexA !== -1 ? coreIndexA : (indexA !== -1 ? indexA : 99);
                const bestB = coreIndexB !== -1 ? coreIndexB : (indexB !== -1 ? indexB : 99);

                if (bestA !== bestB) {
                    return bestA - bestB;
                }
                return cleanedA.length - cleanedB.length;
            });

            setSuggestions(sorted);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (client) => {
        const phone = client.phone || "";
        setPhoneInput(phone);
        setSuggestions([]);
        setShowSuggestions(false);
        performSearch(phone, true);
    };

    // Selecting a profile from grid list
    const handleSelectProfile = (client) => {
        if (client.history && client.history.length > 0) {
            setSelectedClient(client);
            setView("resume");
        } else {
            // Proceed directly to check in a fresh session
            registerCheckInSession(client, false);
        }
    };

    // Confirm session resume
    const handleConfirmResume = (resumeLast) => {
        if (selectedClient) {
            registerCheckInSession(selectedClient, resumeLast);
        }
    };

    // Start registration view
    const handleStartNewProfileRegistration = () => {
        setFirstName("");
        setLastName("");
        setView("register");
    };

    // Cancel registration
    const handleCancelRegistration = () => {
        if (familyProfiles.length > 0) {
            setView("profiles");
        } else {
            setView("search");
        }
    };

    // Submit new profile registration
    const handleSubmitRegister = async (e) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim()) {
            showToast("Please enter both First and Last Name.");
            return;
        }

        const validation = validateIndianPhone(phoneInput);
        try {
            const res = await fetch(`${window.location.origin}/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    phone: validation.cleaned
                })
            });

            if (!res.ok) {
                throw new Error(`Server returned status ${res.status}`);
            }

            const data = await res.json();
            registerCheckInSession(data, false);
            showToast("Profile registered successfully.");
        } catch (err) {
            console.error(err);
            showToast("Failed to register profile: " + err.message);
        }
    };

    // Open editing view
    const handleStartEdit = (client, e) => {
        e.stopPropagation(); // Prevent card selection click
        setEditingClientId(client.id || client.client_id);
        setEditFirstName(client.first_name);
        setEditLastName(client.last_name);
        setView("edit");
    };

    // Save profile name modification
    const handleSaveProfileEdit = async (e) => {
        e.preventDefault();
        if (!editFirstName.trim() || !editLastName.trim()) {
            showToast("Please enter both First and Last Name.");
            return;
        }

        try {
            const res = await fetch(`${window.location.origin}/api/crm/clients/${editingClientId}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: editFirstName.trim(),
                    last_name: editLastName.trim()
                })
            });

            if (!res.ok) {
                throw new Error(`Rename request failed with status ${res.status}`);
            }

            // Update details locally in family list
            setFamilyProfiles(prev => prev.map(c => {
                if ((c.id || c.client_id) === editingClientId) {
                    return { ...c, first_name: editFirstName.trim(), last_name: editLastName.trim() };
                }
                return c;
            }));

            setView("profiles");
            showToast("Profile renamed successfully.");
        } catch (err) {
            console.error(err);
            showToast("Failed to modify profile name: " + err.message);
        }
    };

    const handleResetSearch = () => {
        setPhoneInput("");
        setView("search");
    };

    return (
        <div 
            className="checkin-overlay show" 
            id="checkInOverlay"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100vh',
                zIndex: 2000,
                background: 'rgba(250, 249, 246, 0.75)',
                backdropFilter: 'blur(25px)',
                display: checkInOpen ? 'flex' : 'none',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}
        >
            <div 
                className="checkin-card textured-element"
                style={{
                    width: '90%',
                    maxWidth: '450px',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '24px',
                    padding: '30px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                    zIndex: 2,
                    textAlign: 'center',
                    overflow: view === 'search' ? 'visible' : 'auto'
                }}
            >
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-bright)', background: 'linear-gradient(45deg, var(--text-bright) 30%, var(--accent-primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 8px 0' }}>
                    Master Stylist AI
                </h1>
                <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', margin: '0 0 24px 0' }}>
                    Check-in to start your customized AI profiling consultation.
                </p>

                {/* View 1: Search Phone Number */}
                {view === "search" && (
                    <form onSubmit={handleSearchPhone} autoComplete="off" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignSelf: 'stretch', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                <span>Phone / Mobile Number</span>
                            </label>
                            <div style={{ display: 'flex', gap: '10px', position: 'relative', width: '100%' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <input 
                                        type="tel" 
                                        placeholder="e.g. 9876543210" 
                                        required 
                                        value={phoneInput}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        autoComplete="off"
                                        name="search_phone_number"
                                        onFocus={() => {
                                            if (phoneInput.trim().length >= 1 && suggestions.length > 0) {
                                                setShowSuggestions(true);
                                            }
                                        }}
                                        onBlur={() => {
                                            // Delay to allow onClick of suggestions to fire first
                                            setTimeout(() => {
                                                setShowSuggestions(false);
                                            }, 200);
                                        }}
                                        style={{ width: '100%', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.4)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-bright)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                    
                                    {/* Auto-complete suggestions list */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div 
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                background: 'var(--glass-bg)',
                                                backdropFilter: 'blur(20px)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '16px',
                                                marginTop: '8px',
                                                maxHeight: '220px',
                                                overflowY: 'auto',
                                                zIndex: 1000,
                                                boxShadow: 'var(--glass-shadow), 0 12px 40px rgba(176, 142, 81, 0.12)',
                                                scrollbarWidth: 'thin',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            {suggestions.map(client => (
                                                <div 
                                                    key={client.id || client.client_id}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleSelectSuggestion(client);
                                                    }}
                                                    style={{
                                                        padding: '12px 16px',
                                                        borderBottom: '1px solid rgba(176, 142, 81, 0.08)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-bright)',
                                                        textAlign: 'left',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'background 0.2s ease, padding-left 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(222, 184, 118, 0.12)';
                                                        e.currentTarget.style.paddingLeft = '20px';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.paddingLeft = '16px';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>{client.phone}</span>
                                                        <span style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>{client.first_name} {client.last_name}</span>
                                                    </div>
                                                    <i className="fa-solid fa-arrow-right-to-bracket" style={{ color: 'var(--accent-primary)', opacity: 0.6, fontSize: '0.85rem' }}></i>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <button 
                                    type="submit"
                                    className="btn" 
                                    style={{ width: '50px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    disabled={searching}
                                >
                                    {searching ? (
                                        <i className="fa-solid fa-spinner fa-spin"></i>
                                    ) : (
                                        <i className="fa-solid fa-magnifying-glass"></i>
                                    )}
                                </button>
                            </div>
                            {!phoneValid && (
                                <span style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '4px' }}>
                                    Please enter a valid 10-digit Indian mobile number.
                                </span>
                            )}
                        </div>
                    </form>
                )}

                {/* View 2: Family Profiles Grid */}
                {view === "profiles" && (
                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p style={{ color: 'var(--text-bright)', fontSize: '0.95rem', fontWeight: 600, textAlign: 'center', margin: '0 0 4px 0' }}>
                            Select profile to start session:
                        </p>
                        
                        <div className="profile-selection-grid">
                            {familyProfiles.map(client => {
                                const initials = ((client.first_name?.[0] || '') + (client.last_name?.[0] || '')).toUpperCase();
                                return (
                                    <div 
                                        key={client.client_id || client.id}
                                        onClick={() => handleSelectProfile(client)}
                                        className="consultation-option-card"
                                        style={{ 
                                            cursor: 'pointer', 
                                            background: 'rgba(0, 0, 0, 0.02)', 
                                            border: '1px solid var(--glass-border)', 
                                            borderRadius: '16px', 
                                            padding: '20px 12px', 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            gap: '12px', 
                                            position: 'relative', 
                                            textAlign: 'center', 
                                            minHeight: '125px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {/* Rename Profile Pencil */}
                                        <button 
                                            onClick={(e) => handleStartEdit(client, e)}
                                            style={{ 
                                                position: 'absolute', 
                                                top: '10px', 
                                                right: '10px', 
                                                background: 'transparent', 
                                                border: 'none', 
                                                color: 'var(--text-main)', 
                                                cursor: 'pointer', 
                                                fontSize: '0.85rem', 
                                                padding: '4px' 
                                            }}
                                            title="Rename Profile"
                                        >
                                            <i className="fa-solid fa-pen-to-square"></i>
                                        </button>
                                        
                                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-secondary) 0%, var(--accent-primary) 100%)', color: '#07090e', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', border: '1px solid var(--glass-border)' }}>
                                            {initials}
                                        </div>
                                        <span style={{ color: 'var(--text-bright)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                            {client.first_name} {client.last_name}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Add Family Profile card */}
                            <div 
                                onClick={handleStartNewProfileRegistration}
                                className="consultation-option-card"
                                style={{ 
                                    cursor: 'pointer', 
                                    background: 'transparent', 
                                    border: '1px dashed var(--glass-border)', 
                                    borderRadius: '16px', 
                                    padding: '20px 12px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    gap: '12px', 
                                    textAlign: 'center', 
                                    minHeight: '125px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px dashed var(--glass-border)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                    <i className="fa-solid fa-plus"></i>
                                </div>
                                <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.85rem' }}>
                                    Add Profile
                                </span>
                            </div>
                        </div>

                        <button className="btn btn-secondary" onClick={handleResetSearch} style={{ width: '100%', height: '45px', borderRadius: '12px', fontSize: '0.85rem', marginTop: '10px' }}>
                            <i className="fa-solid fa-arrow-left" style={{ marginRight: '6px' }}></i> Change Phone Number
                        </button>
                    </div>
                )}

                {/* View 3: Registration Form */}
                {view === "register" && (
                    <form onSubmit={handleSubmitRegister} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'rgba(92, 214, 153, 0.08)', border: '1px solid rgba(92, 214, 153, 0.2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <i className="fa-solid fa-user-plus" style={{ color: '#5cd699', fontSize: '1.2rem' }}></i>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-bright)' }}>Create a new styling profile.</span>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>First Name</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Rahul" 
                                required 
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                style={{ padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Last Name</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Kumar" 
                                required 
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                style={{ padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="button" className="btn btn-secondary" onClick={handleCancelRegistration} style={{ flex: 1, height: '48px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                Cancel
                            </button>
                            <button type="submit" className="btn" style={{ flex: 2, height: '48px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                Start Session
                            </button>
                        </div>
                    </form>
                )}

                {/* View 4: Edit Name Form */}
                {view === "edit" && (
                    <form onSubmit={handleSaveProfileEdit} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'rgba(222, 184, 118, 0.08)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem' }}></i>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-bright)' }}>Update profile name details.</span>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>First Name</label>
                            <input 
                                type="text" 
                                required 
                                value={editFirstName}
                                onChange={(e) => setEditFirstName(e.target.value)}
                                style={{ padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Last Name</label>
                            <input 
                                type="text" 
                                required 
                                value={editLastName}
                                onChange={(e) => setEditLastName(e.target.value)}
                                style={{ padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setView("profiles")} style={{ flex: 1, height: '48px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                Cancel
                            </button>
                            <button type="submit" className="btn" style={{ flex: 2, height: '48px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                Save Name
                            </button>
                        </div>
                    </form>
                )}

                {/* View 5: Resume Previous Session Prompt */}
                {view === "resume" && selectedClient && (
                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'rgba(222, 184, 118, 0.08)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
                                Previous Session for {selectedClient.first_name}
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                                We found a previous styling consultation session from {new Date(selectedClient.history[0].created_at).toLocaleDateString()}
                                {selectedClient.history[0].confirmed_style && ` featuring chosen cut: "${selectedClient.history[0].confirmed_style}"`}.
                            </p>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'center', margin: 0 }}>
                            Would you like to resume the recommendations from their last session, or start a new style consultation?
                        </p>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => handleConfirmResume(false)} 
                                style={{ flex: 1, height: '48px', borderRadius: '12px', fontSize: '0.85rem' }}
                            >
                                Start New
                            </button>
                            <button 
                                className="btn" 
                                onClick={() => handleConfirmResume(true)} 
                                style={{ flex: 1.5, height: '48px', borderRadius: '12px', fontSize: '0.85rem' }}
                            >
                                Resume Session
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckInOverlay;
