import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router'; 
import { 
  TerminalSquare, User, LayoutDashboard, Box, Network, 
  Scan, Bot, LogOut, Menu, X, Library, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabaseClient'; 

interface AppLayoutProps {
  children: React.ReactNode;
  userType: 'student' | 'instructor';
}

export function AppLayout({ children, userType }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // --- NEW: DESKTOP SIDEBAR COLLAPSE STATE ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- SECURITY LOCKDOWN LISTENER ---
  useEffect(() => {
    const enforceLockdown = async () => {
      try {
        const { data, error } = await supabase.from('system_status').select('maintenance_mode').eq('id', 1).single();
        if (!error && data?.maintenance_mode) {
          await supabase.auth.signOut();
          navigate('/'); 
        }
      } catch (err) {
        console.error("Failed to check lockdown status:", err);
      }
    };
    enforceLockdown();
    const interval = setInterval(enforceLockdown, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  // --- UNIVERSAL SCREENTIME TRACKER ---
  useEffect(() => {
    if (userType !== 'student') return; 

    let activeModule = '';
    if (location.pathname.includes('pc-simulator')) activeModule = 'pc-simulator';
    else if (location.pathname.includes('ar-scanner')) activeModule = 'ar-scanner';
    else if (location.pathname.includes('network-sim')) activeModule = 'network-sim';
    else if (location.pathname.includes('ai-chatbot')) activeModule = 'ai-chatbot';

    if (!activeModule) return; 

    let localTimeSeconds = 0;
    let dbRecordId: string | null = null;

    const initTracker = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from('module_progress').select('id, time_spent').eq('user_id', user.id).eq('module_name', activeModule).single();

      if (data) {
        dbRecordId = data.id;
        localTimeSeconds = data.time_spent || 0;
      } else {
         const { data: newRec } = await supabase.from('module_progress')
          .insert([{ user_id: user.id, module_name: activeModule, completion_percentage: 0, time_spent: 0 }])
          .select().single();
         if (newRec) dbRecordId = newRec.id;
      }
    };

    initTracker();

    const timeInterval = setInterval(async () => {
      if (!dbRecordId) return;
      localTimeSeconds += 10;
      
      let updatePayload: any = { time_spent: localTimeSeconds, updated_at: new Date().toISOString() };

      if (['ar-scanner', 'ai-chatbot'].includes(activeModule)) {
         updatePayload.completion_percentage = Math.min(100, Math.round(localTimeSeconds / 3)); 
      }

      await supabase.from('module_progress').update(updatePayload).eq('id', dbRecordId);
      
    }, 10000);

    return () => clearInterval(timeInterval); 
  }, [location.pathname, userType]);


  // --- NAVIGATION MENUS ---
  const studentLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Class Materials', path: '/StudentClassroom', icon: Library },
    { name: 'PC Assembly', path: '/pc-simulator', icon: Box },
    { name: 'Network Simulator', path: '/network-sim', icon: Network },
    { name: 'AR Scanner', path: '/ar-scanner', icon: Scan },
    { name: 'Virtual Tutor', path: '/ai-chatbot', icon: Bot },
  ];

  const instructorLinks = [
    { name: 'Dashboard', path: '/instructor', icon: LayoutDashboard },
    { name: 'PC Assembly', path: '/instructor/pc-simulator', icon: Box },
    { name: 'Network Simulator', path: '/instructor/network-sim', icon: Network },
    { name: 'AR Scanner', path: '/instructor/ar-scanner', icon: Scan },
    { name: 'Virtual Tutor', path: '/instructor/ai-chatbot', icon: Bot },
  ];

  const navLinks = userType === 'student' ? studentLinks : instructorLinks;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // --- REUSABLE SIDEBAR COMPONENT ---
  const SidebarContent = ({ isDesktop = false, collapsed = false, onToggle }: { isDesktop?: boolean, collapsed?: boolean, onToggle?: () => void }) => (
    <div className="flex flex-col h-full bg-slate-950/95 border-r border-cyan-500/20 backdrop-blur-xl overflow-hidden transition-all duration-300">
      
      {/* Header & Toggle */}
      <div className={`p-4 md:p-6 pb-4 flex flex-col ${collapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center mb-6 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 text-cyan-400">
            <TerminalSquare className="w-8 h-8 shrink-0" />
            {!collapsed && (
              <div className="whitespace-nowrap animate-in fade-in duration-300">
                <h1 className="text-xl font-black tracking-widest uppercase leading-none">Nexus</h1>
                <p className="text-[8px] font-mono tracking-[0.3em] opacity-70">Learning Portal</p>
              </div>
            )}
          </div>
          {isDesktop && !collapsed && (
            <button onClick={onToggle} className="text-slate-500 hover:text-cyan-400 transition-colors p-1" title="Collapse Sidebar">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Collapsed mode expand button */}
        {isDesktop && collapsed && (
          <button onClick={onToggle} className="text-slate-500 hover:text-cyan-400 transition-colors mb-6 flex justify-center w-full" title="Expand Sidebar">
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* User Badge */}
        <div className={`flex items-center border border-cyan-500/30 bg-cyan-500/5 rounded text-cyan-400 transition-all ${collapsed ? 'justify-center w-10 h-10 p-0 mx-auto' : 'px-3 py-2 gap-2'}`} title={userType === 'student' ? 'Student Access' : 'Instructor Access'}>
          <User className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <span className="text-[10px] font-mono uppercase tracking-widest whitespace-nowrap">
              {userType === 'student' ? 'Student Access' : 'Instructor Access'}
            </span>
          )}
        </div>
      </div>

      {/* Nav Links */}
      <div className={`flex-1 overflow-y-auto scrollbar-none py-4 ${collapsed ? 'px-2' : 'px-4'}`}>
        {!collapsed && <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-3 px-2 whitespace-nowrap">Course Modules</p>}
        <nav className="space-y-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path} to={link.path} onClick={() => setIsMobileMenuOpen(false)}
                title={collapsed ? link.name : undefined}
                className={`flex items-center rounded-lg text-xs font-bold tracking-widest uppercase transition-all duration-300
                  ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3'}
                  ${isActive ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_15px_rgba(34,211,238,0.1)]' : 'text-slate-400 hover:text-cyan-300 hover:bg-white/5 border border-transparent'}`}
              >
                <link.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} /> 
                {!collapsed && <span className="whitespace-nowrap">{link.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Logout */}
      <div className={`p-4 border-t border-white/5 flex ${collapsed ? 'justify-center' : ''}`}>
        <button 
          onClick={handleLogout} 
          title={collapsed ? "Sign Out" : undefined} 
          className={`flex items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-xs font-bold uppercase tracking-widest ${collapsed ? 'p-3 w-12 h-12' : 'w-full px-4 py-3 gap-2'}`}
        >
          <LogOut className="w-5 h-5 shrink-0" /> 
          {!collapsed && <span className="whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden">
      
      {/* DESKTOP SIDEBAR (Dynamically resizes between w-72 and w-[80px]) */}
      <div className={`hidden md:block shrink-0 relative z-50 transition-all duration-300 ${isSidebarCollapsed ? 'w-[80px]' : 'w-72'}`}>
        <SidebarContent 
          isDesktop={true} 
          collapsed={isSidebarCollapsed} 
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        />
      </div>

      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between bg-slate-950 border-b border-cyan-500/20 p-4 relative z-50">
        <div className="flex items-center gap-2 text-cyan-400">
          <TerminalSquare className="w-6 h-6" />
          <h1 className="text-lg font-black tracking-widest uppercase leading-none">Nexus</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-cyan-400 p-1 hover:bg-cyan-500/10 rounded">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* MOBILE SLIDE-OUT MENU */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="fixed top-0 left-0 bottom-0 w-3/4 max-w-sm z-50 md:hidden shadow-2xl">
              <SidebarContent isDesktop={false} collapsed={false} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 relative w-full h-[calc(100vh-73px)] md:h-screen overflow-y-auto bg-slate-950">
        {children}
      </div>
    </div>
  );
}