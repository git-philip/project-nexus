import { Suspense, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Environment, ContactShadows } from '@react-three/drei';
import { Cpu, X, Server, MonitorPlay, Database, Zap, Fan, Box, Wrench, ShieldCheck, Layers, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { supabase } from "../../lib/supabaseClient"; 

// --- 3D MODEL IMPORTS ---
import motherboardModel from '@/assets/motherboard.glb';
import cpuModel from '@/assets/cpu.glb';
import ramModel from '@/assets/ram.glb';
import storageModel from '@/assets/storage.glb';
import coolerModel from '@/assets/cooler.glb';
import gpuModel from '@/assets/gpu.glb';
import chassisModel from '@/assets/chassis.glb';
import psuModel from '@/assets/psu.glb';

// --- INVENTORY DATA WITH SCREW COUNTS & DEPENDENCIES ---
const INVENTORY = [
  { id: 'cpu', name: 'Processor', specs: 'AM4 Socket', icon: Cpu, requires: [], screwCount: 0 },
  { id: 'ram', name: 'Memory', specs: '16GB DDR4', icon: Server, requires: [], screwCount: 0 },
  { id: 'storage', name: 'Storage', specs: '1TB NVMe', icon: Database, requires: [], screwCount: 1 },
  { id: 'cooler', name: 'Cooling', specs: '240mm AIO', icon: Fan, requires: ['cpu'], screwCount: 4 },
  { id: 'chassis', name: 'Chassis', specs: 'Mid-Tower ATX', icon: Box, requires: ['cpu', 'ram', 'storage', 'cooler'], screwCount: 0 },
  { id: 'psu', name: 'Power', specs: '750W Gold', icon: Zap, requires: ['chassis'], screwCount: 4 },
  { id: 'gpu', name: 'Graphics', specs: 'RTX 3070', icon: MonitorPlay, requires: ['chassis'], screwCount: 2 }
];

const INSTALL_ZONES: Record<string, [number, number, number]> = {
  'cpu': [0.2, 0.1, -0.55],
  'ram': [1.45, 0.45, -0.6],
  'storage': [-0.5, 0.09, 0.73],
  'cooler': [0.25, 0.45, -0.55],
  'gpu': [-0.1, 0.3, 1.1], 
  'psu': [-0.38, 1.1, 4.3],
  'chassis': [1.6, -0.9, 1.5]
};

function FloatingStatus({ isSecured, pendingText, securedText, position = [0, 1.5, 0] }: { isSecured: boolean, pendingText?: string, securedText: string, position?: [number, number, number] }) {
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    if (isSecured) {
      const timer = setTimeout(() => setIsVisible(false), 2500);
      return () => clearTimeout(timer);
    } else setIsVisible(true);
  }, [isSecured]);
  if (!isVisible) return null; 
  return (
    <Html center position={position} distanceFactor={5} style={{ pointerEvents: 'none' }}>
      {!isSecured ? (
        <div className="bg-red-500/20 text-red-400 border border-red-400 px-3 py-1 rounded font-mono text-[10px] uppercase animate-pulse whitespace-nowrap">{pendingText}</div>
      ) : (
        <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-400 px-3 py-1 rounded font-mono text-[10px] uppercase whitespace-nowrap">{securedText}</div>
      )}
    </Html>
  );
}

function InteractiveScrew({ position, screwRotation = [0, 0, 0], onFasten, onUnfasten, isScrewEquipped, onScrewError, isPrebuilt = false }: any) {
  const [isFastened, setIsFastened] = useState(isPrebuilt);
  const handleClick = (e: any) => {
    e.stopPropagation(); 
    if (!isScrewEquipped) { onScrewError(); return; }
    if (!isFastened) { setIsFastened(true); onFasten(); } 
    else { setIsFastened(false); onUnfasten(); }
  };
  return (
    <group position={position} rotation={screwRotation} onClick={handleClick} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = isScrewEquipped ? "url('/screwdriver.png') 16 16, crosshair" : 'not-allowed'; }} onPointerOut={() => (document.body.style.cursor = 'auto')}>
      <mesh><cylinderGeometry args={[0.15, 0.15, 0.15, 16]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      {!isFastened ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.04, 0.015, 16, 32]} /><meshBasicMaterial color="#ef4444" /></mesh>
      ) : (
        <group rotation={[Math.PI / 100, 0, 0]}>
          <mesh position={[0, -0.02, 0]}><cylinderGeometry args={[0.015, 0.015, 0.04, 16]} /> <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.01, 16]} /><meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} /></mesh>
        </group>
      )}
    </group>
  );
}

