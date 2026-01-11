import React, { useState, useRef, useEffect, useCallback } from 'react';
import { translateWord } from './services/geminiService';
import { parseSRT } from './utils/subtitleParser';
import { SubtitleCue, WordDefinition, VRMode, ScreenType, LibraryItem, PlayerConfig, VideoFormat, VRProfile, Language, GameStats, GamepadMapping, GamepadAction, ControlMode, DragAxis } from './types';
import { EyeView } from './components/EyeView';
import { VideoLibrary } from './components/VideoLibrary';
import { SettingsSidebar } from './components/SettingsSidebar';
import { translations } from './utils/i18n';

// Constants for Gaze Interaction
const DWELL_TIME_MS = 1200; 
const CHECK_INTERVAL_MS = 100; // Check every 100ms for performance

const PRESETS: VRProfile[] = [
  { id: 'default', name: 'Default (Balanced)', ipdOffset: 0, verticalOffset: 0, scale: 1.0 },
  { id: 'cardboard-v1', name: 'Cardboard V1 (Small)', ipdOffset: -10, verticalOffset: 0, scale: 0.9 },
  { id: 'cardboard-v2', name: 'Cardboard V2 (Large)', ipdOffset: 0, verticalOffset: 0, scale: 1.1 },
  { id: 'box-large', name: 'Large VR Box / Max Phones', ipdOffset: 20, verticalOffset: 0, scale: 1.0 },
  { id: 'box-small', name: 'Small VR Box / Mini Phones', ipdOffset: -20, verticalOffset: 0, scale: 0.85 },
];

