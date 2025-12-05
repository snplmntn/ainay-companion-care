import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Users, User, ArrowRight, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const { setUserRole, setUserName, isAuthenticated } = useApp();

  // Get initial mode from URL parameter
  const getInitialMode = (): AuthMode => {
    const mode = searchParams.get("mode");
    if (mode === "signin") return "signin";
    if (mode === "signup") return "signup";
    return "welcome";
  };

  const [authMode, setAuthMode] = useState<AuthMode>(getInitialMode);
  const [signupStep, setSignupStep] = useState<SignupStep>("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"patient" | "companion" | null>(null);

  // Handle demo mode from URL
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "demo") {
      // Show welcome screen with demo options highlighted
      setAuthMode("welcome");
    }
  }, [searchParams]);

  // Note: Redirect is handled by App.tsx based on userRole
  // No useEffect redirect needed here - it causes loops when profile fetch fails

  const handleSignIn = async () => {
    if (isLoading) return;
    
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter your email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);

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
    } finally {
      setIsLoading(false);
    }
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
    if (isLoading) return;
    
    if (!name || !role) {
      toast({
        title: "Missing fields",
        description: "Please enter your name and select how you'll use AInay.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, name, role);

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
    } finally {
      setIsLoading(false);
    }
  };

  // Demo mode - skip auth
  const handleDemoMode = (selectedRole: "patient" | "companion") => {
    setUserRole(selectedRole);
    setUserName("Demo User");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Back to landing link */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

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
              Your helpful friend for taking your medicines on time!
            </p>

            <div className="w-full max-w-sm space-y-4">
              {isSupabaseConfigured ? (
                <>
                  <Button
                    variant="coral"
                    size="xl"
                    className="w-full text-lg"
                    onClick={() => setAuthMode("signin")}
                  >
                    <Mail className="w-6 h-6" />
                    I Have an Account
                  </Button>

                  <Button
                    variant="teal"
                    size="xl"
                    className="w-full text-lg"
                    onClick={() => setAuthMode("signup")}
                  >
                    <ArrowRight className="w-6 h-6" />
                    I'm New Here
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-base">
                      <span className="bg-background px-4 text-muted-foreground">
                        or just try it out
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
                  className="text-base py-6"
                  onClick={() => handleDemoMode("patient")}
                >
                  <User className="w-5 h-5 mr-2" />
                  I Take Medicine
                </Button>
                <Button
                  variant={isSupabaseConfigured ? "secondary" : "teal"}
                  size="lg"
                  className="text-base py-6"
                  onClick={() => handleDemoMode("companion")}
                >
                  <Users className="w-5 h-5 mr-2" />
                  I Help Someone
                </Button>
              </div>
            </div>
          </>
        )}

        {authMode === "signin" && (
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-senior-xl font-bold text-center mb-6">
              Welcome Back! 👋
            </h2>

            <div>
              <label className="text-base font-semibold text-muted-foreground mb-2 block">
                Your Email
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
              <label className="text-base font-semibold text-muted-foreground mb-2 block">
                Your Password
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2"
                >
                  {showPassword ? (
                    <EyeOff className="w-6 h-6" />
                  ) : (
                    <Eye className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>

            <Button
              variant="coral"
              size="xl"
              className="w-full text-lg"
              onClick={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? "Please wait..." : "Let Me In"}
            </Button>

            <p className="text-center text-base text-muted-foreground">
              New here?{" "}
              <button
                onClick={() => {
                  setAuthMode("signup");
                  setSignupStep("credentials");
                }}
                className="text-primary font-semibold hover:underline"
              >
                Create Account
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
              Let's Get Started! 🎉
            </h2>

            <div>
              <label className="text-base font-semibold text-muted-foreground mb-2 block">
                Your Email
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
              <label className="text-base font-semibold text-muted-foreground mb-2 block">
                Choose a Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 letters or numbers"
                  className="input-senior pl-12 pr-12"
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSignUpCredentials()
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2"
                >
                  {showPassword ? (
                    <EyeOff className="w-6 h-6" />
                  ) : (
                    <Eye className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>

            <Button
              variant="coral"
              size="xl"
              className="w-full text-lg"
              onClick={handleSignUpCredentials}
            >
              Next Step
              <ArrowRight className="w-6 h-6" />
            </Button>

            <p className="text-center text-base text-muted-foreground">
              Already signed up?{" "}
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
              Almost Done! 🎉
            </h2>
            <p className="text-base text-muted-foreground text-center mb-6">
              Just a little bit more about you
            </p>

            <div>
              <label className="text-base font-semibold text-muted-foreground mb-2 block">
                What's Your Name?
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Type your name here"
                className="input-senior text-lg"
              />
            </div>

            <div>
              <label className="text-base font-semibold text-muted-foreground mb-3 block">
                What Brings You Here?
              </label>
              <div className="space-y-3">
                <button
                  onClick={() => setRole("patient")}
                  className={`w-full p-5 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    role === "patient"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center ${
                      role === "patient"
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <User className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">I take medicines</p>
                    <p className="text-base text-muted-foreground">
                      Help me remember my medicines
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setRole("companion")}
                  className={`w-full p-5 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    role === "companion"
                      ? "border-teal bg-teal/10"
                      : "border-border hover:border-teal/50"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center ${
                      role === "companion"
                        ? "bg-teal text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">I help someone</p>
                    <p className="text-base text-muted-foreground">
                      I care for a family member or friend
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <Button
              variant="coral"
              size="xl"
              className="w-full text-lg"
              onClick={handleSignUp}
              disabled={isLoading || !name || !role}
            >
              {isLoading ? "Setting up..." : "All Done! Let's Go"}
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
              { icon: "💊", label: "Never Forget Your Medicine" },
              { icon: "🎤", label: "Just Talk to Me" },
              { icon: "📋", label: "Track Your Health" },
            ].map((feature, i) => (
              <div
                key={i}
                className="text-center fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="text-4xl mb-2">{feature.icon}</div>
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
        <p className="text-base text-muted-foreground">
          Made with ❤️ to help you feel better
        </p>
      </div>
    </div>
  );
}
