import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Cpu, Database, Zap, Fan, Server, MonitorPlay, 
  TerminalSquare, Wifi, CheckCircle2, AlertCircle, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- DATA MODELS ---
type PartType = 'cpu' | 'ram' | 'gpu' | 'storage' | 'psu' | 'cooler';

interface Part {
  id: string;
  name: string;
  type: PartType;
  category: string;
  description: string;
  specs: string[];
  icon: any;
}

const INVENTORY: Part[] = [
  { id: 'p1', name: 'Ryzen 7 5800X', type: 'cpu', category: 'Central Processing Unit', description: 'The primary logic gate matrix. Handles all major system calculations and instruction execution.', specs: ['8 Cores / 16 Threads', '3.8 GHz Base Clock', '105W TDP'], icon: Cpu },
  { id: 'p2', name: 'Corsair Vengeance 32GB', type: 'ram', category: 'Volatile Memory', description: 'High-speed temporary storage allowing the CPU to quickly access active operational data.', specs: ['DDR4 3600MHz', 'CL16 Latency', 'Dual Channel Kit'], icon: Server },
  { id: 'p3', name: 'RTX 3070 Ti Matrix', type: 'gpu', category: 'Graphics Processing Unit', description: 'Dedicated parallel processor for rendering complex visual data and accelerating spatial calculations.', specs: ['8GB GDDR6X', '6144 CUDA Cores', 'PCIe 4.0'], icon: MonitorPlay },
  { id: 'p4', name: 'Samsung 980 PRO 1TB', type: 'storage', category: 'Persistent Storage', description: 'Non-volatile data matrix for permanent archival of the operating system and user constructs.', specs: ['NVMe M.2 2280', 'Read: 7000 MB/s', 'Write: 5000 MB/s'], icon: Database },
  { id: 'p5', name: 'EVGA SuperNOVA 750', type: 'psu', category: 'Power Supply Unit', description: 'Converts external AC power into regulated DC voltages to safely feed all internal components.', specs: ['750W Capacity', '80+ Gold Efficiency', 'Fully Modular'], icon: Zap },
  { id: 'p6', name: 'Kraken X63 Liquid Cooler', type: 'cooler', category: 'Thermal Dissipation', description: 'Maintains optimal thermal limits for the CPU using circulating thermodynamic liquid transfer.', specs: ['280mm Radiator', 'Dual 140mm Fans', 'Copper Cold Block'], icon: Fan },
];

