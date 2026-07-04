"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function getDetector(): BarcodeDetectorConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector ?? null;
}

export function barcodeScanSupported(): boolean {
  return getDetector() !== null;
}

/** Camera barcode scanner using the native BarcodeDetector API. */
export function BarcodeScanner({
  onDetected,
  onError,
}: {
  onDetected: (barcode: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const Detector = getDetector();
    if (!Detector) {
      onError("Barcode scanning is not supported here, enter the code manually");
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const detector = new Detector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
    });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStarting(false);
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.replace(/\D/g, "");
            if (value && value.length >= 8) {
              onDetected(value);
              return;
            }
          } catch {
            // Frame not ready yet — keep polling.
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) onError("Camera access was denied, enter the code manually");
      }
    }
    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border bg-black">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
      {starting ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-white">
          Starting camera...
        </p>
      ) : (
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-lg border-2 border-white/70" />
      )}
    </div>
  );
}
