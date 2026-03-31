import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

const Reports = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground">Reports</h1>
      <p className="text-sm text-muted-foreground">Financial summaries and export tools</p>
    </div>
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Reports
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Reports and exports will be implemented in the next phase.</p>
      </CardContent>
    </Card>
  </div>
);

export default Reports;
