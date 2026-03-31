import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

const Transactions = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground">Transactions</h1>
      <p className="text-sm text-muted-foreground">Manage print jobs and transaction records</p>
    </div>
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" /> Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">No transactions yet. Transaction management will be implemented in the next phase.</p>
      </CardContent>
    </Card>
  </div>
);

export default Transactions;
