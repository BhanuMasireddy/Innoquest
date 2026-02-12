import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Search,
  Printer,
  BarChart3,
  Beaker,
  Upload,
  Pencil,
  ShieldCheck, // Add this
  FileDown,    // Add this (for Export)
  Utensils,
} from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ParticipantWithTeamAndLab, Team } from "@shared/schema";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface Stats {
  total: number;
  checkedIn: number;
  percentage: number;
  teamCount: number;
}

interface Lab {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

type MealType = "BREAKFAST" | "LUNCH" | "SNACKS" | "DINNER";

interface SystemModeConfig {
  mode: "ATTENDANCE" | "MEAL";
  selectedMealType: MealType | null;
  allowedLabIds: string[];
}

interface MealAnalytics {
  mealType: MealType;
  total: number;
  taken: number;
  remaining: number;
}



export default function Dashboard() {
  const { user, logout, isLoggingOut, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingParticipant, setEditingParticipant] = useState<ParticipantWithTeamAndLab | null>(null);
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "", teamId: "", labId: "" });
  const [participantSearch, setParticipantSearch] = useState("");
  const [volunteerSearch, setVolunteerSearch] = useState("");
  const [mealModeEnabled, setMealModeEnabled] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("BREAKFAST");
  const [allowedMealLabIds, setAllowedMealLabIds] = useState<string[]>([]);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: labs, isLoading: labsLoading } = useQuery<Lab[]>({
    queryKey: ["/api/labs"],
  });

  const { data: modeConfig } = useQuery<SystemModeConfig>({
    queryKey: ["/api/system/mode"],
    enabled: isAdmin,
  });

  const { data: mealAnalytics } = useQuery<MealAnalytics>({
    queryKey: ["/api/meals/analytics", selectedMealType],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/meals/analytics?mealType=${selectedMealType}`);
      return response.json();
    },
    enabled: isAdmin && mealModeEnabled,
  });

  const { data: teams, isLoading: teamsLoading, refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: participants, isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithTeamAndLab[]>({
    queryKey: ["/api/participants"],
  });

  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [newLab, setNewLab] = useState({
    name: "",
    description: "",
  });
  const [uploading, setUploading] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    teamId: "",
    labId: "",
  });
  const [volunteerEditData, setVolunteerEditData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    organization: "",
  });

  const {
    data: teamParticipants,
    isLoading: teamParticipantsLoading,
  } = useQuery({
    queryKey: ["/api/teams", selectedTeam?.id, "participants"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/teams/${selectedTeam!.id}/participants`
      );
      return res.json();
    },
    enabled: !!selectedTeam,
  });



  const {
    data: labTeams,
    isLoading: labTeamsLoading,
  } = useQuery<Team[]>({
    queryKey: ["/api/labs", selectedLab?.id, "teams"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/labs/${selectedLab!.id}/teams`
      );
      return res.json();
    },
    enabled: !!selectedLab,
  });

  useEffect(() => {
    if (!modeConfig) return;
    setMealModeEnabled(modeConfig.mode === "MEAL");
    setSelectedMealType((modeConfig.selectedMealType as MealType | null) ?? "BREAKFAST");
    setAllowedMealLabIds(modeConfig.allowedLabIds ?? []);
  }, [modeConfig]);



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

  // 2. Add the update mutation near your other mutations
  const updateParticipantMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; email: string; teamId: string; labId: string }) => {
      const response = await apiRequest("PATCH", `/api/participants/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Participant updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      setEditingParticipant(null);
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
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
      setNewParticipant({ name: "", email: "", teamId: "", labId: ""});
    },
    onError: (error: any) => {
      toast({ title: "Failed to add participant", description: error.message, variant: "destructive" });
    },
  });

  const createLabMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/labs", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Lab created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/labs"] });
      setLabDialogOpen(false);
      setNewLab({ name: "", description: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create lab",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMealModeMutation = useMutation({
    mutationFn: async () => {
      const payload =
        mealModeEnabled
          ? {
              mode: "MEAL" as const,
              selectedMealType,
              allowedLabIds: allowedMealLabIds,
            }
          : {
              mode: "ATTENDANCE" as const,
            };
      const response = await apiRequest("PUT", "/api/system/mode", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mode settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/system/mode"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meals/analytics"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save mode settings", description: error.message, variant: "destructive" });
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

  const resetParticipantMealsMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const response = await apiRequest("POST", `/api/participants/${participantId}/meals/reset`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Participant meal consumption reset" });
      queryClient.invalidateQueries({ queryKey: ["/api/meals/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to reset meals", description: error.message, variant: "destructive" });
    },
  });

  const deleteLabMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/labs/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Lab deleted successfully" });
      // This refreshes the UI list immediately
      queryClient.invalidateQueries({ queryKey: ["/api/labs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] }); // In case participants are linked to labs
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] }); // Update any stats that might be affected
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete lab", 
        description: error.message, 
        variant: "destructive" 
      });
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

  const updateVolunteerMutation = useMutation({
    mutationFn: async (
      data: { id: string; firstName: string; lastName?: string; email: string; organization?: string }
    ) => {
      const response = await apiRequest("PATCH", `/api/volunteers/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Volunteer updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
      setEditingVolunteer(null);
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleDownloadQRs = () => {
    window.location.href = "/api/participants/export-qrs";
  };

  const handleDownloadVolunteerQRs = () => {
    window.location.href = "/api/volunteers/export-qrs";
  };


  const handleRefresh = () => {
    refetchStats();
    refetchTeams();
    refetchParticipants();
    if (isAdmin) refetchVolunteers();
  };

  const toggleAllowedLab = (labId: string, checked: boolean) => {
    setAllowedMealLabIds((prev) =>
      checked ? Array.from(new Set([...prev, labId])) : prev.filter((id) => id !== labId)
    );
  };

  // Filtered lists
  const filteredParticipants = useMemo(() => {
    if (!participants) return [];
    if (!participantSearch.trim()) return participants;
    const search = participantSearch.toLowerCase();
    return participants.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.email.toLowerCase().includes(search) ||
      p.team?.name?.toLowerCase().includes(search)
    );
  }, [participants, participantSearch]);

  const filteredVolunteers = useMemo(() => {
    if (!volunteers) return [];
    if (!volunteerSearch.trim()) return volunteers;
    const search = volunteerSearch.toLowerCase();
    return volunteers.filter(v => 
      v.firstName.toLowerCase().includes(search) ||
      (v.lastName?.toLowerCase().includes(search)) ||
      (v.email?.toLowerCase().includes(search)) ||
      (v.organization?.toLowerCase().includes(search))
    );
  }, [volunteers, volunteerSearch]);

  // Chart data
  const pieChartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Checked In", value: stats.checkedIn, color: "#22c55e" },
      { name: "Pending", value: stats.total - stats.checkedIn, color: "#6b7280" },
    ];
  }, [stats]);

  const teamChartData = useMemo(() => {
    if (!participants || !teams) return [];
    const teamStats = teams.map(team => {
      const teamParticipants = participants.filter(p => p.teamId === team.id);
      const checkedIn = teamParticipants.filter(p => p.isCheckedIn).length;
      return {
        name: team.name.length > 12 ? team.name.substring(0, 12) + "..." : team.name,
        total: teamParticipants.length,
        checkedIn,
      };
    }).filter(t => t.total > 0);
    return teamStats;
  }, [participants, teams]);

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

  const handleVolunteerQrAction = async (volunteer: Volunteer) => {
    try {
      if (!volunteer.qrCodeHash) {
        await generateVolunteerQrMutation.mutateAsync(volunteer.id);
      }
      await downloadVolunteerQrCode(volunteer.id, volunteer.firstName);
    } catch {
      // Mutation/toast handlers already notify the user
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic client-side validation
    if (!file.name.endsWith(".xlsx")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx) file",
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/participants/bulk-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to upload file");
      }

      const result = await res.json();
      
      toast({
        title: "Upload Successful",
        description: `Imported: ${result.created} | Skipped: ${result.skipped} | Failed: ${result.failed}`,
      });

      // Refresh data to show new participants
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: error.message,
      });
    } finally {
      setUploading(false);
      // Reset input so the same file can be uploaded again if needed
      e.target.value = "";
    }
  };
  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
  <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-14 sm:h-16">

      {/* LEFT SIDE */}
      <div className="flex items-center gap-2 min-w-0">

        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
          <QrCode className="w-5 h-5 text-primary" />
        </div>

        <span className="text-lg sm:text-xl font-semibold truncate">
          <span className="text-primary">INNOQUEST</span> #4
        </span>

        <Badge
          variant="outline"
          className="hidden sm:inline-flex ml-2"
        >
          {isAdmin ? "Admin" : "Volunteer"}
        </Badge>

      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">

        <ThemeToggle />

        {/* Attendance */}
        <Link href="/attendance">
          <Button
            variant="ghost"
            size="icon"
            className="sm:w-auto sm:px-3"
          >
            <ClipboardList className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Attendance</span>
          </Button>
        </Link>

        {/* Scanner */}
        <Link href="/scanner">
          <Button
            variant="outline"
            size="icon"
            className="sm:w-auto sm:px-3"
          >
            <ScanLine className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Scanner</span>
          </Button>
        </Link>

        {/* Profile */}
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <UserCircle className="w-5 h-5" />
          </Button>
        </Link>

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
              Department of CSE, Anurag University. {isAdmin ? "Manage teams, participants, and track attendance." : "Track attendance at your event."}
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

        {isAdmin && (
          <Card data-testid="card-meal-mode" className="border-t-4 border-t-amber-500">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Utensils className="w-5 h-5 text-amber-500" />
                Meal Mode Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">System Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Switch between normal attendance and meal validation scanning.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Attendance</span>
                  <Switch checked={mealModeEnabled} onCheckedChange={setMealModeEnabled} />
                  <span className="text-sm font-medium">Meal</span>
                </div>
              </div>

              {mealModeEnabled && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label>Select Meal Type</Label>
                    <Select value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as MealType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BREAKFAST">Breakfast</SelectItem>
                        <SelectItem value="LUNCH">Lunch</SelectItem>
                        <SelectItem value="SNACKS">Snacks</SelectItem>
                        <SelectItem value="DINNER">Dinner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Allowed Labs</Label>
                    <div className="rounded-md border p-3 space-y-2 max-h-44 overflow-y-auto">
                      {labs?.map((lab) => (
                        <div key={lab.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={allowedMealLabIds.includes(lab.id)}
                            onCheckedChange={(checked) => toggleAllowedLab(lab.id, Boolean(checked))}
                            id={`meal-lab-${lab.id}`}
                          />
                          <Label htmlFor={`meal-lab-${lab.id}`} className="cursor-pointer font-normal">
                            {lab.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => saveMealModeMutation.mutate()}
                  disabled={saveMealModeMutation.isPending || (mealModeEnabled && allowedMealLabIds.length === 0)}
                >
                  {saveMealModeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Mode Settings
                </Button>
              </div>

              {mealModeEnabled && mealAnalytics && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Participants</p>
                      <p className="text-2xl font-bold">{mealAnalytics.total}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Taken</p>
                      <p className="text-2xl font-bold text-green-500">{mealAnalytics.taken}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="text-2xl font-bold text-amber-500">{mealAnalytics.remaining}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin Actions */}
      {isAdmin && (
      <Card data-testid="card-admin-actions" className="border-t-4 border-t-purple-500">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-500" />
            Admin Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* 1. Create Team */}
            <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-team" className="bg-purple-600 hover:bg-purple-700">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamDesc">Description (optional)</Label>
                    <Input
                      id="teamDesc"
                      value={newTeam.description}
                      onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                      placeholder="Brief description"
                    />
                  </div>
                  <Button type="submit" disabled={createTeamMutation.isPending} className="w-full">
                    {createTeamMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Create Team"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* 2. Bulk Upload */}
            <input
              type="file"
              id="bulk-upload-input"
              className="hidden"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button 
              variant="outline" 
              disabled={uploading} 
              className="cursor-pointer border-emerald-500/20 hover:bg-emerald-500/10"
              asChild
            >
              <label htmlFor="bulk-upload-input">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4 text-emerald-500" />}
                {uploading ? "Processing..." : "Bulk Upload"}
              </label>
            </Button>

            {/* 3. Add Lab */}
            <Dialog open={labDialogOpen} onOpenChange={setLabDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-purple-500/20 hover:bg-purple-500/10">
                  <Beaker className="w-4 h-4 mr-2 text-purple-500" />
                  Add Lab
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Lab</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createLabMutation.mutate(newLab);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="labName">Lab Name</Label>
                    <Input
                      id="labName"
                      value={newLab.name}
                      onChange={(e) => setNewLab({ ...newLab, name: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-purple-600" disabled={createLabMutation.isPending}>
                    {createLabMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : "Create Lab"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* 4. Add Participant */}
            <Dialog open={participantDialogOpen} onOpenChange={setParticipantDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  disabled={!teams?.length || !labs?.length} 
                  className="border-blue-500/20 hover:bg-blue-500/10" 
                  data-testid="button-add-participant"
                >
                  <Plus className="w-4 h-4 mr-2 text-blue-500" />
                  Add Participant
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Participant</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createParticipantMutation.mutate(newParticipant);
                  }}
                  className="space-y-4 pt-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="participantName">Full Name</Label>
                    <Input
                      id="participantName"
                      value={newParticipant.name}
                      onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="participantEmail">Email Address</Label>
                    <Input
                      id="participantEmail"
                      type="email"
                      value={newParticipant.email}
                      onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Assign Team</Label>
                      <Select
                        value={newParticipant.teamId}
                        onValueChange={(value) => setNewParticipant({ ...newParticipant, teamId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams?.map((team) => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Assign Lab</Label>
                      <Select
                        value={newParticipant.labId}
                        onValueChange={(value) => setNewParticipant({ ...newParticipant, labId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Lab" />
                        </SelectTrigger>
                        <SelectContent>
                          {labs?.map((lab) => (
                            <SelectItem key={lab.id} value={lab.id.toString()}>
                              {lab.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={createParticipantMutation.isPending || !newParticipant.teamId || !newParticipant.labId}
                    className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
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


            {/* 6. Batch QR PDFs (Goal 3) */}
            <Button 
              variant="outline" 
              className="border-pink-500/20 hover:bg-pink-500/10"
              onClick={handleDownloadQRs} // 👈 Link the function
            >
              <QrCode className="w-4 h-4 mr-2 text-pink-500" />
              Batch QR PDFs
            </Button>

            {/* 7. Open Scanner */}
            <Link href="/scanner">
              <Button variant="outline" className="animate-pulse-glow border-indigo-500/20 hover:bg-indigo-500/10">
                <ScanLine className="w-4 h-4 mr-2 text-indigo-500" />
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
                    <Card
                      key={team.id}
                      data-testid={`card-team-${team.id}`}
                      className={`bg-card/50 cursor-pointer transition
                        ${selectedTeam?.id === team.id
                          ? "border-primary"
                          : "hover:border-primary/50"}
                      `}
                      onClick={() => setSelectedTeam(team)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{team.name}</h3>
                            {team.description && (
                              <p className="text-sm text-muted-foreground">
                                {team.description}
                              </p>
                            )}
                          </div>

                          {/* Delete button – stop bubbling */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Team?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete{" "}
                                  <strong>{team.name}</strong>? All participants in this
                                  team will also be deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTeamMutation.mutate(team.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <Dialog open={!!selectedTeam} onOpenChange={() => setSelectedTeam(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Participants — {selectedTeam?.name}
              </DialogTitle>
            </DialogHeader>

            {teamParticipantsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : teamParticipants?.length ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {teamParticipants.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 rounded border"
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.email}</p>
                    </div>
                    <Badge variant={p.isCheckedIn ? "default" : "secondary"}>
                      {p.isCheckedIn ? "Checked In" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No participants in this team.
              </p>
            )}
          </DialogContent>
        </Dialog>



        {/* Analytics Section */}
        {isAdmin && stats && stats.total > 0 && (
          <Card data-testid="card-analytics">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pie Chart - Check-in Status */}
                <div className="flex flex-col items-center">
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">Check-in Status</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm">Checked In</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span className="text-sm">Pending</span>
                    </div>
                  </div>
                </div>

                {/* Bar Chart - Team Participation */}
                {teamChartData.length > 0 && (
                  <div className="flex flex-col items-center">
                    <h4 className="text-sm font-medium text-muted-foreground mb-4">Team Participation</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={teamChartData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#6b7280" name="Total" />
                        <Bar dataKey="checkedIn" fill="#22c55e" name="Checked In" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Participants Section */}
        <Card data-testid="card-participants">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold">Participants</CardTitle>
              <Badge variant="secondary">{filteredParticipants.length} / {participants?.length ?? 0}</Badge>
            </div>
            {participants && participants.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search participants by name, email, or team..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-participants"
                />
              </div>
            )}
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
            ) : filteredParticipants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No participants match your search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50"
                    data-testid={`participant-row-${participant.id}`}
                  >
                    <div className="flex items-center gap-4 flex-wrap">
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
                        <Link href={`/badge/${participant.id}`}>
                          <Button variant="outline" size="icon" data-testid={`button-print-badge-${participant.id}`}>
                            <Printer className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="icon"
                          className="hover:text-blue-500"
                          onClick={() => {
                            setEditingParticipant(participant);
                            setEditData({
                              name: participant.name,
                              email: participant.email,
                              teamId: participant.teamId,
                              labId: participant.labId,
                            });
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        {/* EDIT DIALOG */}
                        <Dialog
                          open={!!editingParticipant}
                          onOpenChange={(open) => !open && setEditingParticipant(null)}
                        >
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Participant</DialogTitle>
                            </DialogHeader>

                            {editingParticipant && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();

                                  console.log("EDIT DATA:", editData);

                                  updateParticipantMutation.mutate({
                                    id: editingParticipant.id,
                                    name: editData.name,
                                    email: editData.email,
                                    teamId: editData.teamId,
                                    labId: editData.labId,
                                  });
                                }}
                                className="space-y-4 pt-4"
                              >
                                {/* NAME */}
                                <div className="space-y-2">
                                  <Label>Full Name</Label>
                                  <Input
                                    value={editData.name}
                                    onChange={(e) =>
                                      setEditData({ ...editData, name: e.target.value })
                                    }
                                    required
                                  />
                                </div>

                                {/* EMAIL */}
                                <div className="space-y-2">
                                  <Label>Email Address</Label>
                                  <Input
                                    type="email"
                                    value={editData.email}
                                    onChange={(e) =>
                                      setEditData({ ...editData, email: e.target.value })
                                    }
                                    required
                                  />
                                </div>

                                {/* TEAM & LAB */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Team</Label>
                                    <Select
                                      value={editData.teamId}
                                      onValueChange={(value) =>
                                        setEditData({ ...editData, teamId: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select Team" />
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

                                  <div className="space-y-2">
                                    <Label>Lab</Label>
                                    <Select
                                      value={editData.labId}
                                      onValueChange={(value) =>
                                        setEditData({ ...editData, labId: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select Lab" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {labs?.map((lab) => (
                                          <SelectItem key={lab.id} value={lab.id}>
                                            {lab.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* SAVE */}
                                <Button
                                  type="submit"
                                  className="w-full bg-blue-600"
                                  disabled={updateParticipantMutation.isPending}
                                >
                                  {updateParticipantMutation.isPending ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    "Save Changes"
                                  )}
                                </Button>
                              </form>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadQrCode(participant.id, participant.name)}
                          data-testid={`button-download-qr-${participant.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          QR
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetParticipantMealsMutation.mutate(participant.id)}
                          disabled={resetParticipantMealsMutation.isPending}
                          data-testid={`button-reset-meals-${participant.id}`}
                        >
                          <Utensils className="w-4 h-4 mr-2" />
                          Reset Meals
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-participant-${participant.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Participant?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{participant.name}</strong>? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteParticipantMutation.mutate(participant.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Labs Section */}
        {isAdmin && (
          <Card data-testid="card-labs">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold">Labs</CardTitle>
              <Badge variant="secondary">{labs?.length ?? 0} labs</Badge>
            </CardHeader>

            <CardContent>
              {labsLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : labs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Beaker className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No Labs available.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {labs?.map((lab) => (
                    <Card
                      key={lab.id}
                      className={`bg-card/50 cursor-pointer transition
                        ${
                          selectedLab?.id === lab.id
                            ? "border-primary"
                            : "hover:border-primary/50"
                        }
                      `}
                      onClick={() => setSelectedLab(lab)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{lab.name}</h3>
                          {lab.description && (
                            <p className="text-sm text-muted-foreground">
                              {lab.description}
                            </p>
                          )}
                        </div>

                        {/* Delete Lab – stop click bubbling */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Lab?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure? This will remove the lab from the database.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteLabMutation.mutate(lab.id)}
                                className="bg-destructive"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <Dialog open={!!selectedLab} onOpenChange={() => setSelectedLab(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Teams — {selectedLab?.name}
              </DialogTitle>
            </DialogHeader>

            {labTeamsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : labTeams?.length ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {labTeams.map((team) => (
                  <div
                    key={team.id}
                    className="p-3 rounded border cursor-pointer hover:bg-muted"
                    onClick={() => {
                      setSelectedTeam(team);
                      setSelectedLab(null);
                    }}
                  >
                    <p className="font-medium">{team.name}</p>
                    {team.description && (
                      <p className="text-sm text-muted-foreground">
                        {team.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No teams found in this lab.
              </p>
            )}
          </DialogContent>
        </Dialog>


        {/* Volunteers Section - Admin Only */}
        {isAdmin && (
          <Card data-testid="card-volunteers">
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-lg font-semibold">Volunteers</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-sky-500/20 hover:bg-sky-500/10"
                    onClick={handleDownloadVolunteerQRs}
                  >
                    <FileDown className="w-4 h-4 mr-2 text-sky-500" />
                    Batch QR PDFs
                  </Button>
                  <Badge variant="secondary">{filteredVolunteers.length} / {volunteers?.length ?? 0}</Badge>
                </div>
              </div>
              {volunteers && volunteers.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search volunteers by name, email, or organization..."
                    value={volunteerSearch}
                    onChange={(e) => setVolunteerSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-volunteers"
                  />
                </div>
              )}
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
              ) : filteredVolunteers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No volunteers match your search.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredVolunteers.map((volunteer) => (
                    <div
                      key={volunteer.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50"
                      data-testid={`volunteer-row-${volunteer.id}`}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
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
                        <Link href={`/volunteer-badge/${volunteer.id}`}>
                          <Button variant="outline" size="icon" data-testid={`button-print-volunteer-badge-${volunteer.id}`}>
                            <Printer className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="icon"
                          className="hover:text-blue-500"
                          onClick={() => {
                            setEditingVolunteer(volunteer);
                            setVolunteerEditData({
                              firstName: volunteer.firstName || "",
                              lastName: volunteer.lastName || "",
                              email: volunteer.email || "",
                              organization: volunteer.organization || "",
                            });
                          }}
                          data-testid={`button-edit-volunteer-${volunteer.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVolunteerQrAction(volunteer)}
                          disabled={generateVolunteerQrMutation.isPending}
                          data-testid={`button-download-volunteer-qr-${volunteer.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          QR
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-volunteer-${volunteer.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Volunteer?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{volunteer.firstName} {volunteer.lastName || ""}</strong>? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteVolunteerMutation.mutate(volunteer.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!editingVolunteer} onOpenChange={(open) => !open && setEditingVolunteer(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Volunteer</DialogTitle>
            </DialogHeader>
            {editingVolunteer && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateVolunteerMutation.mutate({
                    id: editingVolunteer.id,
                    firstName: volunteerEditData.firstName,
                    lastName: volunteerEditData.lastName,
                    email: volunteerEditData.email,
                    organization: volunteerEditData.organization,
                  });
                }}
                className="space-y-4 pt-4"
              >
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={volunteerEditData.firstName}
                    onChange={(e) =>
                      setVolunteerEditData({ ...volunteerEditData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={volunteerEditData.lastName}
                    onChange={(e) =>
                      setVolunteerEditData({ ...volunteerEditData, lastName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={volunteerEditData.email}
                    onChange={(e) =>
                      setVolunteerEditData({ ...volunteerEditData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    value={volunteerEditData.organization}
                    onChange={(e) =>
                      setVolunteerEditData({ ...volunteerEditData, organization: e.target.value })
                    }
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600" disabled={updateVolunteerMutation.isPending}>
                  {updateVolunteerMutation.isPending ? <Loader2 className="animate-spin" /> : "Save Changes"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
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
    <Card data-testid={testId}  className="w-full">
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
