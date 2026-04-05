"use client";

import { useRef, useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

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
  const { user } = useUser();

  const [lastLeftTap, setLastLeftTap] = useState(0);
  const [lastRightTap, setLastRightTap] = useState(0);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [effect, setEffect] = useState<null | "forward" | "backward">(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  // subscription state
  const [planName, setPlanName] = useState("FREE");
  const [maxMinutes, setMaxMinutes] = useState<number | null>(5);
  const [limitMessage, setLimitMessage] = useState("");

  const videoUrl = `/api/proxy/${(video?.filepath || "").replace(/\\/g, "/")}`;
  const allowedSeconds = maxMinutes === null ? null : maxMinutes * 60;
  const effectiveTotalSec =
      allowedSeconds === null ? duration : Math.min(duration, allowedSeconds);

  const enforceLimit = () => {
    const player = videoRef.current;
    if (!player || allowedSeconds === null) return;

    if (player.currentTime >= allowedSeconds) {
      // clamp playback at the limit
      player.currentTime = allowedSeconds;
      player.pause();
      setLimitMessage(
          `Your ${planName} plan allows only ${maxMinutes} minutes. Upgrade to watch more.`
      );
    }
  };

  useEffect(() => {
    const fetchSubscription = async () => {
      // guest users => FREE plan
      if (!user?._id) {
        setPlanName("FREE");
        setMaxMinutes(5);
        return;
      }

      try {
        const res = await axiosInstance.get(`/subscription/user/${user._id}`);
        setPlanName(res.data?.plan || "FREE");
        setMaxMinutes(
            typeof res.data?.maxMinutes === "number" ? res.data?.maxMinutes : null
        );
      } catch (error) {
        console.log("Subscription fetch error:", error);
        setPlanName("FREE");
        setMaxMinutes(5);
      }
    };

    fetchSubscription();
  }, [user]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;

    // reset message when video changes
    setLimitMessage("");

    const syncDuration = () => {
      const d = player.duration;
      // duration can be NaN/Infinity/0 while metadata isn't ready
      if (!Number.isFinite(d) || d <= 0) return;
      setDuration(d);
    };

    // If metadata is already available, set duration immediately
    if (player.readyState >= 1) {
      syncDuration();
    }

    const handleTimeUpdate = () => {
      setCurrentTime(player.currentTime);
      enforceLimit();
    };

    const handlePlay = () => {
      setIsPlaying(true);
      enforceLimit();
    };

    const handlePause = () => setIsPlaying(false);

    player.addEventListener("loadedmetadata", syncDuration);
    player.addEventListener("durationchange", syncDuration);
    player.addEventListener("timeupdate", handleTimeUpdate);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);

    return () => {
      player.removeEventListener("loadedmetadata", syncDuration);
      player.removeEventListener("durationchange", syncDuration);
      player.removeEventListener("timeupdate", handleTimeUpdate);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
    };
  }, [video?._id, allowedSeconds, planName, maxMinutes]);

  const togglePlay = () => {
    const player = videoRef.current;
    if (!player) return;

    if (allowedSeconds !== null && player.currentTime >= allowedSeconds) {
      setLimitMessage(
          `Your ${planName} plan allows only ${maxMinutes} minutes. Upgrade to watch more.`
      );
      return;
    }

    if (player.paused) player.play();
    else player.pause();
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const player = videoRef.current;
    if (!player) return;

    let time = Number(e.target.value);

    if (allowedSeconds !== null && time > allowedSeconds) {
      time = allowedSeconds;
      setLimitMessage(`Seek is limited to ${maxMinutes} minutes on ${planName} plan.`);
    }

    player.currentTime = time;
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
    const player = videoRef.current;
    if (!player) return;

    if (now - lastLeftTap < 300) {
      player.currentTime = Math.max(0, player.currentTime - 10);
      setEffect("backward");
      setTimeout(() => setEffect(null), 500);
    }

    setLastLeftTap(now);
  };

  const handleRightTap = () => {
    const now = Date.now();
    const player = videoRef.current;
    if (!player) return;

    if (now - lastRightTap < 300) {
      let nextTime = player.currentTime + 10;

      if (allowedSeconds !== null && nextTime > allowedSeconds) {
        nextTime = allowedSeconds;
        setLimitMessage(`Your ${planName} plan allows only ${maxMinutes} minutes.`);
      }

      player.currentTime = nextTime;
      setEffect("forward");
      setTimeout(() => setEffect(null), 500);
    }

    setLastRightTap(now);
  };

  const changeSpeed = (speed: number) => {
    const player = videoRef.current;
    if (!player) return;

    player.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const downloadVideo = async () => {
    setDownloadProgress(0);

    const response = await fetch(videoUrl);
    const reader = response.body?.getReader();

    if (!reader) return;

    const contentLength = Number(response.headers.get("Content-Length"));
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

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
    if (!Number.isFinite(time) || time < 0) return "0:00";
    const t = Math.floor(time);
    const mins = Math.floor(t / 60);
    const secs = t % 60;
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

        {limitMessage && (
            <div className="absolute top-2 left-2 right-2 z-30 bg-red-600 text-white text-xs p-2 rounded">
              {limitMessage}
            </div>
        )}

        <div className="absolute top-2 right-2 z-30 bg-black/70 text-white text-xs px-2 py-1 rounded">
          Plan: {planName}{" "}
          {maxMinutes === null ? "(Unlimited)" : `(${maxMinutes} min limit)`}
        </div>

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

        {effect === "forward" && (
            <div className="absolute right-10 top-1/2 text-white text-3xl">⏩ +10s</div>
        )}

        {effect === "backward" && (
            <div className="absolute left-10 top-1/2 text-white text-3xl">⏪ -10s</div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 z-20">
          <input
              type="range"
              min={0}
              max={effectiveTotalSec || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full"
          />

          <div className="flex justify-between items-center text-white text-xs mt-1">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay}>{isPlaying ? "⏸" : "▶"}</button>
              <span>
              {formatTime(Math.min(currentTime, effectiveTotalSec || 0))} / {formatTime(effectiveTotalSec)}
            </span>
            </div>

            <div className="flex items-center gap-3">
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
              {downloadProgress !== null && <span>{downloadProgress}%</span>}

              <button onClick={toggleFullscreen}>{isFullscreen ? "🗗" : "⛶"}</button>
            </div>
          </div>
        </div>
      </div>
  );
}