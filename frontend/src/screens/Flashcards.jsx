import { useState, useEffect } from 'react';
import { Icon } from '../components/Shell';
import { flashcards as flashcardsApi } from '../api/index.js';

function FlipFace({ face, content, hint }) {
  return (
    <div className="card" style={{position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: face === "back" ? "rotateY(180deg)" : "none", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 36, textAlign: "center", background: face === "back" ? "var(--ink)" : "var(--card)", color: face === "back" ? "var(--paper)" : "var(--ink)", border: "1px solid var(--hairline)"}}>
      <div className="t-eyebrow" style={{position: "absolute", top: 18, left: 24, color: face === "back" ? "var(--ink-4)" : "var(--ink-3)"}}>{face === "front" ? "Question" : "Answer"}</div>
      <div className="t-display" style={{fontSize: 32, lineHeight: 1.2, maxWidth: 500}}>{content}</div>
      <div className="muted" style={{position: "absolute", bottom: 18, fontSize: 11, color: face === "back" ? "var(--ink-4)" : "var(--ink-3)"}}>{hint}</div>
    </div>
  );
}

function ScreenFlashcards({ state, dispatch }) {
  const [active, setActive] = useState(null); // a flashcard set being studied
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);
  const [generating, setGenerating] = useState(false);

  // Mount: load flashcard sets (fallback: keep mock sets)
  useEffect(() => {
    flashcardsApi.list()
      .then(sets => dispatch({ type: 'set-flashcard-sets', flashcardSets: sets }))
      .catch(() => { /* keep mock sets */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    const docId = state.documents[0]?.id ?? null;
    setGenerating(true);
    try {
      const newSet = await flashcardsApi.generate(docId);
      dispatch({ type: 'add-flashcard-set', set: newSet });
    } catch {
      // Fallback: create a local placeholder set so the UX still responds
      const local = { id: Date.now(), title: "New set", date: new Date().toISOString().slice(0, 10), cards: [
        { id: 1, question: "What is the chain rule?", answer: "A formula to compute the derivative of a composite function — multiply the derivatives of each link." },
        { id: 2, question: "Define mitochondria.", answer: "The cell's power plants — they convert food into ATP." },
        { id: 3, question: "Newton's first law?", answer: "An object in motion stays in motion unless acted on by an external force." },
      ] };
      dispatch({ type: 'add-flashcard-set', set: local });
    } finally {
      setGenerating(false);
    }
  }

  function startSet(set) { setActive(set); setIdx(0); setFlipped(false); }

  if (!active) return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1><em className="t-italic">Flashcards</em>, by you and for you.</h1>
        <p>Pick a set to study, or generate one from any document. Press space to flip; arrow keys to move on.</p>
      </div>
      <div className="grid grid-3">
        {state.flashcardSets.map(set => (
          <div key={set.id} className="card lift" style={{cursor: "default"}} onClick={() => startSet(set)}>
            <div style={{aspectRatio: "16/9", borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", position: "relative", marginBottom: 14, overflow: "hidden"}}>
              <div style={{position: "absolute", inset: "auto 18px 18px 18px", height: "70%", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 8, boxShadow: "0 -8px 0 -2px var(--paper), 0 -8px 0 -3px var(--hairline), 0 -16px 0 -4px var(--paper), 0 -16px 0 -5px var(--hairline)"}}></div>
              <div style={{position: "relative", fontFamily: "var(--f-display)", fontSize: 24, color: "var(--ink-3)"}}>{set.cards.length}</div>
            </div>
            <div style={{fontWeight: 500}}>{set.title}</div>
            <div className="muted" style={{fontSize: 12, marginTop: 3}}>{set.cards.length} cards · {set.date}</div>
          </div>
        ))}
        <button className="card lift" style={{borderStyle: "dashed", color: "var(--ink-3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 220, cursor: "default"}}
          disabled={generating}
          onClick={handleGenerate}>
          <Icon name="plus" size={20} className="" />
          <div style={{fontFamily: "var(--f-display)", fontSize: 18}}>{generating ? 'Generating…' : 'Generate a set'}</div>
          <div className="muted" style={{fontSize: 12}}>From any document or topic</div>
        </button>
      </div>
    </div>
  );

  const card = active.cards[idx];
  return (
    <div className="col" style={{gap: 18, maxWidth: 640, margin: "0 auto", width: "100%"}}>
      <div className="row" style={{justifyContent: "space-between"}}>
        <button className="btn is-quiet is-sm" onClick={() => setActive(null)}>← All sets</button>
        <div className="t-eyebrow">{idx + 1} / {active.cards.length}</div>
        <div style={{width: 80}}></div>
      </div>
      <div style={{height: 3, borderRadius: 3, background: "var(--paper-2)", overflow: "hidden"}}>
        <div style={{height: "100%", width: `${((idx + 1) / active.cards.length) * 100}%`, background: "var(--accent)", transition: "width 0.3s var(--ease)"}}></div>
      </div>
      <div onClick={() => setFlipped(f => !f)} style={{aspectRatio: "5/3", perspective: 1400, cursor: "default"}}>
        <div style={{position: "relative", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.55s var(--ease)", transform: flipped ? "rotateY(180deg)" : "none"}}>
          <FlipFace face="front" content={card.question} hint="Tap to flip" />
          <FlipFace face="back" content={card.answer} hint="Tap to flip back" />
        </div>
      </div>
      <div className="row" style={{justifyContent: "space-between"}}>
        <button className="btn is-ghost" disabled={idx === 0} onClick={() => { setIdx(i => i - 1); setFlipped(false); }}><Icon name="chevL" size={14} className="" /> Prev</button>
        <div className="row" style={{gap: 6}}>
          <button className="btn is-ghost is-sm">Again</button>
          <button className="btn is-ghost is-sm">Hard</button>
          <button className="btn is-ghost is-sm">Good</button>
          <button className="btn is-accent is-sm">Easy</button>
        </div>
        <button className="btn is-ghost" disabled={idx === active.cards.length - 1} onClick={() => { setIdx(i => i + 1); setFlipped(false); }}>Next <Icon name="chevR" size={14} className="" /></button>
      </div>
    </div>
  );
}

export { FlipFace };
export default ScreenFlashcards;
