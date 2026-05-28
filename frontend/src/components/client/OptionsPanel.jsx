import React, { useEffect, useRef, useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { animate } from 'animejs';

const OptionsPanel = () => {
    const { 
        setShowOptions, 
        setShowCapture, 
        setCheckoutData, 
        activeClientId,
        activeConsultationId
    } = useSession();

    const panelRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Smooth entrance animation using Anime.js v4 animate
        animate(panelRef.current, {
            opacity: [0, 1],
            translateY: [20, 0],
            scale: [0.98, 1],
            duration: 800,
            easing: 'out-elastic'
        });
    }, []);

    const handleLaunchAI = () => {
        setShowOptions(false);
        setShowCapture(true);
    };

    const handleDirectCheckout = () => {
        // Direct checkout defaults to a 1200 INR styling service
        setCheckoutData({
            styleName: 'General Styling',
            amount: 1200.00,
            appointmentId: null
        });
    };

    return (
        <div 
            ref={panelRef}
            className="checkin-card textured-element" 
            id="clientOptionsPanel" 
            style={{ 
                maxWidth: '620px', 
                width: '90%',
                margin: isMobile ? '10px auto' : '40px auto', 
                padding: isMobile ? '20px 16px' : '35px', 
                borderRadius: '20px', 
                textAlign: 'center', 
                border: '1px solid var(--glass-border)', 
                background: 'var(--glass-bg)',
                opacity: 0 // Initial state for animation
            }}
        >
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '1.5rem' : '1.8rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '8px' }}>
                Select Consultation Path
            </h2>
            <p style={{ color: 'var(--text-main)', fontSize: isMobile ? '0.85rem' : '0.95rem', marginBottom: isMobile ? '20px' : '30px' }}>
                How would you like to proceed with the checked-in client?
            </p>
            
            <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px', justifyContent: 'center', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                {/* Card 1: AI Recommendation */}
                <div 
                    onClick={handleLaunchAI} 
                    className="consultation-option-card"
                    style={{ 
                        flex: 1, 
                        minWidth: isMobile ? '100%' : '240px', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '16px', 
                        padding: isMobile ? '20px 12px' : '30px 20px', 
                        cursor: 'pointer', 
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                        background: 'rgba(255, 255, 255, 0.02)' 
                    }}
                >
                    <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: isMobile ? '2rem' : '2.5rem', color: 'var(--accent-primary)', marginBottom: '12px', display: 'block' }}></i>
                    <h3 style={{ color: 'var(--text-bright)', fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 700, marginBottom: '6px' }}>AI Styling Recommendations</h3>
                    <p style={{ color: 'var(--text-main)', fontSize: '0.78rem', lineHeight: '1.4', margin: 0 }}>
                        Capture client photos to analyze facial features and retrieve AI-synthesized hairstyle suggestions.
                    </p>
                </div>
                
                {/* Card 2: Quick Checkout */}
                <div 
                    onClick={handleDirectCheckout} 
                    className="consultation-option-card"
                    style={{ 
                        flex: 1, 
                        minWidth: isMobile ? '100%' : '240px', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '16px', 
                        padding: isMobile ? '20px 12px' : '30px 20px', 
                        cursor: 'pointer', 
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                        background: 'rgba(255, 255, 255, 0.02)' 
                    }}
                >
                    <i className="fa-solid fa-credit-card" style={{ fontSize: isMobile ? '2rem' : '2.5rem', color: 'var(--accent-primary)', marginBottom: '12px', display: 'block' }}></i>
                    <h3 style={{ color: 'var(--text-bright)', fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 700, marginBottom: '6px' }}>Direct Checkout</h3>
                    <p style={{ color: 'var(--text-main)', fontSize: '0.78rem', lineHeight: '1.4', margin: 0 }}>
                        Skip the AI camera capture and proceed directly to checkout processing and appointment entry.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OptionsPanel;
