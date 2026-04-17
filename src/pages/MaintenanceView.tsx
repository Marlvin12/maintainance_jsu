import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeRequests } from '@/hooks/useRealtimeSubscription';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Wrench,
  MapPin,
  Calendar,
  CheckCircle2,
  PlayCircle,
  Activity,
  ClipboardList,
  Loader2,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type MaintenanceRequest = Database['public']['Tables']['maintenance_requests']['Row'];
type RequestStatus = Database['public']['Enums']['request_status'];
type RequestCategory = Database['public']['Enums']['request_category'];

// ─── Color maps ──────────────────────────────────────────────────────────────

const statusColors: Record<RequestStatus, string> = {
  pending:     'bg-warning/15 text-warning border-warning/30',
  in_progress: 'bg-info/15 text-info border-info/30',
  completed:   'bg-success/15 text-success border-success/30',
  rejected:    'bg-destructive/15 text-destructive border-destructive/30',
};

const priorityColors: Record<string, string> = {
  low:    'bg-muted text-muted-foreground border-border',
  medium: 'bg-warning/10 text-warning border-warning/30',
  high:   'bg-[hsl(25,90%,50%)]/10 text-[hsl(25,90%,50%)] border-[hsl(25,90%,50%)]/30',
  urgent: 'bg-destructive/15 text-destructive border-destructive/30',
};

const categoryLabels: Record<RequestCategory, string> = {
  plumbing:   'Plumbing',
  electrical: 'Electrical',
  hvac:       'HVAC',
  structural: 'Structural',
  cleaning:   'Cleaning',
  other:      'Other',
};

const statusLabels: Record<RequestStatus, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
  rejected:    'Rejected',
};

// ─── Request Card ─────────────────────────────────────────────────────────────

type RequestCardProps = {
  request: MaintenanceRequest;
  onUpdateStatus: (id: string, status: RequestStatus) => void;
  isUpdating: boolean;
};

