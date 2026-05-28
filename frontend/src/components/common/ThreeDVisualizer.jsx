import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Map style names to procedural parameters
const getHairParams = (styleName = '') => {
    const style = styleName.toLowerCase();
    
    if (style.includes('fade') || style.includes('buzz') || style.includes('short') || style.includes('crop')) {
        return { type: 'short', scale: [1.25, 0.6, 1.25], position: [0, 0.8, 0], detail: 'Close-cropped textured cut' };
    }
    if (style.includes('bob') || style.includes('fringe') || style.includes('pageboy')) {
        return { type: 'bob', scale: [1.3, 1.1, 1.3], position: [0, 0.5, 0.1], detail: 'Classic bob contouring the face' };
    }
    if (style.includes('long') || style.includes('wave') || style.includes('curl') || style.includes('flow')) {
        return { type: 'long', scale: [1.3, 1.8, 1.3], position: [0, 0.1, -0.1], detail: 'Flowing wavy layers' };
    }
    if (style.includes('pompadour') || style.includes('quiff') || style.includes('slick') || style.includes('mohawk')) {
        return { type: 'quiff', scale: [1.2, 1.0, 1.4], position: [0, 0.9, 0.25], detail: 'Volumized sweep styling' };
    }
    // Default style
    return { type: 'medium', scale: [1.3, 1.0, 1.3], position: [0, 0.6, 0], detail: 'Standard signature style' };
};

// Map color names or hex strings to THREE.Color compatible values
const getHairColorHex = (colorName = '') => {
    const col = colorName.toLowerCase();
    if (col.includes('#')) return colorName;
    if (col.includes('blonde') || col.includes('gold') || col.includes('honey')) return '#deb876';
    if (col.includes('brunette') || col.includes('brown') || col.includes('chestnut')) return '#5a3d28';
    if (col.includes('black') || col.includes('raven') || col.includes('dark')) return '#1a1a1a';
    if (col.includes('red') || col.includes('ginger') || col.includes('copper')) return '#b85a38';
    if (col.includes('grey') || col.includes('gray') || col.includes('silver') || col.includes('platinum')) return '#cccccc';
    if (col.includes('pink') || col.includes('rose') || col.includes('pastel')) return '#f090b0';
    if (col.includes('blue') || col.includes('teal')) return '#5cd6d6';
    if (col.includes('green') || col.includes('jade')) return '#5cd699';
    // Default
    return '#deb876';
};

