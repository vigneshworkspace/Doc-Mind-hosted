
import React from 'react';
import { LayoutDashboard, MessageSquare, FileText, History, Brain, Layers, GitFork, Mic, StickyNote, Users, Settings, Youtube, LogOut, FileQuestion, Image, Timer, Radio, Atom, Share2, Zap } from 'lucide-react';
import type { Tab } from '../types';
import Logo from './Logo';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  handleLogout: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ai-chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'quiz-generator', label: 'Quiz AI', icon: Brain },
  { id: 'pdf-qa', label: 'PDF Q&A', icon: FileQuestion },
  { id: 'visual-ai', label: 'Ask Doubts', icon: Image },
  { id: 'concept-visualizer', label: 'Concept Visualizer', icon: Atom },
  { id: 'ai-diagram-maker', label: 'Diagram Maker', icon: Share2 },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'mind-map', label: 'Mind Map', icon: GitFork },
  { id: 'audio-recap', label: 'Audio Recap', icon: Mic },
  { id: 'quick-revise', label: 'Quick Revise', icon: Zap },
  { id: 'voice-chat', label: 'Voice Chat', icon: Radio },
  { id: 'pomodoro', label: 'Pomodoro', icon: Timer },
  { id: 'study-notes', label: 'Notes', icon: StickyNote },
  { id: 'study-groups', label: 'Groups', icon: Users },
  { id: 'history', label: 'History', icon: History },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, handleLogout, isOpen, setIsOpen }) => {
  const handleItemClick = (tab: Tab) => {
    setActiveTab(tab);
    setIsOpen(false);
  }
  
  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      ></div>

      <aside className={`fixed inset-y-0 left-0 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-xl border-r border-light-border dark:border-dark-border flex flex-col z-50
                        w-64 md:w-20 md:hover:w-64 md:relative md:inset-y-auto md:left-auto md:m-2 md:my-4 md:rounded-2xl md:shadow-2xl 
                        transition-all duration-300 ease-in-out group
                        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 flex justify-center items-center flex-shrink-0 h-[84px] overflow-hidden">
          <Logo className="w-auto h-10 transition-all duration-300" />
        </div>
        <nav className="flex-1 px-3 space-y-2 overflow-y-auto overflow-x-hidden hide-scrollbar">
          {sidebarItems.map(item => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id as Tab)}
                title={item.label}
                className={`w-full flex items-center p-3 transition-all duration-200 rounded-lg outline-none focus:outline-none relative ${
                  isActive 
                    ? 'bg-primary text-dark-text shadow-md' 
                    : 'text-muted-text dark:text-dark-muted-text hover:bg-white/50 dark:hover:bg-white/10'
                }`}
              >
                <IconComponent className="w-6 h-6 flex-shrink-0" />
                <span className={`ml-4 font-semibold whitespace-nowrap opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:delay-150`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-4 flex-shrink-0 space-y-2">
          <button
            onClick={() => handleItemClick('settings')}
            title="Settings"
            className={`w-full flex items-center p-3 transition-colors duration-200 rounded-lg ${activeTab === 'settings' ? 'bg-white/70 dark:bg-white/10 text-dark-text dark:text-light-text shadow-sm' : 'text-muted-text dark:text-dark-muted-text hover:bg-white/50 dark:hover:bg-white/10'}`}
          >
            <Settings className="w-6 h-6 flex-shrink-0" />
            <span className="ml-4 font-semibold whitespace-nowrap opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:delay-150">Settings</span>
          </button>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="w-full flex items-center p-3 transition-colors duration-200 rounded-lg text-muted-text dark:text-dark-muted-text hover:bg-red-500/10 hover:text-red-500"
          >
            <LogOut className="w-6 h-6 flex-shrink-0" />
            <span className="ml-4 font-semibold whitespace-nowrap opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:delay-150">Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;