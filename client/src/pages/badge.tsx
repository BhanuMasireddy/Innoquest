import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, QrCode, MapPin, Calendar, Hash } from "lucide-react";
import type { ParticipantWithTeamAndLab } from "@shared/schema";

export default function Badge() {
  const [, params] = useRoute("/badge/:id");
  const participantId = params?.id;
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const qrBlobUrlRef = useRef<string | null>(null);

  const { data: participant, isLoading } = useQuery<ParticipantWithTeamAndLab>({
    queryKey: ["/api/participants", participantId],
    queryFn: async () => {
      const response = await fetch(`/api/participants`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch participants");
      const participants = await response.json();
      return participants.find((p: ParticipantWithTeamAndLab) => p.id === participantId);
    },
    enabled: !!participantId,
  });

  useEffect(() => {
    if (!participantId) return;
    fetch(`/api/participants/${participantId}/qrcode`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load participant QR");
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (qrBlobUrlRef.current) URL.revokeObjectURL(qrBlobUrlRef.current);
        qrBlobUrlRef.current = url;
        setQrCodeUrl(url);
      })
      .catch(console.error);

    return () => {
      if (qrBlobUrlRef.current) {
        URL.revokeObjectURL(qrBlobUrlRef.current);
        qrBlobUrlRef.current = null;
      }
    };
  }, [participantId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="w-[400px] h-[600px]" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Participant not found</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-8 print:p-0 print:bg-white">
      <div className="fixed top-4 left-4 bg-white p-4 rounded-lg shadow-xl print:hidden max-w-xs z-50">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Print Settings</p>
        <p className="text-sm text-gray-800">1. Layout: Portrait</p>
        <p className="text-sm text-gray-800">2. Paper Size: Custom (3.5&quot; x 5.5&quot;) or A4</p>
        <p className="text-sm text-gray-800">3. Options: <strong>Enable Background Graphics</strong></p>
      </div>

      <div className="fixed top-4 right-4 print:hidden flex gap-2 z-50">
        <Link href="/">
          <Button variant="outline" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <Button onClick={() => window.print()} data-testid="button-print">
          <Printer className="w-4 h-4 mr-2" />
          Print Badge
        </Button>
      </div>

      <div
        className="relative overflow-hidden flex flex-col shadow-2xl rounded-2xl print:rounded-none"
        style={{
          width: "3.5in",
          height: "5.5in",
          backgroundColor: "#030712",
          color: "white",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[60%] bg-blue-900/40 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[40%] bg-sky-600/20 blur-[60px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative z-10 flex flex-col items-center pt-8 pb-4">
          <div className="flex items-center gap-1.5 mb-2 opacity-80">
            <div className="h-[1px] w-6 bg-sky-400" />
            <p className="text-[9px] uppercase tracking-[0.25em] font-medium text-sky-200">Dept of CSE</p>
            <div className="h-[1px] w-6 bg-sky-400" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-100 to-sky-300">INNOQUEST</h1>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Edition</span>
            <span className="bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-bold border border-sky-500/30">#04</span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-4">
          <div className="relative p-1">
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-500 via-purple-500 to-sky-500 rounded-2xl blur-sm opacity-60" />
            <div className="relative bg-white p-2.5 rounded-xl shadow-2xl">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR" className="w-[140px] h-[140px] mix-blend-multiply" data-testid="badge-qr-code" />
              ) : (
                <div className="w-[140px] h-[140px] bg-gray-100 flex items-center justify-center">
                  <QrCode className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-black" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-black" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-black" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-black" />
            </div>
          </div>
          <p className="mt-3 text-[9px] tracking-[0.2em] text-sky-200/70 uppercase">Scan for Entry</p>
        </div>

        <div className="relative z-10 m-3 mt-0 p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-wide truncate" data-testid="badge-name">
              {participant.name}
            </h2>
            <div className="flex justify-center gap-2 mt-2">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/20 to-blue-600/20 border border-sky-400/30 text-sky-200 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Hash size={10} /> {participant.team?.name || "No Team"}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-700/50 border border-slate-600 text-slate-300 text-[9px] font-bold uppercase tracking-wider">
                Participant
              </span>
            </div>
            <p className="text-[10px] text-slate-300 mt-2 truncate" data-testid="badge-email">{participant.email}</p>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-3" />
          <div className="flex justify-between items-center px-1">
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-gray-300">
                <Calendar size={11} className="text-sky-400" />
                <span className="text-[9px] font-medium tracking-wide">27 Feb - 01 Mar</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-[9px] font-medium tracking-wide text-right w-24 truncate">{participant.lab?.name || "Main Lab"}</span>
                <MapPin size={11} className="text-sky-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-purple-500 to-sky-500" />
      </div>
    </div>
  );
}
