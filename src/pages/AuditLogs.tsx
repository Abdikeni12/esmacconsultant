import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

const actionColors: Record<string, string> = {
  login: 'bg-info/15 text-info border-info/30',
  create: 'bg-success/15 text-success border-success/30',
  update: 'bg-warning/15 text-warning border-warning/30',
  delete: 'bg-destructive/15 text-destructive border-destructive/30',
};

const AuditLogs = () => {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Access restricted to administrators.</p>
      </div>
    );
  }

  const filtered = logs.filter(l =>
    !search ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity.toLowerCase().includes(search.toLowerCase()) ||
    (l.user_name && l.user_name.toLowerCase().includes(search.toLowerCase())) ||
    (l.details && l.details.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">System activity and security audit trail</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="pl-9" />
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Shield className="h-8 w-8 mb-2" />
              <p className="text-sm">No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="hidden sm:table-cell">Details</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium text-foreground">{log.user_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${actionColors[log.action] || ''}`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.entity}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs max-w-[300px] truncate">
                        {log.details || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;