const DEFAULT_GAMEPAD_MAPPING: GamepadMapping = {
    CLICK: 0, RECENTER: 1, PLAY_PAUSE: 2, SEEK_BACK: 14, SEEK_FWD: 15,
    MOVE_LEFT: 14, MOVE_RIGHT: 15, MOVE_UP: 12, MOVE_DOWN: 13,
    VOL_UP: 4, VOL_DOWN: 5 
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('zh');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<VRProfile>({ ...PRESETS[0] });
  const [gamepadMapping, setGamepadMapping] = useState<GamepadMapping>(DEFAULT_GAMEPAD_MAPPING);

  const [view, setView] = useState<'library' | 'player'>('library');
  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null);

  // Removed Demo Video
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig>({
      mode: VRMode.MAGIC_WINDOW,
      screenType: ScreenType.CINEMA,
      videoFormat: VideoFormat.MONO_2D,
      profile: activeProfile,
      isGameMode: false,
      controlMode: 'SENSOR',
      dragAxis: 'FREE'
  });

  const [gameStats, setGameStats] = useState<GameStats>({ score: 0, combo: 0, maxCombo: 0 });
  const hitObjectsRef = useRef<Set<string>>(new Set());
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  const [zoomScale, setZoomScale] = useState(1.0);
  const lastPinchDist = useRef<number | null>(null);

  // Seeking State
  const [isSeeking, setIsSeeking] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Volume State
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [volume, setVolume] = useState(1.0);

  useEffect(() => {
      setPlayerConfig(prev => ({ ...prev, profile: activeProfile }));
  }, [activeProfile]);

  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [currentCue, setCurrentCue] = useState<SubtitleCue | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Separate refs for each eye to fix blank eye issue
  const videoRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const videoRightRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0); 
  const [isTranslating, setIsTranslating] = useState(false);
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  
  const [headRotation, setHeadRotation] = useState({ x: 0, y: 0 });
  const [isCalibrationMode, setIsCalibrationMode] = useState(false);
  
  const [touchRotation, setTouchRotation] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  
  const baseRotation = useRef<{alpha: number, beta: number, gamma: number} | null>(null);
  const lastRawOrientation = useRef<{alpha: number, beta: number, gamma: number} | null>(null);
  const lastHoverTimeRef = useRef<number>(0);
  const t = translations[language];

  // Data Management Handlers
  const handleImportData = (data: any) => {
      if (data.libraryItems) setLibraryItems(data.libraryItems);
      if (data.activeProfile) setActiveProfile(data.activeProfile);
      if (data.gamepadMapping) setGamepadMapping(data.gamepadMapping);
  };
  const handleClearData = () => {
      setLibraryItems([]);
      setActiveProfile(PRESETS[0]);
  };
  const exportData = { libraryItems, activeProfile, gamepadMapping };

  // Auto-Hide Controls Logic
  const resetControlsTimeout = useCallback(() => {
      // Don't auto-hide if settings are open, or seeking, or volume control open
      if (showSettingsOverlay || isSeeking || showVolumeControl) {
          setControlsVisible(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          return;
      }

      setControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (isPlaying && playerConfig.mode === VRMode.MAGIC_WINDOW) {
          controlsTimeoutRef.current = window.setTimeout(() => {
              setControlsVisible(false);
          }, 3000);
      }
  }, [isPlaying, playerConfig.mode, showSettingsOverlay, isSeeking, showVolumeControl]);

  useEffect(() => {
      resetControlsTimeout();
      return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying, resetControlsTimeout, showSettingsOverlay, isSeeking, showVolumeControl]);

  const toggleControls = (e: React.SyntheticEvent) => {
      // Don't hide if settings/volume/seeking active
      if (showSettingsOverlay || showVolumeControl || isSeeking) return;

      if (playerConfig.mode === VRMode.MAGIC_WINDOW) {
          if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.overlay-ui')) return;
          if (controlsVisible) {
              setControlsVisible(false);
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          } else {
              resetControlsTimeout();
          }
      }
  };

  const handleStartPlay = (item: LibraryItem, config: PlayerConfig) => {
      setActiveItem(item);
      setPlayerConfig({ ...config, profile: activeProfile });
      
      setCues([]);
      setCurrentCue(null);
      setDefinition(null);
      setIsPlaying(false);
      baseRotation.current = null;
      setHeadRotation({x: 0, y: 0});
      setTouchRotation({x: 0, y: 0});
      setDuration(0);
      setCurrentTime(0);
      setIsCalibrationMode(false);
      setGameStats({ score: 0, combo: 0, maxCombo: 0 });
      hitObjectsRef.current.clear();
      setZoomScale(1.0);
      setIsSeeking(false);
      setShowVolumeControl(false);

      // Implement first-time configuration logic
      if (!item.isConfigured) {
          setShowSettingsOverlay(true);
          // Mark as configured for next time
          setLibraryItems(prev => prev.map(li => li.id === item.id ? { ...li, isConfigured: true } : li));
      } else {
          setShowSettingsOverlay(false);
      }

      if (item.subtitleUrl) {
          fetch(item.subtitleUrl).then(res => res.text()).then(text => {
                setCues(parseSRT(text));
            }).catch(err => console.error(err));
      }

      setView('player');

      if (config.controlMode === 'SENSOR') {
        if (typeof DeviceOrientationEvent !== 'undefined' && (DeviceOrientationEvent as any).requestPermission) {
            (DeviceOrientationEvent as any).requestPermission().catch(console.error);
        }
      }
      
      if (config.mode === VRMode.STEREO) {
          handleEnterVR();
      }
  };

  const handleExit = () => {
      if (videoRef.current) videoRef.current.pause();
      if (videoRightRef.current) videoRightRef.current.pause();
      if (document.exitFullscreen) document.exitFullscreen().catch(()=>Object);
      if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
      }
      setView('library');
  };

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
      } else {
          document.exitFullscreen().catch(() => {});
      }
  };

  const handleEnterVR = () => {
      if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
      }
      // Force sensor mode when entering VR
      setPlayerConfig(prev => ({ ...prev, mode: VRMode.STEREO, controlMode: 'SENSOR' }));
      if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock('landscape').catch(()=> console.log('Orient lock failed (iOS expected)'));
      }
  };

  const handleExitVRMode = () => {
      setPlayerConfig(prev => ({ ...prev, mode: VRMode.MAGIC_WINDOW }));
      if (document.exitFullscreen) document.exitFullscreen().catch(()=>Object);
      if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
      }
  };

  const confirmRecenter = useCallback(() => {
       if (playerConfig.controlMode === 'SENSOR' && lastRawOrientation.current) {
           baseRotation.current = { ...lastRawOrientation.current };
       } else if (playerConfig.controlMode === 'TOUCH') {
           setTouchRotation({ x: 0, y: 0 });
       }
       setIsCalibrationMode(false);
  }, [playerConfig.controlMode]);

  const togglePlay = useCallback(() => {
    resetControlsTimeout();
    if (videoRef.current) {
        if (videoRef.current.paused) {
            videoRef.current.play();
            if (videoRightRef.current) videoRightRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            if (videoRightRef.current) videoRightRef.current.pause();
            setIsPlaying(false);
        }
    }
  }, [resetControlsTimeout]);

  const seekVideo = useCallback((delta: number) => {
      resetControlsTimeout();
      if (videoRef.current) {
          videoRef.current.currentTime += delta;
          if (videoRightRef.current) videoRightRef.current.currentTime = videoRef.current.currentTime;
      }
  }, [resetControlsTimeout]);

  const handleVolumeChange = useCallback((newVol: number) => {
      if (videoRef.current) {
          const clamped = Math.min(1, Math.max(0, newVol));
          videoRef.current.volume = clamped;
          if (videoRightRef.current) videoRightRef.current.volume = clamped;
          setVolume(clamped);
      }
  }, []);

  const handleTranslate = useCallback(async (word: string, sentence: string) => {
    setIsTranslating(true);
    if (videoRef.current) videoRef.current.pause();
    if (videoRightRef.current) videoRightRef.current.pause();
    setIsPlaying(false);
    const result = await translateWord(word, sentence);
    setDefinition(result);
    setIsTranslating(false);
  }, []);

  const closeDefinition = () => {
      setDefinition(null);
      setDwellProgress(0);
      setHoveredWord(null);
      lastHoverTimeRef.current = Date.now(); 
      if(videoRef.current) {
          videoRef.current.play();
          if (videoRightRef.current) videoRightRef.current.play();
          setIsPlaying(true);
      }
  };

  // --- Interaction Handlers ---
  const onPointerDown = (e: React.PointerEvent) => {
      if (view !== 'player') return;
      isDragging.current = false;
      lastPointer.current = { x: e.clientX, y: e.clientY };

      // Handle Seek Drag Start
      if ((e.target as HTMLElement).closest('.progress-bar-container')) {
           const bar = (e.target as HTMLElement).closest('.progress-bar-container') as HTMLElement;
           if (bar) {
               setIsSeeking(true);
               const rect = bar.getBoundingClientRect();
               const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
               if(videoRef.current) {
                   videoRef.current.currentTime = pct * duration;
                   if (videoRightRef.current) videoRightRef.current.currentTime = videoRef.current.currentTime;
               }
           }
           e.stopPropagation();
      }
  };
  
  const onTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          lastPinchDist.current = dist;
      }
  };

  const onTouchMove = (e: React.TouchEvent) => {
      if (view !== 'player') return;
      if (e.touches.length === 2 && lastPinchDist.current) {
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          const delta = dist - lastPinchDist.current;
          // In Non-VR mode, allow zoom with better sensitivity
          if (playerConfig.mode === VRMode.MAGIC_WINDOW) {
               setZoomScale(prev => Math.min(3, Math.max(0.5, prev + delta * 0.01)));
          }
          lastPinchDist.current = dist;
          return;
      }
  };

  const onTouchEnd = () => {
      lastPinchDist.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
      if (view !== 'player') return;
      
      // Handle Seeking Drag
      if (isSeeking && progressBarRef.current) {
          const rect = progressBarRef.current.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          if(videoRef.current) {
              videoRef.current.currentTime = pct * duration;
              if (videoRightRef.current) videoRightRef.current.currentTime = videoRef.current.currentTime;
          }
          return; // Don't rotate while seeking
      }

      if (lastPinchDist.current) return;

      const deltaX = e.clientX - lastPointer.current.x;
      const deltaY = e.clientY - lastPointer.current.y;
      
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          isDragging.current = true;
      }

      if (playerConfig.controlMode === 'TOUCH' && e.buttons > 0 && !isSeeking) {
          const sensitivity = 0.2;
          setTouchRotation(prev => {
              // Inverse Drag Logic for Drag-to-Pan feel (Swipe Left -> Look Right)
              let newY = prev.y + deltaX * sensitivity; 
              let newX = prev.x;
              if (playerConfig.dragAxis === 'FREE') {
                   // Inverse Drag Y too? Swipe Down -> Look Up
                   newX = prev.x + deltaY * sensitivity; 
                   newX = Math.max(-85, Math.min(85, newX));
              }
              return { x: newX, y: newY };
          });
      }
      
      lastPointer.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
      if (view !== 'player') return;
      
      if (isSeeking) {
          setIsSeeking(false);
          // e.stopPropagation();
          return;
      }

      if (!isDragging.current && !lastPinchDist.current) {
          handleScreenClick(e);
      }
      isDragging.current = false;
  };

  const handleScreenClick = useCallback((e?: React.SyntheticEvent) => {
      // Don't close if settings are open
      if (!showSettingsOverlay && !showVolumeControl) {
          toggleControls(e as React.SyntheticEvent);
      }

      if (isCalibrationMode) {
          confirmRecenter();
          return;
      }

      // Check click targets...
      let x, y;
      if (playerConfig.mode === VRMode.STEREO) {
          x = window.innerWidth * 0.25; 
          y = window.innerHeight / 2;
      } else {
          x = window.innerWidth / 2;
          y = window.innerHeight / 2;
      }

      const el = document.elementFromPoint(x, y) as HTMLElement;
      if (!el) {
          // If in VR mode and nothing hit, treat as play/pause toggle
          if (playerConfig.mode === VRMode.STEREO) togglePlay();
          return;
      }
      
      const actionElement = el.closest('[data-action]') as HTMLElement;
      const wordElement = el.closest('[data-word]') as HTMLElement;
      const gameNoteElement = el.closest('[data-game-note]') as HTMLElement;

      if (actionElement) {
          const action = actionElement.dataset.action;
          if (action === 'recenter') setIsCalibrationMode(true);
          else if (action === 'toggle-play') togglePlay();
          return;
      }
      if (gameNoteElement) {
          const noteId = gameNoteElement.dataset.noteId;
          if (noteId && !hitObjectsRef.current.has(noteId)) {
              hitObjectsRef.current.add(noteId);
               setGameStats(prev => ({
                   score: prev.score + 100 + (prev.combo * 10),
                   combo: prev.combo + 1,
                   maxCombo: Math.max(prev.maxCombo, prev.combo + 1)
               }));
          }
          return;
      }
      if (wordElement) {
          const word = wordElement.dataset.word || '';
          if (word === 'close-btn') {
              closeDefinition();
              return;
          }
          const sentence = wordElement.dataset.sentence || '';
          if (!isTranslating && !definition && !playerConfig.isGameMode) {
              handleTranslate(word, sentence);
          }
          return;
      }

      // Fallback for click on empty space in VR Stereo mode to toggle play
      if (playerConfig.mode === VRMode.STEREO) {
          togglePlay();
      }

  }, [isCalibrationMode, playerConfig.mode, playerConfig.isGameMode, isTranslating, definition, confirmRecenter, togglePlay, handleTranslate, controlsVisible, showSettingsOverlay, showVolumeControl]);

  // Gaze / Dwell Logic Loop
  useEffect(() => {
    if (view !== 'player' || isCalibrationMode || showSettingsOverlay) return;

    const checkGaze = () => {
      // Determine Hit Point Center
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 2;

      if (playerConfig.mode === VRMode.STEREO) {
          // Use Left Eye center for hit testing in VR
          x = window.innerWidth * 0.25;
      }

      const el = document.elementFromPoint(x, y) as HTMLElement;
      if (!el) {
          setHoveredWord(null);
          setDwellProgress(0);
          lastHoverTimeRef.current = 0;
          return;
      }

      // Check for Rhythm Game Note
      if (playerConfig.isGameMode) {
           const gameNoteEl = el.closest('[data-game-note]') as HTMLElement;
           if (gameNoteEl) {
               const noteId = gameNoteEl.dataset.noteId;
               if (noteId && !hitObjectsRef.current.has(noteId)) {
                   hitObjectsRef.current.add(noteId);
                   setGameStats(prev => ({
                       score: prev.score + 100 + (prev.combo * 10),
                       combo: prev.combo + 1,
                       maxCombo: Math.max(prev.maxCombo, prev.combo + 1)
                   }));
                   // Visual feedback could be added here
               }
           }
      }

      // Check for Word
      const wordEl = el.closest('[data-word]') as HTMLElement;
      
      if (wordEl) {
          const word = wordEl.dataset.word;
          const sentence = wordEl.dataset.sentence || '';
          
          if (word) {
              if (hoveredWord !== word) {
                  // New word entered
                  setHoveredWord(word);
                  lastHoverTimeRef.current = Date.now();
                  setDwellProgress(0);
              } else {
                  // Dwell progress
                  if (lastHoverTimeRef.current > 0) {
                      const elapsed = Date.now() - lastHoverTimeRef.current;
                      const progress = Math.min(1, elapsed / DWELL_TIME_MS);
                      setDwellProgress(progress);

                      if (progress >= 1 && !isTranslating && (!definition || definition.word !== word)) {
                          // Trigger Translation
                          handleTranslate(word, sentence);
                          lastHoverTimeRef.current = 0; // Reset so we don't trigger again immediately
                          setDwellProgress(0); // Reset visual
                      }
                  }
              }
          }
      } else {
          // Hit something else or nothing
          if (hoveredWord) {
              setHoveredWord(null);
              setDwellProgress(0);
              lastHoverTimeRef.current = 0;
          }
      }
    };

    const interval = setInterval(checkGaze, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [view, playerConfig.mode, playerConfig.isGameMode, isCalibrationMode, showSettingsOverlay, hoveredWord, isTranslating, definition, handleTranslate]);


  useEffect(() => {
      if (view !== 'player') return;
      const handleKeyDown = (e: KeyboardEvent) => {
          resetControlsTimeout();
          switch(e.key) {
              case ' ': case 'Enter': e.preventDefault(); togglePlay(); break;
              case 'ArrowLeft': seekVideo(-5); break;
              case 'ArrowRight': seekVideo(5); break;
              case 'r': case 'R': setIsCalibrationMode(prev => !prev); break;
              case 'Escape': handleExit(); break;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isCalibrationMode, togglePlay, confirmRecenter, seekVideo]);

  // Orientation & Compass Logic
  useEffect(() => {
    if (view !== 'player' || playerConfig.controlMode !== 'SENSOR') return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
        if (e.alpha === null) return;
        lastRawOrientation.current = { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 };
        if (!baseRotation.current) baseRotation.current = { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 };

        const base = baseRotation.current;
        const isLandscape = window.innerWidth > window.innerHeight;
        
        // Yaw: Left turn = +Alpha. 
        let yaw = (e.alpha || 0) - base.alpha;
        if (yaw > 180) yaw -= 360;
        if (yaw < -180) yaw += 360;
        
        let pitch = 0;
        if (isLandscape) pitch = (e.gamma || 0) - base.gamma;
        else pitch = (e.beta || 0) - base.beta;
        pitch = Math.max(-80, Math.min(80, pitch));
        
        setHeadRotation({ x: pitch, y: yaw });
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [view, playerConfig.controlMode]);

  useEffect(() => {
    if (view !== 'player') return;
    const vid = videoRef.current;
    if (!vid) return;
    const update = () => {
        setCurrentTime(vid.currentTime);
        setDuration(vid.duration || 0);
        const activeCue = cues.find(c => vid.currentTime >= c.startTime && vid.currentTime <= c.endTime);
        setCurrentCue(activeCue || null);
    };
    vid.addEventListener('timeupdate', update);
    return () => vid.removeEventListener('timeupdate', update);
  }, [cues, view]);

  // Compass Logic: 
  const activeRotation = playerConfig.controlMode === 'SENSOR' ? headRotation : touchRotation;
  const compassConeStyle = { transform: `rotate(${-activeRotation.y}deg)` };

  return (
    <>
        <SettingsSidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)}
            language={language}
            onLanguageChange={setLanguage}
            activeProfile={activeProfile}
            onProfileChange={setActiveProfile}
            PRESETS={PRESETS}
            gamepadMapping={gamepadMapping}
            onUpdateMapping={(action, btn) => setGamepadMapping(prev => ({...prev, [action]: btn}))}
            onResetMapping={() => setGamepadMapping(DEFAULT_GAMEPAD_MAPPING)}
            onImportData={handleImportData}
            onClearData={handleClearData}
            currentDataExport={exportData}
        />

        {view === 'library' ? (
             <VideoLibrary 
                items={libraryItems}
                setItems={setLibraryItems}
                onPlay={handleStartPlay} 
                onOpenSettings={() => setIsSidebarOpen(true)}
                language={language}
                currentProfile={activeProfile}
            />
        ) : (
            <div 
                className="bg-black font-sans select-none overflow-hidden touch-none"
                style={playerConfig.mode === VRMode.STEREO && window.innerHeight > window.innerWidth ? {
                     position: 'fixed', width: '100vh', height: '100vw', left: '100%', top: '0', transformOrigin: '0 0', transform: 'rotate(90deg)'
                } : { position: 'fixed', inset: 0 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onContextMenu={(e) => e.preventDefault()}
            >
            
            {/* Stereo Exit Button (Top Right in Landscape) */}
            {playerConfig.mode === VRMode.STEREO && (
                <div className="absolute top-4 right-4 z-[100] pointer-events-auto">
                    <button 
                        onClick={handleExitVRMode}
                        className="w-12 h-12 rounded-full bg-red-600/80 text-white flex items-center justify-center border-2 border-white/20 shadow-xl backdrop-blur-md"
                    >
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
            )}

            {/* Non-Stereo Overlay Controls */}
            {playerConfig.mode !== VRMode.STEREO && (
            <div className={`absolute inset-0 z-50 pointer-events-none flex flex-col justify-between p-4 overlay-ui transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                
                {/* Top Bar */}
                <div className="flex justify-between items-start pointer-events-auto">
                    <button onClick={handleExit} className="bg-black/40 backdrop-blur text-white p-3 rounded-full hover:bg-white/20 transition-all border border-white/10">
                        <i className="fas fa-arrow-left text-xl"></i>
                    </button>
                    
                    {/* Fixed North Compass */}
                    <div className="relative w-16 h-16 bg-black/40 backdrop-blur rounded-full border-2 border-white/20 flex items-center justify-center">
                         {/* Static North Marker (Up) */}
                         <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-red-500 rounded-full z-10"></div>
                         
                         {/* Rotating Cone (Shows View Direction) */}
                         <div className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-linear" style={compassConeStyle}>
                             <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[20px] border-b-emerald-500/80 -mt-6"></div>
                         </div>
                    </div>
                </div>

                {/* Center Play Button */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button 
                         onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                         className="pointer-events-auto w-20 h-20 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white/90 hover:bg-black/70 hover:scale-110 transition-all border-2 border-white/20 shadow-2xl"
                    >
                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-3xl ml-1`}></i>
                    </button>
                </div>
                
                {/* Center - Settings Overlay Toggle (Popup) */}
                {showSettingsOverlay && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 backdrop-blur border border-white/10 p-6 rounded-2xl pointer-events-auto min-w-[300px] z-50 max-h-[80vh] overflow-y-auto">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-white">{t.settings}</h3>
                             <button onClick={() => setShowSettingsOverlay(false)}><i className="fas fa-times text-slate-400"></i></button>
                         </div>
                         
                         <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-2">{t.dragAxis}</label>
                                <div className="flex bg-slate-800 rounded p-1">
                                    <button onClick={() => setPlayerConfig(p => ({...p, dragAxis: 'FREE'}))} className={`flex-1 py-2 text-xs rounded ${playerConfig.dragAxis === 'FREE' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{t.dragFree}</button>
                                    <button onClick={() => setPlayerConfig(p => ({...p, dragAxis: 'HORIZONTAL'}))} className={`flex-1 py-2 text-xs rounded ${playerConfig.dragAxis === 'HORIZONTAL' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{t.dragHorizontal}</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-2">{t.controlMode}</label>
                                <div className="flex bg-slate-800 p-1 rounded">
                                    <button onClick={() => setPlayerConfig(p => ({...p, controlMode: 'SENSOR'}))} className={`flex-1 py-2 text-xs rounded ${playerConfig.controlMode === 'SENSOR' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>{t.controlSensor}</button>
                                    <button onClick={() => setPlayerConfig(p => ({...p, controlMode: 'TOUCH'}))} className={`flex-1 py-2 text-xs rounded ${playerConfig.controlMode === 'TOUCH' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>{t.controlTouch}</button>
                                </div>
                            </div>

                            {/* In-Player Calibration */}
                            <div className="border-t border-white/5 pt-4">
                                <h4 className="text-xs font-bold text-emerald-400 mb-3 uppercase">{t.vrCalibration}</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: t.ipd, val: activeProfile.ipdOffset, min: -50, max: 50, step: 1, unit: 'px', key: 'ipdOffset' },
                                        { label: t.vertical, val: activeProfile.verticalOffset, min: -50, max: 50, step: 1, unit: 'px', key: 'verticalOffset' },
                                        { label: t.scale, val: activeProfile.scale, min: 0.5, max: 1.5, step: 0.05, unit: 'x', key: 'scale' }
                                    ].map((setting) => (
                                        <div key={setting.key}>
                                           <div className="flex justify-between mb-1">
                                               <label className="text-slate-400 text-[10px]">{setting.label}</label>
                                               <span className="text-white text-[10px] font-mono">{typeof setting.val === 'number' ? setting.val.toFixed(setting.key === 'scale' ? 2 : 0) : setting.val}{setting.unit}</span>
                                           </div>
                                           <input 
                                               type="range" min={setting.min} max={setting.max} step={setting.step}
                                               value={setting.val}
                                               onChange={(e) => setActiveProfile({...activeProfile, [setting.key]: parseFloat(e.target.value)})}
                                               className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                           />
                                        </div>
                                    ))}
                                </div>
                            </div>

                         </div>
                    </div>
                )}

                {/* Bottom Bar: Single Row */}
                <div className="w-full pointer-events-auto">
                     <div className="bg-transparent p-2 px-4 flex items-center gap-3 relative">
                        
                        <button onClick={() => setShowSettingsOverlay(!showSettingsOverlay)} className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center">
                            <i className="fas fa-cog"></i>
                        </button>

                         {/* Volume Control */}
                        <div className="relative">
                            {showVolumeControl && (
                                <>
                                    <div className="fixed inset-0 z-0" onClick={() => setShowVolumeControl(false)}></div>
                                    <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-transparent h-32 flex items-center justify-center z-10">
                                        <input 
                                            type="range" 
                                            min="0" max="1" step="0.05" 
                                            value={volume} 
                                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                            className="w-24 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500 -rotate-90"
                                        />
                                    </div>
                                </>
                            )}
                            <button 
                                onClick={() => setShowVolumeControl(!showVolumeControl)} 
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showVolumeControl ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
                            >
                                <i className={`fas ${volume === 0 ? 'fa-volume-mute' : volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'} text-xs`}></i>
                            </button>
                        </div>

                        <button onClick={() => seekVideo(-5)} className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center">
                            <i className="fas fa-undo-alt text-xs"></i>
                        </button>
                        
                        <div className="flex-1 flex items-center gap-2">
                             <span className="text-[10px] font-mono text-white w-8 text-right">{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2,'0')}</span>
                             <div 
                                className="flex-1 h-8 relative flex items-center group cursor-pointer progress-bar-container" 
                                ref={progressBarRef}
                             >
                                 <div className="absolute w-full h-1 bg-slate-700 rounded-full overflow-hidden pointer-events-none">
                                     <div className="h-full bg-emerald-500" style={{ width: `${(currentTime/duration)*100}%` }}></div>
                                 </div>
                                 <div className="absolute w-3 h-3 bg-white rounded-full shadow transition-all scale-0 group-hover:scale-100 pointer-events-none" style={{ left: `${(currentTime/duration)*100}%`, transform: 'translateX(-50%)' }}></div>
                             </div>
                             <span className="text-[10px] font-mono text-white w-8">{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2,'0')}</span>
                        </div>

                         <button onClick={() => seekVideo(5)} className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center">
                            <i className="fas fa-redo-alt text-xs"></i>
                        </button>

                        <button onClick={handleEnterVR} className="w-10 h-8 rounded-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all border border-emerald-500/30">
                             <i className="fas fa-vr-cardboard"></i>
                        </button>
                        
                        <button onClick={toggleFullscreen} className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center">
                            <i className="fas fa-expand"></i>
                        </button>
                     </div>
                </div>
            </div>
            )}

            <div className="w-full h-full flex relative z-10">
                <EyeView 
                    eye={playerConfig.mode === VRMode.MAGIC_WINDOW ? 'single' : 'left'} 
                    vrMode={playerConfig.mode}
                    screenType={playerConfig.screenType}
                    videoFormat={playerConfig.videoFormat}
                    profile={playerConfig.profile}
                    item={activeItem!}
                    videoRef={videoRef}
                    currentCue={currentCue}
                    definition={definition}
                    isTranslating={isTranslating}
                    hoveredWord={hoveredWord}
                    dwellProgress={dwellProgress}
                    headRotation={activeRotation}
                    isPlaying={isPlaying}
                    duration={duration}
                    currentTime={currentTime}
                    isCalibrationMode={isCalibrationMode}
                    onCloseDefinition={closeDefinition}
                    onExit={handleExit}
                    language={language}
                    isGameMode={playerConfig.isGameMode}
                    gameStats={gameStats}
                    cues={cues}
                    hitObjectsRef={hitObjectsRef}
                    zoomScale={zoomScale}
                />
                
                {playerConfig.mode === VRMode.STEREO && (
                    <EyeView 
                        eye="right" 
                        vrMode={playerConfig.mode}
                        screenType={playerConfig.screenType}
                        videoFormat={playerConfig.videoFormat}
                        profile={playerConfig.profile}
                        item={activeItem!}
                        videoRef={videoRightRef}
                        currentCue={currentCue}
                        definition={definition}
                        isTranslating={isTranslating}
                        hoveredWord={hoveredWord}
                        dwellProgress={dwellProgress}
                        headRotation={activeRotation}
                        isPlaying={isPlaying}
                        duration={duration}
                        currentTime={currentTime}
                        isCalibrationMode={isCalibrationMode}
                        onCloseDefinition={closeDefinition}
                        onExit={handleExit}
                        language={language}
                        isGameMode={playerConfig.isGameMode}
                        gameStats={gameStats}
                        cues={cues}
                        hitObjectsRef={hitObjectsRef}
                        zoomScale={zoomScale}
                    />
                )}
            </div>
            </div>
        )}
    </>
  );
};

export default App;