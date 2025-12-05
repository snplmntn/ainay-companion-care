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
  Trophy,
  Swords,
  Loader2,
  Pencil,
  Smartphone,
  Send,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HealthMonsterWidget, useGamification } from "@/modules/gamification";
import { usePushNotifications } from "@/modules/companion/hooks/usePushNotifications";
import {
  getTelegramStatus,
  generateTelegramLinkCode,
  checkTelegramLinked,
  unlinkTelegram,
  sendTestTelegramNotification,
} from "@/modules/companion/services/telegramService";

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
    updateProfileName,
  } = useApp();

  const [showLinkCodeModal, setShowLinkCodeModal] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [linkCodeInput, setLinkCodeInput] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [activeTab, setActiveTab] = useState<"account" | "progress">("account");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unlinkingIds, setUnlinkingIds] = useState<Set<string>>(new Set());

  // Use gamification hook for stats
  const {
    stats: gamificationStats,
    isLoading: gamificationLoading,
    todayCompleted,
    todayTotal,
    isPerfectToday,
  } = useGamification();

  // Calculate today's adherence percentage
  const todayAdherence =
    todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  // Notification settings state
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(
    profile?.email_reminder_enabled ?? true
  );
  const [emailReminderMinutes, setEmailReminderMinutes] = useState(
    String(profile?.email_reminder_minutes ?? 5)
  );

  // Push notification hook
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    toggle: togglePush,
  } = usePushNotifications(profile?.id ?? null);

  // Telegram state
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);
  const [telegramLinkCode, setTelegramLinkCode] = useState<string | null>(null);
  const [telegramDeepLink, setTelegramDeepLink] = useState<string | null>(null);
  const [telegramCodeExpires, setTelegramCodeExpires] = useState<Date | null>(null);
  const [telegramGenerating, setTelegramGenerating] = useState(false);
  const [telegramUnlinking, setTelegramUnlinking] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);

  // Sync with profile when it changes
  React.useEffect(() => {
    if (profile) {
      setEmailReminderEnabled(profile.email_reminder_enabled ?? true);
      setEmailReminderMinutes(String(profile.email_reminder_minutes ?? 5));
    }
  }, [profile]);

  // Load Telegram status
  React.useEffect(() => {
    const loadTelegramStatus = async () => {
      if (!profile?.id) return;
      
      setTelegramLoading(true);
      try {
        const status = await getTelegramStatus();
        setTelegramConfigured(status.configured);
        setTelegramBotUsername(status.telegram?.botUsername || null);

        if (status.configured) {
          const linkStatus = await checkTelegramLinked(profile.id);
          setTelegramLinked(linkStatus.linked);
          setTelegramUsername(linkStatus.username || null);
        }
      } catch (error) {
        console.error('Failed to load Telegram status:', error);
      } finally {
        setTelegramLoading(false);
      }
    };

    loadTelegramStatus();
  }, [profile?.id]);

  // Telegram handlers
  const handleGenerateTelegramCode = async () => {
    if (!profile?.id) return;
    
    setTelegramGenerating(true);
    try {
      const result = await generateTelegramLinkCode(profile.id);
      if (result.success && result.code) {
        setTelegramLinkCode(result.code);
        setTelegramDeepLink(result.deepLink || null);
        setTelegramCodeExpires(result.expiresAt ? new Date(result.expiresAt) : null);
        toast({
          title: 'Link code generated!',
          description: `Code: ${result.code} (expires in 10 minutes)`,
        });
      } else {
        toast({
          title: 'Failed to generate code',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate link code.',
        variant: 'destructive',
      });
    } finally {
      setTelegramGenerating(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!profile?.id) return;
    
    setTelegramUnlinking(true);
    try {
      const result = await unlinkTelegram(profile.id);
      if (result.success) {
        setTelegramLinked(false);
        setTelegramUsername(null);
        setTelegramLinkCode(null);
        toast({
          title: 'Telegram unlinked',
          description: "You won't receive Telegram notifications anymore.",
        });
      } else {
        toast({
          title: 'Failed to unlink',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to unlink Telegram.',
        variant: 'destructive',
      });
    } finally {
      setTelegramUnlinking(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!profile?.id) return;
    
    setTelegramTesting(true);
    try {
      const result = await sendTestTelegramNotification(profile.id);
      if (result.success) {
        toast({
          title: 'Test sent!',
          description: 'Check your Telegram for the test notification.',
        });
      } else {
        toast({
          title: 'Test failed',
          description: result.error || 'Please check your Telegram link.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send test notification.',
        variant: 'destructive',
      });
    } finally {
      setTelegramTesting(false);
    }
  };

  const handleRefreshTelegramStatus = async () => {
    if (!profile?.id) return;
    
    try {
      const linkStatus = await checkTelegramLinked(profile.id);
      if (linkStatus.linked) {
        setTelegramLinked(true);
        setTelegramUsername(linkStatus.username || null);
        setTelegramLinkCode(null);
        toast({
          title: 'Telegram linked!',
          description: 'You will now receive notifications on Telegram.',
        });
      } else {
        toast({
          title: 'Not linked yet',
          description: 'Please send the code to our Telegram bot first.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error checking status',
        variant: 'destructive',
      });
    }
  };

  const handleTogglePush = async () => {
    const success = await togglePush();
    if (success) {
      toast({
        title: pushSubscribed ? 'Push notifications disabled' : 'Push notifications enabled!',
        description: pushSubscribed ? undefined : "You'll receive alerts on this device.",
      });
    }
  };

  const isTelegramCodeExpired = telegramCodeExpires && new Date() > telegramCodeExpires;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const copyLinkCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(linkCode);
      toast({
        title: "Copied!",
        description:
          "Link code copied to clipboard. Share it with your companions.",
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
    if (unlinkingIds.has(linkId)) return;
    
    setUnlinkingIds((prev) => new Set(prev).add(linkId));
    try {
      await unlinkPatientOrCompanion(linkId);
      toast({
        title: "Unlinked",
        description: `${name} has been removed.`,
      });
    } finally {
      setUnlinkingIds((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  };

  const handleOpenPersonalInfo = () => {
    setEditName(userName || "");
    setShowPersonalInfo(true);
  };

  const handleSavePersonalInfo = async () => {
    if (!editName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingName(true);
    const { error } = await updateProfileName(editName.trim());
    setIsSavingName(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update name. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your name has been updated successfully.",
      });
      setShowPersonalInfo(false);
    }
  };

  const menuItems = [
    { icon: User, label: "My Info", action: handleOpenPersonalInfo },
    {
      icon: CreditCard,
      label: "My Plan",
      action: () => navigate("/subscription/pricing"),
    },
    {
      icon: Bell,
      label: "Reminders",
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
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:ml-20 xl:ml-24">
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
          <h1 className="text-senior-xl font-bold">My Account</h1>
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

      {/* Tab Navigation */}
      <div className="px-4 -mt-2">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "account" | "progress")}
        >
          <TabsList className="w-full grid grid-cols-2 bg-muted/80 backdrop-blur">
            <TabsTrigger value="account" className="flex items-center gap-2 text-base">
              <User className="w-5 h-5" />
              My Details
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2 text-base">
              <Trophy className="w-5 h-5" />
              How I'm Doing
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <main className="p-4 space-y-4">
        {activeTab === "progress" ? (
          // Progress Tab - Gamification
          <div className="space-y-4">
            {/* Loading State */}
            {gamificationLoading ? (
              <div className="card-senior text-center py-12">
                <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-3" />
                <p className="text-muted-foreground">
                  Loading your progress...
                </p>
              </div>
            ) : medications.length > 0 ? (
              <>
                {/* Health Monster Battle */}
                <HealthMonsterWidget
                  totalMeds={todayTotal}
                  completedMeds={todayCompleted}
                  streak={gamificationStats.currentStreak}
                />

                {/* Quick Stats */}
                <div className="card-senior">
                  <h3 className="font-semibold text-xl mb-4 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    Great Job! 🎉
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                      <div className="text-3xl font-bold text-amber-600">
                        {gamificationStats.currentStreak}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Days in a Row
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5">
                      <div className="text-3xl font-bold text-purple-600">
                        {gamificationStats.bestStreak}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Best Record
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5">
                      <div className="text-3xl font-bold text-green-600">
                        {todayAdherence}%
                      </div>
                      <div className="text-sm text-muted-foreground">Today</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                      <div className="text-3xl font-bold text-primary">
                        {gamificationStats.totalVictories}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Wins!
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Message */}
                <div className="card-senior bg-gradient-to-br from-secondary/10 to-teal/10">
                  <div className="text-center py-2">
                    {isPerfectToday ? (
                      <>
                        <span className="text-4xl">🎉</span>
                        <p className="font-bold text-xl mt-3">
                          You Did It! All Done for Today!
                        </p>
                        <p className="text-base text-muted-foreground mt-2">
                          You took all your medicines. Well done!
                        </p>
                      </>
                    ) : gamificationStats.currentStreak >= 7 ? (
                      <>
                        <span className="text-4xl">🏆</span>
                        <p className="font-bold text-xl mt-3">Amazing! You're a Star!</p>
                        <p className="text-base text-muted-foreground mt-2">
                          {gamificationStats.currentStreak} days without missing! Keep going!
                        </p>
                      </>
                    ) : gamificationStats.currentStreak >= 3 ? (
                      <>
                        <span className="text-4xl">🔥</span>
                        <p className="font-bold text-xl mt-3">You're Doing Great!</p>
                        <p className="text-base text-muted-foreground mt-2">
                          Just {7 - gamificationStats.currentStreak} more days to become a star!
                        </p>
                      </>
                    ) : gamificationStats.currentStreak >= 1 ? (
                      <>
                        <span className="text-4xl">💪</span>
                        <p className="font-bold text-xl mt-3">Good Job!</p>
                        <p className="text-base text-muted-foreground mt-2">
                          Keep taking your medicines every day!
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl">🎯</span>
                        <p className="font-bold text-xl mt-3">
                          Let's Start Today!
                        </p>
                        <p className="text-base text-muted-foreground mt-2">
                          Take your medicines to start feeling better!
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="card-senior text-center py-8">
                <Swords className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold text-lg mb-2">No Battle Yet!</h3>
                <p className="text-muted-foreground">
                  Add medications to start fighting the Health Monster!
                </p>
              </div>
            )}
          </div>
        ) : (
          // Account Tab - Original Content
          <div className="space-y-4">
            {/* Subscription Card */}
            <SubscriptionCard />

            {/* Link Code Card (for Patients) */}
            {(userRole === "patient" || !userRole) && linkCode && (
              <div className="card-senior bg-teal-light border border-teal/30">
                <div className="flex items-center gap-3 mb-3">
                  <LinkIcon className="w-6 h-6 text-teal" />
                  <h3 className="text-senior-lg font-semibold">
                    Share This Code
                  </h3>
                </div>
                <p className="text-base text-muted-foreground mb-4">
                  Give this code to your family or helper so they can help you with your medicines.
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white rounded-xl px-4 py-3 font-mono text-2xl tracking-wider text-center font-bold border border-border">
                    {linkCode}
                  </div>
                  <Button
                    variant="secondary"
                    size="icon-lg"
                    onClick={copyLinkCode}
                  >
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
                  <h3 className="text-senior-lg font-semibold">
                    My Helpers
                  </h3>
                </div>
                <div className="space-y-2">
                  {linkedCompanions.map((companion) => (
                    <div
                      key={companion.id}
                      className="flex items-center justify-between gap-2 p-3 bg-muted rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-white font-bold shrink-0">
                          {companion.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{companion.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
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
                        disabled={unlinkingIds.has(companion.linkId)}
                        className="text-destructive shrink-0"
                      >
                        {unlinkingIds.has(companion.linkId) ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Removing...
                          </>
                        ) : (
                          "Remove"
                        )}
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
                  className="w-full text-lg"
                  onClick={() => setShowAddPatientModal(true)}
                >
                  <UserPlus className="w-6 h-6 mr-2" />
                  Add Someone to Help
                </Button>

                {/* Linked Patients */}
                {linkedPatients.length > 0 && (
                  <div className="card-senior">
                    <div className="flex items-center gap-3 mb-4">
                      <Users className="w-6 h-6 text-primary" />
                      <h3 className="text-senior-lg font-semibold">
                        People I'm Helping
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {linkedPatients
                        .filter((p) => p.linkStatus === "accepted")
                        .map((patient) => (
                          <div
                            key={patient.id}
                            className="flex items-center justify-between gap-2 p-4 bg-muted rounded-xl"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                                {patient.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-lg truncate">{patient.name}</p>
                                <p className="text-base text-muted-foreground">
                                  {patient.adherenceRate}% done today
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0" />
                          </div>
                        ))}
                    </div>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full mt-4 text-lg"
                      onClick={() => navigate("/companion")}
                    >
                      See All Details
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
              className="w-full text-destructive border-destructive hover:bg-destructive/10 text-lg"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="w-6 h-6" />
                  Sign Out
                </>
              )}
            </Button>
          </div>
        )}
      </main>

      {/* Add Patient Modal (for Companions) */}
      {showAddPatientModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-senior-xl font-bold">Add Someone to Help</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddPatientModal(false)}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <p className="text-base text-muted-foreground mb-6">
              Ask the person you want to help for their 6-letter code. They can find it in their "My Account" page.
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
                className="flex-1 text-lg"
                onClick={() => setShowAddPatientModal(false)}
              >
                Go Back
              </Button>
              <Button
                variant="coral"
                size="lg"
                className="flex-1 text-lg"
                onClick={handleLinkPatient}
                disabled={isLinking || linkCodeInput.length < 6}
              >
                {isLinking ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 my-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-senior-xl font-bold">
                Reminder Settings
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotificationSettings(false)}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Email Reminders - For Patients */}
              {userRole === "patient" && (
                <>
                  <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-teal/20 rounded-full flex items-center justify-center">
                        <Mail className="w-6 h-6 text-teal" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Email Reminders</p>
                        <p className="text-sm text-muted-foreground">
                          Get an email before it's time for your medicine
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={emailReminderEnabled}
                      onCheckedChange={setEmailReminderEnabled}
                      className="scale-125"
                    />
                  </div>

                  {/* Reminder Time Selection */}
                  {emailReminderEnabled && (
                    <div className="p-4 bg-muted rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                          <Clock className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">How Early?</p>
                          <p className="text-sm text-muted-foreground">
                            When should we remind you?
                          </p>
                        </div>
                      </div>
                      <Select
                        value={emailReminderMinutes}
                        onValueChange={setEmailReminderMinutes}
                      >
                        <SelectTrigger className="w-full h-14 text-lg">
                          <SelectValue placeholder="Choose time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5" className="text-lg py-3">5 minutes before</SelectItem>
                          <SelectItem value="10" className="text-lg py-3">10 minutes before</SelectItem>
                          <SelectItem value="15" className="text-lg py-3">15 minutes before</SelectItem>
                          <SelectItem value="30" className="text-lg py-3">30 minutes before</SelectItem>
                          <SelectItem value="60" className="text-lg py-3">1 hour before</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {/* Email Notifications for Companions */}
              {userRole === "companion" && profile?.email && (
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <Mail className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Email Alerts</p>
                        <p className="text-sm text-muted-foreground">
                          Get emails when patients miss medications
                        </p>
                      </div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      Auto-enabled
                    </span>
                  </div>
                  <div className="mt-3 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      ✓ Notifications sent to <span className="font-medium">{profile.email}</span>
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Sent 3 minutes after a missed dose
                    </p>
                  </div>
                </div>
              )}

              {/* Push Notifications - For Both Roles */}
              {pushSupported && (
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        pushSubscribed ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Smartphone className={`w-6 h-6 ${pushSubscribed ? 'text-green-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Push Notifications</p>
                        <p className="text-sm text-muted-foreground">
                          {userRole === "companion" 
                            ? "Get alerts when patients miss medications"
                            : "Get reminders on this device"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={pushSubscribed}
                      onCheckedChange={handleTogglePush}
                      disabled={pushLoading || pushPermission === 'denied'}
                      className="scale-125"
                    />
                  </div>
                  {pushPermission === 'denied' && (
                    <p className="text-sm text-destructive mt-2">
                      Notifications blocked. Enable in browser settings.
                    </p>
                  )}
                  {pushSubscribed && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                      ✓ Enabled on this device
                    </p>
                  )}
                </div>
              )}

              {/* Telegram Notifications - For Both Roles */}
              {telegramConfigured && (
                <div className="p-4 bg-muted rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        telegramLinked ? 'bg-[#0088cc]/20' : 'bg-gray-100'
                      }`}>
                        <Send className={`w-6 h-6 ${telegramLinked ? 'text-[#0088cc]' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg">Telegram</p>
                          {telegramLinked && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              Linked
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {userRole === "companion"
                            ? "Instant alerts when patients miss meds"
                            : "Get medication reminders on Telegram"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {telegramLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : telegramLinked ? (
                    <div className="space-y-3">
                      <div className="bg-[#0088cc]/10 rounded-lg p-3">
                        <p className="text-sm">
                          Connected{telegramUsername && <> as <span className="font-medium">@{telegramUsername}</span></>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestTelegram}
                          disabled={telegramTesting}
                          className="flex-1"
                        >
                          {telegramTesting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Send className="w-4 h-4 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUnlinkTelegram}
                          disabled={telegramUnlinking}
                          className="text-destructive hover:text-destructive"
                        >
                          {telegramUnlinking ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : null}
                          Unlink
                        </Button>
                      </div>
                    </div>
                  ) : telegramLinkCode && !isTelegramCodeExpired ? (
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-xs text-muted-foreground mb-1">Your code:</p>
                        <p className="text-2xl font-mono font-bold tracking-wider text-primary">
                          {telegramLinkCode}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires in {telegramCodeExpires ? Math.max(1, Math.ceil((telegramCodeExpires.getTime() - Date.now()) / 60000)) : 10} min
                        </p>
                      </div>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Open Telegram</li>
                        <li>Search for <span className="font-mono text-[#0088cc]">@{telegramBotUsername || 'AInayBot'}</span></li>
                        <li>Send the code above</li>
                      </ol>
                      {telegramDeepLink && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full bg-[#0088cc] hover:bg-[#0088cc]/90"
                          onClick={() => window.open(telegramDeepLink, '_blank')}
                        >
                          Open Telegram Bot
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={handleRefreshTelegramStatus}
                      >
                        I've sent the code - check status
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {isTelegramCodeExpired && (
                        <p className="text-sm text-amber-600">Code expired. Generate a new one.</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateTelegramCode}
                        disabled={telegramGenerating}
                        className="w-full"
                      >
                        {telegramGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <LinkIcon className="w-4 h-4 mr-2" />
                        )}
                        {telegramGenerating ? 'Generating...' : 'Link Telegram'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Info text based on role */}
              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-700">
                  {userRole === "companion" ? (
                    <>💡 When patients miss medications, you'll get alerts via Email, Push, and Telegram (if enabled).</>
                  ) : (
                    <>💡 You'll receive reminders before it's time to take your medication via Email, Push, and Telegram.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 text-lg"
                onClick={() => setShowNotificationSettings(false)}
              >
                Go Back
              </Button>
              {userRole === "patient" && (
                <Button
                  variant="coral"
                  size="lg"
                  className="flex-1 text-lg"
                  onClick={handleSaveNotificationSettings}
                  disabled={isSavingNotifications}
                >
                  {isSavingNotifications ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Personal Info Modal */}
      {showPersonalInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-senior-xl font-bold">My Info</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPersonalInfo(false)}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <label className="text-base font-medium text-muted-foreground">
                  My Name
                </label>
                <div className="relative">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Type your name here"
                    className="input-senior pr-10 text-lg"
                  />
                  <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your helpers will see this name.
                </p>
              </div>

              {/* Email (Read-only) */}
              {profile?.email && (
                <div className="space-y-2">
                  <label className="text-base font-medium text-muted-foreground">
                    My Email
                  </label>
                  <div className="p-4 bg-muted rounded-xl flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <span className="text-muted-foreground text-lg">
                      {profile.email}
                    </span>
                  </div>
                </div>
              )}

              {/* Role (Read-only) */}
              <div className="space-y-2">
                <label className="text-base font-medium text-muted-foreground">
                  I Am A
                </label>
                <div className="p-4 bg-muted rounded-xl flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <span className="capitalize text-muted-foreground text-lg">
                    {userRole === "patient" ? "Person taking medicine" : userRole === "companion" ? "Helper/Caregiver" : "Guest"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 text-lg"
                onClick={() => setShowPersonalInfo(false)}
              >
                Go Back
              </Button>
              <Button
                variant="coral"
                size="lg"
                className="flex-1 text-lg"
                onClick={handleSavePersonalInfo}
                disabled={isSavingName || editName.trim() === userName}
              >
                {isSavingName ? "Saving..." : "Save"}
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
