


import React, { useState, useEffect, useRef } from 'react';
import { Mic, RefreshCw, ChevronRight, Brain, ArrowLeft, Play, Pause, Square, Send, User } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { AudioRecap, Document, RecapScriptLine, Settings } from '../types';

interface AudioRecapGeneratorProps {
  settings: Settings;
  documents: Document[];
  audioRecaps: AudioRecap[];
  setAudioRecaps: React.Dispatch<React.SetStateAction<AudioRecap[]>>;
  setActivityLog: React.Dispatch<React.SetStateAction<string[]>>;
  activeRecap: AudioRecap | null;
  setActiveRecap: React.Dispatch<React.SetStateAction<AudioRecap | null>>;
}

const AudioRecapGenerator: React.FC<AudioRecapGeneratorProps> = ({ settings, documents, audioRecaps, setAudioRecaps, setActivityLog, activeRecap, setActiveRecap }) => {
  const [sourceText, setSourceText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef(new Map<number, HTMLDivElement>());
  const abortSpeechRef = useRef(false);

  const [isAnswering, setIsAnswering] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  
  useEffect(() => {
    if (activeRecap) {
        stopRecap();
    }
  }, [activeRecap]);

  useEffect(() => {
    const loadVoices = () => setVoices(speechSynthesis.getVoices());
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      speechSynthesis.cancel();
      abortSpeechRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (isPlaying && currentLineIndex >= 0 && activeRecap) {
        const node = lineRefs.current.get(currentLineIndex);
        node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex, isPlaying, activeRecap]);
  
  useEffect(() => {
      if (isAnswering) {
          transcriptContainerRef.current?.scrollTo({ top: transcriptContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [isAnswering])

  const handleDocSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const docId = e.target.value;
    setSelectedDocId(docId);
    const selectedDoc = documents.find(doc => doc.id.toString() === docId);
    if (selectedDoc) {
      setSourceText(selectedDoc.content || '');
      setTitle(selectedDoc.name.replace(/\.[^/.]+$/, ""));
    } else {
      setSourceText('');
      setTitle('');
    }
  };

  const handleGenerate = async () => {
    const textToProcess = sourceText.trim();
    if (!textToProcess) {
      setError('Please provide some text or select a document.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const generatedData = await geminiService.generateAudioRecapScript(settings, textToProcess, title || 'Generated Recap');
      const newRecap: AudioRecap = {
        id: Date.now(),
        title: generatedData.title,
        summary: generatedData.summary,
        script: generatedData.script,
        date: new Date().toISOString().split('T')[0],
        sourceText: textToProcess,
        sourceDocumentId: selectedDocId ? parseInt(selectedDocId) : undefined,
      };
      setAudioRecaps(prev => [newRecap, ...prev]);
      setActiveRecap(newRecap);
      
      const today = new Date().toISOString().split('T')[0];
      setActivityLog(prev => Array.from(new Set([...prev, today])));
    } catch (e: any) {
      setError(`Failed to generate audio recap: ${e.message}. Please try again.`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const playRecap = () => {
    if (!activeRecap || voices.length === 0) return;
    abortSpeechRef.current = false;
    speechSynthesis.cancel();
    setIsPlaying(true);

    const alexVoice = voices.find(v => v.name.includes('Google US English') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en-US')) || voices[0];
    const benVoice = voices.find(v => v.name.includes('Google UK English Male') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en-GB')) || voices[1] || alexVoice;

    let lineIdx = currentLineIndex >= 0 ? currentLineIndex : 0;

    const speakLine = (index: number) => {
      if (index >= activeRecap.script.length || abortSpeechRef.current) {
        setIsPlaying(false);
        setCurrentLineIndex(-1);
        return;
      }
      setCurrentLineIndex(index);
      const line = activeRecap.script[index];
      if(line.speaker === 'User') {
        speakLine(index + 1);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(line.dialogue);
      utterance.voice = line.speaker === 'Alex' ? alexVoice : benVoice;
      utterance.onend = () => speakLine(index + 1);
      speechSynthesis.speak(utterance);
    };
    
    speakLine(lineIdx);
  };

  const pauseRecap = () => {
    setIsPlaying(false);
    speechSynthesis.pause();
  };

  const stopRecap = () => {
    setIsPlaying(false);
    abortSpeechRef.current = true;
    speechSynthesis.cancel();
    setCurrentLineIndex(-1);
  };
  
  const handleAskQuestion = async () => {
    if (!questionInput.trim() || !activeRecap || !activeRecap.sourceText) return;

    setIsAnswering(true);
    const question = questionInput;
    setQuestionInput('');

    const userQuestionLine: RecapScriptLine = { speaker: 'User', dialogue: question };
    const scriptWithQuestion = [...activeRecap.script, userQuestionLine];

    setActiveRecap(recap => recap ? ({ ...recap, script: scriptWithQuestion }) : null);

    setTimeout(() => {
        transcriptContainerRef.current?.scrollTo({ top: transcriptContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
    
    const answerLines = await geminiService.answerRecapQuestion(settings, activeRecap.sourceText, scriptWithQuestion, question);

    setActiveRecap(recap => recap ? { ...recap, script: [...recap.script, ...answerLines] } : null);

    setTimeout(() => {
        transcriptContainerRef.current?.scrollTo({ top: transcriptContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
    
    setIsAnswering(false);
  };
  
  if (activeRecap) {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-1 flex flex-col glass-card rounded-2xl p-6 h-full">
            <button onClick={() => { stopRecap(); setActiveRecap(null); }} className="flex items-center gap-2 mb-4 text-muted-text dark:text-dark-muted-text hover:text-primary font-semibold transition-colors self-start">
              <ArrowLeft className="w-5 h-5"/>
              Back to Generator
            </button>
            <div className="text-center">
                <h2 className="text-2xl font-bold">{activeRecap.title}</h2>
                <div className="flex items-center justify-center gap-4 my-4">
                  {!isPlaying ? (
                      <button onClick={playRecap} className="p-3 bg-primary text-dark-text rounded-full shadow-lg hover:bg-opacity-80 transition-all transform hover:scale-110 active:scale-100"><Play className="w-6 h-6"/></button>
                  ) : (
                      <button onClick={pauseRecap} className="p-3 bg-primary text-dark-text rounded-full shadow-lg hover:bg-opacity-80 transition-all transform hover:scale-110 active:scale-100"><Pause className="w-6 h-6"/></button>
                  )}
                  <button onClick={stopRecap} className="p-3 bg-white/30 dark:bg-white/10 border border-white/20 dark:border-dark-border text-muted-text dark:text-dark-muted-text rounded-full shadow-sm hover:bg-white/50 dark:hover:bg-white/20 transition-all transform hover:scale-110 active:scale-100"><Square className="w-6 h-6"/></button>
                </div>
            </div>
            <div className="border-t border-white/20 dark:border-white/10 my-4"></div>
            <h3 className="text-lg font-semibold mb-2">Topic Brief</h3>
            <p className="text-muted-text dark:text-dark-muted-text text-sm italic mb-4 flex-grow overflow-y-auto pr-2">{activeRecap.summary}</p>
            <div className="mt-auto pt-4 border-t border-white/10 dark:border-white/5">
                <label htmlFor="question-search" className="block text-sm font-semibold text-muted-text dark:text-dark-muted-text mb-2">Ask a follow-up question</label>
                <div className="relative flex items-center">
                    <input id="question-search" type="text" value={questionInput} onChange={e => setQuestionInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAskQuestion()} placeholder="Ask about the document..." className="w-full pl-4 pr-12 py-3 bg-white/20 dark:bg-black/20 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text transition" disabled={isAnswering}/>
                    <button onClick={handleAskQuestion} disabled={isAnswering || !questionInput.trim()} className="absolute right-1.5 p-2 bg-primary text-dark-text rounded-lg hover:bg-opacity-80 disabled:bg-light-border dark:disabled:bg-dark-border disabled:text-muted-text dark:disabled:text-dark-muted-text transform hover:scale-105 active:scale-95 transition-all">
                        {isAnswering ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
                    </button>
                </div>
            </div>
          </div>
          <div className="lg:col-span-2 glass-card rounded-2xl flex flex-col min-h-0">
            <h3 className="text-xl font-bold p-6 pb-4 sticky top-0 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-sm z-10 border-b border-white/20 dark:border-white/10">Dialogue Script</h3>
            <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto space-y-2 px-6 pb-6">
              {activeRecap.script.map((line, index) => {
                const isUser = line.speaker === 'User';
                return isUser ? (
                    <div key={index} className="flex items-start gap-3 justify-end my-4">
                        <div className="max-w-xl px-4 py-3 rounded-2xl bg-secondary text-white font-medium"><p className="text-sm leading-relaxed whitespace-pre-wrap">{line.dialogue}</p></div>
                        <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><User className="w-5 h-5" /></div>
                    </div>
                ) : ( <div key={index} ref={node => { if (node) { lineRefs.current.set(index, node); } else { lineRefs.current.delete(index); } }} className={`p-3 rounded-lg transition-all duration-300 ${currentLineIndex === index ? 'bg-primary/20 dark:bg-primary/30 scale-[1.02]' : 'bg-transparent'}`}>
                        <p className="font-bold">{line.speaker}:</p>
                        <p className="text-muted-text dark:text-dark-muted-text whitespace-pre-wrap">{line.dialogue}</p>
                    </div>);
              })}
              {isAnswering && (
                  <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 flex-shrink-0 bg-white/50 dark:bg-white/10 rounded-full flex items-center justify-center border border-white/20 dark:border-dark-border"><Brain className="w-5 h-5 text-primary" /></div>
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-8 max-w-3xl mx-auto animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
          <Mic className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Audio Recap Generator</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Turn your notes into a podcast-style audio summary.</p>
      </div>
      <div className="p-8 glass-card rounded-2xl space-y-6">
        <div>
          <label htmlFor="doc-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">1. Choose a Document (Optional)</label>
          <select id="doc-select" value={selectedDocId} onChange={handleDocSelection} className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">-- Select a document --</option>
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
          <label htmlFor="source-text" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">2. Or Paste Your Text Here</label>
          <textarea id="source-text" rows={8} value={sourceText} onChange={(e) => { setSourceText(e.target.value); setSelectedDocId(''); }} placeholder="Paste your notes or any text here." className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text" />
        </div>
        <div>
          <label htmlFor="recap-title" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">3. Give your audio recap a title</label>
          <input id="recap-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Biology Chapter 3 Recap" className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={handleGenerate} disabled={isLoading} className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 disabled:bg-light-border disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95">
          {isLoading ? ( <><RefreshCw className="w-5 h-5 animate-spin" /><span>Generating...</span></> ) : ( <><Brain className="w-6 h-6" /><span>Generate Audio Recap</span></> )}
        </button>
      </div>
       <div className="flex-1 flex flex-col space-y-4 min-h-0">
        <h2 className="text-2xl font-bold">Your Audio Recaps</h2>
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {audioRecaps.length > 0 ? (
            <>
                {audioRecaps.map(recap => (
                <div key={recap.id} onClick={() => setActiveRecap(recap)} className="p-4 glass-card rounded-xl flex justify-between items-center cursor-pointer hover:shadow-primary/20 hover:-translate-y-px transition-all">
                    <div>
                    <h3 className="font-semibold">{recap.title}</h3>
                    <p className="text-sm text-muted-text dark:text-dark-muted-text">Created on {recap.date}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-text dark:text-dark-muted-text" />
                </div>
                ))}
            </>
            ) : ( <p className="text-center text-muted-text dark:text-dark-muted-text py-4">You haven't created any audio recaps yet.</p> )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecapGenerator;