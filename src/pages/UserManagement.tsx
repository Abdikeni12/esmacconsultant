import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

const UserManagement = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground">User Management</h1>
      <p className="text-sm text-muted-foreground">Create and manage staff accounts</p>
    </div>
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Users
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">User management will be fully implemented in the next phase.</p>
      </CardContent>
    </Card>
  </div>
);

export default UserManagement;
