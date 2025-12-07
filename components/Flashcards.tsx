

import React, { useState } from 'react';
import { Layers, RefreshCw, ChevronLeft, ChevronRight, ArrowLeft, Brain } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { FlashcardSet, Document, Settings } from '../types';

interface FlashcardsProps {
  settings: Settings;
  documents: Document[];
  flashcardSets: FlashcardSet[];
  setFlashcardSets: React.Dispatch<React.SetStateAction<FlashcardSet[]>>;
  setActivityLog: React.Dispatch<React.SetStateAction<string[]>>;
  activeSet: FlashcardSet | null;
  setActiveSet: (set: FlashcardSet | null) => void;
}

const cardColors = [
  'bg-gradient-to-br from-primary to-yellow-400',
  'bg-gradient-to-br from-blue-500 to-sky-400',
  'bg-gradient-to-br from-purple-500 to-indigo-400',
  'bg-gradient-to-br from-pink-500 to-rose-400',
  'bg-gradient-to-br from-orange-500 to-amber-400',
];

const Flashcards: React.FC<FlashcardsProps> = ({ settings, documents, flashcardSets, setFlashcardSets, setActivityLog, activeSet, setActiveSet }) => {
  const [sourceText, setSourceText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  React.useEffect(() => {
    if (activeSet) {
        setCurrentCardIndex(0);
        setIsFlipped(false);
    }
  }, [activeSet]);

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
      const generatedData = await geminiService.generateFlashcardsFromText(settings, textToProcess, title || 'Generated Flashcards');
      const newSet: FlashcardSet = {
        id: Date.now(),
        title: generatedData.title,
        cards: generatedData.cards.map((card, index) => ({...card, id: index})),
        date: new Date().toISOString().split('T')[0],
        sourceDocumentId: selectedDocId ? parseInt(selectedDocId) : undefined,
      };
      setFlashcardSets(prev => [newSet, ...prev]);
      setActiveSet(newSet);
      
      const today = new Date().toISOString().split('T')[0];
      setActivityLog(prev => Array.from(new Set([...prev, today])));
    } catch (e: any) {
      setError(`Failed to generate flashcards: ${e.message}. Please try again.`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const navigateCard = (direction: 'next' | 'prev') => {
    if (!activeSet) return;
    const newIndex = direction === 'next' 
      ? (currentCardIndex + 1) % activeSet.cards.length
      : (currentCardIndex - 1 + activeSet.cards.length) % activeSet.cards.length;
    setCurrentCardIndex(newIndex);
    setIsFlipped(false);
  };
  
  if (activeSet) {
    const currentCard = activeSet.cards[currentCardIndex];
    return (
      <div className="max-w-2xl mx-auto animate-fadeIn">
        <button onClick={() => setActiveSet(null)} className="flex items-center gap-2 mb-6 text-muted-text dark:text-dark-muted-text hover:text-primary font-semibold transition-colors">
          <ArrowLeft className="w-5 h-5"/>
          Back to Generator
        </button>
        <h2 className="text-3xl font-bold text-center mb-2">{activeSet.title}</h2>
        <p className="text-center text-muted-text dark:text-dark-muted-text mb-6">Card {currentCardIndex + 1} of {activeSet.cards.length}</p>
        
        <div className="perspective-1000 w-[90vw] max-w-sm mx-auto aspect-[5/7] mb-6" onClick={() => setIsFlipped(!isFlipped)}>
          <div 
            className="relative w-full h-full transform-style-3d transition-transform duration-700 cursor-pointer"
            style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            {/* Front of card */}
            <div className={`absolute w-full h-full backface-hidden rounded-2xl flex items-center justify-center p-6 text-center text-white font-bold text-2xl shadow-xl ${cardColors[currentCardIndex % cardColors.length]}`}>
              {currentCard.question}
            </div>
            {/* Back of card */}
            <div className={`absolute w-full h-full backface-hidden rounded-2xl flex items-center justify-center p-6 text-center glass-card transform-rotate-y-180`}>
              <p className="text-xl">
                {currentCard.answer}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
           <button onClick={() => navigateCard('prev')} className="flex items-center gap-2 px-5 py-3 glass-card rounded-xl hover:shadow-primary/20 transition-all font-semibold transform hover:scale-105 active:scale-95">
            <ChevronLeft className="w-5 h-5" />
            Prev
          </button>
          <button onClick={() => setIsFlipped(!isFlipped)} className="px-5 py-3 glass-card rounded-xl hover:shadow-primary/20 transition-all font-semibold transform hover:scale-105 active:scale-95">
            Flip Card
          </button>
          <button onClick={() => navigateCard('next')} className="flex items-center gap-2 px-5 py-3 glass-card rounded-xl hover:shadow-primary/20 transition-all font-semibold transform hover:scale-105 active:scale-95">
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-8 max-w-3xl mx-auto animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
          <Layers className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Flashcard Generator</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Create flashcards from your documents or notes.</p>
      </div>
      
      <div className="p-8 glass-card rounded-2xl space-y-6">
        <div>
          <label htmlFor="doc-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">1. Choose a Document (Optional)</label>
          <select id="doc-select" value={selectedDocId} onChange={handleDocSelection} className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
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
          <label htmlFor="source-text" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">2. Or Paste Your Text Here</label>
          <textarea id="source-text" rows={8} value={sourceText} onChange={(e) => { setSourceText(e.target.value); setSelectedDocId(''); }} placeholder="Paste your notes or any text here." className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text" />
        </div>
        <div>
          <label htmlFor="set-title" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">3. Give your flashcard set a title</label>
          <input id="set-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Biology Chapter 3" className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={handleGenerate} disabled={isLoading} className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 disabled:bg-light-border disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95">
          {isLoading ? (
            <><RefreshCw className="w-5 h-5 animate-spin" /><span>Generating...</span></>
          ) : (
            <><Brain className="w-6 h-6" /><span>Generate Flashcards</span></>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col space-y-4 min-h-0">
        <h2 className="text-2xl font-bold">Your Flashcard Sets</h2>
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {flashcardSets.length > 0 ? (
            <>
                {flashcardSets.map(set => (
                <div key={set.id} onClick={() => setActiveSet(set)} className="p-4 glass-card rounded-xl flex justify-between items-center cursor-pointer hover:shadow-primary/20 hover:-translate-y-px transition-all">
                    <div>
                    <h3 className="font-semibold">{set.title}</h3>
                    <p className="text-sm text-muted-text dark:text-dark-muted-text">{set.cards.length} cards · Created on {set.date}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-text dark:text-dark-muted-text" />
                </div>
                ))}
            </>
            ) : (
            <p className="text-center text-muted-text dark:text-dark-muted-text py-4">You haven't created any flashcard sets yet.</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default Flashcards;