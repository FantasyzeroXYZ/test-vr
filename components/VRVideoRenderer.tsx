import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VideoFormat } from '../types';

interface VRVideoRendererProps {
  videoElement: HTMLVideoElement | HTMLMediaElement | null;
  format: VideoFormat;
  eye: 'left' | 'right' | 'single';
  headRotation: { x: number; y: number };
}

export const VRVideoRenderer: React.FC<VRVideoRendererProps> = ({ videoElement, format, eye, headRotation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const textureRef = useRef<THREE.VideoTexture | null>(null);

  useEffect(() => {
    if (!containerRef.current || !videoElement) return;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ'; 

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    
    // 2. Geometry Logic
    const is180 = format.includes('180');
    const radius = 500;
    
    let geometry: THREE.SphereGeometry;

    if (is180) {
        // 180 Hemisphere
        geometry = new THREE.SphereGeometry(radius, 60, 40, 0, Math.PI, 0, Math.PI);
    } else {
        // 360 Sphere
        geometry = new THREE.SphereGeometry(radius, 60, 40);
    }
    
    // Invert geometry to see inside
    geometry.scale(-1, 1, 1);

    // 3. Texture Logic & UV Mapping
    const texture = new THREE.VideoTexture(videoElement as HTMLVideoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    const isSBS = format.includes('SBS');
    const isTB = format.includes('TB');
    const isStereo = isSBS || isTB;
    
    let uScale = 1;
    let vScale = 1;
    let uOffset = 0;
    let vOffset = 0;

    if (isStereo) {
        if (eye === 'left') {
            if (isSBS) { uScale = 0.5; uOffset = 0; }
            if (isTB)  { vScale = 0.5; vOffset = 0.5; }
        } else if (eye === 'right') {
            if (isSBS) { uScale = 0.5; uOffset = 0.5; }
            if (isTB)  { vScale = 0.5; vOffset = 0; }
        } else {
            // Single view (Magic Window) showing Left Eye usually
            if (isSBS) { uScale = 0.5; uOffset = 0; }
            if (isTB)  { vScale = 0.5; vOffset = 0.5; }
        }
    }

    texture.repeat.set(uScale, vScale);
    texture.offset.set(uOffset, vOffset);
    
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);

    if (is180) {
        // Rotate 180 sphere to face -Z. 
        mesh.rotation.y = -Math.PI / 2;
    }

    scene.add(mesh);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    meshRef.current = mesh;
    textureRef.current = texture;

    let frameId = 0;
    const animate = () => {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
        if (containerRef.current && cameraRef.current && rendererRef.current) {
            cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(frameId);
        if (rendererRef.current) {
            rendererRef.current.dispose();
            containerRef.current?.removeChild(rendererRef.current.domElement);
        }
        geometry.dispose();
        material.dispose();
        texture.dispose();
    };
  }, [videoElement, format, eye]);

  // Sync Head Rotation
  useEffect(() => {
    if (cameraRef.current) {
        // Convert App Degrees to ThreeJS Radians directly.
        // App logic ensures Positive Y is Left Turn, Negative Y is Right Turn.
        const radY = THREE.MathUtils.degToRad(headRotation.y);
        const radX = THREE.MathUtils.degToRad(headRotation.x);

        cameraRef.current.rotation.y = radY;
        cameraRef.current.rotation.x = radX;
    }
  }, [headRotation]);

  return <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" />;
};