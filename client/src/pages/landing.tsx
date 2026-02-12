import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Users, Zap, Shield, BarChart3, Clock } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-primary">INNOQUEST</span> #4
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/login"
                data-testid="link-login"
              >
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </a>
              <a
                href="/signup"
                data-testid="button-get-started"
              >
                <Button size="sm">
                  Get Started
                </Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
                  <Zap className="w-4 h-4" />
                  Lightning-fast check-ins
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
                  <span className="neon-text">Hackathon</span>
                  <br />
                  <span className="text-foreground">Attendance</span>
                  <br />
                  <span className="neon-text-blue">Reimagined</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg">
                  Scan QR codes, track participants in real-time, and manage your hackathon with a stunning cyberpunk interface.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <a href="/signup" data-testid="button-hero-cta">
                  <Button size="lg" className="animate-pulse-glow">
                    <QrCode className="w-5 h-5 mr-2" />
                    Start Scanning
                  </Button>
                </a>
                <a href="/login" data-testid="button-view-demo">
                  <Button variant="outline" size="lg">
                    Sign In
                  </Button>
                </a>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary" />
                  Free forever
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary" />
                  Setup in 2 mins
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative">
              <div className="relative bg-card rounded-lg border border-border p-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                
                {/* Mock Scanner UI */}
                <div className="relative space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium">Scanner Active</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">LIVE</span>
                  </div>
                  
                  <div className="aspect-square bg-muted/30 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
                    <QrCode className="w-24 h-24 text-primary/40" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-green-500">Alex Chen</p>
                        <p className="text-xs text-muted-foreground">Team Quantum</p>
                      </div>
                    </div>
                    <span className="text-xs text-green-500 font-mono">CHECKED IN</span>
                  </div>
                </div>
              </div>
              
              {/* Floating Stats */}
              <div className="absolute -bottom-4 -left-4 bg-card rounded-lg border border-border p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">247</p>
                    <p className="text-xs text-muted-foreground">Checked In</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need for
              <span className="text-primary"> seamless check-ins</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for hackathon organizers who want speed, reliability, and style.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<QrCode className="w-8 h-8" />}
              title="Instant QR Scanning"
              description="Lightning-fast camera scanning with audio feedback and beautiful success animations."
            />
            <FeatureCard
              icon={<BarChart3 className="w-8 h-8" />}
              title="Real-time Analytics"
              description="Live dashboard showing check-in stats, team distribution, and attendance trends."
            />
            <FeatureCard
              icon={<Users className="w-8 h-8" />}
              title="Team Management"
              description="Organize participants by team, track group check-ins, and manage roles."
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8" />}
              title="Volunteer Mode"
              description="Simple scanner interface for volunteers with minimal training required."
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Duplicate Detection"
              description="Automatically prevents double check-ins with clear error messaging."
            />
            <FeatureCard
              icon={<Clock className="w-8 h-8" />}
              title="Scan History"
              description="Complete log of all scans with timestamps and volunteer attribution."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5">
            <CardContent className="py-16 px-8 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold">
                Ready to revolutionize your check-in?
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Department of CSE, Anurag University.
              </p>
              <a href="/signup" data-testid="button-cta-bottom">
                <Button size="lg" className="animate-pulse-glow mt-4">
                  <QrCode className="w-5 h-5 mr-2" />
                  Get Started Free
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <span className="font-semibold">INNOQUEST #4</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Department of CSE, Anurag University
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  const testId = `card-feature-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <Card className="group hover-elevate border-border/50 bg-card/50 backdrop-blur-sm" data-testid={testId}>
      <CardContent className="p-6 space-y-4">
        <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
          {icon}
        </div>
        <h3 className="text-xl font-semibold" data-testid={`${testId}-title`}>{title}</h3>
        <p className="text-muted-foreground" data-testid={`${testId}-description`}>{description}</p>
      </CardContent>
    </Card>
  );
}
