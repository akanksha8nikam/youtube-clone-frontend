"use client";

import { useRef, useState, useEffect } from "react";

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath: string;
  };
}

export default function VideoPlayer({ video }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [lastLeftTap, setLastLeftTap] = useState(0);
  const [lastRightTap, setLastRightTap] = useState(0);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [effect, setEffect] = useState<null | "forward" | "backward">(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const videoUrl = `/api/proxy/${(video?.filepath || "").replace(/\\/g, "/")}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => setDuration(video.duration);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) video.play();
    else video.pause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = Number(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;

    if (!document.fullscreenElement) {
      await container?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleLeftTap = () => {
    const now = Date.now();
    const video = videoRef.current;
    if (!video) return;

    if (now - lastLeftTap < 300) {
      video.currentTime -= 10;
      setEffect("backward");
      setTimeout(() => setEffect(null), 500);
    }

    setLastLeftTap(now);
  };

  const handleRightTap = () => {
    const now = Date.now();
    const video = videoRef.current;
    if (!video) return;

    if (now - lastRightTap < 300) {
      video.currentTime += 10;
      setEffect("forward");
      setTimeout(() => setEffect(null), 500);
    }

    setLastRightTap(now);
  };

  const changeSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const downloadVideo = async () => {
    setDownloadProgress(0);

    const response = await fetch(videoUrl);
    const reader = response.body?.getReader();

    if (!reader) return;

    const contentLength = Number(response.headers.get("Content-Length"));
    let receivedLength = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (contentLength) {
        const percent = Math.round((receivedLength / contentLength) * 100);
        setDownloadProgress(percent);
      }
    }

    const blob = new Blob(chunks);
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${video.videotitle}.mp4`;
    a.click();

    setDownloadProgress(null);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-lg overflow-hidden"
    >
      <video ref={videoRef} className="w-full h-full">
        <source src={videoUrl} type="video/mp4" />
      </video>

      {/* Gesture Zones */}
      <div className="absolute inset-0 flex z-10">
        <div className="w-1/3 h-full" onClick={handleLeftTap} />
        <div
          className="w-1/3 h-full flex items-center justify-center"
          onClick={togglePlay}
        >
          {!isPlaying && <span className="text-white text-5xl">▶</span>}
        </div>
        <div className="w-1/3 h-full" onClick={handleRightTap} />
      </div>

      {/* Gesture Effects */}
      {effect === "forward" && (
        <div className="absolute right-10 top-1/2 text-white text-3xl">
          ⏩ +10s
        </div>
      )}

      {effect === "backward" && (
        <div className="absolute left-10 top-1/2 text-white text-3xl">
          ⏪ -10s
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 z-20">

        <input
          type="range"
          min={0}
          max={duration}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full"
        />

        <div className="flex justify-between items-center text-white text-xs mt-1">

          <div className="flex items-center gap-3">

            <button onClick={togglePlay}>
              {isPlaying ? "⏸" : "▶"}
            </button>

            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

          </div>

          <div className="flex items-center gap-3">

            {/* SPEED DROPDOWN */}
            <select
              value={playbackSpeed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="bg-black text-white text-xs border border-gray-500 rounded"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>

            <button onClick={downloadVideo}>⬇</button>

            {downloadProgress !== null && (
              <span>{downloadProgress}%</span>
            )}

            <button onClick={toggleFullscreen}>
              {isFullscreen ? "🗗" : "⛶"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}