"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Loader2, Zap } from "lucide-react";

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
  audioUrl?: string;
}

interface LiveTranscriptProps {
  meetingId: string;
  onComplete: (fullTranscript: string) => void;
}

export default function LiveTranscript({ meetingId, onComplete }: LiveTranscriptProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [segmentCount, setSegmentCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const queueRef = useRef<Blob[]>([]);
  const isTranscribingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  const processQueue = useCallback(async () => {
    if (isTranscribingRef.current || queueRef.current.length === 0) return;
    isTranscribingRef.current = true;
    setIsTranscribing(true);

    try {
      const chunk = queueRef.current.shift()!;
      const formData = new FormData();
      formData.append("audio", new File([chunk], "segment.webm", { type: "audio/webm" }));
      formData.append("meetingId", meetingId);

      const res = await fetch("/api/transcribe-segment", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Transcription failed");

      const data = await res.json();
      if (data.text) {
        const segment: TranscriptSegment = {
          id: crypto.randomUUID(),
          text: data.text,
          timestamp: new Date(),
          audioUrl: data.audioUrl,
        };
        segmentsRef.current.push(segment);
        setSegments([...segmentsRef.current]);
        setSegmentCount((c) => c + 1);
      }
    } catch (err) {
      console.error("Segment transcription error:", err);
      setError("Failed to transcribe a segment, continuing...");
    } finally {
      isTranscribingRef.current = false;
      setIsTranscribing(false);
      // Process next
      setTimeout(() => processQueue(), 500);
    }
  }, [meetingId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 100) {
          queueRef.current.push(e.data);
          processQueue();
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // Finalize: process remaining queue
        const fullText = segmentsRef.current.map((s) => s.text).join(" ");
        onComplete(fullText);
      };

      recorder.start(5000); // 5-second chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setError(null);
    } catch {
      setError("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-bg-base max-w-[720px] mx-auto px-6 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[family:var(--font-syne)] font-bold text-2xl text-text-primary">
            Live Recording
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Speaking will appear here in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border-subtle">
            {isRecording && (
              <>
                <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                <span className="text-error text-xs font-medium">Live</span>
              </>
            )}
            {isTranscribing && (
              <>
                <Loader2 className="w-3 h-3 text-accent-primary animate-spin" />
                <span className="text-accent-primary text-xs">Transcribing...</span>
              </>
            )}
            {!isRecording && !isTranscribing && (
              <>
                <Mic className="w-3 h-3 text-text-muted" />
                <span className="text-text-muted text-xs">Ready</span>
              </>
            )}
          </div>
          <span className="text-xs text-text-muted font-[family:var(--font-jetbrains)]">
            {segmentCount} segments
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-error-muted border border-error/20 rounded-xl px-4 py-3 text-error text-sm">
          {error}
        </div>
      )}

      {/* Recording controls */}
      <div className="sticky top-20 z-30 bg-bg-base/90 backdrop-blur-xl rounded-xl border border-border-subtle px-4 py-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRecording ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-text-primary text-sm font-medium">Recording...</span>
            </div>
          ) : (
            <span className="text-text-muted text-sm">Ready to record</span>
          )}
          {segments.length > 0 && (
            <span className="text-text-muted text-xs font-[family:var(--font-jetbrains)]">
              {segments.reduce((sum, s) => sum + s.text.split(" ").length, 0)} words
            </span>
          )}
        </div>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            isRecording
              ? "bg-error/20 text-error border border-error/30 hover:bg-error/30"
              : "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover"
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              Start Recording
            </>
          )}
        </button>
      </div>

      {/* Transcript */}
      <div className="space-y-3 min-h-[300px]">
        {segments.length === 0 && !isRecording && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center mb-4">
              <Mic className="w-6 h-6 text-text-muted" />
            </div>
            <h3 className="text-text-secondary font-semibold text-lg mb-2">
              Start a live recording
            </h3>
            <p className="text-text-muted text-sm max-w-xs">
              Audio is transcribed in 5-second chunks. Your transcript appears here as you speak.
            </p>
          </div>
        )}

        {segments.map((seg) => (
          <div
            key={seg.id}
            className="bg-bg-surface rounded-xl px-4 py-3 border border-border-subtle animate-fade-in"
          >
            <div className="flex items-start gap-3">
              <span className="text-xs text-text-muted font-[family:var(--font-jetbrains)] mt-0.5 flex-shrink-0">
                {formatTime(seg.timestamp)}
              </span>
              <p className="text-text-primary text-sm leading-relaxed flex-1">
                {seg.text}
              </p>
            </div>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* Info */}
      {isRecording && (
        <div className="mt-6 flex items-center justify-center gap-2 text-text-muted text-xs">
          <Zap className="w-3 h-3" />
          <span>Real-time transcription powered by OpenAI Whisper</span>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeInUp 0.3s ease both;
        }
      `}</style>
    </div>
  );
}
