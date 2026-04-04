import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, Users, Package, AlertTriangle, Wrench, Receipt } from 'lucide-react';
import { formatETB } from '@/lib/currency';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
];

const Dashboard = () => {
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*, services(service_name)').order('created_at', { ascending: false });
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

  const completed = useMemo(() => transactions.filter((t: any) => t.status !== 'cancelled'), [transactions]);

  const totalRevenue = useMemo(() => completed.reduce((s: number, t: any) => s + Number(t.total_price), 0), [completed]);
  const totalExpenses = useMemo(() => inventoryItems.reduce((s, i) => s + i.quantity * Number(i.cost_per_unit), 0), [inventoryItems]);
  const totalServices = useMemo(() => completed.reduce((s: number, t: any) => s + t.quantity, 0), [completed]);
  const lowStockItems = useMemo(() => inventoryItems.filter(i => i.quantity <= i.min_stock_level), [inventoryItems]);

  // Revenue trend last 7 days
  const revenueTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(now, 6 - i);
      const start = startOfDay(day);
      const end = endOfDay(day);
      const dayRevenue = completed
        .filter((t: any) => isWithinInterval(new Date(t.created_at), { start, end }))
        .reduce((s: number, t: any) => s + Number(t.total_price), 0);
      return { day: format(day, 'EEE'), revenue: dayRevenue };
    });
  }, [completed]);

  // Services distribution
  const servicesDist = useMemo(() => {
    const map: Record<string, number> = {};
    completed.forEach((t: any) => {
      const name = t.services?.service_name || 'Other';
      map[name] = (map[name] || 0) + t.quantity;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [completed]);

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">ESMAC Service Manager — real-time overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Total Revenue" value={formatETB(totalRevenue)} icon={DollarSign} color="success" />
        <KpiCard title="Inventory Value" value={formatETB(totalExpenses)} icon={Package} color="warning" />
        <KpiCard title="Profit" value={formatETB(totalRevenue - totalExpenses)} icon={TrendingUp} color="primary" />
        <KpiCard title="Services Provided" value={totalServices.toString()} icon={Wrench} color="info" />
        <KpiCard title="Customers" value={customers.length.toString()} icon={Users} color="primary" />
        <KpiCard title="Low Stock" value={lowStockItems.length.toString()} icon={AlertTriangle} color={lowStockItems.length > 0 ? 'destructive' : 'success'} />
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="font-semibold text-warning text-sm">Low Stock Alerts</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(i => (
                <Badge key={i.id} variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {i.name}: {i.quantity} {i.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue trend */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Revenue Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatETB(value)} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Services distribution */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Services Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {servicesDist.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={servicesDist} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {servicesDist.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTransactions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No transactions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Service</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="p-3 font-medium text-foreground">{tx.customer_name}</td>
                      <td className="p-3 text-muted-foreground hidden sm:table-cell">{tx.services?.service_name || '—'}</td>
                      <td className="p-3 text-right font-medium">{formatETB(Number(tx.total_price))}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs capitalize ${
                          tx.status === 'completed' ? 'bg-success/15 text-success border-success/30' :
                          tx.status === 'pending' ? 'bg-warning/15 text-warning border-warning/30' :
                          'bg-destructive/15 text-destructive border-destructive/30'
                        }`}>
                          {tx.status === 'completed' ? 'Paid' : tx.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">
                        {format(new Date(tx.created_at), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">Prepared by Abdikeni Hussein Hirsi</p>
    </div>
  );
};

export default Dashboard;
