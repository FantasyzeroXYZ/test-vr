import React from 'react';

interface ReticleProps {
  isHovering: boolean;
  progress: number; // 0 to 1
}

export const Reticle: React.FC<ReticleProps> = ({ isHovering, progress }) => {
  const size = 20;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress * circumference);

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex items-center justify-center">
        {/* Outer Ring (Progress) */}
        <svg
            width={size}
            height={size}
            className={`transition-all duration-200 ${isHovering ? 'scale-150' : 'scale-100'}`}
        >
            <circle
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={strokeWidth}
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
            <circle
                stroke="#10b981" // Emerald 500
                strokeWidth={strokeWidth}
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={offset}
                className="transition-all duration-75"
                transform={`rotate(-90 ${size/2} ${size/2})`}
            />
        </svg>
        
        {/* Center Dot */}
        <div className={`absolute bg-white rounded-full transition-all duration-200 ${isHovering ? 'w-1 h-1' : 'w-2 h-2'}`} />
    </div>
  );
};