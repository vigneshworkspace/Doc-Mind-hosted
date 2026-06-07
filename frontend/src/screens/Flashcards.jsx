import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Shell';
import { flashcards as flashcardsApi } from '../api/index.js';
import { api } from '../api/client.js';
import { ErrorRetry } from '../components/GenState.jsx';

// Order card indices by next-due: cards never reviewed (no nextReview) are "new"
// and sort first (due now); the rest sort by their stored nextReview ascending so
// the soonest/most-overdue card surfaces first. `normalize` maps the backend's
// next_review -> nextReview, so we read the camelCase field here.
function dueOrder(cards) {
  return cards
    .map((c, i) => ({ i, next: c?.nextReview ?? null }))
    .sort((a, b) => {
      if (a.next === b.next) return a.i - b.i;
      if (a.next == null) return -1;   // new cards first
      if (b.next == null) return 1;
      return a.next < b.next ? -1 : 1; // ISO dates compare lexicographically
    })
    .map((x) => x.i);
}

function FlipFace({ face, content, hint }) {
  return (
    <div className="card" style={{position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: face === "back" ? "rotateY(180deg)" : "none", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 36, textAlign: "center", background: face === "back" ? "var(--ink)" : "var(--card)", color: face === "back" ? "var(--paper)" : "var(--ink)", border: "1px solid var(--hairline)"}}>
      <div className="t-eyebrow" style={{position: "absolute", top: 18, left: 24, color: face === "back" ? "var(--ink-4)" : "var(--ink-3)"}}>{face === "front" ? "Question" : "Answer"}</div>
      <div className="t-display" style={{fontSize: 32, lineHeight: 1.2, maxWidth: 500}}>{content}</div>
      <div className="muted" style={{position: "absolute", bottom: 18, fontSize: 11, color: face === "back" ? "var(--ink-4)" : "var(--ink-3)"}}>{hint}</div>
    </div>
  );
}

// Lightweight spaced-repetition: a session queue. "Again"/"Hard" reinsert the
// card to resurface soon; "Good"/"Easy" master it (removed from the queue).
// Session ends when every card is mastered.
function insertAt(arr, val, pos) {
  const i = Math.min(pos, arr.length);
  return [...arr.slice(0, i), val, ...arr.slice(i)];
}

