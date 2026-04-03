import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, Users, Briefcase, AlertTriangle, Package } from 'lucide-react';
import { formatETB } from '@/lib/currency';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

const Dashboard = () => {
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions')
        .select('*, services(service_name, category)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('id');
      if (error) throw error;
      return data;
    },
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const active = transactions.filter((t: any) => t.status !== 'cancelled');
    const totalRevenue = active.reduce((s: number, t: any) => s + Number(t.total_price), 0);
    const totalExpenses = inventoryItems.reduce((s, i) => s + i.quantity * Number(i.cost_per_unit), 0);
    const profit = totalRevenue - totalExpenses;
    const totalServices = active.length;
    const totalCustomers = customers.length;
    const lowStockItems = inventoryItems.filter(i => i.quantity <= i.min_stock_level);

    return { totalRevenue, totalExpenses, profit, totalServices, totalCustomers, lowStockItems };
  }, [transactions, customers, inventoryItems]);

  const revenueChartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(now, 6 - i);
      const start = startOfDay(day);
      const end = endOfDay(day);
      const revenue = transactions
        .filter((t: any) => t.status !== 'cancelled' && isWithinInterval(new Date(t.created_at), { start, end }))
        .reduce((s: number, t: any) => s + Number(t.total_price), 0);
      return { day: format(day, 'EEE'), revenue };
    });
  }, [transactions]);

  const serviceDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((t: any) => {
      if (t.status === 'cancelled') return;
      const name = t.services?.category || 'other';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to ESMAC Service Manager</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Revenue" value={formatETB(stats.totalRevenue)} subtitle="All time" icon={DollarSign} color="success" />
        <KpiCard title="Expenses" value={formatETB(stats.totalExpenses)} subtitle="Inventory value" icon={TrendingUp} color="destructive" />
        <KpiCard title="Profit" value={formatETB(stats.profit)} subtitle="Revenue − Expenses" icon={DollarSign} color="info" />
        <KpiCard title="Services" value={String(stats.totalServices)} subtitle="Completed" icon={Briefcase} color="primary" />
        <KpiCard title="Customers" value={String(stats.totalCustomers)} subtitle="Total" icon={Users} color="primary" />
        <KpiCard title="Low Stock" value={String(stats.lowStockItems.length)} subtitle="Items below threshold" icon={AlertTriangle} color={stats.lowStockItems.length > 0 ? 'destructive' : 'success'} />
      </div>

      {stats.lowStockItems.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="font-semibold text-warning text-sm">Low Stock Alerts</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.lowStockItems.map(i => (
                <Badge key={i.id} variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {i.name}: {i.quantity} {i.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Revenue Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatETB(value)} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Services Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {serviceDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={serviceDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {serviceDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {txLoading ? (
            <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : recentTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">No transactions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Service</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-foreground">{tx.customer_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{tx.services?.service_name || tx.card_type || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatETB(Number(tx.total_price))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${tx.status === 'paid' ? 'bg-success/15 text-success border-success/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{format(new Date(tx.created_at), 'MMM d, yyyy')}</TableCell>
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

export default Dashboard;
