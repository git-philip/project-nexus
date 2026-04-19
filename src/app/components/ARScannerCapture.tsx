import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, RotateCcw, Scan, Loader2 } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the AI API using the key from your .env file
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export function ARScannerCapture() {
  const webcamRef = useRef<Webcam>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "environment" 
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageBase64 = webcamRef.current.getScreenshot();
      setImageSrc(imageBase64);
      setAiAnalysis(null); // Clear previous analysis
    }
  }, [webcamRef]);

  const analyzeImageWithAI = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);

    try {
      // 1. Pick the vision-capable model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // 2. Format the Base64 image for the API
      // react-webcam outputs "data:image/jpeg;base64,/9j/4AAQ..."
      // Gemini just wants the raw data part after the comma.
      const base64Data = imageSrc.split(",")[1];
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        },
      };

      // 3. Send the image and your specific educational prompt
      const prompt = "You are an IT instructor. Identify the computer component in this image. Give me its name, and explain what it does in a computer system in 2 short sentences.";
      
      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();
      
      setAiAnalysis(responseText);
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setAiAnalysis("Failed to analyze the image. Make sure your API key is correct.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">AR Object Scanner</h2>
        <p className="text-muted-foreground mt-2">Point your camera at a component to identify it.</p>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm aspect-video flex items-center justify-center">
        {imageSrc ? (
          <img src={imageSrc} alt="Captured snapshot" className="object-cover w-full h-full" />
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
          />
        )}
        
        {!imageSrc && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <Scan className="w-32 h-32 text-primary opacity-40" />
          </div>
        )}
      </div>

      {/* NEW: Display the AI's response here */}
      {aiAnalysis && (
        <div className="w-full p-4 rounded-lg bg-primary/10 border border-primary/20 text-left">
          <h3 className="font-semibold text-primary mb-1">AI Analysis:</h3>
          <p className="text-sm leading-relaxed">{aiAnalysis}</p>
        </div>
      )}

      <div className="flex gap-4">
        {imageSrc ? (
          <>
            <button 
              onClick={() => setImageSrc(null)}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Retake
            </button>
            <button 
              onClick={analyzeImageWithAI}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze with AI"
              )}
            </button>
          </>
        ) : (
          <button 
            onClick={capture}
            className="flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Camera className="w-5 h-5" />
            Capture Image
          </button>
        )}
      </div>
    </div>
  );
}