function InstallNode({ position, onInstall }: any) {
  return (
    <mesh position={position} onClick={(e: any) => { e.stopPropagation(); onInstall(); }} onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = 'crosshair'; }} onPointerOut={() => document.body.style.cursor = 'auto'}>
      <sphereGeometry args={[0.2, 16, 16]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.4} wireframe />
      <Html center position={[0, 0.3, 0]} distanceFactor={4} style={{ pointerEvents: 'none' }}>
        <div className="bg-cyan-500/20 text-cyan-300 border border-cyan-400 px-2 py-1 rounded font-mono text-[10px] uppercase animate-pulse whitespace-nowrap">Install Here</div>
      </Html>
    </mesh>
  );
}

function HardwareModel({ onSelect }: any) {
  const { scene } = useGLTF(motherboardModel); 
  return <primitive object={scene} scale={1} position={[0, 0, 0]} rotation={[0, 0, 0]} onClick={(e: any) => { e.stopPropagation(); onSelect(); }} onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />;
}

function CPUModel({ onSecure, onUnsecure, onRemove }: any) {
  const { scene } = useGLTF(cpuModel); 
  useEffect(() => { onSecure(); }, [onSecure]); 
  return (
    <group position={[-0.25, 0.1, -0.32]} scale={0.25}>
      <primitive object={scene} scale={1} rotation={[0, 0, 0]} onClick={(e: any) => { e.stopPropagation(); onRemove(); }} onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />
      <FloatingStatus isSecured={true} securedText="Processor Installed" position={[2, 3, -0.32]} />
    </group>
  );
}

function RAMModel({ onSecure, onUnsecure, onRemove }: any) {
  const { scene } = useGLTF(ramModel); 
  useEffect(() => { onSecure(); }, [onSecure]);
  return (
    <group position={[1.45, 0.45, -0.6]}>
      <primitive object={scene} scale={15} rotation={[1.568, 0.0, 1.553]} onClick={(e: any) => { e.stopPropagation(); onRemove(); }} onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />
      <FloatingStatus isSecured={true} securedText="Memory Installed" position={[0, 0.1, 0]} />
    </group>
  );
}

function GPUModel({ onSecure, onUnsecure, onRemove, isScrewEquipped, onScrewError, isPrebuilt }: any) {
  const { scene } = useGLTF(gpuModel); 
  const [screws, setScrews] = useState(isPrebuilt ? 2 : 0);
  useEffect(() => { if (screws === 2) onSecure(); else onUnsecure(); }, [screws]);
  return (
    <group position={[0.2, -0.01, 1.75]}> 
      <primitive object={scene} scale={1} rotation={[-0.0001, 0, 0.087]} onClick={(e: any) => { e.stopPropagation(); onRemove(); }} onPointerOver={(e: any) => { e.stopPropagation(); if (!isScrewEquipped) document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-2.55, 2.2, -0.21]} screwRotation={[0, 0, Math.PI / 2]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-2.55, 0.49, -0.21]} screwRotation={[0, 0, Math.PI / 2]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <FloatingStatus isSecured={screws === 2} pendingText={`Fasten Screws (${screws}/2)`} securedText="GPU Installed" />
    </group>
  );
}

