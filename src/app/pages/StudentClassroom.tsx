import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { FileText, ExternalLink, Box, DownloadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from "../../lib/supabaseClient";

interface Material {
  id: string;
  name: string;
  size: string;
  url: string;
  created_at: string;
}

export function StudentClassroom() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // In a real app, you get this from the logged-in student's profile!
  const myAssignedInstructorId = '0c57a7bd-d611-4eac-8a74-10364079faef'; 

  useEffect(() => {
    fetchMyClassMaterials();
  }, []);

  const fetchMyClassMaterials = async () => {
    console.log("1. Fetching materials for instructor:", myAssignedInstructorId); 
    try {
      const { data, error } = await supabase
        .from('class_materials')
        .select('*')
        .eq('instructor_id', myAssignedInstructorId)
        .order('created_at', { ascending: false });

      console.log("2. Supabase Data returned:", data); 
      console.log("3. Supabase Error returned:", error); 

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error("Error fetching class materials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 text-white relative z-10">
      
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-3xl font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          Class Materials
        </h1>
        <p className="text-slate-400 mt-1 text-sm uppercase tracking-wider">
          Instructor-assigned reading and study materials
        </p>
      </div>

      <Card className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)] min-h-[500px] flex flex-col">
        <CardHeader className="border-b border-cyan-500/10 bg-cyan-950/30">
          {/* ADDED text-white HERE */}
          <CardTitle className="text-lg text-white font-bold tracking-wider uppercase flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-cyan-400" />
            Available Files
          </CardTitle>
          <CardDescription className="text-slate-400 font-mono text-[10px] uppercase">
            {materials.length} Resources Available
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {materials.map((file, index) => (
                  <motion.div 
                    key={file.id} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.1 }}
                    className="bg-slate-950/50 border border-white/5 rounded-xl hover:border-cyan-500/50 transition-all group overflow-hidden cursor-pointer shadow-lg"
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    <div className="p-4 flex items-center gap-4 hover:bg-cyan-500/5 transition-colors">
                      <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                        <FileText className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div className="overflow-hidden flex-1">
                        <p className="text-base font-bold text-white truncate group-hover:text-cyan-300 transition-colors">{file.name}</p>
                        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mt-1">{file.size} • Class Document</p>
                      </div>
                      <div className="bg-white/5 p-2 rounded-full group-hover:bg-cyan-500/20 transition-colors shrink-0">
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {materials.length === 0 && (
                  <div className="text-center py-20 flex flex-col items-center justify-center opacity-50">
                    <Box className="w-16 h-16 text-slate-600 mb-4" />
                    <p className="text-slate-400 font-mono text-sm uppercase tracking-widest">No materials assigned</p>
                    <p className="text-slate-500 text-xs mt-2">Check back when your instructor uploads new materials.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}