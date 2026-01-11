import React from 'react';
import { SubtitleCue } from '../types';

interface SubtitleRendererProps {
  currentCue: SubtitleCue | null;
  eyePrefix: string; 
}

export const SubtitleRenderer: React.FC<SubtitleRendererProps> = ({ currentCue, eyePrefix }) => {
  if (!currentCue) return null;

  return (
    <div className="absolute bottom-[20%] w-full text-center px-8 pointer-events-auto transform translate-z-20">
      <div className="inline-block px-6 py-4 rounded-2xl">
        <p className="text-3xl md:text-4xl font-bold leading-relaxed text-yellow-300 tracking-wide font-sans">
          {currentCue.parsedWords.map((word, index) => {
             const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");
             const wordId = `${eyePrefix}-word-${index}`;
             
             return (
              <span
                key={index}
                id={wordId}
                className="mx-1 px-1.5 py-0.5 rounded-md transition-all duration-150 hover:bg-white/20 hover:text-white hover:scale-110 cursor-crosshair inline-block"
                style={{
                    textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                    WebkitTextStroke: '1px black'
                }}
                data-word={cleanWord}
                data-sentence={currentCue.text}
              >
                {word}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
};