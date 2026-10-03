"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Loader2, Zap } from "lucide-react";

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
}

function pickRecordingMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

export default function LiveMeetingPage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const queueRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef(false);
  // Read through a ref so the recorder callbacks below never close over a stale meetingId
  const meetingIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  const appendSegment = (text: string) => {
    const seg: TranscriptSegment = {
      id: crypto.randomUUID(),
      text,
      timestamp: new Date(),
    };
    segmentsRef.current.push(seg);
    if (mountedRef.current) setSegments([...segmentsRef.current]);
  };

  const transcribeChunk = async (chunk: Blob, id: string | null): Promise<string | null> => {
    const formData = new FormData();
    formData.append("audio", new File([chunk], "segment.webm", { type: chunk.type || "audio/webm" }));
    if (id) formData.append("meetingId", id);

    const res = await fetch("/api/transcribe-segment", { method: "POST", body: formData });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Transcription failed (${res.status})`);
    }
    const data = await res.json();
    return data.text || null;
  };

  const processQueue = useCallback(async () => {
    const id = meetingIdRef.current;
    if (isProcessingRef.current || queueRef.current.length === 0 || !id) return;
    isProcessingRef.current = true;
    if (mountedRef.current) setIsTranscribing(true);

    try {
      const chunk = queueRef.current.shift()!;
      const text = await transcribeChunk(chunk, id);
      if (text) appendSegment(text);
    } catch (err) {
      console.error("Segment error:", err);
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Transcription error");
    } finally {
      isProcessingRef.current = false;
      if (mountedRef.current) setIsTranscribing(false);
      if (mountedRef.current && queueRef.current.length > 0 && meetingIdRef.current) {
        retryTimerRef.current = setTimeout(() => processQueue(), 500);
      }
    }
  }, []);

  const startMeeting = async () => {
    let createdMeetingId: string | null = null;

    try {
      // Create a empty meeting in `live` type
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Live recording in progress...", title: "Live Meeting" }),
      });

      if (!res.ok) throw new Error("Failed to create meeting");
      const meeting = await res.json();
      createdMeetingId = meeting.id;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      meetingIdRef.current = createdMeetingId;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 100) {
          queueRef.current.push(e.data);
          processQueue();
        }
      };

      recorder.start(5000);
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("Could not start recording:", err);
      // Never leave an orphaned "Live Meeting" row behind a failed permission prompt
      if (createdMeetingId) {
        await fetch(`/api/meetings/${createdMeetingId}`, { method: "DELETE" }).catch(() => {});
      }
      meetingIdRef.current = null;
      setError("Could not start recording. Check microphone permissions.");
    }
  };

  const stopMeeting = async () => {
    const recorder = mediaRecorderRef.current;
    const finalChunk = new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      // stop() fires one last ondataavailable; wait for it so the tail is not dropped
      recorder.addEventListener("dataavailable", (e) => resolve(e.data.size > 100 ? e.data : null), { once: true });
      recorder.addEventListener("stop", () => resolve(null), { once: true });
      recorder.stop();
    });

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);

    // Wait for any in-flight transcription to finish (with timeout)
    let waited = 0;
    while (isProcessingRef.current && waited < 10000) {
      await new Promise((r) => setTimeout(r, 300));
      waited += 300;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Flush remaining queue safely (copy then clear to avoid races)
    const remaining = [...queueRef.current];
    queueRef.current = [];

    const tail = await finalChunk;
    if (tail) remaining.push(tail);

    for (const chunk of remaining) {
      try {
        const text = await transcribeChunk(chunk, meetingIdRef.current);
        if (text) appendSegment(text);
      } catch (e) {
        console.error("Flush segment error:", e);
      }
    }

    const id = meetingIdRef.current;
    const fullText = segmentsRef.current.map((s) => s.text).join(" ");
    if (fullText && id) {
      try {
        const res = await fetch(`/api/meetings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_transcript: fullText }),
        });
        if (!res.ok) {
          setError("Could not save the transcript. Please retry from the meeting page.");
          return;
        }
      } catch (err) {
        console.error("Failed to update transcript:", err);
        setError("Could not save the transcript. Please retry from the meeting page.");
        return;
      }
      router.push(`/meeting/${id}`);
    } else if (id) {
      await fetch(`/api/meetings/${id}`, { method: "DELETE" }).catch(() => {});
      setError("No transcript was captured. Please check your microphone and try again.");
      router.push("/dashboard");
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="page-shell page-container pt-8 pb-24">
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
          <h1 className="font-display font-bold text-[32px] text-text-primary" style={{ lineHeight: "1.15" }}>
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
            <span className="text-text-muted text-xs font-mono">
              {segments.reduce((s, seg) => s + seg.text.split(" ").length, 0)} words
            </span>
          )}
        </div>
        <button
          onClick={isRecording ? stopMeeting : startMeeting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default"
        >
          {isRecording ? (
            <>
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-error" style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }} />
              </div>
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
              <span className="text-xs text-text-muted font-mono mt-0.5 flex-shrink-0">
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
          <span>Real-time transcription powered by Groq Whisper</span>
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
