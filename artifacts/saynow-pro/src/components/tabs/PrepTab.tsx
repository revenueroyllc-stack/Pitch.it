import { useState } from 'react';
import type { Objection } from '@/lib/coach';
import { isSupabaseConfigured } from '@/lib/supabase';

interface PrepTabProps {
  objective: string;
  setObjective: (v: string) => void;
  talkingPoints: string[];
  setTalkingPoints: (v: string[]) => void;
  objections: Objection[];
  setObjections: (v: Objection[]) => void;
  supportsSpeech: boolean;
  prospectName: string;
  setProspectName: (v: string) => void;
  prospectCompany: string;
  setProspectCompany: (v: string) => void;
  prospectRole: string;
  setProspectRole: (v: string) => void;
  prospectContext: string;
  setProspectContext: (v: string) => void;
  userId?: string;
  onCreditsExhausted?: (creditType: string) => void;
}

export function PrepTab({
  objective, setObjective,
  talkingPoints, setTalkingPoints,
  objections, setObjections,
  supportsSpeech,
  prospectName, setProspectName,
  prospectCompany, setProspectCompany,
  prospectRole, setProspectRole,
  prospectContext, setProspectContext,
  userId,
  onCreditsExhausted,
}: PrepTabProps) {
  const [tpInput, setTpInput] = useState('');
  const [objQuestion, setObjQuestion] = useState('');
  const [objAnswer, setObjAnswer] = useState('');
  const [objCategory, setObjCategory] = useState('Custom');

  const [briefLoading, setBriefLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [briefError, setBriefError] = useState('');

  async function handleGenerateBrief() {
    setBriefLoading(true);
    setBriefError('');
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'battle-brief',
          userId,
          prospectName,
          prospectCompany,
          prospectRole,
          prospectContext,
          objective,
          talkingPoints,
          objections,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        onCreditsExhausted?.(data.creditType || 'brief');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'API error');
      setAiBrief(data.brief);
    } catch (err: any) {
      setBriefError(err.message || 'Failed to generate brief');
    } finally {
      setBriefLoading(false);
    }
  }

  function addTalkingPoint() {
    const v = tpInput.trim();
    if (!v) return;
    setTalkingPoints([...talkingPoints, v]);
    setTpInput('');
  }

  function addObjection() {
    const q = objQuestion.trim();
    const a = objAnswer.trim();
    if (!q || !a) return;
    setObjections([{ question: q, answer: a, category: objCategory }, ...objections]);
    setObjQuestion('');
    setObjAnswer('');
    setObjCategory('Custom');
  }

  const categories = ['Pricing', 'Competition', 'Timing', 'Authority', 'Status Quo', 'Custom'];

  return (
    <div className="relative z-10 flex flex-col gap-4 p-5 pb-10 overflow-auto flex-1" data-testid="prep-tab">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5" style={{ backdropFilter: 'blur(8px)' }}>
          <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-3">Prospect Intel</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                placeholder="Alex Chen"
                className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                data-testid="input-prospect-name"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Company</label>
              <input
                value={prospectCompany}
                onChange={(e) => setProspectCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                data-testid="input-prospect-company"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role / Title</label>
              <input
                value={prospectRole}
                onChange={(e) => setProspectRole(e.target.value)}
                placeholder="VP of Sales"
                className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                data-testid="input-prospect-role"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Call Objective</label>
              <input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Book a product demo"
                className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                data-testid="input-objective"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Context / Notes</label>
            <textarea
              value={prospectContext}
              onChange={(e) => setProspectContext(e.target.value)}
              placeholder="E.g. They use Salesforce, have a team of 20 reps, budget review next quarter..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors resize-none"
              data-testid="input-prospect-context"
            />
          </div>
          <button
            onClick={handleGenerateBrief}
            disabled={briefLoading}
            className="mt-3 w-full py-2.5 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)' }}
            data-testid="button-generate-brief"
          >
            {briefLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Generating Brief...
              </>
            ) : aiBrief ? 'Regenerate Battle Brief' : 'Generate Battle Brief'}
          </button>
          {briefError && (
            <p className="mt-2 text-xs text-red-400">{briefError}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5" style={{ backdropFilter: 'blur(8px)' }}>
          <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-3">Workspace Status</p>
          <div className="flex flex-col gap-2.5">
            {[
              {
                label: 'Speech Recognition',
                good: supportsSpeech,
                good_text: 'Available — Chrome / Edge ready',
                bad_text: 'Use Chrome or Edge for live transcript',
              },
              {
                label: 'Supabase Cloud Save',
                good: isSupabaseConfigured,
                good_text: 'Connected — auth and storage ready',
                bad_text: 'Demo mode — data not persisted',
              },
              {
                label: 'AI Coach Engine',
                good: true,
                good_text: 'Claude AI active',
                bad_text: 'Unavailable',
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  item.good
                    ? 'border-[rgba(0,200,150,0.25)] bg-[rgba(0,200,150,0.06)]'
                    : 'border-[rgba(245,217,126,0.25)] bg-[rgba(245,217,126,0.05)]'
                }`}
                data-testid={`status-${item.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <span
                  className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${item.good ? 'bg-[#00c896]' : 'bg-[#f5d97e]'}`}
                />
                <div>
                  <p className={`text-xs font-semibold ${item.good ? 'text-[#00c896]' : 'text-[#f5d97e]'}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.good ? item.good_text : item.bad_text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {aiBrief && (
        <div className="rounded-2xl border border-primary/30 bg-[rgba(201,150,12,0.05)] p-5 fade-in-up" style={{ backdropFilter: 'blur(8px)' }}>
          <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-4">
            AI Battle Brief — {prospectName || 'Prospect'}{prospectCompany ? ` @ ${prospectCompany}` : ''}
          </p>
          <pre className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans" data-testid="ai-brief-output">
            {aiBrief}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5" style={{ backdropFilter: 'blur(8px)' }}>
          <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-3">Talking Points</p>
          <div className="flex flex-col gap-2 mb-3">
            {talkingPoints.map((point, i) => (
              <div key={`${point}-${i}`} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background border border-border" data-testid={`talking-point-${i}`}>
                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[rgba(201,150,12,0.12)] text-primary text-[0.6rem] font-mono font-bold">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-foreground/90 leading-snug">{point}</span>
                <button
                  onClick={() => setTalkingPoints(talkingPoints.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 text-sm"
                  data-testid={`button-delete-tp-${i}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={tpInput}
              onChange={(e) => setTpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTalkingPoint()}
              placeholder="Add a talking point"
              className="flex-1 px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              data-testid="input-talking-point"
            />
            <button
              onClick={addTalkingPoint}
              className="px-4 py-2 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)' }}
              data-testid="button-add-tp"
            >
              Add
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5" style={{ backdropFilter: 'blur(8px)' }}>
          <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-3">Objection Prep</p>
          <div className="flex flex-col gap-2 mb-3 max-h-48 overflow-y-auto">
            {objections.map((item, i) => (
              <div key={`${item.question}-${i}`} className="rounded-xl border border-border overflow-hidden" data-testid={`objection-item-${i}`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold text-[#f5d97e]">{item.question}</span>
                  <button
                    onClick={() => setObjections(objections.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm ml-2 shrink-0"
                    data-testid={`button-delete-obj-${i}`}
                  >
                    ×
                  </button>
                </div>
                <p className="px-3 py-2 text-xs text-muted-foreground leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <input
              value={objQuestion}
              onChange={(e) => setObjQuestion(e.target.value)}
              placeholder="Common objection"
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              data-testid="input-objection-question"
            />
            <textarea
              value={objAnswer}
              onChange={(e) => setObjAnswer(e.target.value)}
              placeholder="Suggested response"
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors resize-none"
              data-testid="input-objection-answer"
            />
            <div className="flex gap-2">
              <select
                value={objCategory}
                onChange={(e) => setObjCategory(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground outline-none focus:border-primary transition-colors"
                data-testid="select-objection-category"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={addObjection}
                className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:-translate-y-px border border-[rgba(245,217,126,0.3)] bg-[rgba(245,217,126,0.08)] text-[#f5d97e] hover:bg-[rgba(245,217,126,0.15)]"
                data-testid="button-add-objection"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