function CoolerModel({ onSecure, onUnsecure, onRemove, isScrewEquipped, onScrewError, isPrebuilt }: any) {
  const { scene } = useGLTF(coolerModel); 
  const [screws, setScrews] = useState(isPrebuilt ? 4 : 0);
  useEffect(() => { if (screws === 4) onSecure(); else onUnsecure(); }, [screws]);
  return (
    <group position={[0.25, 0.45, -0.55]}> 
      <primitive object={scene} scale={0.95} rotation={[-1.59, 0, 0]} onClick={(e: any) => { e.stopPropagation(); onRemove(); }} onPointerOver={(e: any) => { e.stopPropagation(); if (!isScrewEquipped) document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-0.84, 0.91, -0.88]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[0.84, 0.91, -0.88]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-0.85, 0.91, 0.82]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[0.84, 0.91, 0.82]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <FloatingStatus isSecured={screws === 4} pendingText={`Fasten Screws (${screws}/4)`} securedText="Cooler Installed" />
    </group>
  );
}

function StorageModel({ onSecure, onUnsecure, onRemove, isScrewEquipped, onScrewError, isPrebuilt }: any) {
  const { scene } = useGLTF(storageModel); 
  const [screws, setScrews] = useState(isPrebuilt ? 1 : 0);
  useEffect(() => { if (screws === 1) onSecure(); else onUnsecure(); }, [screws]);
  return (
    <group position={[-0.5, 0.09, 0.73]}> 
      <primitive object={scene} scale={0.45} rotation={[-1.55, 0, 0]} onClick={(e: any) => { e.stopPropagation(); onRemove(); }} onPointerOver={(e: any) => { e.stopPropagation(); if (!isScrewEquipped) document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-0.9, 0.01, 0]} onFasten={() => setScrews(1)} onUnfasten={() => setScrews(0)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <FloatingStatus isSecured={screws === 1} pendingText={`Fasten Screw (${screws}/1)`} securedText="Storage Installed" position={[0, 0.8, 0]} />
    </group>
  );
}

function ChassisModel({ onSecure, onUnsecure, onRemove }: any) {
  const { scene } = useGLTF(chassisModel);
  useEffect(() => { onSecure(); }, [onSecure]);
  return (
    <group position={[1.6, -0.9, 1.5]}> 
      <primitive object={scene} scale={10} rotation={[-1.585, 0, 0]} onClick={(e: any) => { e.stopPropagation(); onRemove(); }} onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />
    </group>
  );
}

function PSUModel({ onSecure, onUnsecure, onRemove, isScrewEquipped, onScrewError, isPrebuilt }: any) {
  const { scene } = useGLTF(psuModel); 
  const [screws, setScrews] = useState(isPrebuilt ? 4 : 0);
  useEffect(() => { if (screws === 4) onSecure(); else onUnsecure(); }, [screws]);
  return (
    <group position={[-0.38, 1.1, 4.3]}> 
      <primitive object={scene} scale={0.9} rotation={[0.57, 1.6, 1]} onClick={(e: any) => { e.stopPropagation(); onRemove(); }} onPointerOver={(e: any) => { e.stopPropagation(); if (!isScrewEquipped) document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-1.84, 1.23, -0.68]} screwRotation={[Math.PI / 1, 0, 1.5]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-1.84, 1.23, 0.68]} screwRotation={[Math.PI / 1, 0, 1.5]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-1.8, -1, -0.68]} screwRotation={[Math.PI / 1, 0, 1.5]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <InteractiveScrew isPrebuilt={isPrebuilt} position={[-1.78, -1, 0.68]} screwRotation={[Math.PI / 1, 0, 1.5]} onFasten={() => setScrews(s => s + 1)} onUnfasten={() => setScrews(s => s - 1)} isScrewEquipped={isScrewEquipped} onScrewError={onScrewError} />
      <FloatingStatus isSecured={screws === 4} pendingText={`Fasten Screws (${screws}/4)`} securedText="Power Supply Installed" />
    </group>
  );
}

