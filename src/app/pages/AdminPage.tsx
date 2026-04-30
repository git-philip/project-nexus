import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { 
  Server, Users, ShieldAlert, LogOut, Activity, 
  Terminal, Database, Power, Search, Edit, Trash2, 
  Eye, Award, Loader2, CheckCircle2, UserPlus, X, Save, Network, Lock
} from 'lucide-react';
import { supabase } from "../../lib/supabaseClient"; 
import { ChangePassword } from './ChangePassword';

export function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'security'>('overview');
  const [inspectedUser, setInspectedUser] = useState<any | null>(null);

  // --- REAL DATA STATES ---
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- ADD PERSONNEL STATES ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'student', instructor_id: '' });

  // --- EDIT PERSONNEL STATES ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState({ id: '', name: '', email: '', role: 'student', instructor_id: '' });
  
  // --- ADMIN FORCE PASSWORD RESET STATES ---
  const [editUserPassword, setEditUserPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // --- SECURITY STATES (GRANULAR) ---
  const [locks, setLocks] = useState({
    global: false,
    pc_sim_locked: false,
    ar_scan_locked: false,
    ai_chat_locked: false,
    net_sim_locked: false
  });
  const [isPurging, setIsPurging] = useState(false);

  const handleLogout = () => navigate('/');

  // --- INITIAL FETCH ---
  useEffect(() => {
    fetchUsers();
    fetchSecurityStatus();
  }, []);

  // --- WEBSOCKET REALTIME LISTENER ---
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'module_progress' }, () => fetchUsers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchUsers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_status' }, () => fetchSecurityStatus())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    if (users.length === 0) setIsLoadingUsers(true); 
    try {
      const { data: profiles, error: profileErr } = await supabase.from('profiles').select('*');
      if (profileErr) throw profileErr;

      const { data: progress, error: progErr } = await supabase.from('module_progress').select('*');
      if (progErr) throw progErr;

      const mappedUsers = (profiles || []).map(profile => {
        let progressStr = '0%';
        if (profile.role === 'student') {
          const userScores = progress?.filter(p => p.user_id === profile.id) || [];
          const pcSim = userScores.find(p => p.module_name === 'pc-simulator')?.completion_percentage || 0;
          const arScan = userScores.find(p => p.module_name === 'ar-scanner')?.completion_percentage || 0;
          const aiChat = userScores.find(p => p.module_name === 'ai-chatbot')?.completion_percentage || 0;
          const netSim = userScores.find(p => p.module_name === 'network-sim')?.completion_percentage || 0;
          
          const overall = Math.round((pcSim + arScan + aiChat + netSim) / 4);
          progressStr = `${overall}%`;
        }

        let assignedCount = 0;
        if (profile.role === 'instructor') {
          assignedCount = (profiles || []).filter(p => p.role === 'student' && p.assigned_instructor_id === profile.id).length;
        }

        let instructorName = 'Unassigned';
        if (profile.role === 'student' && profile.assigned_instructor_id) {
           const inst = profiles?.find(p => p.id === profile.assigned_instructor_id);
           if (inst) instructorName = inst.full_name;
        }

        return {
          id: profile.id,
          name: profile.full_name || 'Unknown User',
          email: profile.email || 'No Email',
          role: profile.role === 'student' ? 'Student' : profile.role === 'instructor' ? 'Instructor' : 'Admin',
          status: 'Active', 
          lastLogin: 'Live',
          rawInstructorId: profile.assigned_instructor_id || '', 
          details: profile.role === 'student' ? {
            instructor: instructorName,
            progress: progressStr,
            currentModule: 'Active Node', 
            alerts: 0
          } : {
            assignedCadets: assignedCount,
            pendingGrades: 0,
            classAvg: 'Monitoring...', 
            alerts: 0
          }
        };
      });

      setUsers(mappedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingUser(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: 'Password123!', 
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create authentication record.");

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: authData.user.id,
        full_name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        assigned_instructor_id: newUser.role === 'student' ? (newUser.instructor_id || null) : null
      }]);

      if (profileError) {
        if (profileError.code === '23503') throw new Error("Database Error: Foreign Key constraint issue on assigned instructor.");
        else throw profileError;
      }

      await fetchUsers();
      setIsAddModalOpen(false);
      setNewUser({ name: '', email: '', role: 'student', instructor_id: '' });
      alert("User successfully added! Their default password is: Password123!");
      
    } catch (error: any) {
      console.error("Error adding user:", error);
      alert(error.message || "Failed to add user.");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingUser(true);
    
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editingUser.name,
        role: editingUser.role,
        assigned_instructor_id: editingUser.role === 'student' ? (editingUser.instructor_id || null) : null
      }).eq('id', editingUser.id);

      if (error) throw error;

      await fetchUsers(); 
      setIsEditModalOpen(false); 
      
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user.");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // --- FORCE RESET USER PASSWORD (ADMIN API) ---
  const handleForcePasswordReset = async () => {
    if (editUserPassword.length < 6) return alert("Password must be at least 6 characters.");
    setIsResettingPassword(true);

    try {
      // NOTE: This uses the Admin API. It requires the 'service_role' key in your supabase config.
      const { data, error } = await supabase.auth.admin.updateUserById(
        editingUser.id,
        { password: editUserPassword }
      );
      if (error) throw error;

      alert(`Successfully force-changed the password for ${editingUser.name}.`);
      setEditUserPassword('');
    } catch (error: any) {
      console.error("Force password reset failed:", error);
      alert(`Error: ${error.message}\n\n[ADMIN NOTE]: To change OTHER users' passwords directly from the client, your 'supabaseClient.ts' must be using the 'service_role' key instead of the 'anon' key.`);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently remove ${userName}? This will completely revoke their access to the system.`)) return;

    try {
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
      if (profileError) throw profileError;

      await supabase.from('module_progress').delete().eq('user_id', userId);
      await fetchUsers();
      
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(error.message || "Failed to delete user. Check your database permissions.");
    }
  };

  const instructorList = users.filter(u => u.role === 'Instructor');

  const fetchSecurityStatus = async () => {
    try {
      const { data, error } = await supabase.from('system_status').select('*').eq('id', 1).single();
      if (!error && data) {
        setLocks({
          global: data.maintenance_mode,
          pc_sim_locked: data.pc_sim_locked || false,
          ar_scan_locked: data.ar_scan_locked || false,
          ai_chat_locked: data.ai_chat_locked || false,
          net_sim_locked: data.net_sim_locked || false
        });
      }
    } catch (err) {
      console.error("Failed to fetch security status:", err);
    }
  };

  const toggleModuleLock = async (dbColumn: string, currentValue: boolean) => {
    try {
      setLocks(prev => ({ ...prev, [dbColumn === 'maintenance_mode' ? 'global' : dbColumn]: !currentValue })); 
      const { error } = await supabase.from('system_status').update({ [dbColumn]: !currentValue }).eq('id', 1);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to toggle lock:", err);
      alert("Failed to lock module. Check database connection.");
      fetchSecurityStatus(); 
    }
  };

  const purgeMatrix = async () => {
    if (!window.confirm("CRITICAL WARNING: This will permanently delete ALL student progress and class materials. Are you absolutely sure?")) return;
    setIsPurging(true);
    try {
      await supabase.from('module_progress').delete().neq('id', 0); 
      await supabase.from('class_materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      alert("Database Reset Successfully.");
    } catch (err) {
      console.error("Failed to purge:", err);
    } finally {
      setIsPurging(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-300 font-sans selection:bg-emerald-500/30 overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwdjIwaDIwVjIwSDIweiIgZmlsbD0icmdiYSgxNiwgMTg1LCAxMjksIDAuMDIpIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=')] opacity-30 pointer-events-none" />

      {/* --- SIDEBAR / TOP NAV --- */}
      <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-slate-900/50 backdrop-blur-xl relative z-10 flex flex-col shrink-0">
        <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center md:items-start md:flex-col">
          <div className="flex items-center gap-2 md:gap-3 text-emerald-400 font-black tracking-widest uppercase text-lg md:text-xl">
            <Server className="w-5 h-5 md:w-6 md:h-6" /> Admin Portal
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-500 font-mono mt-0 md:mt-2 uppercase tracking-widest flex items-center gap-1 md:gap-2">
            <ShieldAlert className="w-3 h-3 text-red-500" /> Administrator
          </p>
        </div>

        <div className="p-2 md:p-4 flex flex-row md:flex-col gap-2 overflow-x-auto scrollbar-none flex-grow">
          <NavButton icon={Activity} label="System Dashboard" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <NavButton icon={Users} label="User Management" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <NavButton icon={Power} label="System Controls" isActive={activeTab === 'security'} onClick={() => setActiveTab('security')} />
          
          <div className="md:hidden ml-auto pl-2 border-l border-white/10">
            <Button onClick={handleLogout} className="h-full bg-slate-950 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white uppercase tracking-widest text-[9px] flex items-center gap-1 px-3">
              <LogOut className="w-3 h-3" /> Sign Out
            </Button>
          </div>
        </div>

        <div className="hidden md:block p-4 border-t border-white/10">
          <Button onClick={handleLogout} className="w-full bg-slate-950 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </motion.div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 p-4 md:p-8 relative z-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6 max-w-6xl mx-auto">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest">System Dashboard</h1>
                <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">Overview of all active instructors and students.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard title="Total Registered" value={users.length || "..."} icon={Users} trend="Database synced" isGood />
                <StatCard title="Overall Pass Rate" value="78%" icon={Award} trend="Up 2% this week" isGood />
                <StatCard title="System Status" value={locks.global ? "LOCKED" : "LIVE"} icon={locks.global ? ShieldAlert : CheckCircle2} trend={locks.global ? "Maintenance Mode" : "Systems nominal"} isBad={locks.global} isGood={!locks.global} />
              </div>

              <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
                <CardHeader className="border-b border-white/5 pb-3 md:pb-4 relative z-10">
                  <CardTitle className="text-xs md:text-sm text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-2">
                    <Terminal className="w-3 h-3 md:w-4 md:h-4" /> System Activity Log
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 md:pt-4 space-y-2 md:space-y-3 font-mono text-[10px] md:text-xs text-slate-400 relative z-10">
                  <p>08:42:11 - [AUTH] Admin successfully logged in.</p>
                  <p>07:50:22 - [SYS] Database connection established successfully.</p>
                  <p className="text-emerald-400 animate-pulse">[SOCKET] Live database connection active.</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 2. USER MANAGEMENT */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6 max-w-6xl mx-auto">
               <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest">User Management</h1>
                  <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">View and manage all registered users.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" placeholder="Search Name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-950 border border-white/10 text-white text-xs md:text-sm font-mono py-2 pl-10 pr-4 focus:outline-none focus:border-emerald-500 transition-colors w-full sm:w-64 rounded" 
                    />
                  </div>
                  <Button onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-widest text-[10px] h-10 px-4">
                    <UserPlus className="w-4 h-4 mr-2" /> Add User
                  </Button>
                </div>
              </div>

              <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm overflow-hidden">
                {isLoadingUsers ? (
                  <div className="p-10 flex flex-col items-center justify-center text-emerald-400 font-mono text-sm relative z-10">
                    <Loader2 className="w-8 h-8 animate-spin mb-4" /> Syncing...
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] md:text-sm font-mono relative z-10 whitespace-nowrap">
                      <thead className="bg-slate-950/50 text-slate-400 uppercase tracking-widest border-b border-white/10">
                        <tr>
                          <th className="px-4 md:px-6 py-3 md:py-4">User ID</th>
                          <th className="px-4 md:px-6 py-3 md:py-4">Name</th>
                          <th className="px-4 md:px-6 py-3 md:py-4">Role</th>
                          <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                            <td className="px-4 md:px-6 py-3 md:py-4 text-emerald-400 truncate max-w-[100px] md:max-w-[150px]" title={user.id}>{user.id}</td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-white font-bold">{user.name}</td>
                            <td className="px-4 md:px-6 py-3 md:py-4">
                              <span className={`font-bold ${user.role === 'Student' ? 'text-cyan-400' : user.role === 'Instructor' ? 'text-fuchsia-400' : 'text-amber-400'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-right flex justify-end gap-1 md:gap-2">
                              <button onClick={() => setInspectedUser(user)} className="p-1.5 md:p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 rounded transition-colors" title="View Details">
                                <Eye className="w-3 h-3 md:w-4 md:h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingUser({
                                    id: user.id,
                                    name: user.name,
                                    email: user.email,
                                    role: user.role.toLowerCase(), 
                                    instructor_id: user.rawInstructorId
                                  });
                                  setEditUserPassword(''); 
                                  setIsEditModalOpen(true);
                                }}
                                className="p-1.5 md:p-2 bg-slate-800 text-slate-400 hover:text-white rounded transition-colors hidden sm:block" title="Edit User"
                              >
                                <Edit className="w-3 h-3 md:w-4 md:h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="p-1.5 md:p-2 bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors" 
                                title="Delete User"
                              >
                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* 3. SYSTEM CONTROLS & ADMIN SECURITY */}
          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6 max-w-6xl mx-auto">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-red-400 uppercase tracking-widest">System Controls</h1>
                <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">Warning: Actions here affect all active instructors and students.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                
                {/* --- GRANULAR MODULE CONTROLS --- */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/10 pb-2">Module Access Controls</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Global Lockdown */}
                    <Card className={`bg-slate-900/60 border-red-500/30 backdrop-blur-sm p-4 flex flex-col justify-between transition-all ${locks.global ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : ''}`}>
                      <div>
                        <h4 className={`text-sm font-bold uppercase flex items-center gap-2 mb-1 ${locks.global ? 'text-emerald-400' : 'text-red-400'}`}>
                          <Power className="w-4 h-4" /> Global Access
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mb-3">Overrides everything. Locks the entire platform.</p>
                      </div>
                      <Button onClick={() => toggleModuleLock('maintenance_mode', locks.global)} variant={locks.global ? "default" : "destructive"} className={`w-full text-[10px] uppercase font-bold tracking-widest ${locks.global ? 'bg-emerald-500 text-slate-950' : ''}`}>
                        {locks.global ? 'Unlock Platform' : 'Engage Lockdown'}
                      </Button>
                    </Card>

                    {/* PC Simulator Lock */}
                    <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm p-4 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm text-cyan-400 font-bold uppercase flex items-center gap-2 mb-1">
                          <Server className="w-4 h-4" /> PC Simulator
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mb-3">Lock out students from the 3D PC Builder.</p>
                      </div>
                      <Button onClick={() => toggleModuleLock('pc_sim_locked', locks.pc_sim_locked)} variant={locks.pc_sim_locked ? "default" : "outline"} className={`w-full text-[10px] uppercase font-bold tracking-widest ${locks.pc_sim_locked ? 'bg-amber-500 text-slate-950 border-amber-500' : 'text-slate-400 border-white/10 hover:border-cyan-500/50 hover:text-cyan-400'}`}>
                        {locks.pc_sim_locked ? 'Unlock Module' : 'Lock Module'}
                      </Button>
                    </Card>

                    {/* AR Scanner Lock */}
                    <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm p-4 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm text-fuchsia-400 font-bold uppercase flex items-center gap-2 mb-1">
                          <Activity className="w-4 h-4" /> AR Scanner
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mb-3">Disable the Augmented Reality camera feed.</p>
                      </div>
                      <Button onClick={() => toggleModuleLock('ar_scan_locked', locks.ar_scan_locked)} variant={locks.ar_scan_locked ? "default" : "outline"} className={`w-full text-[10px] uppercase font-bold tracking-widest ${locks.ar_scan_locked ? 'bg-amber-500 text-slate-950 border-amber-500' : 'text-slate-400 border-white/10 hover:border-fuchsia-500/50 hover:text-fuchsia-400'}`}>
                        {locks.ar_scan_locked ? 'Unlock Module' : 'Lock Module'}
                      </Button>
                    </Card>

                    {/* AI Chatbot Lock */}
                    <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm p-4 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm text-blue-400 font-bold uppercase flex items-center gap-2 mb-1">
                          <Terminal className="w-4 h-4" /> AI Chatbot
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mb-3">Temporarily disable the AI Tutor.</p>
                      </div>
                      <Button onClick={() => toggleModuleLock('ai_chat_locked', locks.ai_chat_locked)} variant={locks.ai_chat_locked ? "default" : "outline"} className={`w-full text-[10px] uppercase font-bold tracking-widest ${locks.ai_chat_locked ? 'bg-amber-500 text-slate-950 border-amber-500' : 'text-slate-400 border-white/10 hover:border-blue-500/50 hover:text-blue-400'}`}>
                        {locks.ai_chat_locked ? 'Unlock Module' : 'Lock Module'}
                      </Button>
                    </Card>

                    {/* Network Simulator Lock */}
                    <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm p-4 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm text-emerald-400 font-bold uppercase flex items-center gap-2 mb-1">
                          <Network className="w-4 h-4" /> Network Simulator
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mb-3">Lock out students from the Network Topology Builder.</p>
                      </div>
                      <Button onClick={() => toggleModuleLock('net_sim_locked', locks.net_sim_locked)} variant={locks.net_sim_locked ? "default" : "outline"} className={`w-full text-[10px] uppercase font-bold tracking-widest ${locks.net_sim_locked ? 'bg-amber-500 text-slate-950 border-amber-500' : 'text-slate-400 border-white/10 hover:border-emerald-500/50 hover:text-emerald-400'}`}>
                        {locks.net_sim_locked ? 'Unlock Module' : 'Lock Module'}
                      </Button>
                    </Card>

                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-black text-red-500 uppercase tracking-widest border-b border-red-500/20 pb-2">Destructive Actions</h3>
                  <Card className="bg-slate-900/60 border-red-500/30 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors pointer-events-none" />
                    <CardHeader className="relative z-10">
                      <CardTitle className="text-base md:text-lg text-white font-black uppercase flex items-center gap-2">
                        <Database className="w-4 h-4 md:w-5 md:h-5 text-red-400" /> Reset Database
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 relative z-10">
                      <p className="text-xs md:text-sm text-slate-400 font-mono min-h-[40px]">Permanently deletes all student progress, instructor grades, and uploaded materials.</p>
                      <Button 
                        onClick={purgeMatrix} disabled={isPurging} variant="destructive" 
                        className="w-full bg-red-500 text-white hover:bg-red-600 uppercase tracking-widest text-[10px] md:text-xs font-black relative z-20"
                      >
                        {isPurging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete All Data'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

              </div>

              {/* ADMIN ACCOUNT SETTINGS */}
              <div className="pt-8 mt-8 border-t border-white/10">
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" /> Admin Account Security
                </h3>
                <div className="flex justify-start">
                  <ChangePassword />
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- ADD USER MODAL --- */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
              <Card className="bg-slate-900 border-cyan-500/50 shadow-[0_0_50px_rgba(34,211,238,0.15)] overflow-hidden">
                <div className="bg-cyan-500/10 border-b border-cyan-500/20 p-3 md:p-4 flex justify-between items-center">
                  <h2 className="text-sm md:text-lg font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                    <UserPlus className="w-4 h-4 md:w-5 md:h-5" /> Register User
                  </h2>
                  <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4 md:w-5 md:h-5" /></button>
                </div>
                
                <CardContent className="p-4 md:p-6">
                  <form onSubmit={handleAddPersonnel} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] text-slate-400 font-mono uppercase tracking-widest">Full Name</Label>
                      <Input 
                        required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})}
                        placeholder="e.g. Student Name" className="bg-slate-950 border-white/10 text-white font-mono h-10 text-xs md:text-sm" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] text-slate-400 font-mono uppercase tracking-widest">Email Address</Label>
                      <Input 
                        required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                        placeholder="student@cnsc.edu.ph" className="bg-slate-950 border-white/10 text-white font-mono h-10 text-xs md:text-sm" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] text-slate-400 font-mono uppercase tracking-widest">Access Role</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setNewUser({...newUser, role: 'student', instructor_id: ''})} className={`flex-1 font-mono uppercase tracking-widest text-[9px] md:text-[10px] h-10 ${newUser.role === 'student' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-slate-950 text-slate-500 border-white/10'}`}>Student</Button>
                        <Button type="button" variant="outline" onClick={() => setNewUser({...newUser, role: 'instructor', instructor_id: ''})} className={`flex-1 font-mono uppercase tracking-widest text-[9px] md:text-[10px] h-10 ${newUser.role === 'instructor' ? 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50' : 'bg-slate-950 text-slate-500 border-white/10'}`}>Instructor</Button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {newUser.role === 'student' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 pt-2">
                          <Label className="text-[9px] md:text-[10px] text-cyan-400 font-mono uppercase tracking-widest">Assign to Instructor</Label>
                          <select required value={newUser.instructor_id} onChange={e => setNewUser({...newUser, instructor_id: e.target.value})} className="w-full bg-slate-950 border border-cyan-500/30 text-white font-mono h-10 rounded-md px-3 text-xs md:text-sm outline-none focus:border-cyan-400">
                            <option value="" disabled>Select an Instructor...</option>
                            {instructorList.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="pt-4 flex gap-2 md:gap-3 border-t border-white/5">
                      <Button type="button" onClick={() => setIsAddModalOpen(false)} variant="ghost" className="flex-1 text-slate-400 hover:text-white uppercase tracking-widest text-[9px] md:text-[10px] h-10">Cancel</Button>
                      <Button type="submit" disabled={isAddingUser} className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase tracking-widest text-[9px] md:text-[10px] h-10">{isAddingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register User'}</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- EDIT USER MODAL (NOW WITH PASSWORD OVERRIDE) --- */}
      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
              <Card className="bg-slate-900 border-amber-500/50 shadow-[0_0_50px_rgba(251,191,36,0.15)] overflow-hidden">
                <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 md:p-4 flex justify-between items-center">
                  <h2 className="text-sm md:text-lg font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <Edit className="w-4 h-4 md:w-5 md:h-5" /> Edit User
                  </h2>
                  <button onClick={() => setIsEditModalOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4 md:w-5 md:h-5" /></button>
                </div>
                
                <CardContent className="p-4 md:p-6">
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] text-slate-400 font-mono uppercase tracking-widest">Full Name</Label>
                      <Input 
                        required value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                        className="bg-slate-950 border-white/10 text-white font-mono h-10 text-xs md:text-sm" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] text-slate-400 font-mono uppercase tracking-widest">Email Address</Label>
                      <Input 
                        disabled value={editingUser.email}
                        className="bg-slate-950/50 border-white/5 text-slate-500 font-mono h-10 text-xs md:text-sm cursor-not-allowed" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] text-slate-400 font-mono uppercase tracking-widest">Access Role</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setEditingUser({...editingUser, role: 'student'})} className={`flex-1 font-mono uppercase tracking-widest text-[9px] md:text-[10px] h-10 ${editingUser.role === 'student' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-slate-950 text-slate-500 border-white/10'}`}>Student</Button>
                        <Button type="button" variant="outline" onClick={() => setEditingUser({...editingUser, role: 'instructor', instructor_id: ''})} className={`flex-1 font-mono uppercase tracking-widest text-[9px] md:text-[10px] h-10 ${editingUser.role === 'instructor' ? 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50' : 'bg-slate-950 text-slate-500 border-white/10'}`}>Instructor</Button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {editingUser.role === 'student' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 pt-2">
                          <Label className="text-[9px] md:text-[10px] text-amber-400 font-mono uppercase tracking-widest">Assign to Instructor</Label>
                          <select required value={editingUser.instructor_id || ''} onChange={e => setEditingUser({...editingUser, instructor_id: e.target.value})} className="w-full bg-slate-950 border border-amber-500/30 text-white font-mono h-10 rounded-md px-3 text-xs md:text-sm outline-none focus:border-amber-400">
                            <option value="" disabled>Select an Instructor...</option>
                            {instructorList.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* NEW: FORCE PASSWORD RESET UI */}
                    <div className="pt-4 border-t border-white/5 space-y-2">
                      <Label className="text-[9px] md:text-[10px] text-red-400 font-mono uppercase tracking-widest">Override Password (Optional)</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="password"
                          value={editUserPassword} 
                          onChange={e => setEditUserPassword(e.target.value)}
                          placeholder="New password" 
                          className="bg-slate-950/50 border-red-500/30 text-white font-mono h-10 text-xs md:text-sm focus:border-red-500" 
                        />
                        <Button 
                          type="button" 
                          onClick={handleForcePasswordReset}
                          disabled={!editUserPassword || editUserPassword.length < 6 || isResettingPassword}
                          className="bg-red-500 hover:bg-red-400 text-white font-bold uppercase tracking-widest text-[9px] h-10 w-28 shrink-0"
                        >
                          {isResettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Force Reset'}
                        </Button>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-2 md:gap-3 border-t border-white/5">
                      <Button type="button" onClick={() => setIsEditModalOpen(false)} variant="ghost" className="flex-1 text-slate-400 hover:text-white uppercase tracking-widest text-[9px] md:text-[10px] h-10">Cancel</Button>
                      <Button type="submit" disabled={isUpdatingUser} className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase tracking-widest text-[9px] md:text-[10px] h-10 flex items-center justify-center gap-2">
                        {isUpdatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Details</>}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- THE INSPECT MODAL --- */}
      <AnimatePresence>
        {inspectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-lg">
              <Card className="bg-slate-900 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden">
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-3 md:p-4 flex justify-between items-center relative z-10">
                  <div>
                    <h2 className="text-base md:text-xl font-black text-white uppercase tracking-widest">{inspectedUser.name}</h2>
                    <p className="text-emerald-400 font-mono text-[9px] md:text-xs uppercase tracking-widest mt-1">ID: <span className="text-[8px] md:text-[10px]">{inspectedUser.id}</span> | Role: <span className="text-white ml-1">{inspectedUser.role}</span></p>
                  </div>
                  <button onClick={() => setInspectedUser(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
                </div>
                <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6 font-mono text-xs md:text-sm relative z-10">
                  {inspectedUser.role === 'Student' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-500 uppercase">Assigned Instructor</span><span className="text-white truncate max-w-[120px] md:max-w-[150px] text-right">{inspectedUser.details.instructor}</span></div>
                      <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-500 uppercase">Total Progress</span><span className="text-emerald-400 font-bold">{inspectedUser.details.progress}</span></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-500 uppercase">Assigned Students</span><span className="text-white">{inspectedUser.details.assignedCadets} Active</span></div>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2 md:pt-4 border-t border-white/10">
                    <Button variant="outline" onClick={() => setInspectedUser(null)} className="w-full border-slate-500/50 text-slate-400 hover:bg-slate-800 hover:text-white uppercase tracking-widest text-[9px] md:text-[10px] h-10">Close Details</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- SUBCOMPONENTS ---
function NavButton({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg font-mono text-[9px] md:text-xs uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-slate-400 border border-transparent hover:bg-white/5 hover:text-white'}`}>
      <Icon className={`w-3 h-3 md:w-4 md:h-4 ${isActive ? 'animate-pulse' : ''}`} /> {label}
    </button>
  );
}

function StatCard({ title, value, icon: Icon, trend, isGood, isBad }: any) {
  return (
    <Card className={`bg-slate-900/60 border-white/10 backdrop-blur-sm relative overflow-hidden group transition-colors ${isBad ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'hover:border-emerald-500/50'}`}>
      <div className="absolute top-0 right-0 p-3 md:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className={`w-12 h-12 md:w-16 md:h-16 ${isBad ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
      </div>
      <CardContent className="p-3 md:p-4 relative z-10">
        <h3 className="text-[9px] md:text-[10px] uppercase font-mono tracking-widest text-slate-400 mb-1">{title}</h3>
        <div className="text-2xl md:text-3xl font-black text-white">{value}</div>
        <p className={`text-[9px] md:text-[10px] font-mono mt-1 md:mt-2 truncate ${isGood ? 'text-emerald-400' : isBad ? 'text-red-400 font-bold' : 'text-slate-500'}`}>{trend}</p>
      </CardContent>
    </Card>
  );
}