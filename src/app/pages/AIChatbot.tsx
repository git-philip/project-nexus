import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Bot, Send, User, TerminalSquare, Cpu, 
  Network, Sparkles, Loader2, Activity, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../lib/supabaseClient';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Create the model with strict academic instructions
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", // Using 1.5-flash to bypass 503 traffic errors
  systemInstruction: "You are Nexus AI, an advanced virtual tutor and Computer Science Professor for the CNSC Computer Technology program. Your expertise covers PC Hardware, Network Topologies, System Diagnostics, and Operating Systems. Speak in a professional, encouraging, and helpful educational tone. Format your answers clearly using bullet points or short paragraphs. Never give direct answers to test questions; instead, guide the student to the answer using Socratic questioning."
});

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export function AIChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userName, setUserName] = useState<string>('Student');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // We store the chat instance in a ref so it persists across renders and remembers history
  const chatSessionRef = useRef<any>(null);

  useEffect(() => {
    // 1. Fetch user data for a personalized greeting
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (data && data.full_name) {
          // Extract just the first name or use the full name
          setUserName(data.full_name.split(' ')[0]);
        }
      }
    };
    initUser();

    // 2. Initialize the Gemini chat session
    chatSessionRef.current = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7, // Balances accuracy with conversational naturalness
      },
    });

    // 3. Add the initial welcome message
    setMessages([
      {
        id: 'welcome-msg',
        role: 'model',
        content: `Welcome to the AI Tutoring System! \n\nI am your dedicated AI Assistant for Computer Technology. I can assist you with:\n* Hardware assembly and diagnostics\n* Network topology configuration (Subnetting, IP routing)\n* System administration\n\nHow can I help you today?`,
        timestamp: new Date()
      }
    ]);
  }, []);

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      // Send to Gemini API
      const result = await chatSessionRef.current.sendMessage(userMessage);
      const responseText = result.response.text();

      // Add AI response to UI
      const newAIMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAIMsg]);
    } catch (error) {
      console.error("AI Communication Error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "[CONNECTION ERROR]: Unable to reach the AI server. Please check your internet connection and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    // Slight delay to allow state to update before sending
    setTimeout(() => {
      const form = document.getElementById('chat-form') as HTMLFormElement;
      if (form) form.requestSubmit();
    }, 100);
  };

  // Utility to safely render markdown-ish bold text from Gemini
  const formatMessage = (text: string) => {
    // Basic replacement for **bold** text to make it look nice in our UI
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={i} className="font-bold text-cyan-300">{part.slice(2, -2)}</span>;
      }
      // Handle simple newlines
      return <span key={i}>{part.split('\n').map((line, j) => <span key={j}>{line}<br/></span>)}</span>;
    });
  };

  return (
    <div className="absolute inset-0 bg-slate-950 font-sans overflow-hidden flex flex-col p-2 md:p-8 touch-none">
      
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwdjIwaDIwVjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-20 pointer-events-none" />

      <div className="max-w-5xl mx-auto w-full h-full flex flex-col relative z-10">
        
        {/* HEADER - Scaled down for mobile */}
        <div className="flex flex-row justify-between items-end pb-3 md:pb-4 shrink-0 border-b border-white/10 mb-3 md:mb-4 px-2 md:px-0">
          <div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-1">
              <TerminalSquare className="w-3 h-3 md:w-4 md:h-4 text-fuchsia-400" />
              <span className="text-[9px] md:text-[10px] text-fuchsia-400 uppercase tracking-[0.2em] font-bold">Virtual Tutor</span>
            </motion.div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight uppercase text-white">Nexus AI Assistant</h1>
          </div>
          
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-fuchsia-500/30 rounded text-fuchsia-400 font-mono text-[10px] uppercase tracking-widest">
            <Activity className="w-3 h-3 animate-pulse" /> AI System Online
          </div>
        </div>

        {/* CHAT INTERFACE */}
        <Card className="flex-1 bg-slate-900/60 backdrop-blur-xl border border-fuchsia-500/30 shadow-[0_0_30px_rgba(232,121,249,0.1)] flex flex-col overflow-hidden rounded-xl md:rounded-2xl">
          
          {/* Messages Area */}
          <CardContent className="flex-1 p-3 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-fuchsia-500/20 scrollbar-track-transparent space-y-4 md:space-y-6">
            
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  // ADDED: w-full and min-w-0 to prevent flex blowout on mobile
                  className={`flex gap-2 md:gap-3 w-full max-w-[95%] md:max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Avatar - Scaled down for mobile */}
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 border ${
                    msg.role === 'user' 
                      ? 'bg-slate-800 border-slate-600 text-slate-300' 
                      : 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.3)]'
                  }`}>
                    {msg.role === 'user' ? <User className="w-3 h-3 md:w-4 md:h-4" /> : <Bot className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>

                  {/* Message Bubble - ADDED min-w-0 to prevent pushing avatar out */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className={`text-[9px] md:text-[10px] font-mono uppercase tracking-widest px-1 ${msg.role === 'user' ? 'text-right text-slate-500' : 'text-left text-fuchsia-400/70'}`}>
                      {msg.role === 'user' ? userName : 'Nexus AI'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className={`p-3 md:p-4 rounded-2xl text-[13px] md:text-base leading-relaxed break-words ${
                      msg.role === 'user'
                        ? 'bg-slate-800 text-white rounded-tr-sm border border-slate-700'
                        : 'bg-fuchsia-950/30 text-slate-200 rounded-tl-sm border border-fuchsia-500/20'
                    }`}>
                      {formatMessage(msg.content)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 md:gap-3 w-full max-w-[95%] md:max-w-[80%] mr-auto">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-400 flex items-center justify-center shrink-0 mt-1">
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                </div>
                <div className="bg-fuchsia-950/30 border border-fuchsia-500/20 rounded-2xl rounded-tl-sm p-3 md:p-4 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} className="h-1" />
          </CardContent>

          {/* SUGGESTED PROMPTS - Shrunk font/gaps for mobile */}
          {messages.length < 3 && !isTyping && (
            <div className="px-2 md:px-4 pb-2 md:pb-3 flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => handleSuggestedPrompt("Explain the difference between a switch and a router.")} className="bg-slate-900 border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 text-[9px] md:text-[10px] uppercase font-mono tracking-wider h-7 md:h-8 px-2 md:px-3">
                <Network className="w-3 h-3 mr-1.5 md:mr-2" /> Switch vs Router
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestedPrompt("What is the purpose of applying thermal paste to a CPU?")} className="bg-slate-900 border-white/10 text-slate-400 hover:text-fuchsia-400 hover:border-fuchsia-500/30 text-[9px] md:text-[10px] uppercase font-mono tracking-wider h-7 md:h-8 px-2 md:px-3">
                <Cpu className="w-3 h-3 mr-1.5 md:mr-2" /> CPU Thermal Paste
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestedPrompt("How do I calculate the subnet mask for a /24 network?")} className="hidden sm:flex bg-slate-900 border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 text-[9px] md:text-[10px] uppercase font-mono tracking-wider h-7 md:h-8 px-2 md:px-3">
                <ShieldCheck className="w-3 h-3 mr-1.5 md:mr-2" /> Subnet Mask /24
              </Button>
            </div>
          )}

          {/* INPUT AREA - Compact for mobile */}
          <div className="p-2 md:p-4 bg-slate-950/50 border-t border-fuchsia-500/20 shrink-0">
            <form id="chat-form" onSubmit={handleSendMessage} className="relative flex items-center">
              <Sparkles className="absolute left-3 w-4 h-4 md:w-5 md:h-5 text-fuchsia-500/50 pointer-events-none" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={isTyping}
                className="w-full bg-slate-900/80 border-fuchsia-500/30 text-white pl-9 md:pl-10 pr-12 md:pr-14 h-10 md:h-14 font-mono text-xs md:text-sm focus-visible:ring-fuchsia-500/50 rounded-lg md:rounded-xl"
              />
              <Button 
                type="submit" 
                disabled={!input.trim() || isTyping}
                size="icon"
                className="absolute right-1.5 h-7 w-7 md:h-11 md:w-11 bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 rounded-md md:rounded-lg disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(232,121,249,0.3)]"
              >
                <Send className="w-3 h-3 md:w-5 md:h-5 ml-0.5 md:ml-1" />
              </Button>
            </form>
          </div>

        </Card>
      </div>
    </div>
  );
}