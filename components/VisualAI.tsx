

import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Camera, Send, X, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { ChatMessage, Settings } from '../types';

interface VisualAIProps {
    settings: Settings;
}

const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result !== 'string') {
                return reject('FileReader result is not a string');
            }
            const base64String = reader.result.split(',')[1];
            resolve({ base64: base64String, mimeType: file.type });
        };
        reader.onerror = error => reject(error);
    });
};

const VisualAI: React.FC<VisualAIProps> = ({ settings }) => {
    const [image, setImage] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isCameraOn, setIsCameraOn] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const startStream = async () => {
            if (isCameraOn) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    setError("Could not access the camera. Please check permissions.");
                    setIsCameraOn(false);
                }
            } else {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            }
        };
        startStream();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isCameraOn]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);
        try {
            const { base64, mimeType } = await fileToBase64(file);
            setImage({ base64, mimeType, name: file.name });
            setMessages([]);
        } catch (err) {
            console.error(err);
            setError("Failed to read the image file.");
        }
    };
    
    const handleCapture = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;

        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];
        
        setImage({ base64, mimeType: 'image/jpeg', name: 'webcam-capture.jpg' });
        setMessages([]);
        setIsCameraOn(false);
    };

    const sendMessage = async () => {
        if (!userInput.trim() || !image || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now(),
            text: userInput,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = userInput;
        setUserInput('');
        setIsLoading(true);
        setError(null);

        try {
            const responseText = await geminiService.generateContentFromImage(settings, currentInput, image.base64, image.mimeType);
            const aiMessage: ChatMessage = {
                id: Date.now() + 1,
                text: responseText,
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (err: any) {
            console.error("AI Service error:", err);
            setError(`Sorry, I encountered an error: ${err.message}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    const clearAll = () => {
        setImage(null);
        setMessages([]);
        setUserInput('');
        setError(null);
    };

    if (isCameraOn) {
        return (
            <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4 animate-fadeIn">
                <div className="w-full max-w-2xl bg-dark-surface rounded-2xl p-4 shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-lg mb-4"></video>
                    <div className="flex justify-center gap-4">
                        <button onClick={handleCapture} className="px-6 py-3 bg-primary text-dark-text font-bold rounded-xl hover:bg-opacity-80 transition-all transform hover:scale-105 active:scale-95">
                            Capture
                        </button>
                        <button onClick={() => setIsCameraOn(false)} className="px-6 py-3 bg-white/20 dark:bg-white/10 rounded-xl hover:bg-white/30 dark:hover:bg-white/20 transition-all">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    if (!image) {
        return (
            <div className="h-full flex flex-col justify-center items-center space-y-8 animate-fadeIn text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
                    <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-4xl font-bold">Ask Doubt</h1>
                <p className="text-lg text-muted-text dark:text-dark-muted-text">Upload a diagram, chart, or photo, and I'll help you understand it. Let's explore visuals together!</p>
                <div className="w-full p-8 glass-card rounded-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-3 p-8 bg-white/20 dark:bg-black/20 border-2 border-dashed border-white/30 dark:border-white/20 rounded-xl hover:border-primary hover:bg-primary/10 transition-all"
                        >
                            <ImageIcon className="w-12 h-12 text-primary"/>
                            <span className="font-semibold">Upload Image</span>
                            <span className="text-sm text-muted-text dark:text-dark-muted-text">PNG, JPG, WEBP</span>
                        </button>
                        <button
                            onClick={() => setIsCameraOn(true)}
                            className="flex flex-col items-center justify-center gap-3 p-8 bg-white/20 dark:bg-black/20 border-2 border-dashed border-white/30 dark:border-white/20 rounded-xl hover:border-primary hover:bg-primary/10 transition-all"
                        >
                            <Camera className="w-12 h-12 text-primary"/>
                            <span className="font-semibold">Use Camera</span>
                             <span className="text-sm text-muted-text dark:text-dark-muted-text">Take a photo</span>
                        </button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
                </div>
                {error && <p className="text-red-500 mt-4">{error}</p>}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col lg:flex-row gap-6 animate-fadeIn">
            {/* Left side: Image Viewer */}
            <div className="lg:w-1/2 flex flex-col glass-card rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold truncate text-sm" title={image.name}>{image.name}</h3>
                    <button onClick={clearAll} className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-white/10 text-muted-text dark:text-dark-muted-text hover:text-red-500 transition-colors">
                        <X className="w-5 h-5"/>
                    </button>
                </div>
                <div className="flex-grow rounded-lg overflow-hidden flex items-center justify-center bg-dark-bg/20">
                    <img src={`data:${image.mimeType};base64,${image.base64}`} alt="User upload" className="max-w-full max-h-full object-contain"/>
                </div>
            </div>

            {/* Right side: AI Chat */}
            <div className="lg:w-1/2 flex flex-col glass-card rounded-2xl">
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center text-muted-text dark:text-dark-muted-text h-full flex flex-col justify-center">
                            <Bot className="w-12 h-12 mx-auto mb-4 text-primary"/>
                            <p className="font-semibold">Image loaded!</p>
                            <p>What would you like to know about it?</p>
                             <p className="text-sm mt-4">e.g., "Explain this diagram" or "What is the key takeaway from this chart?"</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                           <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><Bot className="w-5 h-5 text-primary" /></div>}
                                <div className={`max-w-xl px-4 py-3 rounded-2xl ${msg.sender === 'user' ? 'bg-primary/90 text-dark-text font-medium' : 'glass-card'}`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                </div>
                                {msg.sender === 'user' && <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><User className="w-5 h-5" /></div>}
                            </div>
                        ))
                    )}
                    {isLoading && (
                         <div className="flex items-start gap-3 justify-start">
                            <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><Bot className="w-5 h-5 text-primary" /></div>
                            <div className="px-5 py-3 rounded-2xl glass-card">
                                <div className="flex items-center space-x-1">
                                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                                </div>
                            </div>
                        </div>
                    )}
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>
                <div className="p-4 bg-transparent w-full">
                    <div className="relative">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Ask a question about the image..."
                            className="w-full pr-14 pl-4 py-3 bg-white/20 dark:bg-black/20 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            disabled={isLoading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !userInput.trim()}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-primary text-dark-text rounded-lg hover:bg-opacity-80 disabled:bg-light-border dark:disabled:bg-dark-border disabled:text-muted-text dark:disabled:text-dark-muted-text disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisualAI;