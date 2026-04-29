import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router'; 
import { Cpu, Camera, Activity, Zap, Database, Wifi, TerminalSquare, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from "../../lib/supabaseClient";
import { ChangePassword } from './ChangePassword';

export function StudentDashboard() {
  const navigate = useNavigate();

  // --- REAL-TIME SIMULATION STATES ---
  const [time, setTime] = useState(new Date());
  const [ping, setPing] = useState(24);
  const [activeUsers, setActiveUsers] = useState(142);
  
  // --- NEW: DATABASE STATES ---
  const [pcProgress, setPcProgress] = useState(0);
  const [arProgress, setArProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Live Update Effect for the UI
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (Math.random() > 0.7) setPing(prev => Math.max(12, prev + (Math.random() > 0.5 ? 2 : -2)));
      if (Math.random() > 0.9) setActiveUsers(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- FETCH PROGRESS FROM SUPABASE ---
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        // 1. Get the currently logged-in user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Fetch all their progress rows from the database
        const { data, error } = await supabase
          .from('module_progress')
          .select('module_name, completion_percentage')
          .eq('user_id', user.id);

        if (error) throw error;

        // 3. Map the database results to our state variables
        if (data) {
          data.forEach(row => {
            if (row.module_name === 'pc-simulator') setPcProgress(row.completion_percentage);
            if (row.module_name === 'ar-scanner') setArProgress(row.completion_percentage);
          });
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, []);

  // --- THE DATA ARRAYS ---
  const modules = [
    {
      id: 1,
      title: 'PC Building Simulator',
      description: 'Virtual construction environment of a system unit.',
      icon: Cpu,
      progress: pcProgress, 
      route: '/pc-simulator',
      color: 'text-cyan-400',
      bgGlow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
      borderColor: 'border-cyan-500/30'
    },
    {
      id: 2,
      title: 'AR Scanner',
      description: 'Computer hardware identification and diagnostics.',
      icon: Camera,
      progress: arProgress, 
      route: '/ar-scanner',
      color: 'text-emerald-400',
      bgGlow: 'shadow-[0_0_15px_rgba(52,211,153,0.3)]',
      borderColor: 'border-emerald-500/30'
    },
    {
      id: 3,
      title: 'Network Simulator',
      description: 'Interactive network topology and routing engine.',
      icon: Activity,
      progress: 0, 
      route: '/network-sim',
      color: 'text-fuchsia-400',
      bgGlow: 'shadow-[0_0_15px_rgba(232,121,249,0.3)]',
      borderColor: 'border-fuchsia-500/30'
    },
  ];

  // Calculate Global Mastery Average
  const globalMastery = Math.round((pcProgress + arProgress) / 2);

  const stats = [
    { label: 'System Connection', value: 'ONLINE', sub: 'Secure connection', icon: Activity, color: 'text-emerald-400' },
    { label: 'Study Time', value: '24h 12m', sub: 'Current Session', icon: Zap, color: 'text-cyan-400' },
    { label: 'Course Status', value: `${globalMastery > 0 ? 'Active' : 'Pending'}`, sub: `${globalMastery}% Completed`, icon: Database, color: 'text-fuchsia-400' },
  ];

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono animate-pulse">Loading Student Dashboard...</div>;
  }

  // --- THE VISUAL UI ---
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwdjIwaDIwVjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-20 pointer-events-none" />

      <div className="space-y-8 max-w-7xl mx-auto text-white relative z-10">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 mb-2"
            >
              <TerminalSquare className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] text-cyan-400 uppercase tracking-[0.2em] font-bold">Project Nexus | Student Portal</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-black tracking-tight"
            >
              STUDENT DASHBOARD
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 mt-1 text-sm uppercase tracking-wider"
            >
              Student Profile | Computer Technology
            </motion.p>
          </div>

          {/* LIVE SYSTEM HUD */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-4 bg-slate-900/80 backdrop-blur-md border border-white/10 p-3 rounded-lg text-xs font-mono shadow-[0_0_15px_rgba(34,211,238,0.1)]"
          >
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase text-[9px]">Time</span>
              <span className="text-cyan-400">{time.toLocaleTimeString()}</span>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase text-[9px]">Network</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3 h-3" /> {ping}ms
              </span>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase text-[9px]">Online_Students</span>
              <span className="text-fuchsia-400">{activeUsers}</span>
            </div>
          </motion.div>
        </div>

        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (index * 0.1) }}
            >
              <Card className="bg-slate-900/60 backdrop-blur-xl border-white/10 overflow-hidden relative group">
                <div className={`absolute -inset-1 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-xl ${stat.color.replace('text', 'bg')}`} />
                
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1 text-white font-mono">{stat.value}</p>
                      <p className={`text-[10px] mt-1 ${stat.color} opacity-80 uppercase tracking-widest`}>{stat.sub}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-slate-800/80 border border-white/5 ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* MAIN PROGRESS BAR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-slate-950/80 backdrop-blur-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-white text-lg font-bold tracking-wider uppercase">Overall Course Progress</CardTitle>
                  <CardDescription className="text-slate-400">Track your total progress across all learning modules</CardDescription>
                </div>
                <span className="text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
                  {globalMastery}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-white/10 relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${globalMastery}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500"
                />
                <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9InRyYW5zcGFyZW50Ii8+PGxpbmUgeDE9IjAiIHkxPSI0IiB4Mj0iNCIgeTI9IjAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* LEARNING MODULES GRID */}
        <div className="pb-4">
          <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Available Learning Modules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, index) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + (index * 0.1) }}
                whileHover={{ y: -5 }}
              >
                <Card 
                  className={`bg-slate-900/80 backdrop-blur-xl border ${module.borderColor} hover:${module.bgGlow} transition-all duration-300 h-full flex flex-col`}
                >
                  <CardHeader>
                    <div className={`w-12 h-12 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-center mb-4 ${module.color} shadow-inner`}>
                      <module.icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl text-white font-bold">{module.title}</CardTitle>
                    <CardDescription className="text-slate-400 min-h-[40px]">{module.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-6 mt-auto">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono uppercase tracking-wider">
                        <span className="text-slate-500">Completion</span>
                        <span className={module.color}>{module.progress}%</span>
                      </div>
                      <Progress value={module.progress} className={`h-1.5 bg-slate-950`} />
                    </div>
                    
                    <Button 
                      onClick={() => navigate(module.route)} 
                      className={`w-full bg-slate-950 hover:bg-slate-800 text-white border border-white/10 hover:${module.borderColor} transition-colors group`}
                    >
                      START MODULE <ChevronRight className="w-4 h-4 ml-2 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ACCOUNT SECURITY SECTION */}
        <div className="pb-10 pt-4 border-t border-white/10">
          <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-widest flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            Account Management
          </h2>
          <div className="flex justify-start">
            <ChangePassword />
          </div>
        </div>

      </div>
    </div>
  );
}