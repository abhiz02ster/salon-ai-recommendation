import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';

const CheckoutModal = () => {
    const {
        checkoutData,
        setCheckoutData,
        activeClientId,
        activeConsultationId,
        showToast
    } = useSession();

    const [amount, setAmount] = useState(1200.00);
    const [paymentMethod, setPaymentMethod] = useState("card");
    const [upiQrUrl, setUpiQrUrl] = useState("");
    const [processing, setProcessing] = useState(false);

    // Stylist & Availability states
    const [stylistList, setStylistList] = useState([]);
    const [selectedStylist, setSelectedStylist] = useState("auto");
    const [appointmentDateTime, setAppointmentDateTime] = useState(() => {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
        return localISOTime;
    });
    const [stylistBookings, setStylistBookings] = useState([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Fetch stylists list when modal opens
    useEffect(() => {
        if (checkoutData) {
            const fetchStaff = async () => {
                try {
                    const res = await fetch(`${window.location.origin}/api/staff`);
                    if (res.ok) {
                        const data = await res.json();
                        setStylistList(data.staff || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch staff list", err);
                }
            };
            fetchStaff();

            // Set default stylist to the active header stylist if there is one
            const activeHeaderStylistId = localStorage.getItem('logged_in_stylist_id');
            if (activeHeaderStylistId) {
                setSelectedStylist(activeHeaderStylistId);
            } else {
                setSelectedStylist("auto");
            }
        }
    }, [checkoutData]);

    // Fetch availability schedule for the selected stylist on the selected date
    const fetchStylistAvailability = async (staffId, dateTimeStr) => {
        if (!staffId || staffId === 'auto') {
            setStylistBookings([]);
            return;
        }
        setLoadingAvailability(true);
        try {
            const res = await fetch(`${window.location.origin}/api/staff/metrics?staff_id=${staffId}`);
            if (res.ok) {
                const data = await res.json();
                const appts = data.appointments || [];
                const targetDate = dateTimeStr.split('T')[0];
                const filtered = appts.filter(a => a.appointment_datetime.startsWith(targetDate));
                setStylistBookings(filtered);
            }
        } catch (err) {
            console.error("Failed to load availability metrics", err);
        } finally {
            setLoadingAvailability(false);
        }
    };

    useEffect(() => {
        if (selectedStylist !== 'auto') {
            fetchStylistAvailability(selectedStylist, appointmentDateTime);
        }
    }, [selectedStylist, appointmentDateTime]);

    // Update UPI Link & QR Code URL
    useEffect(() => {
        if (paymentMethod === 'upi') {
            const upiId = "masterstylist@okaxis";
            const merchantName = "Master Stylist Salon";
            const note = "Styling Consultation Session";
            const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&tn=${encodeURIComponent(note)}&cu=INR`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`;
            setUpiQrUrl(qrUrl);
        }
    }, [paymentMethod, amount]);

    if (!checkoutData || checkoutData.appointmentId) return null;

    const { styleName } = checkoutData;

    const handleClose = () => {
        setCheckoutData(null);
    };

    // Auto-allocate based on availability (stylist with fewest appointments on selected date)
    const handleAutoAllocate = async (selectedDate) => {
        try {
            const staffRes = await fetch(`${window.location.origin}/api/staff`);
            if (!staffRes.ok) return null;
            const staffData = await staffRes.json();
            const staffList = staffData.staff || [];
            if (staffList.length === 0) return null;

            const workloads = await Promise.all(staffList.map(async (st) => {
                try {
                    const metricsRes = await fetch(`${window.location.origin}/api/staff/metrics?staff_id=${st.id}`);
                    if (!metricsRes.ok) return { id: st.id, count: 0 };
                    const metricsData = await metricsRes.json();
                    const appts = metricsData.appointments || [];
                    const targetDateStr = selectedDate.split('T')[0];
                    const count = appts.filter(a => a.appointment_datetime.startsWith(targetDateStr)).length;
                    return { id: st.id, count };
                } catch {
                    return { id: st.id, count: 0 };
                }
            }));

            workloads.sort((a, b) => a.count - b.count);
            return workloads[0].id;
        } catch (err) {
            console.error("Auto-allocation failed", err);
            return null;
        }
    };

    const handleCompletePayment = async () => {
        if (!activeClientId) {
            showToast("No active client ID to book appointment.");
            return;
        }

        setProcessing(true);
        const targetConsultationId = activeConsultationId || 0;

        try {
            let finalStaffId = null;
            if (selectedStylist === 'auto') {
                finalStaffId = await handleAutoAllocate(appointmentDateTime);
            } else {
                finalStaffId = parseInt(selectedStylist, 10);
            }

            const res = await fetch(`${window.location.origin}/api/crm/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: activeClientId,
                    appointment_date: new Date(appointmentDateTime).toISOString(),
                    consultation_id: targetConsultationId,
                    total_amount: amount,
                    payment_method: paymentMethod,
                    staff_id: finalStaffId
                })
            });

            if (!res.ok) {
                throw new Error("Failed to checkout appointment on server");
            }

            const data = await res.json();
            const staffName = selectedStylist === 'auto' 
                ? (stylistList.find(st => st.id === finalStaffId)?.first_name || `#${finalStaffId}`)
                : (stylistList.find(st => st.id === finalStaffId)?.first_name || `#${finalStaffId}`);
            
            showToast(`Checkout complete! Assigned Stylist: ${staffName}. Earned ${data.loyalty_points_earned} points.`);
            
            setCheckoutData(prev => ({
                ...prev,
                appointmentId: data.appointment_id
            }));

        } catch (err) {
            console.error(err);
            showToast("Checkout failed: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div 
            className="generic-modal-overlay show"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100vh',
                zIndex: 2000,
                background: 'rgba(7, 9, 14, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <div 
                className="generic-modal-card textured-element"
                style={{
                    maxWidth: '450px',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '20px',
                    padding: '24px',
                    width: '90%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxHeight: '85vh',
                    overflowY: 'auto'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.25rem', fontFamily: "'Outfit', sans-serif" }}>
                        💳 Styling Appointment Checkout
                    </h3>
                    <button 
                        onClick={handleClose}
                        style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer', outline: 'none' }}
                        disabled={processing}
                    >
                        &times;
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Style Name Display */}
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Confirmed Hairstyle Service</label>
                        <input 
                            type="text" 
                            value={styleName} 
                            disabled 
                            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem' }}
                        />
                    </div>

                    {/* Amount Input */}
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Total Billing Amount (INR)</label>
                        <input 
                            type="number" 
                            value={amount} 
                            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                            style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                        />
                    </div>

                    {/* Appointment Date & Time Picker */}
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Appointment Date & Time</label>
                        <input 
                            type="datetime-local" 
                            value={appointmentDateTime} 
                            onChange={(e) => setAppointmentDateTime(e.target.value)}
                            style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                        />
                    </div>

                    {/* Stylist Selector */}
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Assign Stylist</label>
                        <select 
                            value={selectedStylist} 
                            onChange={(e) => setSelectedStylist(e.target.value)}
                            style={{ padding: '8px 12px', background: 'rgba(7, 9, 14, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                        >
                            <option value="auto">✨ Auto-allocate based on availability</option>
                            {stylistList.map(st => (
                                <option key={st.id} value={st.id} style={{ color: '#000' }}>
                                    👤 {st.first_name} {st.last_name} ({st.specialty || 'Generalist'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Stylist Daily Availability Schedule Preview */}
                    {selectedStylist !== 'auto' && (
                        <div 
                            style={{ 
                                padding: '10px 14px', 
                                background: 'rgba(255, 255, 255, 0.02)', 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: '12px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '6px',
                                textAlign: 'left'
                            }}
                        >
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                📅 Bookings for {appointmentDateTime.split('T')[0]}:
                            </span>
                            {loadingAvailability ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>
                                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Checking bookings...
                                </span>
                            ) : stylistBookings.length === 0 ? (
                                <span style={{ fontSize: '0.75rem', color: '#5cd699', fontWeight: 600 }}>
                                    ✓ Fully available! No other bookings today.
                                </span>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '80px', overflowY: 'auto' }}>
                                    {stylistBookings.map(b => {
                                        const timeStr = new Date(b.appointment_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        return (
                                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-bright)', borderBottom: '1px solid rgba(255, 255, 255, 0.02)', paddingBottom: '2px' }}>
                                                <span>⏰ {timeStr}</span>
                                                <span style={{ color: 'var(--text-main)' }}>({b.service_name})</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment Mode Selector */}
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginBottom: '4px' }}>Select Payment Method</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                type="button"
                                className={`btn ${paymentMethod === 'card' ? '' : 'btn-secondary'}`}
                                onClick={() => setPaymentMethod('card')}
                                style={{ 
                                    flex: 1, 
                                    fontSize: '0.8rem', 
                                    height: '38px', 
                                    borderRadius: '8px',
                                    border: paymentMethod === 'card' ? '1px solid var(--accent-primary)' : '1px solid transparent'
                                }}
                            >
                                Credit/Debit
                            </button>
                            <button 
                                type="button"
                                className={`btn ${paymentMethod === 'cash' ? '' : 'btn-secondary'}`}
                                onClick={() => setPaymentMethod('cash')}
                                style={{ 
                                    flex: 1, 
                                    fontSize: '0.8rem', 
                                    height: '38px', 
                                    borderRadius: '8px',
                                    border: paymentMethod === 'cash' ? '1px solid var(--accent-primary)' : '1px solid transparent'
                                }}
                            >
                                Cash
                            </button>
                            <button 
                                type="button"
                                className={`btn ${paymentMethod === 'upi' ? '' : 'btn-secondary'}`}
                                onClick={() => setPaymentMethod('upi')}
                                style={{ 
                                    flex: 1, 
                                    fontSize: '0.8rem', 
                                    height: '38px', 
                                    borderRadius: '8px',
                                    border: paymentMethod === 'upi' ? '1px solid var(--accent-primary)' : '1px solid transparent'
                                }}
                            >
                                UPI QR
                            </button>
                        </div>
                    </div>

                    {/* UPI QR Display container */}
                    {paymentMethod === 'upi' && upiQrUrl && (
                        <div 
                            style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                gap: '8px', 
                                background: 'rgba(255,255,255,0.02)', 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: '12px', 
                                padding: '12px' 
                            }}
                        >
                            <img 
                                src={upiQrUrl} 
                                alt="UPI Payment QR Code" 
                                style={{ border: '4px solid #fff', borderRadius: '4px' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>
                                Scan this dynamic code on any UPI application
                            </span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={handleClose}
                        style={{ flex: 1, borderRadius: '8px', height: '42px' }}
                        disabled={processing}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className="btn" 
                        onClick={handleCompletePayment}
                        style={{ flex: 2, borderRadius: '8px', height: '42px' }}
                        disabled={processing}
                    >
                        {processing ? "Processing..." : paymentMethod === 'upi' ? "Confirm UPI Payment" : "Complete Payment"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
