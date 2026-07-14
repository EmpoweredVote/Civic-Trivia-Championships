import { useTheme } from '../../../hooks/useTheme';
import type { LeaderboardTab } from '../types';

interface LeaderboardTabsProps {
  active: LeaderboardTab;
  onChange: (tab: LeaderboardTab) => void;
}

const TABS: { key: LeaderboardTab; label: string }[] = [
  { key: 'all_time', label: 'All Time' },
  { key: 'this_week', label: 'This Week' },
];

export function LeaderboardTabs({ active, onChange }: LeaderboardTabsProps) {
  const { darkMode } = useTheme();
  const ruleColor = darkMode ? '#21262D' : '#E2E8F0';
  const mutedColor = darkMode ? '#7C90AC' : '#94A3B8';
  const accentColor = '#14B8A6';

  return (
    <div
      style={{
        display: 'flex',
        borderBottom: `1px solid ${ruleColor}`,
        marginBottom: '24px',
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '10px 20px',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.02em',
              color: isActive ? accentColor : mutedColor,
              background: 'none',
              border: 'none',
              borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
