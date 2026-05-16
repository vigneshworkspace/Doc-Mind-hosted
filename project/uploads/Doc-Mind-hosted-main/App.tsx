

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AIChat from './components/AIChat';
import DocumentsHub from './components/DocumentsHub';
import History from './components/History';
import QuizGenerator from './components/QuizGenerator';
import Flashcards from './components/Flashcards';
import MindMapGenerator from './components/MindMapGenerator';
import AudioRecapGenerator from './components/AudioRecapGenerator';
import StudyNotes from './components/StudyNotes';
import StudyGroups from './components/StudyGroups';
import SettingsComponent from './components/Settings';
import YouTubeView from './components/YouTubeView';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import PdfViewer from './components/PdfViewer';
import PDFQA from './components/PDFQA';
import VisualAI from './components/VisualAI';
import ConceptVisualizer from './components/ConceptVisualizer';
import PomodoroTimer from './components/PomodoroTimer';
import GlobalPomodoroDisplay from './components/GlobalPomodoroDisplay';
import VoiceChatVisualizer from './components/VoiceChatVisualizer';
import AIDiagramMaker from './components/AIDiagramMaker';
import QuickRevise from './components/QuickRevise';
import type { Tab, Settings, Document, Quiz, Note, StudyGroup, FlashcardSet, MindMap, AudioRecap, QuickReviseSession } from './types';
import { Sun, Moon, Menu } from 'lucide-react';

// Mock data to make the app feel alive on first load
const initialDocuments: Document[] = [
  { id: 1, name: 'Quantum Physics Intro.pdf', size: '2.1 MB', type: 'pdf', uploadDate: '2024-05-20', tags: ['Physics', 'Lecture Notes'], content: 'Quantum physics is the study of matter and energy at the most fundamental level. Key concepts include quantization, which is the concept that a physical quantity can only have certain discrete values. Another key concept is wave-particle duality, which is the idea that every particle may be described as either a particle or a wave. The uncertainty principle states that there is a fundamental limit to the precision with which certain pairs of physical properties of a particle, such as position and momentum, can be known.' },
  { id: 2, name: 'Calculus Cheatsheet.docx', size: '0.5 MB', type: 'docx', uploadDate: '2024-05-18', tags: ['Math', 'Formulas'], content: 'A document containing key calculus formulas for derivatives and integrals. The chain rule is a formula to compute the derivative of a composite function. The product rule is a formula used to find the derivatives of products of two or more functions. The fundamental theorem of calculus relates differentiation and integration.' },
];

const initialQuizzes: Quiz[] = [
    { id: 1, title: "History of Rome", questions: [], completed: true, score: 85, date: '2024-05-21' },
    { id: 2, title: "Algebra Basics", questions: [], completed: true, score: 92, date: '2024-05-22' },
    { id: 3, title: "Intro to Physics", questions: [], completed: false, score: null, date: '2024-05-23' },
    { id: 4, title: "Quantum Physics Quiz", questions: [{ questionText: "What is quantization?", options: ["A", "B", "C", "D"], correctAnswer: "A", explanation: "..."}], completed: true, score: 100, date: '2024-05-25', sourceDocumentId: 1 }
];

const initialFlashcardSets: FlashcardSet[] = [
    { id: 1, title: "Quantum Physics Basics", date: "2024-05-24", sourceDocumentId: 1, cards: [
        { id: 1, question: "What is quantization?", answer: "The concept that a physical quantity can only have certain discrete values." },
        { id: 2, question: "What is wave-particle duality?", answer: "The concept that every particle may be described as either a particle or a wave." }
    ]},
    { id: 2, title: "Key Calculus Formulas", date: "2024-05-22", sourceDocumentId: 2, cards: [
        { id: 1, question: "What is the chain rule?", answer: "A formula to compute the derivative of a composite function." },
        { id: 2, question: "What is the product rule?", answer: "A formula used to find the derivatives of products of two or more functions." }
    ]}
];

const initialMindMaps: MindMap[] = [
    { 
        id: 1, 
        title: "Quantum Physics Concepts", 
        date: "2024-05-25", 
        sourceDocumentId: 1, 
        root: {
            id: 'root',
            text: 'Quantum Physics',
            children: [
                {
                    id: '1',
                    text: 'Foundational Concepts',
                    children: [
                        { id: '1.1', text: 'Quantization', children: [{ id: '1.1.1', text: 'Energy Levels', children: [] }] },
                        { id: '1.2', text: 'Wave-Particle Duality', children: [{id: '1.2.1', text: 'Light (Photons)', children: []}, {id: '1.2.2', text: 'Matter (de Broglie)', children: []}] },
                        { id: '1.3', text: 'Uncertainty Principle', children: [] }
                    ]
                },
                {
                    id: '2',
                    text: 'Key Phenomena',
                    children: [
                        { id: '2.1', text: 'Photoelectric Effect', children: [] },
                        { id: '2.2', text: 'Blackbody Radiation', children: [] }
                    ]
                }
            ]
        }
    }
];

