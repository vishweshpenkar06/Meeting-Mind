"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Upload,
  FileAudio,
  ClipboardPaste,
  Zap,
  Loader2,
  CheckCircle,
  CircleDashed,
  Circle,
  Mic,
  Lightbulb,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/client";
import TemplateSelector from "@/components/TemplateSelector";

type DemoResult = {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: Array<{ owner: string; task: string; dueDate: string | null }>;
};

export default function NewMeetingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"upload" | "paste">("paste");
  const [uploadKind, setUploadKind] = useState<"audio" | "screen">("audio");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [agendaItems, setAgendaItems] = useState<string[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [language, setLanguage] = useState("auto");
  const [briefing, setBriefing] = useState<{
    contextSummary: string;
    pendingItems: string[];
    suggestedTopics: string[];
    risks: string[];
  } | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isVideoFile = (file: File) =>
    file.type.startsWith("video/") || ["mp4", "mov", "mkv", "avi", "webm", "m4v"].some((ext) => file.name.toLowerCase().endsWith(`.${ext}`));

  useEffect(() => {
    getUser().then(({ user }) => {
      if (user) setUser({ id: user.id });
    });
  }, []);

  const steps = [
    "Preparing your meeting",
    "Extracting key insights",
    "Structuring action items",
    "Finalizing results",
  ];

  const checkValid = () => {
    return (selectedFile || transcript.length > 100) && !isProcessing;
  };

  const handleProcess = async () => {
    if (!checkValid()) return;
    setIsProcessing(true);
    setError(null);
    setDemoResult(null);
    setProcessingStep(0);

    try {
      const useFileUpload = !!selectedFile;
      const res = await fetch("/api/meetings", {
        method: "POST",
        body: useFileUpload ? (() => {
          const formData = new FormData();
          formData.append("title", title || "");
          formData.append("transcript", transcript || "");
          if (selectedFile) formData.append("file", selectedFile);
          if (selectedTemplate) formData.append("templateName", selectedTemplate);
          if (language && language !== "auto") formData.append("language", language);
          return formData;
        })() : JSON.stringify({
          transcript: transcript || undefined,
          title: title || undefined,
          templateName: selectedTemplate || undefined,
          language: language !== "auto" ? language : undefined,
        }),
        headers: useFileUpload ? undefined : { "Content-Type": "application/json" },
      });

      setProcessingStep(2);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to process meeting");
      }

      const meeting = await res.json();
      setProcessingStep(3);

      if (meeting?.result) {
        setDemoResult(meeting.result as DemoResult);
        setIsProcessing(false);
        setProcessingStep(0);
        return;
      }

      if (!meeting?.id) {
        throw new Error("Meeting was created but no ID was returned. Please check your dashboard.");
      }

      setTimeout(() => {
        router.push(`/meeting/${meeting.id}`);
      }, 600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsProcessing(false);
      setProcessingStep(0);
    }
  };

  const handleFileSelect = (file: File) => {
    const videoFile = isVideoFile(file);
    const maxBytes = videoFile ? 500 * 1024 * 1024 : 25 * 1024 * 1024;

    if (file.size > maxBytes) {
      alert(`File too large. Maximum size is ${videoFile ? "500MB" : "25MB"}.`);
      return;
    }

    setUploadKind(videoFile ? "screen" : "audio");
    setSelectedFile(file);
    setFileName(file.name);
    setFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    setInputMode("upload");
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    }
    if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      setRecordingStartTime(new Date());

      recorder.ondataavailable = (e: { data: Blob }) => {
        chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        handleFileSelect(new File([blob], "recording.webm", { type: "audio/webm" }));
        setRecordingStartTime(null);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTemplateSelect = (name: string | null) => {
    if (!name) {
      setSelectedTemplate(null);
      setBriefing(null);
      return;
    }
    setSelectedTemplate(name);
    setAgendaItems([]);
    setLoadingAgenda(true);
    setBriefing(null);
    fetch("/api/meetings/generate-agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateName: name }),
    })
      .then((res) => res.json())
      .then((data) => { setAgendaItems(data.items || []); })
      .catch(() => {})
      .finally(() => setLoadingAgenda(false));

    setLoadingBriefing(true);
    fetch("/api/meetings/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateName: name }),
    })
      .then((res) => res.json())
      .then((data) => { setBriefing(data); })
      .catch(() => {})
      .finally(() => setLoadingBriefing(false));
  };

  return (
    <div className="min-h-screen bg-bg-base max-w-[720px] mx-auto px-6 pt-8 pb-24">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors duration-200 mb-8 text-sm font-medium hover:bg-bg-elevated/50 px-3 py-2 rounded-lg -ml-3 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-[family:var(--font-syne)] font-bold text-[32px] text-text-primary" style={{ lineHeight: "1.15" }}>
            {title ? title : "New Meeting"}
          </h1>
          <p className="text-text-secondary text-base">
            Upload a recording, record live, or paste your transcript
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/live")}
          className="flex items-center gap-2 bg-error/10 border border-error/20 text-error text-xs font-semibold px-3 py-2 rounded-lg hover:bg-error/20 transition-all mt-2"
        >
          <Mic className="w-3.5 h-3.5" />
          Live Record
        </button>
      </div>

      {/* Template Selector */}
      <div className="mt-6 mb-8">
        <TemplateSelector selectedTemplate={selectedTemplate} onSelect={handleTemplateSelect} />
      </div>

      {/* Suggested Agenda */}
      {loadingAgenda && (
        <div className="mb-6 bg-bg-surface border border-border-subtle rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-3.5 h-3.5 text-accent-primary animate-spin" />
            <span className="text-text-primary text-sm font-medium">Generating agenda...</span>
          </div>
        </div>
      )}
      {agendaItems.length > 0 && !loadingAgenda && (
        <div className="mb-6 bg-bg-surface border border-accent-purple-muted/50 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" />
              <span className="text-text-primary text-sm font-semibold">Suggested Agenda</span>
            </div>
            <button onClick={() => setAgendaItems([])} className="text-text-muted hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ol className="flex flex-col gap-2">
            {agendaItems.map((item, i) => (
              <li key={i} className="text-sm text-text-secondary flex gap-3">
                <span className="text-accent-primary font-bold flex-shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Pre-Meeting Briefing */}
      {loadingBriefing && (
        <div className="mb-6 bg-bg-surface border border-border-subtle rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-3.5 h-3.5 text-accent-purple animate-spin" />
            <span className="text-text-primary text-sm font-medium">Generating briefing...</span>
          </div>
        </div>
      )}
      {briefing && !loadingBriefing && (
        <div className="mb-6 bg-bg-surface border border-accent-purple/30 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-accent-purple" />
              <span className="text-text-primary text-sm font-semibold">Pre-Meeting Briefing</span>
            </div>
            <button onClick={() => setBriefing(null)} className="text-text-muted hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {briefing.contextSummary && (
            <p className="text-sm text-text-secondary mb-3">{briefing.contextSummary}</p>
          )}
          {briefing.pendingItems.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Pending from Past Meetings</p>
              <ul className="space-y-1">
                {briefing.pendingItems.map((item, i) => (
                  <li key={i} className="text-sm text-text-secondary flex gap-2">
                    <span className="text-warning">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {briefing.suggestedTopics.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Suggested Topics</p>
              <div className="flex flex-wrap gap-2">
                {briefing.suggestedTopics.map((topic, i) => (
                  <span key={i} className="text-xs bg-bg-elevated text-text-secondary px-2.5 py-1 rounded-full border border-border-subtle">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
          {briefing.risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Risks to Watch</p>
              <ul className="space-y-1">
                {briefing.risks.map((risk, i) => (
                  <li key={i} className="text-sm text-warning flex gap-2">
                    <span>⚠</span> {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Meeting Title Input */}
      <label className="block text-sm font-medium text-text-secondary mb-2">
        Meeting Title (optional)
      </label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={"e.g. Product Sync · April 4"}
        className="w-full bg-bg-surface border border-border-default rounded-[10px] px-4 py-3 text-text-primary text-[14px] placeholder:text-text-muted mb-4 transition-all duration-200 focus:border-accent-primary focus:outline-none focus:ring-[0_0_0_3px_rgba(79,142,247,0.15)]"
      />

      {/* Language Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Transcription Language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full bg-bg-surface border border-border-default rounded-[10px] px-4 py-3 text-text-primary text-[14px] transition-all duration-200 focus:border-accent-primary focus:outline-none focus:ring-[0_0_0_3px_rgba(79,142,247,0.15)]"
        >
          <option value="auto">Auto-detect</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="nl">Dutch</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese</option>
          <option value="hi">Hindi</option>
          <option value="ar">Arabic</option>
          <option value="ru">Russian</option>
          <option value="pl">Polish</option>
          <option value="tr">Turkish</option>
          <option value="vi">Vietnamese</option>
          <option value="th">Thai</option>
          <option value="sv">Swedish</option>
          <option value="da">Danish</option>
          <option value="fi">Finnish</option>
          <option value="no">Norwegian</option>
        </select>
      </div>

      {/* Input Mode Tabs */}
      <div className="flex gap-2 mb-6 bg-bg-surface rounded-xl p-1 border border-border-subtle w-fit">
        <button
          onClick={() => setInputMode("paste")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === "paste"
              ? "bg-accent-primary text-white"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste Transcript
        </button>
        <button
          onClick={() => { if (!fileName) { setUploadKind("audio"); setInputMode("upload"); } }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === "upload" && uploadKind === "audio"
              ? "bg-accent-primary text-white"
              : "text-text-secondary hover:text-text-primary"
          }`}
          disabled={!!fileName}
        >
          <FileAudio className="w-3.5 h-3.5" />
          Upload Audio
        </button>
        <button
          onClick={() => { if (!fileName) { setUploadKind("screen"); setInputMode("upload"); } }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === "upload" && uploadKind === "screen"
              ? "bg-accent-primary text-white"
              : "text-text-secondary hover:text-text-primary"
          }`}
          disabled={!!fileName}
        >
          <Zap className="w-3.5 h-3.5" />
          Screen Recording
        </button>
      </div>

      {/* Upload Zone */}
      {inputMode === "upload" && !fileName ? (
        <div
          className="border-2 border-dashed border-border-default bg-bg-surface rounded-[14px] px-8 py-16 text-center cursor-pointer hover:border-accent-primary hover:bg-[rgba(79,142,247,0.04)] transition-all duration-200"
          style={{
            ...(isDragging
              ? { borderColor: "#4F8EF7", backgroundColor: "rgba(79,142,247,0.08)", transform: "scale(1.01)" }
              : {}),
          }}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" className="hidden" accept={uploadKind === "screen" ? ".mp4,.mov,.webm,.m4v,.mkv,.avi,video/*" : ".mp3,.wav,.m4a,.webm,.ogg,audio/*"} onChange={handleInputChange} />
          <Upload className="w-7 h-7 text-accent-primary mx-auto mb-4" />
          <p className="text-text-primary font-semibold text-[15px] mb-1">
            Drop your {uploadKind === "screen" ? "screen recording video" : "meeting recording"} here
          </p>
          <p className="text-text-muted text-sm mb-4">
            {uploadKind === "screen"
              ? ".mp4, .mov, .webm, .m4v, .mkv, .avi · Maximum 500MB"
              : ".mp3, .wav, .m4a, .webm, .ogg · Maximum 25MB"}
          </p>
          <span className="text-accent-primary text-sm font-medium underline underline-offset-4 hover:text-accent-primary-hover transition-colors">
            Browse files
          </span>
        </div>
      ) : inputMode === "upload" && fileName ? (
        <div className="bg-bg-surface border border-success/30 rounded-[14px] px-6 py-4 flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-[10px] bg-success-muted flex items-center justify-center">
            <FileAudio className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {fileName}
            </p>
            <p className="text-xs text-text-muted mt-0.5">{fileSize}</p>
          </div>
          <CheckCircle className="w-5 h-5 text-success" />
          <button
            onClick={() => { setSelectedFile(null); setFileName(""); setFileSize(""); }}
            className="text-text-muted hover:text-text-primary text-sm transition-colors ml-2"
          >
            Change
          </button>
        </div>
      ) : (
        <>
        {/* Transcript */}
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Paste your meeting transcript
          {transcript.length > 0 && (
            <span className="text-text-muted ml-2 font-normal">
              ({transcript.length.toLocaleString()} characters)
            </span>
          )}
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={10}
          placeholder="Paste your meeting transcript here..."
          className="w-full bg-bg-surface border border-border-default rounded-[10px] px-4 py-3 text-text-primary text-[14px] placeholder:text-text-muted resize-none transition-all duration-200 focus:border-accent-primary focus:outline-none focus:ring-[0_0_0_3px_rgba(79,142,247,0.15)] leading-relaxed font-[family:var(--font-jetbrains)] mb-8"
          style={{ fontSize: "13px" }}
        />
        </>
      )}

      {/* Record Audio Button (bonus feature) */}
      <div className="mt-4 mb-8">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isRecording
              ? "bg-error/20 text-error border border-error/30 animate-pulse"
              : "bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default"
          }`}
        >
          <Mic className={`w-4 h-4 ${isRecording ? "animate-pulse" : ""}`} />
          {isRecording ? "Recording... Click to Stop" : "Record Audio"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-error-muted border border-error/20 rounded-xl px-5 py-4 text-error text-sm">
          {error}
        </div>
      )}

      {demoResult && (
        <div className="mb-6 bg-bg-surface border border-border-subtle rounded-[14px] p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Generated Notes Preview</h2>
            <p className="text-sm text-text-muted mt-1">This preview was generated locally because you are not signed in. Sign in to save it to the database.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-text-secondary mb-2">Summary</p>
            <p className="text-text-primary text-[15px] leading-[1.75] whitespace-pre-wrap">{demoResult.summary}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-text-secondary mb-2">Key Decisions</p>
            <ul className="space-y-2">
              {demoResult.decisions.map((decision, index) => (
                <li key={index} className="text-sm text-text-primary">- {decision}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-text-secondary mb-2">Action Items</p>
            <ul className="space-y-2">
              {demoResult.actionItems.map((item, index) => (
                <li key={index} className="text-sm text-text-primary">
                  <span className="font-semibold">{item.owner}</span>: {item.task}
                  {item.dueDate ? <span className="text-text-muted"> (due {item.dueDate})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Process Button */}
      <button
        onClick={handleProcess}
        disabled={!checkValid()}
        className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse text-[15px] font-semibold py-4 rounded-[10px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          ...(checkValid() && !isProcessing ? { boxShadow: "0 0 20px rgba(79,142,247,0.25)" } : {}),
        }}
      >
        <Zap className="w-4 h-4" />
        {isProcessing ? "Processing..." : "Process Meeting"}
      </button>

      {/* Processing State */}
      {isProcessing && (
        <div
          className="mt-6 bg-bg-surface border border-success/30 rounded-[14px] px-6 py-8 relative overflow-hidden"
        >
          <div className="flex items-center gap-3 mb-6">
            <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
            <span className="text-text-primary font-semibold text-[15px]">
              Analyzing your meeting...
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {i < processingStep ? (
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                ) : i === processingStep ? (
                  <CircleDashed className="w-4 h-4 text-accent-primary flex-shrink-0" style={{ animation: "pulse 1.5s infinite" }} />
                ) : (
                  <Circle className="w-4 h-4 text-text-muted/30 flex-shrink-0" />
                )}
                <span
                  className={`text-sm transition-colors ${
                    i < processingStep
                      ? "text-success"
                      : i === processingStep
                        ? "text-text-primary"
                        : "text-text-muted"
                  }`}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(processingStep / (steps.length)) * 100}%`,
                background: "linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-purple))",
              }}
            />
          </div>
        </div>
      )}

      {/* Help text */}
      {!isProcessing && (
        <p className="text-text-muted text-xs text-center mt-8">
          {"\u26A1"} AI processes your meeting in about 30 seconds
        </p>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
