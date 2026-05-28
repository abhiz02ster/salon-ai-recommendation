import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';

const ClientProfileDrawer = ({ isOpen, onClose, clientId }) => {
    const { showToast } = useSession();
    
    // Profile details state
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Edit/Update fields
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

    // Stylist notes states
    const [notesList, setNotesList] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState("");
    const [newNoteType, setNewNoteType] = useState("general");
    const [submittingNote, setSubmittingNote] = useState(false);

    // Load client profile & metrics
    const loadProfileData = async (id = clientId) => {
        if (!id) return;
        setLoading(true);
        try {
            // Get profile details
            const res = await fetch(`${window.location.origin}/api/crm/clients/${id}/profile`);
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                
                // Populate update states
                setEmail(data.email || "");
                setPhone(data.phone || "");
                setNaturalColor(data.natural_color || "");
                setHairDensity(data.hair_density || "medium");
                setHairPorosity(data.hair_porosity || "medium");
                setHairElasticity(data.hair_elasticity || "normal");
                setScalpType(data.scalp_type || "normal");
                setTypicalMaintenance(data.typical_maintenance || "low");
                setAllergies(data.client_allergies || data.profile_allergies || "");
                setChemicalHistory(data.chemical_treatment_history || "");
            }

            // Get notes
            const notesRes = await fetch(`${window.location.origin}/api/crm/clients/${id}/notes`);
            if (notesRes.ok) {
                const notesData = await notesRes.json();
                setNotesList(notesData.notes || []);
            }
        } catch (err) {
            console.error("Failed to load drawer client profile:", err);
            showToast("Failed to retrieve client profile.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && clientId) {
            loadProfileData(clientId);
        }
    }, [isOpen, clientId]);

    // Save profile updates
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setUpdating(true);
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

            if (!res.ok) throw new Error("Failed to save profile");
            
            showToast("Client profile updated!");
            loadProfileData(clientId);
        } catch (err) {
            console.error(err);
            showToast("Failed to save client profile updates.");
        } finally {
            setUpdating(false);
        }
    };

    // Add new stylist note
    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNoteContent.trim()) return;

        setSubmittingNote(true);
        // Fetch active stylist ID from storage
        const activeStylistId = localStorage.getItem('logged_in_stylist_id') || 1;

        try {
            const res = await fetch(`${window.location.origin}/api/crm/clients/${clientId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newNoteContent.trim(),
                    note_type: newNoteType,
                    staff_id: parseInt(activeStylistId)
                })
            });

            if (!res.ok) throw new Error("Failed to add note");

            showToast("Stylist note recorded.");
            setNewNoteContent("");
            
            // Reload notes list
            const notesRes = await fetch(`${window.location.origin}/api/crm/clients/${clientId}/notes`);
            if (notesRes.ok) {
                const notesData = await notesRes.json();
                setNotesList(notesData.notes || []);
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to save stylist note.");
        } finally {
            setSubmittingNote(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '100%',
                maxWidth: '460px',
                height: '100vh',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(25px)',
                borderLeft: '1px solid var(--glass-border)',
                boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
                zIndex: 1500,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideIn 0.3s ease-out',
                boxSizing: 'border-box'
            }}
        >
            {/* Header */}
            <div 
                style={{ 
                    padding: '20px 24px', 
                    borderBottom: '1px solid var(--glass-border)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.3)'
                }}
            >
                <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.25rem', fontFamily: "'Outfit', sans-serif" }}>
                        👤 Client Hair Profile
                    </h3>
                    {profile && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                            {profile.first_name} {profile.last_name}
                        </span>
                    )}
                </div>
                <button 
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: 'var(--text-bright)', fontSize: '1.6rem', cursor: 'pointer', outline: 'none', padding: '4px' }}
                >
                    &times;
                </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-main)' }}>
                        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Loading client card...
                    </div>
                ) : (
                    <>
                        {/* Allergy Alert Warning Box */}
                        {allergies && (
                            <div 
                                style={{ 
                                    background: 'rgba(255, 107, 107, 0.12)', 
                                    border: '1px solid #ff6b6b', 
                                    borderRadius: '12px', 
                                    padding: '14px', 
                                    display: 'flex', 
                                    gap: '12px', 
                                    alignItems: 'center',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ff6b6b', fontSize: '1.5rem' }}></i>
                                <div>
                                    <h4 style={{ margin: 0, color: '#ff6b6b', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Allergy Warning!
                                    </h4>
                                    <p style={{ margin: '2px 0 0 0', color: 'var(--text-bright)', fontSize: '0.8rem', fontWeight: 600 }}>
                                        {allergies}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Section 1: Hair Metrics Form */}
                        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                            <h4 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                                Hair Quality & CRM Details
                            </h4>
                            
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Density</label>
                                    <select 
                                        value={hairDensity} 
                                        onChange={(e) => setHairDensity(e.target.value)}
                                        style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none' }}
                                    >
                                        <option value="thin">Thin / Fine</option>
                                        <option value="medium">Medium</option>
                                        <option value="dense">Dense / Thick</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Porosity</label>
                                    <select 
                                        value={hairPorosity} 
                                        onChange={(e) => setHairPorosity(e.target.value)}
                                        style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none' }}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Natural Color</label>
                                    <input 
                                        type="text" 
                                        value={naturalColor} 
                                        onChange={(e) => setNaturalColor(e.target.value)}
                                        placeholder="e.g. Black"
                                        style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', fontSize: '0.85rem' }}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Scalp Type</label>
                                    <select 
                                        value={scalpType} 
                                        onChange={(e) => setScalpType(e.target.value)}
                                        style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none' }}
                                    >
                                        <option value="dry">Dry</option>
                                        <option value="normal">Normal</option>
                                        <option value="oily">Oily</option>
                                        <option value="sensitive">Sensitive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Product Allergies & Sensitivities</label>
                                <input 
                                    type="text" 
                                    value={allergies} 
                                    onChange={(e) => setAllergies(e.target.value)}
                                    placeholder="e.g. Ammonia, Fragrances (None if clear)"
                                    style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Chemical Treatment & Bleach History</label>
                                <textarea 
                                    value={chemicalHistory} 
                                    onChange={(e) => setChemicalHistory(e.target.value)}
                                    placeholder="e.g. Permed last Dec, Balayage bleach in March."
                                    style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.4)', color: 'var(--text-bright)', outline: 'none', height: '60px', resize: 'none', fontSize: '0.85rem' }}
                                />
                            </div>

                            <button 
                                type="submit" 
                                className="btn" 
                                style={{ height: '36px', fontSize: '0.8rem', alignSelf: 'flex-end', padding: '0 16px', borderRadius: '8px' }}
                                disabled={updating}
                            >
                                {updating ? "Saving..." : "Save Profile Details"}
                            </button>
                        </form>

                        {/* Section 2: Log Stylist Note */}
                        <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', background: 'rgba(222, 184, 118, 0.04)', border: '1px dashed var(--glass-border)', padding: '16px', borderRadius: '12px' }}>
                            <h4 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '0.85rem', fontWeight: 700 }}>
                                📝 Record Consultation Note
                            </h4>
                            
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-main)' }}>Note Category</label>
                                <select 
                                    value={newNoteType} 
                                    onChange={(e) => setNewNoteType(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid var(--glass-border)', borderRadius: '6px', background: '#fff', color: '#000', outline: 'none', fontSize: '0.8rem' }}
                                >
                                    <option value="general">General Preference</option>
                                    <option value="formula">Color Formula</option>
                                    <option value="complaint">Alert / Complaint</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <textarea 
                                    required
                                    value={newNoteContent} 
                                    onChange={(e) => setNewNoteContent(e.target.value)}
                                    placeholder="Write color formula details or cut preferences here..."
                                    style={{ padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '6px', background: '#fff', color: '#000', outline: 'none', height: '70px', resize: 'none', fontSize: '0.8rem' }}
                                />
                            </div>

                            <button 
                                type="submit" 
                                className="btn" 
                                style={{ height: '32px', fontSize: '0.75rem', alignSelf: 'flex-end', padding: '0 12px', borderRadius: '6px' }}
                                disabled={submittingNote}
                            >
                                {submittingNote ? "Saving..." : "Add Stylist Log"}
                            </button>
                        </form>

                        {/* Section 3: Notes History Timeline */}
                        <div style={{ textAlign: 'left' }}>
                            <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent-primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                                Stylist Notes Timeline
                            </h4>
                            
                            {notesList.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', textAlign: 'center', margin: '20px 0' }}>
                                    No stylist notes logged yet.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {notesList.map(note => {
                                        const date = new Date(note.created_at).toLocaleDateString();
                                        const noteColors = {
                                            general: { bg: 'rgba(222, 184, 118, 0.08)', text: 'var(--accent-primary)' },
                                            formula: { bg: 'rgba(92, 214, 153, 0.08)', text: '#5cd699' },
                                            complaint: { bg: 'rgba(255, 107, 107, 0.08)', text: '#ff6b6b' }
                                        };
                                        const badge = noteColors[note.note_type] || noteColors.general;
                                        
                                        return (
                                            <div 
                                                key={note.id}
                                                style={{
                                                    padding: '12px',
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '10px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ 
                                                        fontSize: '0.65rem', 
                                                        fontWeight: 800, 
                                                        textTransform: 'uppercase', 
                                                        background: badge.bg, 
                                                        color: badge.text, 
                                                        padding: '2px 6px', 
                                                        borderRadius: '4px' 
                                                    }}>
                                                        {note.note_type}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-main)' }}>
                                                        {date}
                                                    </span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-bright)', lineHeight: '1.4' }}>
                                                    {note.content}
                                                </p>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-main)', fontStyle: 'italic', textAlign: 'right' }}>
                                                    — Logged by {note.stylist_name}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Custom Slide-In Animation styling */}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default ClientProfileDrawer;
