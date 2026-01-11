import React, { useState, useEffect } from 'react';
import { LibraryItem, VRMode, ScreenType, PlayerConfig, VideoFormat, VRProfile, Language, ControlMode, SourceType, DragAxis, LibraryViewMode } from '../types';
import { translations } from '../utils/i18n';
import { generateThumbnail } from '../utils/thumbnailGenerator';

interface VideoLibraryProps {
  items: LibraryItem[];
  setItems: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
  onPlay: (item: LibraryItem, config: PlayerConfig) => void;
  onOpenSettings: () => void;
  language: Language;
  currentProfile: VRProfile; 
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({ items, setItems, onPlay, onOpenSettings, language, currentProfile }) => {
  const t = translations[language];

  // Global Config Persisted? For now just use defaults when clicking play directly
  // In a real app we'd save user preference for Mode/ScreenType.
  const [defaultMode] = useState<VRMode>(VRMode.MAGIC_WINDOW);
  const [defaultScreen] = useState<ScreenType>(ScreenType.CINEMA);

  // Edit State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formThumbnail, setFormThumbnail] = useState<string | undefined>(undefined);
  
  // Format state for editing
  const [fmtIsVR, setFmtIsVR] = useState(false);
  const [fmtDegree, setFmtDegree] = useState<'180' | '360'>('180');
  const [fmtStereo, setFmtStereo] = useState<'MONO' | 'SBS' | 'TB'>('MONO');

  const openAddModal = () => {
      setEditingItem(null);
      setFormTitle('');
      setFormUrl('');
      setFormThumbnail(undefined);
      setShowAddModal(true);
  };

  const openEditModal = (e: React.MouseEvent, item: LibraryItem) => {
      e.stopPropagation();
      setEditingItem(item);
      setFormTitle(item.title);
      setFormUrl(item.url);
      setFormThumbnail(item.thumbnail);
      
      const fmt = item.format || VideoFormat.MONO_2D;
      setFmtIsVR(fmt.startsWith('VR'));
      setFmtDegree(fmt.includes('360') ? '360' : '180');
      if (fmt.includes('SBS')) setFmtStereo('SBS');
      else if (fmt.includes('TB')) setFmtStereo('TB');
      else setFmtStereo('MONO');

      setShowAddModal(true);
  };

  const detectFormat = (name: string): VideoFormat => {
      const n = name.toLowerCase();
      if (n.includes('180')) {
          if (n.includes('sbs') || n.includes('3d')) return VideoFormat.VR180_SBS;
          if (n.includes('tb') || n.includes('ou')) return VideoFormat.VR180_TB;
          return VideoFormat.VR180_MONO;
      }
      if (n.includes('360')) {
          if (n.includes('sbs') || n.includes('3d')) return VideoFormat.VR360_SBS;
          if (n.includes('tb') || n.includes('ou')) return VideoFormat.VR360_TB;
          return VideoFormat.VR360_MONO;
      }
      if (n.includes('sbs') || n.includes('3d') || n.includes('hsbs')) return VideoFormat.STEREO_SBS;
      if (n.includes('tb') || n.includes('ou') || n.includes('top-bottom')) return VideoFormat.STEREO_TB;
      return VideoFormat.MONO_2D;
  };

  const computeFormatFromUI = () => {
      let nextFormat: VideoFormat;
      if (!fmtIsVR) {
          if (fmtStereo === 'SBS') nextFormat = VideoFormat.STEREO_SBS;
          else if (fmtStereo === 'TB') nextFormat = VideoFormat.STEREO_TB;
          else nextFormat = VideoFormat.MONO_2D;
      } else {
          const prefix = fmtDegree === '180' ? 'VR180' : 'VR360';
          if (fmtStereo === 'SBS') nextFormat = `${prefix}_SBS` as VideoFormat;
          else if (fmtStereo === 'TB') nextFormat = `${prefix}_TB` as VideoFormat;
          else nextFormat = `${prefix}_MONO` as VideoFormat;
      }
      return nextFormat;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let thumb: string | undefined = undefined;
      if (file.type.startsWith('video/')) {
         const generated = await generateThumbnail(file);
         if (generated) thumb = generated;
      }

      if (editingItem) {
          // Re-uploading file for existing item
          const newUrl = URL.createObjectURL(file);
          setFormUrl(newUrl);
          if (thumb) setFormThumbnail(thumb);

          const detected = detectFormat(file.name);
          setFmtIsVR(detected.startsWith('VR'));
          setFmtDegree(detected.includes('360') ? '360' : '180');
          if (detected.includes('SBS')) setFmtStereo('SBS');
          else if (detected.includes('TB')) setFmtStereo('TB');
          else setFmtStereo('MONO');
      } else {
          // New file -> Open Edit Modal immediately
          const isAudio = file.type.startsWith('audio/');
          const detectedFormat = detectFormat(file.name);
          
          const newItem: LibraryItem = {
            id: Date.now().toString(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            url: URL.createObjectURL(file),
            type: isAudio ? 'audio' : 'video',
            source: 'LOCAL',
            format: detectedFormat,
            thumbnail: thumb,
            isConfigured: false 
          };
          
          setEditingItem(newItem);
          setFormTitle(newItem.title);
          setFormUrl(newItem.url);
          setFormThumbnail(thumb);
          
          setFmtIsVR(detectedFormat.startsWith('VR'));
          setFmtDegree(detectedFormat.includes('360') ? '360' : '180');
          if (detectedFormat.includes('SBS')) setFmtStereo('SBS');
          else if (detectedFormat.includes('TB')) setFmtStereo('TB');
          else setFmtStereo('MONO');
          
          setShowAddModal(true);
      }
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          setFormThumbnail(url);
      }
  };

  const downloadCurrentThumbnail = () => {
      if (formThumbnail) {
          const link = document.createElement('a');
          link.href = formThumbnail;
          link.download = `thumbnail-${editingItem ? editingItem.title : 'cover'}.jpg`;
          link.click();
      }
  };

  const handleSaveEdit = () => {
      if (!editingItem) {
          // Add Network Link logic (New Item)
          if (formUrl) {
            const isAudio = formUrl.endsWith('.mp3') || formUrl.endsWith('.wav');
            const newItem: LibraryItem = {
                id: Date.now().toString(),
                title: formTitle || 'Web Stream',
                url: formUrl,
                type: isAudio ? 'audio' : 'video',
                source: 'NETWORK',
                thumbnail: formThumbnail || 'https://placehold.co/600x400/0f172a/10b981?text=WEB',
                format: computeFormatFromUI(),
                isConfigured: false 
            };
            setItems(prev => [newItem, ...prev]);
            setShowAddModal(false);
          }
      } else {
          // Check if it's a new local item that was pending (not in list yet)
          const exists = items.some(i => i.id === editingItem.id);
          const updatedFormat = computeFormatFromUI();

          if (exists) {
              setItems(prev => prev.map(item => 
                  item.id === editingItem.id 
                  ? { ...item, title: formTitle, url: formUrl, format: updatedFormat, thumbnail: formThumbnail, isConfigured: true }
                  : item
              ));
          } else {
              // It was a new local file waiting in editingItem state
              const finalizedItem: LibraryItem = {
                  ...editingItem,
                  title: formTitle,
                  format: updatedFormat,
                  thumbnail: formThumbnail,
                  isConfigured: true
              };
              setItems(prev => [finalizedItem, ...prev]);
          }
          
          setShowAddModal(false);
          setEditingItem(null);
      }
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, subtitleUrl: url } : item
      ));
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setItems(prev => prev.filter(item => item.id !== id));
  };

  // Immediate Play on Click
  const handleClickItem = (item: LibraryItem) => {
      onPlay(item, {
          mode: defaultMode,
          screenType: defaultScreen,
          videoFormat: item.format || VideoFormat.MONO_2D,
          profile: currentProfile,
          isGameMode: false,
          controlMode: 'SENSOR',
          dragAxis: 'FREE'
      });
  };

  // View Mode State local
  const [viewMode, setViewMode] = useState<LibraryViewMode>('GRID');

  const SelectionButton = ({ active, onClick, children }: any) => (
      <button 
        onClick={onClick}
        className={`flex-1 py-2 px-2 text-xs font-medium rounded-lg transition-all border ${active ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
      >
          {children}
      </button>
  );

  const FormatSelector = () => (
      <div className="space-y-4 pt-2 border-t border-slate-800/50">
        <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.videoFormat}</h4>
            <div className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">{computeFormatFromUI()}</div>
        </div>
        
        <div className="space-y-2">
            <label className="text-xs text-slate-400 block">{t.viewMode}</label>
            <div className="flex gap-2">
                <SelectionButton active={!fmtIsVR} onClick={() => setFmtIsVR(false)}>{t.viewNormal}</SelectionButton>
                <SelectionButton active={fmtIsVR} onClick={() => setFmtIsVR(true)}>{t.viewVR}</SelectionButton>
            </div>
        </div>

        {fmtIsVR && (
            <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                <label className="text-xs text-slate-400 block">{t.fov}</label>
                <div className="flex gap-2">
                    <SelectionButton active={fmtDegree === '180'} onClick={() => setFmtDegree('180')}>180°</SelectionButton>
                    <SelectionButton active={fmtDegree === '360'} onClick={() => setFmtDegree('360')}>360°</SelectionButton>
                </div>
            </div>
        )}

        <div className="space-y-2">
             <label className="text-xs text-slate-400 block">{t.stereoMode}</label>
             <div className="flex gap-2">
                <SelectionButton active={fmtStereo === 'MONO'} onClick={() => setFmtStereo('MONO')}>{t.stereoNone}</SelectionButton>
                <SelectionButton active={fmtStereo === 'SBS'} onClick={() => setFmtStereo('SBS')}>{t.stereoSBS}</SelectionButton>
                <SelectionButton active={fmtStereo === 'TB'} onClick={() => setFmtStereo('TB')}>{t.stereoTB}</SelectionButton>
            </div>
        </div>
      </div>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white font-sans selection:bg-emerald-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex flex-row justify-between items-center gap-4 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/50">
                <i className="fas fa-vr-cardboard text-xl text-white"></i>
            </div>
        </div>
        
        <div className="flex justify-end gap-3 w-auto flex-1">
            {/* View Toggle */}
            <button 
                onClick={() => setViewMode(prev => prev === 'GRID' ? 'LIST' : 'GRID')}
                className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center justify-center"
                title={t.libraryView}
             >
                <i className={`fas ${viewMode === 'GRID' ? 'fa-list' : 'fa-th-large'}`}></i>
             </button>

             {/* Add Network - Icon Only */}
             <button 
                onClick={openAddModal}
                className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center"
                title={t.addLink}
            >
                <i className="fas fa-link text-emerald-500"></i>
            </button>

            {/* Add Local - Icon Only */}
            <label className="h-10 w-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-transparent transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-emerald-900/30" title={t.addVideo}>
                <i className="fas fa-plus"></i>
                <input type="file" accept="video/*,audio/*" className="hidden" onChange={handleFileSelect} />
            </label>

             <button 
                onClick={onOpenSettings}
                className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center justify-center"
                aria-label={t.settings}
             >
                <i className="fas fa-cog text-lg"></i>
             </button>
        </div>
      </header>
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
        {/* Add / Edit Modal */}
        {showAddModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <i className={`fas ${editingItem ? 'fa-edit' : 'fa-link'} text-emerald-500`}></i> 
                        {editingItem ? t.editItem : t.addLink}
                    </h3>
                    
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">{t.linkTitle}</label>
                            <input 
                              type="text" 
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none transition-colors"
                              value={formTitle}
                              onChange={e => setFormTitle(e.target.value)}
                            />
                        </div>
                        
                        {/* Thumbnail Editing */}
                        {(editingItem || !editingItem) && (
                            <div className="flex gap-4 items-end">
                                <div className="w-20 h-14 bg-black rounded overflow-hidden border border-slate-700 shrink-0">
                                    {formThumbnail && <img src={formThumbnail} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex gap-2">
                                     <label className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded cursor-pointer border border-slate-700">
                                         {t.uploadCover}
                                         <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                                     </label>
                                     <button onClick={downloadCurrentThumbnail} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded border border-slate-700">
                                         {t.downloadCover}
                                     </button>
                                </div>
                            </div>
                        )}

                        {editingItem?.source === 'LOCAL' ? (
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">{t.sourceLocal}</label>
                                <label className="flex items-center justify-center w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors text-sm text-slate-300 gap-2">
                                    <i className="fas fa-file-video"></i> {t.replaceFile}
                                    <input type="file" accept="video/*,audio/*" className="hidden" onChange={handleFileSelect} />
                                </label>
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">{t.sourceNetwork}</label>
                                <input 
                                  type="text" 
                                  placeholder={t.urlPlaceholder}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none transition-colors font-mono text-sm"
                                  value={formUrl}
                                  onChange={e => setFormUrl(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Always show format selector */}
                        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                            <FormatSelector />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors font-medium text-slate-300">{t.cancel}</button>
                        <button onClick={handleSaveEdit} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-white shadow-lg shadow-emerald-900/20">{t.save}</button>
                    </div>
                </div>
            </div>
        )}

        {/* Library Grid/List View */}
        <div className={viewMode === 'GRID' 
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" 
            : "flex flex-col gap-3"
        }>
          {items.map(item => (
            <div 
                key={item.id} 
                className={`group bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/10 relative ${viewMode === 'LIST' ? 'flex flex-row h-24 items-center' : 'hover:-translate-y-1'}`}
            >
              <div 
                  className={`${viewMode === 'GRID' ? 'aspect-video w-full' : 'h-full aspect-video'} bg-black relative overflow-hidden flex items-center justify-center bg-slate-900 pattern-grid-lg shrink-0 cursor-pointer`}
                  onClick={() => handleClickItem(item)}
              >
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" />
                ) : (
                  <div className={`flex flex-col items-center justify-center ${item.type === 'audio' ? 'text-pink-500' : 'text-slate-500'}`}>
                    <i className={`fas ${item.type === 'audio' ? 'fa-music' : 'fa-film'} ${viewMode === 'GRID' ? 'text-4xl' : 'text-2xl'} opacity-70`}></i>
                    {viewMode === 'GRID' && item.type === 'audio' && <span className="text-xs mt-2 font-mono uppercase tracking-widest">Audio</span>}
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-md ${item.source === 'LOCAL' ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'bg-blue-500/20 border-blue-500/50 text-blue-200'}`}>
                        {item.source === 'LOCAL' ? t.sourceLocal : t.sourceNetwork}
                    </span>
                    {item.format !== VideoFormat.MONO_2D && (
                    <div className="bg-indigo-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-400/50 shadow-sm backdrop-blur-sm">
                        {item.format?.includes('VR180') ? 'VR180' : item.format?.includes('VR360') ? 'VR360' : '3D'}
                    </div>
                    )}
                </div>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 z-10">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full w-14 h-14 flex items-center justify-center hover:bg-emerald-500 hover:border-emerald-500 transition-all shadow-xl">
                    <i className="fas fa-play text-xl pl-1"></i>
                  </div>
                </div>

                {viewMode === 'GRID' && (
                    <div className="absolute bottom-2 right-2 z-20" onClick={e => e.stopPropagation()}>
                        <label className={`text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md border cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm ${item.subtitleUrl ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-black/40 border-white/10 text-slate-300 hover:bg-black/60'}`}>
                            <i className="fas fa-closed-captioning"></i> 
                            <span className="max-w-[60px] truncate">{item.subtitleUrl ? 'CC' : '+CC'}</span>
                            <input type="file" accept=".srt,.vtt" className="hidden" onChange={(e) => handleSubtitleUpload(e, item.id)} />
                        </label>
                    </div>
                )}
              </div>
              
              <div 
                 className={`p-4 flex-1 flex flex-col justify-center ${viewMode === 'LIST' ? 'relative' : ''}`}
              >
                <h3 className="font-bold text-sm md:text-base truncate text-slate-100 mb-1 cursor-pointer hover:text-emerald-400" onClick={() => handleClickItem(item)} title={item.title}>{item.title}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                     <i className={`fas ${item.type === 'audio' ? 'fa-music' : 'fa-video'}`}></i> <span>{item.type === 'audio' ? 'Audio' : 'Video'}</span>
                </div>

                {viewMode === 'LIST' && (
                    <div className="mt-2">
                         <label className={`inline-flex text-[10px] font-bold px-2 py-1 rounded border cursor-pointer transition-colors items-center gap-1.5 ${item.subtitleUrl ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            <i className="fas fa-closed-captioning"></i> 
                            <span>{item.subtitleUrl ? 'CC Loaded' : '+ Subtitles'}</span>
                            <input type="file" accept=".srt,.vtt" className="hidden" onChange={(e) => handleSubtitleUpload(e, item.id)} />
                        </label>
                    </div>
                )}
                
                <div className={`absolute top-2 right-2 flex gap-1 z-20 ${viewMode === 'LIST' ? 'opacity-100' : 'opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                     <button 
                         onClick={(e) => openEditModal(e, item)}
                         className="bg-black/40 hover:bg-white/20 text-slate-300 hover:text-white rounded p-1.5 transition-colors backdrop-blur-md border border-white/10"
                         title={t.edit}
                     >
                        <i className="fas fa-edit text-xs"></i>
                     </button>
                     <button 
                         onClick={(e) => handleDeleteItem(e, item.id)}
                         className="bg-black/40 hover:bg-red-500/80 text-slate-300 hover:text-white rounded p-1.5 transition-colors backdrop-blur-md border border-white/10"
                         title={t.delete}
                     >
                        <i className="fas fa-trash text-xs"></i>
                     </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};