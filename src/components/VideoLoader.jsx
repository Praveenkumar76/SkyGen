import React, { useRef, useEffect } from 'react';
import './VideoLoader.css';

const VideoLoader = ({ message = 'Loading...', size = 'medium' }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    // Ensure video loops and plays
    if (videoRef.current) {
      videoRef.current.loop = true;
      videoRef.current.autoplay = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, []);

  return (
    <div className={`video-loader-container ${size}`}>
      <video
        ref={videoRef}
        className="video-loader"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/logo-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {message && <div className="video-loader-message">{message}</div>}
    </div>
  );
};

export default VideoLoader;

