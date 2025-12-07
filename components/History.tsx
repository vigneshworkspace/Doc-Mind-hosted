
import React from 'react';
import { History as HistoryIcon, FileText, Brain, Layers, GitFork, Mic, MessageSquare, ChevronRight, Zap } from 'lucide-react';
import type { Document, Quiz, FlashcardSet, MindMap, AudioRecap, QuickReviseSession, Tab } from '../types';

interface HistoryProps {
  documents: Document[];
  quizzes: Quiz[];
  flashcardSets: FlashcardSet[];
  mindMaps: MindMap[];
  audioRecaps: AudioRecap[];
  quickReviseSessions: QuickReviseSession[];
  setActiveTab: (tab: Tab) => void;
  setActiveQuiz: (quiz: Quiz | null) => void;
  setActiveFlashcardSet: (set: FlashcardSet | null) => void;
  setActiveMindMap: (map: MindMap | null) => void;
  setActiveAudioRecap: (recap: AudioRecap | null) => void;
  setActiveQuickReviseSession: (session: QuickReviseSession | null) => void;
  setChatContextDocId: (id: string) => void;
}

const History: React.FC<HistoryProps> = ({ 
    documents, 
    quizzes, 
    flashcardSets, 
    mindMaps, 
    audioRecaps,
    quickReviseSessions,
    setActiveTab,
    setActiveQuiz,
    setActiveFlashcardSet,
    setActiveMindMap,
    setActiveAudioRecap,
    setActiveQuickReviseSession,
    setChatContextDocId,
}) => {

    const generatedItemsMap = documents.map(doc => {
        return {
            doc,
            docQuizzes: quizzes.filter(q => q.sourceDocumentId === doc.id),
            docFlashcards: flashcardSets.filter(fs => fs.sourceDocumentId === doc.id),
            docMindMaps: mindMaps.filter(mm => mm.sourceDocumentId === doc.id),
            docAudioRecaps: audioRecaps.filter(ar => ar.sourceDocumentId === doc.id),
            docQuickReviseSessions: quickReviseSessions.filter(qr => qr.sourceDocumentId === doc.id),
        }
    }).filter(item => 
        item.docQuizzes.length > 0 || 
        item.docFlashcards.length > 0 || 
        item.docMindMaps.length > 0 || 
        item.docAudioRecaps.length > 0 ||
        item.docQuickReviseSessions.length > 0
    );

    const ItemRow = ({ icon: Icon, text, onClick }: {icon: React.ElementType, text: string, onClick: () => void}) => (
        <button onClick={onClick} className="w-full flex items-center justify-between p-3 bg-white/20 dark:bg-white/5 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 hover:shadow-md transition-all group">
            <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-primary" />
                <span className="font-medium">{text}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-text dark:text-dark-muted-text group-hover:text-primary transition-transform group-hover:translate-x-1" />
        </button>
    );

  return (
    <div className="space-y-8 animate-fadeIn h-full flex flex-col">
      <div>
        <h1 className="text-4xl font-bold">Document History</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Review all content generated from your documents.</p>
      </div>

      {generatedItemsMap.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center glass-card rounded-2xl">
            <HistoryIcon className="w-16 h-16 text-muted-text dark:text-dark-muted-text mb-4" />
            <h2 className="text-2xl font-semibold">No History Yet</h2>
            <p className="text-muted-text dark:text-dark-muted-text mt-2 max-w-sm">Generate quizzes, flashcards, mind maps, or audio recaps from your documents to see your history here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {generatedItemsMap.map(({ doc, docQuizzes, docFlashcards, docMindMaps, docAudioRecaps, docQuickReviseSessions }) => (
                <div key={doc.id} className="glass-card rounded-2xl p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                            <div>
                                <h2 className="text-xl font-bold">{doc.name}</h2>
                                <p className="text-sm text-muted-text dark:text-dark-muted-text">Uploaded on {doc.uploadDate}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setChatContextDocId(doc.id.toString());
                                setActiveTab('ai-chat');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white font-semibold rounded-lg hover:bg-opacity-90 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <MessageSquare className="w-5 h-5"/>
                            Chat about this document
                        </button>
                    </div>

                    <div className="space-y-3">
                        {docQuizzes.map(q => (
                            <ItemRow key={q.id} icon={Brain} text={q.title} onClick={() => { setActiveQuiz(q); setActiveTab('quiz-generator'); }} />
                        ))}
                        {docFlashcards.map(fs => (
                            <ItemRow key={fs.id} icon={Layers} text={fs.title} onClick={() => { setActiveFlashcardSet(fs); setActiveTab('flashcards'); }} />
                        ))}
                        {docMindMaps.map(mm => (
                            <ItemRow key={mm.id} icon={GitFork} text={mm.title} onClick={() => { setActiveMindMap(mm); setActiveTab('mind-map'); }} />
                        ))}
                        {docAudioRecaps.map(ar => (
                            <ItemRow key={ar.id} icon={Mic} text={ar.title} onClick={() => { setActiveAudioRecap(ar); setActiveTab('audio-recap'); }} />
                        ))}
                         {docQuickReviseSessions.map(qr => (
                            <ItemRow key={qr.id} icon={Zap} text={qr.title} onClick={() => { setActiveQuickReviseSession(qr); setActiveTab('quick-revise'); }} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default History;