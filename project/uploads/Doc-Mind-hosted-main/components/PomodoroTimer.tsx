import React, { useEffect, useMemo } from 'react';
import { Timer as TimerIcon, Play, Pause, RefreshCw, Coffee, Brain } from 'lucide-react';
import { usePomodoro, SessionType } from './PomodoroContext';

const SESSIONS = {
    WORK: 'work',
    SHORT_BREAK: 'shortBreak',
    LONG_BREAK: 'longBreak',
} as const;

const PomodoroTimer: React.FC = () => {
    const {
        settings,
        mode,
        timeRemaining,
        isActive,
        pomodorosCompleted,
        toggleTimer,
        resetTimer,
        selectMode,
    } = usePomodoro();

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    const totalDuration = useMemo(() => {
        switch(mode) {
            case SESSIONS.SHORT_BREAK: return settings.shortBreak * 60;
            case SESSIONS.LONG_BREAK: return settings.longBreak * 60;
            default: return settings.work * 60;
        }
    }, [mode, settings]);

    const progress = (totalDuration - timeRemaining) / totalDuration * 100;
    
    useEffect(() => {
        document.title = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} - ${mode === SESSIONS.WORK ? 'Work' : 'Break'}`;
    }, [minutes, seconds, mode]);

    const getModeInfo = () => {
        switch(mode) {
            case SESSIONS.WORK:
                return { text: 'Time to focus', icon: <Brain className="w-8 h-8"/>, color: 'text-primary' };
            case SESSIONS.SHORT_BREAK:
                return { text: 'Take a short break', icon: <Coffee className="w-8 h-8"/>, color: 'text-green-500' };
            case SESSIONS.LONG_BREAK:
                return { text: 'Take a long break', icon: <Coffee className="w-8 h-8"/>, color: 'text-blue-500' };
            default:
                return { text: 'Ready?', icon: <TimerIcon className="w-8 h-8"/>, color: 'text-primary' };
        }
    };
    
    const modeInfo = getModeInfo();

    const circleRadius = 120;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const strokeDashoffset = circleCircumference - (progress / 100) * circleCircumference;

    return (
        <div className="space-y-8 max-w-2xl mx-auto text-center animate-fadeIn">
            <div>
                <h1 className="text-4xl font-bold">Pomodoro Timer</h1>
                <p className="text-lg text-muted-text dark:text-dark-muted-text">Stay focused and manage your study sessions.</p>
            </div>

            <div className="flex items-center justify-center gap-2 glass-card rounded-2xl p-2 mb-8">
                <button onClick={() => selectMode('work')} disabled={isActive} className={`px-4 py-2 rounded-lg font-semibold transition w-full ${mode === 'work' ? 'bg-primary text-dark-text' : 'hover:bg-white/20 dark:hover:bg-black/20 disabled:opacity-50'}`}>Work</button>
                <button onClick={() => selectMode('shortBreak')} disabled={isActive} className={`px-4 py-2 rounded-lg font-semibold transition w-full ${mode === 'shortBreak' ? 'bg-green-500/80 text-white' : 'hover:bg-white/20 dark:hover:bg-black/20 disabled:opacity-50'}`}>Short Break</button>
                <button onClick={() => selectMode('longBreak')} disabled={isActive} className={`px-4 py-2 rounded-lg font-semibold transition w-full ${mode === 'longBreak' ? 'bg-blue-500/80 text-white' : 'hover:bg-white/20 dark:hover:bg-black/20 disabled:opacity-50'}`}>Long Break</button>
            </div>


            <div className="glass-card rounded-3xl p-8 sm:p-12 space-y-8">
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto">
                    <svg className="w-full h-full" viewBox="0 0 280 280">
                        <circle
                            cx="140" cy="140" r={circleRadius}
                            strokeWidth="15"
                            className="stroke-current text-white/20 dark:text-white/10"
                            fill="none"
                        />
                        <circle
                            cx="140" cy="140" r={circleRadius}
                            strokeWidth="15"
                            strokeLinecap="round"
                            transform="rotate(-90 140 140)"
                            className={`stroke-current ${modeInfo.color} transition-colors duration-500`}
                            fill="none"
                            style={{ strokeDasharray: circleCircumference, strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }}
                            />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className={`mb-2 ${modeInfo.color}`}>
                           {modeInfo.icon}
                        </div>
                        <p className="text-6xl sm:text-7xl font-bold tracking-tighter">
                            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                        </p>
                        <p className="text-lg font-semibold mt-2 text-muted-text dark:text-dark-muted-text">{modeInfo.text}</p>
                    </div>
                </div>
                
                <div className="flex items-center justify-center gap-4">
                     <button
                        onClick={toggleTimer}
                        className={`flex items-center justify-center gap-3 px-10 py-4 text-xl font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 transition-all shadow-lg transform hover:scale-105 active:scale-95 ${isActive ? 'bg-secondary text-white' : 'bg-primary text-dark-text'}`}
                    >
                        {isActive ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
                        <span>{isActive ? 'Pause' : 'Start'}</span>
                    </button>
                    <button onClick={resetTimer} className="p-4 rounded-xl glass-card hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                        <RefreshCw className="w-7 h-7 text-muted-text dark:text-dark-muted-text" />
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-4">
                <p className="text-lg font-semibold">Pomodoros completed: <span className="text-primary">{pomodorosCompleted}</span></p>
                <p className="text-sm text-muted-text dark:text-dark-muted-text">Complete 4 pomodoros to earn a long break!</p>
            </div>
        </div>
    );
};

export default PomodoroTimer;