const initialAudioRecaps: AudioRecap[] = [
    {
        id: 1, title: "Understanding Quantum Physics", date: "2024-05-26",
        sourceDocumentId: 1,
        sourceText: 'Quantum physics is the study of matter and energy at the most fundamental level. Key concepts include quantization, which is the concept that a physical quantity can only have certain discrete values. Another key concept is wave-particle duality, which is the idea that every particle may be described as either a particle or a wave. The uncertainty principle states that there is a fundamental limit to the precision with which certain pairs of physical properties of a particle, such as position and momentum, can be known.',
        summary: "A quick conversational overview of the core principles of Quantum Physics, including quantization and wave-particle duality.",
        script: [
            { speaker: "Alex", dialogue: "Hey Ben, let's dive into Quantum Physics. What's the first thing we should know?" },
            { speaker: "Ben", dialogue: "Hey Alex! The biggest idea is 'quantization'. It means physical properties like energy can only exist in discrete, specific amounts, not continuous values." },
            { speaker: "Alex", dialogue: "Like a staircase instead of a ramp?" },
            { speaker: "Ben", dialogue: "Exactly! And then there's wave-particle duality, the idea that tiny things like electrons can act as both a particle and a wave at the same time. It's weird but fundamental." }
        ]
    }
];

const initialQuickReviseSessions: QuickReviseSession[] = [
    {
        id: 1,
        title: "Calculus Cheatsheet Simplified",
        sourceDocumentId: 2,
        date: "2024-05-27",
        points: [
            {
                keyPoint: "The Chain Rule",
                simplifiedExplanation: "Imagine you have a toy car inside a bigger toy truck, and the truck is moving. The chain rule helps you figure out how fast the little car is moving compared to the road, not just inside the truck!",
                detailedExplanation: "The chain rule is a formula to compute the derivative of a composite function. If f and g are functions, then the chain rule expresses the derivative of their composite f(g(x)) in terms of the derivatives of f and g. Specifically, it is the product of the derivative of f with respect to g, and the derivative of g with respect to x."
            },
            {
                keyPoint: "The Product Rule",
                simplifiedExplanation: "If you have two friends, and both are running, the product rule helps you figure out how fast the distance between them is changing. It's not just adding their speeds, because they might be running in different directions!",
                detailedExplanation: "The product rule is a formula used to find the derivatives of products of two or more functions. If a function is the product of two functions, u(x) and v(x), its derivative is given by u'(x)v(x) + u(x)v'(x). It is essential for differentiating functions that are multiplied together."
            }
        ]
    }
];

const initialNotes: Note[] = [
    { id: 1, title: "Biology Lecture 3", content: "Mitochondria is the powerhouse of the cell. It generates most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.", date: '2024-05-23', subject: 'Biology' },
    { id: 2, title: "Project Ideas", content: "Idea 1: AI-powered study assistant to generate quizzes and notes. Idea 2: A collaborative platform for study groups with shared whiteboards.", date: '2024-05-22', subject: 'CS Project' }
];

