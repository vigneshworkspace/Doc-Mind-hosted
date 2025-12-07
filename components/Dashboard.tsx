
import React, { useState, useMemo } from 'react';
import { Brain, MessageSquare, StickyNote, Users, ChevronRight, CheckCircle, Clock, Flame, Star, ChevronLeft, FileText, Layers } from 'lucide-react';
import type { Quiz, Tab, Document, FlashcardSet, StudyGroup } from '../types';

interface DashboardProps {
  setActiveTab: (tab: Tab) => void;
  quizzes: Quiz[];
  documents: Document[];
  flashcardSets: FlashcardSet[];
  studyGroups: StudyGroup[];
  activityLog: string[];
}

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-sm ${color}`}></div>
      <span>{label}</span>
    </div>
);

const toYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, quizzes, documents, flashcardSets, studyGroups, activityLog }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const stats = [
        { title: 'Total Quizzes', value: quizzes.length, icon: Brain, tab: 'quiz-generator' as Tab },
        { title: 'Flashcard Sets', value: flashcardSets.length, icon: Layers, tab: 'flashcards' as Tab },
        { title: 'Documents', value: documents.length, icon: FileText, tab: 'documents' as Tab },
        { title: 'Study Groups', value: studyGroups.length, icon: Users, tab: 'study-groups' as Tab }
    ];
    
    const streakData = useMemo(() => {
        if (activityLog.length === 0) {
            return { currentStreak: 0, bestStreak: 0, score: 0 };
        }

        const uniqueDates = new Set(activityLog);
        const sortedDates = Array.from(uniqueDates).sort();

        let currentStreak = 0;
        let checkDate = new Date();
        while (uniqueDates.has(toYYYYMMDD(checkDate))) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        let bestStreak = 0;
        let currentRun = 0;
        if (sortedDates.length > 0) {
            currentRun = 1;
            bestStreak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const currentDate = new Date(sortedDates[i] + 'T00:00:00Z');
                const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00Z');
                const diffTime = currentDate.getTime() - prevDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    currentRun++;
                } else {
                    currentRun = 1;
                }
                if (currentRun > bestStreak) {
                    bestStreak = currentRun;
                }
            }
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeDaysLast30 = sortedDates.filter(d => new Date(d) >= thirtyDaysAgo).length;
        const score = (activeDaysLast30 * 5) + (currentStreak * 2);

        return { currentStreak, bestStreak, score };
    }, [activityLog]);

    const activitySet = useMemo(() => new Set(activityLog), [activityLog]);

    const changeMonth = (amount: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + amount);
            return newDate;
        });
    }

    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-start-${i}`} className="w-full aspect-square"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const dateString = toYYYYMMDD(dayDate);
            let statusClass;

            if (activitySet.has(dateString)) {
                statusClass = 'bg-green-500';
            } else if (dayDate < today) {
                statusClass = 'bg-white/10 dark:bg-white/5'; // Missed day
            } else {
                statusClass = 'bg-gray-200/20 dark:bg-gray-700/20'; // Future day
            }

            days.push(<div key={day} className={`w-full aspect-square rounded-md ${statusClass}`}></div>);
        }
        return days;
    }


  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Welcome back! Here's your personalized learning hub.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div 
            key={stat.title} 
            className="glass-card rounded-2xl p-6 flex items-center gap-6 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-primary/20 cursor-pointer"
            onClick={() => setActiveTab(stat.tab)}
          >
            <div className="flex-shrink-0 inline-flex items-center justify-center w-14 h-14 bg-primary/20 dark:bg-primary/30 rounded-xl">
              <stat.icon className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm font-medium text-muted-text dark:text-dark-muted-text">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Quizzes</h3>
              <div className="space-y-3">
                {quizzes.slice(0, 3).map((quiz) => (
                  <div key={quiz.id} className="flex items-center justify-between p-3 bg-white/20 dark:bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium">{quiz.title}</p>
                      <p className="text-sm text-muted-text dark:text-dark-muted-text">{quiz.date}</p>
                    </div>
                    {quiz.completed ? (
                      <div className="text-right flex items-center gap-2">
                        <span className="text-green-600 font-semibold">{quiz.score}%</span>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    ) : (
                      <Clock className="w-5 h-5 text-orange-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Learning Consistency</h3>
                    <div className="px-3 py-1 text-xs font-semibold text-orange-800 bg-orange-200 rounded-full">Goal 🔥 50</div>
                </div>
                <p className="text-sm text-muted-text dark:text-dark-muted-text mt-1">Track your learning progress and consistency.</p>
                <div className="grid grid-cols-2 gap-4 mt-6 text-center">
                    <div>
                        <div className="flex items-center justify-center gap-2">
                            <Flame className="w-8 h-8 text-orange-500" />
                            <span className="text-4xl font-bold">{streakData.currentStreak}</span>
                        </div>
                        <p className="text-sm font-medium mt-1">Current Streak</p>
                        <p className="text-xs text-muted-text dark:text-dark-muted-text">My Best: {streakData.bestStreak}</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-center gap-2">
                            <Star className="w-8 h-8 text-primary" />
                            <span className="text-4xl font-bold">{streakData.score}</span>
                        </div>
                        <p className="text-sm font-medium mt-1">Consistency Score</p>
                        <p className="text-xs text-muted-text dark:text-dark-muted-text invisible">Placeholder</p>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Monthly Tracker</h3>
                    <div className="flex items-center gap-1 bg-white/20 dark:bg-white/5 p-1 rounded-lg">
                        <button className="px-3 py-1 text-xs font-semibold rounded-md bg-white/40 dark:bg-white/20 shadow">Daily</button>
                        <button className="px-3 py-1 text-xs font-semibold rounded-md text-muted-text dark:text-dark-muted-text hover:bg-white/20 dark:hover:bg-white/10">Weekly</button>
                    </div>
                </div>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-white/5"><ChevronLeft className="w-5 h-5 text-muted-text dark:text-dark-muted-text" /></button>
                    <p className="font-semibold">{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}</p>
                    <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-white/5"><ChevronRight className="w-5 h-5 text-muted-text dark:text-dark-muted-text" /></button>
                </div>
                <div className="grid grid-cols-7 gap-3 text-center text-xs text-muted-text dark:text-dark-muted-text font-semibold">
                    {dayNames.map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2 mt-2">
                    {renderCalendar()}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-text dark:text-dark-muted-text mt-4 pt-4 border-t border-white/20 dark:border-white/10">
                    <LegendItem color="bg-white/10 dark:bg-white/5" label="Missed" />
                    <LegendItem color="bg-green-500" label="Achieved" />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
