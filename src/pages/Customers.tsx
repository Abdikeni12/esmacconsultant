import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

const Customers = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground">Customers</h1>
      <p className="text-sm text-muted-foreground">Manage customer contacts and ID requests</p>
    </div>
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Customer Records
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Customer management will be implemented in the next phase.</p>
      </CardContent>
    </Card>
  </div>
);

export default Customers;
