import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Download, TrendingUp, CreditCard, DollarSign } from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay, subDays, subWeeks, subMonths, isWithinInterval } from 'date-fns';
import { formatETB } from '@/lib/currency';

type Period = 'daily' | 'weekly' | 'monthly';

const Reports = () => {
  const [period, setPeriod] = useState<Period>('daily');
  const [range, setRange] = useState('7'); // number of periods to show

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions-reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const summaryData = useMemo(() => {
    if (!transactions.length) return [];
    const now = new Date();
    const periods = parseInt(range);
    const buckets: Record<string, { label: string; revenue: number; count: number; start: Date; end: Date }> = {};

    for (let i = periods - 1; i >= 0; i--) {
      let start: Date, end: Date, label: string;
      if (period === 'daily') {
        start = startOfDay(subDays(now, i));
        end = endOfDay(subDays(now, i));
        label = format(start, 'MMM d');
      } else if (period === 'weekly') {
        start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        end = endOfDay(subDays(startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 }), 1));
        label = `W${format(start, 'w')}`;
      } else {
        start = startOfMonth(subMonths(now, i));
        end = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0));
        label = format(start, 'MMM yyyy');
      }
      buckets[label] = { label, revenue: 0, count: 0, start, end };
    }

    transactions.forEach(tx => {
      if (tx.status === 'cancelled') return;
      const txDate = new Date(tx.created_at);
      Object.values(buckets).forEach(b => {
        if (isWithinInterval(txDate, { start: b.start, end: b.end })) {
          b.revenue += Number(tx.total_price);
          b.count += tx.quantity;
        }
      });
    });

    return Object.values(buckets);
  }, [transactions, period, range]);

  const totals = useMemo(() => {
    const completed = transactions.filter(t => t.status !== 'cancelled');
    return {
      totalRevenue: completed.reduce((s, t) => s + Number(t.total_price), 0),
      totalCards: completed.reduce((s, t) => s + t.quantity, 0),
      totalTransactions: completed.length,
      avgPerTransaction: completed.length > 0 ? completed.reduce((s, t) => s + Number(t.total_price), 0) / completed.length : 0,
    };
  }, [transactions]);

  const exportCSV = () => {
    const headers = ['Period', 'Revenue (ETB)', 'Cards Printed'];
    const rows = summaryData.map(d => [d.label, d.revenue.toFixed(2), d.count]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esmac-report-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // Generate a printable HTML report
    const html = `
      <html><head><title>ESMAC Report</title>
      <style>body{font-family:sans-serif;padding:40px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.header{text-align:center;margin-bottom:30px}h1{color:#B5541B}</style>
      </head><body>
      <div class="header"><h1>ESMAC ID Print</h1><h2>Financial Report — ${period.charAt(0).toUpperCase() + period.slice(1)}</h2><p>Generated: ${format(new Date(), 'MMMM d, yyyy')}</p></div>
      <p><strong>Total Revenue:</strong> ${formatETB(totals.totalRevenue)} | <strong>Total Cards:</strong> ${totals.totalCards} | <strong>Avg/Transaction:</strong> ${formatETB(totals.avgPerTransaction)}</p>
      <table><thead><tr><th>Period</th><th>Revenue (ETB)</th><th>Cards Printed</th></tr></thead><tbody>
      ${summaryData.map(d => `<tr><td>${d.label}</td><td>${formatETB(d.revenue)}</td><td>${d.count}</td></tr>`).join('')}
      </tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Financial summaries and export tools</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold font-heading text-foreground">{formatETB(totals.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cards Printed</p>
            <p className="text-xl font-bold font-heading text-foreground">{totals.totalCards}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-bold font-heading text-foreground">{totals.totalTransactions}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg / Transaction</p>
            <p className="text-xl font-bold font-heading text-foreground">{formatETB(totals.avgPerTransaction)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Period selector */}
      <div className="flex gap-3">
        <Select value={period} onValueChange={v => setPeriod(v as Period)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7</SelectItem>
            <SelectItem value="14">Last 14</SelectItem>
            <SelectItem value="30">Last 30</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Revenue by {period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-60">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={summaryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatETB(value)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Summary Table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Revenue (ETB)</TableHead>
                  <TableHead className="text-right">Cards Printed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map(d => (
                  <TableRow key={d.label}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-right">{formatETB(d.revenue)}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
