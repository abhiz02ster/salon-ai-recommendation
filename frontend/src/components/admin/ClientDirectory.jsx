import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '../../context/SessionContext';

const ClientDirectory = ({ selectedClientId, onSelectClient }) => {
    const { showToast } = useSession();
    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);

    // Modal state for registering a new client
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    // Load clients from API
    const loadClients = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${window.location.origin}/api/crm/clients`);
            if (!res.ok) throw new Error("Failed to load clients list");
            const data = await res.json();
            setClients(data.clients || []);
        } catch (err) {
            console.error(err);
            showToast("Failed to retrieve client directory.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClients();
    }, []);

    // Local client-side search filtering
    const filteredClients = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return clients;
        return clients.filter(c => {
            const fullname = `${c.first_name} ${c.last_name}`.toLowerCase();
            const phoneStr = c.phone || "";
            const emailStr = c.email?.toLowerCase() || "";
            return fullname.includes(query) || phoneStr.includes(query) || emailStr.includes(query);
        });
    }, [clients, searchTerm]);

    // Handle registering a new client
    const handleSubmitAddClient = async (e) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
            showToast("Please fill in all registration fields.");
            return;
        }

        try {
            const res = await fetch(`${window.location.origin}/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    phone: phone.trim()
                })
            });

            if (!res.ok) {
                throw new Error(`Server returned status ${res.status}`);
            }

            const data = await res.json();
            showToast(`Registered and Checked In: ${data.first_name} ${data.last_name}`);
            
            // Reset input values
            setFirstName("");
            setLastName("");
            setPhone("");
            setAddModalOpen(false);

            // Reload client list and select the newly created profile
            await loadClients();
            onSelectClient(data.client_id);
        } catch (err) {
            console.error(err);
            showToast("Registration failed: " + err.message);
        }
    };

    return (
        <div className="crm-list-sidebar textured-element" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
            
            {/* Header section with add button */}
            <div className="crm-list-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-bright)' }}>
                    Client Directory
                </span>
                <button 
                    className="btn" 
                    onClick={() => setAddModalOpen(true)}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', boxShadow: 'none' }}
                >
                    <i className="fa-solid fa-plus" style={{ marginRight: '4px' }}></i> Add
                </button>
            </div>

            {/* Search Input Box */}
            <div className="search-input-wrapper" style={{ position: 'relative', width: '100%' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-main)', fontSize: '0.85rem' }}></i>
                <input 
                    type="text" 
                    placeholder="Search name or phone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '10px 12px 10px 34px', 
                        background: 'rgba(255, 255, 255, 0.3)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '10px', 
                        fontSize: '0.85rem', 
                        color: 'var(--text-bright)', 
                        outline: 'none' 
                    }}
                />
            </div>

            {/* Client Scrollable Cards List */}
            <div 
                className="client-cards-container" 
                style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px',
                    maxHeight: 'calc(100vh - 240px)'
                }}
            >
                {loading ? (
                    <div style={{ color: 'var(--text-main)', textAlign: 'center', fontSize: '0.8rem', padding: '20px' }}>
                        <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px' }}></i>
                        Loading directory...
                    </div>
                ) : filteredClients.length === 0 ? (
                    <div style={{ color: 'var(--text-main)', textAlign: 'center', fontSize: '0.8rem', padding: '20px' }}>
                        No clients found
                    </div>
                ) : (
                    filteredClients.map(c => {
                        const isSelected = selectedClientId === c.id;
                        const lastVisitStr = c.last_visit_date ? new Date(c.last_visit_date).toLocaleDateString() : 'Never';
                        return (
                            <div 
                                key={c.id}
                                className={`client-list-card ${isSelected ? 'active' : ''}`}
                                onClick={() => onSelectClient(c.id)}
                                style={{ 
                                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)', 
                                    borderRadius: '12px', 
                                    padding: '12px 16px', 
                                    cursor: 'pointer', 
                                    background: isSelected ? 'rgba(176, 142, 81, 0.08)' : 'rgba(0, 0, 0, 0.01)',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, color: isSelected ? 'var(--accent-primary)' : 'var(--text-bright)', fontSize: '0.9rem' }}>
                                        {c.first_name} {c.last_name}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 700, background: 'rgba(222, 184, 118, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                        ID: {c.id}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span>📞 {c.phone}</span>
                                    <span>📅 Last Visit: {lastVisitStr}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Registration Overlay Modal */}
            {addModalOpen && (
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
                        onSubmit={handleSubmitAddClient}
                        className="generic-modal-card textured-element"
                        style={{
                            maxWidth: '400px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            width: '90%'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.1rem', fontFamily: "'Outfit', sans-serif" }}>
                                Register New Client
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setAddModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer', outline: 'none' }}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>First Name</label>
                            <input 
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="e.g. Priya"
                                required
                                style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Last Name</label>
                            <input 
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="e.g. Sharma"
                                required
                                style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Mobile Number</label>
                            <input 
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="e.g. 9876543210"
                                required
                                style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => setAddModalOpen(false)}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn"
                                style={{ flex: 2, padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}
                            >
                                Register Profile
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ClientDirectory;
