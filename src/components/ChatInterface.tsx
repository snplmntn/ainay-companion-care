import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Camera,
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
  Users,
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
import { ChatMessage, LinkedPatient, Medication, FrequencyType } from "@/types";
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
import type { LinkedPatientContext } from "@/services/openai";
import { toast } from "@/hooks/use-toast";
import { useSubscription, LockedBadge } from "@/modules/subscription";
import { useNavigate } from "react-router-dom";
import { addMedicationForPatient } from "@/modules/companion/services/companionMedication";

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

// Props for companion mode - when managing a patient's medications
interface ChatInterfaceProps {
  // Optional patient context for companions adding medicines for their patients
  targetPatient?: LinkedPatient;
  // Callback when medications are updated (for realtime sync)
  onMedicationsUpdated?: () => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Map extracted frequency string to FrequencyType
const mapFrequency = (extractedFreq?: string): FrequencyType => {
  const frequencyMap: Record<string, FrequencyType> = {
    once_daily: "once_daily",
    twice_daily: "twice_daily",
    three_times_daily: "three_times_daily",
    four_times_daily: "four_times_daily",
    as_needed: "as_needed",
  };
  return frequencyMap[extractedFreq || ""] || "once_daily";
};

// Get current time in 12-hour format (e.g., "10:30 AM")
const getCurrentTime12h = (): string => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  const roundedMinutes = Math.round(minutes / 5) * 5;
  const finalMinutes = roundedMinutes >= 60 ? 0 : roundedMinutes;

  return `${hours}:${finalMinutes.toString().padStart(2, "0")} ${period}`;
};

// Normalize medicine name for comparison (case-insensitive, trimmed)
const normalizeMedicineName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
};

// Check if a medicine name is a duplicate
const isMedicineDuplicate = (
  name: string,
  existingNames: string[]
): { isDuplicate: boolean; matchedName?: string } => {
  const normalizedName = normalizeMedicineName(name);

  for (const existing of existingNames) {
    const normalizedExisting = normalizeMedicineName(existing);

    // Exact match
    if (normalizedName === normalizedExisting) {
      return { isDuplicate: true, matchedName: existing };
    }

    // Check if one contains the other
    if (
      normalizedName.includes(normalizedExisting) ||
      normalizedExisting.includes(normalizedName)
    ) {
      return { isDuplicate: true, matchedName: existing };
    }

    // Prefix match for longer names
    const minLen = Math.min(normalizedName.length, normalizedExisting.length);
    if (minLen >= 4) {
      const shorterName = normalizedName.slice(0, minLen);
      const shorterExisting = normalizedExisting.slice(0, minLen);
      if (shorterName === shorterExisting) {
        return { isDuplicate: true, matchedName: existing };
      }
    }
  }

  return { isDuplicate: false };
};

// Helper to check if a medication is truly taken (considering doses)
function isMedicationTaken(med: {
  taken: boolean;
  doses?: Array<{ taken: boolean }>;
}): boolean {
  // If medication has doses, check if ALL doses are taken
  if (med.doses && med.doses.length > 0) {
    return med.doses.every((d) => d.taken);
  }
  // Single-dose medication: check the medication's taken status
  return med.taken;
}

