import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { loadDrugDatabase } from "@/services/drugDatabase";
import { FullScreenLoader } from "@/components/ui/loading-spinner";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AskAInay from "./pages/AskAInay";
import AskAInayForPatient from "./pages/AskAInayForPatient";
import Timeline from "./pages/Timeline";
import Profile from "./pages/Profile";
import CompanionDashboard from "./pages/CompanionDashboard";
import PatientManagement from "./pages/PatientManagement";
import Pricing from "./pages/Pricing";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import References from "./pages/References";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Preload drug database in background
loadDrugDatabase().catch(console.error);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { userRole, isAuthenticated, isLoading } = useApp();

  // Show loading spinner while checking auth state
  // OPTIMIZATION: Using extracted LoadingSpinner component
  if (isLoading) {
    return <FullScreenLoader />;
  }

  // Redirect to login if not authenticated (either via Supabase or demo mode)
  if (!userRole && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { userRole, isAuthenticated, isLoading } = useApp();

  // Show loading spinner while checking auth
  // OPTIMIZATION: Using extracted LoadingSpinner component
  if (isLoading) {
    return <FullScreenLoader />;
  }

  // User is logged in if they have a role (demo mode) or are authenticated (Supabase)
  const isLoggedIn = !!userRole || isAuthenticated;

  return (
    <Routes>
      <Route
        path="/"
        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Landing />}
      />
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ask"
        element={
          <ProtectedRoute>
            <AskAInay />
          </ProtectedRoute>
        }
      />
      <Route
        path="/timeline"
        element={
          <ProtectedRoute>
            <Timeline />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companion"
        element={
          <ProtectedRoute>
            <CompanionDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companion/patient/:patientId"
        element={
          <ProtectedRoute>
            <PatientManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companion/patient/:patientId/ask"
        element={
          <ProtectedRoute>
            <AskAInayForPatient />
          </ProtectedRoute>
        }
      />
      <Route path="/subscription/pricing" element={<Pricing />} />
      <Route
        path="/subscription/success"
        element={
          <ProtectedRoute>
            <SubscriptionSuccess />
          </ProtectedRoute>
        }
      />
      <Route path="/references" element={<References />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
