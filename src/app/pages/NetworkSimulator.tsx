import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Router, Network, Server, Monitor, 
  TerminalSquare, Trash2, Send, X, ShieldCheck,
  Wifi, Link2, GitCommit, RadioTower, Undo2, Wrench, AlertCircle, CheckCircle2, Info, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from "../../lib/supabaseClient"; 

type NodeType = 'router' | 'switch' | 'server' | 'terminal' | 'access-point';
type LinkType = 'straight' | 'crossover' | 'wireless';
type ToolMode = NodeType | LinkType | 'ping' | 'idle';

interface NetNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  ip: string;
  subnet: string;
  gateway: string;
  mac: string;
}

interface NetLink {
  id: string;
  source: string;
  target: string;
  type: LinkType;
}

interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const generateMAC = () => "XX:XX:XX:XX:XX:XX".replace(/X/g, () => "0123456789ABCDEF".charAt(Math.floor(Math.random() * 16)));

const calculateNetworkAddress = (ip: string, subnet: string) => {
  if (!ip || !subnet) return null;
  const ipParts = ip.split('.').map(Number);
  const subnetParts = subnet.split('.').map(Number);
  if (ipParts.length !== 4 || subnetParts.length !== 4 || ipParts.some(isNaN) || subnetParts.some(isNaN)) return null;
  return ipParts.map((part, i) => part & subnetParts[i]).join('.');
};

const getCorrectCable = (type1: NodeType, type2: NodeType): LinkType => {
  const mdi = ['terminal', 'server', 'router', 'access-point'];
  const isType1MDI = mdi.includes(type1);
  const isType2MDI = mdi.includes(type2);
  return isType1MDI === isType2MDI ? 'crossover' : 'straight';
};

