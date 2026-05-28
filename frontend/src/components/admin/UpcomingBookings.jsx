import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';

const UpcomingBookings = () => {
    const { showToast } = useSession();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${window.location.origin}/api/crm/appointments/upcoming`);
            if (res.ok) {
                const data = await res.json();
                setBookings(data || []);
            } else {
                throw new Error("Failed to load upcoming bookings.");
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to retrieve booking list.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
        // Poll every 10 seconds to keep the booking list updated
        const interval = setInterval(fetchBookings, 10000);
        return () => clearInterval(interval);
    }, []);

    const formatDateTime = (dtStr) => {
        try {
            let dt;
            if (dtStr.length === 16) {
                dt = new Date(dtStr.replace(' ', 'T'));
            } else {
                dt = new Date(dtStr);
            }
            return dt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return dtStr;
        }
    };

    return (
        <div 
            className="textured-element crm-list-sidebar" 
            style={{ 
                background: 'var(--glass-bg)', 
                border: '1px solid var(--glass-border)', 
                borderRadius: '20px', 
                padding: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '20px', 
                height: '100%', 
                boxSizing: 'border-box' 
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-bright)', margin: 0 }}>
                        Upcoming Bookings
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                        Live scheduled client appointments and stylist assignments.
                    </p>
                </div>
                
                <button 
                    className="btn btn-secondary" 
                    onClick={fetchBookings} 
                    disabled={loading}
                    style={{ padding: '8px 14px', fontSize: '0.8rem', borderRadius: '10px' }}
                >
                    {loading ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                        <i className="fa-solid fa-rotate"></i>
                    )} Refresh
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                {bookings.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', gap: '12px', color: 'var(--text-main)', padding: '20px' }}>
                        <i className="fa-solid fa-calendar-check" style={{ fontSize: '3rem', color: 'var(--glass-border)' }}></i>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>No upcoming bookings scheduled.</span>
                        <span style={{ fontSize: '0.75rem', textAlign: 'center', maxWidth: '300px' }}>When clients schedule consultations via WhatsApp chatbot, they will show up here.</span>
                    </div>
                ) : (
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '550px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
                                    <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Appt ID</th>
                                    <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</th>
                                    <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stylist</th>
                                    <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service</th>
                                    <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scheduled Date / Time</th>
                                    <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((booking) => (
                                    <tr 
                                        key={booking.id}
                                        style={{ 
                                            borderBottom: '1px solid rgba(176, 142, 81, 0.08)',
                                            transition: 'background 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(222, 184, 118, 0.04)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-bright)', fontWeight: 700 }}>
                                            #{booking.id}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{booking.first_name} {booking.last_name}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>{booking.phone}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                            {booking.stylist_first ? `${booking.stylist_first} ${booking.stylist_last}` : 'Any Available Stylist'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-bright)', fontWeight: 500 }}>
                                            {booking.service_name}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                            {formatDateTime(booking.appointment_datetime)}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                                            <span 
                                                style={{ 
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px', 
                                                    borderRadius: '20px', 
                                                    fontSize: '0.7rem', 
                                                    fontWeight: 700, 
                                                    background: 'rgba(222, 184, 118, 0.1)', 
                                                    color: 'var(--accent-primary)',
                                                    border: '1px solid rgba(222, 184, 118, 0.3)',
                                                    textTransform: 'uppercase'
                                                }}
                                            >
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
                                                Scheduled
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpcomingBookings;
