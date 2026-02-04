import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  QrCode,
  Users,
  UserCheck,
  UserX,
  LogOut,
  ArrowLeft,
  RefreshCw,
  Download,
  UserMinus,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ParticipantWithTeam } from "@shared/schema";

interface Volunteer {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  bio: string | null;
  organization: string | null;
  qrCodeHash: string | null;
  isCheckedIn: boolean;
  lastCheckIn: string | null;
  createdAt: string;
}

export default function Attendance() {
  const { user, logout, isLoggingOut, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: participants, isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithTeam[]>({
    queryKey: ["/api/participants"],
  });

  const { data: volunteers, isLoading: volunteersLoading, refetch: refetchVolunteers } = useQuery<Volunteer[]>({
    queryKey: ["/api/volunteers"],
  });

  const checkoutParticipantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/participants/${id}/checkout`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Participant checked out successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to checkout participant", description: error.message, variant: "destructive" });
    },
  });

  const checkoutVolunteerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/volunteers/${id}/checkout`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Volunteer checked out successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to checkout volunteer", description: error.message, variant: "destructive" });
    },
  });

  const generateVolunteerQrMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/volunteers/${id}/generate-qr`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "QR code generated!" });
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate QR code", description: error.message, variant: "destructive" });
    },
  });

  const downloadVolunteerQr = async (volunteerId: string, volunteerName: string) => {
    try {
      const response = await fetch(`/api/volunteers/${volunteerId}/qrcode`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to download QR code");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `volunteer-qr-${volunteerName.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "QR code downloaded!" });
    } catch (error) {
      toast({ title: "Failed to download QR code", variant: "destructive" });
    }
  };

  const handleRefresh = () => {
    refetchParticipants();
    refetchVolunteers();
  };

  const checkedInParticipants = participants?.filter(p => p.isCheckedIn) || [];
  const notCheckedInParticipants = participants?.filter(p => !p.isCheckedIn) || [];
  const checkedInVolunteers = volunteers?.filter(v => v.isCheckedIn) || [];
  const notCheckedInVolunteers = volunteers?.filter(v => !v.isCheckedIn) || [];

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-primary">Hack</span>Track
              </span>
              <Badge variant="outline" className="ml-2">Attendance</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <Button onClick={handleRefresh} variant="outline" size="sm" data-testid="button-refresh">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <ThemeToggle />
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {user?.firstName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                disabled={isLoggingOut}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Attendance Status</h1>
          <p className="text-muted-foreground mt-1">View who is checked in and who is not.</p>
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="participants" data-testid="tab-participants">
              <Users className="w-4 h-4 mr-2" />
              Participants ({participants?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="volunteers" data-testid="tab-volunteers">
              <Users className="w-4 h-4 mr-2" />
              Volunteers ({volunteers?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-6 mt-6">
            {/* Checked In Participants */}
            <Card data-testid="card-checked-in-participants">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-green-500" />
                  <CardTitle className="text-lg font-semibold">Checked In</CardTitle>
                </div>
                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                  {checkedInParticipants.length}
                </Badge>
              </CardHeader>
              <CardContent>
                {participantsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : checkedInParticipants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No participants checked in yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checkedInParticipants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-green-500/5 border border-green-500/20"
                        data-testid={`participant-checked-in-${participant.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-green-500/20 text-green-500">
                              {participant.name[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-sm text-muted-foreground">{participant.email}</p>
                          </div>
                          <Badge variant="outline">{participant.team?.name}</Badge>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkoutParticipantMutation.mutate(participant.id)}
                            disabled={checkoutParticipantMutation.isPending}
                            data-testid={`button-checkout-participant-${participant.id}`}
                          >
                            {checkoutParticipantMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <UserMinus className="w-4 h-4 mr-2" />
                                Checkout
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Not Checked In Participants */}
            <Card data-testid="card-not-checked-in-participants">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-yellow-500" />
                  <CardTitle className="text-lg font-semibold">Not Checked In</CardTitle>
                </div>
                <Badge variant="secondary">
                  {notCheckedInParticipants.length}
                </Badge>
              </CardHeader>
              <CardContent>
                {participantsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : notCheckedInParticipants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
                    <p>All participants are checked in!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notCheckedInParticipants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50"
                        data-testid={`participant-not-checked-in-${participant.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {participant.name[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-sm text-muted-foreground">{participant.email}</p>
                          </div>
                          <Badge variant="outline">{participant.team?.name}</Badge>
                        </div>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Volunteers Tab */}
          <TabsContent value="volunteers" className="space-y-6 mt-6">
            {/* Checked In Volunteers */}
            <Card data-testid="card-checked-in-volunteers">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-green-500" />
                  <CardTitle className="text-lg font-semibold">Volunteers Checked In</CardTitle>
                </div>
                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                  {checkedInVolunteers.length}
                </Badge>
              </CardHeader>
              <CardContent>
                {volunteersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : checkedInVolunteers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No volunteers checked in yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checkedInVolunteers.map((volunteer) => (
                      <div
                        key={volunteer.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-green-500/5 border border-green-500/20"
                        data-testid={`volunteer-checked-in-${volunteer.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-green-500/20 text-green-500">
                              {volunteer.firstName[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{volunteer.firstName} {volunteer.lastName}</p>
                            <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                          </div>
                          {volunteer.organization && (
                            <Badge variant="outline">{volunteer.organization}</Badge>
                          )}
                        </div>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkoutVolunteerMutation.mutate(volunteer.id)}
                            disabled={checkoutVolunteerMutation.isPending}
                            data-testid={`button-checkout-volunteer-${volunteer.id}`}
                          >
                            {checkoutVolunteerMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <UserMinus className="w-4 h-4 mr-2" />
                                Checkout
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Not Checked In Volunteers */}
            <Card data-testid="card-not-checked-in-volunteers">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-yellow-500" />
                  <CardTitle className="text-lg font-semibold">Volunteers Not Checked In</CardTitle>
                </div>
                <Badge variant="secondary">
                  {notCheckedInVolunteers.length}
                </Badge>
              </CardHeader>
              <CardContent>
                {volunteersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : notCheckedInVolunteers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
                    <p>All volunteers are checked in!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notCheckedInVolunteers.map((volunteer) => (
                      <div
                        key={volunteer.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50"
                        data-testid={`volunteer-not-checked-in-${volunteer.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {volunteer.firstName[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{volunteer.firstName} {volunteer.lastName}</p>
                            <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                          </div>
                          {volunteer.organization && (
                            <Badge variant="outline">{volunteer.organization}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <>
                              {!volunteer.qrCodeHash ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => generateVolunteerQrMutation.mutate(volunteer.id)}
                                  disabled={generateVolunteerQrMutation.isPending}
                                  data-testid={`button-generate-qr-${volunteer.id}`}
                                >
                                  {generateVolunteerQrMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <QrCode className="w-4 h-4 mr-2" />
                                      Generate QR
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadVolunteerQr(volunteer.id, volunteer.firstName)}
                                  data-testid={`button-download-qr-${volunteer.id}`}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  QR Code
                                </Button>
                              )}
                            </>
                          )}
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
