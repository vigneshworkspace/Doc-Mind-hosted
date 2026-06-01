import { useState, useEffect, useRef } from 'react';
import foxHeadImg from '../assets/fox-head.png';

export const FOX_LINES = {
  dashboard:  ["Welcome back, scholar.", "Pick up where you left off.", "Today looks productive."],
  'ai-chat':  ["Ask me anything.", "I'll think it through.", "Need a thinking partner?"],
  documents:  ["Drop a PDF — I'll read it.", "Your library, organized.", "Add a doc to get started."],
  history:    ["Everything you've made.", "Time travel, kindly.", "Past you was busy."],
  'quiz-generator': ["Quiz time. You've got this.", "Pick a doc, I'll make questions.", "Practice makes confident."],
  'pdf-qa':   ["Ask the document directly.", "I'll cite my sources.", "Try: \"summarize chapter 2\"."],
  'visual-ai':["Snap a photo of your problem.", "I can read handwriting too.", "Show me what's stuck."],
  'concept-visualizer': ["Diagrams are clarity.", "Let's see this idea.", "Pick a concept."],
  'ai-diagram-maker':   ["Sketch it out.", "Nodes and arrows. Beautiful.", "I'll handle the layout."],
  flashcards: ["Spaced repetition wins.", "Flip when ready.", "Twelve minutes a day."],
  'mind-map': ["Branch by branch.", "Ideas, mapped.", "Click a node to expand."],
  'audio-recap': ["Listen on a walk.", "Two voices, your topic.", "Press play."],
  'quick-revise': ["The TL;DR of your notes.", "Simple first. Detail later.", "Tap a point to expand."],
  'voice-chat': ["Talk to me out loud.", "Listening...", "Hold space to speak."],
  pomodoro: ["Twenty-five and five.", "Deep work mode.", "I'll guard the door."],
  'study-notes': ["Write it down to remember.", "Markdown welcome.", "What's on your mind?"],
  'study-groups': ["Better together.", "Find your people.", "Schedule a session."],
  youtube: ["Lectures, summarized.", "Drop a link.", "Skip to the good parts."],
  settings: ["Make it yours.", "Tweak away.", "Defaults are merely opinions."],
};

const FOX_MOODS = {
  idle: { eyeL: "open", eyeR: "open", mouth: "smile", tail: 0 },
  blink: { eyeL: "shut", eyeR: "shut", mouth: "smile", tail: 0 },
  wink: { eyeL: "open", eyeR: "shut", mouth: "smirk", tail: 6 },
  curious: { eyeL: "open", eyeR: "open", mouth: "o", tail: -4 },
  proud: { eyeL: "open", eyeR: "open", mouth: "grin", tail: 8 },
  sleepy: { eyeL: "shut", eyeR: "shut", mouth: "small", tail: 0 },
};

function FoxCompanion({ tab, accent, hidden, foxIndex }) {
  const [mood, setMood] = useState("idle");
  const [bubble, setBubble] = useState(null);
  const lastTab = useRef(tab);
  const idleRef = useRef(null);

  // mood reactions on tab change
  useEffect(() => {
    if (lastTab.current !== tab) {
      lastTab.current = tab;
      setMood("curious");
      const lines = FOX_LINES[tab] || ["Hello again."];
      const line = lines[Math.floor(Math.random() * lines.length)];
      setBubble(line);
      const t1 = setTimeout(() => setMood("idle"), 1200);
      const t2 = setTimeout(() => setBubble(null), 4200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [tab]);

  // periodic blink
  useEffect(() => {
    let cancelled = false;
    function loop() {
      const delay = 2200 + Math.random() * 3500;
      idleRef.current = setTimeout(() => {
        if (cancelled) return;
        const r = Math.random();
        if (r < 0.15) {
          setMood("wink"); setTimeout(() => setMood("idle"), 320);
        } else {
          setMood("blink"); setTimeout(() => setMood("idle"), 130);
        }
        loop();
      }, delay);
    }
    loop();
    return () => { cancelled = true; clearTimeout(idleRef.current); };
  }, []);

  function onClick() {
    setMood("proud");
    const lines = FOX_LINES[tab] || ["Hi!"];
    setBubble(lines[(foxIndex || 0) % lines.length]);
    setTimeout(() => setMood("idle"), 1100);
    setTimeout(() => setBubble(null), 3500);
  }

  if (hidden) return null;

  const m = FOX_MOODS[mood] || FOX_MOODS.idle;
  const moodTilt = mood === "curious" ? -6 : mood === "proud" ? 4 : mood === "wink" ? -2 : 0;
  const moodScale = mood === "proud" ? 1.08 : mood === "curious" ? 1.04 : 1;

  return (
    <div className="fox-dock" aria-hidden="true">
      {bubble && <div className="fox-bubble">{bubble}</div>}
      <button
        className="fox-body"
        onClick={onClick}
        tabIndex={-1}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "default",
          transform: `rotate(${moodTilt}deg) scale(${moodScale})`,
          transition: "transform 0.35s var(--ease)"
        }}
      >
        <img
          src={foxHeadImg}
          alt="fox"
          style={{
            width: 64,
            height: 64,
            display: "block",
            objectFit: "contain",
            filter: mood === "blink" || mood === "sleepy" ? "saturate(.9) brightness(.96)" : "none",
            transition: "filter 0.2s var(--ease)"
          }}
        />
      </button>
    </div>
  );
}

export default FoxCompanion;
