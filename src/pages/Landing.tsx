import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Pill,
  Mic,
  Bell,
  Camera,
  Heart,
  Users,
  Sun,
  Shield,
  Play,
  ArrowRight,
  Check,
  Star,
  ChevronDown,
  Sparkles,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Stat card for the problem section
function StatCard({
  value,
  label,
  description,
  accent,
}: {
  value: string;
  label: string;
  description: string;
  accent: "coral" | "teal" | "amber" | "rose";
}) {
  const accentColors = {
    coral: "from-primary to-coral",
    teal: "from-secondary to-teal",
    amber: "from-amber-500 to-orange-400",
    rose: "from-pink-500 to-rose-500",
  };

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 rounded-3xl transition-opacity duration-300" />
      <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/50 hover:border-primary/30 transition-all duration-300 h-full">
        <div className={`text-5xl md:text-6xl lg:text-7xl font-black bg-gradient-to-r ${accentColors[accent]} bg-clip-text text-transparent mb-2`}>
          {value}
        </div>
        <div className="text-xl md:text-2xl font-bold text-foreground mb-2">{label}</div>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// Animated pill component for hero
function FloatingPill({ delay, className }: { delay: number; className?: string }) {
  return (
    <div
      className={`absolute ${className}`}
      style={{
        animation: `floatPill 6s ease-in-out ${delay}s infinite`,
      }}
    >
      <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 backdrop-blur-sm flex items-center justify-center shadow-lg">
        <Pill className="w-4 h-4 md:w-6 md:h-6 text-primary" />
      </div>
    </div>
  );
}

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}) {
  return (
    <div
      className="group relative bg-card rounded-3xl p-6 md:p-8 shadow-xl border border-border/50 hover:border-primary/30 transition-all duration-500 hover:-translate-y-2"
      style={{ animationDelay: `${delay}s` }}
    >
      <div
        className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl ${gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
      >
        <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
      </div>
      <h3 className="text-xl md:text-2xl font-bold mb-3 text-foreground">{title}</h3>
      <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// Testimonial card
function TestimonialCard({
  quote,
  name,
  role,
  avatar,
}: {
  quote: string;
  name: string;
  role: string;
  avatar: string;
}) {
  return (
    <div className="bg-card rounded-3xl p-6 md:p-8 shadow-xl border border-border/50 relative">
      <div className="absolute -top-3 -left-2 text-6xl text-primary/20 font-serif">"</div>
      <p className="text-lg md:text-xl text-foreground mb-6 relative z-10 leading-relaxed">
        {quote}
      </p>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl">
          {avatar}
        </div>
        <div>
          <p className="font-bold text-foreground text-lg">{name}</p>
          <p className="text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  );
}

// How it works step
function HowItWorksStep({
  step,
  title,
  description,
  icon: Icon,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary to-coral-light flex items-center justify-center shadow-xl">
          <Icon className="w-10 h-10 md:w-12 md:h-12 text-white" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-secondary text-white font-bold flex items-center justify-center text-sm shadow-lg">
          {step}
        </div>
      </div>
      <h3 className="text-xl md:text-2xl font-bold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-base md:text-lg max-w-xs">{description}</p>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Custom CSS for animations */}
      <style>{`
        @keyframes floatPill {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        .gradient-animate {
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
        }
        .bg-dots {
          background-image: radial-gradient(hsl(var(--primary) / 0.15) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .wave-divider {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          overflow: hidden;
          line-height: 0;
        }
        .wave-divider svg {
          position: relative;
          display: block;
          width: calc(100% + 1.3px);
          height: 80px;
        }
      `}</style>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/95 backdrop-blur-lg shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <img
                src="/logo.png"
                alt="AInay"
                className="h-10 md:h-12 w-auto"
              />
            </button>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="hidden md:flex text-base font-semibold"
                onClick={() => navigate("/login?mode=signin")}
              >
                Sign In
              </Button>
              <Button
                variant="coral"
                size="lg"
                className="text-base font-semibold rounded-full px-6"
                onClick={() => navigate("/login?mode=signup")}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-coral-light/40 via-background to-teal-light/30 gradient-animate" />
        <div className="absolute inset-0 bg-dots opacity-50" />
        
        {/* Floating pills decoration */}
        <FloatingPill delay={0} className="top-32 left-[10%] hidden md:block" />
        <FloatingPill delay={1} className="top-48 right-[15%] hidden md:block" />
        <FloatingPill delay={2} className="bottom-48 left-[20%] hidden md:block" />
        <FloatingPill delay={0.5} className="bottom-32 right-[10%] hidden md:block" />

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" style={{ animation: "pulse-soft 4s ease-in-out infinite" }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" style={{ animation: "pulse-soft 5s ease-in-out infinite 1s" }} />

        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-card/80 backdrop-blur-sm rounded-full px-4 py-2 mb-8 shadow-lg border border-border/50">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm md:text-base font-semibold text-foreground">
              AI-Powered Health Companion
            </span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight">
            <span className="text-foreground">Your Digital</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-coral to-secondary bg-clip-text text-transparent gradient-animate">
              Caretaker
            </span>
          </h1>

          <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Never miss your medicine again. AInay is your friendly AI companion 
            that helps you and your loved ones stay healthy, together.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              variant="coral"
              size="xl"
              className="text-lg font-bold rounded-full px-8 shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all group"
              onClick={() => navigate("/login?mode=signup")}
            >
              Start Free Today
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="xl"
              className="text-lg font-semibold rounded-full px-8 group"
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              See How It Works
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-secondary" />
              <span className="text-sm md:text-base font-medium">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" />
              <span className="text-sm md:text-base font-medium">10K+ Families</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-secondary" />
              <span className="text-sm md:text-base font-medium">4.9 Rating</span>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="wave-divider">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C74.22,95.8,165.28,70.89,321.39,56.44Z"
              className="fill-card"
            />
          </svg>
        </div>
      </section>

      {/* The Problem Section - Why We Built This */}
      <section className="relative py-20 md:py-32 bg-card overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="absolute top-0 left-0 w-1/3 h-1/2 bg-gradient-to-br from-rose-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-1/3 h-1/2 bg-gradient-to-tl from-primary/5 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-rose-500/10 rounded-full px-4 py-2 mb-6">
              <Heart className="w-4 h-4 text-rose-500" />
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">Why We Built AInay</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-foreground leading-tight">
              A Silent Crisis in <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-rose-500 to-primary bg-clip-text text-transparent">
                Filipino Healthcare
              </span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              The World Health Organization states that improving medication adherence would have a 
              <span className="font-semibold text-foreground"> greater impact on population health</span> than 
              any improvement in specific medical treatments. Yet in the Philippines, we're failing our elders.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <StatCard
              value="76%"
              label="Non-Adherent"
              description="A Cebu study found only 23.8% of hypertensive adults properly follow their medication regimen."
              accent="rose"
            />
            <StatCard
              value="27%"
              label="Forget Doses"
              description="Unintentional non-adherence—primarily from forgetfulness and confusion—affects over a quarter of Filipino seniors."
              accent="coral"
            />
            <StatCard
              value="37%"
              label="On 5+ Medicines"
              description="Polypharmacy affects nearly 4 in 10 Filipino seniors, increasing confusion and risk of harmful interactions."
              accent="amber"
            />
            <StatCard
              value="1.39×"
              label="Higher Risk"
              description="Polypharmacy increases cognitive impairment risk by 39% (OR=1.39), creating a vicious cycle of forgetfulness."
              accent="teal"
            />
          </div>

          {/* The Deeper Insight */}
          <div className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 rounded-3xl p-8 md:p-12 border border-border/50">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                  The Vicious Cycle We're Breaking
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed text-lg">
                  Filipino seniors face a perfect storm: <span className="text-foreground font-medium">complex medication schedules</span> exceed 
                  their cognitive capacity, leading to missed doses. This non-adherence worsens their conditions, 
                  often requiring <span className="text-foreground font-medium">even more medications</span>—further straining their memory.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-rose-500 font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">The "Treat or Eat" Dilemma</p>
                      <p className="text-sm text-muted-foreground">28.6% skip medications intentionally due to financial constraints</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-amber-500 font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Dosage Confusion</p>
                      <p className="text-sm text-muted-foreground">Elderly patients report high confusion about when and how much to take</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-secondary font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Caregiver Burden</p>
                      <p className="text-sm text-muted-foreground">OFW families struggle to monitor loved ones from thousands of miles away</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="bg-card rounded-2xl p-6 md:p-8 shadow-xl border border-border/50">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary mb-4">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-foreground">AInay's Mission</h4>
                  </div>
                  <blockquote className="text-lg text-muted-foreground italic text-center leading-relaxed">
                    "To ensure no Filipino senior suffers from preventable health decline simply because 
                    they forgot to take their medicine—or couldn't remember how."
                  </blockquote>
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>Smart Reminders</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-primary" />
                        <span>Voice Assistant</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span>Family Connect</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-2xl -z-10" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-coral/20 to-primary/20 rounded-full blur-2xl -z-10" />
              </div>
            </div>
          </div>

          {/* WHO Citation */}
          <div className="mt-8 text-center">
            <p className="text-xs md:text-sm text-muted-foreground/60">
              Data sourced from WHO Global Adherence Report, Cebu South Medical Center Study, 
              and research on Filipino senior polypharmacy prevalence
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-b from-card via-background to-background overflow-hidden">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Our Solution</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 text-foreground">
              Everything You Need to Stay Healthy
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Simple tools designed with love for seniors and their families
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <FeatureCard
              icon={Bell}
              title="Smart Reminders"
              description="Get gentle reminders at the right time. Never miss a dose, even with complex schedules."
              gradient="bg-gradient-to-br from-primary to-coral"
              delay={0}
            />
            <FeatureCard
              icon={Mic}
              title="Voice Assistant"
              description="Just talk to AInay! Ask questions about your medicines in your own words."
              gradient="bg-gradient-to-br from-secondary to-teal"
              delay={0.1}
            />
            <FeatureCard
              icon={Camera}
              title="Medicine Scanner"
              description="Snap a photo of any medicine. AInay will tell you what it is and how to take it."
              gradient="bg-gradient-to-br from-amber-500 to-orange-400"
              delay={0.2}
            />
            <FeatureCard
              icon={Sun}
              title="Morning Briefing"
              description="Wake up to a personalized audio summary of your day's medicines and weather."
              gradient="bg-gradient-to-br from-yellow-400 to-amber-500"
              delay={0.3}
            />
            <FeatureCard
              icon={Users}
              title="Family Dashboard"
              description="Caregivers can monitor and help manage medications for their loved ones remotely."
              gradient="bg-gradient-to-br from-violet-500 to-purple-500"
              delay={0.4}
            />
            <FeatureCard
              icon={Heart}
              title="Health Tracking"
              description="Track your adherence and earn rewards for staying on top of your health."
              gradient="bg-gradient-to-br from-pink-500 to-rose-500"
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative py-20 md:py-32 bg-card overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-dots opacity-30" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-secondary/10 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 text-foreground">
              Simple as 1-2-3
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              Getting started takes less than a minute
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            <HowItWorksStep
              step={1}
              icon={Pill}
              title="Add Your Medicines"
              description="Type, scan, or talk to add your medications. We'll handle the schedule."
            />
            <HowItWorksStep
              step={2}
              icon={Bell}
              title="Get Reminders"
              description="Receive gentle nudges through the app, voice, or Telegram."
            />
            <HowItWorksStep
              step={3}
              icon={Check}
              title="Stay Healthy"
              description="Mark your doses as taken and watch your health progress grow."
            />
          </div>

          {/* Connector lines (desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary via-secondary to-primary opacity-20" style={{ transform: "translateY(80px)" }} />
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 text-foreground">
              Loved by Families
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              Join thousands who trust AInay with their health
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <TestimonialCard
              quote="Finally, an app my Lola can use without my help! The voice feature is amazing."
              name="Maria Santos"
              role="Caregiver"
              avatar="👩"
            />
            <TestimonialCard
              quote="I used to forget my blood pressure medicine. Now AInay reminds me like a caring friend."
              name="Jose Reyes"
              role="Patient, 72"
              avatar="👴"
            />
            <TestimonialCard
              quote="Being overseas, I can finally help manage my dad's medications. Peace of mind!"
              name="Ana Cruz"
              role="OFW Daughter"
              avatar="👩‍💼"
            />
          </div>
        </div>
      </section>

      {/* For Patients & Caregivers Section */}
      <section className="py-20 md:py-32 bg-card">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* For Patients */}
            <div className="bg-gradient-to-br from-coral-light to-primary/10 rounded-3xl p-8 md:p-12 border border-primary/20">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                <Heart className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                For Patients
              </h3>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Take control of your health with an app that understands you. 
                Large buttons, clear reminders, and a friendly voice to guide you.
              </p>
              <ul className="space-y-3">
                {[
                  "Easy-to-read medication schedule",
                  "Voice commands for hands-free use",
                  "Photo scanning for medicine info",
                  "Gentle, non-intrusive reminders",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-base md:text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Caregivers */}
            <div className="bg-gradient-to-br from-teal-light to-secondary/10 rounded-3xl p-8 md:p-12 border border-secondary/20">
              <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                For Caregivers
              </h3>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Support your loved ones from anywhere. Get notifications, 
                manage schedules, and have peace of mind knowing they're cared for.
              </p>
              <ul className="space-y-3">
                {[
                  "Real-time medication tracking",
                  "Instant alerts when doses are missed",
                  "Add medications remotely",
                  "Multiple patient management",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-secondary" />
                    </div>
                    <span className="text-base md:text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-coral to-secondary opacity-90" />
        <div className="absolute inset-0 bg-dots opacity-10" />
        
        {/* Floating decorations */}
        <div className="absolute top-1/4 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        <div className="absolute bottom-1/4 right-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-6 text-white leading-tight">
            Start Your Health Journey Today
          </h2>
          <p className="text-lg md:text-2xl text-white/90 mb-10 max-w-2xl mx-auto">
            Join thousands of families who trust AInay to help them stay healthy. 
            It's free to start, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="xl"
              className="bg-white text-primary hover:bg-white/90 text-lg font-bold rounded-full px-10 shadow-2xl shadow-black/20 group"
              onClick={() => navigate("/login?mode=signup")}
            >
              Create Free Account
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="xl"
              className="border-2 border-white text-white hover:bg-white/10 text-lg font-semibold rounded-full px-10"
              onClick={() => navigate("/login?mode=demo")}
            >
              Try Demo Mode
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <img src="/logo.png" alt="AInay" className="h-10 w-auto" />
              <span className="text-muted-foreground">
                Your Digital Caretaker
              </span>
            </button>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 md:gap-6 text-muted-foreground">
              <a href="/privacy" className="hover:text-primary transition-colors">
                Privacy
              </a>
              <a href="/terms" className="hover:text-primary transition-colors">
                Terms
              </a>
              <a href="/contact" className="hover:text-primary transition-colors">
                Contact
              </a>
              <a href="/subscription/pricing" className="hover:text-primary transition-colors">
                Pricing
              </a>
              <a href="/references" className="hover:text-primary transition-colors">
                Data Sources
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-muted-foreground">
            <p>Made with ❤️ for Filipino families everywhere</p>
            <p className="mt-2 text-sm">© 2024 AInay. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Scroll to top indicator */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-8 right-8 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 hover:scale-110 ${
          scrolled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <ChevronDown className="w-6 h-6 rotate-180" />
      </button>
    </div>
  );
}

