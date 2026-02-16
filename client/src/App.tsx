import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Scanner from "@/pages/scanner";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Attendance from "@/pages/attendance";
import Profile from "@/pages/profile";
import Badge from "@/pages/badge";
import VolunteerBadge from "@/pages/volunteer-badge";
import { Loader2 } from "lucide-react";

function Router() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="app-page min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/scanner" component={Login} />
          <Route path="/attendance" component={Login} />
          <Route path="/profile" component={Login} />
          <Route path="/badge/:id" component={Login} />
          <Route path="/volunteer-badge/:id" component={Login} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/login" component={Dashboard} />
          <Route path="/signup" component={Dashboard} />
          <Route path="/scanner" component={Scanner} />
          <Route path="/attendance" component={Attendance} />
          <Route path="/profile" component={Profile} />
          <Route path="/badge/:id" component={Badge} />
          <Route path="/volunteer-badge/:id" component={VolunteerBadge} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
