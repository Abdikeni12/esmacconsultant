import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';
import esmacLogo from '@/assets/esmac-logo.png';

const ChangePassword = () => {
  const { changePassword, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const result = await changePassword(newPassword);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={esmacLogo} alt="ESMAC Logo" className="w-20 h-20 mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-bold font-heading text-secondary">Change Password</h1>
          <p className="text-sm text-muted-foreground mt-1">You must change your password before continuing</p>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold font-heading text-center text-foreground flex items-center justify-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> Set New Password
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 chars, letters + numbers" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" required />
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
                Sign Out Instead
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChangePassword;