const initialStudyGroups: StudyGroup[] = [
    { id: 1, name: "Finals Prep Group", members: 5, subject: "General", nextSession: '2024-05-25 18:00', description: "Covering all major topics for the final exams. Bring your questions!" },
    { id: 2, name: "Calculus Crew", members: 8, subject: "Mathematics", nextSession: '2024-05-26 15:00', description: "Weekly review of calculus concepts and problem-solving sessions." }
];

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [settings, setSettings] = useState<Settings>({
    language: 'English',
    notifications: true,
    autoSave: true,
    studyReminders: false,
    aiProvider: 'gemini',
    ollamaEndpoint: 'http://localhost:11434',
  });
  
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>(initialFlashcardSets);
  const [mindMaps, setMindMaps] = useState<MindMap[]>(initialMindMaps);
  const [audioRecaps, setAudioRecaps] = useState<AudioRecap[]>(initialAudioRecaps);
  const [quickReviseSessions, setQuickReviseSessions] = useState<QuickReviseSession[]>(initialQuickReviseSessions);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>(initialStudyGroups);
  const [activityLog, setActivityLog] = useState<string[]>(() => {
    return initialQuizzes.filter(q => q.completed).map(q => q.date);
  });

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeFlashcardSet, setActiveFlashcardSet] = useState<FlashcardSet | null>(null);
  const [activeMindMap, setActiveMindMap] = useState<MindMap | null>(null);
  const [activeAudioRecap, setActiveAudioRecap] = useState<AudioRecap | null>(null);
  const [activeQuickReviseSession, setActiveQuickReviseSession] = useState<QuickReviseSession | null>(null);
  const [chatContextDocId, setChatContextDocId] = useState<string>('');
  
  const [activePdf, setActivePdf] = useState<Document | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = () => setIsLoggedIn(true);
  const handleSignUp = () => setIsLoggedIn(true);
  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthView('login');
    setActiveTab('dashboard');
    setActivePdf(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard 
            setActiveTab={setActiveTab} 
            quizzes={quizzes} 
            documents={documents}
            flashcardSets={flashcardSets}
            studyGroups={studyGroups}
            activityLog={activityLog} />;
      case 'ai-chat':
        return <AIChat settings={settings} documents={documents} chatContextDocId={chatContextDocId} setChatContextDocId={setChatContextDocId} />;
      case 'youtube':
        return <YouTubeView settings={settings} />;
      case 'documents':
        return <DocumentsHub 
            documents={documents} 
            setDocuments={setDocuments} 
            setActivityLog={setActivityLog}
            onViewPdf={setActivePdf}
            />;
      case 'history':
        return <History 
            documents={documents} 
            quizzes={quizzes} 
            flashcardSets={flashcardSets} 
            mindMaps={mindMaps} 
            audioRecaps={audioRecaps}
            quickReviseSessions={quickReviseSessions}
            setActiveTab={setActiveTab}
            setActiveQuiz={setActiveQuiz}
            setActiveFlashcardSet={setActiveFlashcardSet}
            setActiveMindMap={setActiveMindMap}
            setActiveAudioRecap={setActiveAudioRecap}
            setActiveQuickReviseSession={setActiveQuickReviseSession}
            setChatContextDocId={setChatContextDocId}
            />;
      case 'quiz-generator':
        return <QuizGenerator settings={settings} documents={documents} quizzes={quizzes} setQuizzes={setQuizzes} setActivityLog={setActivityLog} activeQuiz={activeQuiz} setActiveQuiz={setActiveQuiz} />;
      case 'pdf-qa':
        return <PDFQA settings={settings} documents={documents} />;
      case 'visual-ai':
        return <VisualAI settings={settings} />;
      case 'concept-visualizer':
        return <ConceptVisualizer settings={settings} />;
      case 'ai-diagram-maker':
        return <AIDiagramMaker settings={settings} documents={documents} theme={theme} />;
      case 'pomodoro':
        return <PomodoroTimer />;
      case 'voice-chat':
        return <VoiceChatVisualizer />;
      case 'flashcards':
        return <Flashcards settings={settings} documents={documents} flashcardSets={flashcardSets} setFlashcardSets={setFlashcardSets} setActivityLog={setActivityLog} activeSet={activeFlashcardSet} setActiveSet={setActiveFlashcardSet} />;
      case 'mind-map':
        return <MindMapGenerator settings={settings} documents={documents} mindMaps={mindMaps} setMindMaps={setMindMaps} setActivityLog={setActivityLog} activeMap={activeMindMap} setActiveMap={setActiveMindMap} theme={theme} />;
      case 'audio-recap':
        return <AudioRecapGenerator settings={settings} documents={documents} audioRecaps={audioRecaps} setAudioRecaps={setAudioRecaps} setActivityLog={setActivityLog} activeRecap={activeAudioRecap} setActiveRecap={setActiveAudioRecap} />;
      case 'quick-revise':
        return <QuickRevise
            settings={settings}
            documents={documents}
            sessions={quickReviseSessions}
            setSessions={setQuickReviseSessions}
            setActivityLog={setActivityLog}
            activeSession={activeQuickReviseSession}
            setActiveSession={setActiveQuickReviseSession}
        />;
      case 'study-notes':
        return <StudyNotes notes={notes} setNotes={setNotes} />;
      case 'study-groups':
        return <StudyGroups studyGroups={studyGroups} setStudyGroups={setStudyGroups} />;
      case 'settings':
        return <SettingsComponent settings={settings} setSettings={setSettings} />;
      default:
        return <Dashboard 
            setActiveTab={setActiveTab} 
            quizzes={quizzes} 
            documents={documents}
            flashcardSets={flashcardSets}
            studyGroups={studyGroups}
            activityLog={activityLog} />;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="w-full h-screen flex items-center justify-center p-4">
        {authView === 'login' ? (
          <LoginPage onLogin={handleLogin} onSwitchToSignUp={() => setAuthView('signup')} />
        ) : (
          <SignUpPage onSignUp={handleSignUp} onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-transparent font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden p-4 flex justify-between items-center flex-shrink-0">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2">
                <Menu />
           </button>
           <div className="flex items-center gap-2">
            <GlobalPomodoroDisplay />
            <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-light-surface/50 dark:bg-dark-surface border border-light-border dark:border-dark-border"
                aria-label="Toggle theme"
            >
                {theme === 'light' ? <Moon className="w-5 h-5 text-dark-text" /> : <Sun className="w-5 h-5 text-primary" />}
            </button>
           </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative transition-all duration-300">
          <div className="hidden md:flex absolute top-4 right-6 z-50 items-center gap-4">
             <GlobalPomodoroDisplay />
             <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-light-surface/50 dark:bg-dark-surface border border-light-border dark:border-dark-border hover:bg-primary/20 dark:hover:bg-primary/20 transition-all duration-300"
                aria-label="Toggle theme"
            >
                {theme === 'light' ? <Moon className="w-5 h-5 text-dark-text" /> : <Sun className="w-5 h-5 text-primary" />}
             </button>
          </div>
          {renderContent()}
        </main>
        {activePdf && <PdfViewer pdf={activePdf} onClose={() => setActivePdf(null)} />}
      </div>
    </div>
  );
};

export default App;