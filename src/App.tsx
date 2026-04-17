import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewRequest from "./pages/NewRequest";
import RequestsList from "./pages/RequestsList";
import ChatPage from "./pages/ChatPage";
import AdminPanel from "./pages/AdminPanel";
import MaintenanceView from "./pages/MaintenanceView";
import ProfileSettings from "./pages/ProfileSettings";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

// Maintenance workers get auto-redirected to their view when hitting /dashboard
const DashboardWithRoleRedirect = () => {
  const { isMaintenance, loading } = useAuth();
  if (loading) return null;
  if (isMaintenance) return <Navigate to="/dashboard/maintenance" replace />;
  return <Dashboard />;
};

// Guards a route so only admins can access it
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Guards a route so only maintenance workers (or admins) can access it
const MaintenanceRoute = ({ children }: { children: React.ReactNode }) => {
  const { isMaintenance, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isMaintenance && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardWithRoleRedirect /></ProtectedRoute>
            } />
            <Route path="/dashboard/new" element={<ProtectedRoute><NewRequest /></ProtectedRoute>} />
            <Route path="/dashboard/requests" element={<ProtectedRoute><RequestsList /></ProtectedRoute>} />
            <Route path="/dashboard/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin" element={
              <ProtectedRoute>
                <AdminRoute><AdminPanel /></AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/maintenance" element={
              <ProtectedRoute>
                <MaintenanceRoute><MaintenanceView /></MaintenanceRoute>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
