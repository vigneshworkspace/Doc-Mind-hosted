

import React, { useState, useEffect, useRef } from 'react';
import { Youtube, Link, Send, User, Bot, Loader2, Globe, AlertTriangle } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { ChatMessage, Source, Settings } from '../types';
import type { Chat } from '@google/genai';

interface YouTubeViewProps {
  settings: Settings;
}

const getYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const YouTubeView: React.FC<YouTubeViewProps> = ({ settings }) => {
    const [urlInput, setUrlInput] = useState('');
    const [videoId, setVideoId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleLoadVideo = () => {
        const id = getYouTubeId(urlInput);
        if (id) {
            setVideoId(id);
            setChat(geminiService.startYoutubeChat());
            setMessages([]);
            setError('');
        } else {
            setVideoId(null);
            setChat(null);
            setError('Invalid YouTube URL. Please enter a valid link.');
        }
    };

    const sendMessage = async () => {
        if (!currentMessage.trim() || !chat || isLoading) return;

        const userMessageText = currentMessage;
        const userMessage: ChatMessage = {
            id: Date.now(),
            text: userMessageText,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, userMessage]);
        setCurrentMessage('');
        setIsLoading(true);

        const aiResponsePlaceholder: ChatMessage = {
            id: Date.now() + 1,
            text: '',
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sources: []
        };
        setMessages(prev => [...prev, aiResponsePlaceholder]);

        try {
            const prompt = `Regarding the YouTube video at ${urlInput}, please answer this question: "${userMessageText}"`;
            const stream = await chat.sendMessageStream({
                message: prompt,
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });

            let text = '';
            let sources: Source[] = [];
            const sourceMap = new Map<string, Source>();

            for await (const chunk of stream) {
                text += chunk.text;
                
                const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (groundingChunks) {
                    groundingChunks.forEach(chunk => {
                        if (chunk.web) {
                            sourceMap.set(chunk.web.uri, { uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
                        }
                    });
                }
                
                sources = Array.from(sourceMap.values());

                setMessages(prev => prev.map(msg =>
                    msg.id === aiResponsePlaceholder.id ? { ...msg, text, sources } : msg
                ));
            }
        } catch (error) {
            console.error("Gemini API error:", error);
            setMessages(prev => prev.map(msg =>
                msg.id === aiResponsePlaceholder.id ? { ...msg, text: "Sorry, I encountered an error processing your request." } : msg
            ));
        } finally {
            setIsLoading(false);
        }
    };

    if (settings.aiProvider === 'ollama') {
        return (
          <div className="flex flex-col h-full items-center justify-center glass-card rounded-2xl p-6 text-center animate-fadeIn">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            <h3 className="text-xl font-bold">Feature Not Available for Ollama</h3>
            <p className="text-muted-text dark:text-dark-muted-text mt-2">
              The YouTube Analysis feature requires Google Search integration, which is only available with the Gemini AI provider.
            </p>
            <p className="text-sm text-muted-text dark:text-dark-muted-text mt-1">
              Please switch to Gemini in the Settings to use this feature.
            </p>
          </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 animate-fadeIn">
            <div className="lg:flex-[3] flex flex-col glass-card rounded-2xl p-4 lg:p-6">
                <h2 className="text-2xl font-bold mb-4">YouTube Video Analysis</h2>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <div className="relative flex-grow">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-text dark:text-dark-muted-text" />
                        <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleLoadVideo()}
                            placeholder="Paste YouTube URL here..."
                            className="w-full pl-10 pr-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <button
                        onClick={handleLoadVideo}
                        className="px-6 py-3 bg-primary text-dark-text font-bold rounded-xl hover:bg-opacity-80 transition-all transform hover:scale-105 active:scale-95"
                    >
                        Load
                    </button>
                </div>
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                <div className="w-full aspect-video bg-dark-bg/50 rounded-lg overflow-hidden flex items-center justify-center">
                    {videoId ? (
                        <iframe
                            className="w-full h-full"
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    ) : (
                        <div className="text-center text-muted-text dark:text-dark-muted-text">
                            <Youtube className="w-16 h-16 mx-auto mb-4" />
                            <p>Your video will appear here.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="lg:flex-[2] flex flex-col glass-card rounded-2xl h-full lg:max-h-full min-h-[300px]">
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-2 sm:pr-4">
                    {!chat ? (
                        <div className="flex flex-col justify-center items-center h-full text-center p-4">
                            <Bot className="w-12 h-12 text-primary mb-4" />
                            <h3 className="text-lg font-semibold">AI Video Assistant</h3>
                            <p className="text-muted-text dark:text-dark-muted-text">Load a video to start chatting.</p>
                        </div>
                    ) : messages.length === 0 ? (
                         <div className="flex flex-col justify-center items-center h-full text-center p-4">
                            <Bot className="w-12 h-12 text-primary mb-4" />
                            <h3 className="text-lg font-semibold">Video Loaded!</h3>
                            <p className="text-muted-text dark:text-dark-muted-text">Ask me anything about the video.</p>
                        </div>
                    ) : (
                        <div className="p-4 sm:p-6 space-y-6">
                            {messages.map((message) => (
                                <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {message.sender === 'ai' && <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><Bot className="w-5 h-5 text-primary" /></div>}
                                    <div className={`max-w-xl px-4 py-3 rounded-2xl ${message.sender === 'user' ? 'bg-primary/90 text-dark-text font-medium' : 'glass-card'}`}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text || '...'}</p>
                                        {message.sources && message.sources.length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-white/10 dark:border-dark-border/50">
                                                <h4 className="text-xs font-semibold mb-1 flex items-center gap-1.5 text-muted-text dark:text-dark-muted-text">
                                                    <Globe className="w-3 h-3"/>
                                                    Sources
                                                </h4>
                                                <ul className="text-xs space-y-1">
                                                    {message.sources.map((source, index) => (
                                                        <li key={index} className="truncate">
                                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-500 dark:text-blue-400">
                                                                {source.title}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    {message.sender === 'user' && <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><User className="w-5 h-5" /></div>}
                                </div>
                            ))}
                            {isLoading && messages[messages.length - 1]?.sender === 'ai' && (
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
                        </div>
                    )}
                </div>
                <div className="p-4 bg-transparent w-full">
                    <div className="relative">
                        <input
                            type="text"
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Ask a question..."
                            className="w-full pr-14 pl-4 py-3 bg-white/20 dark:bg-black/20 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-opacity-50"
                            disabled={!chat || isLoading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!chat || isLoading || !currentMessage.trim()}
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

export default YouTubeView;