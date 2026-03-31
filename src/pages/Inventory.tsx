import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

const Inventory = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground">Inventory</h1>
      <p className="text-sm text-muted-foreground">Track ID cards, ink, and consumables</p>
    </div>
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Stock Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Inventory management will be implemented in the next phase.</p>
      </CardContent>
    </Card>
  </div>
);

export default Inventory;
