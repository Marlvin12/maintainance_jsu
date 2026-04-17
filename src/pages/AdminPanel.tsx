import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeRequests } from '@/hooks/useRealtimeSubscription';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowUpDown, Brain, Shield, Users, UserCheck, UserX } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type SortField = 'ai_score' | 'created_at' | 'priority' | 'status';
type AppRole = 'admin' | 'user' | 'maintenance';

const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-[hsl(25,90%,50%)]/10 text-[hsl(25,90%,50%)]',
  urgent: 'bg-destructive/10 text-destructive',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive',
  maintenance: 'bg-blue-500/10 text-blue-600',
  user: 'bg-muted text-muted-foreground',
};

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  maintenance: 'Maintenance',
  user: 'Student',
};

type UserRow = {
  user_id: string;
  full_name: string | null;
  dorm_hall: string | null;
  room_number: string | null;
  role: AppRole;
};

const AdminPanel = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<SortField>('ai_score');
  const [sortAsc, setSortAsc] = useState(false);

  useRealtimeRequests();

  // ── Requests ────────────────────────────────────────────────────────────────

  const { data: requests = [] } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const sorted = [...requests].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'ai_score') cmp = (a.ai_score ?? 0) - (b.ai_score ?? 0);
    else if (sortField === 'priority') cmp = (priorityOrder[a.priority] ?? 0) - (priorityOrder[b.priority] ?? 0);
    else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
    else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Database['public']['Enums']['request_status'] }) => {
      const request = requests.find(r => r.id === id);
      const { error } = await supabase.from('maintenance_requests').update({ status }).eq('id', id);
      if (error) throw error;
      if (request) {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          message: `Your request "${request.title}" status changed to ${status.replace('_', ' ')}.`,
        });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-requests'] }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const updatePriority = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: Database['public']['Enums']['request_priority'] }) => {
      const { error } = await supabase.from('maintenance_requests').update({ priority }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-requests'] }); toast.success('Priority overridden'); },
    onError: () => toast.error('Failed to update priority'),
  });

  // ── Users ────────────────────────────────────────────────────────────────────

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Profiles are visible to all authenticated users; user_roles visible to admins
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, dorm_hall, room_number'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleMap = new Map<string, AppRole>();
      for (const r of rolesRes.data) roleMap.set(r.user_id, r.role as AppRole);

      return (profilesRes.data as { user_id: string; full_name: string | null; dorm_hall: string | null; room_number: string | null }[]).map(
        (p): UserRow => ({
          user_id: p.user_id,
          full_name: p.full_name,
          dorm_hall: p.dorm_hall,
          room_number: p.room_number,
          role: roleMap.get(p.user_id) ?? 'user',
        })
      );
    },
    enabled: isAdmin,
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      // Delete existing role(s) for user, then insert the new one
      const { error: delErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole as Database['public']['Enums']['app_role'] });
      if (insErr) throw insErr;
    },
    onSuccess: (_, { newRole, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      const user = users.find(u => u.user_id === userId);
      toast.success(`${user?.full_name ?? 'User'} is now ${roleLabels[newRole]}`);
    },
    onError: (e: Error) => toast.error(`Failed to change role: ${e.message}`),
  });

  // ── Access guard ─────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
        Access denied. Admin privileges required.
      </div>
    );
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-heading font-bold mb-1">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mb-6">Manage requests and user roles — real-time updates enabled</p>
      </motion.div>

      <Tabs defaultValue="requests">
        <TabsList className="mb-6">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Brain className="w-4 h-4" /> Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> User Management ({users.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Requests Tab ── */}
        <TabsContent value="requests">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-heading">All Maintenance Requests</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="p-0 h-auto font-medium" onClick={() => toggleSort('priority')}>
                        Priority <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="p-0 h-auto font-medium" onClick={() => toggleSort('ai_score')}>
                        <Brain className="w-3 h-3 mr-1" /> AI Score <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="p-0 h-auto font-medium" onClick={() => toggleSort('status')}>
                        Status <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Update Status</TableHead>
                    <TableHead>Override Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{r.title}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.category}</Badge></TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', priorityColors[r.priority])}>{r.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.ai_score !== null && r.ai_score !== undefined ? (
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <Progress value={r.ai_score} className="h-1.5 w-16" />
                            <span className="text-xs font-mono font-semibold">{r.ai_score}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.status.replace('_', ' ')}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(r.created_at), 'MMM d')}</TableCell>
                      <TableCell>
                        <Select
                          value={r.status}
                          onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v as Database['public']['Enums']['request_status'] })}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Constants.public.Enums.request_status.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.priority}
                          onValueChange={(v) => updatePriority.mutate({ id: r.id, priority: v as Database['public']['Enums']['request_priority'] })}
                        >
                          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Constants.public.Enums.request_priority.map((p) => (
                              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        No requests yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── User Management Tab ── */}
        <TabsContent value="users">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Shield className="w-5 h-5" /> User Roles
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Promote students to Maintenance workers or Admins. Demote admins back to students.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {usersLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading users…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Dorm / Room</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.dorm_hall ? `${u.dorm_hall}${u.room_number ? ` / ${u.room_number}` : ''}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('capitalize', roleColors[u.role])}>
                            {roleLabels[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            {u.role !== 'user' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => changeRole.mutate({ userId: u.user_id, newRole: 'user' })}
                                disabled={changeRole.isPending}
                              >
                                <UserX className="w-3 h-3 mr-1" /> Demote to Student
                              </Button>
                            )}
                            {u.role !== 'maintenance' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => changeRole.mutate({ userId: u.user_id, newRole: 'maintenance' })}
                                disabled={changeRole.isPending}
                              >
                                <UserCheck className="w-3 h-3 mr-1" /> Make Maintenance
                              </Button>
                            )}
                            {u.role !== 'admin' && (
                              <Button
                                size="sm"
                                className="h-7 text-xs gradient-accent text-primary-foreground"
                                onClick={() => changeRole.mutate({ userId: u.user_id, newRole: 'admin' })}
                                disabled={changeRole.isPending}
                              >
                                <Shield className="w-3 h-3 mr-1" /> Promote to Admin
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
