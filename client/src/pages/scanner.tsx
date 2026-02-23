import React,{ useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  Camera,
  CameraOff,
  ArrowLeft,
  Volume2,
  VolumeX,
  UserCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { Html5Qrcode } from "html5-qrcode";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Participant } from "@shared/schema";

interface ScanResult {
  success: boolean;
  message: string;
  mode?: "ATTENDANCE" | "MEAL";
  mealType?: "BREAKFAST" | "LUNCH" | "SNACKS" | "DINNER";
  type?: "participant" | "volunteer";
  participant?: Participant & { name?: string; teamName?: string };
  volunteer?: { firstName: string; lastName?: string };
  alreadyCheckedIn?: boolean;
  scanType?: "ENTRY" | "EXIT";
}

type PendingScan = {
  qrHash: string;
  name: string;
  scanType: "ENTRY" | "EXIT";
  mode?: "ATTENDANCE" | "MEAL";
  mealType?: "BREAKFAST" | "LUNCH" | "SNACKS" | "DINNER";
};




export default function Scanner() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isScanning, setIsScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [processingQr, setProcessingQr] = useState(false);
  
  
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [confirming, setConfirming] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>("");
  const cooldownRef = useRef<boolean>(false);
  const processingRef = useRef<boolean>(false);
  const confirmingRef = useRef<boolean>(false);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const invalidateAfterScan = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/scans/recent"] });
    queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
    queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/system/mode"] });
    queryClient.invalidateQueries({ queryKey: ["/api/meals/analytics"] });
  }, [queryClient]);

  const resetScannerState = () => {
    setProcessingQr(false);
    processingRef.current = false;

    setTimeout(() => {
      cooldownRef.current = false;
      if ((scannerRef.current as any)?.resume) {
        (scannerRef.current as any).resume();
      }
    }, 500);
  };
  useEffect(() => {
    processingRef.current = processingQr;
  }, [processingQr]);

  useEffect(() => {
    confirmingRef.current = confirming;
  }, [confirming]);
  // Initialize audio elements
  useEffect(() => {
    successAudioRef.current = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" + 
      "tvT19" + "///////////////////////////////////////////////////////////////////////////////////////////////////////////" +
      "///////////////////////////////////////////////////////////////////////////////////////////////////////////" +
      "///////////////////////////////////////////////////////////////////////////////////////////////////////////" +
      "///////////////////////////////////////////////////////////////////////////////////////////////////////////");
    errorAudioRef.current = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" +
      "tvT19");
  }, []);

  const playSound = useCallback((type: "success" | "error") => {
    if (!soundEnabled) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioContext = new AudioCtx();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === "success") {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else {
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      }
    } catch (error) {
      console.warn("Scanner sound playback failed:", error);
    }
  }, [soundEnabled]);

  const scanMutation = useMutation({
  mutationFn: async (qrHash: string) => {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ qr_hash: qrHash }),
    });

    return (await res.json()) as ScanResult & {
      scanType?: "ENTRY" | "EXIT";
    };
  },

  onSuccess: (data) => {
    setLastScan(data);

    if (!data.success) {
      playSound("error");
      toast({
        title: "Scan failed",
        description: data.message,
        variant: "destructive",
      });
      return;
    }

    playSound("success");

    const name =
      data.type === "volunteer"
        ? `${data.volunteer?.firstName} ${data.volunteer?.lastName || ""}`
        : data.participant?.name;

    toast({
      title:
        data.mode === "MEAL"
          ? `${data.mealType || "Meal"} consumed`
          : data.scanType === "EXIT"
            ? "Checked out"
            : "Checked in",
      description: name,
      className:
        data.mode !== "MEAL" && data.scanType === "EXIT"
          ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
          : "bg-green-500/10 border-green-500/30 text-green-500",
    });

    invalidateAfterScan();
  },

  onSettled: () => {
    setProcessingQr(false);
    setTimeout(() => {
      cooldownRef.current = false;
    }, 500);
  },
});


  
const handleScan = useCallback((decodedText: string) => {
  if (cooldownRef.current || processingRef.current || confirmingRef.current) return;

  cooldownRef.current = true;
  setProcessingQr(true);
  processingRef.current = true;

  fetch("/api/scan-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qr_hash: decodedText }),
  })
    .then(res => res.json())
    .then(async data => {
      if (!data.success) {
        playSound("error");
        toast({
          title: "Scan failed",
          description: data.message,
          variant: "destructive",
        });
        resetScannerState();
        return;
      }

      // 🔥 STOP CAMERA BEFORE SHOWING POPUP
      //if (scannerRef.current) {
        //await scannerRef.current.stop();
        //scannerRef.current.clear();
        //scannerRef.current = null;
      //}

      //setIsScanning(false);

      setPendingScan({
        qrHash: decodedText,
        name: data.name,
        scanType: data.scanType,
        mode: data.mode,
        mealType: data.mealType,
      });

      setConfirming(true);
      confirmingRef.current = true;
      setProcessingQr(false);
      processingRef.current = false;
    })
    .catch(() => {
      toast({
        title: "Scan failed",
        description: "Could not process QR. Please try again.",
        variant: "destructive",
      });
      resetScannerState();
    });
}, [playSound, toast]);


  const startScanner = async () => {
  if (scannerRef.current) return;

  const scanner = new Html5Qrcode("qr-reader");
  scannerRef.current = scanner;

  try {
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1,
      },
      handleScan,
      () => {}
    );
    setIsScanning(true);
  } catch (error) {
    scannerRef.current = null;
    setIsScanning(false);
    toast({
      title: "Camera error",
      description: "Unable to start scanner. Please allow camera access and try again.",
      variant: "destructive",
    });
  }
};

