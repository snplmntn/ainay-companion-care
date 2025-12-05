import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, User, ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/contexts/AppContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { signIn, signUp } from "@/services/supabase";
import { toast } from "@/hooks/use-toast";

type AuthMode = "welcome" | "signin" | "signup";
type SignupStep = "credentials" | "profile";

export default function Login() {
  const navigate = useNavigate();
  const { setUserRole, setUserName, isAuthenticated } = useApp();

  const [authMode, setAuthMode] = useState<AuthMode>("welcome");
  const [signupStep, setSignupStep] = useState<SignupStep>("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"patient" | "companion" | null>(null);

  // Note: Redirect is handled by App.tsx based on userRole
  // No useEffect redirect needed here - it causes loops when profile fetch fails

  const handleSignIn = async () => {
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter your email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: "Sign in failed",
        description: error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Welcome back!",
      description: "You have signed in successfully.",
    });
    navigate("/dashboard", { replace: true });
  };

  const handleSignUpCredentials = () => {
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter your email and password.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setSignupStep("profile");
  };

  const handleSignUp = async () => {
    if (!name || !role) {
      toast({
        title: "Missing fields",
        description: "Please enter your name and select how you'll use AInay.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, name, role);
    setIsLoading(false);

    if (error) {
      toast({
        title: "Sign up failed",
        description: error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Account created!",
      description: "Welcome to AInay. Check your email to verify your account.",
    });
    navigate("/dashboard", { replace: true });
  };

  // Demo mode - skip auth
  const handleDemoMode = (selectedRole: "patient" | "companion") => {
    setUserRole(selectedRole);
    setUserName("Demo User");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="AInay - Your Digital Caretaker"
          className="h-32 w-auto mb-8 drop-shadow-lg"
        />

        {authMode === "welcome" && (
          <>
            <p className="text-senior-lg text-muted-foreground text-center mb-12 max-w-sm">
              Your digital caretaker — caring for you every step of the way.
            </p>

            <div className="w-full max-w-sm space-y-4">
              {isSupabaseConfigured ? (
                <>
                  <Button
                    variant="coral"
                    size="xl"
                    className="w-full"
                    onClick={() => setAuthMode("signin")}
                  >
                    <Mail className="w-6 h-6" />
                    Sign In
                  </Button>

                  <Button
                    variant="teal"
                    size="xl"
                    className="w-full"
                    onClick={() => setAuthMode("signup")}
                  >
                    <ArrowRight className="w-6 h-6" />
                    Create Account
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-background px-4 text-muted-foreground">
                        or try without account
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground mb-4">
                  Choose how you'll use AInay
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={isSupabaseConfigured ? "secondary" : "coral"}
                  size="lg"
                  onClick={() => handleDemoMode("patient")}
                >
                  <User className="w-5 h-5 mr-2" />
                  Patient
                </Button>
                <Button
                  variant={isSupabaseConfigured ? "secondary" : "teal"}
                  size="lg"
                  onClick={() => handleDemoMode("companion")}
                >
                  <Users className="w-5 h-5 mr-2" />
                  Caregiver
                </Button>
              </div>
            </div>
          </>
        )}

        {authMode === "signin" && (
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-senior-xl font-bold text-center mb-6">
              Welcome Back
            </h2>

            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-senior pl-12"
                />
              </div>
            </div>

            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-senior pl-12 pr-12"
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              variant="coral"
              size="xl"
              className="w-full"
              onClick={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-center text-muted-foreground">
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setAuthMode("signup");
                  setSignupStep("credentials");
                }}
                className="text-primary font-semibold hover:underline"
              >
                Sign Up
              </button>
            </p>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setAuthMode("welcome")}
            >
              Back
            </Button>
          </div>
        )}

        {authMode === "signup" && signupStep === "credentials" && (
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-senior-xl font-bold text-center mb-6">
              Create Account
            </h2>

            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-senior pl-12"
                />
              </div>
            </div>

            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="input-senior pl-12 pr-12"
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSignUpCredentials()
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              variant="coral"
              size="xl"
              className="w-full"
              onClick={handleSignUpCredentials}
            >
              Continue
              <ArrowRight className="w-6 h-6" />
            </Button>

            <p className="text-center text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => setAuthMode("signin")}
                className="text-primary font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setAuthMode("welcome")}
            >
              Back
            </Button>
          </div>
        )}

        {authMode === "signup" && signupStep === "profile" && (
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-senior-xl font-bold text-center mb-2">
              Almost there!
            </h2>
            <p className="text-muted-foreground text-center mb-6">
              Tell us a bit about yourself
            </p>

            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Your Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="input-senior"
              />
            </div>

            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-3 block">
                How will you use AInay?
              </label>
              <div className="space-y-3">
                <button
                  onClick={() => setRole("patient")}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    role === "patient"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      role === "patient"
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <User className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">I'm managing my health</p>
                    <p className="text-sm text-muted-foreground">
                      Track my medications and health
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setRole("companion")}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    role === "companion"
                      ? "border-teal bg-teal/10"
                      : "border-border hover:border-teal/50"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      role === "companion"
                        ? "bg-teal text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">I'm a caregiver/companion</p>
                    <p className="text-sm text-muted-foreground">
                      Help someone manage their health
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <Button
              variant="coral"
              size="xl"
              className="w-full"
              onClick={handleSignUp}
              disabled={isLoading || !name || !role}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setSignupStep("credentials")}
            >
              Back
            </Button>
          </div>
        )}

        {/* Features preview - only on welcome */}
        {authMode === "welcome" && (
          <div className="mt-12 grid grid-cols-3 gap-4 w-full max-w-sm">
            {[
              { icon: "💊", label: "Medicine Reminders" },
              { icon: "🎤", label: "Voice Assistant" },
              { icon: "📋", label: "Health Tracking" },
            ].map((feature, i) => (
              <div
                key={i}
                className="text-center fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="text-3xl mb-2">{feature.icon}</div>
                <p className="text-sm text-muted-foreground font-medium">
                  {feature.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Made with ❤️ for better health
        </p>
      </div>
    </div>
  );
}
