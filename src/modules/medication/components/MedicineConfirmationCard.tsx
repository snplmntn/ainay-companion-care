// ============================================
// Medicine Confirmation Card Component
// ============================================

import React, { useState, useRef } from "react";
import {
  Camera,
  Upload,
  X,
  Check,
  SkipForward,
  Sparkles,
  ImagePlus,
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
import type {
  ExtractedMedicineData,
  MedicineFormData,
  MedicationCategory,
  FrequencyType,
} from "../types";
import {
  MEDICATION_CATEGORIES,
  FREQUENCY_OPTIONS,
  TIME_PERIOD_OPTIONS,
} from "../constants";
import { fileToDataUrl } from "@/services/openai";

interface Props {
  medicine: ExtractedMedicineData;
  onConfirm: (data: MedicineFormData) => void;
  onSkip: () => void;
  currentIndex: number;
  totalCount: number;
}

export function MedicineConfirmationCard({
  medicine,
  onConfirm,
  onSkip,
  currentIndex,
  totalCount,
}: Props) {
  const [formData, setFormData] = useState<MedicineFormData>({
    name: medicine.name,
    dosage: medicine.dosage,
    category: medicine.category,
    frequency: medicine.frequency,
    customFrequency: medicine.customFrequency,
    timePeriod: medicine.timePeriod,
    instructions: medicine.instructions || "",
    startTime: "08:00",
    nextDayMode: "restart",
    imageUrl: medicine.imageUrl,
  });

  const [showCustomFrequency, setShowCustomFrequency] = useState(
    medicine.frequency === "custom"
  );
  const [localImageUrl, setLocalImageUrl] = useState<string | undefined>(
    medicine.imageUrl
  );
  const [isCapturing, setIsCapturing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFrequencyChange = (value: FrequencyType) => {
    setFormData((prev) => ({ ...prev, frequency: value }));
    setShowCustomFrequency(value === "custom");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setLocalImageUrl(dataUrl);
      setFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
    } catch (error) {
      console.error("Failed to process image:", error);
    }
    e.target.value = "";
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCapturing(true);
    } catch (error) {
      console.error("Camera error:", error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setLocalImageUrl(imageDataUrl);
    setFormData((prev) => ({ ...prev, imageUrl: imageDataUrl }));
    stopCamera();
  };

  const removeImage = () => {
    setLocalImageUrl(undefined);
    setFormData((prev) => ({ ...prev, imageUrl: undefined }));
  };

  const handleConfirm = () => {
    if (!formData.name || !formData.dosage) return;
    onConfirm(formData);
  };

  const selectedCategory = MEDICATION_CATEGORIES.find(
    (c) => c.value === formData.category
  );

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{selectedCategory?.icon || "💊"}</span>
            <div>
              <h3 className="font-bold text-lg">{formData.name || "New Medicine"}</h3>
              <p className="text-sm text-muted-foreground">
                Medicine {currentIndex + 1} of {totalCount}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-muted-foreground"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-5">
        {/* Photo Prompt Section - Prominent placement at top */}
        <div className={`rounded-2xl border-2 transition-all overflow-hidden ${
          localImageUrl 
            ? "border-green-300 bg-green-50 dark:bg-green-950/20" 
            : "border-dashed border-primary/50 bg-gradient-to-br from-primary/5 to-secondary/5"
        }`}>
          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {isCapturing ? (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] bg-black object-cover"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                <Button variant="secondary" onClick={stopCamera}>
                  Cancel
                </Button>
                <Button variant="coral" onClick={capturePhoto}>
                  <Camera className="w-5 h-5 mr-2" />
                  Capture Photo
                </Button>
              </div>
            </div>
          ) : localImageUrl ? (
            <div className="p-4">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <img
                    src={localImageUrl}
                    alt="Medicine"
                    className="w-24 h-24 object-cover rounded-xl border-2 border-green-300"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-700 dark:text-green-400">Photo Added!</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This photo will help you identify this medicine later. 
                    AInay can also use it to answer questions like "What is this pill?"
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startCamera}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Retake
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Replace
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <ImagePlus className="w-8 h-8 text-primary" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <h4 className="font-bold text-lg">Add a Photo of This Medicine</h4>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Recommended
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Take a photo of the medicine packaging or pill. This helps you identify it later 
                and allows AInay to answer "What is this white pill?" questions.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="coral"
                  onClick={startCamera}
                  className="min-w-[140px]"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-w-[140px]"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload
                </Button>
              </div>
              <button 
                onClick={() => {}} 
                className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now →
              </button>
            </div>
          )}
        </div>

        {/* Name & Dosage */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-2 block">
              Medicine Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Metformin"
              className="h-12"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-2 block">
              Dosage *
            </label>
            <Input
              value={formData.dosage}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dosage: e.target.value }))
              }
              placeholder="e.g., 500mg"
              className="h-12"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-semibold text-muted-foreground mb-2 block">
            Category
          </label>
          <div className="grid grid-cols-5 gap-2">
            {MEDICATION_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    category: cat.value as MedicationCategory,
                  }))
                }
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  formData.category === cat.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-xs font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div>
          <label className="text-sm font-semibold text-muted-foreground mb-2 block">
            How often? *
          </label>
          <Select
            value={formData.frequency}
            onValueChange={(value) => handleFrequencyChange(value as FrequencyType)}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showCustomFrequency && (
            <div className="mt-3">
              <label className="text-sm text-muted-foreground mb-1 block">
                Times per day
              </label>
              <Input
                type="number"
                min={1}
                max={12}
                value={formData.customFrequency || 1}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    customFrequency: parseInt(e.target.value) || 1,
                  }))
                }
                className="w-24 h-10"
              />
            </div>
          )}
        </div>

        {/* Time Period */}
        <div>
          <label className="text-sm font-semibold text-muted-foreground mb-2 block">
            For how long?
          </label>
          <Select
            value={formData.timePeriod}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, timePeriod: value }))
            }
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {TIME_PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Instructions */}
        <div>
          <label className="text-sm font-semibold text-muted-foreground mb-2 block">
            Special Instructions
          </label>
          <Input
            value={formData.instructions}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, instructions: e.target.value }))
            }
            placeholder="e.g., Take with food, avoid alcohol"
            className="h-12"
          />
        </div>

        {/* Confirm Button */}
        <Button
          variant="coral"
          size="lg"
          className="w-full"
          onClick={handleConfirm}
          disabled={!formData.name || !formData.dosage}
        >
          <Check className="w-5 h-5 mr-2" />
          Confirm & Set Alarm
        </Button>
      </div>
    </div>
  );
}

