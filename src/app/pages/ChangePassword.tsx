import { useState } from 'react';
import { supabase } from "../../lib/supabaseClient"; 
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 1. Basic validation
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }

    setIsUpdating(true);

    try {
      // 2. The Supabase Magic Function
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // 3. Success state cleanup
      setMessage({ type: 'success', text: 'Password updated successfully!' });
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
          <Lock className="w-5 h-5 text-cyan-400" /> Account Security
        </CardTitle>
        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1">
          Update your login credentials
        </p>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          
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
            <Label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Confirm Password</Label>
            <Input 
              type="password"
              required 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••" 
              className="bg-slate-950 border-white/10 text-white font-mono h-10 text-sm focus:border-cyan-400 transition-colors" 
            />
          </div>

          {/* Feedback Messages */}
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
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>

        </form>
      </CardContent>
    </Card>
  );
}