import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';

const RecommendationsCarousel = ({ onRefineStart, onRefineEnd }) => {
    const {
        currentRecommendationsData,
        setCurrentRecommendationsData,
        activeClientId,
        activeConsultationId,
        setCheckoutData,
        showToast,
        setClientHistory
    } = useSession();

    const [activeIndex, setActiveIndex] = useState(0);
    const [refineFeedback, setRefineFeedback] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [mediaTab, setMediaTab] = useState("image"); // "image" or "video"

    if (!currentRecommendationsData || !currentRecommendationsData.recommendations) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-main)' }}>
                <i className="fa-solid fa-face-frown" style={{ fontSize: '3rem', marginBottom: '15px', color: 'var(--accent-primary)' }}></i>
                <h3>No recommendations found for this session.</h3>
            </div>
        );
    }

    const { recommendations, analysis_details } = currentRecommendationsData;
    const currentRec = recommendations[activeIndex];

    const nextCard = () => {
        setActiveIndex((prev) => (prev + 1) % recommendations.length);
        setMediaTab("image");
    };

    const prevCard = () => {
        setActiveIndex((prev) => (prev - 1 + recommendations.length) % recommendations.length);
        setMediaTab("image");
    };

    // Reload Client History API
    const reloadHistory = async () => {
        if (!activeClientId) return;
        try {
            const res = await fetch(`${window.location.origin}/history?client_id=${activeClientId}`);
            if (res.ok) {
                const data = await res.json();
                setClientHistory(data.history || []);
            }
        } catch (err) {
            console.error("Failed to reload history:", err);
        }
    };

    // Apply Card Refinement
    const handleRefine = async () => {
        if (!refineFeedback.trim() || !activeConsultationId) return;
        setSubmitting(true);
        if (onRefineStart) onRefineStart();
        
        try {
            const response = await fetch(`${window.location.origin}/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    consultation_id: activeConsultationId,
                    feedback: refineFeedback.trim()
                })
            });

            if (!response.ok) {
                throw new Error(`Refinement error: ${response.statusText}`);
            }

            const data = await response.json();
            setCurrentRecommendationsData(data);
            setRefineFeedback("");
            showToast("Recommendations refined successfully!");
        } catch (err) {
            console.error(err);
            showToast("Failed to refine recommendation: " + err.message);
        } finally {
            setSubmitting(false);
            if (onRefineEnd) onRefineEnd();
        }
    };

    // Confirm Style Choice
    const handleConfirmSelection = async (styleName) => {
        if (!activeClientId || !activeConsultationId) return;
        setSubmitting(true);
        
        try {
            const response = await fetch(`${window.location.origin}/confirm-style`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: activeClientId,
                    consultation_id: activeConsultationId,
                    style_name: styleName
                })
            });

            if (!response.ok) {
                throw new Error(`Confirmation error: ${response.statusText}`);
            }

            const resData = await response.json();
            if (resData.success) {
                // Update local confirmed state inside the currentRecommendationsData
                setCurrentRecommendationsData(prev => ({
                    ...prev,
                    confirmed_style: styleName
                }));
                showToast(`Confirmed style: ${styleName}!`);
                await reloadHistory();
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to confirm selection: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Open Checkout payment overlay
    const handleCheckout = (styleName) => {
        setCheckoutData({
            styleName: styleName,
            amount: 1200.00,
            appointmentId: null
        });
    };

    return (
        <div className="recommendations-container" style={{ animation: 'fadeIn 0.6s ease-out' }}>
            {/* Analysis Details Panel */}
            {analysis_details && (
                <div 
                    className="textured-element" 
                    style={{ 
                        background: 'rgba(255, 255, 255, 0.3)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '16px', 
                        padding: '16px 20px', 
                        marginBottom: '20px', 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '24px', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        fontSize: '0.85rem' 
                    }}
                >
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ color: 'var(--text-main)', marginRight: '6px' }}>Face Shape:</span>
                            <strong style={{ color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
                                {analysis_details.face_shape || "Oval"}
                            </strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-main)', marginRight: '6px' }}>Hair Type:</span>
                            <strong style={{ color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
                                {analysis_details.hair_type || "Wavy"}
                            </strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-main)', marginRight: '6px' }}>Skin Tone:</span>
                            <strong style={{ color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
                                {analysis_details.skin_tone || "Neutral"}
                            </strong>
                        </div>
                    </div>
                    <div style={{ color: 'var(--text-main)', fontSize: '0.75rem' }}>
                        <i className="fa-solid fa-clock" style={{ marginRight: '6px' }}></i>
                        Facial Analysis completed via Gemini Vision API
                    </div>
                </div>
            )}

            {/* Carousel Content Body */}
            <div className="recommendations-grid">
                
                {/* Left Side: 3D Visualizer & Slider selectors */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Visualizer card replaced with Media Preview Panel */}
                    <div 
                        className="textured-element" 
                        style={{ 
                            background: 'var(--glass-bg)', 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: '20px', 
                            padding: '16px', 
                            position: 'relative',
                            height: '350px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header Tabs inside the card */}
                        {currentRec && currentRec.video_url && (
                            <div 
                                style={{ 
                                    position: 'absolute', 
                                    top: '12px', 
                                    right: '12px', 
                                    display: 'flex', 
                                    gap: '6px', 
                                    zIndex: 10,
                                    background: 'rgba(0,0,0,0.5)',
                                    padding: '4px',
                                    borderRadius: '10px',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <button 
                                    onClick={() => setMediaTab("image")}
                                    style={{
                                        border: 'none',
                                        background: mediaTab === 'image' ? 'var(--accent-primary)' : 'transparent',
                                        color: mediaTab === 'image' ? 'var(--text-dark)' : 'var(--text-bright)',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <i className="fa-solid fa-image" style={{ marginRight: '4px' }}></i> Photo
                                </button>
                                <button 
                                    onClick={() => setMediaTab("video")}
                                    style={{
                                        border: 'none',
                                        background: mediaTab === 'video' ? 'var(--accent-primary)' : 'transparent',
                                        color: mediaTab === 'video' ? 'var(--text-dark)' : 'var(--text-bright)',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <i className="fa-solid fa-circle-play" style={{ marginRight: '4px' }}></i> Runway Video
                                </button>
                            </div>
                        )}

                        {/* Media display */}
                        {currentRec ? (
                            mediaTab === 'video' && currentRec.video_url ? (
                                <video 
                                    src={currentRec.video_url}
                                    controls
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        borderRadius: '14px'
                                    }}
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                    {currentRec.visualization_url ? (
                                        <img 
                                            src={currentRec.visualization_url} 
                                            alt={currentRec.style_name}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                borderRadius: '14px'
                                            }}
                                        />
                                    ) : (
                                        // Skeleton/Blueprint visualizer while image is blank
                                        <div 
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                borderRadius: '14px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--text-main)',
                                                gap: '12px'
                                            }}
                                        >
                                            <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: '2.5rem', color: 'var(--accent-primary)', animation: 'pulse 2s infinite' }}></i>
                                            <span style={{ fontSize: '0.8rem' }}>Generating styling mockup...</span>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : null}
                        
                        {/* Suitability score badge */}
                        {currentRec && (
                            <div 
                                style={{ 
                                    position: 'absolute', 
                                    bottom: '12px', 
                                    left: '12px', 
                                    background: 'rgba(0, 0, 0, 0.65)', 
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#deb876', // Gold tint
                                    fontWeight: 700, 
                                    fontSize: '0.75rem', 
                                    padding: '4px 10px', 
                                    borderRadius: '20px',
                                    backdropFilter: 'blur(5px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    zIndex: 5
                                }}
                            >
                                <i className="fa-solid fa-star" style={{ color: '#deb876' }}></i>
                                Match: {currentRec.suitability_score > 1.0 ? Math.round(currentRec.suitability_score) : Math.round((currentRec.suitability_score || 0.9) * 100)}%
                            </div>
                        )}
                    </div>

                    {/* Carousel navigation controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.02)', padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <button className="btn btn-secondary" onClick={prevCard} style={{ padding: '8px 16px', borderRadius: '8px', minWidth: 'auto' }}>
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                            Suggestion {activeIndex + 1} of {recommendations.length}
                        </span>
                        <button className="btn btn-secondary" onClick={nextCard} style={{ padding: '8px 16px', borderRadius: '8px', minWidth: 'auto' }}>
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    {/* Carousel bullet indicators */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        {recommendations.map((_, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => {
                                    setActiveIndex(idx);
                                    setMediaTab("image");
                                }}
                                style={{ 
                                    width: idx === activeIndex ? '24px' : '8px', 
                                    height: '8px', 
                                    borderRadius: '4px', 
                                    background: idx === activeIndex ? 'var(--accent-primary)' : 'var(--glass-border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Right Side: Recommendation Details, refinement, check-out */}
                {currentRec && (
                    <div 
                        className="textured-element" 
                        style={{ 
                            background: 'var(--glass-bg)', 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: '20px', 
                            padding: '30px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '24px',
                            animation: 'slideInRight 0.4s ease-out'
                        }}
                    >
                        <div>
                            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-primary)', margin: '0 0 8px 0' }}>
                                {currentRec.style_name}
                            </h2>
                            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                {currentRec.description}
                            </p>
                        </div>

                        {/* Suitability Reasoning */}
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Why it fits your profile:
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                {currentRec.reasoning && currentRec.reasoning.map((reason, idx) => (
                                    <li key={idx} style={{ marginBottom: '4px' }}>{reason}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Maintenance Tips */}
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Maintenance & Tips:
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                {currentRec.maintenance_tips && currentRec.maintenance_tips.map((tip, idx) => (
                                    <li key={idx} style={{ marginBottom: '4px' }}>{tip}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Products Needed */}
                        {currentRec.products_needed && currentRec.products_needed.length > 0 && (
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Styling Products Needed:
                                </h4>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                    {currentRec.products_needed.map((prod, idx) => {
                                        const status = currentRec.products_status && currentRec.products_status[idx];
                                        return (
                                            <li 
                                                key={idx} 
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between', 
                                                    gap: '12px',
                                                    padding: '6px 12px',
                                                    background: 'rgba(255, 255, 255, 0.01)',
                                                    border: '1px solid rgba(255, 255, 255, 0.03)',
                                                    borderRadius: '8px',
                                                    marginBottom: '6px'
                                                }}
                                            >
                                                <span>{prod}</span>
                                                {status && (
                                                    status.in_stock ? (
                                                        <span style={{ fontSize: '0.65rem', background: 'rgba(86, 219, 149, 0.1)', color: '#56db95', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid rgba(86, 219, 149, 0.2)' }}>
                                                            In Stock
                                                        </span>
                                                    ) : status.substitute_found ? (
                                                        <span 
                                                            style={{ fontSize: '0.65rem', background: 'rgba(232, 169, 88, 0.12)', color: '#e8a958', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid rgba(232, 169, 88, 0.2)' }}
                                                            title={`Substituted with ${status.substitute_name}`}
                                                        >
                                                            Out of Stock - Substituted
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.65rem', background: 'rgba(255, 74, 74, 0.1)', color: '#ff8080', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid rgba(255, 74, 74, 0.2)' }}>
                                                            Out of Stock
                                                        </span>
                                                    )
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '5px 0' }} />

                        {/* Refinement Inputs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-bright)' }}>
                                Adjust style options (Regenerate suggestions)
                            </h4>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <textarea 
                                    value={refineFeedback}
                                    onChange={(e) => setRefineFeedback(e.target.value)}
                                    placeholder="e.g. Make the sides shorter, give me more volume on top, or try layers..."
                                    disabled={submitting}
                                    style={{ 
                                        flex: 1, 
                                        background: 'rgba(255, 255, 255, 0.4)', 
                                        border: '1px solid var(--glass-border)', 
                                        borderRadius: '10px', 
                                        padding: '10px', 
                                        color: 'var(--text-bright)', 
                                        outline: 'none', 
                                        fontSize: '0.85rem',
                                        height: '55px',
                                        resize: 'none'
                                    }}
                                />
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={handleRefine}
                                    disabled={submitting || !refineFeedback.trim()}
                                    style={{ width: '100px', height: '55px', fontSize: '0.8rem', borderRadius: '10px' }}
                                >
                                    {submitting ? "Refining..." : "Refine"}
                                </button>
                            </div>
                        </div>

                        {/* Confirm / Checkout selection button */}
                        <div id={`confirm_box_${activeIndex}`} style={{ marginTop: '10px' }}>
                            {currentRecommendationsData.confirmed_style === currentRec.style_name ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ background: 'rgba(86, 219, 149, 0.1)', border: '1px solid #56db95', borderRadius: '12px', padding: '12px', textAlign: 'center', color: '#56db95', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                        <i className="fa-solid fa-circle-check"></i>
                                        <span>Style Choice Confirmed!</span>
                                    </div>
                                    <button 
                                        className="btn" 
                                        style={{ width: '100%', borderRadius: '12px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
                                        onClick={() => handleCheckout(currentRec.style_name)}
                                    >
                                        <i className="fa-solid fa-credit-card"></i> 
                                        Complete Session & Checkout
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ width: '100%', borderRadius: '12px', height: '45px' }} 
                                    onClick={() => handleConfirmSelection(currentRec.style_name)}
                                    disabled={submitting}
                                >
                                    Confirm Style Selection
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecommendationsCarousel;
