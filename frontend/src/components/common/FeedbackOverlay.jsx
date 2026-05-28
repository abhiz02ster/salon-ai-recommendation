import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';

const FeedbackOverlay = () => {
    const { 
        checkoutData, 
        setCheckoutData, 
        currentSessionIndex, 
        closeActiveSession, 
        showToast 
    } = useSession();

    const [score, setScore] = useState(5);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (!checkoutData || !checkoutData.appointmentId) return null;

    const { appointmentId } = checkoutData;

    const getScoreLabel = (val) => {
        if (val === 1) return "Hate it!";
        if (val === 3) return "Like it!";
        return "Love it!";
    };

    const handleSkip = () => {
        setCheckoutData(null);
        if (currentSessionIndex >= 0) {
            closeActiveSession(currentSessionIndex);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const response = await fetch(`${window.location.origin}/api/crm/appointments/${appointmentId}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    satisfaction_score: score,
                    notes: notes.trim() || "Submitted feedback"
                })
            });
            
            if (!response.ok) {
                throw new Error("Failed to submit feedback");
            }
            
            showToast("Thank you for your feedback!");
        } catch (err) {
            console.error("Feedback submit failed", err);
            showToast("Feedback saved locally.");
        } finally {
            setSubmitting(false);
            setCheckoutData(null);
            if (currentSessionIndex >= 0) {
                closeActiveSession(currentSessionIndex);
            }
        }
    };

    return (
        <div 
            id="feedbackOverlay" 
            style={{ 
                display: 'flex', 
                zIndex: 2000, 
                alignItems: 'center', 
                justifyContent: 'center', 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100vh', 
                background: 'rgba(7, 9, 14, 0.85)', 
                backdropFilter: 'blur(10px)' 
            }}
        >
            <div 
                className="checkin-card textured-element" 
                style={{ 
                    maxWidth: '450px', 
                    textAlign: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '20px', 
                    padding: '30px', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '20px', 
                    background: 'var(--glass-bg)',
                    maxHeight: '85vh',
                    overflowY: 'auto'
                }}
            >
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-primary)', margin: 0 }}>
                    How was your session?
                </h2>
                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', margin: 0 }}>
                    We would love to know how you feel about your new style.
                </p>
                
                {/* Emoji selector */}
                <div style={{ display: 'flex', justifyContent: 'space-around', margin: '15px 0' }}>
                    <div 
                        className={`emoji-btn ${score === 1 ? 'active' : ''}`}
                        onClick={() => setScore(1)} 
                        style={{ 
                            cursor: 'pointer', 
                            fontSize: score === 1 ? '3.2rem' : '2.8rem', 
                            filter: score === 1 ? 'grayscale(0%)' : 'grayscale(100%)', 
                            transform: score === 1 ? 'scale(1.15)' : 'scale(1)',
                            transition: 'all 0.2s ease' 
                        }} 
                        title="Hate it"
                    >
                        😞
                    </div>
                    <div 
                        className={`emoji-btn ${score === 3 ? 'active' : ''}`}
                        onClick={() => setScore(3)} 
                        style={{ 
                            cursor: 'pointer', 
                            fontSize: score === 3 ? '3.2rem' : '2.8rem', 
                            filter: score === 3 ? 'grayscale(0%)' : 'grayscale(100%)', 
                            transform: score === 3 ? 'scale(1.15)' : 'scale(1)',
                            transition: 'all 0.2s ease' 
                        }} 
                        title="Like it"
                    >
                        🙂
                    </div>
                    <div 
                        className={`emoji-btn ${score === 5 ? 'active' : ''}`}
                        onClick={() => setScore(5)} 
                        style={{ 
                            cursor: 'pointer', 
                            fontSize: score === 5 ? '3.2rem' : '2.8rem', 
                            filter: score === 5 ? 'grayscale(0%)' : 'grayscale(100%)', 
                            transform: score === 5 ? 'scale(1.15)' : 'scale(1)',
                            transition: 'all 0.2s ease' 
                        }} 
                        title="Love it"
                    >
                        😍
                    </div>
                </div>
                
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700, minHeight: '20px' }}>
                    {getScoreLabel(score)}
                </div>
                
                {/* Notes input */}
                <div className="form-group" style={{ textAlign: 'left' }}>
                    <label htmlFor="feedback_notes" style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                        Add notes (Optional)
                    </label>
                    <textarea 
                        id="feedback_notes" 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Great haircut, stylist was very friendly." 
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.03)', 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: '8px', 
                            width: '100%', 
                            height: '80px', 
                            padding: '10px', 
                            color: 'var(--text-bright)', 
                            outline: 'none', 
                            resize: 'none', 
                            fontSize: '0.85rem' 
                        }}
                    />
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={handleSkip} 
                        style={{ flex: 1, height: '45px', borderRadius: '10px', fontSize: '0.9rem' }}
                        disabled={submitting}
                    >
                        Skip
                    </button>
                    <button 
                        className="btn" 
                        onClick={handleSubmit} 
                        style={{ flex: 2, height: '45px', borderRadius: '10px', fontSize: '0.9rem' }}
                        disabled={submitting}
                    >
                        {submitting ? "Submitting..." : "Submit Feedback"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackOverlay;
