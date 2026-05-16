

import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Send, User, Bot, Paperclip } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { ChatMessage, Document, Settings } from '../types';
import type { Chat } from '@google/genai';

interface AIChatProps {
    settings: Settings;
    documents: Document[];
    chatContextDocId: string;
    setChatContextDocId: (id: string) => void;
}

const sampleQuestions = [
    { text: "What are more efficient alternatives to a 'for loop' in Python?" },
    { text: "What is the Transformers architecture?" },
    { text: "Create a chart of the top NLP use-cases for foundation models." },
    { text: "Describe generative AI using emojis." }
];

const AIChat: React.FC<AIChatProps> = ({ settings, documents, chatContextDocId, setChatContextDocId }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDocSelectorOpen, setIsDocSelectorOpen] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const selectedDoc = documents.find(doc => doc.id.toString() === chatContextDocId);

    useEffect(() => {
        const selectedDocument = documents.find(doc => doc.id.toString() === chatContextDocId);
        const context = selectedDocument?.content;
        const newChatSession = geminiService.startChat(settings, context);
        setChat(newChatSession);
        setMessages([]);
        setCurrentMessage('');
    }, [chatContextDocId, documents, settings]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleDocSelect = (docId: string) => {
        setChatContextDocId(docId);
        setIsDocSelectorOpen(false);
    };

    const sendMessage = async (messageTextOverride?: string) => {
        const messageText = messageTextOverride || currentMessage;
        if (!messageText.trim() || !chat || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now(),
            text: messageText,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        if (!messageTextOverride) {
            setCurrentMessage('');
        }
        setIsLoading(true);

        const aiResponsePlaceholder: ChatMessage = {
            id: Date.now() + 1,
            text: '',
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiResponsePlaceholder]);

        try {
            const stream = await chat.sendMessageStream({ message: messageText });

            let text = '';
            for await (const chunk of stream) {
                text += chunk.text;
                setMessages(prev => prev.map(msg =>
                    msg.id === aiResponsePlaceholder.id ? { ...msg, text } : msg
                ));
            }
        } catch (error) {
            console.error("AI Service error:", error);
            setMessages(prev => prev.map(msg =>
                msg.id === aiResponsePlaceholder.id ? { ...msg, text: "Sorry, I encountered an error. Please try again." } : msg
            ));
        } finally {
            setIsLoading(false);
             if (messageTextOverride) {
                setCurrentMessage('');
            }
        }
    };
    
    const handleSampleClick = (question: string) => {
        setCurrentMessage(question);
        sendMessage(question);
    };

    return (
        <div className="flex flex-col h-full">
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col justify-center h-full animate-fadeIn">
                        <div className="text-center px-4">
                             <div className="inline-block p-4 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
                               <Bot size={40} className="text-primary" />
                             </div>
                            <h1 className="text-3xl font-bold">
                                {selectedDoc ? `Chat about ${selectedDoc.name}` : "AI Study Assistant"}
                            </h1>
                            <p className="text-muted-text dark:text-dark-muted-text mt-2 max-w-md mx-auto">
                                To ground the conversation with one of your documents, click the <Paperclip className="inline w-4 h-4" /> icon next to the input field.
                            </p>
                        </div>
                        
                        <div className="w-full max-w-3xl mx-auto my-8 px-4">
                            <h2 className="text-lg font-semibold mb-4 text-muted-text dark:text-dark-muted-text">Or try one of these...</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sampleQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSampleClick(q.text)}
                                        className="text-left p-4 glass-card rounded-xl hover:shadow-primary/20 hover:-translate-y-1 transition-all group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-medium">{q.text}</p>
                                            <ArrowRight className="w-5 h-5 text-muted-text dark:text-dark-muted-text mt-0.5 transform-gpu transition-transform group-hover:translate-x-1" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {messages.map((message) => (
                            <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.sender === 'ai' && <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><Bot className="w-5 h-5 text-primary" /></div>}
                                <div className={`max-w-xl px-4 py-3 rounded-2xl ${message.sender === 'user' ? 'bg-primary/90 text-dark-text font-medium' : 'glass-card'}`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text || '...'}</p>
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
                <div className="w-full max-w-3xl mx-auto">
                    {selectedDoc && (
                        <div className="mb-2">
                            <span className="inline-flex items-center text-xs font-semibold bg-primary/20 dark:bg-primary/30 text-primary-700 dark:text-primary-200 px-2.5 py-1 rounded-full">
                                Context: {selectedDoc.name}
                                <button onClick={() => handleDocSelect('')} className="ml-2 font-bold hover:text-red-500 focus:outline-none">
                                    &times;
                                </button>
                            </span>
                        </div>
                    )}
                    <div className="relative">
                         {isDocSelectorOpen && (
                            <div className="absolute bottom-full left-0 w-full mb-2 max-h-60 overflow-y-auto glass-card rounded-lg p-2 z-20">
                                <ul className="text-sm">
                                    <li onClick={() => handleDocSelect('')} className="cursor-pointer p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-md font-semibold">
                                        General Chat (no document)
                                    </li>
                                    {documents.map(doc => {
                                        const isProcessable = doc.content && doc.content.trim() !== '';
                                        return (
                                            <li 
                                              key={doc.id} 
                                              onClick={() => isProcessable && handleDocSelect(doc.id.toString())} 
                                              className={`p-2 rounded-md truncate ${isProcessable ? 'cursor-pointer hover:bg-white/50 dark:hover:bg-white/10' : 'cursor-not-allowed text-muted-text/70 dark:text-dark-muted-text/70'}`}
                                              title={!isProcessable ? 'Text could not be extracted from this document. It might be an image-only PDF.' : ''}
                                            >
                                                {isProcessable ? doc.name : `[No text] ${doc.name}`}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                        <div className="flex items-center glass-card rounded-xl focus-within:ring-2 focus-within:ring-primary transition-all pr-2">
                            <button onClick={() => setIsDocSelectorOpen(s => !s)} className="p-3 text-muted-text dark:text-dark-muted-text hover:text-primary transition-colors">
                                <Paperclip className="w-5 h-5"/>
                            </button>
                            <input
                                type="text"
                                value={currentMessage}
                                onChange={(e) => setCurrentMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder={selectedDoc ? `Ask about ${selectedDoc.name}...` : "Type something..."}
                                className="flex-1 bg-transparent focus:outline-none text-sm px-2 placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={isLoading || !currentMessage.trim()}
                                className="p-2 bg-primary text-dark-text rounded-lg hover:bg-opacity-80 disabled:bg-light-border dark:disabled:bg-dark-border disabled:text-muted-text dark:disabled:text-dark-muted-text disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIChat;