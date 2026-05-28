import React, { useEffect, useRef, useState } from 'react';
import { useSession } from '../../context/SessionContext';

const CameraCapture = () => {
    const { 
        capturedPhotos, 
        setCapturedPhotos, 
        showToast 
    } = useSession();

    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("");
    const [previewUrl, setPreviewUrl] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraInitFailed, setCameraInitFailed] = useState(false);

    const isSecure = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

    // Enumerate video devices
    useEffect(() => {
        if (!isSecure) return;
        const getDevices = async () => {
            try {
                // Request temporary permission to list full labels
                const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const deviceList = await navigator.mediaDevices.enumerateDevices();
                
                // Immediately release temporary stream tracks so we don't block the camera hardware
                tempStream.getTracks().forEach(track => track.stop());
                
                const videoDevices = deviceList.filter(d => d.kind === 'videoinput');
                setDevices(videoDevices);
                if (videoDevices.length > 0) {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                }
            } catch (err) {
                console.error("Error enumerating devices:", err);
                showToast("Could not access camera devices list.");
            }
        };
        getDevices();
    }, []);

    // Start webcam stream when selectedDeviceId or camera status changes
    const startCamera = async (deviceId = selectedDeviceId) => {
        if (!isSecure) {
            setCameraInitFailed(true);
            return;
        }
        
        // Stop current stream if running
        stopCamera();

        const constraints = {
            video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }
        };

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play().catch(playErr => console.error("Error playing video feed:", playErr));
            }
            setCameraActive(true);
            setPreviewUrl(null); // Clear preview when camera reactivates
            setCameraInitFailed(false);
        } catch (err) {
            console.error("Failed to start webcam:", err);
            // Fallback constraints if exact device ID failed
            if (deviceId) {
                try {
                    const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    setStream(fallbackStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = fallbackStream;
                        videoRef.current.play().catch(playErr => console.error("Error playing fallback video feed:", playErr));
                    }
                    setCameraActive(true);
                    setPreviewUrl(null);
                    setCameraInitFailed(false);
                    return;
                } catch (fallbackErr) {
                    console.error("Fallback webcam failed:", fallbackErr);
                }
            }
            setCameraInitFailed(true);
            showToast("Camera access failed. Using upload/capture fallback.");
        }
    };

    // Stop webcam stream helper
    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    // Auto-start camera when view mounts
    useEffect(() => {
        if (!isSecure) {
            setCameraInitFailed(true);
            return;
        }
        
        if (!capturedPhotos.front) {
            startCamera(selectedDeviceId);
        }
        
        // Cleanup function: Auto-release camera tracks when component unmounts
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [selectedDeviceId]);

    // Handle device change
    const handleDeviceChange = (e) => {
        const id = e.target.value;
        setSelectedDeviceId(id);
        startCamera(id);
    };

    // Capture photo from video stream
    const capturePhoto = () => {
        if (!videoRef.current || !cameraActive) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        // Mirror snap for natural selfie preview matching video mirror element
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                setCapturedPhotos({ front: blob });
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                
                // Immediately shut down camera tracks for privacy and resource release
                stopCamera();
                showToast("Portrait captured and camera released.");
            }
        }, 'image/jpeg');
    };

    // Reactivate the camera to retake photo
    const handleReactivate = () => {
        setCapturedPhotos({ front: null });
        setPreviewUrl(null);
        setCameraInitFailed(false);
        if (isSecure) {
            startCamera();
        }
    };

    // Handle file upload fallback for insecure HTTP connections
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCapturedPhotos({ front: file });
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            showToast("Portrait uploaded successfully.");
        }
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const displayWebcam = isSecure && !cameraInitFailed;

    return (
        <div className="capture-panel" id="capturePanel" style={{ display: 'block' }}>
            <div className="section-title">
                <span>📸 Client Face Profile Capture</span>
            </div>

            <div className="camera-grid" style={{ gap: '20px', marginTop: '20px' }}>
                {/* Video Feed & Preview Side */}
                <div 
                    className="camera-feed-box" 
                    id="webcamFeedBox"
                    style={{
                        position: 'relative',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        aspectRatio: '4/3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {displayWebcam && cameraActive && (
                        <video 
                            ref={videoRef}
                            id="webcam" 
                            autoPlay 
                            playsInline 
                            muted
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                transform: 'scaleX(-1)' // mirror display
                            }}
                        ></video>
                    )}

                    {/* Preview Image showing the snapped photo */}
                    {previewUrl && (
                        <img 
                            src={previewUrl} 
                            alt="Captured front portrait" 
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                display: 'block',
                                animation: 'fadeIn 0.5s ease-out'
                            }}
                        />
                    )}

                    {/* Camera Privacy Overlay (when camera is stopped and no preview) */}
                    {displayWebcam && !cameraActive && !previewUrl && (
                        <div 
                            id="cameraDeactivatedPlaceholder" 
                            style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                textAlign: 'center', 
                                gap: '16px', 
                                padding: '30px', 
                                width: '100%', 
                                height: '100%' 
                            }}
                        >
                            <i className="fa-solid fa-eye-slash" style={{ fontSize: '3.2rem', color: 'var(--accent-primary)', opacity: 0.85 }}></i>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-bright)' }}>Camera Privacy Mode Active</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', maxWidth: '280px', lineHeight: '1.4' }}>
                                Webcam stream is disabled to protect client privacy. Click 'Reactivate Camera' to take a new photo.
                            </span>
                        </div>
                    )}

                    {/* HTTP Insecure Context or Permission Block Fallback Overlay */}
                    {!displayWebcam && !previewUrl && (
                        <div 
                            id="cameraHttpPlaceholder" 
                            style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                textAlign: 'center', 
                                gap: '16px', 
                                padding: '30px', 
                                width: '100%', 
                                height: '100%' 
                            }}
                        >
                            <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '3.2rem', color: 'var(--accent-primary)', opacity: 0.85 }}></i>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>Camera Access Fallback Mode</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', maxWidth: '320px', lineHeight: '1.4' }}>
                                The browser has blocked live video stream access (due to local HTTP insecure origin or permissions). You can still capture or upload a portrait using your device camera.
                            </span>
                        </div>
                    )}
                </div>

                {/* Control Panel / Instructions Side */}
                <div 
                    className="textured-element" 
                    style={{ 
                        background: 'var(--glass-bg)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '16px', 
                        padding: '24px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between',
                        height: 'auto'
                    }}
                >
                    <div>
                        <h3 style={{ margin: '0 0 10px 0', fontFamily: "'Outfit', sans-serif", fontSize: '1.2rem', color: 'var(--text-bright)' }}>
                            Stylist Camera Controls
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                            {displayWebcam ? (
                                "Ensure the client is facing the camera directly in normal indoor lighting. The camera feeds are mirrored to simulate a professional styling mirror."
                            ) : (
                                "Your browser has disabled webcam stream access because the origin is insecure (HTTP) or permissions were denied. Tap the button below to use your device's native camera or upload a saved portrait."
                            )}
                        </p>
                        
                        {displayWebcam && (
                            <div style={{ marginTop: '20px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                                    Video Input Device
                                </label>
                                <select 
                                    value={selectedDeviceId}
                                    onChange={handleDeviceChange}
                                    className="btn btn-secondary" 
                                    style={{ 
                                        width: '100%', 
                                        padding: '8px 12px', 
                                        fontSize: '0.85rem', 
                                        borderRadius: '8px',
                                        background: 'rgba(255, 255, 255, 0.4)',
                                        color: 'var(--text-bright)',
                                        border: '1px solid var(--glass-border)'
                                    }}
                                >
                                    {devices.map((device, index) => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${index + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {!displayWebcam && (
                            <div style={{
                                marginTop: '16px',
                                padding: '12px',
                                background: 'rgba(222, 184, 118, 0.08)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '10px',
                                color: 'var(--accent-primary)',
                                fontSize: '0.75rem',
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center'
                            }}>
                                <i className="fa-solid fa-circle-exclamation"></i>
                                <span>Native Camera / File Upload Active</span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                        {/* Hidden Native File Input Fallback */}
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="user"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />

                        {displayWebcam ? (
                            cameraActive ? (
                                <button 
                                    className="btn" 
                                    id="captureBtn" 
                                    onClick={capturePhoto}
                                    style={{ width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <i className="fa-solid fa-camera"></i>
                                    Capture Photo
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-secondary" 
                                    id="captureBtn" 
                                    onClick={handleReactivate}
                                    style={{ width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <i className="fa-solid fa-arrows-rotate"></i>
                                    Reactivate Camera
                                </button>
                            )
                        ) : (
                            <button 
                                className="btn" 
                                onClick={triggerFileInput}
                                style={{ width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <i className="fa-solid fa-camera"></i>
                                {previewUrl ? "Retake / Choose Another" : "Open Native Camera / Upload"}
                            </button>
                        )}
                        
                        {previewUrl && (
                            <div 
                                style={{ 
                                    textAlign: 'center', 
                                    fontSize: '0.75rem', 
                                    color: 'var(--accent-primary)',
                                    fontWeight: 500,
                                    marginTop: '5px' 
                                }}
                            >
                                <i className="fa-solid fa-check-circle" style={{ marginRight: '4px' }}></i>
                                Photo ready! Click 'Analyze Portrait' in the top bar.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CameraCapture;
