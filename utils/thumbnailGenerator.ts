export const generateThumbnail = async (videoSource: string | File): Promise<string | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    const src = videoSource instanceof File ? URL.createObjectURL(videoSource) : videoSource;
    video.src = src;

    // Timeout to avoid hanging
    const timeout = setTimeout(() => {
        resolve(null);
    }, 5000);

    video.onloadeddata = () => {
       // Seek a bit to ensure we have a frame (0.5s)
       video.currentTime = 0.5;
    };

    video.onseeked = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            } else {
                resolve(null);
            }
        } catch (e) {
            console.warn("Could not generate thumbnail (CORS?):", e);
            resolve(null);
        } finally {
            clearTimeout(timeout);
            if (videoSource instanceof File) {
                URL.revokeObjectURL(src);
            }
        }
    };

    video.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
    };
  });
};