function buildInitialMessage(
  userName?: string,
  medications?: Array<{
    name: string;
    taken: boolean;
    time: string;
    doses?: Array<{ taken: boolean }>;
  }>,
  targetPatient?: LinkedPatient,
  linkedPatients?: LinkedPatient[],
  userRole?: string
): ChatMessage {
  // Companion mode - managing specific patient's medications
  if (targetPatient) {
    const patientMeds = targetPatient.medications || [];
    const pending = patientMeds.filter((m) => !isMedicationTaken(m));
    const taken = patientMeds.filter((m) => isMedicationTaken(m));

    let medicationInfo = "";
    if (patientMeds.length > 0) {
      if (pending.length === 0 && taken.length > 0) {
        // All medications taken - congratulate!
        medicationInfo = `\n\n✅ **Great!** ${
          targetPatient.name
        } has taken all ${taken.length} medication${
          taken.length > 1 ? "s" : ""
        } today!`;
      } else if (pending.length > 0) {
        // Only show PENDING medications - don't mention taken ones
        const pendingList = pending
          .slice(0, 3)
          .map((m) => `**${m.name}** at ${m.time}`)
          .join(", ");
        const moreCount =
          pending.length > 3 ? ` and ${pending.length - 3} more` : "";
        medicationInfo = `\n\n💊 **${targetPatient.name}'s pending medications:** ${pendingList}${moreCount}`;
        // Don't mention taken medications - avoid spamming
      }
    } else {
      medicationInfo = `\n\n📝 **Tip:** Add medications for ${targetPatient.name} using camera, voice, or by typing!`;
    }

    return {
      id: "1",
      role: "assistant",
      content: `Hello${
        userName ? `, ${userName}` : ""
      }! I'm AInay. You're managing **${targetPatient.name}'s** medications.

- 📷 **Scan medicines** with your camera
- 🖼️ **Upload photos** of prescriptions
- 📎 **Attach files** (images or documents)
- 🎤 **Ask by voice** about medicines
- ⌨️ **Type questions** about ${targetPatient.name}'s health

Medicines you add here will appear in ${
        targetPatient.name
      }'s schedule!${medicationInfo}`,
      timestamp: new Date(),
    };
  }

  // Companion mode - general view (not specific patient)
  if (userRole === "companion" && linkedPatients && linkedPatients.length > 0) {
    const activePatients = linkedPatients.filter(
      (p) => p.linkStatus === "accepted"
    );

    let patientSummary = "";
    if (activePatients.length > 0) {
      const patientsList = activePatients
        .map((p) => {
          const pendingCount = p.medications.filter(
            (m) => !isMedicationTaken(m)
          ).length;
          const status =
            pendingCount > 0 ? `⚠️ ${pendingCount} pending` : "✅ all done";
          return `**${p.name}** (${status})`;
        })
        .join("\n- ");

      patientSummary = `\n\n👥 **Your patients:**\n- ${patientsList}`;

      // Highlight patients needing attention
      const needsAttention = activePatients.filter(
        (p) =>
          p.adherenceRate < 70 ||
          p.medications.some((m) => !isMedicationTaken(m))
      );
      if (needsAttention.length > 0) {
        patientSummary += `\n\n⚠️ **Needs attention:** ${needsAttention
          .map((p) => p.name)
          .join(", ")}`;
      }
    }

    return {
      id: "1",
      role: "assistant",
      content: `Hello${
        userName ? `, ${userName}` : ""
      }! I'm AInay, your caregiving assistant.

I know about all your linked patients and their medications. You can:

- 💬 **Ask about any patient** by name (e.g., "How is Maria doing?")
- 📊 **Check adherence** (e.g., "Who has pending medications?")
- 💊 **Get medication info** (e.g., "What medications does Juan take?")
- 🔍 **Scan medicines** for any patient
- ❓ **Ask health questions** about your patients${patientSummary}`,
      timestamp: new Date(),
    };
  }

  // Patient mode - managing own medications
  let greeting = "Hello";
  if (userName) {
    greeting = `Hello, ${userName}`;
  }

  let medicationInfo = "";
  if (medications && medications.length > 0) {
    // Calculate DOSE-level stats
    let totalDoses = 0;
    let takenDoses = 0;
    const pendingDosesList: Array<{
      name: string;
      time: string;
      label?: string;
    }> = [];

    medications.forEach((m) => {
      if (m.doses && m.doses.length > 0) {
        totalDoses += m.doses.length;
        m.doses.forEach((d) => {
          if (d.taken) {
            takenDoses++;
          } else {
            pendingDosesList.push({
              name: m.name,
              time: d.time,
              label: d.label,
            });
          }
        });
      } else {
        totalDoses++;
        if (m.taken) {
          takenDoses++;
        } else {
          pendingDosesList.push({ name: m.name, time: m.time });
        }
      }
    });

    // Sort pending doses by time
    pendingDosesList.sort((a, b) => {
      const timeA = a.time.replace(/(\d+):(\d+)\s*(AM|PM)?/i, (_, h, m, p) => {
        let hour = parseInt(h);
        if (p?.toUpperCase() === "PM" && hour !== 12) hour += 12;
        if (p?.toUpperCase() === "AM" && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, "0")}:${m}`;
      });
      const timeB = b.time.replace(/(\d+):(\d+)\s*(AM|PM)?/i, (_, h, m, p) => {
        let hour = parseInt(h);
        if (p?.toUpperCase() === "PM" && hour !== 12) hour += 12;
        if (p?.toUpperCase() === "AM" && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, "0")}:${m}`;
      });
      return timeA.localeCompare(timeB);
    });

    if (pendingDosesList.length === 0 && takenDoses > 0) {
      // All doses taken - congratulate!
      medicationInfo = `\n\n✅ **Great job!** You've taken all ${takenDoses} dose${
        takenDoses > 1 ? "s" : ""
      } today!`;
    } else if (pendingDosesList.length > 0) {
      // Show next PENDING DOSES with their actual times
      const pendingList = pendingDosesList
        .slice(0, 3)
        .map((d) => `**${d.name}** at ${d.time}`)
        .join(", ");
      const moreCount =
        pendingDosesList.length > 3
          ? ` and ${pendingDosesList.length - 3} more`
          : "";
      medicationInfo = `\n\n💊 **Pending doses today:** ${pendingList}${moreCount}`;
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

export function ChatInterface({
  targetPatient,
  onMedicationsUpdated,
}: ChatInterfaceProps = {}) {
  const {
    addMedication,
    medications,
    userName,
    user,
    userRole,
    linkedPatients,
  } = useApp();
  const navigate = useNavigate();
  const { hasFeature, isFree } = useSubscription();

  // Determine if we're in companion mode (adding meds for a patient)
  const isCompanionMode = !!targetPatient;

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
  const [loadingMessageId, setLoadingMessageId] = useState<string | null>(null);

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

  // Build linked patients context for companions
  const linkedPatientsContext: LinkedPatientContext[] | undefined =
    userRole === "companion" && linkedPatients && linkedPatients.length > 0
      ? linkedPatients
          .filter((p) => p.linkStatus === "accepted")
          .map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            adherenceRate: p.adherenceRate,
            medications: p.medications.map((med) => ({
              name: med.name,
              dosage: med.dosage,
              time: med.time,
              taken: med.taken,
              instructions: med.instructions,
              frequency: med.frequency,
              // Include dose-level taken status for multi-dose medications
              doses: med.doses?.map((dose) => ({
                time: dose.time,
                label: dose.label,
                taken: dose.taken,
                takenAt: dose.takenAt,
              })),
            })),
          }))
      : undefined;

  // Build user context for AI calls (includes language and patient info for companions)
  const userContext: UserContext = {
    userName: userName || undefined,
    language,
    userRole: userRole as "patient" | "companion" | undefined,
    medications: medications.map((med) => ({
      name: med.name,
      dosage: med.dosage,
      time: med.time,
      taken: med.taken,
      instructions: med.instructions,
      frequency: med.frequency,
      // Include dose-level taken status for multi-dose medications
      doses: med.doses?.map((dose) => ({
        time: dose.time,
        label: dose.label,
        taken: dose.taken,
        takenAt: dose.takenAt,
      })),
    })),
    linkedPatients: linkedPatientsContext,
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
    buildInitialMessage(
      userName,
      isCompanionMode ? undefined : medications,
      targetPatient,
      linkedPatients,
      userRole
    ),
  ]);

  // Update initial message when medications or username changes (only if no other messages exist)
  useEffect(() => {
    setMessages((prev) => {
      // Only update if we only have the initial message
      if (prev.length === 1 && prev[0].id === "1") {
        return [
          buildInitialMessage(
            userName,
            isCompanionMode ? undefined : medications,
            targetPatient,
            linkedPatients,
            userRole
          ),
        ];
      }
      return prev;
    });
  }, [
    userName,
    medications,
    isCompanionMode,
    targetPatient,
    linkedPatients,
    userRole,
  ]);
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
            // Pass user's selected language so Whisper transcribes in the correct language
            const transcribedText = await transcribeAudio(audioBlob, {
              language,
            });
            if (transcribedText) {
              // Send instantly without waiting for user confirmation
              await sendMessage(transcribedText);
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

  const addSelectedMedicines = async () => {
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

    // Check for duplicates
    const existingMedNames =
      isCompanionMode && targetPatient
        ? (targetPatient.medications || []).map((m) => m.name)
        : medications.map((m) => m.name);

    const uniqueMedicines: typeof selected = [];
    const duplicates: string[] = [];

    for (const medicine of selected) {
      const { isDuplicate, matchedName } = isMedicineDuplicate(
        medicine.name,
        existingMedNames
      );
      if (isDuplicate) {
        duplicates.push(matchedName || medicine.name);
      } else {
        uniqueMedicines.push(medicine);
        existingMedNames.push(medicine.name); // Prevent duplicates within selection
      }
    }

    if (duplicates.length > 0 && uniqueMedicines.length === 0) {
      toast({
        title: "Already in the list",
        description:
          duplicates.length === 1
            ? `${duplicates[0]} is already added`
            : "These medicines are already added",
        variant: "destructive",
      });
      return;
    }

    // Companion mode - add medicines for the patient
    if (isCompanionMode && targetPatient && user?.id) {
      let successCount = 0;
      let errorCount = 0;
      const defaultTime = getCurrentTime12h();

      for (const medicine of uniqueMedicines) {
        try {
          const medicineTime =
            medicine.time && medicine.time.trim() !== ""
              ? medicine.time
              : defaultTime;
          const { error } = await addMedicationForPatient(
            targetPatient.id,
            user.id,
            {
              name: medicine.name,
              dosage: medicine.dosage,
              time: medicineTime,
              instructions: medicine.instructions,
              category: "medicine",
              frequency: mapFrequency(medicine.frequency),
              timePeriod: "ongoing",
              startTime: medicineTime,
              nextDayMode: "restart",
              isActive: true,
            }
          );

          if (error) {
            console.error(`Failed to add ${medicine.name}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to add ${medicine.name}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        const dupeMsg =
          duplicates.length > 0
            ? ` (${duplicates.length} already in list)`
            : "";
        toast({
          title: `${successCount} medicine${
            successCount > 1 ? "s" : ""
          } added for ${targetPatient.name}!${dupeMsg}`,
          description: uniqueMedicines
            .slice(0, successCount)
            .map((m) => m.name)
            .join(", "),
        });
        // Notify parent to refresh medications
        onMedicationsUpdated?.();
      }

      if (errorCount > 0) {
        toast({
          title: `${errorCount} medicine${
            errorCount > 1 ? "s" : ""
          } failed to add`,
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // Patient mode - add medicines for self
      const defaultTime = getCurrentTime12h();
      uniqueMedicines.forEach((medicine) => {
        const medicineTime =
          medicine.time && medicine.time.trim() !== ""
            ? medicine.time
            : defaultTime;
        addMedication({
          name: medicine.name,
          dosage: medicine.dosage,
          time: medicineTime,
          instructions: medicine.instructions,
          category: "medicine",
          frequency: mapFrequency(medicine.frequency),
          timePeriod: "ongoing",
          startTime: medicineTime,
          nextDayMode: "restart",
          isActive: true,
        });
      });

      const dupeMsg =
        duplicates.length > 0 ? ` (${duplicates.length} already in list)` : "";
      toast({
        title: `${uniqueMedicines.length} medicine${
          uniqueMedicines.length > 1 ? "s" : ""
        } added!${dupeMsg}`,
        description: uniqueMedicines.map((m) => m.name).join(", "),
      });
    }

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

    // If already loading this message, ignore
    if (loadingMessageId === messageId) {
      return;
    }

    // Stop any current speech
    stopAllSpeech();
    setSpeakingMessageId(null);
    setLoadingMessageId(messageId); // Show loading state

    try {
      await speakWithFallback(text, language, {
        engine: ttsEngine,
        speed: 0.95,
        voice: "shimmer", // Warmest female voice for OpenAI
        onStart: () => {
          // Audio is ready and starting to play
          setLoadingMessageId(null);
          setSpeakingMessageId(messageId);
        },
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
      setLoadingMessageId(null);
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
      {/* Hidden file input for attachments (images + PDFs) */}
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

      {/* Companion Mode Banner */}
      {isCompanionMode && targetPatient && (
        <div className="px-4 py-3 bg-gradient-to-r from-teal-500/20 to-teal-600/10 border-b border-teal-300/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <p className="font-semibold text-teal-800">
                Managing {targetPatient.name}'s Medications
              </p>
              <p className="text-xs text-teal-600">
                Medicines added here will appear in their schedule
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Language & TTS Settings Header - Compact */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
        {/* Language Selector */}
        <div className="flex items-center gap-1.5">
          <Languages className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select
            value={language}
            onValueChange={(val) =>
              handleLanguageChange(val as SupportedLanguage)
            }
          >
            <SelectTrigger className="w-[130px] sm:w-[150px] h-8 text-sm">
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

        {/* TTS Engine Toggle - More compact */}
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => handleTTSEngineChange("browser")}
              className={`px-2 sm:px-3 py-1 text-xs font-medium transition-colors ${
                ttsEngine === "browser"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="Fast browser voice"
            >
              ⚡ <span className="hidden sm:inline">Fast</span>
            </button>
            <button
              onClick={() => handleTTSEngineChange("openai")}
              className={`px-2 sm:px-3 py-1 text-xs font-medium transition-colors ${
                ttsEngine === "openai"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="High-quality AI voice"
            >
              🎵 <span className="hidden sm:inline">Quality</span>
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
                    disabled={
                      loadingMessageId !== null ||
                      (speakingMessageId !== null &&
                        speakingMessageId !== message.id)
                    }
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    title={
                      loadingMessageId === message.id
                        ? "Loading audio..."
                        : speakingMessageId === message.id
                        ? "Stop speaking"
                        : "Listen to message"
                    }
                  >
                    {loadingMessageId === message.id ? (
                      <>
                        <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading...</span>
                      </>
                    ) : speakingMessageId === message.id ? (
                      <>
                        <VolumeX className="w-4 h-4 mr-1" />
                        <span className="text-xs">Stop</span>
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
                Add {detectedMedicines.filter((m) => m.selected).length}
                {isCompanionMode && targetPatient
                  ? ` for ${targetPatient.name.split(" ")[0]}`
                  : " to List"}
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

      {/* Voice recording indicator - Inline */}
      {isRecording && (
        <div className="px-3 py-1.5 border-t border-destructive/30 bg-destructive/5">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-destructive text-sm font-medium">
              {formatDuration(recordingDuration)} - Tap mic to stop
            </span>
          </div>
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

      {/* Input bar - Single compact row */}
      <div className="px-2 py-2 border-t border-border bg-background">
        <div className="flex items-center gap-1">
          {/* Camera button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!canUsePrescriptionScan) {
                  toast({
                    title: "Pro Feature",
                    description: "Prescription scanning requires Pro.",
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
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Camera className="w-5 h-5" />
            </Button>
            {!canUsePrescriptionScan && <LockedBadge />}
          </div>

          {/* Attachment button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => documentInputRef.current?.click()}
            disabled={isTyping || isRecording}
            className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          {/* Voice button */}
          <div className="relative">
            <Button
              variant={isRecording ? "destructive" : "ghost"}
              size="icon"
              onClick={() => {
                if (!canUseVoiceAssistance) {
                  toast({
                    title: "Pro Feature",
                    description: "Voice assistance requires Pro.",
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
              className={`h-10 w-10 rounded-full ${
                isRecording ? "" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
            {!canUseVoiceAssistance && <LockedBadge />}
          </div>

          {/* Text input */}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              medicineInputs.length > 0 ? "Add details..." : "Ask me..."
            }
            className="flex-1 h-10 text-base px-3 rounded-full min-w-0"
            onKeyDown={handleKeyDown}
            disabled={isTyping || isRecording}
          />

          {/* Send button */}
          <Button
            variant="coral"
            size="icon"
            onClick={handleSend}
            disabled={
              (!input.trim() && medicineInputs.length === 0) ||
              isTyping ||
              isRecording
            }
            className="h-10 w-10 rounded-full shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
