import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';

const ClientProfileDetail = ({ clientId, onProfileUpdate }) => {
    const { showToast } = useSession();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Modal Edit Profile State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [naturalColor, setNaturalColor] = useState("");
    const [hairDensity, setHairDensity] = useState("medium");
    const [hairPorosity, setHairPorosity] = useState("medium");
    const [hairElasticity, setHairElasticity] = useState("normal");
    const [scalpType, setScalpType] = useState("normal");
    const [typicalMaintenance, setTypicalMaintenance] = useState("low");
    const [allergies, setAllergies] = useState("");
    const [chemicalHistory, setChemicalHistory] = useState("");

    // Load full profile details
    const loadProfile = async (id = clientId) => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await fetch(`${window.location.origin}/api/crm/clients/${id}/profile`);
            if (!res.ok) throw new Error("Profile details not found");
            const data = await res.json();
            
            // Also grab visits/spent statistics from base clients API
            const baseClientsRes = await fetch(`${window.location.origin}/api/crm/clients`);
            if (baseClientsRes.ok) {
                const baseClientsData = await baseClientsRes.json();
                const matched = baseClientsData.clients.find(c => c.id === id);
                if (matched) {
                    data.total_visits = matched.total_visits;
                    data.total_spent = matched.total_spent;
                }
            }

            setProfile(data);
        } catch (err) {
            console.error(err);
            showToast("Failed to load client profile details.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (clientId) {
            loadProfile(clientId);
        } else {
            setProfile(null);
        }
    }, [clientId]);

    // Open Edit modal and populate fields
    const handleOpenEditModal = () => {
        if (!profile) return;
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
        setNaturalColor(profile.natural_color || "");
        setHairDensity(profile.hair_density || "medium");
        setHairPorosity(profile.hair_porosity || "medium");
        setHairElasticity(profile.hair_elasticity || "normal");
        setScalpType(profile.scalp_type || "normal");
        setTypicalMaintenance(profile.typical_maintenance || "low");
        setAllergies(profile.allergies || "");
        setChemicalHistory(profile.chemical_treatment_history || "");
        setEditModalOpen(true);
    };

    // Save profile changes via API
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${window.location.origin}/api/crm/clients/${clientId}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    phone,
                    natural_color: naturalColor,
                    hair_density: hairDensity,
                    hair_porosity: hairPorosity,
                    hair_elasticity: hairElasticity,
                    scalp_type: scalpType,
                    typical_maintenance: typicalMaintenance,
                    allergies,
                    chemical_treatment_history: chemicalHistory
                })
            });

            if (!res.ok) throw new Error("Failed to save client profile updates");
            
            showToast("Client profile updated successfully!");
            setEditModalOpen(false);
            
            // Reload local profile and trigger list update in directory
            await loadProfile(clientId);
            if (onProfileUpdate) onProfileUpdate();
        } catch (err) {
            console.error(err);
            showToast("Failed to update profile: " + err.message);
        }
    };

    if (!clientId) {
        return (
            <div 
                className="crm-detail-main textured-element" 
                style={{ 
                    background: 'var(--glass-bg)', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '20px', 
                    padding: '40px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%', 
                    color: 'var(--text-main)', 
                    textAlign: 'center', 
                    gap: '16px' 
                }}
            >
                <i className="fa-solid fa-id-card" style={{ fontSize: '3.5rem', color: 'var(--glass-border)' }}></i>
                <h3 style={{ color: 'var(--text-bright)', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>
                    No Client Selected
                </h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '320px', lineHeight: '1.5', margin: 0 }}>
                    Select a client from the directory sidebar to manage styling preferences, chemical history, color formula logs, and loyalty points.
                </p>
            </div>
        );
    }

    if (loading && !profile) {
        return (
            <div className="crm-detail-main textured-element" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '40px', textAlign: 'center', color: 'var(--text-main)' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.5rem', color: 'var(--accent-primary)', marginBottom: '15px' }}></i>
                <h3>Loading client profile details...</h3>
            </div>
        );
    }

    if (!profile) return null;

    const loyaltyPoints = Math.round(profile.total_spent || 0);

    return (
        <div 
            className="crm-detail-main textured-element" 
            style={{ 
                background: 'var(--glass-bg)', 
                border: '1px solid var(--glass-border)', 
                borderRadius: '20px', 
                padding: '30px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '24px',
                height: '100%',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 160px)'
            }}
        >
            {/* Header info */}
            <div className="crm-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, color: 'var(--text-bright)', fontSize: '1.6rem', margin: '0 0 6px 0' }}>
                        {profile.first_name} {profile.last_name}
                    </h2>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <span>
                            <i className="fa-solid fa-phone" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginRight: '4px' }}></i> 
                            {profile.phone}
                        </span>
                        <span>
                            <i className="fa-solid fa-envelope" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginRight: '4px' }}></i> 
                            {profile.email || 'No email registered'}
                        </span>
                    </div>
                </div>
                <button 
                    className="btn" 
                    onClick={handleOpenEditModal}
                    style={{ borderRadius: '12px', fontSize: '0.8rem', padding: '8px 16px', boxShadow: 'none' }}
                >
                    <i className="fa-solid fa-user-gear" style={{ marginRight: '6px' }}></i> Edit Profile
                </button>
            </div>

            {/* Allergy alert system */}
            {profile.allergies && profile.allergies.trim() ? (
                <div 
                    className="allergy-badge-alert" 
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        background: 'rgba(255, 74, 74, 0.08)', 
                        border: '1px solid #ff4a4a', 
                        color: '#ff8080', 
                        borderRadius: '12px', 
                        padding: '16px',
                        animation: 'pulseAlert 2s infinite'
                    }}
                >
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.3rem' }}></i>
                    <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                            Warning: Client Allergies Registered
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-bright)' }}>{profile.allergies}</span>
                    </div>
                </div>
            ) : (
                <div style={{ background: 'rgba(86, 219, 149, 0.05)', border: '1px solid rgba(86, 219, 149, 0.2)', color: '#56db95', borderRadius: '12px', padding: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: '1.25rem' }}></i>
                    <span>No product or chemical allergies registered.</span>
                </div>
            )}

            {/* Metrics & Loyalty Card Row */}
            <div className="crm-details-grid">
                {/* Diagnostics block */}
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px' }}>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-bright)', margin: '0 0 16px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent-primary)', fontSize: '0.95rem' }}></i> Characteristics & Diagnostics
                    </h3>
                    <div className="crm-meta-grid">
                        <div className="crm-meta-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '2px' }}>Natural Color</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-bright)' }}>{profile.natural_color || 'Unrecorded'}</span>
                        </div>
                        <div className="crm-meta-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '2px' }}>Density</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-bright)', textTransform: 'capitalize' }}>{profile.hair_density || 'Unrecorded'}</span>
                        </div>
                        <div className="crm-meta-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '2px' }}>Porosity</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-bright)', textTransform: 'capitalize' }}>{profile.hair_porosity || 'Unrecorded'}</span>
                        </div>
                        <div className="crm-meta-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '2px' }}>Elasticity</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-bright)', textTransform: 'capitalize' }}>{profile.hair_elasticity || 'Unrecorded'}</span>
                        </div>
                        <div className="crm-meta-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '2px' }}>Scalp Type</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-bright)', textTransform: 'capitalize' }}>{profile.scalp_type || 'Unrecorded'}</span>
                        </div>
                        <div className="crm-meta-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '2px' }}>Maintenance</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-bright)', textTransform: 'capitalize' }}>{profile.typical_maintenance || 'Unrecorded'}</span>
                        </div>
                    </div>
                </div>

                {/* VIP loyalty card */}
                <div 
                    className="loyalty-badge" 
                    style={{ 
                        background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                        borderRadius: '16px',
                        padding: '20px',
                        color: 'var(--text-bright)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 32px rgba(222, 184, 118, 0.15)'
                    }}
                >
                    <div>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: 800, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <i className="fa-solid fa-crown" style={{ fontSize: '1rem' }}></i> VIP Loyalty Club
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', margin: 0, fontWeight: 500, lineHeight: 1.3 }}>
                            Earn 1 point per INR 1 spent on salon styling treatments.
                        </p>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '15px' }}>
                        <div style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>
                            {loyaltyPoints}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-main)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Points Available
                        </span>
                    </div>
                </div>
            </div>

            {/* Chemical Treatment Notes */}
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', color: 'var(--text-bright)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-flask" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}></i> Chemical Treatment History Notes
                </h4>
                <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    {profile.chemical_treatment_history || 'No chemical treatment notes registered for this client.'}
                </p>
            </div>

            {/* Color Formula Timeline */}
            <div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-palette" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}></i> Color Formulas Timeline
                </h3>
                <div className="horizontal-scroller-formulas" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {profile.color_formulas && profile.color_formulas.length > 0 ? (
                        profile.color_formulas.map((f, idx) => {
                            const dateStr = new Date(f.date).toLocaleDateString();
                            return (
                                <div key={idx} className="formula-timeline-card" style={{ flex: '0 0 280px', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                                        <span>📅 {dateStr}</span>
                                        <span>Stylist: {f.stylist_name}</span>
                                    </div>
                                    <div style={{ background: 'rgba(255, 255, 255, 0.4)', padding: '8px 12px', borderRadius: '8px', fontFamily: 'monospace', color: 'var(--accent-primary)', fontSize: '0.75rem', border: '1px solid var(--glass-border)', lineHeight: '1.4' }}>
                                        {f.formula}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ color: 'var(--text-main)', fontSize: '0.8rem', fontStyle: 'italic', padding: '10px 0' }}>
                            No past color formulas recorded.
                        </div>
                    )}
                </div>
            </div>

            {/* Style History & Feedback */}
            <div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}></i> Style History & Feedback
                </h3>
                <div className="horizontal-scroller-formulas" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {profile.style_history && profile.style_history.length > 0 ? (
                        profile.style_history.map((h, idx) => {
                            const dateStr = new Date(h.date).toLocaleDateString();
                            const ratingStars = '★'.repeat(h.satisfaction_score || 5) + '☆'.repeat(5 - (h.satisfaction_score || 5));
                            return (
                                <div key={idx} className="formula-timeline-card" style={{ flex: '0 0 280px', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-main)' }}>
                                        <span>📅 {dateStr}</span>
                                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{ratingStars}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '0.85rem' }}>{h.recommended_style}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginTop: '2px' }}>Service: {h.actual_service || 'N/A'}</div>
                                    </div>
                                    <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.75rem', lineHeight: '1.4', borderTop: '1px dotted var(--glass-border)', paddingTop: '6px' }}>
                                        {h.notes || 'No notes.'}
                                    </p>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ color: 'var(--text-main)', fontSize: '0.8rem', fontStyle: 'italic', padding: '10px 0' }}>
                            No styling history recorded.
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Profile Modal Dialog */}
            {editModalOpen && (
                <div 
                    className="generic-modal-overlay show"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 2500,
                        background: 'rgba(250, 249, 246, 0.75)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <form 
                        onSubmit={handleSaveProfile}
                        className="generic-modal-card textured-element"
                        style={{
                            maxWidth: '550px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '90%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.2rem', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-user-pen" style={{ color: 'var(--accent-primary)' }}></i>
                                Edit Client Profile Attributes
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setEditModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer', outline: 'none' }}
                            >
                                &times;
                            </button>
                        </div>
                        
                        <div 
                            style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                                gap: '12px', 
                                maxHeight: '350px', 
                                overflowY: 'auto',
                                paddingRight: '6px'
                            }}
                        >
                            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Email Address</label>
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. client@example.com"
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Phone Number</label>
                                <input 
                                    type="text" 
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="e.g. 9999999999"
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Natural Color</label>
                                <input 
                                    type="text" 
                                    value={naturalColor}
                                    onChange={(e) => setNaturalColor(e.target.value)}
                                    placeholder="e.g. Dark Brown"
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Hair Density</label>
                                <select 
                                    value={hairDensity}
                                    onChange={(e) => setHairDensity(e.target.value)}
                                    style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                >
                                    <option value="thin">Thin</option>
                                    <option value="medium">Medium</option>
                                    <option value="thick">Thick</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Hair Porosity</label>
                                <select 
                                    value={hairPorosity}
                                    onChange={(e) => setHairPorosity(e.target.value)}
                                    style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Hair Elasticity</label>
                                <select 
                                    value={hairElasticity}
                                    onChange={(e) => setHairElasticity(e.target.value)}
                                    style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                >
                                    <option value="poor">Poor</option>
                                    <option value="normal">Normal</option>
                                    <option value="good">Good</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Scalp Type</label>
                                <select 
                                    value={scalpType}
                                    onChange={(e) => setScalpType(e.target.value)}
                                    style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                >
                                    <option value="normal">Normal</option>
                                    <option value="dry">Dry</option>
                                    <option value="oily">Oily</option>
                                    <option value="sensitive">Sensitive</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Typical Maintenance Level</label>
                                <select 
                                    value={typicalMaintenance}
                                    onChange={(e) => setTypicalMaintenance(e.target.value)}
                                    style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                >
                                    <option value="low">Low</option>
                                    <option value="moderate">Moderate</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Chemical & Product Allergies</label>
                                <input 
                                    type="text" 
                                    value={allergies}
                                    onChange={(e) => setAllergies(e.target.value)}
                                    placeholder="e.g. Ammonia, Fragrances"
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Chemical Treatment History Notes</label>
                                <textarea 
                                    value={chemicalHistory}
                                    onChange={(e) => setChemicalHistory(e.target.value)}
                                    rows="3" 
                                    placeholder="e.g. Perm straightener in Oct 2025..."
                                    style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', padding: '10px', outline: 'none', fontSize: '0.85rem', resize: 'vertical' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => setEditModalOpen(false)}
                                style={{ borderRadius: '8px', padding: '8px 16px' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn" 
                                style={{ borderRadius: '8px', padding: '8px 16px' }}
                            >
                                Save Updates
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ClientProfileDetail;
