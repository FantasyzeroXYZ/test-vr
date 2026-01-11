import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameNote } from '../types';

interface RhythmGameRendererProps {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  isPlaying: boolean;
  hitObjectsRef: React.MutableRefObject<Set<string>>;
}

// Configuration
const SPEED = 25.0; // Movement speed
const SPAWN_Z = -1000;
const HIT_ZONE_Z = -50;
const DESPAWN_Z = 100;
const LANE_WIDTH = 120; // Distance between lanes
const BEAT_THRESHOLD = 240; // Sensitivity 0-255 (Higher = only strong beats)
const COOLDOWN_FRAMES = 15; // Min frames between notes to prevent spam

export const RhythmGameRenderer: React.FC<RhythmGameRendererProps> = ({ mediaRef, isPlaying, hitObjectsRef }) => {
  const [notes, setNotes] = useState<GameNote[]>([]);
  
  // Refs for audio processing to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  // Game Loop Refs
  const requestRef = useRef<number>();
  const notesRef = useRef<GameNote[]>([]); // Mutable ref for high freq updates
  const lastBeatFrame = useRef<number>(0);
  const frameCount = useRef<number>(0);

  // Initialize Audio Context
  useEffect(() => {
    if (!mediaRef.current || audioContextRef.current) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; // Smaller FFT for performance, enough for beat detection
      
      const source = ctx.createMediaElementSource(mediaRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
    } catch (e) {
      console.warn("Audio Context setup failed (likely CORS or user interaction required):", e);
    }

    return () => {
        // Cleanup if needed, though usually ctx stays alive
    };
  }, [mediaRef]);

  // Resume AudioContext on Play
  useEffect(() => {
      if (isPlaying && audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
      }
  }, [isPlaying]);

  // Main Game Loop
  const updateGame = useCallback(() => {
    if (!isPlaying) {
        requestRef.current = requestAnimationFrame(updateGame);
        return;
    }
    
    frameCount.current++;

    // 1. Analyze Audio for Beats
    if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Simple Beat Detection: Check low frequencies (Bass)
        // Bins 0-5 roughly correspond to sub-bass/kick
        let bassSum = 0;
        for(let i = 0; i < 5; i++) {
            bassSum += dataArrayRef.current[i];
        }
        const bassAvg = bassSum / 5;

        // Spawn logic
        if (bassAvg > BEAT_THRESHOLD && (frameCount.current - lastBeatFrame.current > COOLDOWN_FRAMES)) {
            const lane = Math.floor(Math.random() * 4); // 0-3
            const newNote: GameNote = {
                id: `note-${Date.now()}-${Math.random()}`,
                lane,
                spawnTime: Date.now(),
                z: SPAWN_Z,
                isHit: false
            };
            notesRef.current.push(newNote);
            lastBeatFrame.current = frameCount.current;
        }
    }

    // 2. Update Note Positions
    const activeNotes: GameNote[] = [];
    
    notesRef.current.forEach(note => {
        // Move forward
        note.z += SPEED;

        // Check if hit externally (by App.tsx click)
        if (hitObjectsRef.current.has(note.id)) {
            note.isHit = true;
        }

        // Keep if visible and not hit
        if (note.z < DESPAWN_Z && !note.isHit) {
            activeNotes.push(note);
        }
    });

    notesRef.current = activeNotes;
    
    // 3. Render Trigger (Sync Ref to State for React Render)
    // Optimization: Only set state if we have notes to render to avoid empty re-renders? 
    // Actually needed every frame for smooth motion.
    setNotes([...notesRef.current]);

    requestRef.current = requestAnimationFrame(updateGame);
  }, [isPlaying, hitObjectsRef]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updateGame]);

  // Lane X Positions: -1.5, -0.5, 0.5, 1.5 * WIDTH
  const getLaneX = (lane: number) => {
      return (lane - 1.5) * LANE_WIDTH;
  };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
      
      {/* 3D Track Visuals (Lanes) */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'rotateX(90deg) translateZ(-150px)' }}>
           <div className="relative w-[500px] h-[2000px] bg-gradient-to-b from-indigo-900/40 to-black/0">
               {/* Lane Dividers */}
               {[0, 1, 2, 3, 4].map(i => (
                   <div key={i} className="absolute h-full w-[2px] bg-indigo-500/30" style={{ left: `${i * 25}%` }} />
               ))}
               
               {/* Hit Line */}
               <div className="absolute w-full h-[4px] bg-emerald-400 box-shadow-[0_0_15px_#34d399]" style={{ top: '80%' }} /> {/* Approx where Z=-50 maps visually on floor */}
           </div>
      </div>

      {/* HIT INDICATOR ZONE (Vertical Plane) */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateZ(${HIT_ZONE_Z}px)` }}>
           <div className="w-[500px] h-[150px] border-x-4 border-emerald-500/10 rounded-xl" />
      </div>

      {/* Render Notes */}
      {notes.map(note => {
          // Calculate Opacity based on Z (fade in)
          const opacity = Math.min(1, Math.max(0, 1 - (Math.abs(note.z - SPAWN_Z) / 200)));
          
          return (
            <div 
                key={note.id}
                className="absolute inset-0 flex items-center justify-center pointer-events-auto"
                style={{ 
                    transform: `translate3d(${getLaneX(note.lane)}px, 0, ${note.z}px)`,
                }}
            >
                {/* The Note Object */}
                <div 
                    id={note.id}
                    className="w-20 h-20 rounded-xl border-2 border-white/50 cursor-crosshair group relative transition-transform"
                    style={{
                        backgroundColor: note.lane % 2 === 0 ? 'rgba(6, 182, 212, 0.6)' : 'rgba(236, 72, 153, 0.6)', // Cyan / Pink
                        boxShadow: note.lane % 2 === 0 ? '0 0 20px cyan' : '0 0 20px hotpink'
                    }}
                    data-note-id={note.id}
                    data-game-note="true"
                >
                    {/* Inner core */}
                    <div className="absolute inset-2 bg-white/80 rounded-lg animate-pulse" />
                </div>
            </div>
          );
      })}
    </div>
  );
};