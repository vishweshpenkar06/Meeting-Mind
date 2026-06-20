"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  segments?: Array<{ text: string; speaker?: string; start_time?: number; end_time?: number }>;
  onTimeUpdate?: (currentTime: number) => void;
}

export default function AudioPlayer({ src, segments, onTimeUpdate }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [onTimeUpdate]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(!isMuted);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center text-white hover:bg-accent-primary-hover transition-colors flex-shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div
            className="h-2 bg-bg-elevated rounded-full cursor-pointer overflow-hidden"
            onClick={seek}
          >
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                background: "var(--gradient-hero)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-text-muted font-[family:var(--font-jetbrains)]">
              {formatTime(currentTime)}
            </span>
            <span className="text-[11px] text-text-muted font-[family:var(--font-jetbrains)]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <button
          onClick={toggleMute}
          className="p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {segments && segments.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-2 mt-3 pt-3 border-t border-border-subtle">
          {segments.map((seg, i) => {
            const isActive = seg.start_time !== undefined && seg.end_time !== undefined &&
              currentTime >= seg.start_time && currentTime <= seg.end_time;
            return (
              <div
                key={i}
                className={`text-xs px-3 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-accent-primary/10 border border-accent-primary/20"
                    : "text-text-muted"
                }`}
              >
                {seg.speaker && (
                  <span className="font-semibold text-accent-purple mr-1">{seg.speaker}:</span>
                )}
                <span className={isActive ? "text-text-primary" : ""}>{seg.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
