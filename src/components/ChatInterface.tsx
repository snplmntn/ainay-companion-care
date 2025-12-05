import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Camera,
  Image,
  X,
  Pill,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Paperclip,
  FileText,
  Volume2,
  VolumeX,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatMessage } from "@/types";
import {
  chatCompletion,
  analyzeMedicineImages,
  transcribeAudio,
  fileToDataUrl,
  buildMessagesFromHistory,
  extractMedicinesFromAIResponse,
  ExtractedMedicine,
  UserContext,
} from "@/services/openai";
import {
  SupportedLanguage,
  LANGUAGES,
  getLanguageOptions,
  loadLanguagePreference,
  saveLanguagePreference,
} from "@/services/language";
import {
  speakWithFallback,
  stopAllSpeech,
  loadTTSEnginePreference,
  saveTTSEnginePreference,
  type TTSEngine,
} from "@/services/textToSpeech";
import { CameraScanner } from "./CameraScanner";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";
import { useSubscription, LockedBadge } from "@/modules/subscription";
import { useNavigate } from "react-router-dom";

interface MedicineInput {
  id: string;
  type: "camera" | "gallery" | "voice" | "text" | "file";
  imageUrl?: string;
  text?: string;
  fileName?: string;
  fileType?: "image" | "document";
}

interface DetectedMedicine extends ExtractedMedicine {
  id: string;
  selected: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function buildInitialMessage(
  userName?: string,
  medications?: Array<{ name: string; taken: boolean; time: string }>
): ChatMessage {
  let greeting = "Hello";
  if (userName) {
    greeting = `Hello, ${userName}`;
  }

  let medicationInfo = "";
  if (medications && medications.length > 0) {
    const pending = medications.filter((m) => !m.taken);
    const taken = medications.filter((m) => m.taken);

    if (pending.length > 0) {
      const pendingList = pending
        .slice(0, 3)
        .map((m) => `**${m.name}** at ${m.time}`)
        .join(", ");
      const moreCount =
        pending.length > 3 ? ` and ${pending.length - 3} more` : "";
      medicationInfo = `\n\n💊 **Pending medications today:** ${pendingList}${moreCount}`;
    }

    if (taken.length > 0 && pending.length === 0) {
      medicationInfo = `\n\n✅ **Great job!** You've taken all ${
        taken.length
      } medication${taken.length > 1 ? "s" : ""} today!`;
    } else if (taken.length > 0) {
      medicationInfo += `\n✅ ${taken.length} medication${
        taken.length > 1 ? "s" : ""
      } already taken.`;
    }
  } else {
    medicationInfo =
      "\n\n📝 **Tip:** Add your medications so I can help you track them and remind you when to take them!";
  }

  return {
    id: "1",
    role: "assistant",
    content: `${greeting}! I'm AInay, your health companion. You can:

- 📷 **Scan medicines** with your camera
- 🖼️ **Upload photos** from your gallery
- 📎 **Attach files** (images or prescription photos)
- 🎤 **Ask by voice** about your medications
- ⌨️ **Type questions** about health

I can identify multiple medicines at once and help you add them to your list!${medicationInfo}`,
    timestamp: new Date(),
  };
}

export function ChatInterface() {
  const { addMedication, medications, userName } = useApp();
  const navigate = useNavigate();
  const { hasFeature, isFree } = useSubscription();

  // Feature access checks
  const canUsePrescriptionScan = hasFeature("prescription_scan");
  const canUseVoiceAssistance = hasFeature("voice_assistance");

  // Language state
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    loadLanguagePreference()
  );

  // TTS state
  const [ttsEngine, setTTSEngine] = useState<TTSEngine>(() =>
    loadTTSEnginePreference()
  );
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const [isTTSLoading, setIsTTSLoading] = useState(false);

  // Handle TTS engine change
  const handleTTSEngineChange = (engine: TTSEngine) => {
    setTTSEngine(engine);
    saveTTSEnginePreference(engine);
    toast({
      title: engine === "browser" ? "⚡ Fast Mode" : "🎵 High Quality Mode",
      description:
        engine === "browser"
          ? "Using instant browser voices"
          : "Using OpenAI premium voices (slower)",
    });
  };

  // Build user context for AI calls (includes language)
  const userContext: UserContext = {
    userName: userName || undefined,
    language,
    medications: medications.map((med) => ({
      name: med.name,
      dosage: med.dosage,
      time: med.time,
      taken: med.taken,
      instructions: med.instructions,
    })),
  };

