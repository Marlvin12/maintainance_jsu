import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, List, MessageCircle, LogOut,
  Shield, Settings, HardHat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';

const studentNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: PlusCircle, label: 'New Request', path: '/dashboard/new' },
  { icon: List, label: 'My Requests', path: '/dashboard/requests' },
  { icon: MessageCircle, label: 'AI Assistant', path: '/dashboard/chat' },
  { icon: Settings, label: 'Profile', path: '/dashboard/profile' },
];

const maintenanceNavItems = [
  { icon: HardHat, label: 'Maintenance Board', path: '/dashboard/maintenance' },
  { icon: Settings, label: 'Profile', path: '/dashboard/profile' },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut, isAdmin, isMaintenance } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = isMaintenance ? maintenanceNavItems : studentNavItems;

  const roleLabel = isAdmin ? 'Admin' : isMaintenance ? 'Maintenance' : 'Student Portal';
  const roleBadgeVariant = isAdmin ? 'destructive' : isMaintenance ? 'secondary' : 'outline';

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col fixed h-full z-20">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <img src="/jsu-icon.svg" alt="JSU" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg text-sidebar-accent-foreground">FixIt Sonny</h1>
              <Badge variant={roleBadgeVariant} className="text-xs mt-0.5">
                {roleLabel}
              </Badge>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}

          {/* Admin-only routes */}
          {isAdmin && (
            <>
              <button
                onClick={() => navigate('/dashboard/maintenance')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  location.pathname === '/dashboard/maintenance'
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <HardHat className="w-5 h-5" />
                Maintenance View
              </button>
              <button
                onClick={() => navigate('/dashboard/admin')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  location.pathname === '/dashboard/admin'
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <Shield className="w-5 h-5" />
                Admin Panel
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-3">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-sidebar-accent-foreground">{user?.email}</p>
            </div>
            <NotificationBell />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
