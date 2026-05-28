import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';

const SuperAdminConsole = ({ onConfigUpdate }) => {
    const { showToast } = useSession();
    const [activeTab, setActiveTab] = useState("stylists");

    // Stylist management states
    const [stylists, setStylists] = useState([]);
    const [selectedStylist, setSelectedStylist] = useState(null);
    const [stylistAppointments, setStylistAppointments] = useState([]);
    const [selectedStylistMetrics, setSelectedStylistMetrics] = useState(null);
    const [loadingStylists, setLoadingStylists] = useState(false);
    
    // Add stylist states
    const [newStaffFirst, setNewStaffFirst] = useState("");
    const [newStaffLast, setNewStaffLast] = useState("");
    const [newStaffSpecialty, setNewStaffSpecialty] = useState("");
    const [addingStaff, setAddingStaff] = useState(false);

    // Promotion campaign states
    const [campaignMessage, setCampaignMessage] = useState(
        "Hi {name}! Treat yourself this weekend at {salon_name}. Get a 15% discount on styling! Book now at {booking_url}"
    );
    const [filterType, setFilterType] = useState("all"); // "all" | "gender" | "hair_type" | "skin_tone" | "selected"
    const [filterValue, setFilterValue] = useState("");
    const [allClientsList, setAllClientsList] = useState([]);
    const [selectedClientIds, setSelectedClientIds] = useState([]);
    const [campaignRunning, setCampaignRunning] = useState(false);

    // Salon settings states
    const [salonName, setSalonName] = useState("");
    const [activeTheme, setActiveTheme] = useState("theme-alabaster-gold");
    const [savingConfig, setSavingConfig] = useState(false);

    // Load initial config
    const loadSalonConfig = async () => {
        try {
            const res = await fetch(`${window.location.origin}/api/config`);
            if (res.ok) {
                const data = await res.json();
                setSalonName(data.salon_name || "Master Stylist Salon");
                setActiveTheme(data.active_theme || "theme-alabaster-gold");
            }
        } catch (err) {
            console.error("Failed to load configs", err);
        }
    };

    // Load staff metrics
    const loadStaffMetrics = async () => {
        setLoadingStylists(true);
        try {
            const res = await fetch(`${window.location.origin}/api/staff/metrics`);
            if (res.ok) {
                const data = await res.json();
                setStylists(data || []);
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to retrieve stylist workload data.");
        } finally {
            setLoadingStylists(false);
        }
    };

    // Load specific stylist workload history
    const handleSelectStylist = async (staffId) => {
        setSelectedStylist(staffId);
        try {
            const res = await fetch(`${window.location.origin}/api/staff/metrics?staff_id=${staffId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedStylistMetrics(data);
                setStylistAppointments(data.appointments || []);
            }
        } catch (err) {
            console.error(err);
            showToast("Could not load stylist appointment details.");
        }
    };

    // Load clients checklist for selection filtering
    const loadClientsList = async () => {
        try {
            const res = await fetch(`${window.location.origin}/api/crm/clients`);
            if (res.ok) {
                const data = await res.json();
                setAllClientsList(data.clients || []);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadSalonConfig();
        loadStaffMetrics();
        loadClientsList();
    }, []);

    // Add stylist submit
    const handleAddStaff = async (e) => {
        e.preventDefault();
        if (!newStaffFirst.trim() || !newStaffLast.trim()) return;

        setAddingStaff(true);
        try {
            const res = await fetch(`${window.location.origin}/api/staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: newStaffFirst.trim(),
                    last_name: newStaffLast.trim(),
                    specialty: newStaffSpecialty.trim()
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`Stylist registered! Code: ${data.stylist_passcode}, Admin: ${data.admin_passcode}`);
                setNewStaffFirst("");
                setNewStaffLast("");
                setNewStaffSpecialty("");
                loadStaffMetrics();
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to add stylist.");
        } finally {
            setAddingStaff(false);
        }
    };

    // Save configurations
    const handleSaveConfig = async (e) => {
        e.preventDefault();
        if (!salonName.trim()) return;

        setSavingConfig(true);
        try {
            const res = await fetch(`${window.location.origin}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    salon_name: salonName.trim(),
                    active_theme: activeTheme
                })
            });

            if (res.ok) {
                showToast("Configurations saved! Applying changes...");
                if (onConfigUpdate) {
                    onConfigUpdate(salonName.trim(), activeTheme);
                }
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to save configurations.");
        } finally {
            setSavingConfig(false);
        }
    };

    // Run promotions campaign
    const handleRunCampaign = async (e) => {
        e.preventDefault();
        if (!campaignMessage.trim()) return;

        setCampaignRunning(true);
        try {
            const res = await fetch(`${window.location.origin}/api/promotions/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message_content: campaignMessage.trim(),
                    filter_type: filterType,
                    filter_value: filterValue || null,
                    client_ids: filterType === 'selected' ? selectedClientIds : null
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`Campaign launched! Sent ${data.messages_sent} of ${data.recipients_count} messages.`);
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to broadcast marketing campaign.");
        } finally {
            setCampaignRunning(false);
        }
    };

    const handleClientCheckChange = (clientId) => {
        setSelectedClientIds(prev => 
            prev.includes(clientId) 
                ? prev.filter(id => id !== clientId) 
                : [...prev, clientId]
        );
    };

    // Recipient preview counter helper
    const getRecipientsCount = () => {
        if (filterType === 'all') return allClientsList.length;
        if (filterType === 'selected') return selectedClientIds.length;
        if (!filterValue) return 0;
        
        return allClientsList.filter(c => {
            if (filterType === 'gender') return c.gender === filterValue;
            if (filterType === 'hair_type') return c.hair_type === filterValue;
            if (filterType === 'skin_tone') return c.skin_tone === filterValue;
            return false;
        }).length;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left', minHeight: 0 }}>
            {/* Super Admin Dashboard Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: "'Outfit', sans-serif" }}>
                        👑 Salon Owner Dashboard
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        Super Admin Portal for revenue tracking, marketing broadcasts, and theme customization.
                    </p>
                </div>
                
                {/* Secondary Local Tab switchers */}
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.4)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)', gap: '4px' }}>
                    <button 
                        onClick={() => setActiveTab("stylists")}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'stylists' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'stylists' ? 'var(--bg-primary)' : 'var(--text-bright)', fontWeight: 600 }}
                    >
                        <i className="fa-solid fa-scissors" style={{ marginRight: '6px' }}></i> Stylist Workload
                    </button>
                    <button 
                        onClick={() => setActiveTab("promotions")}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'promotions' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'promotions' ? 'var(--bg-primary)' : 'var(--text-bright)', fontWeight: 600 }}
                    >
                        <i className="fa-solid fa-bullhorn" style={{ marginRight: '6px' }}></i> Promotion campaigns
                    </button>
                    <button 
                        onClick={() => setActiveTab("config")}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'config' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'config' ? 'var(--bg-primary)' : 'var(--text-bright)', fontWeight: 600 }}
                    >
                        <i className="fa-solid fa-gears" style={{ marginRight: '6px' }}></i> Salon Configuration
                    </button>
                </div>
            </div>

            {/* TAB CONTENT 1: STYLIST PERFORMANCE TRACKER */}
            {activeTab === "stylists" && (
                <div style={{ display: 'flex', gap: '20px', flexDirection: window.innerWidth < 992 ? 'column' : 'row' }}>
                    {/* Stylist Revenue Table */}
                    <div className="checkin-card textured-element" style={{ flex: 1.5, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '16px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-bright)', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                            Stylist Metrics
                        </h3>
                        
                        {loadingStylists ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-main)' }}>Loading stylists workload...</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-main)', textAlign: 'left' }}>
                                        <th style={{ padding: '10px 8px' }}>Stylist Name</th>
                                        <th style={{ padding: '10px 8px' }}>Specialty</th>
                                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Stylist Code</th>
                                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Admin Code</th>
                                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Completed Jobs</th>
                                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Revenue Generated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stylists.map(st => (
                                        <tr 
                                            key={st.staff_id}
                                            onClick={() => handleSelectStylist(st.staff_id)}
                                            style={{ 
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                                                cursor: 'pointer',
                                                background: selectedStylist === st.staff_id ? 'rgba(222, 184, 118, 0.08)' : 'transparent',
                                                fontWeight: selectedStylist === st.staff_id ? 700 : 500
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(222, 184, 118, 0.04)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = selectedStylist === st.staff_id ? 'rgba(222, 184, 118, 0.08)' : 'transparent'}
                                        >
                                            <td style={{ padding: '12px 8px', color: 'var(--text-bright)' }}>
                                                {st.first_name} {st.last_name}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'var(--text-main)' }}>{st.specialty || "General Stylist"}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--accent-primary)', fontWeight: 600 }}>{st.stylist_passcode || "-"}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--accent-primary)', fontWeight: 600 }}>{st.admin_passcode || "-"}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-bright)' }}>{st.total_appointments}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                                INR {st.total_revenue.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        
                        {/* Stylist Appointment Detail Breakdowns */}
                        {selectedStylist && selectedStylistMetrics && (
                            <div style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                                        Completed Jobs History
                                    </h4>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>
                                        Worked on <b>{selectedStylistMetrics.total_clients}</b> unique clients.
                                    </span>
                                </div>
                                
                                <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-main)', textAlign: 'left' }}>
                                                <th style={{ padding: '6px 4px' }}>Date</th>
                                                <th style={{ padding: '6px 4px' }}>Client</th>
                                                <th style={{ padding: '6px 4px' }}>Service</th>
                                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Billing</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stylistAppointments.map(appt => (
                                                <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                    <td style={{ padding: '8px 4px', color: 'var(--text-main)' }}>
                                                        {new Date(appt.appointment_datetime).toLocaleDateString()}
                                                    </td>
                                                    <td style={{ padding: '8px 4px', color: 'var(--text-bright)', fontWeight: 600 }}>
                                                        {appt.first_name} {appt.last_name}
                                                    </td>
                                                    <td style={{ padding: '8px 4px', color: 'var(--text-main)' }}>{appt.service_name}</td>
                                                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--accent-primary)' }}>
                                                        INR {appt.total_price.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add New Stylist Form */}
                    <div className="checkin-card textured-element" style={{ flex: 0.8, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '16px', height: 'fit-content' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-bright)', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                            ➕ Register Stylist
                        </h3>
                        <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>First Name</label>
                                <input 
                                    type="text" 
                                    value={newStaffFirst} 
                                    onChange={(e) => setNewStaffFirst(e.target.value)}
                                    placeholder="e.g. Priya"
                                    required
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', fontSize: '0.85rem' }}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Last Name</label>
                                <input 
                                    type="text" 
                                    value={newStaffLast} 
                                    onChange={(e) => setNewStaffLast(e.target.value)}
                                    placeholder="e.g. Sharma"
                                    required
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', fontSize: '0.85rem' }}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Specialty / Role</label>
                                <input 
                                    type="text" 
                                    value={newStaffSpecialty} 
                                    onChange={(e) => setNewStaffSpecialty(e.target.value)}
                                    placeholder="e.g. Color Specialist"
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', fontSize: '0.85rem' }}
                                />
                            </div>
                            <button type="submit" className="btn" style={{ height: '40px', marginTop: '6px', borderRadius: '8px' }} disabled={addingStaff}>
                                {addingStaff ? "Registering..." : "Add Stylist"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 2: PROMOTIONS & MARKETING CAMPAIGN */}
            {activeTab === "promotions" && (
                <div className="checkin-card textured-element" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-bright)', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                        📢 WhatsApp Promotion Broadcaster
                    </h3>
                    
                    <form onSubmit={handleRunCampaign} style={{ display: 'flex', gap: '24px', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
                        {/* Message Composer & Filters */}
                        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-bright)', fontWeight: 600 }}>Message Content</label>
                                <textarea 
                                    required
                                    value={campaignMessage}
                                    onChange={(e) => setCampaignMessage(e.target.value)}
                                    placeholder="Write your campaign broadcast message here..."
                                    style={{ padding: '10px 14px', border: '1px solid var(--glass-border)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', height: '140px', resize: 'none', fontSize: '0.85rem', lineHeight: '1.4' }}
                                />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-main)' }}>
                                    Use variables: <b>{`{name}`}</b> for client's full name, <b>{`{salon_name}`}</b> for salon name, and <b>{`{booking_url}`}</b>.
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Filter Campaign Target</label>
                                    <select 
                                        value={filterType} 
                                        onChange={(e) => {
                                            setFilterType(e.target.value);
                                            setFilterValue("");
                                        }}
                                        style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none' }}
                                    >
                                        <option value="all">All Checked-in Clients</option>
                                        <option value="gender">Filter by Gender</option>
                                        <option value="hair_type">Filter by Hair Type</option>
                                        <option value="skin_tone">Filter by Skin Tone</option>
                                        <option value="selected">Choose Manually</option>
                                    </select>
                                </div>

                                {filterType === 'gender' && (
                                    <div className="form-group" style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Select Gender</label>
                                        <select 
                                            value={filterValue} 
                                            onChange={(e) => setFilterValue(e.target.value)}
                                            required
                                            style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none' }}
                                        >
                                            <option value="">-- Choose Gender --</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                )}

                                {filterType === 'hair_type' && (
                                    <div className="form-group" style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Select Hair Type</label>
                                        <select 
                                            value={filterValue} 
                                            onChange={(e) => setFilterValue(e.target.value)}
                                            required
                                            style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none' }}
                                        >
                                            <option value="">-- Choose Hair Type --</option>
                                            <option value="straight">Straight</option>
                                            <option value="wavy">Wavy</option>
                                            <option value="curly">Curly</option>
                                            <option value="coily">Coily</option>
                                        </select>
                                    </div>
                                )}

                                {filterType === 'skin_tone' && (
                                    <div className="form-group" style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Select Skin Tone</label>
                                        <select 
                                            value={filterValue} 
                                            onChange={(e) => setFilterValue(e.target.value)}
                                            required
                                            style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none' }}
                                        >
                                            <option value="">-- Choose Skin Tone --</option>
                                            <option value="fair">Fair</option>
                                            <option value="light">Light</option>
                                            <option value="medium">Medium</option>
                                            <option value="tan">Tan</option>
                                            <option value="deep">Deep</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recipient Selector / Preview Panel */}
                        <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ background: 'rgba(222, 184, 118, 0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                                <h4 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '0.85rem' }}>Recipients count</h4>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-primary)', margin: '4px 0' }}>
                                    {getRecipientsCount()}
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>
                                    clients will receive this campaign.
                                </span>
                            </div>

                            {/* Checklist for Manual Selection */}
                            {filterType === 'selected' && (
                                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '12px', height: '110px', overflowY: 'auto', background: 'rgba(255, 255, 255, 0.02)' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', display: 'block', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
                                        Client Selection Checklist
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {allClientsList.map(c => (
                                            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-bright)', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedClientIds.includes(c.id)}
                                                    onChange={() => handleClientCheckChange(c.id)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                {c.first_name} {c.last_name} ({c.phone})
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                className="btn" 
                                style={{ width: '100%', height: '45px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.9rem' }}
                                disabled={campaignRunning || getRecipientsCount() === 0}
                            >
                                {campaignRunning ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin"></i> Broadcasting...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-paper-plane"></i> Launch WhatsApp Campaign
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB CONTENT 3: LOCAL SALON CONFIGURATION MANAGER */}
            {activeTab === "config" && (
                <div className="checkin-card textured-element" style={{ maxWidth: '500px', margin: '0 auto', width: '100%', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-bright)', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                        ⚙️ Local Configuration Overrides
                    </h3>
                    
                    <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-bright)', fontWeight: 600 }}>Salon Name</label>
                            <input 
                                type="text" 
                                value={salonName} 
                                onChange={(e) => setSalonName(e.target.value)}
                                placeholder="e.g. Master Stylist Salon"
                                required
                                style={{ padding: '10px 14px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', fontSize: '0.85rem' }}
                            />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-main)' }}>
                                This branding changes the header title and invoice receipt watermark.
                              </span>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-bright)', fontWeight: 600 }}>Active Stylist theme override</label>
                            <select 
                                value={activeTheme} 
                                onChange={(e) => setActiveTheme(e.target.value)}
                                style={{ padding: '10px 14px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', fontSize: '0.85rem' }}
                            >
                                <option value="theme-alabaster-gold">⚜️ Premium Light Alabaster (Default)</option>
                                <option value="theme-obsidian-dark">🖤 Sophisticated Dark Obsidian</option>
                                <option value="theme-emerald-glass">💚 Emerald Glassmorphism</option>
                                <option value="theme-rose-champagne">💖 Rose & Champagne Gold</option>
                            </select>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-main)' }}>
                                Switch themes instantly across all devices logging in.
                            </span>
                        </div>

                        <button type="submit" className="btn" style={{ height: '42px', marginTop: '10px', borderRadius: '8px' }} disabled={savingConfig}>
                            {savingConfig ? "Saving..." : "Save Config Overrides"}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default SuperAdminConsole;
