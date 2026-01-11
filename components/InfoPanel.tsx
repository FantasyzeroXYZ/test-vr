import React from 'react';
import { WordDefinition, Language } from '../types';
import { translations } from '../utils/i18n';

interface InfoPanelProps {
  definition: WordDefinition | null;
  isLoading: boolean;
  language: Language;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ definition, isLoading, language }) => {
  const t = translations[language];
  if (!definition && !isLoading) return null;

  return (
    <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-3/4 md:w-1/2 bg-slate-900/90 border border-emerald-500/50 text-white p-4 rounded-xl shadow-2xl backdrop-blur-md z-40 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      {isLoading ? (
        <div className="flex items-center justify-center space-x-3">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-emerald-400 font-mono text-sm">{t.translating}</span>
        </div>
      ) : (
        definition && (
          <div className="text-center">
            <h3 className="text-xl font-bold text-emerald-400 capitalize mb-1">
              {definition.word} 
              <span className="text-xs text-slate-400 ml-2 font-normal border border-slate-600 rounded px-1">{definition.type}</span>
            </h3>
            <p className="text-slate-300 italic text-sm mb-2">/{definition.pronunciation}/</p>
            <p className="text-lg font-medium mb-2">{definition.translation}</p>
            {definition.contextUsage && (
                <p className="text-xs text-slate-400 border-t border-slate-700 pt-2 mt-2">"{definition.contextUsage}"</p>
            )}
          </div>
        )
      )}
    </div>
  );
};