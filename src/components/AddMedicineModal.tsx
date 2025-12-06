import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Camera,
  Mic,
  Keyboard,
  Check,
  Plus,
  Trash2,
  Edit2,
  Pill,
  Upload,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertOctagon,
  Info,
  Stethoscope,
  Loader2,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";
import {
  transcribeAudio,
  extractMultipleMedicinesFromText,
  extractMultipleMedicinesFromImages,
  ExtractedMedicine,
  fileToDataUrl,
} from "@/services/openai";
import { searchDrugs, type Drug } from "@/services/drugDatabase";
import {
  checkDrugInteractions,
  type DetectedInteraction,
} from "@/modules/medication/services/interactionService";
import { createMedicationSchedule, generateId as generateScheduleId } from "@/modules/medication/services/scheduleService";
import { TIME_PERIOD_OPTIONS, calculateEndDate, getTodayDateString } from "@/modules/medication/constants";
import type { EnhancedMedication } from "@/modules/medication/types";
import type { MedicationCategory, FrequencyType, NextDayMode } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, FREQUENCY_LABELS } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "scan" | "talk" | "type";

interface MedicineQueueItem extends ExtractedMedicine {
  id: string;
  source: "scan" | "voice" | "manual";
  category: MedicationCategory;
  frequency: FrequencyType;
  timePeriod: string;
  imageUrl?: string;
}

