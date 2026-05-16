

import React, { useState, useEffect, useRef } from 'react';
import { Share2, Brain, RefreshCw, Clipboard, AlertTriangle, X, Sparkles } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { Document, Settings } from '../types';

const diagramTypes = [
    "Flowchart",
    "Mind Map",
    "Sequence Diagram",
    "State Diagram",
    "Class Diagram",
    "Gantt Chart",
    "Pie Chart",
    "User Journey",
    "Timeline",
    "Requirement Diagram",
    "Quadrant Chart",
    "Git Graph",
    "Packet Diagram",
    "Block Diagram"
];

const MAX_RETRIES = 2;

interface AIDiagramMakerProps {
  settings: Settings;
  documents: Document[];
  theme: 'light' | 'dark';
}

const AIDiagramMaker: React.FC<AIDiagramMakerProps> = ({ settings, documents, theme }) => {
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedDiagramType, setSelectedDiagramType] = useState<string>(diagramTypes[0]);
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const mermaidContainerRef = useRef<HTMLDivElement>(null);
  
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!mermaidCode || !mermaidContainerRef.current) return;
    
    const mermaidAPI = (window as any).mermaid;
    if (!mermaidAPI) {
        setError("Diagram library failed to load. Please refresh.");
        return;
    }
    
    mermaidContainerRef.current.innerHTML = '';
    
    mermaidAPI.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
        themeVariables: {
            background: 'transparent',
            primaryColor: theme === 'dark' ? '#282828' : '#F0F0F0',
            primaryTextColor: theme === 'dark' ? '#F0F0F0' : '#212529',
            primaryBorderColor: theme === 'dark' ? '#888888' : '#6C757D',
            lineColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.6)',
            textColor: theme === 'dark' ? '#F0F0F0' : '#212529',
        }
    });

    const renderDiagram = async () => {
        try {
            setError(null);
            const { svg } = await mermaidAPI.render(`mermaid-svg-${Date.now()}`, mermaidCode);
            if (mermaidContainerRef.current) {
                mermaidContainerRef.current.innerHTML = svg;
            }
            if (retryCount > 0) setRetryCount(0);
        } catch (e: any) {
            console.error("Mermaid rendering error:", e);
            const selectedDoc = documents.find(doc => doc.id.toString() === selectedDocId);
            if (!selectedDoc || !selectedDoc.content) {
                setError("Cannot retry without a selected document.");
                return;
            }
            if (retryCount < MAX_RETRIES) {
                setRetryCount(prev => prev + 1);
                setError(`Diagram syntax was invalid. Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                try {
                    const correctedCode = await geminiService.generateMermaidDiagram(settings, selectedDoc.content, selectedDiagramType, mermaidCode, e.message);
                    setMermaidCode(correctedCode);
                } catch (apiError) {
                    setError(`Failed to get correction from AI after ${retryCount + 1} retries.`);
                    setRetryCount(0);
                }
            } else {
                setError(`Failed to generate a valid diagram after ${MAX_RETRIES} attempts.`);
                if (mermaidContainerRef.current) {
                     mermaidContainerRef.current.innerHTML = `<div class="text-red-500 p-4 text-center"><p class="font-bold">Rendering Failed</p><p class="text-sm mt-2">The AI could not produce a valid diagram for this request.</p></div>`;
                }
                setRetryCount(0);
            }
        }
    };
    renderDiagram();
    
  }, [mermaidCode, theme, settings]); // Re-run effect if settings change (e.g., Ollama URL)

  const handleGenerate = async (isAuto = false) => {
    const selectedDoc = documents.find(doc => doc.id.toString() === selectedDocId);
    if (!selectedDoc || !selectedDoc.content) {
      setError('Please select a document with readable content.');
      return;
    }

    if (isAuto) setIsAutoLoading(true);
    else setIsManualLoading(true);
    
    setError(null);
    setMermaidCode(null);
    setRetryCount(0);

    try {
        if (isAuto) {
            const result = await geminiService.generateAutoDiagram(settings, selectedDoc.content);
            setSelectedDiagramType(result.diagramType);
            setMermaidCode(result.mermaidCode);
        } else {
            const code = await geminiService.generateMermaidDiagram(settings, selectedDoc.content, selectedDiagramType);
            setMermaidCode(code);
        }
    } catch (e: any) {
      console.error(e);
      setError(`${isAuto ? 'Failed to auto-generate' : 'Failed to generate'} diagram: ${e.message}`);
    } finally {
      if (isAuto) setIsAutoLoading(false);
      else setIsManualLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!mermaidCode) return;
    navigator.clipboard.writeText(mermaidCode).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const resetView = () => {
    setSelectedDocId('');
    setSelectedDiagramType(diagramTypes[0]);
    setMermaidCode(null);
    setError(null);
    setRetryCount(0);
  };
  
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fadeIn">
        <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
            <Share2 className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">AI Diagram Maker</h1>
            <p className="text-lg text-muted-text dark:text-dark-muted-text">Transform text from your documents into visual diagrams.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <div className="glass-card rounded-2xl p-6 space-y-6 sticky top-8">
                    <div>
                        <label htmlFor="doc-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">
                            1. Select Document
                        </label>
                        <select id="doc-select" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">-- Select --</option>
                            {documents.map(doc => {
                                const isProcessable = doc.content && doc.content.trim() !== '';
                                return (
                                    <option key={doc.id} value={doc.id} disabled={!isProcessable} title={!isProcessable ? 'Text could not be extracted.' : ''} className={!isProcessable ? 'text-muted-text/70 dark:text-dark-muted-text/70' : ''}>
                                        {isProcessable ? doc.name : `[No text] ${doc.name}`}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="diagram-type-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">
                            2. Select Diagram Type
                        </label>
                        <select id="diagram-type-select" value={selectedDiagramType} onChange={(e) => setSelectedDiagramType(e.target.value)} className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
                            {diagramTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                        </select>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="pt-4 border-t border-white/20 dark:border-white/10 space-y-3">
                        <button onClick={() => handleGenerate(false)} disabled={!selectedDocId || isManualLoading || isAutoLoading} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95">
                            {isManualLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Brain className="w-6 h-6" />}
                            <span>Generate Diagram</span>
                        </button>
                         <button onClick={() => handleGenerate(true)} disabled={!selectedDocId || isManualLoading || isAutoLoading} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-secondary text-white text-lg font-bold rounded-xl hover:bg-opacity-90 disabled:bg-opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-secondary/30 transform hover:scale-105 active:scale-95">
                            {isAutoLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                            <span>Let AI Decide</span>
                        </button>
                        {mermaidCode && (
                        <button onClick={resetView} className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white/20 dark:bg-white/5 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                            Start Over
                        </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
                <div className="glass-card rounded-2xl p-6 min-h-[400px] flex flex-col">
                    <h3 className="text-xl font-bold mb-4 flex-shrink-0">Visual Diagram</h3>
                    <div className="flex-grow w-full h-full flex items-center justify-center bg-black/10 dark:bg-black/20 rounded-lg overflow-auto p-4">
                        {(isManualLoading || isAutoLoading) ? (
                            <div className="text-center"><RefreshCw className="w-10 h-10 animate-spin text-primary mx-auto" /><p className="mt-4 text-muted-text dark:text-dark-muted-text">Generating diagram...</p></div>
                        ) : mermaidCode ? (
                            <div ref={mermaidContainerRef} className="w-full h-full flex items-center justify-center"></div>
                        ) : (
                            <div className="text-center text-muted-text dark:text-dark-muted-text"><p>Your generated diagram will appear here.</p></div>
                        )}
                    </div>
                </div>
                <div className="glass-card rounded-2xl p-6 min-h-[300px] flex flex-col">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <h3 className="text-xl font-bold">Mermaid Code</h3>
                        {mermaidCode && (
                            <button onClick={handleCopyCode} className="text-primary hover:opacity-80 flex items-center space-x-2 text-sm">
                                <Clipboard className="w-5 h-5" />
                                <span>{copySuccess ? 'Copied!' : 'Copy Code'}</span>
                            </button>
                        )}
                    </div>
                    <div className="flex-grow bg-dark-bg/50 rounded-lg p-4 overflow-auto">
                        <pre className="text-sm font-mono whitespace-pre-wrap text-light-text"><code>{mermaidCode || '// Your generated Mermaid.js code will appear here...'}</code></pre>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
export default AIDiagramMaker;