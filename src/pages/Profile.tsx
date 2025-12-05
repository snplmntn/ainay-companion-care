import React, { useState } from "react";
import {
  ArrowLeft,
  User,
  Bell,
  LogOut,
  Link as LinkIcon,
  Copy,
  Users,
  ChevronRight,
  X,
  UserPlus,
  CreditCard,
  Mail,
  Clock,
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    updateNotificationSettings,
  } = useApp();

  const [showLinkCodeModal, setShowLinkCodeModal] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [linkCodeInput, setLinkCodeInput] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Notification settings state
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(
    profile?.email_reminder_enabled ?? true
  );
  const [emailReminderMinutes, setEmailReminderMinutes] = useState(
    String(profile?.email_reminder_minutes ?? 5)
  );

  // Sync with profile when it changes
  React.useEffect(() => {
    if (profile) {
      setEmailReminderEnabled(profile.email_reminder_enabled ?? true);
      setEmailReminderMinutes(String(profile.email_reminder_minutes ?? 5));
    }
  }, [profile]);

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
      const isAlreadyLinked = result.error
        ?.toLowerCase()
        .includes("already linked");

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
          description:
            result.error || "Could not link to patient. Please try again.",
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
    {
      icon: Bell,
      label: "Notifications",
      action: () => setShowNotificationSettings(true),
    },
  ];

  const handleSaveNotificationSettings = async () => {
    setIsSavingNotifications(true);
    const { error } = await updateNotificationSettings({
      email_reminder_enabled: emailReminderEnabled,
      email_reminder_minutes: parseInt(emailReminderMinutes),
    });
    setIsSavingNotifications(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save notification settings. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated.",
      });
      setShowNotificationSettings(false);
    }
  };

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

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-senior-xl font-bold">
                Notification Settings
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotificationSettings(false)}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Email Reminders Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal/20 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-teal" />
                  </div>
                  <div>
                    <p className="font-semibold">Email Reminders</p>
                    <p className="text-sm text-muted-foreground">
                      Receive email before medication time
                    </p>
                  </div>
                </div>
                <Switch
                  checked={emailReminderEnabled}
                  onCheckedChange={setEmailReminderEnabled}
                />
              </div>

              {/* Reminder Time Selection */}
              {emailReminderEnabled && (
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Reminder Time</p>
                      <p className="text-sm text-muted-foreground">
                        How early to receive the reminder
                      </p>
                    </div>
                  </div>
                  <Select
                    value={emailReminderMinutes}
                    onValueChange={setEmailReminderMinutes}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes before</SelectItem>
                      <SelectItem value="10">10 minutes before</SelectItem>
                      <SelectItem value="15">15 minutes before</SelectItem>
                      <SelectItem value="30">30 minutes before</SelectItem>
                      <SelectItem value="60">1 hour before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => setShowNotificationSettings(false)}
              >
                Cancel
              </Button>
              <Button
                variant="coral"
                size="lg"
                className="flex-1"
                onClick={handleSaveNotificationSettings}
                disabled={isSavingNotifications}
              >
                {isSavingNotifications ? "Saving..." : "Save Settings"}
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
