import { ArrowLeft, Shield, Eye, Lock, Database, UserCheck, Bell, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      color: "from-blue-500 to-cyan-500",
      content: [
        "Account information (name, email) when you register",
        "Medication schedules and health data you input",
        "Usage data to improve our services",
        "Device information for push notifications",
      ],
    },
    {
      icon: Lock,
      title: "How We Protect Your Data",
      color: "from-emerald-500 to-teal-500",
      content: [
        "All data is encrypted in transit and at rest",
        "We use industry-standard security practices",
        "Access to your data is strictly controlled",
        "Regular security audits and updates",
      ],
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      color: "from-violet-500 to-purple-500",
      content: [
        "To provide medication reminders and tracking",
        "To enable caregiver monitoring features",
        "To improve and personalize our services",
        "To send important service notifications",
      ],
    },
    {
      icon: UserCheck,
      title: "Your Rights",
      color: "from-amber-500 to-orange-500",
      content: [
        "Access and download your personal data",
        "Request correction of inaccurate data",
        "Delete your account and associated data",
        "Opt-out of non-essential communications",
      ],
    },
    {
      icon: Bell,
      title: "Third-Party Services",
      color: "from-rose-500 to-pink-500",
      content: [
        "We use Supabase for secure data storage",
        "OpenAI for AI-powered features (anonymized)",
        "We do not sell your personal information",
        "Third parties are bound by strict data agreements",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-coral-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header with AInay Branding */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-coral to-rose-500 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity bg-white rounded-full pl-1.5 pr-3 py-1.5 shadow-lg"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-coral flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-primary text-sm">AInay</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-white/80 text-base mt-1">
                Your health data deserves the highest protection
              </p>
            </div>
          </div>
        </div>
        <div className="h-8 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950" />
      </header>

      {/* Content */}
      <main className="px-4 md:px-8 pb-12 -mt-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Last Updated */}
          <div className="text-sm text-muted-foreground text-center">
            Last updated: December 2024
          </div>

          {/* Introduction Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-xl border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Our Commitment to You</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              At <span className="font-semibold text-primary">AInay</span>, we believe that your health data is deeply personal. 
              As your digital caretaker, we are committed to protecting your privacy and ensuring that your 
              information is handled with the utmost care and security. This policy explains what data we 
              collect, how we use it, and your rights regarding your information.
            </p>
          </div>

          {/* Sections */}
          <div className="grid gap-4 md:gap-6">
            {sections.map((section, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-lg border border-border/50 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg`}>
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
                </div>
                <ul className="space-y-3 ml-2">
                  {section.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-gradient-to-br from-primary to-coral mt-2 flex-shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact Section */}
          <div className="bg-gradient-to-br from-primary/10 via-coral/10 to-secondary/10 rounded-3xl p-6 md:p-8 border border-primary/20">
            <div className="text-center">
              <h3 className="font-bold text-xl mb-2">Questions About Privacy?</h3>
              <p className="text-muted-foreground mb-6">
                If you have any questions about this Privacy Policy or how we handle your data, 
                please don't hesitate to reach out.
              </p>
              <Button 
                variant="coral" 
                size="lg"
                className="rounded-full px-8"
                onClick={() => navigate("/contact")}
              >
                Contact Us
              </Button>
            </div>
          </div>

          {/* Back Button */}
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