export function PCSimulator() {
  const [installedParts, setInstalledParts] = useState<PartType[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  // --- REAL-TIME HUD STATES ---
  const [time, setTime] = useState(new Date());
  const [ping, setPing] = useState(14);
  const [powerDraw, setPowerDraw] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (Math.random() > 0.6) setPing(prev => Math.max(8, prev + (Math.random() > 0.5 ? 2 : -2)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update power draw simulation based on installed parts
  useEffect(() => {
    let draw = 15; // Base motherboard draw
    if (installedParts.includes('cpu')) draw += 105;
    if (installedParts.includes('gpu')) draw += 290;
    if (installedParts.includes('ram')) draw += 10;
    if (installedParts.includes('cooler')) draw += 15;
    if (installedParts.includes('storage')) draw += 5;
    setPowerDraw(draw);
  }, [installedParts]);

  const handleInstall = () => {
    if (selectedPart && !installedParts.includes(selectedPart.type)) {
      setInstalledParts(prev => [...prev, selectedPart.type]);
      setSelectedPart(null);
    }
  };

  const handleRemove = (type: PartType) => {
    setInstalledParts(prev => prev.filter(p => p !== type));
  };

  const progress = Math.round((installedParts.length / INVENTORY.length) * 100);
  const isComplete = installedParts.length === INVENTORY.length;

  // Helper to render motherboard slots
  const renderSlot = (type: PartType, label: string, positionClasses: string) => {
    const isInstalled = installedParts.includes(type);
    const part = INVENTORY.find(p => p.type === type);
    const isSelected = selectedPart?.type === type;
    
    return (
      <div 
        className={`absolute flex flex-col items-center justify-center transition-all duration-300 ${positionClasses}
          ${isInstalled 
            ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] z-20' 
            : isSelected 
              ? 'bg-fuchsia-500/20 border-2 border-dashed border-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.4)] z-10 animate-pulse'
              : 'bg-slate-900/80 border-2 border-dashed border-slate-700 hover:border-slate-500'}`}
      >
        {isInstalled && part ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center p-2 text-center w-full h-full justify-center group cursor-pointer" onClick={() => handleRemove(type)}>
            <part.icon className="w-6 h-6 text-cyan-400 mb-1" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-100 hidden md:block">{part.name}</span>
            
            {/* Hover overlay to remove */}
            <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Eject</span>
            </div>
          </motion.div>
        ) : (
          <div className="text-center p-2 opacity-50 flex flex-col items-center justify-center w-full h-full">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwdjIwaDIwVjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-20 pointer-events-none" />

      <div className="space-y-6 max-w-7xl mx-auto relative z-10 text-white">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-2">
              <TerminalSquare className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] text-cyan-400 uppercase tracking-[0.2em] font-bold">Virtual Assembly Matrix</span>
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">PC Simulator</h1>
            <p className="text-slate-400 mt-1 text-sm uppercase tracking-wider">Zero-G Hardware Integration</p>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-4 bg-slate-900/80 backdrop-blur-md border border-white/10 p-3 rounded-lg text-xs font-mono shadow-[0_0_15px_rgba(34,211,238,0.1)]">
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase text-[9px]">Sys_Time</span>
              <span className="text-cyan-400">{time.toLocaleTimeString()}</span>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase text-[9px]">Pwr_Draw</span>
              <span className="text-fuchsia-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {powerDraw}W
              </span>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase text-[9px]">Build_Status</span>
              <span className={isComplete ? "text-emerald-400" : "text-amber-400"}>
                {isComplete ? "OPTIMAL" : "INCOMPLETE"}
              </span>
            </div>
          </motion.div>
        </div>

        {/* PROGRESS BAR */}
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Integration Sequence</span>
            <span className="text-sm font-bold text-cyan-400">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5 relative">
            <motion.div 
              initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }}
              className={`absolute top-0 left-0 h-full ${isComplete ? 'bg-emerald-500 shadow-[0_0_15px_rgba(52,211,153,0.8)]' : 'bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.8)]'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: THE SCHEMATIC WORKBENCH */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.3)] h-[500px] relative overflow-hidden flex items-center justify-center">
              
              {/* Background Grid Design */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
              
              {/* Central Motherboard Base */}
              <div className="w-[340px] h-[420px] bg-slate-950 border border-slate-700/50 rounded-sm relative shadow-2xl p-4 flex flex-col justify-between">
                <div className="absolute top-2 left-2 text-[8px] font-mono text-slate-600 uppercase tracking-widest">ATX Form Factor Base</div>
                
                {/* Visual traces/lines */}
                <div className="absolute top-1/4 left-0 w-full h-px bg-slate-800" />
                <div className="absolute top-1/2 left-0 w-full h-px bg-slate-800" />
                <div className="absolute left-1/2 top-0 w-px h-full bg-slate-800" />

                {/* THE SLOTS */}
                {renderSlot('cpu', 'CPU Socket', 'top-[40px] left-[40px] w-[100px] h-[100px]')}
                {renderSlot('cooler', 'Thermal Mount', 'top-[20px] left-[20px] w-[140px] h-[140px]')} {/* Overlays CPU slightly */}
                
                {renderSlot('ram', 'DIMM Slots', 'top-[40px] right-[30px] w-[60px] h-[140px]')}
                {renderSlot('gpu', 'PCIe x16', 'top-[220px] left-[20px] w-[260px] h-[60px]')}
                {renderSlot('storage', 'M.2 NVMe', 'bottom-[80px] right-[40px] w-[80px] h-[30px]')}
                {renderSlot('psu', 'Power Terminal', 'bottom-[20px] left-[20px] w-[120px] h-[60px]')}
              </div>

              {isComplete && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col"
                >
                  <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4 animate-pulse" />
                  <h2 className="text-3xl font-black text-white tracking-widest uppercase">System Optimal</h2>
                  <p className="text-emerald-400 font-mono text-sm mt-2 uppercase tracking-wider">All logic matrices integrated successfully</p>
                  <Button variant="outline" className="mt-6 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20" onClick={() => setInstalledParts([])}>
                    Initialize New Build
                  </Button>
                </motion.div>
              )}
            </Card>
          </div>

          {/* RIGHT: INVENTORY & HUD */}
          <div className="space-y-6 flex flex-col h-[500px]">
            
            {/* Selected Component HUD */}
            <AnimatePresence mode="wait">
              {selectedPart ? (
                <motion.div 
                  key="selected"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-slate-950/90 backdrop-blur-xl border border-fuchsia-500/50 p-5 rounded-xl shadow-[0_0_30px_rgba(232,121,249,0.15)] shrink-0"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center">
                      <selectedPart.icon className="w-5 h-5 text-fuchsia-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-wider">{selectedPart.name}</h3>
                      <Badge className="bg-slate-900 text-fuchsia-400 border border-fuchsia-500/30 text-[9px] uppercase tracking-widest mt-1">
                        {selectedPart.category}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-300 font-sans leading-relaxed mb-4">{selectedPart.description}</p>
                  
                  <div className="space-y-1 mb-4">
                    {selectedPart.specs.map((spec, i) => (
                      <div key={i} className="text-[10px] font-mono text-cyan-200 flex items-center gap-2">
                        <span className="w-1 h-1 bg-cyan-400 rounded-full" /> {spec}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-none text-xs uppercase tracking-widest"
                      onClick={handleInstall}
                    >
                      Integrate Part
                    </Button>
                    <Button variant="outline" className="rounded-none border-white/20 text-slate-300 hover:text-white" onClick={() => setSelectedPart(null)}>Cancel</Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-slate-900/50 border border-dashed border-white/20 p-5 rounded-xl flex flex-col items-center justify-center text-center h-[240px] shrink-0"
                >
                  <AlertCircle className="w-8 h-8 text-slate-500 mb-3" />
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Awaiting Selection</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">Select a component from inventory to inspect</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inventory List */}
            <Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 flex-1 flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-white/5 bg-slate-950/50 shrink-0">
                <CardTitle className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" /> Active Inventory
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="space-y-1">
                  {INVENTORY.filter(part => !installedParts.includes(part.type)).map((part) => (
                    <div 
                      key={part.id}
                      onClick={() => setSelectedPart(part)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border
                        ${selectedPart?.id === part.id 
                          ? 'bg-fuchsia-500/10 border-fuchsia-500/50 shadow-[inset_0_0_15px_rgba(232,121,249,0.1)]' 
                          : 'bg-slate-950/50 border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                    >
                      <div className={`p-2 rounded-md border ${selectedPart?.id === part.id ? 'bg-fuchsia-500/20 border-fuchsia-500/30' : 'bg-slate-900 border-white/10'}`}>
                        <part.icon className={`w-4 h-4 ${selectedPart?.id === part.id ? 'text-fuchsia-400' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold text-white truncate">{part.name}</p>
                        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest truncate">{part.category}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${selectedPart?.id === part.id ? 'text-fuchsia-400' : 'text-slate-600'}`} />
                    </div>
                  ))}
                  
                  {installedParts.length === INVENTORY.length && (
                    <div className="text-center p-4 mt-4">
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Inventory Depleted</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}