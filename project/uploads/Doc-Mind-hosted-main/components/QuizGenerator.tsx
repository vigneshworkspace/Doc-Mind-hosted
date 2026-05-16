

import React, { useState } from 'react';
import { Brain, FileText, Check, X, RefreshCw, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import type { Quiz, QuizQuestion, Document, Settings } from '../types';

interface QuizGeneratorProps {
  settings: Settings;
  documents: Document[];
  quizzes: Quiz[];
  setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  setActivityLog: React.Dispatch<React.SetStateAction<string[]>>;
  activeQuiz: Quiz | null;
  setActiveQuiz: (quiz: Quiz | null) => void;
}

const QuizGenerator: React.FC<QuizGeneratorProps> = ({ settings, documents, quizzes, setQuizzes, setActivityLog, activeQuiz, setActiveQuiz }) => {
  const [sourceText, setSourceText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  
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

  const handleGenerateQuiz = async () => {
    const textToProcess = sourceText.trim();
    if (!textToProcess) {
      setError('Please provide some text or select a document to generate a quiz from.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setActiveQuiz(null);
    setShowResults(false);
    setUserAnswers([]);
    setCurrentQuestionIndex(0);

    try {
      const generatedData = await geminiService.generateQuizFromText(settings, textToProcess, title || 'Generated Quiz');
      const newQuiz: Quiz = {
        id: Date.now(),
        title: generatedData.title,
        questions: generatedData.questions,
        completed: false,
        score: null,
        date: new Date().toISOString().split('T')[0],
        sourceDocumentId: selectedDocId ? parseInt(selectedDocId) : undefined,
      };
      setActiveQuiz(newQuiz);
    } catch (e: any) {
      setError(`Failed to generate quiz: ${e.message}. Please try again.`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (userAnswers.length > currentQuestionIndex) return;
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);

    setTimeout(() => {
      if (currentQuestionIndex < (activeQuiz?.questions.length || 0) - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        finishQuiz(newAnswers);
      }
    }, 500);
  };

  const finishQuiz = (finalAnswers: string[]) => {
    if (!activeQuiz) return;
    const correctCount = finalAnswers.reduce((count, answer, index) => {
      return answer === activeQuiz.questions[index].correctAnswer ? count + 1 : count;
    }, 0);
    const score = Math.round((correctCount / activeQuiz.questions.length) * 100);
    const completedQuiz = { ...activeQuiz, completed: true, score };
    
    const finalQuizState = {...completedQuiz};
    
    setQuizzes(prev => [finalQuizState, ...prev.filter(q => q.id !== finalQuizState.id)]);
    setActiveQuiz(finalQuizState);
    setShowResults(true);

    const today = new Date().toISOString().split('T')[0];
    setActivityLog(prev => Array.from(new Set([...prev, today])));
  };

  const restartQuiz = () => {
    setActiveQuiz(null);
    setShowResults(false);
    setUserAnswers([]);
    setCurrentQuestionIndex(0);
    setSourceText('');
    setTitle('');
    setSelectedDocId('');
  }
  
  React.useEffect(() => {
    if (activeQuiz) {
        if (activeQuiz.completed) {
            setShowResults(true);
        } else {
            setShowResults(false);
            setUserAnswers([]);
            setCurrentQuestionIndex(0);
        }
    }
  }, [activeQuiz]);

  const currentQuestion = activeQuiz?.questions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestionIndex];

  if (activeQuiz && !showResults) {
    return (
       <div className="max-w-3xl mx-auto p-8 glass-card rounded-2xl animate-fadeIn">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{activeQuiz.title}</h2>
          <p className="text-muted-text dark:text-dark-muted-text">Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}</p>
        </div>
        <div className="w-full bg-white/30 dark:bg-white/10 rounded-full h-2.5 mb-8">
          <div className="bg-gradient-to-r from-primary to-yellow-300 h-2.5 rounded-full transition-all duration-300" style={{ width: `${((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100}%` }}></div>
        </div>
        {currentQuestion && (
          <div>
            <h3 className="text-xl font-semibold mb-6">{currentQuestion.questionText}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options.map((option, i) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = currentQuestion.correctAnswer === option;
                let buttonClass = 'bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10';
                if (isSelected) {
                  buttonClass = isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
                }
                return (
                  <button key={i} onClick={() => handleAnswerSelect(option)} disabled={!!selectedAnswer} className={`p-4 rounded-lg text-left transition-all duration-300 transform hover:scale-105 active:scale-100 ${buttonClass}`}>
                    <span className="font-semibold">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  if (showResults && activeQuiz) {
    const correctAnswersCount = activeQuiz.score ? Math.round(activeQuiz.score / 100 * activeQuiz.questions.length) : 0;
    return(
      <div className="max-w-3xl mx-auto h-full flex flex-col animate-fadeIn">
        <div className="p-8 glass-card rounded-2xl flex flex-col flex-grow">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-primary mb-4"/>
            <h2 className="text-3xl font-bold mb-2">Quiz Completed!</h2>
            <p className="text-5xl font-bold my-4 text-primary">{activeQuiz.score}%</p>
            <p className="text-muted-text dark:text-dark-muted-text">You answered {correctAnswersCount} out of {activeQuiz.questions.length} questions correctly.</p>
          </div>

          <div className="flex-grow overflow-y-auto mt-8 text-left space-y-4 pr-4">
              <h3 className="text-xl font-bold">Review Answers:</h3>
              {activeQuiz.questions.map((q, i) => (
                  <div key={i} className="p-4 rounded-lg bg-white/20 dark:bg-white/5">
                      <p className="font-semibold">{i+1}. {q.questionText}</p>
                      <p className="text-green-600 mt-2">Correct answer: {q.correctAnswer}</p>
                      <p className="text-sm text-muted-text dark:text-dark-muted-text mt-1">Explanation: {q.explanation}</p>
                  </div>
              ))}
          </div>

          <div className="mt-8 text-center">
            <button onClick={restartQuiz} className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-primary text-dark-text font-bold rounded-xl hover:bg-opacity-80 transition-all duration-300 transform hover:scale-105 active:scale-95">
              <RefreshCw className="w-5 h-5"/>
              Create Another Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto animate-fadeIn">
      <div className="text-center">
         <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 dark:bg-primary/30 rounded-2xl mb-4">
          <Brain className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">AI Quiz Generator</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Turn your notes and documents into interactive quizzes instantly.</p>
      </div>

      <div className="p-8 glass-card rounded-2xl space-y-6">
        <div>
          <label htmlFor="doc-select" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">
            1. Choose a Document (Optional)
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
            2. Or Paste Your Text Here
          </label>
          <textarea
            id="source-text"
            rows={10}
            value={sourceText}
            onChange={(e) => {
              setSourceText(e.target.value);
              setSelectedDocId('');
            }}
            placeholder="Paste your notes, an article, or any text here to generate a quiz."
            className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
          />
        </div>

         <div>
          <label htmlFor="quiz-title" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">
            3. Give your quiz a title
          </label>
          <input
            id="quiz-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Chapter 5 Review"
            className="w-full px-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleGenerateQuiz}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 disabled:bg-light-border disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95"
        >
          {isLoading ? (
             <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
             <>
              <Brain className="w-6 h-6" />
              <span>Generate Quiz</span>
             </>
          )}
        </button>
      </div>
    </div>
  );
};

export default QuizGenerator;