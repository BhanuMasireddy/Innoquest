import { useEffect, useRef, useState, useCallback } from "react";
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
import type { Participant } from "@shared/schema";

interface ScanResult {
  success: boolean;
  message: string;
  type?: "participant" | "volunteer";
  participant?: Participant & { name?: string; teamName?: string };
  volunteer?: { firstName: string; lastName?: string };
  alreadyCheckedIn?: boolean;
}

export default function Scanner() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isScanning, setIsScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [processingQr, setProcessingQr] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>("");
  const cooldownRef = useRef<boolean>(false);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

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
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  }, [soundEnabled]);

  const scanMutation = useMutation({
    mutationFn: async (qrHash: string) => {
      const response = await apiRequest("POST", "/api/scan", {
        qr_hash: qrHash,
        scan_type: "ENTRY",
      });
      return response.json() as Promise<ScanResult>;
    },
    onSuccess: (data) => {
      setLastScan(data);
      if (data.success) {
        playSound("success");
        const name = data.type === "volunteer" 
          ? `${data.volunteer?.firstName} ${data.volunteer?.lastName || ""}`
          : data.participant?.name;
        toast({
          title: "Check-in Successful!",
          description: name,
          className: "bg-green-500/10 border-green-500/30 text-green-500",
        });
      } else {
        playSound("error");
        toast({
          title: data.message?.includes("already") ? "Already Checked In" : "Check-in Failed",
          description: data.message,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scans/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
    },
    onError: async (error: any) => {
      playSound("error");
      let errorMessage = "Failed to process scan";
      let alreadyCheckedIn = false;
      
      // Try to parse error response
      if (error.response) {
        try {
          const errorData = await error.response.json();
          errorMessage = errorData.message || errorMessage;
          alreadyCheckedIn = errorData.message?.includes("already");
        } catch (e) {
          // Use default message
        }
      }
      
      setLastScan({
        success: false,
        message: errorMessage,
        alreadyCheckedIn,
      });
      toast({
        title: alreadyCheckedIn ? "Already Checked In" : "Scan Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setProcessingQr(false);
      // Cooldown to prevent rapid re-scans
      setTimeout(() => {
        cooldownRef.current = false;
      }, 2000);
    },
  });

  const handleScan = useCallback((decodedText: string) => {
    if (cooldownRef.current || processingQr) return;
    if (decodedText === lastScannedRef.current) return;
    
    cooldownRef.current = true;
    lastScannedRef.current = decodedText;
    setProcessingQr(true);
    scanMutation.mutate(decodedText);
  }, [scanMutation, processingQr]);

  const startScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScan,
        () => {} // Ignore errors (no QR found)
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please ensure camera permissions are granted.",
        variant: "destructive",
      });
    }
  }, [handleScan, toast]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30">
                  <QrCode className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold">Scanner</span>
              </div>
              <Badge variant="outline" className="hidden sm:flex">Volunteer</Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                data-testid="button-sound-toggle"
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
              <Avatar className="w-8 h-8">
                <AvatarImage src={undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "V"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
                : lastScan.alreadyCheckedIn || lastScan.message?.includes("already")
                ? "border-yellow-500/30 bg-yellow-500/5"
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
                      : lastScan.alreadyCheckedIn || lastScan.message?.includes("already")
                      ? "bg-yellow-500/20 text-yellow-500"
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
                        : lastScan.alreadyCheckedIn || lastScan.message?.includes("already")
                        ? "text-yellow-500"
                        : "text-destructive"
                    }`}
                    data-testid="scan-result-status"
                  >
                    {lastScan.success 
                      ? "Check-in Successful!" 
                      : lastScan.alreadyCheckedIn || lastScan.message?.includes("already")
                      ? "Already Checked In"
                      : "Check-in Failed"}
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
