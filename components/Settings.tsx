


import React from 'react';
import type { Settings } from '../types';
import { Globe, Bell, Save, Cpu } from 'lucide-react';

interface SettingsProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const SettingsComponent: React.FC<SettingsProps> = ({ settings, setSettings }) => {
  const handleToggle = (key: keyof Omit<Settings, 'language' | 'aiProvider' | 'ollamaEndpoint'>) => {
    if(typeof settings[key] === 'boolean'){
        setSettings(s => ({ ...s, [key]: !s[key] }));
    }
  };

  const setAiProvider = (provider: 'gemini' | 'ollama') => {
    setSettings(s => ({...s, aiProvider: provider }));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-lg text-muted-text dark:text-dark-muted-text">Customize your DocMind experience.</p>
      </div>

      <div className="glass-card rounded-2xl p-8 space-y-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Cpu className="w-6 h-6 text-primary" />
                <label className="font-semibold">AI Provider</label>
            </div>
            <div className="flex items-center gap-1 bg-white/20 dark:bg-black/20 p-1 rounded-lg">
                <button 
                    onClick={() => setAiProvider('gemini')}
                    className={`px-3 py-1 text-sm font-semibold rounded-md transition-all ${settings.aiProvider === 'gemini' ? 'bg-white/40 dark:bg-white/20 shadow' : 'text-muted-text dark:text-dark-muted-text'}`}
                >
                    Gemini
                </button>
                 <button 
                    onClick={() => setAiProvider('ollama')}
                    className={`px-3 py-1 text-sm font-semibold rounded-md transition-all ${settings.aiProvider === 'ollama' ? 'bg-white/40 dark:bg-white/20 shadow' : 'text-muted-text dark:text-dark-muted-text'}`}
                >
                    Ollama
                </button>
            </div>
        </div>

        {settings.aiProvider === 'ollama' && (
             <div className="pl-10 animate-fadeIn">
                <label className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Ollama API Endpoint</label>
                <input
                    type="url"
                    value={settings.ollamaEndpoint}
                    onChange={(e) => setSettings(s => ({ ...s, ollamaEndpoint: e.target.value }))}
                    placeholder="http://localhost:11434"
                    className="w-full px-3 py-2 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
                />
             </div>
        )}

        <div className="border-t border-white/20 dark:border-white/10 my-4"></div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Globe className="w-6 h-6 text-primary" />
            <label className="font-semibold">Language</label>
          </div>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="border border-white/20 dark:border-dark-border rounded-md px-3 py-2 bg-white/20 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="English">English</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
          </select>
        </div>

        <div className="border-t border-white/20 dark:border-white/10 my-4"></div>

        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Bell className="w-6 h-6 text-primary" />
                <div>
                    <label className="font-semibold">Notifications</label>
                    <p className="text-sm text-muted-text dark:text-dark-muted-text">Enable desktop notifications.</p>
                </div>
            </div>
             <button
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-light-surface dark:focus:ring-offset-dark-surface ${settings.notifications ? 'bg-primary' : 'bg-gray-400/50'}`}
                onClick={() => handleToggle('notifications')}
            >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.notifications ? 'translate-x-5' : 'translate-x-0'}`}/>
            </button>
        </div>
        
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Save className="w-6 h-6 text-primary" />
                <div>
                    <label className="font-semibold">Auto Save</label>
                    <p className="text-sm text-muted-text dark:text-dark-muted-text">Automatically save your notes as you type.</p>
                </div>
            </div>
             <button
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-light-surface dark:focus:ring-offset-dark-surface ${settings.autoSave ? 'bg-primary' : 'bg-gray-400/50'}`}
                onClick={() => handleToggle('autoSave')}
            >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.autoSave ? 'translate-x-5' : 'translate-x-0'}`}/>
            </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsComponent;