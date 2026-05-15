import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
// FIXED: Added 'User' to the lucide-react imports!
import { Bot, X, Send, Sparkles, TerminalSquare, Loader2, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", 
  systemInstruction: "You are Nexus AI, an advanced virtual tutor and Computer Science Professor for the CNSC Computer Technology program. Your expertise covers PC Hardware, Network Topologies, System Diagnostics, and Operating Systems. Speak in a professional, encouraging, and helpful educational tone. Format your answers clearly using bullet points or short paragraphs. Never give direct answers to test questions; instead, guide the student to the answer using Socratic questioning."
});

// Normalized Interface to match the full page Chatbot
interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  // --- 1. SYNCHRONIZE & LOAD HISTORY ---
  useEffect(() => {
    const loadChatHistory = () => {
      const savedHistory = localStorage.getItem('nexus_chat_messages');
      let initialMessages: Message[] = [];

      if (savedHistory) {
        initialMessages = JSON.parse(savedHistory).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } else {
        initialMessages = [{
          id: 'welcome-msg',
          role: 'model',
          content: `Welcome to the AI Tutoring System! \n\nI am your dedicated AI Assistant for Computer Technology. I can assist you with:\n* Hardware assembly and diagnostics\n* Network topology configuration (Subnetting, IP routing)\n* System administration\n\nHow can I help you today?`,
          timestamp: new Date()
        }];
        localStorage.setItem('nexus_chat_messages', JSON.stringify(initialMessages));
      }

      setMessages(initialMessages);

      // Reinitialize Gemini history
      const geminiHistory = initialMessages
        .filter(msg => msg.id !== 'welcome-msg')
        .map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }));

      chatRef.current = model.startChat({
        history: geminiHistory,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
      });
    };

    loadChatHistory();

    // Listen for updates from the Full Page Chatbot
    const handleStorageSync = () => {
      const saved = localStorage.getItem('nexus_chat_messages');
      if (saved) {
        setMessages(JSON.parse(saved).map((msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) })));
      }
    };

    window.addEventListener('nexus_chat_update', handleStorageSync);
    window.addEventListener('storage', handleStorageSync);

    return () => {
      window.removeEventListener('nexus_chat_update', handleStorageSync);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);

  // --- 2. SAVE MESSAGES HELPER ---
  const saveAndSyncMessages = (newMessages: Message[]) => {
    setMessages(newMessages);
    localStorage.setItem('nexus_chat_messages', JSON.stringify(newMessages));
    window.dispatchEvent(new Event('nexus_chat_update')); // Notify full page!
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, newUserMsg];
    saveAndSyncMessages(updatedMessages); // Save & Sync
    setIsTyping(true);

    try {
      const result = await chatRef.current.sendMessage(userMessage);
      const newAIMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: result.response.text(),
        timestamp: new Date()
      };
      saveAndSyncMessages([...updatedMessages, newAIMsg]); // Save & Sync
    } catch (error) {
      console.error('Gemini API Error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "[CONNECTION ERROR]: Neural link interrupted. Please try again.",
        timestamp: new Date()
      };
      saveAndSyncMessages([...updatedMessages, errorMsg]); // Save & Sync
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mb-4 w-[calc(100vw-3rem)] md:w-[400px] pointer-events-auto"
          >
            <Card className="bg-slate-900/95 backdrop-blur-xl border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.15)] flex flex-col h-[500px] overflow-hidden rounded-2xl">
              
              <CardHeader className="bg-slate-950/50 border-b border-white/10 p-4 flex flex-row items-center justify-between space-y-0 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
                    <TerminalSquare className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      Nexus AI <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </CardTitle>
                    <CardDescription className="text-[10px] font-mono text-cyan-400">Virtual Learning Companion</CardDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full w-8 h-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              <CardContent 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwdjIwaDIwVjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] bg-[size:20px_20px]"
              >
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="shrink-0 mt-1">
                      {msg.role === 'model' ? (
                        <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                          <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                      msg.role === 'user' 
                        ? 'bg-slate-800 text-white rounded-tr-sm border border-white/10' 
                        : 'bg-cyan-950/30 text-slate-200 rounded-tl-sm border border-cyan-500/20'
                    }`}>
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-3 flex-row">
                    <div className="shrink-0 mt-1">
                      <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                        <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                      </div>
                    </div>
                    <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-2xl rounded-tl-sm p-3 flex items-center gap-1.5">
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    </div>
                  </div>
                )}
              </CardContent>

              <div className="p-3 bg-slate-950 border-t border-white/10 shrink-0">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Sparkles className="absolute left-2.5 top-2.5 w-4 h-4 text-cyan-500/50 pointer-events-none" />
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Nexus..."
                      className="bg-slate-900 border-white/20 text-white pl-8 focus-visible:ring-cyan-500 font-mono text-xs rounded-lg h-9"
                      disabled={isTyping}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={isTyping || !input.trim()}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 shrink-0 rounded-lg h-9 w-9"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>

            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- THE FLOATING TOGGLE BUTTON --- */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 border-2 md:opacity-100 ${!isOpen && 'opacity-50 hover:opacity-100'} ${
          isOpen 
            ? 'bg-slate-800 border-slate-700 text-slate-400' 
            : 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
        }`}
      >
        {isOpen ? <X className="w-5 h-5 md:w-6 md:h-6" /> : <Bot className="w-5 h-5 md:w-7 md:h-7" />}
      </motion.button>
    </div>
  );
}