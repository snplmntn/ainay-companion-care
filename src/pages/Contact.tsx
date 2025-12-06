import { ArrowLeft, Mail, MessageSquare, Clock, MapPin, Send, Heart, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function Contact() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const contactInfo = [
    {
      icon: Mail,
      title: "Email Us",
      value: "2136seanpaul@gmail.com",
      description: "We'll respond within 24 hours",
      color: "from-primary to-coral",
      action: () => window.open("mailto:2136seanpaul@gmail.com", "_blank"),
    },
    {
      icon: Clock,
      title: "Response Time",
      value: "Within 24 hours",
      description: "Monday to Friday",
      color: "from-secondary to-teal",
    },
    {
      icon: MapPin,
      title: "Location",
      value: "Philippines",
      description: "Serving Filipino families worldwide",
      color: "from-amber-500 to-orange-500",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Create mailto link with form data
    const subject = encodeURIComponent(formData.subject || "AInay Contact Form");
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    );
    
    window.open(`mailto:2136seanpaul@gmail.com?subject=${subject}&body=${body}`, "_blank");

    toast({
      title: "Opening email client...",
      description: "Your message has been prepared. Please send it from your email app.",
    });

    setIsSubmitting(false);
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-amber-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header with AInay Branding */}
      <header className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
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
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-amber-600 text-sm">AInay</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Contact Us
              </h1>
              <p className="text-white/80 text-base mt-1">
                We'd love to hear from you
              </p>
            </div>
          </div>
        </div>
        <div className="h-8 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950" />
      </header>

      {/* Content */}
      <main className="px-4 md:px-8 pb-12 -mt-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Contact Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {contactInfo.map((info, index) => (
              <div
                key={index}
                className={`bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-border/50 hover:shadow-xl transition-all ${
                  info.action ? "cursor-pointer hover:border-primary/50 hover:-translate-y-1" : ""
                }`}
                onClick={info.action}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${info.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <info.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-1 text-foreground">{info.title}</h3>
                <p className="text-primary font-semibold">{info.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-xl border border-border/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-coral flex items-center justify-center shadow-lg">
                <Send className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Send us a Message</h2>
                <p className="text-sm text-muted-foreground">We'll get back to you as soon as possible</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    Name <span className="text-primary">*</span>
                  </label>
                  <Input
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="h-12 rounded-xl border-2 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    Email <span className="text-primary">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="h-12 rounded-xl border-2 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Subject</label>
                <Input
                  placeholder="What's this about?"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="h-12 rounded-xl border-2 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Message <span className="text-primary">*</span>
                </label>
                <Textarea
                  placeholder="Tell us how we can help..."
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="min-h-[150px] resize-none rounded-xl border-2 focus:border-primary"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Support Section */}
          <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-rose-500/10 rounded-3xl p-6 md:p-8 border border-amber-200/50 dark:border-amber-800/30">
            <div className="text-center">
              <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-bold text-xl mb-2">We're Here for You</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                At <span className="font-semibold text-primary">AInay</span>, we care about every Filipino family 
                managing their health. No question is too small — we're here to help!
              </p>
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
