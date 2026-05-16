
import React from 'react';
import { Users, PlusCircle, UserPlus, Clock } from 'lucide-react';
import type { StudyGroup } from '../types';

interface StudyGroupsProps {
  studyGroups: StudyGroup[];
  setStudyGroups: React.Dispatch<React.SetStateAction<StudyGroup[]>>;
}

const StudyGroups: React.FC<StudyGroupsProps> = ({ studyGroups, setStudyGroups }) => {
  const joinStudyGroup = () => {
    const newGroup: StudyGroup = {
      id: Date.now(),
      name: 'New Study Group',
      members: 1,
      subject: 'General',
      nextSession: 'TBD',
      description: 'Collaborative learning and discussion'
    };
    setStudyGroups(prev => [newGroup, ...prev]);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Study Groups</h1>
          <p className="text-lg text-muted-text dark:text-dark-muted-text">Collaborate and learn with your peers.</p>
        </div>
        <button
          onClick={joinStudyGroup}
          className="flex items-center space-x-2 px-5 py-3 bg-primary text-dark-text font-bold rounded-xl hover:bg-opacity-80 transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Join New Group</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {studyGroups.map(group => (
          <div key={group.id} className="group glass-card rounded-2xl p-6 hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
            <h3 className="text-xl font-semibold mb-2">{group.name}</h3>
            <span className="px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary/10 dark:bg-primary/20 rounded-full">{group.subject}</span>
            <p className="text-muted-text dark:text-dark-muted-text my-4">{group.description}</p>
            <div className="flex items-center justify-between text-sm text-muted-text dark:text-dark-muted-text border-t border-white/20 dark:border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{group.members} Members</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Next: {group.nextSession}</span>
              </div>
              <button className="flex items-center gap-2 text-primary font-semibold hover:underline">
                <UserPlus className="w-4 h-4"/>
                Join
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudyGroups;