import React, { CSSProperties, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { SubtitleCue, WordDefinition, VRMode, ScreenType, VideoFormat, VRProfile, Language, LibraryItem, GameStats } from '../types';
import { SubtitleRenderer } from './SubtitleRenderer';
import { RhythmGameRenderer } from './RhythmGameRenderer';
import { InfoPanel } from './InfoPanel';
import { Reticle } from './Reticle';
import { VRVideoRenderer } from './VRVideoRenderer';
import { translations } from '../utils/i18n';

interface EyeViewProps {
  eye: 'left' | 'right' | 'single';
  vrMode: VRMode;
  screenType: ScreenType;
  videoFormat: VideoFormat;
  profile: VRProfile;
  item: LibraryItem;
  videoRef?: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  currentCue: SubtitleCue | null;
  definition: WordDefinition | null;
  isTranslating: boolean;
  hoveredWord: string | null;
  dwellProgress: number;
  headRotation: { x: number; y: number };
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  isCalibrationMode: boolean;
  onCloseDefinition: () => void;
  onExit: () => void;
  language: Language;
  isGameMode: boolean;
  gameStats: GameStats;
  cues: SubtitleCue[];
  hitObjectsRef: React.MutableRefObject<Set<string>>;
  zoomScale: number; // New prop for zoom
}

export const EyeView: React.FC<EyeViewProps> = ({
  eye,
  vrMode,
  screenType,
  videoFormat,
  profile,
  item,
  videoRef,
  currentCue,
  definition,
  isTranslating,
  hoveredWord,
  dwellProgress,
  headRotation,
  isPlaying,
  duration,
  currentTime,
  isCalibrationMode,
  onCloseDefinition,
  onExit,
  language,
  isGameMode,
  gameStats,
  cues,
  hitObjectsRef,
  zoomScale
}) => {
  const t = translations[language];
  
  // Local ref if one isn't provided (for right eye sync mostly)
  const localMediaRef = useRef<HTMLMediaElement | null>(null);
  const activeMediaRef = (videoRef as React.RefObject<HTMLMediaElement>) || localMediaRef;
  const isVRVideo = videoFormat.startsWith('VR');

  // Initialize HLS if needed
  useEffect(() => {
    // Explicitly target the current eye's media element by ID if ref isn't reliable for multi-rendering
    const mediaId = eye === 'right' ? 'video-right' : (eye === 'left' ? 'video-left' : 'video-single');
    const media = document.getElementById(mediaId) as HTMLMediaElement || activeMediaRef.current;
    
    if (!media || !item.url) return;

    // Determine media type
    if (item.type === 'video') {
        // HLS Logic for Video
        let hls: Hls | null = null;
        if (Hls.isSupported() && item.url.includes('.m3u8')) {
            hls = new Hls();
            hls.loadSource(item.url);
            hls.attachMedia(media as HTMLVideoElement);
        } else if (media.canPlayType('application/vnd.apple.mpegurl') && item.url.includes('.m3u8')) {
            media.src = item.url;
        } else {
            media.src = item.url;
        }
        return () => { if (hls) hls.destroy(); }
    } else {
        // Audio
        media.src = item.url;
    }

  }, [item.url, eye, item.type, activeMediaRef]);

  // Screen Logic
  const screenScaleBase = screenType === ScreenType.IMAX ? 1.5 : 1.0;
  // Combine base scale with profile scale AND dynamic zoom
  const totalScale = screenScaleBase * profile.scale * zoomScale;
  
  // Magic Window / Rotation Logic
  const worldStyle: CSSProperties = {
    transform: `rotateX(${-headRotation.x}deg) rotateY(${-headRotation.y}deg)`,
    transition: 'transform 0.05s linear',
    transformStyle: 'preserve-3d'
  };

  // Video Screen Placement
  const screenDistance = isGameMode ? -900 : (screenType === ScreenType.IMAX ? -400 : -800);
  
  const eyeOffsetX = eye === 'left' ? -profile.ipdOffset : (eye === 'right' ? profile.ipdOffset : 0);
  const eyeOffsetY = profile.verticalOffset;

  const screenStyle: CSSProperties = {
      transform: `translate3d(${eyeOffsetX}px, ${eyeOffsetY}px, ${screenDistance}px) scale(${totalScale})`,
      transformStyle: 'preserve-3d'
  };

  // Video Parsing & Rendering Logic for VR Formats (SBS/TB)
  let videoElementStyle: CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      maxWidth: 'none',
  };

  if (item.type === 'video' && !isVRVideo && videoFormat !== VideoFormat.MONO_2D) {
       const isSBS = videoFormat === VideoFormat.STEREO_SBS;
       const isRightEye = eye === 'right'; 
       
       videoElementStyle = {
           position: 'absolute',
           maxWidth: 'none',
           objectFit: 'fill', 
       };

       if (isSBS) {
           videoElementStyle.width = '200%';
           videoElementStyle.height = '100%';
           videoElementStyle.top = 0;
           videoElementStyle.left = isRightEye ? '-100%' : '0%';
       } else {
           videoElementStyle.width = '100%';
           videoElementStyle.height = '200%';
           videoElementStyle.left = 0;
           videoElementStyle.top = isRightEye ? '-100%' : '0%'; 
       }
  }

  // Only show reticle in Stereo Mode
  const showReticle = vrMode === VRMode.STEREO;

  return (
    <div className={`relative h-full ${eye === 'single' ? 'w-full' : 'w-1/2'} ${eye === 'left' ? 'border-r border-gray-900/50' : ''} overflow-hidden bg-black`}>
       
       {/* VR 360/180 Renderer (Fixed Background) */}
       {isVRVideo && (
           <VRVideoRenderer 
               videoElement={document.getElementById(eye === 'right' ? 'video-right' : (eye === 'left' ? 'video-left' : 'video-single')) as HTMLVideoElement}
               format={videoFormat}
               eye={eye}
               headRotation={headRotation}
           />
       )}

       {/* 3D Scene (UI & Flat Video) */}
       <div className="w-full h-full flex items-center justify-center absolute inset-0 pointer-events-none" style={{ perspective: '800px', overflow: 'hidden' }}>
         
         {/* Rotatable World */}
         <div className="w-full h-full absolute inset-0 flex items-center justify-center" style={worldStyle}>
            
             {/* Content Plane */}
             <div className="relative transform-gpu backface-hidden" style={screenStyle}>
                 
                 {/* Video / Audio Container */}
                 <div className={`rounded-lg shadow-2xl overflow-hidden flex items-center justify-center relative ${isVRVideo ? 'bg-transparent shadow-none w-0 h-0' : 'bg-black'} ${isGameMode ? 'opacity-40' : ''} ${item.type === 'video' ? (isVRVideo ? '' : 'aspect-video') : 'h-[300px] w-[800px] bg-slate-900/50'}`} style={{ width: isVRVideo ? '0px' : '800px' }}>
                    {item.type === 'video' ? (
                        <video 
                            id={eye === 'right' ? 'video-right' : (eye === 'left' ? 'video-left' : 'video-single')}
                            className="max-w-none"
                            style={isVRVideo ? { opacity: 0, position: 'absolute', width: 1, height: 1 } : videoElementStyle}
                            ref={videoRef as React.RefObject<HTMLVideoElement>}
                            muted={eye === 'right'} 
                            playsInline
                            loop
                            crossOrigin="anonymous" 
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full relative">
                            <audio 
                                id={eye === 'right' ? 'video-right' : (eye === 'left' ? 'video-left' : 'video-single')}
                                ref={videoRef as React.RefObject<HTMLAudioElement>}
                                muted={eye === 'right'}
                                loop
                                crossOrigin="anonymous"
                            />
                             <div className="absolute inset-0 opacity-20 flex items-end justify-between px-10 gap-2">
                                {[...Array(20)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-emerald-500 transition-all duration-75 ease-out rounded-t" 
                                         style={{ height: isPlaying ? `${Math.random() * 80 + 10}%` : '5%' }} 
                                    />
                                ))}
                             </div>
                            
                            <div className="z-10 text-center">
                                <i className="fas fa-music text-6xl text-emerald-400 mb-4 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]"></i>
                                <h3 className="text-xl text-white font-bold tracking-widest uppercase">{t.audioVisualizer}</h3>
                            </div>
                        </div>
                    )}
                 </div>
                 
                 {/* GAME MODE RENDERER */}
                 {isGameMode && (
                     <RhythmGameRenderer 
                        mediaRef={activeMediaRef}
                        isPlaying={isPlaying}
                        hitObjectsRef={hitObjectsRef}
                     />
                 )}

                 {/* Subtitles & Definition */}
                 <div className={`absolute inset-0 flex flex-col justify-end pb-16 transform translate-z-10 w-[800px] pointer-events-none ${isVRVideo ? '-mt-[300px]' : ''}`}>
                    <SubtitleRenderer currentCue={currentCue} eyePrefix={eye} />
                    <InfoPanel definition={definition} isLoading={isTranslating} language={language} />
                 </div>

                 {/* GAME HUD */}
                 {isGameMode && (
                     <div className="absolute top-[-350px] left-0 right-0 flex justify-between items-start px-8 transform translate-z-10 w-[800px]">
                        <div className="bg-slate-900/80 border border-indigo-500 rounded-xl p-4 backdrop-blur-md shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                            <div className="text-indigo-400 text-sm font-bold uppercase tracking-wider">{t.score}</div>
                            <div className="text-4xl font-black text-white font-mono">{gameStats.score.toLocaleString()}</div>
                        </div>
                        {gameStats.combo > 1 && (
                            <div className="text-center animate-bounce">
                                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" style={{ WebkitTextStroke: '2px white' }}>{gameStats.combo}x</div>
                                <div className="text-yellow-200 text-sm font-bold uppercase tracking-widest">{t.combo}</div>
                            </div>
                        )}
                     </div>
                 )}
                 
                 {/* RECENTER BUTTON */}
                 {vrMode === VRMode.STEREO && (
                     <div className="absolute -bottom-48 left-0 right-0 flex flex-col items-center justify-center transform translate-z-10 pointer-events-auto">
                        <div 
                          className="bg-slate-800/80 border border-slate-600 rounded-full px-6 py-3 flex items-center gap-3 backdrop-blur-md transition-colors hover:bg-emerald-600/80 group cursor-crosshair"
                          data-action="recenter"
                        >
                          <i className="fas fa-sync-alt text-white text-xl group-hover:rotate-180 transition-transform duration-500"></i>
                          <span className="text-white font-bold text-lg">{t.recenter}</span>
                        </div>
                     </div>
                 )}

                 {/* Close Definition Button */}
                 {definition && (
                     <div className="absolute top-0 right-0 p-4 transform translate-z-20 pointer-events-auto">
                         <button 
                            onClick={onCloseDefinition}
                            className="bg-white/10 p-3 rounded-full hover:bg-red-500/50 transition-colors border border-white/20"
                            data-word="close-btn"
                         >
                            <i className="fas fa-times text-white text-xl"></i>
                         </button>
                     </div>
                 )}

             </div>
         </div>
       </div>

       {/* Calibration Overlay */}
       {isCalibrationMode && (
         <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border-2 border-emerald-500 p-8 rounded-2xl text-center max-w-sm mx-4 shadow-2xl shadow-emerald-900/50">
                <i className="fas fa-crosshairs text-5xl text-emerald-400 mb-4 animate-pulse"></i>
                <h2 className="text-2xl font-bold text-white mb-2">{t.calibrationMode}</h2>
                <p className="text-slate-300 mb-4">{t.calibrationInstruct}</p>
                <div className="text-xs text-white border-t border-slate-700 pt-2">
                    {t.controlsHelp}
                </div>
            </div>
         </div>
       )}

       {/* Reticle */}
       {!isCalibrationMode && showReticle && <Reticle isHovering={!!hoveredWord} progress={dwellProgress} />}
       
       {/* Play Overlay */}
       {!isPlaying && !definition && !isCalibrationMode && vrMode === VRMode.STEREO && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
               <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-white/40 text-6xl drop-shadow-xl`}></i>
           </div>
       )}
    </div>
  );
};