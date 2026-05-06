import React, { type ReactNode } from 'react';

export type TabId = 'prep' | 'live' | 'vault' | 'debrief' | 'profile' | 'team' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  badge?: number;
}

interface NavTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  tabs: Tab[];
}

const SHORT_LABELS: Record<TabId, string> = {
  prep:     'Prep',
  live:     'Live',
  vault:    'Vault',
  debrief:  'Debrief',
  profile:  'Profile',
  team:     'Team',
  settings: 'Settings',
};

function TabIcon({ id, active }: { id: TabId; active: boolean }) {
  const color = active ? '#c9960c' : 'currentColor';
  const w = 20;
  const icons: Record<TabId, ReactNode> = {
    prep: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
    live: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
      </svg>
    ),
    vault: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    debrief: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    profile: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    team: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    settings: (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  };
  return <>{icons[id]}</>;
}

export function NavTabs({ activeTab, onTabChange, tabs }: NavTabsProps) {
  return (
    <nav
      className="flex shrink-0 border-t border-border overflow-x-auto"
      style={{
        background: 'rgba(8,8,8,0.97)',
        backdropFilter: 'blur(12px)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      } as React.CSSProperties}
      aria-label="Main navigation"
      data-testid="nav-tabs"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-all min-w-0"
            style={{ flexShrink: 1 }}
            data-testid={`tab-${tab.id}`}
            aria-selected={active}
          >
            {/* Active indicator bar */}
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, #c9960c, #f5d97e)' }}
              />
            )}

            {/* Icon */}
            <span className={`transition-all duration-200 ${active ? 'scale-110' : 'opacity-50'}`}>
              <TabIcon id={tab.id} active={active} />
            </span>

            {/* Label */}
            <span
              className="font-semibold leading-none transition-all max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
              style={{
                fontSize: '0.58rem',
                letterSpacing: '0.02em',
                color: active ? '#c9960c' : 'rgba(255,255,255,0.4)',
              }}
            >
              {SHORT_LABELS[tab.id]}
            </span>

            {/* Badge */}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className="absolute top-1.5 right-[calc(50%-14px)] px-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[0.5rem] font-bold font-mono"
                style={{ background: '#c9960c', color: '#1a0a0a' }}
                data-testid={`tab-badge-${tab.id}`}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
