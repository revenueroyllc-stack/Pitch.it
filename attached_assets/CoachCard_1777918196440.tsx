import { motion } from 'framer-motion';
import type { CoachCard as CoachCardType } from '@/lib/coach';

interface CoachCardProps {
  card: CoachCardType;
  index: number;
}

const TONE_STYLES = {
  tip: {
    accentClass: 'ccard-accent-tip',
    badgeBg: 'bg-[rgba(0,200,150,0.12)]',
    badgeText: 'text-[#00c896]',
    label: 'Tip',
  },
  response: {
    accentClass: 'ccard-accent-response',
    badgeBg: 'bg-[rgba(201,150,12,0.12)]',
    badgeText: 'text-[#c9960c]',
    label: 'Response',
  },
  question: {
    accentClass: 'ccard-accent-question',
    badgeBg: 'bg-[rgba(201,150,12,0.10)]',
    badgeText: 'text-primary',
    label: 'Question',
  },
  warning: {
    accentClass: 'ccard-accent-warning',
    badgeBg: 'bg-[rgba(245,217,126,0.12)]',
    badgeText: 'text-[#f5d97e]',
    label: 'Warning',
  },
  battlecard: {
    accentClass: 'ccard-accent-battlecard',
    badgeBg: 'bg-[rgba(201,150,12,0.15)]',
    badgeText: 'text-primary',
    label: 'Battlecard',
  },
};

export function CoachCard({ card, index }: CoachCardProps) {
  const style = TONE_STYLES[card.tone] ?? TONE_STYLES.tip;
  const isBattlecard = card.tone === 'battlecard';

  return (
    <motion.article
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`relative rounded-xl border overflow-hidden ${
        isBattlecard
          ? 'border-primary/40 bg-[rgba(201,150,12,0.06)]'
          : 'border-border bg-card'
      }`}
      data-testid={`coach-card-${index}`}
      style={isBattlecard ? { boxShadow: '0 0 12px rgba(201,150,12,0.12)' } : undefined}
    >
      <div
        className={`absolute inset-y-0 left-0 w-[3px] ${style.accentClass}`}
      />
      <div className="p-3 pl-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[0.62rem] font-mono font-semibold uppercase tracking-widest border border-primary/20 ${style.badgeBg} ${style.badgeText}`}
          >
            {style.label}
          </span>
          {isBattlecard && card.competitor && (
            <span className="px-2 py-0.5 rounded-full text-[0.62rem] font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground">
              {card.competitor}
            </span>
          )}
          <span className="flex-1 text-[0.72rem] text-muted-foreground italic truncate">
            {card.trigger}
          </span>
          <span className="text-[0.65rem] font-mono text-muted-foreground shrink-0">
            {card.timestamp}
          </span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{card.text}</p>
        {card.quote && (
          <div className="mt-2.5 px-3 py-2 rounded-lg bg-[rgba(201,150,12,0.08)] border border-[rgba(201,150,12,0.18)]">
            <p className="text-sm italic text-[#f5d97e] leading-relaxed">
              &ldquo;{card.quote}&rdquo;
            </p>
          </div>
        )}
      </div>
    </motion.article>
  );
}
