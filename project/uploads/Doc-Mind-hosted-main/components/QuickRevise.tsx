

import React, { useState, useEffect } from 'react';
import { Zap, Brain, RefreshCw, ChevronDown, ArrowLeft } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { QuickReviseSession, Document, RevisionPoint, Settings } from '../types';

interface QuickReviseProps {
  settings: Settings;
  documents: Document[];
  sessions: QuickReviseSession[];
  setSessions: React.Dispatch<React.SetStateAction<QuickReviseSession[]>>;
  setActivityLog: React.Dispatch<React.SetStateAction<string[]>>;
  activeSession: QuickReviseSession | null;
  setActiveSession: (session: QuickReviseSession | null) => void;
}

const AccordionItem: React.FC<{ point: RevisionPoint; isOpen: boolean; onToggle: () => void; }> = ({ point, isOpen, onToggle }) => {
  return (
    <div className="border-b border-white/20 dark:border-white/10 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center text-left p-4 hover:bg-white/20 dark:hover:bg-white/5 transition-colors duration-200"
        aria-expanded={isOpen}
      >
        <span className="font-semibold flex-1 pr-4 text-dark-text dark:text-light-text">{point.keyPoint}</span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 text-muted-text dark:text-dark-muted-text transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-4 bg-black/5 dark:bg-black/20 text-muted-text dark:text-dark-muted-text space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-dark-text dark:text-light-text mb-1">Explained Simply (ELI5)</h4>
            <p className="whitespace-pre-wrap leading-relaxed">{point.simplifiedExplanation}</p>
          </div>
          <div className="border-t border-white/10 dark:border-white/5"></div>
          <div>
             <h4 className="font-semibold text-sm text-dark-text dark:text-light-text mb-1">More Details</h4>
             <p className="whitespace-pre-wrap leading-relaxed">{point.detailedExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const QuickRevise: React.FC<QuickReviseProps> = ({ settings, documents, sessions, setSessions, setActivityLog, activeSession, setActiveSession }) => {
  const [sourceText, setSourceText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openAccordionIndex, setOpenAccordionIndex] = useState<number | null>(0);
  
  useEffect(() => {
    if (activeSession) {
      setOpenAccordionIndex(0);
    }
  }, [activeSession]);

  const handleDocSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const docId = e.target.value;
    setSelectedDocId(docId);
    const selectedDoc = documents.find(doc => doc.id.toString() === docId);
    if (selectedDoc) {
      setSourceText(selectedDoc.content || '');
      setTitle(`${selectedDoc.name.replace(/\.[^/.]+$/, "")} Simplified`);
    } else {
      setSourceText('');
      setTitle('');
    }
  };

  const handleGenerate = async () => {
    const textToProcess = sourceText.trim();
    if (!textToProcess) {
      setError('Please provide some text or select a document to generate a revision from.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setActiveSession(null);

    try {
      const generatedData = await geminiService.generateQuickReviseFromText(settings, textToProcess, title || 'Generated Quick Revise');
      const newSession: QuickReviseSession = {
        id: Date.now(),
        title: generatedData.title,
        points: generatedData.points,
        date: new Date().toISOString().split('T')[0],
        sourceDocumentId: selectedDocId ? parseInt(selectedDocId) : 0,
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSession(newSession);

      const today = new Date().toISOString().split('T')[0];
      setActivityLog(prev => Array.from(new Set([...prev, today])));

    } catch (e: any) {
      setError(`Failed to generate revision: ${e.message}. Please try again.`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startOver = () => {
    setActiveSession(null);
    setSourceText('');
    setTitle('');
    setSelectedDocId('');
    setError(null);
  }

  if (activeSession) {
    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-light-border dark:border-dark-border flex-shrink-0">
                <button onClick={startOver} className="flex items-center gap-2 text-muted-text dark:text-dark-muted-text hover:text-primary font-semibold transition-colors">
                  <ArrowLeft className="w-5 h-5"/>
                  Create New Revision
                </button>
                <h2 className="text-2xl font-bold text-right truncate pl-4" title={activeSession.title}>{activeSession.title}</h2>
            </div>
            <div className="flex-grow glass-card rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 bg-primary/10 dark:bg-primary/20 text-sm text-center font-semibold text-primary-800 dark:text-primary-200">
                    Key concepts explained with simple and detailed views!
                </div>
                <div className="flex-1 overflow-y-auto">
                    {activeSession.points.map((point, index) => (
                        <AccordionItem
                            key={index}
                            point={point}
                            isOpen={openAccordionIndex === index}
                            onToggle={() => setOpenAccordionIndex(openAccordionIndex === index ? null : index)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto animate-fadeIn">
      <div className="text-center">
         <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
          <Zap className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Quick Revise</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Get complex topics explained in the simplest terms.</p>
      </div>

      <div className="p-8 glass-card rounded-2xl space-y-6">
        <div>
          <label htmlFor="doc-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">
            1. Choose a Document
          </label>
          <select
            id="doc-select"
            value={selectedDocId}
            onChange={handleDocSelection}
            className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Select a document --</option>
            {documents.map(doc => {
              const isProcessable = doc.content && doc.content.trim() !== '';
              return (
                <option 
                  key={doc.id} 
                  value={doc.id} 
                  disabled={!isProcessable} 
                  title={!isProcessable ? 'Text could not be extracted from this document. It might be an image-only PDF.' : ''}
                  className={!isProcessable ? 'text-muted-text/70 dark:text-dark-muted-text/70' : ''}
                >
                  {isProcessable ? doc.name : `[No text] ${doc.name}`}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label htmlFor="source-text" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">
            2. Or Paste Your Text
          </label>
          <textarea
            id="source-text"
            rows={10}
            value={sourceText}
            onChange={(e) => {
              setSourceText(e.target.value);
              setSelectedDocId('');
            }}
            placeholder="Paste your notes, an article, or any text here."
            className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
          />
        </div>

         <div>
          <label htmlFor="revise-title" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">
            3. Give your revision a title
          </label>
          <input
            id="revise-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Quantum Physics Explained"
            className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={isLoading || (!sourceText.trim() && !selectedDocId)}
          className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 disabled:bg-light-border disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95"
        >
          {isLoading ? (
             <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Simplifying...</span>
            </>
          ) : (
             <>
              <Brain className="w-6 h-6" />
              <span>Generate Revision</span>
             </>
          )}
        </button>
      </div>
    </div>
  );
};

export default QuickRevise;