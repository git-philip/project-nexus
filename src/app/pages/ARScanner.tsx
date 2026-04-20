import { useState, useRef, useEffect, Suspense } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Camera, Scan, RotateCcw, Cpu, Info, List, TerminalSquare, Wifi, SwitchCamera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from '@google/generative-ai';
import motherboardModel from '../../assets/motherboard.glb';
import cpuModel from '../../assets/cpu.glb';
import ramModel from '../../assets/ram.glb';
import storageModel from '../../assets/storage.glb';
import coolerModel from '../../assets/cooler.glb';
import gpuModel from '../../assets/gpu.glb';
import chassisModel from '../../assets/chassis.glb';
import psuModel from '../../assets/psu.glb';

// --- 3D IMPORTS ---
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Float, Center } from '@react-three/drei';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

interface ComponentInfo {
  name: string;
  category: string;
  description: string;
  specs: string[];
  modelType: string; 
}

// --- 3D MODEL MAPPING ---
const MODEL_MAP: Record<string, { file: string, scale: number, rotation: [number, number, number] }> = {
  'gpu': { file: '/gpu.glb', scale: 1, rotation: [0, 0, 0] },
  'cpu': { file: '/cpu.glb', scale: 1, rotation: [1.2, 0, 0] }, 
  'ram': { file: '/ram.glb', scale: 16, rotation: [1.57, 0, 0] }, 
  'motherboard': { file: '/motherboard.glb', scale: 1.2, rotation: [1.57, 0, 0] },
  'storage': { file: '/storage.glb', scale: 1.5, rotation: [1.57, 0, 0] },
  'cooler': { file: '/cooler.glb', scale: 1.2, rotation: [0, 0, 0] },
  'chassis': { file: '/chassis.glb', scale: 8, rotation: [0, 0, 0] },
  'psu': { file: '/psu.glb', scale: 1.2, rotation: [0, 0, 0] },
};

// --- THE HOLOGRAPHIC PROJECTOR ---
function Hologram({ type }: { type: string }) {
  const modelData = MODEL_MAP[type.toLowerCase()]; 
  const spinRef = useRef<any>(null); 
  
  useFrame(() => {
    if (spinRef.current) {
      spinRef.current.rotation.y += 0.01; 
    }
  });

  if (!modelData) return null;
  
  return (
    <group ref={spinRef}>
      <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
        <Center>
          <primitive 
            object={useGLTF(modelData.file).scene} 
            scale={modelData.scale} 
            rotation={modelData.rotation || [0, 0, 0]} 
          />
        </Center>
      </Float>
    </group>
  );
}

