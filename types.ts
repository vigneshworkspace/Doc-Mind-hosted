

export type Tab = 'dashboard' | 'ai-chat' | 'documents' | 'history' | 'quiz-generator' | 'flashcards' | 'study-notes' | 'study-groups' | 'settings' | 'mind-map' | 'audio-recap' | 'youtube' | 'pdf-qa' | 'visual-ai' | 'pomodoro' | 'voice-chat' | 'concept-visualizer' | 'ai-diagram-maker' | 'quick-revise';

export interface Document {
  id: number;
  name: string;
  size: string;
  type: string;
  uploadDate: string;
  tags: string[];
  content?: string; // Add content for quiz generation
  fileData?: ArrayBuffer; // For PDF viewer
}

export interface Source {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  sources?: Source[];
}

export interface Note {
  id: number;
  title: string;
  content: string;
  date: string;
  subject: string;
}

export interface StudyGroup {
  id: number;
  name: string;
  members: number;
  subject: string;
  nextSession: string;
  description: string;
}

export interface QuizQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  id: number;
  title: string;
  questions: QuizQuestion[];
  completed: boolean;
  score: number | null;
  date: string;
  sourceDocumentId?: number;
}

export interface Flashcard {
  id: number;
  question: string;
  answer: string;
}

export interface FlashcardSet {
  id: number;
  title: string;
  cards: Flashcard[];
  date: string;
  sourceDocumentId?: number;
}

export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];
  // Properties added for rendering
  level?: number;
  x?: number;
  y?: number;
  parent?: MindMapNode;
}

export interface MindMap {
  id: number;
  title: string;
  root: MindMapNode;
  date: string;
  sourceDocumentId?: number;
}

export interface RecapScriptLine {
  speaker: 'Alex' | 'Ben' | 'User';
  dialogue: string;
}

export interface AudioRecap {
  id: number;
  title: string;
  summary: string;
  script: RecapScriptLine[];
  date: string;
  sourceText: string;
  sourceDocumentId?: number;
}

export interface QAItem {
  question: string;
  answer: string;
}

export interface RevisionPoint {
  keyPoint: string;
  simplifiedExplanation: string;
  detailedExplanation: string;
}

export interface QuickReviseSession {
  id: number;
  title: string;
  points: RevisionPoint[];
  date: string;
  sourceDocumentId: number;
}

export interface Settings {
  language: string;
  notifications: boolean;
  autoSave: boolean;
  studyReminders: boolean;
  aiProvider: 'gemini' | 'ollama';
  ollamaEndpoint: string;
}