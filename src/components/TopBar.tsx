import { useAuth } from '@/contexts/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

export function TopBar() {
  const { profile, signOut } = useAuth();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <h1 className="text-base font-semibold font-heading text-secondary hidden sm:block">
          ESMAC Service Manager
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{profile?.full_name || profile?.username}</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">
            {profile?.role}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
