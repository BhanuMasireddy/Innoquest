import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  QrCode,
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  LogOut,
  ScanLine,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import type { ScanLogWithParticipant, Participant } from "@shared/schema";

interface Stats {
  total: number;
  checkedIn: number;
  percentage: number;
}

export default function Dashboard() {
  const { user, logout, isLoggingOut } = useAuth();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: recentScans, isLoading: scansLoading, refetch: refetchScans } = useQuery<ScanLogWithParticipant[]>({
    queryKey: ["/api/scans/recent"],
  });

  const { data: participants, isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: ["/api/participants"],
  });

  const handleRefresh = () => {
    refetchStats();
    refetchScans();
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
              <Badge variant="outline" className="ml-2 hidden sm:flex">Admin</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/scanner">
                <Button variant="outline" size="sm" data-testid="link-scanner">
                  <ScanLine className="w-4 h-4 mr-2" />
                  Scanner
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium">
                  {user?.firstName || user?.email?.split("@")[0] || "User"}
                </span>
              </div>
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
              Welcome back, <span className="text-primary">{user?.firstName || "Admin"}</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening at your hackathon today.
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
          <StatsCard
            title="Pending"
            value={(stats?.total ?? 0) - (stats?.checkedIn ?? 0)}
            icon={<Clock className="w-5 h-5" />}
            loading={statsLoading}
            variant="muted"
            testId="stat-pending"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Scans */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Check-ins
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                Live
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {scansLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : recentScans && recentScans.length > 0 ? (
                recentScans.slice(0, 8).map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                    data-testid={`scan-item-${scan.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{scan.participant?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {scan.participant?.teamName}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString() : ""}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No check-ins yet</p>
                  <p className="text-sm">Start scanning to see activity here</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Participants List */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                All Participants
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {participants?.length ?? 0} total
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {participantsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : participants && participants.length > 0 ? (
                participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                    data-testid={`participant-item-${participant.id}`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={`${participant.isCheckedIn ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"}`}>
                        {participant.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{participant.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {participant.teamName} • {participant.email}
                      </p>
                    </div>
                    <Badge
                      variant={participant.isCheckedIn ? "default" : "secondary"}
                      className={participant.isCheckedIn ? "bg-green-500/20 text-green-500 border-green-500/30" : ""}
                    >
                      {participant.isCheckedIn ? "Checked In" : "Pending"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No participants yet</p>
                  <p className="text-sm">Add participants to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Link href="/scanner">
                <Button className="animate-pulse-glow" data-testid="button-open-scanner">
                  <ScanLine className="w-4 h-4 mr-2" />
                  Open Scanner
                </Button>
              </Link>
              <Button variant="outline" disabled data-testid="button-add-participant">
                <Users className="w-4 h-4 mr-2" />
                Add Participant
              </Button>
              <Button variant="outline" disabled data-testid="button-generate-qr">
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR Codes
              </Button>
            </div>
          </CardContent>
        </Card>
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
