import { useState } from 'react';
import { supabase } from "../../lib/supabaseClient"; 
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Lock, Loader2, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

export function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 1. Basic validation
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match!' });
      return;
    }
    if (oldPassword === newPassword) {
      setMessage({ type: 'error', text: 'New password must be different from the old one.' });
      return;
    }

    setIsUpdating(true);

    try {
      // 2. Get the current user's email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error("Could not verify current user identity.");

      // 3. VERIFY OLD PASSWORD: Try to sign in with the old password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });

      if (signInError) {
        throw new Error("Incorrect current password. Please try again.");
      }

      // 4. If verification passes, update to the new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // 5. Success state cleanup
      setMessage({ type: 'success', text: 'Password successfully updated!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error: any) {
      console.error("Error updating password:", error);
      setMessage({ type: 'error', text: error.message || 'Failed to update password.' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="bg-slate-900/80 border-cyan-500/30 backdrop-blur-md max-w-md w-full shadow-[0_0_30px_rgba(34,211,238,0.1)]">
      <CardHeader className="border-b border-white/5 pb-4">
        <CardTitle className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-cyan-400" /> Security Settings
        </CardTitle>
        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1">
          Verify identity to update credentials
        </p>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handlePasswordChange} className="space-y-5">
          
          {/* VERIFICATION FIELD */}
          <div className="space-y-2 bg-slate-950/50 p-4 rounded-lg border border-white/5">
            <Label className="text-[10px] text-amber-400 font-mono uppercase tracking-widest flex items-center gap-2">
              <Lock className="w-3 h-3" /> Current Password
            </Label>
            <Input 
              type="password"
              required 
              value={oldPassword} 
              onChange={e => setOldPassword(e.target.value)}
              placeholder="Enter current password" 
              className="bg-slate-950 border-white/10 text-white font-mono h-10 text-sm focus:border-amber-400 transition-colors" 
            />
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* NEW CREDENTIALS */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">New Password</Label>
              <Input 
                type="password"
                required 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••" 
                className="bg-slate-950 border-white/10 text-white font-mono h-10 text-sm focus:border-cyan-400 transition-colors" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Confirm New Password</Label>
              <Input 
                type="password"
                required 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" 
                className="bg-slate-950 border-white/10 text-white font-mono h-10 text-sm focus:border-cyan-400 transition-colors" 
              />
            </div>
          </div>

          {/* FEEDBACK MESSAGES */}
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded text-[10px] uppercase font-bold tracking-widest font-mono border ${
              message.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {message.text}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={isUpdating} 
            className="w-full mt-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase tracking-widest text-[10px] h-10 transition-all"
          >
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Update'}
          </Button>

        </form>
      </CardContent>
    </Card>
  );
}