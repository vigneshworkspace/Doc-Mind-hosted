

import React, { useState } from 'react';
import { FileQuestion, ChevronDown, RefreshCw, Brain, Sparkles, FileText, AlertTriangle, X } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { Document, QAItem, Settings } from '../types';

interface PDFQAProps {
  settings: Settings;
  documents: Document[];
}

interface AccordionItemProps {
  qaItem: QAItem;
  isOpen: boolean;
  onToggle: () => void;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ qaItem, isOpen, onToggle }) => {
  return (
    <div className="border-b border-white/20 dark:border-white/10 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center text-left p-4 hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold flex-1 pr-4">{qaItem.question}</span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-4 bg-black/10 dark:bg-black/20 text-muted-text dark:text-dark-muted-text">
          <p className="whitespace-pre-wrap leading-relaxed">{qaItem.answer}</p>
        </div>
      )}
    </div>
  );
};


const PDFQA: React.FC<PDFQAProps> = ({ settings, documents }) => {
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'short' | 'long' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedQA, setGeneratedQA] = useState<{ short: QAItem[], long: QAItem[] } | null>(null);
  const [resultsTab, setResultsTab] = useState<'short' | 'long'>('short');
  const [documentTitle, setDocumentTitle] = useState('');
  const [openAccordion, setOpenAccordion] = useState<number | null>(0);
  
  const handleDocSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const docId = e.target.value;
    setSelectedDocId(docId);
    const selectedDoc = documents.find(doc => doc.id.toString() === docId);
    setDocumentTitle(selectedDoc ? selectedDoc.name : '');
    setGeneratedQA(null);
    setError(null);
  };

  const handleGenerate = async (type: 'short' | 'long') => {
    const selectedDoc = documents.find(doc => doc.id.toString() === selectedDocId);
    if (!selectedDoc || !selectedDoc.content) {
      setError('Please select a document with readable content.');
      return;
    }

    setIsLoading(true);
    setLoadingType(type);
    setError(null);
    setOpenAccordion(0);
    
    try {
      const result = type === 'short'
        ? await geminiService.generateShortQAFromText(settings, selectedDoc.content)
        : await geminiService.generateLongQAFromText(settings, selectedDoc.content);

      setGeneratedQA(prev => ({
          ...(prev || { short: [], long: [] }),
          [type]: result
      }));
      setResultsTab(type);

    } catch (e: any) {
      console.error(e);
      setError(`Failed to generate Q&A: ${e.message}. Please try again.`);
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const clearResults = () => {
      setGeneratedQA(null);
      setSelectedDocId('');
      setDocumentTitle('');
      setError(null);
  };

  const currentQuestions = generatedQA ? (resultsTab === 'short' ? generatedQA.short : generatedQA.long) : [];

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fadeIn">
      <div className="text-center">
         <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
          <FileQuestion className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">PDF Q&A Generator</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Ask questions about your documents and get instant answers.</p>
      </div>
      
      { !generatedQA ? (
        <div className="p-8 glass-card rounded-2xl space-y-6">
            <div>
                <label htmlFor="doc-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> 1. Choose a Document
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
                        title={!isProcessable ? 'Text could not be extracted from this document.' : ''}
                        className={!isProcessable ? 'text-muted-text/70 dark:text-dark-muted-text/70' : ''}
                        >
                        {isProcessable ? doc.name : `[No text] ${doc.name}`}
                        </option>
                    );
                    })}
                </select>
            </div>
            
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="pt-4 border-t border-white/20 dark:border-white/10">
                <p className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> 2. Select Question Type
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => handleGenerate('short')} disabled={!selectedDocId || isLoading} className="flex items-center justify-center gap-3 px-6 py-4 bg-secondary text-white text-lg font-bold rounded-xl hover:bg-opacity-90 disabled:bg-opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-secondary/30 transform hover:scale-105 active:scale-95">
                        {isLoading && loadingType === 'short' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Brain className="w-6 h-6" />}
                        <span>Short Q&A</span>
                    </button>
                    <button onClick={() => handleGenerate('long')} disabled={!selectedDocId || isLoading} className="flex items-center justify-center gap-3 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95">
                        {isLoading && loadingType === 'long' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Brain className="w-6 h-6" />}
                        <span>Long Q&A</span>
                    </button>
                </div>
            </div>
        </div>
      ) : (
        <div className="p-6 glass-card rounded-2xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/20 dark:border-white/10">
                <h2 className="text-xl font-bold truncate pr-4" title={documentTitle}>{documentTitle}</h2>
                <button onClick={clearResults} className="flex items-center gap-2 px-3 py-2 text-sm bg-white/20 dark:bg-white/5 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                    Start Over
                </button>
            </div>
            <div className="flex border-b border-white/20 dark:border-white/10 mb-4">
                <button onClick={() => setResultsTab('short')} className={`px-4 py-2 font-semibold transition-colors ${resultsTab === 'short' ? 'border-b-2 border-primary text-primary' : 'text-muted-text dark:text-dark-muted-text'}`}>
                    Short Questions ({generatedQA.short.length})
                </button>
                <button onClick={() => setResultsTab('long')} className={`px-4 py-2 font-semibold transition-colors ${resultsTab === 'long' ? 'border-b-2 border-primary text-primary' : 'text-muted-text dark:text-dark-muted-text'}`}>
                    Long Questions ({generatedQA.long.length})
                </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-white/20 dark:border-white/10">
                {currentQuestions.length > 0 ? currentQuestions.map((item, index) => (
                    <AccordionItem 
                        key={index}
                        qaItem={item}
                        isOpen={openAccordion === index}
                        onToggle={() => setOpenAccordion(openAccordion === index ? null : index)}
                    />
                )) : (
                     <p className="text-center p-8 text-muted-text dark:text-dark-muted-text">No questions generated for this type yet. Click a generate button above to create them!</p>
                )}
            </div>
             <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => handleGenerate('short')} disabled={isLoading} className="flex items-center justify-center gap-3 px-6 py-3 bg-secondary/20 text-secondary-800 dark:text-secondary-200 font-semibold rounded-xl hover:bg-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
                    {isLoading && loadingType === 'short' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                    <span>{generatedQA.short.length > 0 ? 'Regenerate' : 'Generate'} Short Q&A</span>
                </button>
                <button onClick={() => handleGenerate('long')} disabled={isLoading} className="flex items-center justify-center gap-3 px-6 py-3 bg-primary/20 text-primary-800 dark:text-primary-200 font-semibold rounded-xl hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
                    {isLoading && loadingType === 'long' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                    <span>{generatedQA.long.length > 0 ? 'Regenerate' : 'Generate'} Long Q&A</span>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default PDFQA;