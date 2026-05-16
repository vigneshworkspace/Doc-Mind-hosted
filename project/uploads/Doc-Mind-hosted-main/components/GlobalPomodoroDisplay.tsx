import React from 'react';
import { Play, Pause } from 'lucide-react';
import { usePomodoro } from './PomodoroContext';

const GlobalPomodoroDisplay: React.FC = () => {
    const { timeRemaining, isActive, toggleTimer, settings, mode } = usePomodoro();

    const totalDuration = mode === 'work' ? settings.work * 60 : mode === 'shortBreak' ? settings.shortBreak * 60 : settings.longBreak * 60;

    // Show only if timer is active or paused mid-session
    if (!isActive && timeRemaining === totalDuration) {
        return null;
    }

    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');

    return (
        <div className="flex items-center gap-2 p-1.5 glass-card rounded-full text-sm font-semibold animate-fadeIn">
            <span className="pl-2 pr-1">{`${minutes}:${seconds}`}</span>
            <button
                onClick={toggleTimer}
                className="p-1.5 bg-primary text-dark-text rounded-full hover:bg-opacity-80 transition-all"
                aria-label={isActive ? 'Pause timer' : 'Resume timer'}
            >
                {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
        </div>
    );
};

export default GlobalPomodoroDisplay;
