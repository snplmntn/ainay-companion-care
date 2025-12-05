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
  Image as ImageIcon,
  AlertTriangle,
  AlertOctagon,
  Info,
  Stethoscope,
  Loader2,
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
  getSeverityColor,
  type DetectedInteraction,
  type InteractionSeverity,
} from "@/modules/medication/services/interactionService";
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
  imageUrl?: string;
}

interface MedicineInteraction {
  medicineName: string;
  interactions: DetectedInteraction[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

export function AddMedicineModal({ isOpen, onClose }: Props) {
  const { addMedication, medications: currentMedications } = useApp();
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
    imageUrl: "",
  });

  // Dropdown states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);

  // Drug interaction states
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);
  const [showInteractionWarning, setShowInteractionWarning] = useState(false);
  const [detectedInteractions, setDetectedInteractions] = useState<
    MedicineInteraction[]
  >([]);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
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
    setCapturedImages((prev) => [...prev, imageDataUrl]);
  };

  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle file upload (images)
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
        setCapturedImages((prev) => [...prev, dataUrl]);
      }

      toast({
        title: "Files uploaded",
        description: `${files.length} image${
          files.length > 1 ? "s" : ""
        } added.`,
      });
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

  const handleAnalyzeImages = async () => {
    if (capturedImages.length === 0) return;

    setIsProcessing(true);
    try {
      const medicines = await extractMultipleMedicinesFromImages(
        capturedImages
      );

      if (medicines.length > 0) {
        const newItems: MedicineQueueItem[] = medicines
          .filter((m) => m.name)
          .map((m, index) => ({
            ...m,
            id: generateId(),
            source: "scan" as const,
            category: "medicine" as MedicationCategory,
            frequency: "once_daily" as FrequencyType,
            // Use first captured image as the medicine photo
            imageUrl:
              capturedImages[Math.min(index, capturedImages.length - 1)],
          }));

        setMedicineQueue((prev) => [...prev, ...newItems]);
        setCapturedImages([]);
        stopCamera();

        toast({
          title: `Found ${newItems.length} medicine${
            newItems.length > 1 ? "s" : ""
          }!`,
          description: newItems.map((m) => m.name).join(", "),
        });
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
                const newItems: MedicineQueueItem[] = medicines
                  .filter((m) => m.name)
                  .map((m) => ({
                    ...m,
                    id: generateId(),
                    source: "voice" as const,
                    category: "medicine" as MedicationCategory,
                    frequency: "once_daily" as FrequencyType,
                  }));

                setMedicineQueue((prev) => [...prev, ...newItems]);

                toast({
                  title: `Found ${newItems.length} medicine${
                    newItems.length > 1 ? "s" : ""
                  }!`,
                  description: newItems.map((m) => m.name).join(", "),
                });
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
                imageUrl: formData.imageUrl,
              }
            : item
        )
      );
      setEditingId(null);
    } else {
      const newItem: MedicineQueueItem = {
        id: generateId(),
        source: "manual",
        name: formData.name,
        dosage: formData.dosage,
        time: formData.time,
        instructions: formData.instructions,
        category: formData.category,
        frequency: formData.frequency,
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

  // Actually save the medicines (after interaction check or user confirmation)
  const doSaveMedicines = () => {
    medicineQueue.forEach((medicine) => {
      addMedication({
        name: medicine.name,
        dosage: medicine.dosage,
        time: medicine.time,
        instructions: medicine.instructions,
        category: medicine.category,
        frequency: medicine.frequency,
        imageUrl: medicine.imageUrl,
        timePeriod: "ongoing",
        startTime: medicine.time,
        nextDayMode: "restart" as NextDayMode,
        isActive: true,
      });
    });

    toast({
      title: `${medicineQueue.length} medicine${
        medicineQueue.length > 1 ? "s" : ""
      } saved!`,
      description: medicineQueue.map((m) => m.name).join(", "),
    });

    setShowInteractionWarning(false);
    setDetectedInteractions([]);
    onClose();
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

    // Check for interactions
    const interactions = await checkAllInteractions();

    if (interactions.length > 0) {
      // Show warning dialog
      setShowInteractionWarning(true);
    } else {
      // No interactions, save directly
      doSaveMedicines();
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-background w-full max-w-lg rounded-t-3xl slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
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

        {/* Medicine Queue */}
        {medicineQueue.length > 0 && (
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="w-5 h-5 text-primary" />
              <span className="font-semibold">Medicines to save:</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {medicineQueue.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl bg-background border ${
                    editingId === item.id ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Medicine photo thumbnail with add photo prompt */}
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-cover border-2 border-green-300 shrink-0"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          editMedicine(item);
                          // Auto-scroll to photo section when editing
                        }}
                        className="w-12 h-12 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 flex flex-col items-center justify-center shrink-0 hover:border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors group"
                        title="Add a photo for this medicine"
                      >
                        <Camera className="w-4 h-4 text-amber-500 group-hover:text-amber-600" />
                        <span className="text-[9px] text-amber-600 font-medium">
                          Add
                        </span>
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
                        {!item.imageUrl && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
                            📷 Add photo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.dosage} • {item.time || "No time set"}
                      </p>
                      <div className="flex gap-2 mt-1">
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
            {/* Photo reminder banner */}
            {medicineQueue.some((m) => !m.imageUrl) && (
              <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      💡 Add photos for easy identification
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Photos help you & AInay identify medicines later
                    </p>
                  </div>
                </div>
              </div>
            )}
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
              <span className="text-senior-sm font-semibold">{tab.label}</span>
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

              {isCameraOpen ? (
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
                    "Metformin 500mg after breakfast, Lisinopril 10mg at night,
                    and Aspirin 81mg in the morning"
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

              {/* Medicine Photo - Prominent Section */}
              <div
                className={`rounded-xl border-2 p-4 transition-all ${
                  formData.imageUrl
                    ? "border-green-300 bg-green-50 dark:bg-green-950/20"
                    : "border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20"
                }`}
              >
                {formData.imageUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <img
                        src={formData.imageUrl}
                        alt="Medicine"
                        className="w-20 h-20 rounded-xl object-cover border-2 border-green-300"
                      />
                      <button
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, imageUrl: "" }))
                        }
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-700 dark:text-green-400">
                          Photo Added!
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Great! This helps identify the medicine later.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => medicinePhotoRef.current?.click()}
                      >
                        <Camera className="w-4 h-4 mr-1" />
                        Change Photo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-amber-600" />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="font-semibold text-amber-800 dark:text-amber-200">
                        Add a Photo
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                      Photo helps identify this medicine & enables "What's this
                      pill?" questions
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => medicinePhotoRef.current?.click()}
                      className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Add Medicine Photo
                    </Button>
                  </div>
                )}
              </div>

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
                            setFormData((prev) => ({ ...prev, category: cat }));
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
                <div>
                  <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                    Start Time *
                  </label>
                  <Input
                    value={formData.time}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, time: e.target.value }))
                    }
                    placeholder="e.g., 8:00 AM"
                    className="input-senior"
                  />
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
              disabled={isProcessing || isListening}
            >
              <Check className="w-6 h-6 mr-2" />
              Save {medicineQueue.length} Medicine
              {medicineQueue.length > 1 ? "s" : ""}
            </Button>
          )}
        </div>

        <div className="h-safe-bottom" />
      </div>

      {/* Interaction Warning Modal */}
      {showInteractionWarning && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-lg rounded-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-red-700 dark:text-red-400">
                    Drug Interactions Detected
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {detectedInteractions.length} medicine
                    {detectedInteractions.length > 1 ? "s have" : " has"}{" "}
                    potential interactions
                  </p>
                </div>
              </div>
            </div>

            {/* Doctor Recommendation */}
            <div className="px-6 py-3 bg-primary/5 border-b border-border">
              <div className="flex items-center gap-3">
                <Stethoscope className="w-5 h-5 text-primary shrink-0" />
                <p className="text-sm">
                  <span className="font-semibold">Recommendation:</span> Consult
                  your doctor or pharmacist before taking these medicines
                  together.
                </p>
              </div>
            </div>

            {/* Interaction List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {detectedInteractions.map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    {item.medicineName}
                  </h4>
                  {item.interactions.map((interaction, iIdx) => {
                    const colors = getSeverityColor(interaction.severity);
                    return (
                      <div
                        key={iIdx}
                        className={`p-4 rounded-xl border ${colors.border} ${colors.bg}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {interaction.severity === "Major" ? (
                            <AlertOctagon
                              className={`w-5 h-5 ${colors.icon}`}
                            />
                          ) : interaction.severity === "Moderate" ? (
                            <AlertTriangle
                              className={`w-5 h-5 ${colors.icon}`}
                            />
                          ) : (
                            <Info className={`w-5 h-5 ${colors.icon}`} />
                          )}
                          <span className={`font-semibold ${colors.text}`}>
                            {interaction.severity} interaction with{" "}
                            {interaction.currentMedication}
                          </span>
                        </div>
                        <p className="text-sm mb-2">
                          {interaction.clinicalEffect}
                        </p>
                        {interaction.saferAlternative && (
                          <div className="text-sm bg-green-50 dark:bg-green-950/30 p-2 rounded-lg border border-green-200 dark:border-green-800">
                            <span className="font-semibold text-green-700 dark:text-green-400">
                              Safer alternative:
                            </span>{" "}
                            {interaction.saferAlternative}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-border space-y-3">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  setShowInteractionWarning(false);
                  setDetectedInteractions([]);
                }}
              >
                Go Back & Review
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="w-full"
                onClick={doSaveMedicines}
              >
                I Understand, Save Anyway
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                ⚠️ Proceeding without medical consultation is not recommended
              </p>
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
    </div>
  );
}
