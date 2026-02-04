import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, QrCode } from "lucide-react";
import type { ParticipantWithTeam } from "@shared/schema";

export default function Badge() {
  const [, params] = useRoute("/badge/:id");
  const participantId = params?.id;
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const { data: participant, isLoading } = useQuery<ParticipantWithTeam>({
    queryKey: ["/api/participants", participantId],
    queryFn: async () => {
      const response = await fetch(`/api/participants`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch participants");
      const participants = await response.json();
      return participants.find((p: ParticipantWithTeam) => p.id === participantId);
    },
    enabled: !!participantId,
  });

  useEffect(() => {
    if (participantId) {
      fetch(`/api/participants/${participantId}/qrcode`, { credentials: "include" })
        .then(response => response.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setQrCodeUrl(url);
        })
        .catch(console.error);
    }

    return () => {
      if (qrCodeUrl) {
        URL.revokeObjectURL(qrCodeUrl);
      }
    };
  }, [participantId]);

  const handlePrint = () => {
    window.print();
  };

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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="print:hidden p-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/">
          <Button variant="outline" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <Button onClick={handlePrint} data-testid="button-print">
          <Printer className="w-4 h-4 mr-2" />
          Print Badge
        </Button>
      </div>

      <div className="flex justify-center p-4 print:p-0">
        <div 
          className="w-[3.5in] h-[5.5in] bg-white rounded-lg shadow-xl overflow-hidden print:shadow-none print:rounded-none"
          style={{ pageBreakInside: "avoid" }}
        >
          <div className="h-full flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                  <QrCode className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">HackTrack</h1>
                  <p className="text-sm text-white/80">Hackathon 2026</p>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
              <div className="w-48 h-48 bg-white border-4 border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                {qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code" 
                    className="w-full h-full object-contain"
                    data-testid="badge-qr-code"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <QrCode className="w-16 h-16" />
                    <span className="text-xs">Loading...</span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <h2 
                  className="text-2xl font-bold text-gray-900"
                  data-testid="badge-name"
                >
                  {participant.name}
                </h2>
                <p 
                  className="text-lg text-gray-600 mt-1"
                  data-testid="badge-email"
                >
                  {participant.email}
                </p>
                {participant.team && (
                  <div className="mt-3">
                    <span 
                      className="inline-block px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                      data-testid="badge-team"
                    >
                      Team: {participant.team.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-100 p-4 text-center">
              <p className="text-xs text-gray-500">
                Scan this QR code at the entrance for check-in
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ID: {participant.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: 3.5in 5.5in;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