// The rotating mannequin head and hair model
const ModelContainer = ({ hairStyle, hairColor }) => {
    const headRef = useRef();
    const hairParams = useMemo(() => getHairParams(hairStyle), [hairStyle]);
    const colorHex = useMemo(() => getHairColorHex(hairColor), [hairColor]);

    // Slowly rotate the model over time
    useFrame((state) => {
        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.4;
        }
    });

    return (
        <group ref={headRef} position={[0, -0.3, 0]}>
            {/* Mannequin Head (Metallic / Glassmorphic) */}
            <mesh castShadow receiveShadow>
                <sphereGeometry args={[1, 64, 64]} />
                <meshStandardMaterial 
                    color="#e5e2db" 
                    roughness={0.25} 
                    metalness={0.5} 
                    envMapIntensity={1.0}
                />
            </mesh>

            {/* Neck */}
            <mesh position={[0, -1.2, 0]} castShadow>
                <cylinderGeometry args={[0.35, 0.45, 0.7, 32]} />
                <meshStandardMaterial 
                    color="#e5e2db" 
                    roughness={0.25} 
                    metalness={0.5}
                />
            </mesh>

            {/* Styled Hair Mesh Overlay */}
            <group position={hairParams.position}>
                {hairParams.type === 'short' && (
                    // Short crop style: tight fitted sphere caps + textured segments
                    <mesh castShadow>
                        <sphereGeometry args={[1.05, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
                        <meshStandardMaterial 
                            color={colorHex} 
                            roughness={0.5} 
                            metalness={0.3} 
                            bumpScale={0.05}
                        />
                    </mesh>
                )}

                {hairParams.type === 'bob' && (
                    // Bob cut: covering sides and back
                    <group>
                        {/* Top skull cap */}
                        <mesh castShadow>
                            <sphereGeometry args={[1.06, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                        {/* Left drape */}
                        <mesh position={[-0.7, -0.3, 0.1]} rotation={[0, 0, 0.1]} castShadow>
                            <cylinderGeometry args={[0.38, 0.35, 1.0, 16, 1, false, 0, Math.PI]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                        {/* Right drape */}
                        <mesh position={[0.7, -0.3, 0.1]} rotation={[0, 0, -0.1]} castShadow>
                            <cylinderGeometry args={[0.38, 0.35, 1.0, 16, 1, false, 0, Math.PI]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                        {/* Back drape */}
                        <mesh position={[0, -0.4, -0.6]} rotation={[0.1, 0, 0]} castShadow>
                            <sphereGeometry args={[0.7, 16, 16, 0, Math.PI]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                    </group>
                )}

                {hairParams.type === 'long' && (
                    // Long Waves
                    <group>
                        {/* Base crown cap */}
                        <mesh castShadow>
                            <sphereGeometry args={[1.06, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                        {/* Long flowing locks on sides & back */}
                        <mesh position={[-0.6, -0.8, -0.2]} rotation={[0.1, 0, 0.15]} castShadow>
                            <cylinderGeometry args={[0.48, 0.2, 1.8, 16]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                        <mesh position={[0.6, -0.8, -0.2]} rotation={[0.1, 0, -0.15]} castShadow>
                            <cylinderGeometry args={[0.48, 0.2, 1.8, 16]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                        <mesh position={[0, -0.9, -0.7]} rotation={[0.2, 0, 0]} castShadow>
                            <cylinderGeometry args={[0.5, 0.25, 1.7, 16]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                    </group>
                )}

                {hairParams.type === 'quiff' && (
                    // Quiff / Pompadour: swept upward and forward
                    <group>
                        {/* Side short hair */}
                        <mesh castShadow>
                            <sphereGeometry args={[1.04, 32, 32, 0, Math.PI * 2, 0.3, Math.PI * 0.5]} />
                            <meshStandardMaterial color={colorHex} roughness={0.6} metalness={0.1} />
                        </mesh>
                        {/* Voluminous top sweep */}
                        <mesh position={[0, 0.8, 0.3]} rotation={[-0.4, 0, 0]} castShadow>
                            <sphereGeometry args={[0.55, 32, 32]} scale={[1.4, 0.7, 1.2]} />
                            <meshStandardMaterial color={colorHex} roughness={0.3} metalness={0.2} />
                        </mesh>
                        <mesh position={[0, 0.6, 0.5]} rotation={[-0.2, 0, 0]} castShadow>
                            <sphereGeometry args={[0.4, 16, 16]} scale={[1.1, 0.6, 1.1]} />
                            <meshStandardMaterial color={colorHex} roughness={0.3} metalness={0.2} />
                        </mesh>
                    </group>
                )}

                {hairParams.type === 'medium' && (
                    // Standard Medium
                    <group>
                        <mesh castShadow>
                            <sphereGeometry args={[1.05, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                        <mesh position={[0, -0.2, -0.4]} castShadow>
                            <sphereGeometry args={[0.65, 16, 16]} scale={[1.1, 1.2, 1.0]} />
                            <meshStandardMaterial color={colorHex} roughness={0.4} metalness={0.2} />
                        </mesh>
                    </group>
                )}
            </group>

            {/* Stylized Face Elements */}
            {/* Nose */}
            <mesh position={[0, 0.15, 0.95]} rotation={[0.2, 0, 0]}>
                <coneGeometry args={[0.1, 0.3, 4]} />
                <meshStandardMaterial color="#d1c9bd" roughness={0.3} metalness={0.3} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.3, 0.25, 0.88]}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial color="var(--accent-primary)" emissive="var(--accent-primary)" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0.3, 0.25, 0.88]}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial color="var(--accent-primary)" emissive="var(--accent-primary)" emissiveIntensity={0.6} />
            </mesh>
        </group>
    );
};

const ThreeDVisualizer = ({ hairStyle, hairColor, height = "280px" }) => {
    const hairParams = useMemo(() => getHairParams(hairStyle), [hairStyle]);

    return (
        <div 
            style={{ 
                width: '100%', 
                height: height, 
                background: 'radial-gradient(circle at center, #ffffff 0%, #edeae4 100%)',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                overflow: 'hidden',
                position: 'relative'
            }}
        >
            {/* Title / Info HUD */}
            <div 
                style={{ 
                    position: 'absolute', 
                    top: '12px', 
                    left: '12px', 
                    zIndex: 10, 
                    pointerEvents: 'none',
                    fontFamily: "'Outfit', sans-serif" 
                }}
            >
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                    3D Styling Simulator
                </div>
                <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>
                    {hairStyle}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-main)', marginTop: '1px' }}>
                    Color: {hairColor}
                </div>
            </div>

            {/* Controls Helper Overlay */}
            <div 
                style={{ 
                    position: 'absolute', 
                    bottom: '12px', 
                    right: '12px', 
                    zIndex: 10, 
                    pointerEvents: 'none',
                    fontSize: '0.65rem', 
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: 0.7 
                }}
            >
                <i className="fa-solid fa-arrows-spin"></i> Drag to rotate
            </div>

            <Canvas shadows className="r3f-canvas">
                <PerspectiveCamera makeDefault position={[0, 0, 3.8]} fov={50} />
                
                {/* Custom Lighting */}
                <ambientLight intensity={0.4} />
                <directionalLight 
                    position={[5, 8, 5]} 
                    intensity={1.2} 
                    castShadow 
                    shadow-mapSize={[1024, 1024]} 
                />
                <pointLight position={[-4, -2, -4]} intensity={0.6} color="var(--accent-primary)" />
                <pointLight position={[3, -2, 3]} intensity={0.4} color="#f090b0" />

                {/* Model */}
                <ModelContainer hairStyle={hairStyle} hairColor={hairColor} />

                {/* Controls */}
                <OrbitControls 
                    enableZoom={true} 
                    enablePan={false} 
                    minDistance={2.5} 
                    maxDistance={6}
                    minPolarAngle={Math.PI / 3}
                    maxPolarAngle={Math.PI / 1.5}
                />
            </Canvas>
        </div>
    );
};

export default ThreeDVisualizer;
