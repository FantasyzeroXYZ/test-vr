
export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  parsedWords: string[];
}

export interface WordDefinition {
  word: string;
  translation: string;
  pronunciation: string;
  type: string;
  contextUsage?: string;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export enum VRMode {
  NONE = 'NONE',     
  MAGIC_WINDOW = 'MAGIC_WINDOW', // Single screen, 360 movement (Handheld VR)
  STEREO = 'STEREO'  // Split screen, 360 movement (Cardboard/Glasses)
}

export enum ScreenType {
  CINEMA = 'CINEMA', // Standard 16:9 floating screen
  IMAX = 'IMAX',     // Large immersive screen
}

export enum VideoFormat {
  MONO_2D = 'MONO_2D',       // Standard 2D video (duplicated in stereo)
  STEREO_SBS = 'STEREO_SBS', // Side-by-Side 3D
  STEREO_TB = 'STEREO_TB',   // Top-Bottom 3D
  VR180_SBS = 'VR180_SBS',   // 180° Panoramic Side-by-Side
  VR180_TB = 'VR180_TB',     // 180° Panoramic Top-Bottom
  VR180_MONO = 'VR180_MONO', // 180° Monoscopic
  VR360_SBS = 'VR360_SBS',   // 360° Panoramic Side-by-Side
  VR360_TB = 'VR360_TB',     // 360° Panoramic Top-Bottom
  VR360_MONO = 'VR360_MONO'  // 360° Monoscopic
}

export interface VRProfile {
  id: string;
  name: string;
  ipdOffset: number; // Pixels to shift X (Horizontal alignment)
  verticalOffset: number; // Pixels to shift Y
  scale: number;     // Content scaling factor
}

export type MediaType = 'video' | 'audio';
export type SourceType = 'LOCAL' | 'NETWORK';
export type ControlMode = 'SENSOR' | 'TOUCH';
export type DragAxis = 'FREE' | 'HORIZONTAL';
export type LibraryViewMode = 'GRID' | 'LIST';

export interface LibraryItem {
  id: string;
  title: string;
  url: string; // Generic url
  type: MediaType;
  source: SourceType;
  subtitleUrl?: string; // Blob URL
  thumbnail?: string;
  duration?: number;
  format?: VideoFormat; // Auto-detected format
  isConfigured?: boolean; // Track if user has seen settings for this item
  defaultControlMode?: ControlMode;
  defaultVrMode?: VRMode;
}

export interface PlayerConfig {
  mode: VRMode;
  screenType: ScreenType;
  videoFormat: VideoFormat;
  profile: VRProfile;
  isGameMode: boolean;
  controlMode: ControlMode;
  dragAxis: DragAxis;
}

export type GamepadAction = 
  | 'CLICK' 
  | 'RECENTER' 
  | 'PLAY_PAUSE' 
  | 'SEEK_BACK' 
  | 'SEEK_FWD'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'MOVE_UP'
  | 'MOVE_DOWN'
  | 'VOL_UP'
  | 'VOL_DOWN';

export interface GamepadMapping {
  CLICK: number;
  RECENTER: number;
  PLAY_PAUSE: number;
  SEEK_BACK: number;
  SEEK_FWD: number;
  MOVE_LEFT: number;
  MOVE_RIGHT: number;
  MOVE_UP: number;
  MOVE_DOWN: number;
  VOL_UP: number;
  VOL_DOWN: number;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
}

export interface GameNote {
  id: string;
  lane: number; // 0, 1, 2, 3
  spawnTime: number; // When it was created
  z: number; // Current Z position
  isHit: boolean;
}

export type Language = 'zh' | 'en';