interface MedicineInteraction {
  medicineName: string;
  interactions: DetectedInteraction[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Get current time in 12-hour format (e.g., "10:30 AM")
const getCurrentTime12h = (): string => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  
  // Convert to 12-hour format
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  
  // Round minutes to nearest 5
  const roundedMinutes = Math.round(minutes / 5) * 5;
  const finalMinutes = roundedMinutes >= 60 ? 0 : roundedMinutes;
  
  return `${hours}:${finalMinutes.toString().padStart(2, "0")} ${period}`;
};

// Normalize medicine name for comparison (case-insensitive, trimmed)
const normalizeMedicineName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

// Check if a medicine name is a duplicate (fuzzy match)
const isMedicineDuplicate = (
  name: string,
  existingNames: string[],
  threshold: number = 0.85
): { isDuplicate: boolean; matchedName?: string } => {
  const normalizedName = normalizeMedicineName(name);
  
  for (const existing of existingNames) {
    const normalizedExisting = normalizeMedicineName(existing);
    
    // Exact match
    if (normalizedName === normalizedExisting) {
      return { isDuplicate: true, matchedName: existing };
    }
    
    // Check if one contains the other (handles brand vs generic name scenarios)
    if (normalizedName.includes(normalizedExisting) || normalizedExisting.includes(normalizedName)) {
      return { isDuplicate: true, matchedName: existing };
    }
    
    // Simple similarity check - if first few characters match significantly
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

const DEFAULT_CATEGORIES: MedicationCategory[] = [
  "medicine",
  "vitamin",
  "supplement",
  "herbal",
  "other",
];
const DEFAULT_FREQUENCIES: FrequencyType[] = [
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "four_times_daily",
  "as_needed",
];

// Time presets for quick selection
const TIME_PRESETS = [
  { label: "Morning", time: "8:00 AM", icon: "🌅" },
  { label: "Noon", time: "12:00 PM", icon: "☀️" },
  { label: "Afternoon", time: "3:00 PM", icon: "🌤️" },
  { label: "Evening", time: "6:00 PM", icon: "🌆" },
  { label: "Bedtime", time: "9:00 PM", icon: "🌙" },
];

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function AddMedicineModal({ isOpen, onClose }: Props) {
  const { addEnhancedMedication, medications: currentMedications } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [medicineQueue, setMedicineQueue] = useState<MedicineQueueItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    time: "",
    instructions: "",
    category: "medicine" as MedicationCategory,
    frequency: "once_daily" as FrequencyType,
    timePeriod: "ongoing",
    imageUrl: "",
  });

  // Dropdown states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [photoMenuOpenId, setPhotoMenuOpenId] = useState<string | null>(null);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);

  // Time picker state
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("AM");

  // Drug interaction states
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);
  const [showInteractionWarning, setShowInteractionWarning] = useState(false);
  const [detectedInteractions, setDetectedInteractions] = useState<
    MedicineInteraction[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  // Drug autocomplete
  const [drugSuggestions, setDrugSuggestions] = useState<Drug[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for camera, audio, and file upload
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const medicinePhotoRef = useRef<HTMLInputElement>(null);
  const queuePhotoRef = useRef<HTMLInputElement>(null);

  // ============ QUEUE ITEM PHOTO FUNCTIONS ============
  const handleQueuePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !photoTargetId) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setMedicineQueue((prev) =>
        prev.map((item) =>
          item.id === photoTargetId ? { ...item, imageUrl: dataUrl } : item
        )
      );
      toast({
        title: "Photo added",
        description: "Medicine photo saved for reference.",
      });
    } catch (error) {
      console.error("Failed to process photo:", error);
    }
    event.target.value = "";
    setPhotoTargetId(null);
    setPhotoMenuOpenId(null);
  };

  const openQueueItemCamera = async (itemId: string) => {
    setPhotoTargetId(itemId);
    setPhotoMenuOpenId(null);
    // Start camera for fullscreen overlay
    await startCamera();
  };

  const openQueueItemUpload = (itemId: string) => {
    setPhotoTargetId(itemId);
    setPhotoMenuOpenId(null);
    queuePhotoRef.current?.click();
  };

  // ============ CAMERA FUNCTIONS ============
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      // Set camera open FIRST so the video element renders
      setIsCameraOpen(true);
    } catch (error) {
      console.error("Camera error:", error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [stopCamera]);

  // Effect to connect stream to video element once it's mounted
  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.error("Video play error:", err);
      });
    }
  }, [isCameraOpen]);

  // ============ VOICE FUNCTIONS ============
  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  // Recording timer
  useEffect(() => {
    if (isListening) {
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
  }, [isListening]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopRecording();
      setCapturedImages([]);
      setMedicineQueue([]);
      setFormData({
        name: "",
        dosage: "",
        time: "",
        instructions: "",
        category: "medicine",
        frequency: "once_daily",
        timePeriod: "ongoing",
        imageUrl: "",
      });
      setEditingId(null);
      // Reset interaction states
      setShowInteractionWarning(false);
      setDetectedInteractions([]);
      setIsCheckingInteractions(false);
    }
  }, [isOpen, stopCamera, stopRecording]);

  // Search drug database with debounce
  const handleDrugSearch = useCallback((query: string) => {
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    if (query.length < 2) {
      setDrugSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    suggestionTimeoutRef.current = setTimeout(async () => {
      const results = await searchDrugs(query, 5);
      setDrugSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
  }, []);

  // Handle selecting a drug from suggestions
  const handleSelectDrug = useCallback((drug: Drug) => {
    // Determine category based on drug info
    let category: MedicationCategory = "medicine";
    const lowerName = (drug.genericName || "").toLowerCase();
    const lowerCategory = (drug.category || "").toLowerCase();

    if (lowerCategory.includes("vitamin") || lowerName.includes("vitamin")) {
      category = "vitamin";
    } else if (
      lowerCategory.includes("supplement") ||
      lowerName.includes("supplement")
    ) {
      category = "supplement";
    } else if (
      lowerCategory.includes("herbal") ||
      lowerName.includes("herbal")
    ) {
      category = "herbal";
    }

    setFormData((prev) => ({
      ...prev,
      name: drug.brandName || drug.genericName,
      dosage: drug.strength || prev.dosage,
      category,
    }));
    setShowSuggestions(false);
    setDrugSuggestions([]);
  }, []);

  // Handle medicine photo upload
  const handleMedicinePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
      toast({
        title: "Photo added",
        description: "Medicine photo saved for reference.",
      });
    } catch (error) {
      console.error("Failed to process photo:", error);
    }
    event.target.value = "";
  };

  if (!isOpen) return null;

  const tabs = [
    { id: "scan" as Tab, label: "Scan", icon: Camera },
    { id: "talk" as Tab, label: "Talk", icon: Mic },
    { id: "type" as Tab, label: "Type", icon: Keyboard },
  ];

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);

    // If capturing for a queue item, update that item
    if (photoTargetId) {
      setMedicineQueue((prev) =>
        prev.map((item) =>
          item.id === photoTargetId ? { ...item, imageUrl: imageDataUrl } : item
        )
      );
      toast({
        title: "Photo captured",
        description: "Medicine photo saved for reference.",
      });
      setPhotoTargetId(null);
      stopCamera();
    } else {
      // Auto-analyze immediately after capture
      void analyzeImagesInstantly([imageDataUrl]);
      stopCamera();
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle file upload (images) - auto-analyze immediately
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxSize = 20 * 1024 * 1024; // 20MB limit
    const supportedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    const validImages: string[] = [];

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
            description: `${file.name} is not supported. Use JPG, PNG, GIF, or WebP images.`,
            variant: "destructive",
          });
          continue;
        }

        const dataUrl = await fileToDataUrl(file);
        validImages.push(dataUrl);
      }

      // Auto-analyze immediately after upload
      if (validImages.length > 0) {
        void analyzeImagesInstantly(validImages);
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

  // Analyze images instantly (called automatically after capture/upload)
  const analyzeImagesInstantly = async (images: string[]) => {
    if (images.length === 0) return;

    setIsProcessing(true);
    toast({
      title: "Analyzing...",
      description: `Processing ${images.length} image${images.length > 1 ? "s" : ""}`,
    });

    try {
      const medicines = await extractMultipleMedicinesFromImages(images);

      if (medicines.length > 0) {
        // Get existing names from queue and current medications
        const existingQueueNames = medicineQueue.map((m) => m.name);
        const existingMedNames = currentMedications.map((m) => m.name);
        const allExistingNames = [...existingQueueNames, ...existingMedNames];
        
        const newItems: MedicineQueueItem[] = [];
        const duplicates: string[] = [];
        const addedNames: string[] = [];
        
        // Default time is current time (not 8:00 AM)
        const defaultTime = getCurrentTime12h();
        
        for (const m of medicines.filter((m) => m.name)) {
          // Check against all existing + already added in this batch
          const allNames = [...allExistingNames, ...addedNames];
          const { isDuplicate, matchedName } = isMedicineDuplicate(m.name, allNames);
          
          if (isDuplicate) {
            duplicates.push(`${m.name} (matches "${matchedName}")`);
          } else {
            // Map extracted frequency to our FrequencyType, default to once_daily
            const extractedFreq = (m as { frequency?: string }).frequency;
            const frequencyMap: Record<string, FrequencyType> = {
              once_daily: "once_daily",
              twice_daily: "twice_daily",
              three_times_daily: "three_times_daily",
              four_times_daily: "four_times_daily",
              as_needed: "as_needed",
            };
            const frequency = frequencyMap[extractedFreq || ""] || "once_daily";
            
            // Use extracted time if present, otherwise default to current time
            const medicineTime = m.time && m.time.trim() !== "" ? m.time : defaultTime;
            
            newItems.push({
              ...m,
              id: generateId(),
              source: "scan" as const,
              category: "medicine" as MedicationCategory,
              frequency,
              time: medicineTime,
              timePeriod: "ongoing",
              imageUrl: images[Math.min(newItems.length, images.length - 1)],
            });
            addedNames.push(m.name);
          }
        }

        if (newItems.length > 0) {
          setMedicineQueue((prev) => [...prev, ...newItems]);
        }
        setCapturedImages([]);

        // Show appropriate toast based on results
        if (newItems.length > 0 && duplicates.length > 0) {
          toast({
            title: `Added ${newItems.length} medicine${newItems.length > 1 ? "s" : ""}`,
            description: `${duplicates.length} already in your list`,
          });
        } else if (newItems.length > 0) {
          toast({
            title: `Found ${newItems.length} medicine${newItems.length > 1 ? "s" : ""}!`,
            description: newItems.map((m) => m.name).join(", "),
          });
        } else if (duplicates.length > 0) {
          toast({
            title: "Already in your list",
            description: "This medicine is already added",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Could not read labels",
          description: "Try taking clearer photos or add manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast({
        title: "Scan failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Legacy handler for manual analyze button (kept for backwards compatibility)
  const handleAnalyzeImages = async () => {
    if (capturedImages.length === 0) return;
    await analyzeImagesInstantly(capturedImages);
  };

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
          setIsProcessing(true);
          try {
            const transcribedText = await transcribeAudio(audioBlob);

            if (transcribedText) {
              const medicines = await extractMultipleMedicinesFromText(
                transcribedText
              );

              if (medicines.length > 0) {
                // Get existing names from queue and current medications
                // Use functional update to get latest queue state
                let existingQueueNames: string[] = [];
                setMedicineQueue((prev) => {
                  existingQueueNames = prev.map((m) => m.name);
                  return prev;
                });
                const existingMedNames = currentMedications.map((m) => m.name);
                const allExistingNames = [...existingQueueNames, ...existingMedNames];
                
                // Default time is current time
                const defaultTime = getCurrentTime12h();
                
                const newItems: MedicineQueueItem[] = [];
                const duplicates: string[] = [];
                const addedNames: string[] = [];
                
                for (const m of medicines.filter((m) => m.name)) {
                  // Check against all existing + already added in this batch
                  const allNames = [...allExistingNames, ...addedNames];
                  const { isDuplicate, matchedName } = isMedicineDuplicate(m.name, allNames);
                  
                  if (isDuplicate) {
                    duplicates.push(`${m.name} (matches "${matchedName}")`);
                  } else {
                    // Map extracted frequency to our FrequencyType, default to once_daily
                    const extractedFreq = (m as { frequency?: string }).frequency;
                    const frequencyMap: Record<string, FrequencyType> = {
                      once_daily: "once_daily",
                      twice_daily: "twice_daily",
                      three_times_daily: "three_times_daily",
                      four_times_daily: "four_times_daily",
                      as_needed: "as_needed",
                    };
                    const frequency = frequencyMap[extractedFreq || ""] || "once_daily";
                    
                    // Use extracted time if present, otherwise default to current time
                    const medicineTime = m.time && m.time.trim() !== "" ? m.time : defaultTime;
                    
                    newItems.push({
                      ...m,
                      id: generateId(),
                      source: "voice" as const,
                      category: "medicine" as MedicationCategory,
                      frequency,
                      time: medicineTime,
                      timePeriod: "ongoing",
                    });
                    addedNames.push(m.name);
                  }
                }

                if (newItems.length > 0) {
                  setMedicineQueue((prev) => [...prev, ...newItems]);
                }

                // Show appropriate toast based on results
                if (newItems.length > 0 && duplicates.length > 0) {
                  toast({
                    title: `Added ${newItems.length} medicine${newItems.length > 1 ? "s" : ""}`,
                    description: `${duplicates.length} already in your list`,
                  });
                } else if (newItems.length > 0) {
                  toast({
                    title: `Found ${newItems.length} medicine${newItems.length > 1 ? "s" : ""}!`,
                    description: newItems.map((m) => m.name).join(", "),
                  });
                } else if (duplicates.length > 0) {
                  toast({
                    title: "Already in your list",
                    description: "This medicine is already added",
                    variant: "destructive",
                  });
                }
              } else {
                toast({
                  title: "Could not extract details",
                  description: `Heard: "${transcribedText}". Try again or add manually.`,
                });
              }
            }
          } catch (error) {
            console.error("Voice processing error:", error);
            toast({
              title: "Voice processing failed",
              description:
                error instanceof Error ? error.message : "Please try again.",
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error("Microphone error:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const handleVoiceInput = () => {
    if (isListening) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format time from picker state
  const formatTimeFromPicker = (
    hour: number,
    minute: number,
    period: "AM" | "PM"
  ) => {
    return `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  // Parse time string to picker state
  const parseTimeToPickerState = (timeStr: string) => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const period = match[3].toUpperCase() as "AM" | "PM";
      // Normalize hour for display (1-12)
      if (hour === 0) hour = 12;
      if (hour > 12) hour = hour - 12;
      // Round minute to nearest 5
      const roundedMinute = Math.round(minute / 5) * 5;
      return { hour, minute: roundedMinute >= 60 ? 55 : roundedMinute, period };
    }
    return { hour: 8, minute: 0, period: "AM" as const };
  };

  // Apply custom time from picker
  const applyCustomTime = () => {
    const timeStr = formatTimeFromPicker(
      selectedHour,
      selectedMinute,
      selectedPeriod
    );
    setFormData((prev) => ({ ...prev, time: timeStr }));
    setShowTimePicker(false);
  };

  // Open time picker with current value or closest current time
  const openTimePicker = () => {
    if (formData.time) {
      const { hour, minute, period } = parseTimeToPickerState(formData.time);
      setSelectedHour(hour);
      setSelectedMinute(minute);
      setSelectedPeriod(period);
    } else {
      // Pre-fill with next available time slot
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Round minutes UP to next 5-minute slot
      const roundedMinutes = Math.ceil(minutes / 5) * 5;
      
      // Handle minute overflow (e.g., 58 rounds to 60)
      let finalMinutes = roundedMinutes;
      if (roundedMinutes >= 60) {
        finalMinutes = 0;
        hours += 1;
      }
      
      // Handle hour overflow
      if (hours >= 24) hours = 0;
      
      // Convert to 12-hour format
      const period: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
      let hour12 = hours % 12;
      if (hour12 === 0) hour12 = 12;
      
      setSelectedHour(hour12);
      setSelectedMinute(finalMinutes);
      setSelectedPeriod(period);
    }
    setShowTimePicker(true);
  };

  // Queue management
  const addManualMedicine = () => {
    if (!formData.name) {
      toast({
        title: "Missing name",
        description: "Please enter a medicine name.",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      // When editing, check if the new name conflicts with OTHER items (not itself)
      const otherQueueNames = medicineQueue
        .filter((m) => m.id !== editingId)
        .map((m) => m.name);
      const existingMedNames = currentMedications.map((m) => m.name);
      const allExistingNames = [...otherQueueNames, ...existingMedNames];
      
      const { isDuplicate, matchedName } = isMedicineDuplicate(formData.name, allExistingNames);
      
      if (isDuplicate) {
        toast({
          title: "Already in your list",
          description: `${matchedName} is already added`,
          variant: "destructive",
        });
        return;
      }
      
      setMedicineQueue((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                name: formData.name,
                dosage: formData.dosage,
                time: formData.time,
                instructions: formData.instructions,
                category: formData.category,
                frequency: formData.frequency,
                timePeriod: formData.timePeriod,
                imageUrl: formData.imageUrl,
              }
            : item
        )
      );
      setEditingId(null);
    } else {
      // Check for duplicates when adding new
      const existingQueueNames = medicineQueue.map((m) => m.name);
      const existingMedNames = currentMedications.map((m) => m.name);
      const allExistingNames = [...existingQueueNames, ...existingMedNames];
      
      const { isDuplicate, matchedName } = isMedicineDuplicate(formData.name, allExistingNames);
      
      if (isDuplicate) {
        toast({
          title: "Already in your list",
          description: `${matchedName} is already added`,
          variant: "destructive",
        });
        return;
      }
      
      const newItem: MedicineQueueItem = {
        id: generateId(),
        source: "manual",
        name: formData.name,
        dosage: formData.dosage,
        time: formData.time,
        instructions: formData.instructions,
        category: formData.category,
        frequency: formData.frequency,
        timePeriod: formData.timePeriod,
        imageUrl: formData.imageUrl,
      };
      setMedicineQueue((prev) => [...prev, newItem]);
    }

    setFormData({
      name: "",
      dosage: "",
      time: "",
      instructions: "",
      category: "medicine",
      frequency: "once_daily",
      timePeriod: "ongoing",
      imageUrl: "",
    });
    toast({
      title: editingId ? "Medicine updated!" : "Medicine added to list!",
      description: formData.name,
    });
  };

  const editMedicine = (item: MedicineQueueItem) => {
    setFormData({
      name: item.name,
      dosage: item.dosage,
      time: item.time,
      instructions: item.instructions,
      category: item.category,
      frequency: item.frequency,
      timePeriod: item.timePeriod || "ongoing",
      imageUrl: item.imageUrl || "",
    });
    setEditingId(item.id);
    setActiveTab("type");
  };

  const removeMedicine = (id: string) => {
    setMedicineQueue((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setFormData({
        name: "",
        dosage: "",
        time: "",
        instructions: "",
        category: "medicine",
        frequency: "once_daily",
        timePeriod: "ongoing",
        imageUrl: "",
      });
    }
  };

  // Update queue item fields
  const updateQueueItem = (
    id: string,
    field: keyof MedicineQueueItem,
    value: string
  ) => {
    setMedicineQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Check for drug interactions before saving
  const checkAllInteractions = async () => {
    setIsCheckingInteractions(true);
    const allInteractions: MedicineInteraction[] = [];

    try {
      for (const medicine of medicineQueue) {
        const result = await checkDrugInteractions(
          medicine.name,
          currentMedications
        );
        if (result.hasInteractions) {
          allInteractions.push({
            medicineName: medicine.name,
            interactions: result.interactions,
          });
        }
      }

      setDetectedInteractions(allInteractions);
      return allInteractions;
    } finally {
      setIsCheckingInteractions(false);
    }
  };

  // Convert 12-hour time (e.g., "8:00 AM") to 24-hour format (e.g., "08:00")
  const convertTo24Hour = (time12h: string): string => {
    const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return "08:00"; // default fallback
    
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    
    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  };

  // Actually save the medicines (after interaction check or user confirmation)
  const doSaveMedicines = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
    for (const medicine of medicineQueue) {
      // Convert time to 24-hour format for schedule calculation
      const startTime24h = convertTo24Hour(medicine.time);
      
      // Calculate start and end dates for prescription duration
      const startDate = getTodayDateString();
      const endDate = calculateEndDate(startDate, medicine.timePeriod);
      
      // Create the schedule with computed doses based on frequency
      const schedule = createMedicationSchedule({
        name: medicine.name,
        dosage: medicine.dosage,
        category: medicine.category,
        frequency: medicine.frequency,
        timePeriod: medicine.timePeriod,
        startDate,
        endDate: endDate ?? undefined,
        instructions: medicine.instructions || "",
        startTime: startTime24h,
        nextDayMode: "restart" as NextDayMode,
      });

      // Create enhanced medication with full schedule
      const enhancedMed: EnhancedMedication = {
        id: generateScheduleId(),
        userId: "", // Will be set by context
        name: medicine.name,
        dosage: medicine.dosage,
        category: medicine.category,
        frequency: medicine.frequency,
        timePeriod: medicine.timePeriod,
        startDate,
        endDate: endDate ?? undefined,
        instructions: medicine.instructions,
        imageUrl: medicine.imageUrl,
        schedule: {
          ...schedule,
          medicationId: generateScheduleId(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addEnhancedMedication(enhancedMed);
    }

    toast({
      title: `${medicineQueue.length} medicine${
        medicineQueue.length > 1 ? "s" : ""
      } saved!`,
      description: medicineQueue.map((m) => m.name).join(", "),
    });

    setShowInteractionWarning(false);
    setDetectedInteractions([]);
    onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // Save all medicines (with interaction check)
  const handleSaveAll = async () => {
    if (medicineQueue.length === 0) {
      toast({
        title: "No medicines to save",
        description: "Add at least one medicine first.",
        variant: "destructive",
      });
      return;
    }

    const incomplete = medicineQueue.filter(
      (m) => !m.name || !m.dosage || !m.time
    );
    if (incomplete.length > 0) {
      toast({
        title: "Incomplete entries",
        description: `Please fill in all required fields for: ${incomplete
          .map((m) => m.name || "Unnamed")
          .join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Final duplicate check against current medications (in case they were updated)
    const existingMedNames = currentMedications.map((m) => m.name);
    const duplicatesInSave: string[] = [];
    const validMedicines: MedicineQueueItem[] = [];
    
    for (const medicine of medicineQueue) {
      const { isDuplicate, matchedName } = isMedicineDuplicate(medicine.name, existingMedNames);
      if (isDuplicate) {
        duplicatesInSave.push(`${medicine.name} (matches "${matchedName}")`);
      } else {
        validMedicines.push(medicine);
      }
    }
    
    if (duplicatesInSave.length > 0) {
      // Remove duplicates from queue
      setMedicineQueue(validMedicines);
      
      if (validMedicines.length === 0) {
        toast({
          title: "Already in your list",
          description: "These medicines are already added",
          variant: "destructive",
        });
        return;
      } else {
        toast({
          title: "Some already added",
          description: `Saving ${validMedicines.length} new medicine${validMedicines.length > 1 ? "s" : ""}`,
        });
      }
    }

    // Check for interactions (only for valid medicines)
    const interactions = await checkAllInteractions();

    if (interactions.length > 0) {
      // Show warning dialog
      setShowInteractionWarning(true);
    } else {
      // No interactions, save directly
      await doSaveMedicines();
    }
  };

  const getSourceIcon = (source: MedicineQueueItem["source"]) => {
    switch (source) {
      case "scan":
        return "📷";
      case "voice":
        return "🎤";
      case "manual":
        return "⌨️";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-background sticky top-0 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-senior-xl font-bold">Add Medicines</h2>
            {medicineQueue.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {medicineQueue.length} in queue
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Medicine Queue */}
          {medicineQueue.length > 0 && (
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-5 h-5 text-primary" />
                <span className="font-semibold">Medicines to save:</span>
              </div>
              {/* Hidden input for queue item photo upload */}
              <input
                ref={queuePhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleQueuePhotoUpload}
              />
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {medicineQueue.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl bg-background border ${
                      editingId === item.id ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Medicine photo thumbnail with add photo dropdown */}
                      {item.imageUrl ? (
                        <div className="relative shrink-0">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover border-2 border-green-300"
                          />
                          <button
                            onClick={() =>
                              setMedicineQueue((prev) =>
                                prev.map((m) =>
                                  m.id === item.id
                                    ? { ...m, imageUrl: undefined }
                                    : m
                                )
                              )
                            }
                            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center text-xs"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setPhotoMenuOpenId(
                              photoMenuOpenId === item.id ? null : item.id
                            )
                          }
                          className="w-12 h-12 shrink-0 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 flex flex-col items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors group"
                          title="Add photo"
                        >
                          <Camera className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                        </button>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {getSourceIcon(item.source)}
                          </span>
                          <p className="font-semibold truncate">
                            {item.name || "Unnamed"}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.dosage} • {item.time || "No time set"}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              CATEGORY_COLORS[item.category]
                            }`}
                          >
                            {CATEGORY_LABELS[item.category]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {FREQUENCY_LABELS[item.frequency]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {TIME_PERIOD_OPTIONS.find((opt) => opt.value === item.timePeriod)?.label || "Ongoing"}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => editMedicine(item)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMedicine(item.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex p-4 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "scan") stopCamera();
                  if (tab.id !== "talk") stopRecording();
                }}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <tab.icon className="w-6 h-6" />
                <span className="text-senior-sm font-semibold">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* ============ SCAN TAB ============ */}
            {activeTab === "scan" && (
              <div className="text-center">
                <canvas ref={canvasRef} className="hidden" />
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {/* Only show camera in scan tab if not taking a photo for a queue item */}
                {isCameraOpen && !photoTargetId ? (
                  <>
                    <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden mb-4">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-32 border-2 border-white/60 rounded-lg relative">
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                        </div>
                      </div>
                      {capturedImages.length > 0 && (
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded-full text-sm">
                          {capturedImages.length} captured
                        </div>
                      )}
                    </div>
                    <p className="text-senior-sm text-muted-foreground mb-4">
                      Capture multiple medicines, then analyze all at once
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        size="lg"
                        className="flex-1"
                        onClick={stopCamera}
                      >
                        Done
                      </Button>
                      <Button
                        variant="coral"
                        size="lg"
                        className="flex-1"
                        onClick={capturePhoto}
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        Capture
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Captured images preview */}
                    {capturedImages.length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm text-muted-foreground mb-2">
                          {capturedImages.length} image
                          {capturedImages.length > 1 ? "s" : ""} captured:
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mb-4">
                          {capturedImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={img}
                                alt={`Medicine ${idx + 1}`}
                                className="w-20 h-20 object-cover rounded-lg border border-border"
                              />
                              <button
                                onClick={() => removeImage(idx)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mb-3">
                          <Button
                            variant="secondary"
                            size="lg"
                            className="flex-1"
                            onClick={() => void startCamera()}
                          >
                            <Camera className="w-5 h-5 mr-2" />
                            Camera
                          </Button>
                          <Button
                            variant="secondary"
                            size="lg"
                            className="flex-1"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-5 h-5 mr-2" />
                            Upload
                          </Button>
                        </div>
                        <Button
                          variant="coral"
                          size="lg"
                          className="w-full"
                          onClick={handleAnalyzeImages}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Check className="w-5 h-5 mr-2" />
                              Analyze {capturedImages.length} Image
                              {capturedImages.length > 1 ? "s" : ""}
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {capturedImages.length === 0 && (
                      <>
                        <div className="w-32 h-32 mx-auto bg-muted rounded-3xl flex items-center justify-center mb-6">
                          <Camera className="w-16 h-16 text-muted-foreground" />
                        </div>
                        <p className="text-senior-base text-muted-foreground mb-4">
                          Take photos or upload images of medicine labels
                        </p>
                        <div className="flex gap-3">
                          <Button
                            variant="coral"
                            size="lg"
                            className="flex-1"
                            onClick={() => void startCamera()}
                          >
                            <Camera className="w-6 h-6 mr-2" />
                            Camera
                          </Button>
                          <Button
                            variant="secondary"
                            size="lg"
                            className="flex-1"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-6 h-6 mr-2" />
                            Upload
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ============ TALK TAB ============ */}
            {activeTab === "talk" && (
              <div className="text-center">
                <button
                  onClick={handleVoiceInput}
                  disabled={isProcessing}
                  className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 transition-all ${
                    isListening
                      ? "bg-destructive pulse-ring"
                      : isProcessing
                      ? "bg-muted"
                      : "bg-primary hover:brightness-110"
                  }`}
                >
                  {isProcessing ? (
                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Mic className="w-16 h-16 text-white" />
                  )}
                </button>

                {isListening ? (
                  <div className="mb-8">
                    <p className="text-senior-lg font-semibold text-destructive mb-2">
                      Recording... {formatDuration(recordingDuration)}
                    </p>
                    <p className="text-senior-sm text-muted-foreground mb-4">
                      Tap to stop
                    </p>
                    <div className="flex items-center justify-center gap-1">
                      {[...Array(7)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 bg-destructive rounded-full animate-pulse"
                          style={{
                            height: `${16 + Math.random() * 24}px`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : isProcessing ? (
                  <div className="mb-8">
                    <p className="text-senior-lg font-semibold text-primary mb-2">
                      Processing...
                    </p>
                    <p className="text-senior-sm text-muted-foreground">
                      Extracting medicine information
                    </p>
                  </div>
                ) : (
                  <div className="mb-8">
                    <p className="text-senior-base text-muted-foreground">
                      Say all your medicines at once, for example:
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      "Metformin 500mg after breakfast, Lisinopril 10mg at
                      night, and Aspirin 81mg in the morning"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ============ TYPE TAB ============ */}
            {activeTab === "type" && (
              <div className="space-y-4">
                {/* Hidden medicine photo input */}
                <input
                  ref={medicinePhotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleMedicinePhotoUpload}
                />

                {editingId && (
                  <div className="bg-primary/10 text-primary p-3 rounded-lg text-sm">
                    Editing medicine. Update the fields and tap "Update" to save
                    changes.
                  </div>
                )}

                {/* Medicine Name with autocomplete */}
                <div className="relative">
                  <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                    Medicine Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => ({ ...prev, name: value }));
                      handleDrugSearch(value);
                    }}
                    onFocus={() => {
                      if (drugSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Enter medicine name"
                    className="input-senior"
                    autoComplete="off"
                  />
                  {/* Drug Suggestions Dropdown */}
                  {showSuggestions && drugSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {drugSuggestions.map((drug, index) => (
                        <button
                          key={`${drug.regId}-${index}`}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                          onClick={() => handleSelectDrug(drug)}
                        >
                          <div className="font-semibold text-foreground">
                            {drug.brandName || drug.genericName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {drug.genericName !== drug.brandName &&
                              drug.genericName && (
                                <span>{drug.genericName} • </span>
                              )}
                            {drug.strength} {drug.form && `• ${drug.form}`}
                          </div>
                          {drug.category && (
                            <div className="text-xs text-primary mt-1">
                              {drug.category}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category and Frequency Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Category Dropdown */}
                  <div className="relative">
                    <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryDropdown(!showCategoryDropdown);
                        setShowFrequencyDropdown(false);
                      }}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
                    >
                      <span
                        className={`text-sm px-2 py-0.5 rounded-full border ${
                          CATEGORY_COLORS[formData.category]
                        }`}
                      >
                        {CATEGORY_LABELS[formData.category]}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {showCategoryDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                        {DEFAULT_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                category: cat,
                              }));
                              setShowCategoryDropdown(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-2 ${
                              formData.category === cat ? "bg-muted" : ""
                            }`}
                          >
                            <span
                              className={`text-sm px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}
                            >
                              {CATEGORY_LABELS[cat]}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Frequency Dropdown */}
                  <div className="relative">
                    <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                      Frequency *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFrequencyDropdown(!showFrequencyDropdown);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
                    >
                      <span className="text-sm truncate">
                        {FREQUENCY_LABELS[formData.frequency]}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                    {showFrequencyDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                        {DEFAULT_FREQUENCIES.map((freq) => (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                frequency: freq,
                              }));
                              setShowFrequencyDropdown(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                              formData.frequency === freq ? "bg-muted" : ""
                            }`}
                          >
                            {FREQUENCY_LABELS[freq]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration Dropdown */}
                <div className="relative">
                  <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                    Duration (How long to take) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDurationDropdown(!showDurationDropdown);
                      setShowCategoryDropdown(false);
                      setShowFrequencyDropdown(false);
                    }}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
                  >
                    <span className="text-sm">
                      {TIME_PERIOD_OPTIONS.find((opt) => opt.value === formData.timePeriod)?.label || "Select duration"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                  {showDurationDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {TIME_PERIOD_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              timePeriod: opt.value,
                            }));
                            setShowDurationDropdown(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                            formData.timePeriod === opt.value ? "bg-muted" : ""
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dosage and Time Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                      Dosage *
                    </label>
                    <Input
                      value={formData.dosage}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dosage: e.target.value,
                        }))
                      }
                      placeholder="e.g., 10mg"
                      className="input-senior"
                    />
                  </div>
                  <div className="relative">
                    <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                      Start Time *
                    </label>
                    <button
                      type="button"
                      onClick={openTimePicker}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span
                          className={
                            formData.time
                              ? "font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {formData.time || "Select time"}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                    Instructions (optional)
                  </label>
                  <Input
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        instructions: e.target.value,
                      }))
                    }
                    placeholder="e.g., Take after meals"
                    className="input-senior"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={addManualMedicine}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {editingId ? "Update Medicine" : "Add to List"}
                </Button>
              </div>
            )}

            {/* Save All Button */}
            {medicineQueue.length > 0 && (
              <Button
                variant="coral"
                size="lg"
                className="w-full mt-6"
                onClick={handleSaveAll}
                disabled={isProcessing || isListening || isSaving || isCheckingInteractions}
              >
                {isSaving || isCheckingInteractions ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    {isCheckingInteractions ? "Checking..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Check className="w-6 h-6 mr-2" />
                    Save {medicineQueue.length} Medicine
                    {medicineQueue.length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="h-safe-bottom" />
        </div>
        {/* End scrollable content */}
      </div>

      {/* Photo Menu Overlay - Renders above everything */}
      {photoMenuOpenId && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setPhotoMenuOpenId(null)}
          />
          {/* Menu */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden w-64">
            <div className="px-4 py-3 bg-muted border-b border-border">
              <p className="font-semibold text-sm">Add Medicine Photo</p>
            </div>
            <button
              onClick={() => {
                const id = photoMenuOpenId;
                setPhotoMenuOpenId(null);
                void openQueueItemCamera(id);
              }}
              className="w-full px-4 py-4 text-left hover:bg-muted flex items-center gap-4 border-b border-border transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Take Photo</p>
                <p className="text-xs text-muted-foreground">Use camera</p>
              </div>
            </button>
            <button
              onClick={() => {
                const id = photoMenuOpenId;
                setPhotoMenuOpenId(null);
                openQueueItemUpload(id);
              }}
              className="w-full px-4 py-4 text-left hover:bg-muted flex items-center gap-4 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-medium">Upload Image</p>
                <p className="text-xs text-muted-foreground">From gallery</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Fullscreen Camera Overlay for Queue Item Photos */}
      {isCameraOpen && photoTargetId && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black/80">
            <h3 className="text-white font-semibold">Take Medicine Photo</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                stopCamera();
                setPhotoTargetId(null);
              }}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-48 border-2 border-white/60 rounded-lg relative">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
            </div>
          </div>
          <div className="p-6 bg-black/80 flex justify-center">
            <Button
              variant="coral"
              size="lg"
              className="w-48 h-16 rounded-full"
              onClick={capturePhoto}
            >
              <Camera className="w-8 h-8" />
            </Button>
          </div>
        </div>
      )}

      {/* Interaction Warning Modal */}
      {showInteractionWarning && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-lg rounded-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-primary/20 border-2 border-primary/20">
            {/* Branded Header with Coral Gradient */}
            <div className="relative px-6 py-6 bg-gradient-to-br from-primary via-primary to-[hsl(16_100%_72%)] overflow-hidden">
              {/* Decorative Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full border-4 border-white"></div>
                <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full border-4 border-white"></div>
              </div>
              
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">
                    Drug Interactions Detected
                  </h3>
                  <p className="text-sm text-white/90">
                    {detectedInteractions.length} medicine
                    {detectedInteractions.length > 1 ? "s have" : " has"}{" "}
                    potential interactions
                  </p>
                </div>
              </div>
            </div>

            {/* Doctor Recommendation - Teal Themed */}
            <div className="px-6 py-4 bg-gradient-to-r from-secondary/10 to-teal-light/50 dark:from-secondary/20 dark:to-secondary/10 border-b border-secondary/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-secondary">Recommendation</p>
                  <p className="text-sm text-muted-foreground">
                    Consult your doctor or pharmacist before taking these medicines together.
                  </p>
                </div>
              </div>
            </div>

            {/* Interaction List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {detectedInteractions.map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Pill className="w-4 h-4 text-primary" />
                    </div>
                    {item.medicineName}
                  </h4>
                  {item.interactions.map((interaction, iIdx) => {
                    const isMajor = interaction.severity === "Major";
                    const isModerate = interaction.severity === "Moderate";
                    return (
                      <div
                        key={iIdx}
                        className={`p-4 rounded-2xl border-2 ${
                          isMajor 
                            ? "border-primary/30 bg-primary/5" 
                            : isModerate 
                            ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                            : "border-secondary/30 bg-secondary/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          {isMajor ? (
                            <AlertOctagon className="w-5 h-5 text-primary" />
                          ) : isModerate ? (
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Info className="w-5 h-5 text-secondary" />
                          )}
                          <span className={`font-bold ${
                            isMajor ? "text-primary" : isModerate ? "text-amber-700 dark:text-amber-400" : "text-secondary"
                          }`}>
                            {interaction.severity} interaction
                          </span>
                          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                            isMajor 
                              ? "bg-primary text-white" 
                              : isModerate 
                              ? "bg-amber-500 text-white"
                              : "bg-secondary text-white"
                          }`}>
                            {interaction.currentMedication}
                          </span>
                        </div>
                        <p className="text-sm mb-3 leading-relaxed">
                          {interaction.clinicalEffect}
                        </p>
                        {interaction.saferAlternative && (
                          <div className="text-sm bg-secondary/10 p-3 rounded-xl border border-secondary/30">
                            <span className="font-bold text-secondary">
                              Safer alternative:
                            </span>{" "}
                            <span className="text-foreground">
                              {interaction.saferAlternative}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 py-5 border-t-2 border-border/50 space-y-3 bg-muted/30">
              <Button
                variant="teal"
                size="lg"
                className="w-full"
                onClick={() => {
                  setShowInteractionWarning(false);
                  setDetectedInteractions([]);
                }}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Go Back & Review
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full border-2 border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => void doSaveMedicines()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-5 h-5 mr-2" />
                    I Understand, Save Anyway
                  </>
                )}
              </Button>
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary/5 border border-primary/20">
                <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">
                  Medical consultation recommended before proceeding
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay for Interaction Check */}
      {isCheckingInteractions && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
          <div className="bg-background p-8 rounded-2xl text-center max-w-sm mx-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              Checking Drug Interactions
            </h3>
            <p className="text-sm text-muted-foreground">
              Checking your medicines against your current medications...
            </p>
          </div>
        </div>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            {/* Header with live preview */}
            <div className="bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium opacity-80">Select Time</span>
                <button
                  onClick={() => setShowTimePicker(false)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center">
                <span className="text-4xl font-bold tracking-tight">
                  {formatTimeFromPicker(selectedHour, selectedMinute, selectedPeriod)}
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="p-4 bg-muted/30 border-b border-border">
              <div className="grid grid-cols-5 gap-2">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, time: preset.time }));
                      setShowTimePicker(false);
                    }}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border transition-all ${
                      formData.time === preset.time
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{preset.label}</span>
                    <span className="text-[9px] opacity-70">{preset.time}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selector */}
            <div className="p-4">
              <div className="flex gap-3 items-start">
                {/* Hour */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">Hour</p>
                  <div className="grid grid-cols-4 gap-1">
                    {HOURS.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => setSelectedHour(hour)}
                        className={`h-9 rounded-md font-semibold text-sm transition-all ${
                          selectedHour === hour
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-muted/60 hover:bg-muted text-foreground"
                        }`}
                      >
                        {hour}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minute */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">Min</p>
                  <div className="grid grid-cols-4 gap-1">
                    {MINUTES.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => setSelectedMinute(minute)}
                        className={`h-9 rounded-md font-semibold text-sm transition-all ${
                          selectedMinute === minute
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-muted/60 hover:bg-muted text-foreground"
                        }`}
                      >
                        {minute.toString().padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AM/PM */}
                <div className="w-14">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">AM/PM</p>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod("AM")}
                      className={`h-9 rounded-md font-bold text-sm transition-all ${
                        selectedPeriod === "AM"
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-muted/60 hover:bg-muted text-foreground"
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod("PM")}
                      className={`h-9 rounded-md font-bold text-sm transition-all ${
                        selectedPeriod === "PM"
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-muted/60 hover:bg-muted text-foreground"
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 pt-0">
              <Button
                variant="coral"
                size="lg"
                className="w-full h-12"
                onClick={applyCustomTime}
              >
                <Check className="w-5 h-5 mr-2" />
                Set Time
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