export function ARScanner() {
  const webcamRef = useRef<Webcam>(null);
  const [scanning, setScanning] = useState(false);
  const [componentInfo, setComponentInfo] = useState<ComponentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [time, setTime] = useState(new Date());
  const [ping, setPing] = useState(24);

  // Live HUD Data
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (Math.random() > 0.7) setPing(prev => Math.max(12, prev + (Math.random() > 0.5 ? 2 : -2)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const videoConstraints = {
    facingMode: facingMode
  };

  const handleScan = async () => {
    if (!webcamRef.current) return;
    
    setScanning(true);
    setError(null);
    setComponentInfo(null); 

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Camera not ready. Check permissions.");
      
      const base64Data = imageSrc.split(",")[1];
      const imagePart = { inlineData: { data: base64Data, mimeType: "image/jpeg" } };

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        systemInstruction: "You are an expert Computer Science Professor and educational AI assistant for the CNSC Computer Technology program. Identify the object in the image and explain it clearly, accurately, and professionally to a student."
      });

      const prompt = `Analyze this image. Return ONLY a valid JSON object with no markdown formatting. 
      Make the description a detailed, 3 to 4 sentence academic explanation of the component's purpose, how it functions, and why it is important.
      
      Required JSON structure:
      { 
        "name": "Standard Component Name", 
        "category": "Standard Hardware Category", 
        "description": "Clear, educational, and detailed academic explanation...", 
        "specs": ["5 standard, realistic technical specifications relevant to this type of object"],
        "modelType": "Strictly choose ONE from this list that best matches the component: ['gpu', 'cpu', 'ram', 'motherboard', 'storage', 'cooler', 'chassis', 'psu']. If the scanned object does not fall into any of these 8 exact PC part categories, you MUST return 'none'."
      }`;

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text().trim();
      
      const cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '');
      const parsedData = JSON.parse(cleanJsonStr) as ComponentInfo;
      
      setComponentInfo(parsedData);
    } catch (err) {
      console.error("AI Analysis Error:", err);
      setError("Analysis failed. Please ensure the component is clearly visible and try again.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black font-sans overflow-hidden touch-none flex flex-col">
      
      {/* 1. CAMERA BACKGROUND */}
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        mirrored={facingMode === 'user'} 
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 z-0 ${componentInfo ? 'opacity-30 blur-md grayscale' : 'opacity-100'}`}
      />

      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwdjIwaDIwVjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-20 pointer-events-none z-10" />

      {/* 2. DESKTOP HEADER */}
      <div className="hidden md:flex flex-row justify-between items-start p-8 absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
        <div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-2">
            <TerminalSquare className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] text-cyan-400 uppercase tracking-[0.2em] font-bold">Hardware Scanner</span>
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-white">AR Component Scanner</h1>
          <p className="text-slate-400 mt-1 text-sm uppercase tracking-wider">Learn about PC parts using your camera</p>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-4 bg-slate-900/80 backdrop-blur-md border border-white/10 p-3 rounded-lg text-xs font-mono shadow-[0_0_15px_rgba(34,211,238,0.1)] text-white">
          <div className="flex flex-col"><span className="text-slate-500 uppercase text-[9px]">Time</span><span className="text-cyan-400">{time.toLocaleTimeString()}</span></div>
          <div className="w-px bg-white/10" />
          <div className="flex flex-col"><span className="text-slate-500 uppercase text-[9px]">Connection</span><span className="flex items-center gap-1 text-emerald-400"><Wifi className="w-3 h-3" /> {ping}ms</span></div>
          <div className="w-px bg-white/10" />
          <div className="flex flex-col"><span className="text-slate-500 uppercase text-[9px]">Camera Status</span><span className="text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> ONLINE</span></div>
        </motion.div>
      </div>

      {/* 3. MOBILE COMPACT HUD */}
      <div className="md:hidden absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
        <Badge variant="outline" className="bg-slate-900/80 backdrop-blur-md text-cyan-400 border-cyan-500/30 uppercase tracking-widest text-[9px] py-1">
          <Scan className="w-3 h-3 mr-1" /> AR Scanner
        </Badge>
        <Badge variant="outline" className="bg-slate-900/80 backdrop-blur-md text-emerald-400 border-emerald-500/30 uppercase tracking-widest text-[9px] py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1 inline-block" /> Online
        </Badge>
      </div>

      {/* 4. SCANNING EFFECTS & RETICLE */}
      {scanning && (
        <motion.div
          initial={{ top: "0%" }} animate={{ top: "100%" }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 bg-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,1)] z-20 pointer-events-none"
        />
      )}

      {!componentInfo && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
          <div className="w-64 h-64 md:w-80 md:h-80 relative opacity-60">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-16 md:top-32 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-xs font-mono tracking-wider shadow-lg z-50 whitespace-nowrap">
          [ERROR]: {error}
        </div>
      )}

      {/* 5. FLOATING RESULTS PANEL */}
      <AnimatePresence>
        {componentInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-30 flex flex-col lg:flex-row items-center justify-start lg:justify-center gap-4 p-4 pt-16 lg:p-8 pointer-events-none overflow-y-auto lg:overflow-hidden pb-32 lg:pb-0"
          >
            
            {/* BOX 1: Hologram Box */}
            {componentInfo.modelType !== 'none' && MODEL_MAP[componentInfo.modelType.toLowerCase()] && (
              <div className="pointer-events-auto w-full max-w-sm h-[25vh] lg:h-full lg:max-h-[500px] flex-shrink-0">
                <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
                  <ambientLight intensity={0.5} />
                  <directionalLight position={[10, 10, 5]} intensity={1.5} />
                  <pointLight position={[0, 0, 0]} color="#34d399" intensity={2} distance={5} /> 
                  <Environment preset="city" />
                  <Suspense fallback={null}><Hologram type={componentInfo.modelType} /></Suspense>
                  <OrbitControls enableZoom={false} enablePan={false} />
                </Canvas>
              </div>
            )}

            {/* CONTAINER FOR DESKTOP (Row) AND MOBILE (Column) */}
            <div className="pointer-events-auto w-full max-w-md lg:max-w-none lg:w-auto h-auto lg:h-full max-h-[500px] flex flex-col lg:flex-row gap-4 items-stretch">
              
              {/* BOX 2: Identity & Description */}
              <div className="bg-slate-950/90 backdrop-blur-xl border border-cyan-500/50 p-5 rounded-xl text-white shadow-[0_0_30px_rgba(34,211,238,0.2)] shrink-0 flex flex-col lg:w-[400px] lg:h-full lg:overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20">
                <div className="flex items-center gap-2 mb-3 border-b border-cyan-500/30 pb-2 shrink-0">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold opacity-80">Analysis Complete</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black leading-tight mb-2 tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-400 shrink-0">
                  {componentInfo.name}
                </h2>
                <Badge className="bg-slate-900 text-fuchsia-400 border border-fuchsia-500/50 text-[9px] uppercase tracking-widest shadow-[0_0_10px_rgba(232,121,249,0.2)] mb-3 w-fit shrink-0">
                  CATEGORY: {componentInfo.category}
                </Badge>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-mono">
                  &gt; {componentInfo.description}
                </p>
              </div>

              {/* BOX 3: Technical Specs */}
              <div className="bg-slate-950/80 backdrop-blur-lg border border-white/10 p-5 rounded-xl text-white shadow-xl shrink-0 flex flex-col lg:w-[350px] lg:h-full lg:overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2 shrink-0">
                  <List className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-300">Technical Specifications</span>
                </div>
                <ul className="space-y-3 font-mono">
                  {componentInfo.specs.map((spec, i) => (
                    <li key={i} className="text-[10px] md:text-xs flex items-start gap-3 text-cyan-100 bg-white/5 p-2 rounded border border-white/5">
                      <span className="text-cyan-400 mt-0.5 animate-pulse">■</span>{spec}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. FLOATING SCAN CONTROLS */}
      <div className="absolute bottom-28 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-[100] w-max">
        {!componentInfo ? (
          <>
            <Button 
              onClick={handleScan} disabled={scanning}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-full px-8 py-6 uppercase tracking-widest text-xs transition-all shadow-[0_0_30px_rgba(34,211,238,0.5)]"
            >
              {scanning ? <Scan className="animate-spin mr-2 w-4 h-4" /> : <Camera className="mr-2 w-4 h-4" />}
              {scanning ? "Analyzing..." : "Scan Part"}
            </Button>
            <Button
              onClick={() => setFacingMode(prev => prev === "environment" ? "user" : "environment")}
              disabled={scanning} variant="outline" size="icon"
              className="bg-slate-900/80 backdrop-blur-md text-cyan-400 border-cyan-500/50 rounded-full w-12 h-12 hover:bg-cyan-500/20 hover:text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all"
            >
              <SwitchCamera className="w-5 h-5" />
            </Button>
          </>
        ) : (
          <Button 
            onClick={() => setComponentInfo(null)} variant="outline"
            className="bg-slate-950/80 backdrop-blur-md text-slate-300 border-white/20 rounded-full px-8 py-6 hover:bg-white/10 hover:text-white uppercase tracking-widest text-xs transition-all shadow-xl"
          >
            <RotateCcw className="mr-2 w-4 h-4" /> Scan New Part
          </Button>
        )}
      </div>

      {/* Desktop Only: Informational Pill */}
      {!componentInfo && (
        <div className="hidden md:flex absolute bottom-28 left-1/2 -translate-x-1/2 items-center gap-2 text-slate-400 border border-white/5 bg-slate-900/60 p-3 rounded-full backdrop-blur-md z-20">
          <Info className="w-4 h-4 text-cyan-500" />
          <p className="text-[10px] uppercase font-mono tracking-widest">
            Point your camera at a PC part (Motherboard, RAM, CPU, etc.) to learn about it.
          </p>
        </div>
      )}

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