  // Handle language change
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    saveLanguagePreference(newLang);
    toast({
      title: `Language changed`,
      description: `AInay will now respond in ${LANGUAGES[newLang].nativeName}`,
    });
  };

  // Create dynamic initial message based on user context
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildInitialMessage(userName, medications),
  ]);

  // Update initial message when medications or username changes (only if no other messages exist)
  useEffect(() => {
    setMessages((prev) => {
      // Only update if we only have the initial message
      if (prev.length === 1 && prev[0].id === "1") {
        return [buildInitialMessage(userName, medications)];
      }
      return prev;
    });
  }, [userName, medications]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [medicineInputs, setMedicineInputs] = useState<MedicineInput[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [detectedMedicines, setDetectedMedicines] = useState<
    DetectedMedicine[]
  >([]);
  const [isExtractingMedicines, setIsExtractingMedicines] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Handle camera capture
  const handleCameraCapture = (imageDataUrl: string) => {
    const newInput: MedicineInput = {
      id: generateId(),
      type: "camera",
      imageUrl: imageDataUrl,
    };
    setMedicineInputs((prev) => [...prev, newInput]);
  };

  // Handle gallery selection
  const handleGallerySelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const newInputs = await Promise.all(
        Array.from(files).map(async (file) => {
          const imageUrl = await fileToDataUrl(file);
          return {
            id: generateId(),
            type: "gallery" as const,
            imageUrl,
          };
        })
      );
      setMedicineInputs((prev) => [...prev, ...newInputs]);
    } catch (error) {
      console.error("Failed to process images:", error);
    }

    event.target.value = "";
  };

  // Handle file upload (images + documents like prescriptions)
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxSize = 20 * 1024 * 1024; // 20MB limit
    const supportedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const supportedDocTypes = ["application/pdf"];
    const supportedTypes = [...supportedImageTypes, ...supportedDocTypes];

    try {
      for (const file of Array.from(files)) {
        if (file.size > maxSize) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 20MB limit.`,
            variant: "destructive",
          });
          continue;
        }

        if (!supportedTypes.includes(file.type)) {
          toast({
            title: "Unsupported file type",
            description: `${file.name} is not supported. Use images (JPG, PNG, GIF, WebP) or PDFs.`,
            variant: "destructive",
          });
          continue;
        }

        const dataUrl = await fileToDataUrl(file);
        const isImage = supportedImageTypes.includes(file.type);

        const newInput: MedicineInput = {
          id: generateId(),
          type: "file",
          imageUrl: isImage ? dataUrl : undefined,
          fileName: file.name,
          fileType: isImage ? "image" : "document",
          text: !isImage ? dataUrl : undefined, // Store PDF data in text field
        };

        setMedicineInputs((prev) => [...prev, newInput]);
      }
    } catch (error) {
      console.error("Failed to process files:", error);
      toast({
        title: "Upload failed",
        description: "Could not process the file. Please try again.",
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const removeMedicineInput = (id: string) => {
    setMedicineInputs((prev) => prev.filter((item) => item.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Extract medicines from AI response
  const extractAndShowMedicines = async (responseText: string) => {
    setIsExtractingMedicines(true);
    try {
      const medicines = await extractMedicinesFromAIResponse(responseText);
      if (medicines.length > 0) {
        const detected: DetectedMedicine[] = medicines.map((m) => ({
          ...m,
          id: generateId(),
          selected: true,
        }));
        setDetectedMedicines(detected);
        setShowAddPanel(true);
      }
    } catch (error) {
      console.error("Failed to extract medicines:", error);
    } finally {
      setIsExtractingMedicines(false);
    }
  };

  // Send message with medicine inputs
  const sendMessage = async (text: string = "") => {
    const cleanedText = text.trim();
    const imageUrls = medicineInputs
      .filter((m) => m.imageUrl)
      .map((m) => m.imageUrl!);

    const hasContent = cleanedText || imageUrls.length > 0;
    if (!hasContent || isTyping) return;

    // Clear any previous detected medicines
    setDetectedMedicines([]);
    setShowAddPanel(false);

    // Build content description
    let messageContent = cleanedText;
    if (!messageContent && imageUrls.length > 0) {
      messageContent =
        imageUrls.length === 1
          ? "Please identify this medicine."
          : `Please identify these ${imageUrls.length} medicines.`;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setMedicineInputs([]);
    setIsTyping(true);

    try {
      let assistantContent: string;

      if (imageUrls.length > 0) {
        // Use vision API for image analysis with user context
        assistantContent = await analyzeMedicineImages(
          imageUrls,
          cleanedText || undefined,
          userContext
        );
      } else {
        // Regular chat completion with history and user context
        const conversation = [...messages, userMessage];
        const openAIMessages = buildMessagesFromHistory(
          conversation.map((m) => ({
            role: m.role,
            content: m.content,
            imageUrls: m.imageUrls,
          }))
        );
        assistantContent = await chatCompletion({
          messages: openAIMessages,
          userContext,
        });
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Try to extract medicines from the response (for image scans or medicine-related questions)
      if (
        imageUrls.length > 0 ||
        cleanedText.toLowerCase().includes("medicine") ||
        cleanedText.toLowerCase().includes("medication")
      ) {
        void extractAndShowMedicines(assistantContent);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "Sorry, I could not reach AInay right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Voice recording with Whisper
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        if (audioBlob.size > 0) {
          setIsProcessingVoice(true);
          try {
            const transcribedText = await transcribeAudio(audioBlob);
            if (transcribedText) {
              // If we have pending images, send with them
              if (medicineInputs.some((m) => m.imageUrl)) {
                await sendMessage(transcribedText);
              } else {
                // Just set the input for review
                setInput(transcribedText);
              }
            }
          } catch (error) {
            console.error("Transcription failed:", error);
            const errorMessage: ChatMessage = {
              id: generateId(),
              role: "assistant",
              content:
                error instanceof Error
                  ? error.message
                  : "Sorry, I could not understand the audio. Please try again.",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          } finally {
            setIsProcessingVoice(false);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not access microphone. Please check your permissions.");
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const handleSend = () => {
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getInputTypeLabel = (item: MedicineInput) => {
    switch (item.type) {
      case "camera":
        return "📷 Scanned";
      case "gallery":
        return "🖼️ Photo";
      case "voice":
        return "🎤 Voice";
      case "text":
        return "⌨️ Text";
      case "file":
        return item.fileType === "document" ? "📄 PDF" : "📎 File";
    }
  };

  // Medicine quick-add functions
  const toggleMedicineSelection = (id: string) => {
    setDetectedMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m))
    );
  };

  const updateMedicineField = (
    id: string,
    field: keyof ExtractedMedicine,
    value: string
  ) => {
    setDetectedMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const addSelectedMedicines = () => {
    const selected = detectedMedicines.filter((m) => m.selected && m.name);

    if (selected.length === 0) {
      toast({
        title: "No medicines selected",
        description: "Please select at least one medicine to add.",
        variant: "destructive",
      });
      return;
    }

    const incomplete = selected.filter((m) => !m.dosage || !m.time);
    if (incomplete.length > 0) {
      toast({
        title: "Missing information",
        description: `Please fill in dosage and time for: ${incomplete
          .map((m) => m.name)
          .join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    selected.forEach((medicine) => {
      addMedication({
        name: medicine.name,
        dosage: medicine.dosage,
        time: medicine.time,
        instructions: medicine.instructions,
        category: "medicine",
        frequency: "once_daily",
        timePeriod: "ongoing",
        startTime: medicine.time,
        nextDayMode: "restart",
        isActive: true,
      });
    });

    toast({
      title: `${selected.length} medicine${
        selected.length > 1 ? "s" : ""
      } added!`,
      description: selected.map((m) => m.name).join(", "),
    });

    setDetectedMedicines([]);
    setShowAddPanel(false);
  };

  const dismissAddPanel = () => {
    setDetectedMedicines([]);
    setShowAddPanel(false);
  };

  // Text-to-Speech handler
  const handleSpeak = async (messageId: string, text: string) => {
    // If already speaking this message, stop
    if (speakingMessageId === messageId) {
      stopAllSpeech();
      setSpeakingMessageId(null);
      return;
    }

    // Stop any current speech
    stopAllSpeech();
    setSpeakingMessageId(messageId);
    setIsTTSLoading(true);

    try {
      await speakWithFallback(text, language, {
        engine: ttsEngine,
        speed: 0.95,
        voice: "shimmer", // Warmest female voice for OpenAI
      });
    } catch (error) {
      console.error("TTS failed:", error);
      toast({
        title: "Could not play audio",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSpeakingMessageId(null);
      setIsTTSLoading(false);
    }
  };

  // Stop TTS when component unmounts
  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input for gallery (images only) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGallerySelect}
      />

      {/* Hidden file input for documents (images + PDFs) */}
      <input
        ref={documentInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Camera Scanner Modal */}
      <CameraScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        capturedCount={medicineInputs.filter((m) => m.type === "camera").length}
      />

      {/* Language & TTS Settings Header */}
      <div className="px-4 py-2 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground" />
            <Select
              value={language}
              onValueChange={(val) =>
                handleLanguageChange(val as SupportedLanguage)
              }
            >
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {getLanguageOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* TTS Engine Toggle */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => handleTTSEngineChange("browser")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                ttsEngine === "browser"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="Instant playback using your browser's voice"
            >
              ⚡ Fast
            </button>
            <button
              onClick={() => handleTTSEngineChange("openai")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                ttsEngine === "openai"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="High-quality OpenAI voice (slower, uses API)"
            >
              🎵 Quality
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 fade-in ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                message.role === "assistant"
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {message.role === "assistant" ? (
                <Bot className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>

            {/* Message bubble */}
            <div
              className={`max-w-[80%] p-4 rounded-2xl ${
                message.role === "assistant"
                  ? "bg-card border border-border rounded-tl-md"
                  : "gradient-coral text-white rounded-tr-md"
              }`}
            >
              {/* Display attached images */}
              {message.imageUrls && message.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {message.imageUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Medicine ${idx + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border border-white/20"
                    />
                  ))}
                </div>
              )}
              <div className="text-senior-base prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:font-semibold">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>

              {/* TTS Button for assistant messages */}
              {message.role === "assistant" && (
                <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSpeak(message.id, message.content)}
                    disabled={isTTSLoading && speakingMessageId !== message.id}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    title={
                      speakingMessageId === message.id
                        ? "Stop speaking"
                        : "Listen to message"
                    }
                  >
                    {speakingMessageId === message.id ? (
                      <>
                        <VolumeX className="w-4 h-4 mr-1" />
                        <span className="text-xs">Stop</span>
                      </>
                    ) : isTTSLoading && speakingMessageId === message.id ? (
                      <>
                        <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 mr-1" />
                        <span className="text-xs">Listen</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 fade-in">
            <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-card border border-border p-4 rounded-2xl rounded-tl-md">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0s" }}
                />
                <span
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <span
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Add Medicines Panel */}
      {showAddPanel && detectedMedicines.length > 0 && (
        <div className="border-t border-border bg-card">
          <button
            onClick={() => setShowAddPanel(!showAddPanel)}
            className="w-full px-4 py-3 flex items-center justify-between bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              <span className="font-semibold text-primary">
                {detectedMedicines.length} medicine
                {detectedMedicines.length > 1 ? "s" : ""} detected - Quick Add
              </span>
            </div>
            {showAddPanel ? (
              <ChevronDown className="w-5 h-5 text-primary" />
            ) : (
              <ChevronUp className="w-5 h-5 text-primary" />
            )}
          </button>

          <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
            {detectedMedicines.map((medicine) => (
              <div
                key={medicine.id}
                className={`p-3 rounded-xl border transition-colors ${
                  medicine.selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleMedicineSelection(medicine.id)}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      medicine.selected
                        ? "bg-primary border-primary text-white"
                        : "border-muted-foreground"
                    }`}
                  >
                    {medicine.selected && <Check className="w-3 h-3" />}
                  </button>

                  <div className="flex-1 space-y-2">
                    <Input
                      value={medicine.name}
                      onChange={(e) =>
                        updateMedicineField(medicine.id, "name", e.target.value)
                      }
                      placeholder="Medicine name"
                      className="h-9 font-semibold"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={medicine.dosage}
                        onChange={(e) =>
                          updateMedicineField(
                            medicine.id,
                            "dosage",
                            e.target.value
                          )
                        }
                        placeholder="Dosage (e.g., 500mg)"
                        className="h-9 text-sm"
                      />
                      <Input
                        value={medicine.time}
                        onChange={(e) =>
                          updateMedicineField(
                            medicine.id,
                            "time",
                            e.target.value
                          )
                        }
                        placeholder="Time (e.g., 8:00 AM)"
                        className="h-9 text-sm"
                      />
                    </div>
                    <Input
                      value={medicine.instructions}
                      onChange={(e) =>
                        updateMedicineField(
                          medicine.id,
                          "instructions",
                          e.target.value
                        )
                      }
                      placeholder="Instructions (optional)"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={dismissAddPanel}
              >
                Dismiss
              </Button>
              <Button
                variant="coral"
                size="sm"
                className="flex-1"
                onClick={addSelectedMedicines}
                disabled={isExtractingMedicines}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add {detectedMedicines.filter((m) => m.selected).length} to List
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Extracting medicines indicator */}
      {isExtractingMedicines && (
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Looking for medicines to add...
          </div>
        </div>
      )}

      {/* Medicine inputs queue */}
      {medicineInputs.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-foreground">
              {medicineInputs.length} item
              {medicineInputs.length > 1 ? "s" : ""} to analyze:
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {medicineInputs.map((item) => (
              <div
                key={item.id}
                className="relative group bg-background rounded-lg border border-border overflow-hidden"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt="Medicine"
                    className="w-16 h-16 object-cover"
                  />
                ) : item.fileType === "document" ? (
                  <div className="w-16 h-16 flex flex-col items-center justify-center bg-muted p-1">
                    <FileText className="w-6 h-6 text-primary" />
                    <span className="text-[8px] text-muted-foreground truncate w-full text-center mt-1">
                      {item.fileName?.slice(0, 10)}...
                    </span>
                  </div>
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center bg-muted">
                    <Paperclip className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 text-center">
                  {getInputTypeLabel(item)}
                </span>
                <button
                  onClick={() => removeMedicineInput(item.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice recording overlay */}
      {isRecording && (
        <div className="px-4 py-3 border-t border-destructive bg-destructive/10">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="font-mono text-lg text-destructive font-semibold">
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-destructive rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 16}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <p className="text-center text-destructive text-sm mt-2">
            🎤 Recording... Tap mic to stop
          </p>
        </div>
      )}

      {/* Voice processing indicator */}
      {isProcessingVoice && (
        <div className="px-4 py-3 border-t border-primary bg-primary/10">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-primary font-medium">
              Processing your voice...
            </span>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex gap-2">
          {/* Camera button */}
          <div className="relative">
            <Button
              variant="secondary"
              size="icon-lg"
              onClick={() => {
                if (!canUsePrescriptionScan) {
                  toast({
                    title: "Pro Feature",
                    description:
                      "Prescription scanning requires a Pro subscription.",
                    action: (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/subscription/pricing")}
                      >
                        Upgrade
                      </Button>
                    ),
                  });
                  return;
                }
                setIsCameraOpen(true);
              }}
              disabled={isTyping || isRecording}
              className="rounded-full shrink-0"
              title={
                canUsePrescriptionScan
                  ? "Scan medicine with camera"
                  : "Pro feature - Upgrade to unlock"
              }
            >
              <Camera className="w-6 h-6" />
            </Button>
            {!canUsePrescriptionScan && <LockedBadge />}
          </div>

          {/* Gallery button */}
          <Button
            variant="secondary"
            size="icon-lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping || isRecording}
            className="rounded-full shrink-0"
            title="Choose from gallery"
          >
            <Image className="w-6 h-6" />
          </Button>

          {/* File upload button */}
          <Button
            variant="secondary"
            size="icon-lg"
            onClick={() => documentInputRef.current?.click()}
            disabled={isTyping || isRecording}
            className="rounded-full shrink-0"
            title="Upload file (images or PDF)"
          >
            <Paperclip className="w-6 h-6" />
          </Button>

          {/* Voice button */}
          <div className="relative">
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="icon-lg"
              onClick={() => {
                if (!canUseVoiceAssistance) {
                  toast({
                    title: "Pro Feature",
                    description:
                      "Voice assistance requires a Pro subscription.",
                    action: (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/subscription/pricing")}
                      >
                        Upgrade
                      </Button>
                    ),
                  });
                  return;
                }
                handleVoiceInput();
              }}
              disabled={isTyping || isProcessingVoice}
              className="rounded-full shrink-0"
              title={
                canUseVoiceAssistance
                  ? isRecording
                    ? "Stop recording"
                    : "Voice input"
                  : "Pro feature - Upgrade to unlock"
              }
            >
              {isRecording ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>
            {!canUseVoiceAssistance && <LockedBadge />}
          </div>

          {/* Text input */}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              medicineInputs.length > 0
                ? "Add context or just send..."
                : "Type your question..."
            }
            className="input-senior flex-1"
            onKeyDown={handleKeyDown}
            disabled={isTyping || isRecording}
          />

          {/* Send button */}
          <Button
            variant="coral"
            size="icon-lg"
            onClick={handleSend}
            disabled={
              (!input.trim() && medicineInputs.length === 0) ||
              isTyping ||
              isRecording
            }
            className="rounded-full shrink-0"
          >
            <Send className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
