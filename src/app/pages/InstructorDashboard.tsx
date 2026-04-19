import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router';
import { 
  Users, TrendingUp, Award, Clock, TerminalSquare, Activity, 
  ShieldAlert, CheckCircle2, UploadCloud, FileText, Trash2, FilePlus,
  Box, Scan, Network, Bot, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from "../../lib/supabaseClient";

interface Student {
  id: string;
  name: string;
  email: string;
  pcSimulator: number;
  arScanner: number;
  aiChatbot: number;
  overall: number;
  timeSpent: string;
  status: 'excellent' | 'good' | 'needs-attention';
}

interface Material {
  id: string;
  name: string;
  size: string;
  url: string;
  created_at: string;
}

export function InstructorDashboard() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MOBILE TAB STATE ---
  const [activeTab, setActiveTab] = useState<'roster' | 'classroom'>('roster');

  const [students, setStudents] = useState<Student[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- WEBSOCKET REALTIME LISTENER ---
  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel('instructor-dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'module_progress' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_materials' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: profiles, error: profileErr } = await supabase.from('profiles').select('*').eq('role', 'student');
      const { data: progress, error: progErr } = await supabase.from('module_progress').select('*');
      
      if (profileErr) throw profileErr;
      if (progErr) throw progErr;

      const compiledStudents: Student[] = (profiles || []).map(profile => {
        const userScores = progress?.filter(p => p.user_id === profile.id) || [];
        const pcSim = userScores.find(p => p.module_name === 'pc-simulator')?.completion_percentage || 0;
        const arScan = userScores.find(p => p.module_name === 'ar-scanner')?.completion_percentage || 0;
        const aiChat = userScores.find(p => p.module_name === 'ai-chatbot')?.completion_percentage || 0;
        const netSim = userScores.find(p => p.module_name === 'network-sim')?.completion_percentage || 0;
        
        const overall = Math.round((pcSim + arScan + aiChat + netSim) / 4);

        const totalSeconds = userScores.reduce((acc, curr) => acc + (curr.time_spent || 0), 0);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const formattedTime = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

        return {
          id: profile.id,
          name: profile.full_name || 'Unknown Student',
          email: profile.email || 'No Email',
          pcSimulator: pcSim,
          arScanner: arScan,
          aiChatbot: aiChat,
          overall: overall,
          timeSpent: totalSeconds > 0 ? formattedTime : '0m',
          status: overall >= 80 ? 'excellent' : overall >= 50 ? 'good' : 'needs-attention'
        };
      });
      setStudents(compiledStudents);

      const { data: mats, error: matErr } = await supabase.from('class_materials').select('*').order('created_at', { ascending: false });
      if (matErr) throw matErr;
      setMaterials(mats || []);

    } catch (error) {
      console.error("Data fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${Date.now()}_${cleanFileName}`;
      
      const { error: uploadError } = await supabase.storage.from('class_materials').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('class_materials').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('class_materials').insert([{
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        url: publicUrl
      }]);

      if (dbError) throw dbError;
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Ensure RLS allows instructors to upload.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteMaterial = async (id: string) => {
    try {
      await supabase.from('class_materials').delete().eq('id', id);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const activeCount = students.length;
  const networkAvg = activeCount > 0 ? Math.round(students.reduce((acc, s) => acc + s.overall, 0) / activeCount) : 0;
  const eliteCount = students.filter(s => s.status === 'excellent').length;

  const stats = [
    { label: 'Active Students', value: activeCount.toString(), icon: Users, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', glow: 'group-hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]', border: 'border-cyan-500/30' },
    { label: 'Class Average', value: `${networkAvg}%`, icon: TrendingUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', glow: 'group-hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]', border: 'border-emerald-500/30' },
    { label: 'Top Students', value: eliteCount.toString(), icon: Award, color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/10', glow: 'group-hover:shadow-[0_0_15px_rgba(232,121,249,0.2)]', border: 'border-fuchsia-500/30' },
    { label: 'System Status', value: `Online`, icon: Clock, color: 'text-amber-400', bgColor: 'bg-amber-500/10', glow: 'group-hover:shadow-[0_0_15px_rgba(251,191,36,0.2)]', border: 'border-amber-500/30' },
  ];

  const getStatusBadge = (status: string) => {
    const variants = {
      'excellent': { class: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30', icon: Award, label: 'Excellent' },
      'good': { class: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', icon: CheckCircle2, label: 'Good' },
      'needs-attention': { class: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: ShieldAlert, label: 'Needs Attention' },
    };
    const config = variants[status as keyof typeof variants];

    return (
      <Badge variant="outline" className={`font-mono text-[9px] md:text-[10px] uppercase tracking-wider py-1 ${config.class}`}>
        <config.icon className="w-3 h-3 mr-1" /> {config.label}
      </Badge>
    );
  };

  const CustomProgress = ({ value, colorClass }: { value: number, colorClass: string }) => (
    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`absolute top-0 left-0 h-full ${colorClass}`} />
    </div>
  );

  const getProgressColor = (value: number) => {
    if (value >= 80) return 'bg-fuchsia-500 shadow-[0_0_10px_rgba(232,121,249,0.8)]';
    if (value >= 60) return 'bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.8)]';
    return 'bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.8)]';
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-400 font-mono animate-pulse">
      <Activity className="w-8 h-8 mb-4 animate-spin" /> Loading Instructor Dashboard...
    </div>;
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto p-2 md:p-8 text-white relative z-10">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-4 border-b border-white/10 pb-4 md:pb-6 px-2 md:px-0">
        <div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-1">
            <TerminalSquare className="w-3 h-3 md:w-4 md:h-4 text-fuchsia-400" />
            <span className="text-[9px] md:text-[10px] text-fuchsia-400 uppercase tracking-[0.2em] font-bold">Project Nexus | Instructor Portal</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl md:text-4xl font-black tracking-tight uppercase">
            Instructor Dashboard
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-slate-400 mt-1 text-xs md:text-sm uppercase tracking-wider">
            Student performance tracking & Classroom materials
          </motion.p>
        </div>

        <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-slate-900/50 border border-emerald-500/30 rounded-lg backdrop-blur-sm shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <Activity className="w-3 h-3 md:w-4 md:h-4 text-emerald-400 animate-pulse" />
          <span className="text-[10px] md:text-xs font-mono text-emerald-400 uppercase tracking-widest">
            System: ONLINE
          </span>
        </div>
      </div>

      {/* --- MOBILE ONLY: TAB MENU --- */}
      <div className="lg:hidden flex flex-row gap-2 overflow-x-auto scrollbar-none border-b border-white/10 pb-2 px-2">
         <NavButton icon={Users} label="Student Roster" isActive={activeTab === 'roster'} onClick={() => setActiveTab('roster')} />
         <NavButton icon={UploadCloud} label="Class Materials" isActive={activeTab === 'classroom'} onClick={() => setActiveTab('classroom')} />
      </div>

      {/* STATS OVERVIEW (Horizontal scroll on mobile, Grid on desktop) */}
      <div className={`flex flex-row lg:grid lg:grid-cols-4 gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2 px-2 md:px-0 ${activeTab === 'roster' ? 'flex' : 'hidden lg:grid'}`}>
        {stats.map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + (index * 0.1) }} className="min-w-[180px] sm:min-w-[220px] lg:min-w-0 flex-shrink-0 lg:flex-shrink">
            <Card className={`bg-slate-900/60 backdrop-blur-xl border-white/10 overflow-hidden relative group transition-all duration-300 h-full ${stat.glow}`}>
              <CardContent className="p-3 md:p-6 relative z-10 flex flex-col justify-center h-full">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-widest font-mono mb-1">{stat.label}</p>
                    <p className="text-xl md:text-3xl font-black text-white font-mono">{stat.value}</p>
                  </div>
                  <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl flex items-center justify-center border ${stat.border} ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 md:w-6 md:h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 px-2 md:px-0">
        
        {/* LEFT COLUMN: Rosters */}
        <div className={`lg:col-span-2 space-y-6 ${activeTab === 'roster' ? 'block' : 'hidden lg:block'}`}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.3)] overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-slate-950/30 p-4 md:p-6">
                <CardTitle className="text-base md:text-lg text-white font-bold tracking-wider uppercase">Student Roster</CardTitle>
                <CardDescription className="text-slate-400 font-mono text-[10px] md:text-xs uppercase">Track student progress</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                  <Table className="min-w-[800px]">
                    <TableHeader className="bg-slate-950/80 border-b border-white/10">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase tracking-widest h-10 md:h-12 px-4">Student Info</TableHead>
                        <TableHead className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase tracking-widest h-10 md:h-12 text-center">Hardware</TableHead>
                        <TableHead className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase tracking-widest h-10 md:h-12 text-center">Networks</TableHead>
                        <TableHead className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase tracking-widest h-10 md:h-12 text-center">AR Scan</TableHead>
                        <TableHead className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase tracking-widest h-10 md:h-12 text-center">Time</TableHead>
                        <TableHead className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase tracking-widest h-10 md:h-12">Overall Progress</TableHead>
                        <TableHead className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase tracking-widest h-10 md:h-12 text-right pr-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="py-3 px-4">
                            <div>
                              <p className="text-white font-bold text-xs md:text-sm">{student.name}</p>
                              <p className="text-[9px] md:text-[10px] font-mono text-slate-500">{student.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-[10px] md:text-xs text-slate-300">{student.pcSimulator}%</TableCell>
                          <TableCell className="text-center font-mono text-[10px] md:text-xs text-slate-300">{student.aiChatbot}%</TableCell>
                          <TableCell className="text-center font-mono text-[10px] md:text-xs text-slate-300">{student.arScanner}%</TableCell>
                          <TableCell className="text-center font-mono text-[10px] md:text-xs text-cyan-400">{student.timeSpent}</TableCell>
                          <TableCell className="px-4">
                            <div className="flex items-center gap-2 md:gap-3">
                              <div className="flex-1 min-w-[60px] md:min-w-[80px]">
                                <CustomProgress value={student.overall} colorClass={getProgressColor(student.overall)} />
                              </div>
                              <span className="text-[10px] md:text-xs font-mono font-bold text-white w-8">{student.overall}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-4">{getStatusBadge(student.status)}</TableCell>
                        </TableRow>
                      ))}
                      {students.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500 font-mono text-[10px] uppercase tracking-widest">
                            No student records found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* RIGHT COLUMN: Google Classroom Style Material Uplink */}
        <div className={`space-y-6 ${activeTab === 'classroom' ? 'block' : 'hidden lg:block'}`}>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
            <Card className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)] flex flex-col h-[500px] md:h-[600px]">
              <CardHeader className="border-b border-cyan-500/10 p-4 md:pb-4 bg-cyan-950/30">
                <CardTitle className="text-base md:text-lg text-white font-bold tracking-wider uppercase flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" /> Class Materials
                </CardTitle>
                <CardDescription className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase">Share resources with your students</CardDescription>
              </CardHeader>
              
              <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4 flex-1 flex flex-col overflow-hidden">
                <div 
                  className={`border-2 border-dashed rounded-xl p-4 md:p-6 flex flex-col items-center justify-center text-center transition-all duration-300 relative cursor-pointer shrink-0
                    ${isUploading ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'border-slate-700 bg-slate-950/50 hover:border-cyan-400 hover:bg-cyan-500/5'}`}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={handleFileChange} />
                  
                  {isUploading ? (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                      <UploadCloud className="w-6 h-6 md:w-8 md:h-8 text-cyan-400 animate-bounce mb-2" />
                      <p className="text-[9px] md:text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Uploading File...</p>
                    </motion.div>
                  ) : (
                    <>
                      <FilePlus className="w-6 h-6 md:w-8 md:h-8 text-slate-500 mb-2" />
                      <p className="text-xs md:text-sm text-white font-bold mb-1">Add New Material</p>
                      <p className="text-[8px] md:text-[9px] font-mono text-slate-500 uppercase tracking-wider">PDF, DOCX, PPTX (Max 50MB)</p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0 pt-1 md:pt-2">
                  <span className="text-[9px] md:text-[10px] uppercase font-mono text-slate-400 tracking-widest">Class Stream</span>
                  <Badge variant="outline" className="bg-slate-950 border-white/10 text-slate-500 text-[8px] md:text-[9px]">{materials.length} Files</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent pr-1 md:pr-2 space-y-2 md:space-y-3">
                  <AnimatePresence>
                    {materials.map((file) => (
                      <motion.div 
                        key={file.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-slate-950/50 border border-white/5 rounded-xl hover:border-cyan-500/30 transition-all group overflow-hidden"
                      >
                        <div className="p-2 md:p-3 flex items-center gap-2 md:gap-3 cursor-pointer hover:bg-cyan-500/5 transition-colors" onClick={() => window.open(file.url, '_blank')}>
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20">
                            <FileText className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
                          </div>
                          <div className="overflow-hidden flex-1">
                            <p className="text-xs md:text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">{file.name}</p>
                            <p className="text-[8px] md:text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">{file.size} • Uploaded just now</p>
                          </div>
                          <ExternalLink className="w-3 h-3 md:w-4 md:h-4 text-slate-600 group-hover:text-cyan-400 shrink-0" />
                        </div>
                        <div className="bg-slate-900/50 px-2 py-1.5 md:px-3 md:py-2 border-t border-white/5 flex justify-end opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-5 md:h-6 text-[9px] md:text-[10px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 uppercase tracking-widest font-mono px-2" onClick={(e) => { e.stopPropagation(); deleteMaterial(file.id); }}>
                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                    {materials.length === 0 && (
                      <div className="text-center py-6 md:py-10 flex flex-col items-center justify-center opacity-50">
                        <Box className="w-8 h-8 md:w-12 md:h-12 text-slate-600 mb-2 md:mb-3" />
                        <p className="text-slate-400 font-mono text-[10px] md:text-xs uppercase tracking-widest">Stream is empty</p>
                        <p className="text-slate-500 text-[9px] md:text-[10px] mt-1">Upload materials to share with students</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTS ---
function NavButton({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-[9px] md:text-[10px] uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-slate-400 border border-transparent hover:bg-white/5 hover:text-white'}`}>
      <Icon className={`w-3 h-3 md:w-4 md:h-4 ${isActive ? 'animate-pulse' : ''}`} /> {label}
    </button>
  );
}