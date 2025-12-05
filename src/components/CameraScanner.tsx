import React, { useRef, useState, useEffect, useCallback } from "react";
import { Camera, X, RotateCcw, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  capturedCount?: number;
}

export function CameraScanner({
  isOpen,
  onClose,
  onCapture,
  capturedCount = 0,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    setIsReady(false);

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError(
        "Could not access camera. Please check permissions and try again."
      );
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Get data URL
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      setCapturedImage(null);
      // Continue scanning for more medicines
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const handleDone = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>

        <div className="text-white text-center">
          <p className="font-semibold">Scan Medicine</p>
          {capturedCount > 0 && (
            <p className="text-sm opacity-80">
              {capturedCount} medicine{capturedCount > 1 ? "s" : ""} captured
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCamera}
          className="text-white hover:bg-white/20"
          disabled={!!capturedImage}
        >
          <RotateCcw className="w-6 h-6" />
        </Button>
      </div>

      {/* Camera view or captured image */}
      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center text-white">
              <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-4">{error}</p>
              <Button onClick={() => void startCamera()} variant="secondary">
                Try Again
              </Button>
            </div>
          </div>
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured medicine"
            className="w-full h-full object-contain"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Scanning guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/50 rounded-2xl">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
              </div>
            </div>
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p>Starting camera...</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
        {capturedImage ? (
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={retake}
              variant="secondary"
              size="lg"
              className="rounded-full px-6"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Retake
            </Button>

            <Button
              onClick={confirmCapture}
              variant="secondary"
              size="lg"
              className="rounded-full px-6"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add More
            </Button>

            <Button
              onClick={handleDone}
              variant="coral"
              size="lg"
              className="rounded-full px-6"
            >
              <Check className="w-5 h-5 mr-2" />
              Done
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={capturePhoto}
              disabled={!isReady}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30 flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-white" />
            </button>
          </div>
        )}

        <p className="text-center text-white/80 text-sm mt-4">
          {capturedImage
            ? "Add more medicines or tap Done to identify them"
            : "Position the medicine in the frame and tap to capture"}
        </p>
      </div>
    </div>
  );
}
