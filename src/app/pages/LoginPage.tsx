import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { TerminalSquare, Lock, User, ShieldAlert, Fingerprint, Server, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from "../../lib/supabaseClient";

const BINARY_COLUMNS = Array.from({ length: 24 }).map(() =>
  Array.from({ length: 50 }).map(() => Math.round(Math.random())).join('')
);

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'student' | 'instructor' | 'admin'>('student');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // --- Maintenance Mode State ---
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  // Check if the system is under lockdown when the page loads
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('system_status')
          .select('maintenance_mode')
          .eq('id', 1)
          .single();
          
        if (!error && data?.maintenance_mode) {
          setIsMaintenanceMode(true);
        }
      } catch (err) {
        console.error("Failed to check system status:", err);
      }
    };
    
    checkSystemStatus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null); 

    try {
      // 1. Check if system is locked down BEFORE doing heavy auth
      if (isMaintenanceMode && userType !== 'admin') {
        throw new Error("SYSTEM UNDER MAINTENANCE. Cadet and Instructor logins are temporarily disabled.");
      }

      // 2. Authenticate the user's email and password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Authentication failed.");

      // 3. Fetch the user's official role from our new profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        throw new Error("Profile missing. Please contact an administrator.");
      }

      // 4. ROLE-BASED ACCESS CONTROL (RBAC) CHECK
      if (profileData.role !== userType) {
        await supabase.auth.signOut(); 
        throw new Error(`Access Denied: You do not have ${userType.toUpperCase()} privileges.`);
      }

      // 5. DOUBLE-CHECK MAINTENANCE OVERRIDE
      if (isMaintenanceMode && profileData.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error("SYSTEM UNDER MAINTENANCE. Access restricted to Administrators only.");
      }

      // 6. If everything matches, grant access!
      if (userType === 'student') {
        navigate('/dashboard');
      } else if (userType === 'instructor') {
        navigate('/instructor');
      } else {
        navigate('/admin'); 
      }
      
    } catch (err: any) {
      console.error("Login Error:", err.message);
      setAuthError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.4 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* --- BACKGROUND ANIMATIONS (OPTIMIZED FOR MOBILE) --- */}
      {/* Hidden on mobile to prevent extreme paint lag, visible on desktop (md:flex) */}
      <div className="hidden md:flex absolute inset-0 overflow-hidden pointer-events-none justify-between px-2 sm:px-10 opacity-15">
        {BINARY_COLUMNS.map((col, i) => (
          <motion.div
            key={i}
            animate={{ y: ['-100%', '100%'] }}
            transition={{
              repeat: Infinity,
              duration: Math.random() * 15 + 15,
              ease: "linear",
              delay: Math.random() * -20, 
            }}
            className={`font-mono text-xs leading-none ${isMaintenanceMode ? 'text-red-500' : 'text-cyan-500'}`}
            style={{ 
              writingMode: 'vertical-rl', 
              textOrientation: 'upright', 
              textShadow: isMaintenanceMode ? '0 0 8px rgba(239,68,68,0.6)' : '0 0 8px rgba(34,211,238,0.6)' 
            }}
          >
            {col}
          </motion.div>
        ))}
      </div>

      <motion.div 
        animate={{ backgroundPositionY: ['0px', '40px'] }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwdjIwaDIwVjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-20 pointer-events-none" 
      />
      
      {/* Primary Blur Circle: Scaled down on mobile */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] blur-[60px] md:blur-[120px] rounded-full pointer-events-none ${isMaintenanceMode ? 'bg-red-500/10' : 'bg-cyan-500/10'}`} 
      />
      
      {/* Secondary Blur Circle: Disabled on mobile (hidden md:block) to save GPU memory */}
      <motion.div 
        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className={`hidden md:block absolute top-1/2 left-1/2 translate-x-[-20%] translate-y-[-20%] w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none ${isMaintenanceMode ? 'bg-red-600/10' : 'bg-fuchsia-500/10'}`} 
      />

      {/* --- LOGIN CARD --- */}
      <motion.div
        initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Adjusted backdrop blur for mobile: backdrop-blur-xl vs md:backdrop-blur-2xl */}
        <Card className={`bg-slate-900/80 backdrop-blur-xl md:backdrop-blur-2xl border-y-white/10 border-x-transparent overflow-hidden rounded-xl relative ${isMaintenanceMode ? 'shadow-[0_0_50px_rgba(239,68,68,0.3)]' : 'shadow-[0_0_50px_rgba(0,0,0,0.5)]'}`}>
          
          <motion.div
            animate={{ 
              opacity: [0.5, 1, 0.5], 
              boxShadow: isMaintenanceMode ? ['0 0 10px rgba(239,68,68,0.3)', '0 0 30px rgba(239,68,68,1)', '0 0 10px rgba(239,68,68,0.3)'] : ['0 0 10px rgba(34,211,238,0.3)', '0 0 30px rgba(34,211,238,1)', '0 0 10px rgba(34,211,238,0.3)'] 
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute top-0 left-0 w-[2px] h-full z-50 ${isMaintenanceMode ? 'bg-red-500' : 'bg-cyan-400'}`}
          />
          <motion.div
            animate={{ 
              opacity: [0.5, 1, 0.5], 
              boxShadow: isMaintenanceMode ? ['0 0 10px rgba(239,68,68,0.3)', '0 0 30px rgba(239,68,68,1)', '0 0 10px rgba(239,68,68,0.3)'] : ['0 0 10px rgba(34,211,238,0.3)', '0 0 30px rgba(34,211,238,1)', '0 0 10px rgba(34,211,238,0.3)'] 
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className={`absolute top-0 right-0 w-[2px] h-full z-50 ${isMaintenanceMode ? 'bg-red-500' : 'bg-cyan-400'}`}
          />

          <motion.div 
            animate={{ top: ['-10%', '110%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className={`absolute left-0 w-full h-16 pointer-events-none z-40 bg-gradient-to-b from-transparent to-transparent ${isMaintenanceMode ? 'via-red-500/10' : 'via-cyan-400/10'}`} 
          />

          <CardHeader className="space-y-6 text-center pt-10 pb-6 relative z-10">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
              className={`mx-auto w-16 h-16 bg-slate-950 border rounded-2xl flex items-center justify-center relative group ${isMaintenanceMode ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]'}`}
            >
              <div className={`absolute inset-0 blur-xl transition-all ${isMaintenanceMode ? 'bg-red-500/20 group-hover:bg-red-500/30' : 'bg-cyan-400/20 group-hover:bg-cyan-400/30'}`} />
              <TerminalSquare className={`w-8 h-8 relative z-10 ${isMaintenanceMode ? 'text-red-500' : 'text-cyan-400'}`} />
            </motion.div>
            
            <div className="space-y-2">
              <CardTitle className="text-3xl font-black tracking-widest text-white uppercase">
                Project Nexus
              </CardTitle>
              <CardDescription className="text-slate-400 font-mono text-xs tracking-[0.2em] uppercase">
                An Augmented Reality-Based Learning Companion Web Application with Integrated AI for CoTT Computer Technology Students 
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-10 relative z-10">
            <motion.form 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              onSubmit={handleLogin} 
              className="space-y-6"
            >
              <AnimatePresence>
                {isMaintenanceMode && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg flex items-center justify-center gap-2 text-red-400 text-[10px] font-mono font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.2)] mb-4"
                  >
                    <AlertTriangle className="w-4 h-4 animate-pulse" /> SYSTEM UNDER MAINTENANCE
                  </motion.div>
                )}
                
                {authError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-red-950/50 border border-red-500/50 rounded-lg text-red-400 text-xs font-mono text-center shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  >
                    [SYSTEM ALERT] {authError}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="email" className={`text-[10px] uppercase tracking-widest font-mono font-bold ${isMaintenanceMode ? 'text-red-400' : 'text-cyan-400'}`}>Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@cnsc.edu.ph"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`h-12 bg-slate-950/50 border-white/10 text-white pl-10 focus-visible:ring-1 font-mono text-sm placeholder:text-slate-700 rounded-none transition-all ${isMaintenanceMode ? 'focus-visible:ring-red-500/50 focus-visible:border-red-500/50' : 'focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/50'}`}
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="password" className={`text-[10px] uppercase tracking-widest font-mono font-bold ${isMaintenanceMode ? 'text-red-400' : 'text-cyan-400'}`}>Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={`h-12 bg-slate-950/50 border-white/10 text-white pl-10 focus-visible:ring-1 font-mono text-sm placeholder:text-slate-700 rounded-none transition-all ${isMaintenanceMode ? 'focus-visible:ring-red-500/50 focus-visible:border-red-500/50' : 'focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/50'}`}
                    />
                  </div>
                </motion.div>
              </div>
              
              <motion.div variants={itemVariants} className="space-y-2">
                <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Select Access Level</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUserType('student')}
                    className={`flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1 border text-[9px] sm:text-[10px] uppercase tracking-widest font-bold transition-all duration-300 ${
                      userType === 'student' && !isMaintenanceMode
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]'
                        : userType === 'student' && isMaintenanceMode 
                        ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]'
                        : 'bg-slate-950/50 border-white/5 text-slate-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <User className="w-4 h-4" /> Student
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setUserType('instructor')}
                    className={`flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1 border text-[9px] sm:text-[10px] uppercase tracking-widest font-bold transition-all duration-300 ${
                      userType === 'instructor' && !isMaintenanceMode
                        ? 'bg-fuchsia-500/10 border-fuchsia-500/50 text-fuchsia-400 shadow-[inset_0_0_20px_rgba(232,121,249,0.1)]'
                        : userType === 'instructor' && isMaintenanceMode
                        ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]'
                        : 'bg-slate-950/50 border-white/5 text-slate-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" /> Instructor
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setUserType('admin')}
                    className={`flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1 border text-[9px] sm:text-[10px] uppercase tracking-widest font-bold transition-all duration-300 ${
                      userType === 'admin'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]'
                        : 'bg-slate-950/50 border-white/5 text-slate-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Server className="w-4 h-4" /> Admin
                  </button>
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button 
                  type="submit" 
                  disabled={isAuthenticating}
                  className={`w-full h-14 mt-4 rounded-none uppercase tracking-[0.2em] font-black text-xs transition-all duration-500 ${
                    isAuthenticating && isMaintenanceMode
                      ? 'bg-slate-800 text-red-400 border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
                      : isAuthenticating && !isMaintenanceMode
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
                      : isMaintenanceMode 
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_40px_rgba(239,68,68,0.7)]'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.7)]'
                  }`}
                >
                  {isAuthenticating ? (
                    <span className="flex items-center gap-3">
                      <Fingerprint className="w-5 h-5 animate-pulse" />
                      Authenticating...
                    </span>
                  ) : (
                    "Login"
                  )}
                </Button>
              </motion.div>
            </motion.form>
          </CardContent>
        </Card>

        <div className={`absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 pointer-events-none ${isMaintenanceMode ? 'border-red-500/80' : 'border-cyan-500/80'}`} />
        <div className={`absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 pointer-events-none ${isMaintenanceMode ? 'border-red-500/80' : 'border-cyan-500/80'}`} />
        <div className={`absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 pointer-events-none ${isMaintenanceMode ? 'border-red-500/80' : 'border-cyan-500/80'}`} />
        <div className={`absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 pointer-events-none ${isMaintenanceMode ? 'border-red-500/80' : 'border-cyan-500/80'}`} />
      </motion.div>
      
    </div>
  );
}