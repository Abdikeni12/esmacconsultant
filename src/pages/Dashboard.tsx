import { CreditCard, DollarSign, TrendingDown, TrendingUp, Printer } from 'lucide-react';
import { formatETB } from '@/lib/currency';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const revenueData = [
  { day: 'Mon', revenue: 1200 }, { day: 'Tue', revenue: 1800 },
  { day: 'Wed', revenue: 1400 }, { day: 'Thu', revenue: 2200 },
  { day: 'Fri', revenue: 1900 }, { day: 'Sat', revenue: 800 },
  { day: 'Sun', revenue: 400 },
];

const printData = [
  { day: 'Mon', cards: 24 }, { day: 'Tue', cards: 36 },
  { day: 'Wed', cards: 28 }, { day: 'Thu', cards: 44 },
  { day: 'Fri', cards: 38 }, { day: 'Sat', cards: 16 },
  { day: 'Sun', cards: 8 },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to ESMAC ID Print management system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Cards Printed" value="194" subtitle="This week" icon={Printer} color="primary" />
        <KpiCard title="Revenue" value={formatETB(8420)} subtitle="This week" icon={DollarSign} color="success" />
        <KpiCard title="Expenses" value={formatETB(2150)} subtitle="This week" icon={TrendingDown} color="destructive" />
        <KpiCard title="Profit" value={formatETB(6270)} subtitle="This week" icon={TrendingUp} color="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Cards Printed per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={printData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="cards" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
