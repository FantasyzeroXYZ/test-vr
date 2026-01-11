import React, { useEffect, useRef, useState } from 'react';

export const ARBackground: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer back camera
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("AR Camera Error:", err);
        setError("Camera access denied or unavailable.");
      }
    };

    startCamera();

    return () => {
      // Cleanup stream on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black">
      {error ? (
        <div className="flex items-center justify-center h-full text-red-500 font-mono text-sm p-4 text-center">
            {error}
        </div>
      ) : (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover opacity-100"
        />
      )}
    </div>
  );
};