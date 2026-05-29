"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, Loader2, Zap } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/client";

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
}

export default function LiveMeetingPage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const queueRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    getUser().then(({ user }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0 || !meetingId) return;
    isProcessingRef.current = true;
    setIsTranscribing(true);

    try {
      const chunk = queueRef.current.shift()!;
      const formData = new FormData();
      formData.append("audio", new File([chunk], "segment.webm", { type: "audio/webm" }));
      formData.append("meetingId", meetingId);

      const res = await fetch("/api/transcribe-segment", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Transcription failed");

      const data = await res.json();
      if (data.text) {
        const seg: TranscriptSegment = {
          id: crypto.randomUUID(),
          text: data.text,
          timestamp: new Date(),
        };
        segmentsRef.current.push(seg);
        setSegments([...segmentsRef.current]);
      }
    } catch (err) {
      console.error("Segment error:", err);
    } finally {
      isProcessingRef.current = false;
      setIsTranscribing(false);
      setTimeout(() => processQueue(), 500);
    }
  }, [meetingId]);

  const startMeeting = async () => {
    try {
      // Create a empty meeting in `live` type
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Live recording in progress...", title: "Live Meeting" }),
      });

      if (!res.ok) throw new Error("Failed to create meeting");
      const meeting = await res.json();
      setMeetingId(meeting.id);

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
      };

      recorder.start(5000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setError(null);
    } catch {
      setError("Could not start recording. Check microphone permissions.");
    }
  };

  const stopMeeting = async () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
    // Wait for any in-flight transcription to finish (with timeout)
    let waited = 0;
    while (isProcessingRef.current && waited < 10000) {
      // wait up to 10s
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 300));
      waited += 300;
    }

    // Flush remaining queue safely (copy then clear to avoid races)
    const remaining = [...queueRef.current];
    queueRef.current = [];

    for (const chunk of remaining) {
      try {
        const formData = new FormData();
        formData.append("audio", new File([chunk], "segment.webm", { type: "audio/webm" }));
        if (meetingId) formData.append("meetingId", meetingId);
        const res = await fetch("/api/transcribe-segment", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            const seg: TranscriptSegment = {
              id: crypto.randomUUID(),
              text: data.text,
              timestamp: new Date(),
            };
            segmentsRef.current.push(seg);
            setSegments([...segmentsRef.current]);
          }
        }
      } catch (e) {
        console.error("Flush segment error:", e);
      }
    }

    const fullText = segmentsRef.current.map((s) => s.text).join(" ");
    if (fullText && meetingId) {
      try {
        await fetch(`/api/meetings/${meetingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_transcript: fullText }),
        });
      } catch (err) {
        console.error("Failed to update transcript:", err);
      }
      router.push(`/meeting/${meetingId}`);
    } else if (meetingId) {
      // No transcript captured — navigate back to dashboard with error
      setError("No transcript was captured. Please check your microphone and try again.");
      router.push("/dashboard");
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-bg-base max-w-[720px] mx-auto px-6 pt-8 pb-24">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium hover:bg-bg-elevated/50 px-3 py-2 rounded-lg -ml-3 mb-8 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[family:var(--font-syne)] font-bold text-[32px] text-text-primary" style={{ lineHeight: "1.15" }}>
            Live Recording
          </h1>
          <p className="text-text-secondary text-base mt-1">
            Your words appear here in real-time
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border-subtle">
          {isRecording && (
            <>
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-error text-xs font-medium">Recording</span>
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
      </div>

      {error && (
        <div className="mb-4 bg-error-muted border border-error/20 rounded-xl px-4 py-3 text-error text-sm">
          {error}
        </div>
      )}

      {/* Controls */}
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
              {segments.reduce((s, seg) => s + seg.text.split(" ").length, 0)} words
            </span>
          )}
        </div>
        <button
          onClick={isRecording ? stopMeeting : startMeeting}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            isRecording
              ? "bg-error/20 text-error border border-error/30 hover:bg-error/30"
              : "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover"
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5" />
              Stop & Analyze
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
            <h3 className="text-text-secondary font-semibold text-lg mb-2">Start a live recording</h3>
            <p className="text-text-muted text-sm max-w-xs">
              Audio is transcribed in 5-second chunks. Your transcript appears here as you speak.
            </p>
          </div>
        )}
        {segments.map((seg) => (
          <div key={seg.id} className="bg-bg-surface rounded-xl px-4 py-3 border border-border-subtle"
            style={{ animation: "fadeInUp 0.3s ease both" }}>
            <div className="flex items-start gap-3">
              <span className="text-xs text-text-muted font-[family:var(--font-jetbrains)] mt-0.5 flex-shrink-0">
                {formatTime(seg.timestamp)}
              </span>
              <p className="text-text-primary text-sm leading-relaxed flex-1">{seg.text}</p>
            </div>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

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
      `}</style>
    </div>
  );
}