const stopScanner = async () => {
  if (!scannerRef.current) return;

  try {
    await scannerRef.current.stop();
    scannerRef.current.clear();
  } catch {
    // no-op: scanner may already be stopped/disposed
  } finally {
    scannerRef.current = null;
  }

  setIsScanning(false);
};

  return (
    <div className="app-page min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 pt-3">
        <div className="max-w-3xl mx-auto px-2 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16 rounded-2xl border border-border/70 bg-card/80 text-foreground px-3 sm:px-4 shadow-[0_10px_28px_hsl(var(--foreground)/0.12)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-xl border border-transparent hover:border-border/80 hover:bg-muted/60" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/40 shadow-sm">
                  <QrCode className="w-4 h-4 text-primary" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-bold">INNOQUEST #4</span>
                  <span className="text-[10px] text-muted-foreground hidden sm:block">Department of CSE, Anurag University</span>
                </div>
              </div>
              <Badge variant="outline" className="hidden sm:flex border-border/70 bg-card/60 backdrop-blur-sm">Volunteer</Badge>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl border border-transparent hover:border-border/80 hover:bg-muted/60"
                onClick={() => setSoundEnabled(!soundEnabled)}
                data-testid="button-sound-toggle"
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="hero-photo h-44 bg-gradient-to-br from-primary/20 via-background to-accent/20 flex items-center justify-center">
          <QrCode className="w-16 h-16 text-primary/70" />
        </div>

        {/* Scanner Card */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              QR Scanner
            </CardTitle>
            <div className="flex items-center gap-2">
              {isScanning && (
                <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  Active
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scanner Viewport */}
            <div className="relative aspect-square max-w-sm mx-auto rounded-lg overflow-hidden bg-muted/30 border-2 border-dashed border-primary/30">
              <div id="qr-reader" className="w-full h-full" />
              
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
                  <CameraOff className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-4">
                    Camera is off
                  </p>
                  <Button onClick={startScanner} data-testid="button-start-scanner">
                    <Camera className="w-4 h-4 mr-2" />
                    Start Scanner
                  </Button>
                </div>
              )}
              
              {processingQr && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
              )}
              
              {/* Scan overlay animation */}
              {isScanning && !processingQr && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
                </div>
              )}
            </div>

            {/* Scanner Controls */}
            <div className="flex justify-center gap-4">
              {isScanning ? (
                <Button variant="destructive" onClick={stopScanner} data-testid="button-stop-scanner">
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop Scanner
                </Button>
              ) : (
                <Button onClick={startScanner} className="animate-pulse-glow" data-testid="button-start-scanner">
                  <Camera className="w-4 h-4 mr-2" />
                  Start Scanner
                </Button>
              )}
            </div>

            <p className="text-sm text-center text-muted-foreground">
              Point the camera at a participant's QR code to check them in
            </p>
          </CardContent>
        </Card>

        {/* Last Scan Result */}
        {lastScan && (
          <Card
            className={`${
              lastScan.success
                ? "border-green-500/30 bg-green-500/5 animate-success-pulse"
                : "border-destructive/30 bg-destructive/5 animate-error-shake"
            }`}
            data-testid="scan-result-card"
          >
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div
                  className={`w-20 h-20 sm:w-16 sm:h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
                    lastScan.success
                      ? "bg-green-500/20 text-green-500"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {lastScan.success ? (
                    <UserCheck className="w-10 h-10 sm:w-8 sm:h-8" />
                  ) : (
                    <AlertCircle className="w-10 h-10 sm:w-8 sm:h-8" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-2xl sm:text-xl font-bold ${
                      lastScan.success 
                        ? "text-green-500" 
                        : "text-destructive"
                    }`}
                    data-testid="scan-result-status"
                  >
                    {lastScan.success
                    ? lastScan.mode === "MEAL"
                      ? `${lastScan.mealType || "Meal"} Consumed Successfully!`
                      : lastScan.scanType === "EXIT"
                        ? "Checked Out Successfully!"
                        : "Checked In Successfully!"
                    : "Scan Failed"}
                  </p>
                  {lastScan.success && lastScan.type === "volunteer" && lastScan.volunteer ? (
                    <div className="mt-2">
                      <p className="text-lg font-medium" data-testid="scan-result-name">
                        {lastScan.volunteer.firstName} {lastScan.volunteer.lastName || ""}
                      </p>
                      <Badge variant="outline" className="mt-1">Volunteer</Badge>
                    </div>
                  ) : lastScan.success && lastScan.participant ? (
                    <div className="mt-2">
                      <p className="text-lg font-medium" data-testid="scan-result-name">
                        {lastScan.participant.name}
                      </p>
                      {(lastScan.participant as any).team && (
                        <p className="text-sm text-muted-foreground" data-testid="scan-result-team">
                          Team: {(lastScan.participant as any).team?.name || "Unknown"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-base sm:text-sm text-muted-foreground mt-2" data-testid="scan-result-message">
                      {lastScan.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Confirmation Modal */}
{pendingScan && confirming && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">
          {pendingScan.mode === "MEAL"
            ? `Confirm ${pendingScan.mealType || "Meal"}`
            : pendingScan.scanType === "EXIT"
              ? "Confirm Check-out"
              : "Confirm Check-in"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {pendingScan.mode === "MEAL" ? (
            <>
              Confirm <span className="font-semibold">{pendingScan.mealType || "meal"}</span> for{" "}
              <span className="font-semibold">{pendingScan.name}</span>?
            </>
          ) : (
            <>
              Are you sure you want to
              {pendingScan.scanType === "EXIT" ? " check out " : " check in "}
              <span className="font-semibold">{pendingScan.name}</span>?
            </>
          )}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // 🔥 ADD THESE LINES (FIX 4)
              resetScannerState();
              setPendingScan(null);
              setConfirming(false);
              confirmingRef.current = false;
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setProcessingQr(true);
              processingRef.current = true;
              fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  qr_hash: pendingScan.qrHash,
                  scan_type: pendingScan.scanType,
                }),
              })
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    setLastScan({
                      ...data,
                      scanType: pendingScan.scanType,
                      mode: pendingScan.mode,
                      mealType: pendingScan.mealType,
                    });
                    playSound("success");
                    invalidateAfterScan();
                  } else {
                    playSound("error");
                    toast({
                      title:
                        pendingScan.scanType === "EXIT"
                          ? "Check-out failed"
                          : "Check-in failed",
                      description: data.message,
                      variant: "destructive",
                    });
                  }
                })
                .catch(() => {
                  playSound("error");
                  toast({
                    title:
                      pendingScan.scanType === "EXIT"
                        ? "Check-out failed"
                        : "Check-in failed",
                    description: "Network error while submitting scan.",
                    variant: "destructive",
                  });
                })
                .finally(() => {
                  resetScannerState();
                  setPendingScan(null);
                  setConfirming(false);
                  confirmingRef.current = false;
                });
            }}
          >
            {pendingScan.mode === "MEAL"
              ? `Consume ${pendingScan.mealType || "Meal"}`
              : pendingScan.scanType === "EXIT"
                ? "Check Out"
                : "Check In"}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <p>Hold the camera steady about 6-12 inches from the QR code</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <p>Make sure the QR code is well-lit and not damaged</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <p>Wait for the beep sound to confirm successful check-in</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
