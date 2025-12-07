import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';

const SESSIONS = {
    WORK: 'work',
    SHORT_BREAK: 'shortBreak',
    LONG_BREAK: 'longBreak',
} as const;

export type SessionType = typeof SESSIONS[keyof typeof SESSIONS];

interface PomodoroSettings {
    work: number;
    shortBreak: number;
    longBreak: number;
}

interface PomodoroContextType {
    settings: PomodoroSettings;
    mode: SessionType;
    timeRemaining: number;
    isActive: boolean;
    pomodorosCompleted: number;
    toggleTimer: () => void;
    resetTimer: () => void;
    selectMode: (newMode: SessionType) => void;
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined);

export const usePomodoro = () => {
    const context = useContext(PomodoroContext);
    if (!context) {
        throw new Error('usePomodoro must be used within a PomodoroProvider');
    }
    return context;
};

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings] = useState<PomodoroSettings>({ work: 25, shortBreak: 5, longBreak: 15 });
    const [mode, setMode] = useState<SessionType>(SESSIONS.WORK);
    const [pomodorosCompleted, setPomodorosCompleted] = useState(0);
    const [isActive, setIsActive] = useState(false);
    
    const initialTime = useMemo(() => {
        switch (mode) {
            case SESSIONS.SHORT_BREAK: return settings.shortBreak * 60;
            case SESSIONS.LONG_BREAK: return settings.longBreak * 60;
            default: return settings.work * 60;
        }
    }, [mode, settings]);

    const [timeRemaining, setTimeRemaining] = useState(initialTime);

    const nextMode = useCallback(() => {
        if (mode === SESSIONS.WORK) {
            const newPomodoros = pomodorosCompleted + 1;
            setPomodorosCompleted(newPomodoros);
            if (newPomodoros > 0 && newPomodoros % 4 === 0) {
                setMode(SESSIONS.LONG_BREAK);
            } else {
                setMode(SESSIONS.SHORT_BREAK);
            }
        } else {
            setMode(SESSIONS.WORK);
        }
        setIsActive(false);
    }, [mode, pomodorosCompleted]);
    
    useEffect(() => {
        if (!isActive) {
            setTimeRemaining(initialTime);
        }
    }, [initialTime, isActive]);
    
    useEffect(() => {
        let interval: number | null = null;
        if (isActive && timeRemaining > 0) {
            interval = window.setInterval(() => {
                setTimeRemaining(time => time - 1);
            }, 1000);
        } else if (isActive && timeRemaining === 0) {
            nextMode();
        }
        return () => {
            if (interval) window.clearInterval(interval);
        };
    }, [isActive, timeRemaining, nextMode]);

    const toggleTimer = () => {
        if (timeRemaining === 0) {
            nextMode();
        }
        setIsActive(prev => !prev);
    };

    const resetTimer = useCallback(() => {
        setIsActive(false);
        setTimeRemaining(initialTime);
    }, [initialTime]);
    
    const selectMode = (newMode: SessionType) => {
        if (isActive) return;
        setMode(newMode);
        setIsActive(false);
    };

    const value = {
        settings,
        mode,
        timeRemaining,
        isActive,
        pomodorosCompleted,
        toggleTimer,
        resetTimer,
        selectMode,
    };

    return (
        <PomodoroContext.Provider value={value}>
            {children}
        </PomodoroContext.Provider>
    );
};
