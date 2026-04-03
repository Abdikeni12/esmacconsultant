import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

const AuditLogs = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground">Audit Logs</h1>
      <p className="text-sm text-muted-foreground">System activity and security audit trail</p>
    </div>
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" /> Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Audit logging will be implemented in the next phase.</p>
      </CardContent>
    </Card>
  </div>
);

export default AuditLogs;
