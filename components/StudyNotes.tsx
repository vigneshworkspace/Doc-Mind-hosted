
import React from 'react';
import { StickyNote, Plus, Trash2 } from 'lucide-react';
import type { Note } from '../types';

interface StudyNotesProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}

const StudyNotes: React.FC<StudyNotesProps> = ({ notes, setNotes }) => {
  const addNote = () => {
    const newNote: Note = {
      id: Date.now(),
      title: 'New Study Note',
      content: 'Start writing your notes here...',
      date: new Date().toISOString().split('T')[0],
      subject: 'General'
    };
    setNotes(prev => [newNote, ...prev]);
  };
  
  const deleteNote = (id: number) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Study Notes</h1>
          <p className="text-lg text-muted-text dark:text-dark-muted-text">Capture and organize your thoughts.</p>
        </div>
        <button
          onClick={addNote}
          className="flex items-center space-x-2 px-5 py-3 bg-primary text-dark-text font-bold rounded-xl hover:bg-opacity-80 transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Note</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notes.map(note => (
          <div key={note.id} className="group perspective-1000">
            <div className="glass-card rounded-2xl p-6 flex flex-col justify-between h-full transform-style-3d transition-all duration-500 group-hover:[transform:rotateY(-15deg)_rotateX(10deg)] group-hover:shadow-primary/20">
              <div>
                <h3 className="text-xl font-semibold mb-2">{note.title}</h3>
                <p className="text-muted-text dark:text-dark-muted-text mb-4 h-24 overflow-hidden">{note.content}</p>
              </div>
              <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-text dark:text-dark-muted-text">
                      <span className="px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary/10 dark:bg-primary/20 rounded-full">{note.subject}</span>
                      <p className="mt-2">{note.date}</p>
                  </div>
                <button onClick={() => deleteNote(note.id)} className="text-muted-text dark:text-dark-muted-text hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudyNotes;