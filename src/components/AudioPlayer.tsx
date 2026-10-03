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
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setPlayError("This recording could not be played.");
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [onTimeUpdate]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setPlayError(null);
      audio.play().catch(() => {
        setIsPlaying(false);
        setPlayError("This recording could not be played.");
      });
    } else {
      audio.pause();
    }
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
    <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
      <audio
          key={src}
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-white hover:bg-accent-primary-hover transition-colors flex-shrink-0"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div
            className="h-1 bg-bg-elevated rounded-full cursor-pointer overflow-hidden"
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
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-text-muted font-mono">
              {formatTime(currentTime)}
            </span>
            <span className="text-[11px] text-text-muted font-mono">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <button
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {playError && (
        <p className="text-xs text-error mt-3">{playError}</p>
      )}

      {segments && segments.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-2 mt-3 pt-3 border-t border-border-subtle">
          {segments.map((seg, i) => {
            const isActive = seg.start_time !== undefined && seg.end_time !== undefined &&
              currentTime >= seg.start_time && currentTime <= seg.end_time;
            return (
              <div
                key={i}
                className={`text-xs px-3 py-2 rounded-lg transition-colors duration-100 ${
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
