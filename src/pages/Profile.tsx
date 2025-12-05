import React, { useState } from "react";
import {
  ArrowLeft,
  User,
  Bell,
  HelpCircle,
  LogOut,
  Heart,
  Shield,
  Globe,
  Link as LinkIcon,
  Copy,
  Users,
  ChevronRight,
  X,
  UserPlus,
  CreditCard,
} from "lucide-react";
// Note: UserPlus kept for "Link to Patient" button
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";
import {
  SubscriptionCard,
  SubscriptionBadge,
} from "@/modules/subscription/components/SubscriptionCard";

export default function Profile() {
  const navigate = useNavigate();
  const {
    userName,
    userRole,
    profile,
    signOut,
    medications,
    linkCode,
    linkedCompanions,
    linkedPatients,
    requestLinkToPatient,
    unlinkPatientOrCompanion,
  } = useApp();

  const [showLinkCodeModal, setShowLinkCodeModal] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [linkCodeInput, setLinkCodeInput] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const copyLinkCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(linkCode);
      toast({
        title: "Copied!",
        description:
          "Link code copied to clipboard. Share it with your caregivers.",
      });
    }
  };

  const handleLinkPatient = async () => {
    if (!linkCodeInput.trim()) {
      toast({
        title: "Enter link code",
        description: "Please enter the patient's link code.",
        variant: "destructive",
      });
      return;
    }

    if (linkCodeInput.trim().length !== 6) {
      toast({
        title: "Invalid code",
        description: "Link code must be 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLinking(true);
    const result = await requestLinkToPatient(linkCodeInput.trim());
    setIsLinking(false);

    if (result.success) {
      toast({
        title: "Successfully linked! 🎉",
        description: `You are now linked with ${result.patientName}. You can view their medications.`,
      });
      setLinkCodeInput("");
      setShowAddPatientModal(false);
    } else {
      // Check if it's an "already linked" message (not a real error)
      const isAlreadyLinked = result.error?.toLowerCase().includes("already linked");
      
      if (isAlreadyLinked && result.patientName) {
        toast({
          title: "Already connected",
          description: result.error,
        });
        setLinkCodeInput("");
        setShowAddPatientModal(false);
      } else {
        toast({
          title: "Unable to link",
          description: result.error || "Could not link to patient. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleUnlink = async (linkId: string, name: string) => {
    await unlinkPatientOrCompanion(linkId);
    toast({
      title: "Unlinked",
      description: `${name} has been removed.`,
    });
  };

  const menuItems = [
    { icon: User, label: "Personal Info", action: () => {} },
    {
      icon: CreditCard,
      label: "Subscription & Billing",
      action: () => navigate("/subscription/pricing"),
    },
    { icon: Bell, label: "Notifications", action: () => {} },
    { icon: Globe, label: "Language", action: () => {} },
    { icon: Shield, label: "Privacy", action: () => {} },
    { icon: HelpCircle, label: "Help & Support", action: () => {} },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="gradient-coral text-white p-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-senior-xl font-bold">Profile</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-10 h-10" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-senior-2xl">{userName || "User"}</h2>
              <SubscriptionBadge />
            </div>
            {profile?.email && (
              <p className="text-white/70 text-sm">{profile.email}</p>
            )}
            <p className="text-white/80 capitalize">{userRole || "Guest"}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4 -mt-4">
        {/* Subscription Card */}
        <SubscriptionCard />

        {/* Stats Card */}
        <div className="card-senior">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 text-primary" />
            <h3 className="text-senior-lg font-semibold">Health Stats</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-senior-xl font-bold text-primary">7</p>
              <p className="text-sm text-muted-foreground">Day Streak</p>
            </div>
            <div>
              <p className="text-senior-xl font-bold text-secondary">
                {medications.length > 0
                  ? Math.round(
                      (medications.filter((m) => m.taken).length /
                        medications.length) *
                        100
                    )
                  : 0}
                %
              </p>
              <p className="text-sm text-muted-foreground">Adherence</p>
            </div>
            <div>
              <p className="text-senior-xl font-bold text-primary">
                {medications.length}
              </p>
              <p className="text-sm text-muted-foreground">Active Meds</p>
            </div>
          </div>
        </div>

        {/* Link Code Card (for Patients) */}
        {(userRole === "patient" || !userRole) && linkCode && (
          <div className="card-senior bg-teal-light border border-teal/30">
            <div className="flex items-center gap-3 mb-3">
              <LinkIcon className="w-6 h-6 text-teal" />
              <h3 className="text-senior-lg font-semibold">Your Link Code</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Share this code with caregivers so they can monitor your
              medications.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white rounded-xl px-4 py-3 font-mono text-2xl tracking-wider text-center font-bold border border-border">
                {linkCode}
              </div>
              <Button variant="secondary" size="icon-lg" onClick={copyLinkCode}>
                <Copy className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        {/* Note: Pending Link Requests removed - links are now auto-accepted */}

        {/* Linked Companions (for Patients) */}
        {linkedCompanions.length > 0 && (
          <div className="card-senior">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-secondary" />
              <h3 className="text-senior-lg font-semibold">Your Caregivers</h3>
            </div>
            <div className="space-y-2">
              {linkedCompanions.map((companion) => (
                <div
                  key={companion.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-white font-bold">
                      {companion.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{companion.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {companion.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleUnlink(companion.linkId, companion.name)
                    }
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Companion Features (for Companions) */}
        {userRole === "companion" && (
          <>
            {/* Link to Patient Button */}
            <Button
              variant="teal"
              size="lg"
              className="w-full"
              onClick={() => setShowAddPatientModal(true)}
            >
              <UserPlus className="w-6 h-6 mr-2" />
              Link to a Patient
            </Button>

            {/* Linked Patients */}
            {linkedPatients.length > 0 && (
              <div className="card-senior">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-primary" />
                  <h3 className="text-senior-lg font-semibold">
                    Your Patients
                  </h3>
                </div>
                <div className="space-y-2">
                  {linkedPatients
                    .filter((p) => p.linkStatus === "accepted")
                    .map((patient) => (
                      <div
                        key={patient.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold">{patient.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {patient.adherenceRate}% adherence today
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    ))}
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full mt-4"
                  onClick={() => navigate("/companion")}
                >
                  View Full Dashboard
                </Button>
              </div>
            )}
          </>
        )}

        {/* Menu Items */}
        <div className="card-senior p-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted transition-colors"
            >
              <item.icon className="w-6 h-6 text-muted-foreground" />
              <span className="text-senior-base flex-1 text-left">
                {item.label}
              </span>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          size="lg"
          className="w-full text-destructive border-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-6 h-6" />
          Log Out
        </Button>
      </main>

      {/* Add Patient Modal (for Companions) */}
      {showAddPatientModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-senior-xl font-bold">Link to Patient</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddPatientModal(false)}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <p className="text-muted-foreground mb-6">
              Enter the patient's 6-character link code. They can find it in
              their Profile settings. You'll be linked immediately.
            </p>

            <Input
              value={linkCodeInput}
              onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="input-senior text-center font-mono text-2xl tracking-wider mb-6"
              maxLength={6}
            />

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => setShowAddPatientModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="coral"
                size="lg"
                className="flex-1"
                onClick={handleLinkPatient}
                disabled={isLinking || linkCodeInput.length < 6}
              >
                {isLinking ? "Linking..." : "Link Now"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <Navigation />
    </div>
  );
}