const RequestCardItem = ({ request, onUpdateStatus, isUpdating }: RequestCardProps) => {
  const { id, title, category, priority, status, location, description, created_at } = request;
  const isCompleted  = status === 'completed';
  const isInProgress = status === 'in_progress';

  return (
    <Card className="glass-card flex flex-col h-full border-border/60 hover:border-border transition-colors duration-200">
      <CardHeader className="pb-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-heading font-semibold text-base leading-snug line-clamp-2 flex-1">
            {title}
          </h3>
          <Badge
            className={cn(
              'text-xs shrink-0 border font-medium capitalize',
              statusColors[status]
            )}
          >
            {statusLabels[status]}
          </Badge>
        </div>

        {/* Category + priority badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className="text-xs capitalize font-normal"
          >
            {categoryLabels[category]}
          </Badge>
          <Badge
            className={cn(
              'text-xs border font-medium capitalize',
              priorityColors[priority]
            )}
          >
            {priority}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-3 pt-0">
        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-auto pt-1">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[140px]">{location}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0" />
            {format(new Date(created_at), 'MMM d, yyyy')}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          {/* Mark In Progress — shown when pending or completed (as a reset) */}
          {!isInProgress && (
            <Button
              size="sm"
              variant={isCompleted ? 'outline' : 'default'}
              className={cn(
                'flex-1 gap-1.5 text-xs h-8',
                !isCompleted && 'gradient-accent text-white border-0'
              )}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(id, 'in_progress')}
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PlayCircle className="w-3.5 h-3.5" />
              )}
              Mark In Progress
            </Button>
          )}

          {/* Mark Complete — shown when pending or in_progress */}
          {!isCompleted && (
            <Button
              size="sm"
              variant={isInProgress ? 'default' : 'outline'}
              className={cn(
                'flex-1 gap-1.5 text-xs h-8',
                isInProgress && 'gradient-accent text-white border-0'
              )}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(id, 'completed')}
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Mark Complete
            </Button>
          )}

          {/* When already completed — only "Mark In Progress" reset is shown above */}
          {isCompleted && (
            <span className="flex-1 flex items-center justify-center gap-1.5 text-xs text-success font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const MaintenanceView = () => {
  const { user, isAdmin, isMaintenance } = useAuth();
  const queryClient = useQueryClient();

  const [locationSearch, setLocationSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RequestCategory>('all');
  const [statusFilter, setStatusFilter]     = useState<'all' | Exclude<RequestStatus, 'rejected'>>('all');

  // Track which request ID is currently being mutated
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useRealtimeRequests();

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['maintenance-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MaintenanceRequest[];
    },
    enabled: !!user && (isAdmin || isMaintenance),
  });

  // ── Mutation ───────────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id }) => setUpdatingId(id),
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success(`Request marked as ${statusLabels[status]}`);
    },
    onError: () => toast.error('Failed to update request status'),
    onSettled: () => setUpdatingId(null),
  });

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (
        locationSearch.trim() &&
        !r.location?.toLowerCase().includes(locationSearch.toLowerCase())
      ) return false;
      return true;
    });
  }, [requests, statusFilter, categoryFilter, locationSearch]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total:       requests.length,
      inProgress:  requests.filter((r) => r.status === 'in_progress').length,
      completed:   requests.filter((r) => r.status === 'completed').length,
      completedToday: requests.filter(
        (r) => r.status === 'completed' && new Date(r.updated_at).toDateString() === today
      ).length,
    };
  }, [requests]);

  // ── Access guard ───────────────────────────────────────────────────────────
  if (!isMaintenance && !isAdmin) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-destructive/60" />
        <h2 className="font-heading text-lg font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground text-sm">
          You need maintenance worker or admin privileges to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading font-bold mb-1 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              Maintenance Dashboard
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage and action maintenance requests across all dormitories
            </p>
          </div>
          <Badge className="flex items-center gap-1.5 bg-success/15 text-success border border-success/30 text-xs font-medium px-3 py-1">
            <Activity className="w-3 h-3 animate-pulse" />
            Live Updates
          </Badge>
        </div>
      </motion.div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Total Assigned',
            value: stats.total,
            icon: ClipboardList,
            variant: 'default' as const,
            delay: 0,
          },
          {
            label: 'In Progress',
            value: stats.inProgress,
            icon: PlayCircle,
            variant: 'info' as const,
            delay: 0.07,
          },
          {
            label: 'Completed Today',
            value: stats.completedToday,
            sub: `${stats.completed} all time`,
            icon: CheckCircle2,
            variant: 'success' as const,
            delay: 0.14,
          },
        ].map(({ label, value, sub, icon: Icon, variant, delay }) => {
          const containerClass = {
            default: 'border-border',
            info:    'border-info/30',
            success: 'border-success/30',
          }[variant];
          const iconClass = {
            default: 'bg-secondary text-foreground',
            info:    'bg-info/10 text-info',
            success: 'bg-success/10 text-success',
          }[variant];

          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay }}
              className={cn('glass-card rounded-xl p-6', containerClass)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconClass)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold font-heading">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </motion.div>
          );
        })}
      </div>

      {/* ── Filters panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="glass-card rounded-xl p-4"
      >
        <div className="flex flex-wrap gap-4 items-end">
          {/* Location search */}
          <div className="flex flex-col gap-1.5 min-w-[180px] flex-1">
            <Label className="text-xs text-muted-foreground font-medium">Building / Location</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search location…"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <Label className="text-xs text-muted-foreground font-medium">Category</Label>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="plumbing">Plumbing</SelectItem>
                <SelectItem value="electrical">Electrical</SelectItem>
                <SelectItem value="hvac">HVAC</SelectItem>
                <SelectItem value="structural">Structural</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status filter — excludes "rejected" */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <Label className="text-xs text-muted-foreground font-medium">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active filter count / reset */}
          {(locationSearch || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground self-end"
              onClick={() => {
                setLocationSearch('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Request cards grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading requests…</span>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="glass-card rounded-xl p-16 text-center"
        >
          <Wrench className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-heading font-semibold text-base mb-2">No requests found</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {requests.length === 0
              ? 'There are no maintenance requests assigned yet.'
              : 'No requests match your current filters. Try adjusting them.'}
          </p>
          {(locationSearch || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs"
              onClick={() => {
                setLocationSearch('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear all filters
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((request, i) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="flex"
            >
              <RequestCardItem
                request={request}
                onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
                isUpdating={updatingId === request.id}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaintenanceView;
