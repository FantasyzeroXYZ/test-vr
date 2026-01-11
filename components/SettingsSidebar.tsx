import React, { useState, useEffect } from 'react';
import { Language, VRProfile, GamepadMapping, GamepadAction, LibraryItem } from '../types';
import { translations } from '../utils/i18n';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activeProfile: VRProfile;
  onProfileChange: (profile: VRProfile) => void;
  PRESETS: VRProfile[];
  gamepadMapping: GamepadMapping;
  onUpdateMapping: (action: GamepadAction, button: number) => void;
  onResetMapping: () => void;
  // Data management
  onImportData: (data: any) => void;
  onClearData: () => void;
  currentDataExport: any; 
}

const AccordionItem: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => (
    <details className="group border-b border-white/5" open={defaultOpen}>
        <summary className="flex items-center justify-between py-4 cursor-pointer hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors list-none select-none">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">{title}</h3>
            <i className="fas fa-chevron-down text-slate-600 text-xs transition-transform duration-200 group-open:rotate-180"></i>
        </summary>
        <div className="pb-6 pt-2 space-y-4 animate-in slide-in-from-top-1 duration-200">
            {children}
        </div>
    </details>
);

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  activeProfile,
  onProfileChange,
  PRESETS,
  gamepadMapping,
  onUpdateMapping,
  onResetMapping,
  onImportData,
  onClearData,
  currentDataExport
}) => {
  const t = translations[language];
  const [listeningForKey, setListeningForKey] = useState<GamepadAction | null>(null);

  // Poll for gamepad input when listening
  useEffect(() => {
    if (!listeningForKey) return;
    
    let frameId: number;
    const checkButton = () => {
       const gp = navigator.getGamepads()[0];
       if (gp) {
          const pressedIndex = gp.buttons.findIndex(b => b.pressed);
          if (pressedIndex !== -1) {
             onUpdateMapping(listeningForKey, pressedIndex);
             setListeningForKey(null);
             return; 
          }
       }
       frameId = requestAnimationFrame(checkButton);
    };
    frameId = requestAnimationFrame(checkButton);
    return () => cancelAnimationFrame(frameId);
  }, [listeningForKey, onUpdateMapping]);


  const actionLabels: Record<GamepadAction, string> = {
      CLICK: t.actionClick,
      RECENTER: t.actionRecenter,
      PLAY_PAUSE: t.actionPlayPause,
      SEEK_BACK: t.actionSeekBack,
      SEEK_FWD: t.actionSeekFwd,
      MOVE_LEFT: t.actionMoveLeft,
      MOVE_RIGHT: t.actionMoveRight,
      MOVE_UP: t.actionMoveUp,
      MOVE_DOWN: t.actionMoveDown,
      VOL_UP: t.actionVolUp,
      VOL_DOWN: t.actionVolDown
  };

  const handleExport = () => {
      const dataStr = JSON.stringify(currentDataExport, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vr-linguaglance-config-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const json = JSON.parse(evt.target?.result as string);
              onImportData(json);
              alert(t.dataImported);
          } catch (err) {
              alert(t.error);
          }
      };
      reader.readAsText(file);
  };

  const handleClear = () => {
      if (confirm("Are you sure you want to clear all local data?")) {
          onClearData();
          alert(t.dataCleared);
      }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div 
        className={`fixed top-0 right-0 h-[100dvh] w-80 bg-slate-950/95 backdrop-blur-xl border-l border-white/5 shadow-2xl z-[70] transform transition-transform duration-300 ease-out overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <i className="fas fa-sliders-h text-emerald-500"></i> {t.settings}
            </h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Language Section */}
            <AccordionItem title={t.language} defaultOpen={false}>
              <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-xl border border-white/5">
                <button
                  onClick={() => onLanguageChange('zh')}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${language === 'zh' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  中文
                </button>
                <button
                  onClick={() => onLanguageChange('en')}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${language === 'en' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  English
                </button>
              </div>
            </AccordionItem>

             {/* Gamepad Settings */}
            <AccordionItem title={t.gamepadSettings} defaultOpen={false}>
                <div className="flex justify-between items-end mb-3">
                    <span className="text-[10px] text-slate-500">{t.controlsHelp}</span>
                    <button onClick={onResetMapping} className="text-[10px] text-emerald-500 hover:text-emerald-400 underline">
                        {t.resetDefaults}
                    </button>
                </div>
                
                <div className="bg-slate-900 rounded-xl border border-white/5 divide-y divide-white/5">
                    {(Object.keys(gamepadMapping) as GamepadAction[]).map((action) => (
                        <div key={action} className="p-3 flex items-center justify-between">
                             <span className="text-sm text-slate-300">{actionLabels[action]}</span>
                             <button 
                                onClick={() => setListeningForKey(action)}
                                disabled={listeningForKey !== null}
                                className={`px-3 py-1.5 rounded text-xs font-mono font-bold min-w-[60px] transition-all ${listeningForKey === action ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                             >
                                 {listeningForKey === action ? t.waitingForInput : `${t.button} ${gamepadMapping[action]}`}
                             </button>
                        </div>
                    ))}
                </div>
                {listeningForKey && (
                    <div className="text-center text-emerald-500 text-xs mt-2 animate-pulse">
                        {t.pressButton}
                    </div>
                )}
            </AccordionItem>

            {/* Global VR Calibration */}
            <AccordionItem title={t.vrCalibration} defaultOpen={false}>
              <div className="space-y-6">
                <div>
                   <label className="block text-slate-400 text-xs mb-2">{t.profile}</label>
                   <div className="relative">
                       <select 
                          className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 appearance-none"
                          onChange={(e) => {
                              const p = PRESETS.find(pr => pr.id === e.target.value);
                              if(p) onProfileChange(p);
                          }}
                          value={PRESETS.find(p => p.name === activeProfile.name)?.id || 'custom'}
                       >
                           {PRESETS.map(p => (
                             <option key={p.id} value={p.id}>{p.name}</option> 
                           ))}
                           <option value="custom">{t.custom}</option>
                       </select>
                       <div className="absolute right-4 top-3.5 text-slate-500 pointer-events-none">
                           <i className="fas fa-chevron-down text-xs"></i>
                       </div>
                   </div>
                </div>

                {/* Range Sliders with better styling */}
                <div className="space-y-5">
                    {[
                        { label: t.ipd, val: activeProfile.ipdOffset, min: -50, max: 50, step: 1, unit: 'px', key: 'ipdOffset' },
                        { label: t.vertical, val: activeProfile.verticalOffset, min: -50, max: 50, step: 1, unit: 'px', key: 'verticalOffset' },
                        { label: t.scale, val: activeProfile.scale, min: 0.5, max: 1.5, step: 0.05, unit: 'x', key: 'scale' }
                    ].map((setting) => (
                        <div key={setting.key}>
                           <div className="flex justify-between mb-2">
                               <label className="text-slate-400 text-xs">{setting.label}</label>
                               <span className="text-emerald-400 text-xs font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">{typeof setting.val === 'number' ? setting.val.toFixed(setting.key === 'scale' ? 2 : 0) : setting.val}{setting.unit}</span>
                           </div>
                           <input 
                               type="range" min={setting.min} max={setting.max} step={setting.step}
                               value={setting.val}
                               onChange={(e) => onProfileChange({...activeProfile, [setting.key]: parseFloat(e.target.value)})}
                               className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                           />
                        </div>
                    ))}
                </div>
              </div>
            </AccordionItem>

            {/* Data Management */}
            <AccordionItem title={t.dataManagement} defaultOpen={false}>
                <div className="space-y-3">
                    <button onClick={handleExport} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white border border-slate-700 transition-colors flex items-center justify-center gap-2">
                         <i className="fas fa-file-export"></i> {t.exportData}
                    </button>
                    <label className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                         <i className="fas fa-file-import"></i> {t.importData}
                         <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                    <button onClick={handleClear} className="w-full py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-sm text-red-200 border border-red-900 transition-colors flex items-center justify-center gap-2">
                         <i className="fas fa-trash-alt"></i> {t.clearData}
                    </button>
                </div>
            </AccordionItem>
          </div>
            
          <div className="pt-6 border-t border-white/5 mt-auto">
             <p className="text-[10px] text-slate-600 text-center uppercase tracking-widest font-bold">
                 VR LinguaGlance
             </p>
          </div>
        </div>
      </div>
    </>
  );
};