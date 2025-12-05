import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, ArrowLeft, HelpCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  // Subtle parallax effect for the background pills
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  };

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Animated background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating pill shapes */}
        <div
          className="absolute w-24 h-12 rounded-full bg-coral-light/40 blur-sm"
          style={{
            top: "15%",
            left: "10%",
            transform: `translate(${(mousePosition.x - 50) * 0.1}px, ${(mousePosition.y - 50) * 0.1}px)`,
            transition: "transform 0.3s ease-out",
          }}
        />
        <div
          className="absolute w-16 h-8 rounded-full bg-teal-light/50 blur-sm"
          style={{
            top: "25%",
            right: "15%",
            transform: `translate(${(mousePosition.x - 50) * -0.15}px, ${(mousePosition.y - 50) * 0.12}px) rotate(45deg)`,
            transition: "transform 0.3s ease-out",
          }}
        />
        <div
          className="absolute w-20 h-10 rounded-full bg-primary/10 blur-sm"
          style={{
            bottom: "20%",
            left: "20%",
            transform: `translate(${(mousePosition.x - 50) * 0.08}px, ${(mousePosition.y - 50) * -0.1}px) rotate(-30deg)`,
            transition: "transform 0.3s ease-out",
          }}
        />
        <div
          className="absolute w-14 h-7 rounded-full bg-secondary/15 blur-sm"
          style={{
            bottom: "30%",
            right: "10%",
            transform: `translate(${(mousePosition.x - 50) * -0.12}px, ${(mousePosition.y - 50) * 0.08}px) rotate(60deg)`,
            transition: "transform 0.3s ease-out",
          }}
        />

        {/* Gradient orbs */}
        <div
          className="absolute w-96 h-96 rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)",
            top: "-10%",
            right: "-10%",
          }}
        />
        <div
          className="absolute w-80 h-80 rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--secondary) / 0.25) 0%, transparent 70%)",
            bottom: "-5%",
            left: "-5%",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-md mx-auto">
        {/* Animated 404 display */}
        <div className="relative mb-8">
          <div className="flex items-center justify-center gap-2">
            <span
              className="text-8xl md:text-9xl font-extrabold text-primary/20 select-none fade-in"
              style={{ animationDelay: "0s" }}
            >
              4
            </span>
            <div
              className="relative fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              {/* Pill as the 0 */}
              <div className="w-20 h-28 md:w-24 md:h-32 rounded-full gradient-coral shadow-lg shadow-primary/30 flex items-center justify-center">
                <span className="text-4xl">💊</span>
              </div>
              {/* Animated ring */}
              <div className="absolute inset-0 rounded-full border-4 border-primary/30 pulse-ring" />
            </div>
            <span
              className="text-8xl md:text-9xl font-extrabold text-primary/20 select-none fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              4
            </span>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4 mb-10">
          <h1
            className="text-senior-2xl text-foreground fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            Oops! We can't find that page
          </h1>
          <p
            className="text-senior-lg text-muted-foreground fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            Don't worry! Let me help you get back. The page you're looking for isn't here.
          </p>
          <p
            className="text-sm text-muted-foreground/70 font-mono bg-muted/50 px-4 py-2 rounded-xl inline-block fade-in"
            style={{ animationDelay: "0.45s" }}
          >
            {location.pathname}
          </p>
        </div>

        {/* Action buttons */}
        <div
          className="flex flex-col sm:flex-row gap-4 justify-center fade-in"
          style={{ animationDelay: "0.5s" }}
        >
          <Button
            variant="coral"
            size="xl"
            onClick={() => navigate("/dashboard")}
            className="gap-2 text-lg"
          >
            <Home className="w-6 h-6" />
            Go Home
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate(-1)}
            className="gap-2 text-lg"
          >
            <ArrowLeft className="w-6 h-6" />
            Go Back
          </Button>
        </div>

        {/* Helpful links */}
        <div
          className="mt-12 pt-8 border-t border-border/50 fade-in"
          style={{ animationDelay: "0.6s" }}
        >
          <p className="text-base text-muted-foreground mb-4">
            Need help finding something?
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <button
              onClick={() => navigate("/ask")}
              className="flex items-center gap-2 text-base text-primary hover:text-primary/80 transition-colors font-semibold"
            >
              <MessageCircle className="w-5 h-5" />
              Talk to AInay
            </button>
            <button
              onClick={() => navigate("/timeline")}
              className="flex items-center gap-2 text-base text-secondary hover:text-secondary/80 transition-colors font-semibold"
            >
              <HelpCircle className="w-5 h-5" />
              My Medicines
            </button>
          </div>
        </div>
      </div>

      {/* Footer branding */}
      <div
        className="absolute bottom-6 left-0 right-0 text-center fade-in"
        style={{ animationDelay: "0.7s" }}
      >
        <p className="text-base text-muted-foreground">
          AInay — Here to Help You! 💚
        </p>
      </div>
    </div>
  );
};

export default NotFound;
