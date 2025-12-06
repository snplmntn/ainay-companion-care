import { ArrowLeft, FileText, CheckCircle, AlertCircle, Scale, RefreshCw, Handshake, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Terms() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: CheckCircle,
      title: "Acceptance of Terms",
      color: "from-emerald-500 to-teal-500",
      content:
        "By accessing or using AInay, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service. We may update these terms from time to time, and your continued use constitutes acceptance of any changes.",
    },
    {
      icon: Handshake,
      title: "Description of Service",
      color: "from-blue-500 to-cyan-500",
      content:
        "AInay is a medication management and reminder application designed to help users track their medications and receive timely reminders. The service includes features for patients and caregivers to manage health schedules, receive AI-powered assistance, and monitor medication adherence.",
    },
    {
      icon: AlertCircle,
      title: "Medical Disclaimer",
      color: "from-amber-500 to-orange-500",
      content:
        "AInay is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or medication. Never disregard professional medical advice or delay seeking it because of information provided by AInay.",
      isWarning: true,
    },
    {
      icon: Scale,
      title: "User Responsibilities",
      color: "from-violet-500 to-purple-500",
      content:
        "You are responsible for maintaining the confidentiality of your account, providing accurate medication information, using the service in compliance with applicable laws, and not using the service for any unlawful purpose. You must be at least 18 years old or have parental consent to use this service.",
    },
    {
      icon: RefreshCw,
      title: "Service Availability",
      color: "from-rose-500 to-pink-500",
      content:
        "While we strive to provide reliable service, we do not guarantee uninterrupted access to AInay. We reserve the right to modify, suspend, or discontinue any aspect of the service at any time. We are not liable for any loss or inconvenience caused by service interruptions.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header with AInay Branding */}
      <header className="relative overflow-hidden bg-gradient-to-br from-secondary via-teal to-emerald-500 text-white">
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
              className="flex items-center hover:opacity-90 transition-opacity bg-white rounded-full pl-1.5 pr-3 py-1.5 shadow-lg"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-teal flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-secondary text-sm">Inay</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Terms of Service
              </h1>
              <p className="text-white/80 text-base mt-1">
                Please read these terms carefully before using AInay
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 md:px-8 pb-12 pt-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Last Updated */}
          <div className="text-sm text-muted-foreground text-center">
            Last updated: December 2024
          </div>

          {/* Introduction Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-xl border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="w-6 h-6 text-secondary" />
              <h2 className="text-xl font-bold text-foreground">Welcome to AInay</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service ("Terms") govern your access to and use of 
              <span className="font-semibold text-secondary"> AInay's</span> medication management services, 
              including our website, mobile applications, and any related services (collectively, the "Service"). 
              We're committed to helping Filipino families manage their health with care and compassion.
            </p>
          </div>

          {/* Sections */}
          <div className="grid gap-4 md:gap-6">
            {sections.map((section, index) => (
              <div
                key={index}
                className={`rounded-3xl p-6 md:p-8 shadow-lg border transition-shadow hover:shadow-xl ${
                  section.isWarning 
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50' 
                    : 'bg-white dark:bg-slate-800 border-border/50'
                }`}
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg`}>
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className={`text-xl font-bold ${section.isWarning ? 'text-amber-800 dark:text-amber-200' : 'text-foreground'}`}>
                    {section.title}
                  </h2>
                </div>
                <p className={`leading-relaxed ml-2 ${section.isWarning ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Limitation of Liability */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Scale className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2 text-foreground">
                  Limitation of Liability
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  To the maximum extent permitted by law, AInay and its affiliates shall not be liable 
                  for any indirect, incidental, special, consequential, or punitive damages, including 
                  loss of health, data, or other intangible losses, resulting from your use of or 
                  inability to use the service.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="bg-gradient-to-br from-secondary/10 via-teal/10 to-emerald/10 rounded-3xl p-6 md:p-8 border border-secondary/20">
            <div className="text-center">
              <h3 className="font-bold text-xl mb-2">Questions About These Terms?</h3>
              <p className="text-muted-foreground mb-6">
                If you have any questions about these Terms of Service, please contact us.
              </p>
              <Button 
                variant="teal" 
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
