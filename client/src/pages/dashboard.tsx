import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  QrCode,
  Users,
  UserCheck,
  TrendingUp,
  LogOut,
  ScanLine,
  RefreshCw,
  Plus,
  Download,
  Trash2,
  Loader2,
  UsersRound,
  ClipboardList,
  UserCircle,
} from "lucide-react";
import { Link } from "wouter";
import type { ParticipantWithTeam, Team } from "@shared/schema";

interface Stats {
  total: number;
  checkedIn: number;
  percentage: number;
  teamCount: number;
}

export default function Dashboard() {
  const { user, logout, isLoggingOut, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "", teamId: "" });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: teams, isLoading: teamsLoading, refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: participants, isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithTeam[]>({
    queryKey: ["/api/participants"],
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await apiRequest("POST", "/api/teams", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Team created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setTeamDialogOpen(false);
      setNewTeam({ name: "", description: "" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create team", description: error.message, variant: "destructive" });
    },
  });

  const createParticipantMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; teamId: string }) => {
      const response = await apiRequest("POST", "/api/participants", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Participant added successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setParticipantDialogOpen(false);
      setNewParticipant({ name: "", email: "", teamId: "" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add participant", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Team deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete team", description: error.message, variant: "destructive" });
    },
  });

  const deleteParticipantMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/participants/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Participant deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete participant", description: error.message, variant: "destructive" });
    },
  });

  interface Volunteer {
    id: string;
    firstName: string;
    lastName: string | null;
    email?: string;
    organization?: string | null;
    qrCodeHash?: string | null;
    isCheckedIn: boolean;
  }

  const { data: volunteers, isLoading: volunteersLoading, refetch: refetchVolunteers } = useQuery<Volunteer[]>({
    queryKey: ["/api/volunteers"],
    enabled: isAdmin,
  });

  const deleteVolunteerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/volunteers/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Volunteer deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete volunteer", description: error.message, variant: "destructive" });
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

  const handleRefresh = () => {
    refetchStats();
    refetchTeams();
    refetchParticipants();
    if (isAdmin) refetchVolunteers();
  };

  const downloadQrCode = async (participantId: string, participantName: string) => {
    try {
      const response = await fetch(`/api/participants/${participantId}/qrcode`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to download QR code");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${participantName.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "QR code downloaded!" });
    } catch (error) {
      toast({ title: "Failed to download QR code", variant: "destructive" });
    }
  };

  const downloadVolunteerQrCode = async (volunteerId: string, volunteerName: string) => {
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
      toast({ title: "Volunteer QR code downloaded!" });
    } catch (error) {
      toast({ title: "Failed to download QR code", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-primary">Hack</span>Track
              </span>
              <Badge variant="outline" className="ml-2 hidden sm:flex">
                {isAdmin ? "Admin" : "Volunteer"}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Link href="/attendance">
                <Button variant="ghost" size="sm" data-testid="link-attendance">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Attendance</span>
                </Button>
              </Link>
              <Link href="/scanner">
                <Button variant="outline" size="sm" data-testid="link-scanner">
                  <ScanLine className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Scanner</span>
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="icon" data-testid="link-profile">
                  <UserCircle className="w-5 h-5" />
                </Button>
              </Link>
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
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back, <span className="text-primary">{user?.firstName || "User"}</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? "Manage teams, participants, and track attendance." : "Track attendance at your hackathon."}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Teams"
            value={stats?.teamCount ?? 0}
            icon={<UsersRound className="w-5 h-5" />}
            loading={statsLoading}
            testId="stat-teams"
          />
          <StatsCard
            title="Total Participants"
            value={stats?.total ?? 0}
            icon={<Users className="w-5 h-5" />}
            loading={statsLoading}
            testId="stat-total"
          />
          <StatsCard
            title="Checked In"
            value={stats?.checkedIn ?? 0}
            icon={<UserCheck className="w-5 h-5" />}
            loading={statsLoading}
            variant="success"
            testId="stat-checked-in"
          />
          <StatsCard
            title="Check-in Rate"
            value={`${stats?.percentage ?? 0}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            loading={statsLoading}
            variant="accent"
            testId="stat-rate"
          />
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <Card data-testid="card-admin-actions">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Admin Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-team">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Team</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createTeamMutation.mutate(newTeam);
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="teamName">Team Name</Label>
                        <Input
                          id="teamName"
                          value={newTeam.name}
                          onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                          placeholder="e.g., Team Quantum"
                          required
                          data-testid="input-team-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamDesc">Description (optional)</Label>
                        <Input
                          id="teamDesc"
                          value={newTeam.description}
                          onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                          placeholder="Brief description"
                          data-testid="input-team-description"
                        />
                      </div>
                      <Button type="submit" disabled={createTeamMutation.isPending} className="w-full" data-testid="button-submit-team">
                        {createTeamMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                        ) : (
                          "Create Team"
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={participantDialogOpen} onOpenChange={setParticipantDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={!teams?.length} data-testid="button-add-participant">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Participant
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Participant</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createParticipantMutation.mutate(newParticipant);
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="participantName">Name</Label>
                        <Input
                          id="participantName"
                          value={newParticipant.name}
                          onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                          placeholder="Full name"
                          required
                          data-testid="input-participant-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="participantEmail">Email</Label>
                        <Input
                          id="participantEmail"
                          type="email"
                          value={newParticipant.email}
                          onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                          placeholder="email@example.com"
                          required
                          data-testid="input-participant-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="participantTeam">Team</Label>
                        <Select
                          value={newParticipant.teamId}
                          onValueChange={(value) => setNewParticipant({ ...newParticipant, teamId: value })}
                        >
                          <SelectTrigger data-testid="select-participant-team">
                            <SelectValue placeholder="Select a team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams?.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        disabled={createParticipantMutation.isPending || !newParticipant.teamId}
                        className="w-full"
                        data-testid="button-submit-participant"
                      >
                        {createParticipantMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
                        ) : (
                          "Add Participant"
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Link href="/scanner">
                  <Button variant="outline" className="animate-pulse-glow" data-testid="button-open-scanner">
                    <ScanLine className="w-4 h-4 mr-2" />
                    Open Scanner
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Teams Section */}
        {isAdmin && (
          <Card data-testid="card-teams">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold">Teams</CardTitle>
              <Badge variant="secondary">{teams?.length ?? 0} teams</Badge>
            </CardHeader>
            <CardContent>
              {teamsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : teams?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UsersRound className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No teams yet. Create your first team to get started!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {teams?.map((team) => (
                    <Card key={team.id} className="bg-card/50" data-testid={`card-team-${team.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h3 className="font-semibold" data-testid={`team-name-${team.id}`}>{team.name}</h3>
                            {team.description && (
                              <p className="text-sm text-muted-foreground">{team.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTeamMutation.mutate(team.id)}
                            disabled={deleteTeamMutation.isPending}
                            data-testid={`button-delete-team-${team.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Participants Section */}
        <Card data-testid="card-participants">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Participants</CardTitle>
            <Badge variant="secondary">{participants?.length ?? 0} participants</Badge>
          </CardHeader>
          <CardContent>
            {participantsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : participants?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No participants yet. {isAdmin ? "Add participants to get started!" : "Waiting for admin to add participants."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {participants?.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50"
                    data-testid={`participant-row-${participant.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {participant.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium" data-testid={`participant-name-${participant.id}`}>{participant.name}</p>
                        <p className="text-sm text-muted-foreground">{participant.email}</p>
                      </div>
                      <Badge variant="outline">{participant.team?.name || "No Team"}</Badge>
                      {participant.isCheckedIn ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                          Checked In
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadQrCode(participant.id, participant.name)}
                          data-testid={`button-download-qr-${participant.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          QR Code
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteParticipantMutation.mutate(participant.id)}
                          disabled={deleteParticipantMutation.isPending}
                          data-testid={`button-delete-participant-${participant.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Volunteers Section - Admin Only */}
        {isAdmin && (
          <Card data-testid="card-volunteers">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold">Volunteers</CardTitle>
              <Badge variant="secondary">{volunteers?.length ?? 0} volunteers</Badge>
            </CardHeader>
            <CardContent>
              {volunteersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : volunteers?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No volunteers yet. Volunteers can sign up on the signup page.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {volunteers?.map((volunteer) => (
                    <div
                      key={volunteer.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50"
                      data-testid={`volunteer-row-${volunteer.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-accent/20 text-accent">
                            {volunteer.firstName[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" data-testid={`volunteer-name-${volunteer.id}`}>
                            {volunteer.firstName} {volunteer.lastName || ""}
                          </p>
                          {volunteer.email && (
                            <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                          )}
                          {volunteer.organization && (
                            <p className="text-xs text-muted-foreground">{volunteer.organization}</p>
                          )}
                        </div>
                        {volunteer.isCheckedIn ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                            Checked In
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                        {volunteer.qrCodeHash ? (
                          <Badge variant="outline" className="text-primary border-primary/30">
                            QR Ready
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No QR
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!volunteer.qrCodeHash ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateVolunteerQrMutation.mutate(volunteer.id)}
                            disabled={generateVolunteerQrMutation.isPending}
                            data-testid={`button-generate-qr-${volunteer.id}`}
                          >
                            <QrCode className="w-4 h-4 mr-2" />
                            Generate QR
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadVolunteerQrCode(volunteer.id, volunteer.firstName)}
                            data-testid={`button-download-volunteer-qr-${volunteer.id}`}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            QR Code
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteVolunteerMutation.mutate(volunteer.id)}
                          disabled={deleteVolunteerMutation.isPending}
                          data-testid={`button-delete-volunteer-${volunteer.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon,
  loading,
  variant = "default",
  testId,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  loading?: boolean;
  variant?: "default" | "success" | "accent" | "muted";
  testId?: string;
}) {
  const variants = {
    default: "text-primary bg-primary/10",
    success: "text-green-500 bg-green-500/10",
    accent: "text-accent bg-accent/10",
    muted: "text-muted-foreground bg-muted",
  };

  return (
    <Card data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground" data-testid={`${testId}-title`}>{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold" data-testid={`${testId}-value`}>{value}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${variants[variant]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