function ScreenFlashcards({ state, dispatch }) {
  const [active, setActive] = useState(null); // a flashcard set being studied
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(state.documents[0]?.id ?? null);
  const [genError, setGenError] = useState("");
  // SRS session state
  const [queue, setQueue] = useState([]);          // card indices in review order
  const [mastered, setMastered] = useState(() => new Set());
  const [ratings, setRatings] = useState({});       // cardIdx -> last grade (for tally)
  const [reviewError, setReviewError] = useState(""); // last review-save failure
  const [savingGrade, setSavingGrade] = useState(false);
  // Honesty contract: on a failed list() we show an error + Retry, never fabricated sets.
  const [listError, setListError] = useState("");

  // Mount: load the real flashcard sets. On failure we surface ErrorRetry and leave
  // the collection empty — never substitute seeded sample sets.
  const reloadList = useCallback(() => {
    setListError("");
    flashcardsApi.list()
      .then(sets => dispatch({ type: 'set-flashcard-sets', flashcardSets: sets }))
      .catch(e => setListError(e.message || "Couldn't load your flashcard sets — please retry."));
  }, [dispatch]);

  useEffect(() => { reloadList(); }, [reloadList]);

  async function handleGenerate() {
    const docId = selectedDocId ?? state.documents[0]?.id;
    if (docId == null) { setGenError("Upload a document first, then pick it as the source."); return; }
    setGenError("");
    setGenerating(true);
    try {
      // Real cards from the selected document — no fabricated placeholder on failure.
      const newSet = await flashcardsApi.generate(docId);
      dispatch({ type: 'add-flashcard-set', set: newSet });
    } catch (e) {
      setGenError(e.message || "Couldn't generate cards — the AI service may be busy. Please retry.");
    } finally {
      setGenerating(false);
    }
  }

  function startSet(set) {
    setActive(set);
    setFlipped(false);
    // Real scheduling: study the most-overdue / newest-due cards first.
    setQueue(dueOrder(set.cards));
    setMastered(new Set());
    setRatings({});
    setReviewError("");
  }

  // Persist the rating to the backend (real next-review scheduling), then advance
  // the in-session queue. On failure we surface ErrorRetry and keep the card so the
  // user can retry — nothing fake, no silent success.
  async function grade(g) {
    const cur = queue[0];
    if (cur === undefined || savingGrade) return;
    setReviewError("");
    setSavingGrade(true);
    try {
      const res = await api.post(`/flashcards/${active.id}/review`, { card_index: cur, grade: g });
      // Fold the persisted schedule back into the local set so re-ordering and a
      // subsequent "Study again" reflect the real next_review.
      const interval = res?.interval;
      const nextReview = res?.next_review ?? res?.nextReview;
      setActive(a => {
        if (!a) return a;
        const cards = a.cards.map((c, i) =>
          i === cur ? { ...c, interval, nextReview } : c
        );
        return { ...a, cards };
      });
    } catch (e) {
      setReviewError(e.message || "Couldn't save your rating — please retry.");
      setSavingGrade(false);
      return; // keep the card on the queue so Retry re-grades it
    }
    setSavingGrade(false);
    setFlipped(false);
    setRatings(r => ({ ...r, [cur]: g }));
    setQueue(q => {
      const [, ...rest] = q;
      if (g === 'good' || g === 'easy') {
        setMastered(m => { const n = new Set(m); n.add(cur); return n; });
        return rest;                       // mastered → leave the session queue
      }
      // again → resurface very soon; hard → a few cards later
      return insertAt(rest, cur, g === 'again' ? 1 : 3);
    });
  }

  if (!active) return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1><em className="t-italic">Flashcards</em>, by you and for you.</h1>
        <p>Pick a set to study, or generate one from a document. Press space to flip; arrow keys to move on.</p>
      </div>
      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label className="field-label" style={{ margin: 0 }}>Source document</label>
        <select
          className="input"
          style={{ width: "auto", minWidth: 220 }}
          value={selectedDocId ?? ""}
          onChange={e => { setGenError(""); setSelectedDocId(e.target.value ? Number(e.target.value) : null); }}
          disabled={!state.documents.length}
        >
          {state.documents.length
            ? state.documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
            : <option value="">No documents — upload one first</option>}
        </select>
        {genError && <span style={{ color: "var(--err, #dc2626)", fontSize: 13 }}>{genError}</span>}
      </div>
      {listError && <ErrorRetry message={listError} onRetry={reloadList} />}
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
          disabled={generating || !(selectedDocId ?? state.documents[0]?.id)}
          onClick={handleGenerate}>
          <Icon name="plus" size={20} className="" />
          <div style={{fontFamily: "var(--f-display)", fontSize: 18}}>{generating ? 'Generating…' : 'Generate a set'}</div>
          <div className="muted" style={{fontSize: 12}}>From the selected document</div>
        </button>
      </div>
    </div>
  );

  const total = active.cards.length;
  const masteredCount = mastered.size;

  // Session finished — all cards mastered.
  if (queue.length === 0) {
    const grades = Object.values(ratings);
    const tally = {
      again: grades.filter(g => g === 'again').length,
      hard: grades.filter(g => g === 'hard').length,
      good: grades.filter(g => g === 'good').length,
      easy: grades.filter(g => g === 'easy').length,
    };
    return (
      <div className="col" style={{gap: 18, maxWidth: 540, margin: "0 auto", width: "100%", textAlign: "center"}}>
        <div className="card" style={{padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 16}}>
          <div style={{width: 56, height: 56, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center"}}>
            <Icon name="check" size={26} className="" />
          </div>
          <div className="t-display" style={{fontSize: 30}}>Set complete.</div>
          <p className="muted" style={{fontSize: 14}}>You mastered all {total} cards in “{active.title}”.</p>
          <div className="row" style={{gap: 8, flexWrap: "wrap", justifyContent: "center"}}>
            <span className="chip">Again {tally.again}</span>
            <span className="chip">Hard {tally.hard}</span>
            <span className="chip">Good {tally.good}</span>
            <span className="chip is-accent">Easy {tally.easy}</span>
          </div>
          <div className="row" style={{gap: 8, marginTop: 6}}>
            <button className="btn is-ghost" onClick={() => setActive(null)}>← All sets</button>
            <button className="btn is-accent" onClick={() => startSet(active)}>Study again</button>
          </div>
        </div>
      </div>
    );
  }

  const card = active.cards[queue[0]];
  const progress = total ? masteredCount / total : 0;
  return (
    <div className="col" style={{gap: 18, maxWidth: 640, margin: "0 auto", width: "100%"}}>
      <div className="row" style={{justifyContent: "space-between"}}>
        <button className="btn is-quiet is-sm" onClick={() => setActive(null)}>← All sets</button>
        <div className="t-eyebrow">{masteredCount} / {total} mastered · {queue.length} in queue</div>
        <div style={{width: 80}}></div>
      </div>
      <div style={{height: 3, borderRadius: 3, background: "var(--paper-2)", overflow: "hidden"}}>
        <div style={{height: "100%", width: `${progress * 100}%`, background: "var(--accent)", transition: "width 0.3s var(--ease)"}}></div>
      </div>
      <div onClick={() => setFlipped(f => !f)} style={{aspectRatio: "5/3", perspective: 1400, cursor: "default"}}>
        <div style={{position: "relative", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.55s var(--ease)", transform: flipped ? "rotateY(180deg)" : "none"}}>
          <FlipFace face="front" content={card.question} hint="Tap to flip" />
          <FlipFace face="back" content={card.answer} hint="Tap to flip back" />
        </div>
      </div>
      {!flipped ? (
        <button className="btn is-ghost" onClick={() => setFlipped(true)}>Show answer</button>
      ) : (
        <div className="row" style={{justifyContent: "center", gap: 6}}>
          <button className="btn is-ghost is-sm" disabled={savingGrade} onClick={() => grade('again')}>Again</button>
          <button className="btn is-ghost is-sm" disabled={savingGrade} onClick={() => grade('hard')}>Hard</button>
          <button className="btn is-ghost is-sm" disabled={savingGrade} onClick={() => grade('good')}>Good</button>
          <button className="btn is-accent is-sm" disabled={savingGrade} onClick={() => grade('easy')}>Easy</button>
        </div>
      )}
      {reviewError && flipped && (
        // The rating buttons above stay live, so they ARE the retry path — re-tap
        // the grade you meant. No onRetry: a canned grade would misrecord the card.
        <ErrorRetry message={reviewError} />
      )}
    </div>
  );
}

export { FlipFace };
export default ScreenFlashcards;