// --- THE MAIN SCREEN COMPONENT ---
export function PCSimulator3D() {
  const navigate = useNavigate();
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [activeInventoryItem, setActiveInventoryItem] = useState<string | null>(null);
  const [installedParts, setInstalledParts] = useState<string[]>([]);
  const [securedParts, setSecuredParts] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScrewEquipped, setIsScrewEquipped] = useState(false);
  const [partToUninstall, setPartToUninstall] = useState<string | null>(null); 
  
  const [mode, setMode] = useState<'assemble' | 'disassemble'>('assemble');
  const [showAssemblySuccess, setShowAssemblySuccess] = useState(false);
  const [showDisassemblySuccess, setShowDisassemblySuccess] = useState(false);
  const [resetKey, setResetKey] = useState(0); 
  const [isInventoryMenuOpen, setIsInventoryMenuOpen] = useState(false);

  // --- GRANULAR SECURITY LOCKOUT STATE ---
  const [isLocked, setIsLocked] = useState(false);

  // --- REAL-TIME SECURITY LISTENER ---
  useEffect(() => {
    const fetchLockStatus = async () => {
      const { data } = await supabase.from('system_status').select('*').eq('id', 1).single();
      if (data) setIsLocked(data.maintenance_mode || data.pc_sim_locked);
    };
    fetchLockStatus();

    const channel = supabase
      .channel('pc-sim-lock')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_status' }, (payload) => {
        const newData = payload.new;
        setIsLocked(newData.maintenance_mode || newData.pc_sim_locked);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveProgressToDB = async (moduleName: string, percentage: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; 

      const { data: existingRecord } = await supabase
        .from('module_progress')
        .select('id, completion_percentage')
        .eq('user_id', user.id)
        .eq('module_name', moduleName)
        .single();

      if (existingRecord) {
        if (percentage > existingRecord.completion_percentage) {
          await supabase
            .from('module_progress')
            .update({ completion_percentage: percentage, updated_at: new Date().toISOString() })
            .eq('id', existingRecord.id);
        }
      } else {
        await supabase
          .from('module_progress')
          .insert([{
            user_id: user.id,
            module_name: moduleName,
            completion_percentage: percentage
          }]);
      }
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  };

  useEffect(() => {
    if (mode === 'assemble' && INVENTORY.length > 0) {
      const currentProgress = Math.round((securedParts.length / INVENTORY.length) * 100);
      if (currentProgress > 0) saveProgressToDB('pc-simulator', currentProgress);
      if (securedParts.length === INVENTORY.length) setShowAssemblySuccess(true);
    }
  }, [securedParts.length, mode]);

  useEffect(() => {
    if (mode === 'disassemble' && installedParts.length === 0) setShowDisassemblySuccess(true);
  }, [installedParts, mode]);

  const startAssembly = () => {
    setMode('assemble');
    setInstalledParts([]); setSecuredParts([]); setShowAssemblySuccess(false); setShowDisassemblySuccess(false);
    setErrorMessage(null); setSelectedComponent(null); setIsScrewEquipped(false); setPartToUninstall(null);
    setResetKey(k => k + 1); setIsInventoryMenuOpen(false);
  };

  const startDisassembly = () => {
    setMode('disassemble');
    const allIds = INVENTORY.map(i => i.id);
    setInstalledParts(allIds); setSecuredParts(allIds); setShowAssemblySuccess(false); setShowDisassemblySuccess(false);
    setErrorMessage(null); setSelectedComponent(null); setIsScrewEquipped(false); setPartToUninstall(null);
    setResetKey(k => k + 1); setIsInventoryMenuOpen(false);
  };

  const handleInstallAttempt = () => {
    if (isScrewEquipped) return; 
    if (activeInventoryItem && !installedParts.includes(activeInventoryItem)) {
      const itemDef = INVENTORY.find(i => i.id === activeInventoryItem);
      if (itemDef) {
        const missingReqs = itemDef.requires.filter(req => !securedParts.includes(req));
        if (missingReqs.length > 0) {
          const missingNames = missingReqs.map(r => INVENTORY.find(i => i.id === r)?.name).join(', ');
          setErrorMessage(`PLEASE NOTE: Install the ${missingNames} first!`);
          setSelectedComponent('Action Blocked');
          return; 
        }
        setInstalledParts(prev => [...prev, activeInventoryItem]);
        setActiveInventoryItem(null); setErrorMessage(null); setSelectedComponent(`${itemDef.name} Placed`); 
      }
    }
  };

  const handleSelectForRemoval = (partId: string) => {
    if (isScrewEquipped) return; 
    const itemDef = INVENTORY.find(i => i.id === partId);
    setPartToUninstall(partId); setSelectedComponent(itemDef?.name || 'Component'); setErrorMessage(null);
  };

  const executeUninstall = () => {
    if (!partToUninstall) return;
    const partId = partToUninstall;
    const itemDef = INVENTORY.find(i => i.id === partId);

    const dependents = INVENTORY.filter(item => installedParts.includes(item.id) && item.requires.includes(partId));
    if (dependents.length > 0) {
      const depNames = dependents.map(d => d.name).join(', ');
      setErrorMessage(`PLEASE NOTE: Remove the ${depNames} first!`); return;
    }

    if (itemDef && itemDef.screwCount > 0 && securedParts.includes(partId)) {
      setErrorMessage(`PLEASE NOTE: Use the Screw Kit to remove all screws first!`); return;
    }

    setInstalledParts(prev => prev.filter(id => id !== partId));
    setSecuredParts(prev => prev.filter(id => id !== partId)); 
    setErrorMessage(null); setSelectedComponent(`${itemDef?.name || 'Component'} Removed`); setPartToUninstall(null); 
  };

  const handlePartSecured = (partId: string) => setSecuredParts(prev => prev.includes(partId) ? prev : [...prev, partId]);
  const handlePartUnsecured = (partId: string) => setSecuredParts(prev => prev.filter(id => id !== partId));

  const handleScrewError = () => {
    setErrorMessage("TOOL REQUIRED: Please equip the Screw Kit first!");
    setSelectedComponent("Action Blocked");
  };

  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col overflow-hidden touch-none">
      
      {/* --- THE LOCKOUT OVERLAY --- */}
      <AnimatePresence>
        {isLocked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[999] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
            <Lock className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
            <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-widest mb-2">Simulator Locked</h1>
            <p className="text-slate-400 font-mono text-sm mb-8 max-w-md">The PC Simulator module has been locked by your instructor. Please return to your dashboard.</p>
            <Button onClick={() => navigate(-1)} className="bg-red-500 hover:bg-red-400 text-slate-950 font-bold uppercase tracking-widest px-8">
              Return to Dashboard
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="hidden md:block absolute top-6 left-6 z-10 text-white font-mono pointer-events-none">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-widest flex items-center gap-2">
          PC Assembly Training
          <Badge className={`bg-slate-900 border ${mode === 'assemble' ? 'border-cyan-500 text-cyan-400' : 'border-amber-500 text-amber-400'}`}>
            {mode.toUpperCase()} MODE
          </Badge>
        </h1>
        <p className="text-xs text-slate-400 mt-1">Place components and secure all mounting screws.</p>
      </div>

      <div className="hidden md:flex absolute top-6 left-6 z-20 mt-20 flex-col gap-2">
        <Button 
          onClick={startAssembly} 
          className={`border justify-start w-48 font-mono tracking-widest text-[10px] uppercase transition-all
            ${mode === 'assemble' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'bg-slate-900/80 text-cyan-500 border-cyan-500/50 hover:bg-cyan-500/20 backdrop-blur-md'}`}
        >
          <Box className="w-4 h-4 mr-3" /> Assemble Mode
        </Button>
        <Button 
          onClick={startDisassembly} 
          className={`border justify-start w-48 font-mono tracking-widest text-[10px] uppercase transition-all
            ${mode === 'disassemble' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 'bg-slate-900/80 text-amber-500 border-amber-500/50 hover:bg-amber-500/20 backdrop-blur-md'}`}
        >
          <Wrench className="w-4 h-4 mr-3" /> Disassemble Mode
        </Button>
      </div>

      <AnimatePresence>
        {showAssemblySuccess && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: -50 }} className="absolute top-1/4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-[90vw] md:w-auto">
            <div className="bg-emerald-950/90 backdrop-blur-xl border-2 border-emerald-400 p-6 md:p-8 rounded-2xl shadow-[0_0_50px_rgba(52,211,153,0.5)] text-center flex flex-col items-center">
              <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-emerald-400 mb-4 animate-bounce" />
              <h2 className="text-xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-400 uppercase tracking-[0.2em] mb-2">PC Assembly Complete</h2>
              <p className="text-emerald-300 font-mono text-[10px] md:text-sm uppercase tracking-widest mb-6">All hardware components installed correctly.</p>
              <Button onClick={() => setShowAssemblySuccess(false)} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest text-xs px-8">Proceed</Button>
            </div>
          </motion.div>
        )}

        {showDisassemblySuccess && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: -50 }} className="absolute top-1/4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-[90vw] md:w-auto">
            <div className="bg-amber-950/90 backdrop-blur-xl border-2 border-amber-400 p-6 md:p-8 rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.5)] text-center flex flex-col items-center">
              <Wrench className="w-12 h-12 md:w-16 md:h-16 text-amber-400 mb-4 animate-[spin_4s_linear_infinite]" />
              <h2 className="text-xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-400 uppercase tracking-[0.2em] mb-2">Disassembly Complete</h2>
              <p className="text-amber-300 font-mono text-[10px] md:text-sm uppercase tracking-widest mb-6">All parts have been removed successfully.</p>
              <Button onClick={() => setShowDisassemblySuccess(false)} className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold uppercase tracking-widest text-xs px-8">Acknowledge</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedComponent && (
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="absolute top-4 right-4 md:top-6 md:right-6 z-20 w-[45vw] md:w-80">
            <Card className={`bg-slate-900/90 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.2)] ${errorMessage ? 'border-red-500' : 'border-cyan-500/50'}`}>
              <div className="flex justify-between items-center p-2 md:p-3 border-b border-white/10">
                <span className={`text-[9px] md:text-[10px] font-mono uppercase tracking-widest font-bold flex items-center gap-2 ${errorMessage ? 'text-red-400' : 'text-cyan-400'}`}>
                  <Cpu className="w-3 h-3" /> <span className="hidden sm:inline">Part Details</span>
                </span>
                <button onClick={() => { setSelectedComponent(null); setPartToUninstall(null); }} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <CardContent className="p-3 md:p-5">
                <h2 className={`text-[10px] md:text-xl font-bold uppercase tracking-wider mb-1 ${errorMessage ? 'text-red-400' : 'text-white'}`}>
                  {selectedComponent}
                </h2>
                {errorMessage && <p className="text-[9px] md:text-xs text-red-300 font-mono mt-2 bg-red-950/50 p-2 rounded border border-red-500/30">{errorMessage}</p>}
                {partToUninstall && installedParts.includes(partToUninstall) && (
                  <Button onClick={executeUninstall} className="w-full mt-4 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white uppercase tracking-widest text-[9px] md:text-[10px]">
                    Uninstall
                  </Button>
                )}
                <div className="space-y-2 mt-4 font-mono text-[9px] md:text-[10px]">
                  <div className="flex flex-col md:flex-row md:justify-between border-b border-white/5 pb-1 gap-1">
                    <span className="text-slate-500 uppercase">Installed Parts</span>
                    <span className="text-cyan-300">{securedParts.length} / {INVENTORY.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="hidden md:block absolute bottom-40 right-6 z-20">
        <Button
          onClick={() => { setIsScrewEquipped(!isScrewEquipped); setActiveInventoryItem(null); }}
          className={`px-6 py-6 rounded-2xl font-mono text-sm uppercase tracking-widest border transition-all flex items-center gap-3 shadow-2xl
            ${isScrewEquipped ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] scale-105' : 'bg-slate-900/90 text-slate-400 border-white/20 hover:border-cyan-500/50 hover:text-cyan-400 backdrop-blur-xl'}`}
        >
          <Wrench className={`w-5 h-5 ${isScrewEquipped ? 'animate-bounce' : ''}`} />
          <span>{isScrewEquipped ? 'Tool Equipped' : 'Equip Screw Kit'}</span>
        </Button>
      </motion.div>

      <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-4xl bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent snap-x">
          {INVENTORY.filter(item => !installedParts.includes(item.id)).map((item) => {
            const isActive = activeInventoryItem === item.id;
            const isLocked = item.requires.some(req => !securedParts.includes(req));

            return (
              <motion.div
                key={item.id}
                whileHover={isLocked ? {} : { y: -5 }}
                onClick={() => { 
                  if (!isLocked) { setActiveInventoryItem(isActive ? null : item.id); setIsScrewEquipped(false); }
                }}
                className={`snap-center flex-shrink-0 w-32 h-32 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden group
                  ${isLocked ? 'bg-slate-950/20 border-white/5 opacity-40 cursor-not-allowed' : isActive ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] cursor-pointer' : 'bg-slate-950/50 border-white/10 hover:border-white/30 cursor-pointer'}`}
              >
                {isActive && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent w-full h-full animate-[scan_2s_linear_infinite]" />}
                <item.icon className={`w-8 h-8 ${isLocked ? 'text-slate-600' : isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                <div className="text-center z-10 px-1">
                  <p className={`font-bold text-sm truncate w-full ${isLocked ? 'text-slate-500' : isActive ? 'text-white' : 'text-slate-300'}`}>{item.name}</p>
                  <p className="text-[9px] font-mono text-slate-500 uppercase mt-1 truncate w-full">{isLocked ? 'LOCKED' : item.specs}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 p-2 rounded-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Button 
          onClick={() => setIsInventoryMenuOpen(!isInventoryMenuOpen)}
          className={`rounded-full px-4 h-10 font-bold uppercase tracking-widest text-[10px] transition-all ${isInventoryMenuOpen ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-cyan-400 hover:bg-slate-700 hover:text-cyan-300'}`}
        >
          <Layers className="w-4 h-4 mr-2" /> Tools & Parts
        </Button>
        <div className="w-px h-6 bg-white/10" />
        <Button 
          onClick={() => { setIsScrewEquipped(!isScrewEquipped); setActiveInventoryItem(null); setIsInventoryMenuOpen(false); }}
          className={`rounded-full px-4 h-10 font-bold uppercase tracking-widest text-[10px] transition-all ${isScrewEquipped ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-105' : 'bg-slate-800 text-amber-400 hover:bg-slate-700 hover:text-amber-300'}`}
        >
          <Wrench className={`w-4 h-4 mr-2 ${isScrewEquipped ? 'animate-bounce' : ''}`} /> 
          <span>{isScrewEquipped ? 'Tool Eqp' : 'Screw Kit'}</span>
        </Button>
      </div>

      <AnimatePresence>
        {isInventoryMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInventoryMenuOpen(false)} className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 w-[95vw] max-w-lg z-50 bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(34,211,238,0.2)] overflow-hidden"
            >
              <div className="flex justify-between items-center p-3 border-b border-cyan-500/20 bg-slate-950/50">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-2">
                  <Box className="w-4 h-4" /> Tools & Parts
                </span>
                <button onClick={() => setIsInventoryMenuOpen(false)} className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex gap-2 p-3 border-b border-white/5 bg-slate-900/50">
                <Button 
                  onClick={startAssembly} 
                  className={`flex-1 font-mono tracking-widest text-[9px] uppercase transition-all ${mode === 'assemble' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-transparent text-cyan-500 border border-cyan-500/30 hover:bg-cyan-500/10'}`}
                >
                  Assemble
                </Button>
                <Button 
                  onClick={startDisassembly} 
                  className={`flex-1 font-mono tracking-widest text-[9px] uppercase transition-all ${mode === 'disassemble' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'bg-transparent text-amber-500 border border-amber-500/30 hover:bg-amber-500/10'}`}
                >
                  Disassemble
                </Button>
              </div>

              <div className="p-3 grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
                {INVENTORY.filter(item => !installedParts.includes(item.id)).map((item) => {
                  const isActive = activeInventoryItem === item.id;
                  const isLocked = item.requires.some(req => !securedParts.includes(req));

                  return (
                    <motion.div
                      key={item.id}
                      whileHover={isLocked ? {} : { y: -2 }}
                      onClick={() => { 
                        if (!isLocked) {
                          setActiveInventoryItem(isActive ? null : item.id);
                          setIsScrewEquipped(false); 
                          setIsInventoryMenuOpen(false); 
                        }
                      }}
                      className={`aspect-square rounded-xl border transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden group
                        ${isLocked ? 'bg-slate-950/20 border-white/5 opacity-40 cursor-not-allowed' 
                        : isActive ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] cursor-pointer' 
                        : 'bg-slate-950/50 border-white/10 hover:border-white/30 cursor-pointer'}`}
                    >
                      {isActive && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent w-full h-full animate-[scan_2s_linear_infinite]" />}
                      <item.icon className={`w-5 h-5 ${isLocked ? 'text-slate-600' : isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                      <div className="text-center z-10 px-1">
                        <p className={`font-bold text-[9px] truncate w-16 ${isLocked ? 'text-slate-500' : isActive ? 'text-white' : 'text-slate-300'}`}>{item.name}</p>
                        <p className="text-[7px] font-mono text-slate-500 uppercase mt-0.5 truncate w-16">{isLocked ? 'LOCKED' : item.specs}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Canvas 
        camera={{ position: [0, 4, 6], fov: 45 }} 
        className="w-full h-full"
        style={{ cursor: isScrewEquipped ? "url('/screwdriver.png') 16 16, crosshair" : "grab" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <Environment preset="city" /> 
        <ContactShadows position={[0, -1.5, 0]} opacity={0.7} scale={10} blur={2} far={4} color="#000000" />
        <OrbitControls makeDefault enablePan={true} enableZoom={true} />

        <Suspense fallback={<Html center><div className="text-cyan-400 font-mono animate-pulse text-xs">Loading Simulator...</div></Html>}>
          <HardwareModel onSelect={() => { if (!errorMessage) setSelectedComponent('Primary Motherboard'); setPartToUninstall(null); }} />

          {activeInventoryItem && !isScrewEquipped && (
            <InstallNode position={INSTALL_ZONES[activeInventoryItem] || [0,0,0]} onInstall={handleInstallAttempt} />
          )}

          <group key={resetKey}>
            {installedParts.includes('cpu') && <CPUModel onSecure={() => handlePartSecured('cpu')} onUnsecure={() => handlePartUnsecured('cpu')} onRemove={() => handleSelectForRemoval('cpu')} />}
            {installedParts.includes('ram') && <RAMModel onSecure={() => handlePartSecured('ram')} onUnsecure={() => handlePartUnsecured('ram')} onRemove={() => handleSelectForRemoval('ram')} />} 
            {installedParts.includes('storage') && <StorageModel isPrebuilt={mode === 'disassemble'} onSecure={() => handlePartSecured('storage')} onUnsecure={() => handlePartUnsecured('storage')} onRemove={() => handleSelectForRemoval('storage')} isScrewEquipped={isScrewEquipped} onScrewError={handleScrewError} />}
            {installedParts.includes('cooler') && <CoolerModel isPrebuilt={mode === 'disassemble'} onSecure={() => handlePartSecured('cooler')} onUnsecure={() => handlePartUnsecured('cooler')} onRemove={() => handleSelectForRemoval('cooler')} isScrewEquipped={isScrewEquipped} onScrewError={handleScrewError} />}
            {installedParts.includes('chassis') && <ChassisModel onSecure={() => handlePartSecured('chassis')} onUnsecure={() => handlePartUnsecured('chassis')} onRemove={() => handleSelectForRemoval('chassis')} />}
            {installedParts.includes('gpu') && <GPUModel isPrebuilt={mode === 'disassemble'} onSecure={() => handlePartSecured('gpu')} onUnsecure={() => handlePartUnsecured('gpu')} onRemove={() => handleSelectForRemoval('gpu')} isScrewEquipped={isScrewEquipped} onScrewError={handleScrewError} />}
            {installedParts.includes('psu') && <PSUModel isPrebuilt={mode === 'disassemble'} onSecure={() => handlePartSecured('psu')} onUnsecure={() => handlePartUnsecured('psu')} onRemove={() => handleSelectForRemoval('psu')} isScrewEquipped={isScrewEquipped} onScrewError={handleScrewError} />}
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(motherboardModel);
useGLTF.preload(cpuModel); 
useGLTF.preload(ramModel);
useGLTF.preload(gpuModel);
useGLTF.preload(coolerModel);
useGLTF.preload(storageModel);
useGLTF.preload(chassisModel);
useGLTF.preload(psuModel);