export function NetworkSimulator() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<NetNode[]>([]);
  const [links, setLinks] = useState<NetLink[]>([]);
  const [history, setHistory] = useState<{nodes: NetNode[], links: NetLink[]}[]>([]);
  
  const [activeTool, setActiveTool] = useState<ToolMode>('idle');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pingPath, setPingPath] = useState<{ nodes: string[], activeHop: number } | null>(null);
  
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const preDragState = useRef<{nodes: NetNode[], links: NetLink[]} | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const [editIP, setEditIP] = useState('');
  const [editSubnet, setEditSubnet] = useState('');
  const [editGateway, setEditGateway] = useState('');

  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false);

  // --- GRANULAR SECURITY LOCKOUT STATE ---
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const fetchLockStatus = async () => {
      const { data } = await supabase.from('system_status').select('*').eq('id', 1).single();
      if (data) setIsLocked(data.maintenance_mode || data.net_sim_locked);
    };
    fetchLockStatus();

    const channel = supabase
      .channel('net-sim-lock')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_status' }, (payload) => {
        const newData = payload.new;
        setIsLocked(newData.maintenance_mode || newData.net_sim_locked);
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

  const saveHistory = () => setHistory(prev => [...prev.slice(-19), { nodes, links }]); 

  const handleUndo = () => {
    setHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory;
      const newHistory = [...prevHistory];
      const lastState = newHistory.pop();
      if (lastState) {
        setNodes(lastState.nodes);
        setLinks(lastState.links);
        setSelectedNode(null);
        setSelectedLink(null);
        showToast("Last action reverted.", "warning");
      }
      return newHistory;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('idle'); setSelectedNode(null); setSelectedLink(null);
        setIsToolMenuOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, links]); 

  useEffect(() => showToast("Network Simulator Ready. Select a device to begin.", 'info'), []);

  useEffect(() => {
    const node = nodes.find(n => n.id === selectedNode);
    if (node) { setEditIP(node.ip); setEditSubnet(node.subnet); setEditGateway(node.gateway); }
  }, [selectedNode, nodes]);

  useEffect(() => {
    if (pingPath && pingPath.activeHop > 0) {
      if (pingPath.activeHop < pingPath.nodes.length) {
        const timer = setTimeout(() => setPingPath(prev => prev ? { ...prev, activeHop: prev.activeHop + 1 } : null), 800); 
        return () => clearTimeout(timer);
      } else if (pingPath.activeHop === pingPath.nodes.length) {
        const targetIp = nodes.find(n => n.id === pingPath.nodes[pingPath.nodes.length - 1])?.ip;
        showToast(`Reply from ${targetIp}: bytes=32 time=${Math.floor(Math.random() * 12) + 2}ms TTL=128`, 'success');
        saveProgressToDB('network-sim', 100);
        const cleanup = setTimeout(() => setPingPath(null), 1500);
        return () => clearTimeout(cleanup);
      }
    }
  }, [pingPath?.activeHop]);

  const showToast = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({ id: Date.now().toString(), text, type });
    setTimeout(() => setToast(null), 4000); 
  };

  const handleCanvasClick = (e: ReactMouseEvent) => {
    if (activeTool === 'idle' || ['straight', 'crossover', 'wireless', 'ping'].includes(activeTool)) {
      if (e.target === canvasRef.current || (e.target as HTMLElement).tagName.toLowerCase() === 'svg') {
        setSelectedNode(null); setSelectedLink(null);
      }
      return;
    }
    
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    saveHistory(); 
    const newNode: NetNode = {
      id: Date.now().toString(),
      type: activeTool as NodeType,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      label: `${activeTool.toUpperCase()}_${nodes.length + 1}`,
      ip: '0.0.0.0', subnet: '255.255.255.0', gateway: '0.0.0.0', mac: generateMAC()
    };

    setNodes([...nodes, newNode]);
    showToast(`Hardware deployed: ${newNode.label}`, 'success');
    
    if (nodes.length === 0) saveProgressToDB('network-sim', 25);
    setActiveTool('idle'); 
  };

  const handleNodePointerDown = (e: ReactPointerEvent, nodeId: string) => {
    if (activeTool !== 'idle') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId); 
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    preDragState.current = { nodes, links }; 
    const rect = canvasRef.current.getBoundingClientRect();
    
    setDraggingNode(nodeId);
    setDragOffset({ x: e.clientX - rect.left - node.x, y: e.clientY - rect.top - node.y });
    setHasDragged(false);
  };

  const handleNodePointerMove = (e: ReactPointerEvent, nodeId: string) => {
    if (draggingNode !== nodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setHasDragged(true);
    setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: e.clientX - rect.left - dragOffset.x, y: e.clientY - rect.top - dragOffset.y } : n));
  };

  const handleNodePointerUp = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as Element).releasePointerCapture(e.pointerId);

    if (draggingNode) {
      if (hasDragged && preDragState.current) setHistory(prev => [...prev.slice(-19), preDragState.current!]); 
      setDraggingNode(null);
      setTimeout(() => setHasDragged(false), 50); 
    }
  };

  const handleNodeClick = (e: ReactMouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (hasDragged) return; 

    if (['straight', 'crossover', 'wireless'].includes(activeTool)) {
      if (!selectedNode) {
        setSelectedNode(nodeId); setSelectedLink(null); showToast(`Select target device to terminate connection.`, 'info');
      } else if (selectedNode !== nodeId) {
        const sourceNodeData = nodes.find(n => n.id === selectedNode);
        const targetNodeData = nodes.find(n => n.id === nodeId);
        if (!sourceNodeData || !targetNodeData) return;

        if (activeTool === 'wireless') {
          if (sourceNodeData.type !== 'access-point' && targetNodeData.type !== 'access-point') {
            showToast(`Wireless connections require at least one Access Point.`, 'error'); setSelectedNode(null); return;
          }
        } else {
          const requiredCable = getCorrectCable(sourceNodeData.type, targetNodeData.type);
          if (activeTool !== requiredCable) {
            showToast(`Cable Mismatch! Requires a ${requiredCable.toUpperCase()} cable.`, 'error'); setSelectedNode(null); return;
          }
        }

        saveHistory();
        const newLink: NetLink = { id: `${selectedNode}-${nodeId}`, source: selectedNode, target: nodeId, type: activeTool as LinkType };
        if (!links.some(l => (l.source === newLink.source && l.target === newLink.target) || (l.source === newLink.target && l.target === newLink.source))) {
          setLinks([...links, newLink]); showToast(`${activeTool.toUpperCase()} link established.`, 'success');
          
          if (links.length === 0) saveProgressToDB('network-sim', 50);
        } else showToast(`Devices already connected.`, 'warning');
        
        setSelectedNode(null);
      }
    } else if (activeTool === 'ping') {
      if (!selectedNode) {
        const node = nodes.find(n => n.id === nodeId);
        if (node?.ip === '0.0.0.0') showToast(`Source device IP is unconfigured. Ping aborted.`, 'error');
        else { setSelectedNode(nodeId); showToast(`Source ${node?.ip} selected. Select target destination...`, 'info'); }
      } else if (selectedNode !== nodeId) {
        const sourceNode = nodes.find(n => n.id === selectedNode);
        const targetNode = nodes.find(n => n.id === nodeId);
        if (!sourceNode || !targetNode) return;

        if (targetNode.ip === '0.0.0.0') { showToast(`Target device IP is unconfigured. Request timed out.`, 'error'); setSelectedNode(null); return; }

        const sourceNet = calculateNetworkAddress(sourceNode.ip, sourceNode.subnet);
        const targetNet = calculateNetworkAddress(targetNode.ip, targetNode.subnet);
        const isSameNetwork = sourceNet === targetNet && sourceNet !== null;

        if (!isSameNetwork) {
          if (sourceNode.gateway === '0.0.0.0' || !sourceNode.gateway) { showToast(`Transmit failed. General failure (No default gateway).`, 'error'); setSelectedNode(null); return; }
          const sourceGatewayNet = calculateNetworkAddress(sourceNode.gateway, sourceNode.subnet);
          if (sourceGatewayNet !== sourceNet) { showToast(`Transmit failed. Configured gateway ${sourceNode.gateway} is unreachable.`, 'error'); setSelectedNode(null); return; }
        }

        const queue = [[selectedNode]];
        const visited = new Set([selectedNode]);
        let foundPath: string[] | null = null;

        while(queue.length > 0) {
          const path = queue.shift()!;
          const current = path[path.length - 1];
          if (current === nodeId) { foundPath = path; break; }

          const neighborLinks = links.filter(l => l.source === current || l.target === current);
          for (const link of neighborLinks) {
            const neighborId = link.source === current ? link.target : link.source;
            if (!visited.has(neighborId)) { visited.add(neighborId); queue.push([...path, neighborId]); }
          }
        }

        if (foundPath) {
          if (!isSameNetwork) {
            const pathHasRouter = foundPath.some(id => nodes.find(n => n.id === id)?.type === 'router');
            if (!pathHasRouter) { showToast(`Destination Net Unreachable. No router found.`, 'error'); setSelectedNode(null); return; }
            if (targetNode.gateway === '0.0.0.0' || !targetNode.gateway) { showToast(`Request timed out. Target device lacks gateway.`, 'error'); setSelectedNode(null); return; }
          }
          showToast(`Transmitting ICMP packet from ${sourceNode.ip} to ${targetNode.ip}...`, 'info');
          setPingPath({ nodes: foundPath, activeHop: 0 });
          setTimeout(() => setPingPath(prev => prev ? { ...prev, activeHop: 1 } : null), 100);
        } else {
          showToast(`Request timed out. Destination Host Unreachable.`, 'error');
        }
        setSelectedNode(null);
      }
    } else {
      setSelectedNode(nodeId); setSelectedLink(null);
    }
  };

  const handleLinkClick = (e: ReactMouseEvent, linkId: string) => {
    e.stopPropagation();
    if (activeTool === 'idle') { setSelectedNode(null); setSelectedLink(linkId); }
  };

  const saveNodeConfig = () => {
    if (!selectedNode) return;
    saveHistory();
    setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, ip: editIP, subnet: editSubnet, gateway: editGateway } : n));
    showToast(`Network parameters updated for [${editIP}].`, 'success');
    saveProgressToDB('network-sim', 75);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    saveHistory();
    const node = nodes.find(n => n.id === selectedNode);
    setNodes(nodes.filter(n => n.id !== selectedNode));
    setLinks(links.filter(l => l.source !== selectedNode && l.target !== selectedNode));
    showToast(`Device removed: ${node?.label}`, 'error');
    setSelectedNode(null);
  };

  const deleteSelectedLink = () => {
    if (!selectedLink) return;
    saveHistory();
    setLinks(links.filter(l => l.id !== selectedLink));
    showToast(`Connection severed successfully.`, 'warning');
    setSelectedLink(null);
  };

  const clearCanvas = () => {
    saveHistory(); setNodes([]); setLinks([]); setSelectedNode(null); setSelectedLink(null);
    showToast(`Workspace cleared. All configurations wiped.`, 'warning');
    setIsToolMenuOpen(false);
  };

  const getNodeConfig = (type: NodeType) => {
    switch (type) {
      case 'router': return { icon: Router, color: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-100/50 dark:bg-fuchsia-500/20', border: 'border-fuchsia-400 dark:border-fuchsia-500/50', glow: 'shadow-[0_0_15px_rgba(232,121,249,0.5)]' };
      case 'switch': return { icon: Network, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100/50 dark:bg-cyan-500/20', border: 'border-cyan-400 dark:border-cyan-500/50', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.5)]' };
      case 'server': return { icon: Server, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100/50 dark:bg-emerald-500/20', border: 'border-emerald-400 dark:border-emerald-500/50', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.5)]' };
      case 'terminal': return { icon: Monitor, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100/50 dark:bg-amber-500/20', border: 'border-amber-400 dark:border-amber-500/50', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.5)]' };
      case 'access-point': return { icon: RadioTower, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100/50 dark:bg-blue-500/20', border: 'border-blue-400 dark:border-blue-500/50', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' };
    }
  };

  const activeNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden flex flex-col md:pt-8 md:px-8 touch-none transition-colors duration-300">
      
      {/* --- THE LOCKOUT OVERLAY --- */}
      <AnimatePresence>
        {isLocked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[999] bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center transition-colors">
            <Lock className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 transition-colors">Module Locked</h1>
            <p className="text-slate-600 dark:text-slate-400 font-mono text-sm mb-8 max-w-md transition-colors">The Network Simulator module has been locked by your instructor. Please return to your dashboard.</p>
            <Button onClick={() => navigate(-1)} className="bg-red-500 hover:bg-red-400 text-white dark:text-slate-950 font-bold uppercase tracking-widest px-8">
              Return to Dashboard
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 text-slate-900 dark:text-white opacity-[0.03] dark:opacity-20 pointer-events-none transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M0 0h40v40H0V0zm20 20v20h20V20H20z" fill="currentColor" fillRule="evenodd"/></svg>
      </div>

      <div className="w-full h-full flex flex-col relative z-10 pt-4 md:pt-0">
        
        {/* HEADER */}
        <div className="flex flex-row justify-between items-center pb-4 shrink-0 px-4 md:px-0 border-b border-slate-200 dark:border-white/10 md:border-none transition-colors">
          <div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-1">
              <TerminalSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] font-bold">Network Simulator</span>
            </motion.div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white transition-colors">Network Topology</h1>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-white/10 p-2 rounded-lg text-xs font-mono shadow-[0_0_15px_rgba(52,211,153,0.1)] transition-colors">
            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={history.length === 0} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 h-8 w-8" title="Undo Last Action">
              <Undo2 className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>

        {/* --- FULL SCREEN CANVAS WRAPPER --- */}
        <div className="flex-1 flex flex-col min-h-0 relative px-4 md:px-0 pb-4 md:pb-8">
            
          <Card className="flex-1 bg-white dark:bg-slate-800/50 border-slate-300 dark:border-slate-700/50 shadow-[inset_0_0_50px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden shrink-0 transition-colors">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none transition-colors" />

            {/* STATUS BADGES */}
            <div className="absolute top-2 left-2 md:top-4 md:left-4 z-20 flex flex-col gap-2 pointer-events-none">
              <Badge variant="outline" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md font-mono text-[9px] md:text-[10px] uppercase border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 self-start transition-colors">
                Tool: <span className="text-slate-900 dark:text-white ml-1">{activeTool.toUpperCase()}</span>
              </Badge>
              {['straight', 'crossover', 'wireless', 'ping'].includes(activeTool) && selectedNode && (
                <Badge className="bg-cyan-500 text-white dark:text-slate-950 font-mono text-[9px] md:text-[10px] uppercase animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)] self-start transition-colors">
                  Target Node to {activeTool === 'ping' ? 'Ping' : 'Connect'}
                </Badge>
              )}
            </div>

            {/* FLOATING TOAST NOTIFICATION (Replaces the Log Terminal) */}
            <AnimatePresence>
              {toast && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                >
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[10px] md:text-xs tracking-wider shadow-lg border backdrop-blur-md transition-colors
                    ${toast.type === 'error' ? 'bg-red-50/90 dark:bg-red-950/90 text-red-600 dark:text-red-200 border-red-300 dark:border-red-500/50' : 
                      toast.type === 'success' ? 'bg-emerald-50/90 dark:bg-emerald-950/90 text-emerald-600 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/50' : 
                      toast.type === 'warning' ? 'bg-amber-50/90 dark:bg-amber-950/90 text-amber-700 dark:text-amber-200 border-amber-300 dark:border-amber-500/50' : 
                      'bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-white/20'}`}
                  >
                    {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />}
                    {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
                    {toast.type === 'info' && <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
                    {toast.text}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* FLOATING NODE INSPECTOR */}
            <AnimatePresence>
              {activeTool === 'idle' && selectedNode && activeNodeData && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="absolute top-2 right-2 md:top-4 md:right-4 z-30 w-[220px] md:w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 shadow-2xl rounded-xl overflow-hidden transition-colors"
                >
                  <div className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-cyan-500/30 p-2 md:p-3 flex justify-between items-center transition-colors">
                    <span className="text-[9px] md:text-[10px] font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" /> Net Config
                    </span>
                    <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-3 md:p-4 space-y-3 md:space-y-4">
                    <div>
                      <p className="text-[8px] md:text-[9px] text-slate-500 uppercase font-mono tracking-widest mb-1">Identity / MAC</p>
                      <p className="text-xs md:text-sm font-bold text-slate-900 dark:text-white leading-tight transition-colors">{activeNodeData.label}</p>
                      <p className="text-[9px] md:text-[10px] font-mono text-slate-500">{activeNodeData.mac}</p>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-[8px] md:text-[9px] text-cyan-600 dark:text-cyan-400 font-mono uppercase tracking-widest">IPv4</Label>
                        <Input value={editIP} onChange={(e) => setEditIP(e.target.value)} className="h-7 md:h-8 bg-slate-50 dark:bg-slate-950/50 border-slate-300 dark:border-white/10 font-mono text-[10px] md:text-xs text-slate-900 dark:text-white transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[8px] md:text-[9px] text-cyan-600 dark:text-cyan-400 font-mono uppercase tracking-widest">Subnet</Label>
                        <Input value={editSubnet} onChange={(e) => setEditSubnet(e.target.value)} className="h-7 md:h-8 bg-slate-50 dark:bg-slate-950/50 border-slate-300 dark:border-white/10 font-mono text-[10px] md:text-xs text-slate-900 dark:text-white transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[8px] md:text-[9px] text-cyan-600 dark:text-cyan-400 font-mono uppercase tracking-widest">Gateway</Label>
                        <Input value={editGateway} onChange={(e) => setEditGateway(e.target.value)} className="h-7 md:h-8 bg-slate-50 dark:bg-slate-950/50 border-slate-300 dark:border-white/10 font-mono text-[10px] md:text-xs text-slate-900 dark:text-white transition-colors" />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white h-7 md:h-8 text-[10px] md:text-xs font-bold" onClick={saveNodeConfig}>Save</Button>
                      <Button variant="destructive" size="icon" className="h-7 w-7 md:h-8 md:w-8 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/40 border border-red-300 dark:border-red-500/30 shrink-0 transition-colors" onClick={deleteSelectedNode}>
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* INTERACTIVE CANVAS */}
            <div 
              ref={canvasRef}
              className={`absolute inset-0 z-10 touch-none ${activeTool !== 'idle' ? 'cursor-crosshair' : 'cursor-default'}`}
              onClick={handleCanvasClick}
            >
              {/* CABLES */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {links.map(link => {
                  const sourceNode = nodes.find(n => n.id === link.source);
                  const targetNode = nodes.find(n => n.id === link.target);
                  if (!sourceNode || !targetNode) return null;

                  const isLinkSelected = selectedLink === link.id;
                  // Light mode needs slightly darker lines so they don't wash out on a white background
                  let strokeColorLight = "rgba(6, 182, 212, 0.8)"; // cyan-500
                  let strokeColorDark = "rgba(34, 211, 238, 0.4)";  // cyan-400
                  let strokeDash = "0";
                  
                  if (link.type === 'crossover') { 
                    strokeColorLight = "rgba(217, 70, 239, 0.8)"; // fuchsia-500
                    strokeColorDark = "rgba(232, 121, 249, 0.5)"; // fuchsia-400
                    strokeDash = "8,4"; 
                  } 
                  else if (link.type === 'wireless') { 
                    strokeColorLight = "rgba(59, 130, 246, 0.8)"; // blue-500
                    strokeColorDark = "rgba(59, 130, 246, 0.4)";  // blue-400
                    strokeDash = "2,4"; 
                  }

                  return (
                    <g key={link.id}>
                      <line 
                        x1={sourceNode.x} y1={sourceNode.y} 
                        x2={targetNode.x} y2={targetNode.y} 
                        stroke="transparent" strokeWidth="25" 
                        className="cursor-pointer pointer-events-auto"
                        onClick={(e) => handleLinkClick(e, link.id)}
                      />
                      {/* Dark mode line */}
                      <line 
                        x1={sourceNode.x} y1={sourceNode.y} 
                        x2={targetNode.x} y2={targetNode.y} 
                        stroke={isLinkSelected ? "#f43f5e" : strokeColorDark} 
                        strokeWidth={isLinkSelected ? "3" : "2"} 
                        strokeDasharray={strokeDash}
                        className="hidden dark:block"
                      />
                      {/* Light mode line */}
                      <line 
                        x1={sourceNode.x} y1={sourceNode.y} 
                        x2={targetNode.x} y2={targetNode.y} 
                        stroke={isLinkSelected ? "#e11d48" : strokeColorLight} 
                        strokeWidth={isLinkSelected ? "3" : "2"} 
                        strokeDasharray={strokeDash}
                        className="block dark:hidden"
                      />
                    </g>
                  );
                })}

                {pingPath && pingPath.activeHop < pingPath.nodes.length && (
                  <motion.circle
                    r="6" fill="#10b981" style={{ filter: 'drop-shadow(0 0 8px #34d399)' }}
                    initial={{ cx: nodes.find(n => n.id === pingPath.nodes[0])?.x, cy: nodes.find(n => n.id === pingPath.nodes[0])?.y }}
                    animate={{ cx: nodes.find(n => n.id === pingPath.nodes[pingPath.activeHop])?.x, cy: nodes.find(n => n.id === pingPath.nodes[pingPath.activeHop])?.y }}
                    transition={{ duration: 0.8, ease: "linear" }}
                  />
                )}
              </svg>

              {/* NODES */}
              <AnimatePresence>
                {nodes.map(node => {
                  const config = getNodeConfig(node.type);
                  const isSelected = selectedNode === node.id;

                  return (
                    <motion.div
                      key={node.id}
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                      className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group pointer-events-auto"
                      style={{ left: node.x, top: node.y }}
                      onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                      onPointerMove={(e) => handleNodePointerMove(e, node.id)}
                      onPointerUp={handleNodePointerUp}
                      onPointerCancel={handleNodePointerUp}
                      onClick={(e) => handleNodeClick(e, node.id)}
                    >
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl border flex items-center justify-center backdrop-blur-md transition-all duration-300 bg-white dark:bg-transparent
                        ${config.bg} ${isSelected ? 'border-slate-800 dark:border-white shadow-[0_0_15px_rgba(0,0,0,0.2)] dark:shadow-[0_0_20px_rgba(255,255,255,0.8)]' : config.border} 
                        group-hover:${config.glow}`}
                      >
                        <config.icon className={`w-5 h-5 md:w-6 md:h-6 ${isSelected ? 'text-slate-900 dark:text-white' : config.color}`} />
                      </div>
                      <div className="mt-1 md:mt-2 flex flex-col items-center">
                        <span className="px-1.5 py-0.5 bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-white/10 rounded-t text-[8px] md:text-[9px] font-mono text-slate-700 dark:text-slate-300 uppercase tracking-widest backdrop-blur-md whitespace-nowrap transition-colors">
                          {node.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </Card>
          
        </div>

        {/* --- DESKTOP ONLY: FLOATING BOTTOM TOOLBAR --- */}
        <div className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-4xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-300 dark:border-white/10 rounded-2xl p-4 shadow-xl dark:shadow-2xl items-center gap-6 transition-colors">
          
          {/* Devices Section */}
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest pl-1">Hardware Devices</span>
            <div className="flex gap-2">
              {[
                { id: 'router', label: 'Router', icon: Router, color: 'text-fuchsia-500 dark:text-fuchsia-400' },
                { id: 'switch', label: 'Switch', icon: Network, color: 'text-cyan-600 dark:text-cyan-400' },
                { id: 'access-point', label: 'Wireless AP', icon: RadioTower, color: 'text-blue-500 dark:text-blue-400' },
                { id: 'server', label: 'Server', icon: Server, color: 'text-emerald-600 dark:text-emerald-400' },
                { id: 'terminal', label: 'Computer', icon: Monitor, color: 'text-amber-500 dark:text-amber-400' },
              ].map((tool) => {
                const colorCode = tool.color.split('-')[1]; // Extracts "fuchsia", "cyan", etc.
                return (
                <Button 
                  key={tool.id} variant="outline" 
                  className={`h-14 flex-1 flex-col gap-1 border transition-all rounded-xl ${activeTool === tool.id ? `bg-${colorCode}-100 dark:bg-${colorCode}-500/20 border-${colorCode}-400 ${tool.color} shadow-inner dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]` : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
                  onClick={() => { setActiveTool(tool.id as ToolMode); setSelectedNode(null); setSelectedLink(null); }}
                >
                  <tool.icon className={`w-5 h-5 ${activeTool === tool.id ? '' : tool.color}`} /> 
                  <span className="text-[9px] uppercase tracking-widest font-mono">{tool.label}</span>
                </Button>
              )})}
            </div>
          </div>

          <div className="w-px h-16 bg-slate-300 dark:bg-white/10 shrink-0 transition-colors" />

          {/* Tools & Cables Section */}
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest pl-1">Cables & Tools</span>
            <div className="flex gap-2">
              {[
                { id: 'straight', label: 'Straight', icon: Link2, color: 'text-cyan-600 dark:text-cyan-400' },
                { id: 'crossover', label: 'Crossover', icon: GitCommit, color: 'text-fuchsia-500 dark:text-fuchsia-400' },
                { id: 'wireless', label: 'Wireless', icon: Wifi, color: 'text-blue-500 dark:text-blue-400' },
                { id: 'ping', label: 'Ping Test', icon: Send, color: 'text-emerald-600 dark:text-emerald-400' },
              ].map((tool) => {
                const colorCode = tool.color.split('-')[1];
                return (
                <Button 
                  key={tool.id} variant="outline" 
                  className={`h-14 flex-1 flex-col gap-1 border transition-all rounded-xl ${activeTool === tool.id ? `bg-${colorCode}-100 dark:bg-${colorCode}-500/20 border-${colorCode}-400 ${tool.color} shadow-inner dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]` : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
                  onClick={() => { setActiveTool(tool.id as ToolMode); setSelectedNode(null); setSelectedLink(null); }}
                >
                  <tool.icon className={`w-5 h-5 ${activeTool === tool.id ? '' : tool.color}`} /> 
                  <span className="text-[9px] uppercase tracking-widest font-mono">{tool.label}</span>
                </Button>
              )})}
            </div>
          </div>

          <div className="w-px h-16 bg-slate-300 dark:bg-white/10 shrink-0 transition-colors" />

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
             <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest pl-1">Actions</span>
             <Button variant="ghost" onClick={clearCanvas} disabled={nodes.length === 0} className="h-14 flex flex-col gap-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-dashed border-slate-300 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
               <Trash2 className="w-5 h-5" />
               <span className="text-[9px] uppercase tracking-widest font-mono">Clear All</span>
             </Button>
          </div>

        </div>

        {/* --- MOBILE ONLY: FLOATING ACTION BAR --- */}
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 p-2 rounded-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-colors">
          <Button 
            onClick={() => setIsToolMenuOpen(!isToolMenuOpen)}
            className={`rounded-full px-4 h-10 font-bold uppercase tracking-widest text-[10px] transition-all ${isToolMenuOpen ? 'bg-cyan-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-cyan-700 dark:hover:text-cyan-300'}`}
          >
            <Wrench className="w-4 h-4 mr-2" /> Toolbox
          </Button>
        </div>

        {/* --- MOBILE ONLY: POPUP MODAL: TOOLBOX --- */}
        <AnimatePresence>
          {isToolMenuOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsToolMenuOpen(false)} className="md:hidden fixed inset-0 z-40 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm" />
              
              <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 w-[95vw] max-w-md z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl dark:shadow-[0_0_50px_rgba(34,211,238,0.2)] overflow-hidden transition-colors"
              >
                <div className="flex justify-between items-center p-3 border-b border-cyan-500/20 bg-slate-50/80 dark:bg-slate-950/50 transition-colors">
                  <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-2"><Wrench className="w-4 h-4" /> Component Toolbox</span>
                  <button onClick={() => setIsToolMenuOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-1"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
                  {[
                    { id: 'router', label: 'Router', icon: Router, color: 'text-fuchsia-600 dark:text-fuchsia-400' },
                    { id: 'switch', label: 'Switch', icon: Network, color: 'text-cyan-600 dark:text-cyan-400' },
                    { id: 'access-point', label: 'Wireless AP', icon: RadioTower, color: 'text-blue-600 dark:text-blue-400' },
                    { id: 'server', label: 'Server Node', icon: Server, color: 'text-emerald-600 dark:text-emerald-400' },
                    { id: 'terminal', label: 'Cadet PC', icon: Monitor, color: 'text-amber-600 dark:text-amber-400' },
                    { id: 'straight', label: 'Straight Link', icon: Link2, color: 'text-cyan-600 dark:text-cyan-400' },
                    { id: 'crossover', label: 'Crossover Link', icon: GitCommit, color: 'text-fuchsia-600 dark:text-fuchsia-400' },
                    { id: 'wireless', label: 'Wireless Link', icon: Wifi, color: 'text-blue-600 dark:text-blue-400' },
                    { id: 'ping', label: 'Ping Test', icon: Send, color: 'text-emerald-600 dark:text-emerald-400' },
                  ].map((tool) => (
                    <Button 
                      key={tool.id} variant="outline" 
                      className={`justify-start border transition-all h-10 ${activeTool === tool.id ? 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-400 text-cyan-900 dark:text-white shadow-inner dark:shadow-[inset_0_0_10px_rgba(34,211,238,0.3)]' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                      onClick={() => { setActiveTool(tool.id as ToolMode); setSelectedNode(null); setSelectedLink(null); setIsToolMenuOpen(false); }}
                    >
                      <tool.icon className={`w-4 h-4 mr-2 ${tool.color}`} /> <span className="text-[10px]">{tool.label}</span>
                    </Button>
                  ))}
                  {nodes.length > 0 && (
                    <Button variant="ghost" className="col-span-2 mt-2 text-red-500 dark:text-red-400 border border-dashed border-red-300 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 h-10 text-[10px]" onClick={clearCanvas}>
                      <Trash2 className="w-4 h-4 mr-2" /> Clear Workspace
                    </Button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}