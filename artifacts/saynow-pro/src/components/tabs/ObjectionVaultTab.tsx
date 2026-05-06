import { useState } from 'react';
import type { Objection } from '@/lib/coach';
import { COMPETITOR_BATTLECARDS } from '@/lib/coach';

interface ObjectionVaultTabProps {
  objections: Objection[];
  setObjections: (v: Objection[]) => void;
}

const CATEGORIES = ['All', 'Pricing', 'Competition', 'Timing', 'Authority', 'Status Quo', 'Custom'];

export function ObjectionVaultTab({ objections, setObjections }: ObjectionVaultTabProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [copied, setCopied] = useState<string | null>(null);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const filtered = objections.filter((obj) => {
    const matchesSearch =
      !search ||
      obj.question.toLowerCase().includes(search.toLowerCase()) ||
      obj.answer.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || obj.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="relative z-10 flex flex-col gap-4 p-5 pb-10 overflow-auto flex-1" data-testid="vault-tab">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search objections..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          data-testid="input-vault-search"
        />
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
              }`}
              data-testid={`filter-${cat.toLowerCase()}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((obj, i) => (
            <article
              key={`${obj.question}-${i}`}
              className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3"
              style={{ backdropFilter: 'blur(8px)' }}
              data-testid={`vault-card-${i}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-bold uppercase tracking-widest border border-[rgba(245,217,126,0.25)] bg-[rgba(245,217,126,0.08)] text-[#f5d97e]">
                  {obj.category}
                </span>
                <button
                  onClick={() => setObjections(objections.filter((_, j) => j !== objections.indexOf(obj)))}
                  className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
                  data-testid={`button-delete-vault-${i}`}
                >
                  ×
                </button>
              </div>
              <p className="text-sm font-bold text-primary leading-snug">{obj.question}</p>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{obj.answer}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(obj.answer, `vault-${i}`)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    copied === `vault-${i}`
                      ? 'bg-[rgba(0,200,150,0.12)] border border-[rgba(0,200,150,0.3)] text-[#00c896]'
                      : 'border border-primary/30 bg-[rgba(201,150,12,0.08)] text-primary hover:bg-[rgba(201,150,12,0.15)]'
                  }`}
                  data-testid={`button-copy-response-${i}`}
                >
                  {copied === `vault-${i}` ? 'Copied!' : 'Copy Response'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <p className="font-semibold text-foreground/60">No objections match your filter</p>
          <p className="text-xs text-center">Add objections in the Prep tab or clear the search filter.</p>
        </div>
      )}

      <div className="mt-2">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary">Competitor Battlecards</p>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Object.entries(COMPETITOR_BATTLECARDS).map(([name, data]) => (
            <article
              key={name}
              className="rounded-2xl border border-primary/20 bg-[rgba(201,150,12,0.04)] p-4 flex flex-col gap-3"
              style={{ backdropFilter: 'blur(8px)' }}
              data-testid={`battlecard-${name}`}
            >
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground">
                  Battlecard
                </span>
                <span className="font-bold text-sm capitalize">{name}</span>
              </div>
              <div>
                <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground mb-1">Their weakness</p>
                <p className="text-xs text-muted-foreground">{data.weaknesses[0]}</p>
              </div>
              <div>
                <p className="text-[0.65rem] font-mono uppercase tracking-widest text-primary mb-1">Your response</p>
                <p className="text-xs text-foreground/90 leading-relaxed">{data.ourResponse}</p>
              </div>
              <button
                onClick={() => copyToClipboard(data.ourResponse, `bc-${name}`)}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                  copied === `bc-${name}`
                    ? 'bg-[rgba(0,200,150,0.12)] border border-[rgba(0,200,150,0.3)] text-[#00c896]'
                    : 'border border-primary/30 bg-[rgba(201,150,12,0.08)] text-primary hover:bg-[rgba(201,150,12,0.15)]'
                }`}
                data-testid={`button-copy-battlecard-${name}`}
              >
                {copied === `bc-${name}` ? 'Copied!' : 'Copy Response'}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
