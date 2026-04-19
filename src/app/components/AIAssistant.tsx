import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Sparkles, TerminalSquare, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader } from './ui/card';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Welcome to the AI Tutoring System! I am your Computer Technology Assistant. How can I help you with your studies today?'
    }
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Keep the chat logic outside of the render cycle so history persists
  const chatRef = useRef<any>(null);

  useEffect(() => {
    // Initialize the chat session with instructions once
    if (!chatRef.current) {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", // Using 1.5-flash for high stability
        systemInstruction: "You are a helpful and advanced educational AI virtual tutor for Computer Technology students. Keep answers concise, clear, and beginner-friendly. Format responses clearly using bullet points when necessary. Guide students through PC assembly, networking, and hardware diagnostics."
      });
      chatRef.current = model.startChat({ history: [] });
    }
  }, []);

  // Auto-scroll to the bottom when a new message appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      if (!chatRef.current) throw new Error("Chat not initialized");
      
      const result = await chatRef.current.sendMessage(userMessage);
      const responseText = result.response.text();
      
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: responseText }]);
    } catch (error) {
      console.error("AI Communication Error:", error);
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: '[CONNECTION ERROR]: Unable to reach the server. Please check your internet connection and try again.' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-28 right-4 md:bottom-6 md:right-6 z-[100] flex flex-col items-end pointer-events-none">
      
      {/* --- THE FLOATING CHAT WINDOW --- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 pointer-events-auto"
          >
            <Card className="w-[85vw] sm:w-[400px] h-[60vh] max-h-[500px] min-h-[400px] flex flex-col bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/50 shadow-[0_0_50px_rgba(34,211,238,0.15)] overflow-hidden">
              
              {/* Header */}
              <CardHeader className="p-3 border-b border-cyan-500/30 bg-slate-900/50 flex flex-row items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-cyan-400" />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-white">Virtual Tutor</h3>
                    <p className="text-[9px] text-cyan-400 font-mono tracking-widest uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" /> Online
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-6 w-6 text-slate-400 hover:text-white rounded-md">
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              {/* Chat Body */}
              <CardContent className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent font-sans" ref={scrollRef}>
                {messages.map((msg) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={msg.id} 
                    className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 mb-1 px-1">
                      {msg.role === 'user' ? 'Student' : 'Virtual Tutor'}
                    </span>
                    <div className={`p-3 rounded-xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-cyan-600 text-white rounded-tr-sm' 
                        : 'bg-slate-900 border border-white/10 text-slate-300 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                
                {isTyping && (
                  <div className="self-start flex flex-col max-w-[85%]">
                     <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 mb-1 px-1">Virtual Tutor</span>
                     <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-cyan-400 rounded-tl-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-mono">Typing...</span>
                     </div>
                  </div>
                )}
              </CardContent>

              {/* Input Footer */}
              <div className="p-3 border-t border-white/10 bg-slate-900/80 shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    className="bg-slate-950 border-white/20 text-white focus-visible:ring-cyan-500 font-mono text-xs rounded-lg"
                    disabled={isTyping}
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={isTyping || !input.trim()}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 shrink-0 rounded-lg"
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
        /* Shrunk to w-10 h-10 on mobile, added 50% opacity fade when inactive */
        className={`pointer-events-auto w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 border-2 md:opacity-100 ${!isOpen && 'opacity-50 hover:opacity-100'} ${
          isOpen 
            ? 'bg-slate-900 border-cyan-500/50 text-cyan-400 rotate-90' 
            : 'bg-cyan-500 border-cyan-400 text-slate-950 hover:bg-cyan-400'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </motion.button>

    </div>
  );
}