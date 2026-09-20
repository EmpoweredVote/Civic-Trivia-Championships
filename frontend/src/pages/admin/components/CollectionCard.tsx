import { Link } from 'react-router-dom';
import { ProgressBar } from './ProgressBar';
import { useTheme } from '../../../hooks/useTheme';

const ADMIN_ACCENT = '#FF5740';

interface CollectionHealth {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  featured: boolean;
  themeColor: string;
  stats: {
    activeCount: number;
    archivedCount: number;
    totalCount: number;
    difficulty: { easy: number; medium: number; hard: number };
    quality: { avgScore: number | null; minScore: number | null; unscoredCount: number };
    telemetry: { totalEncounters: number; totalCorrect: number; overallCorrectRate: number | null };
  };
}

interface CollectionCardProps {
  collection: CollectionHealth;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Promote/demote on the editorial shelf. Awaits the server so a failure can be surfaced. */
  onToggleFeatured: (next: boolean) => Promise<void>;
  /** A request is in flight for this card — the control is disabled meanwhile. */
  featuredPending?: boolean;
}

export function CollectionCard({
  collection, expanded, onToggleExpand, onToggleFeatured, featuredPending = false,
}: CollectionCardProps) {
  const { C } = useTheme();
  const { name, slug, isActive, featured, themeColor, stats } = collection;
  const { activeCount, archivedCount, difficulty, quality, telemetry } = stats;

  const getHealthStatus = () => {
    if (quality.avgScore === null) return 'gray';
    if (activeCount < 50 || quality.avgScore < 50) return 'red';
    if (activeCount < 80 || quality.avgScore < 70) return 'yellow';
    return 'green';
  };

  const healthStatus = getHealthStatus();
  const healthColors: Record<string, string> = {
    red:    C.incorrect,
    yellow: '#B8860B',
    green:  C.correct,
    gray:   C.mutedFg,
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${Math.round(value * 100)}%`;
  };

  return (
    <div style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', overflow: 'hidden' }}>
      {/* Card header — clickable */}
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={onToggleExpand}>
        {/* Left color bar */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: themeColor }} />

        <div style={{ paddingLeft: '20px', paddingRight: '16px', paddingTop: '16px', paddingBottom: '16px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '18px',
                letterSpacing: '0.08em',
                color: C.ink,
                margin: '0 0 6px 0',
              }}>
                {name}
              </h3>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '10px',
                letterSpacing: '0.1em',
                padding: '2px 8px',
                borderRadius: '2px',
                backgroundColor: isActive ? 'rgba(37,92,63,0.12)' : C.ruleLight,
                color: isActive ? C.correct : C.muted,
              }}>
                {isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
              {featured && (
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  padding: '2px 8px',
                  borderRadius: '2px',
                  marginLeft: '6px',
                  backgroundColor: 'rgba(255,87,64,0.12)',
                  color: ADMIN_ACCENT,
                }}>
                  FEATURED
                </span>
              )}
            </div>
            {/* Health indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.1em', color: C.mutedFg }}>HEALTH</span>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: healthColors[healthStatus] }} />
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {[
              { label: 'ACTIVE QUESTIONS', value: String(activeCount) },
              { label: 'AVG QUALITY', value: quality.avgScore !== null ? String(Math.round(quality.avgScore)) : 'N/A' },
              { label: 'CORRECT RATE', value: formatPercentage(telemetry.overallCorrectRate) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.1em', color: C.mutedFg, marginBottom: '2px' }}>{label}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', color: C.ink, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* View Questions link + shelf control */}
      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${C.ruleLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      }}>
        <Link
          to={`/admin/questions?collection=${slug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '12px',
            letterSpacing: '0.1em',
            color: ADMIN_ACCENT,
            textDecoration: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          VIEW QUESTIONS
          <svg width="14" height="14" style={{ marginLeft: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <button
          type="button"
          disabled={featuredPending}
          onClick={(e) => { e.stopPropagation(); void onToggleFeatured(!featured); }}
          title={featured
            ? 'Remove this collection from the Featured shelf'
            : 'Promote this collection onto the Featured shelf'}
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '12px',
            letterSpacing: '0.1em',
            padding: '4px 10px',
            borderRadius: '2px',
            border: `1px solid ${featured ? ADMIN_ACCENT : C.rule}`,
            backgroundColor: featured ? 'rgba(255,87,64,0.12)' : 'transparent',
            color: featured ? ADMIN_ACCENT : C.muted,
            cursor: featuredPending ? 'wait' : 'pointer',
            opacity: featuredPending ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {featuredPending ? 'SAVING…' : featured ? 'UNFEATURE' : 'FEATURE'}
        </button>
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div style={{ padding: '16px', borderTop: `1px solid ${C.rule}`, backgroundColor: C.ruleLight, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Question Count */}
          <div>
            <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>QUESTION COUNT</h4>
            <ProgressBar value={activeCount} max={100} label="Active Questions" color={activeCount >= 80 ? 'green' : activeCount >= 50 ? 'yellow' : 'red'} />
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg, margin: '4px 0 0' }}>{archivedCount} archived questions</p>
          </div>

          {/* Difficulty Distribution */}
          <div>
            <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>DIFFICULTY DISTRIBUTION</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ProgressBar value={difficulty.easy} max={activeCount || 1} label="Easy" color="green" />
              <ProgressBar value={difficulty.medium} max={activeCount || 1} label="Medium" color="yellow" />
              <ProgressBar value={difficulty.hard} max={activeCount || 1} label="Hard" color="red" />
            </div>
          </div>

          {/* Quality Scores */}
          <div>
            <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>QUALITY SCORES</h4>
            <ProgressBar
              value={quality.avgScore || 0}
              max={100}
              label="Avg Quality Score"
              color={quality.avgScore === null ? 'gray' : quality.avgScore >= 70 ? 'green' : quality.avgScore >= 50 ? 'yellow' : 'red'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg, marginTop: '8px' }}>
              <span>Min score: {quality.minScore !== null ? Math.round(quality.minScore) : 'N/A'}</span>
              <span>{quality.unscoredCount} unscored</span>
            </div>
          </div>

          {/* Telemetry */}
          <div>
            <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>TELEMETRY</h4>
            {telemetry.overallCorrectRate !== null ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'ENCOUNTERS', value: telemetry.totalEncounters.toLocaleString() },
                  { label: 'CORRECT', value: telemetry.totalCorrect.toLocaleString() },
                  { label: 'CORRECT RATE', value: formatPercentage(telemetry.overallCorrectRate) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.1em', color: C.mutedFg, marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', color: C.ink }}>{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: '13px', color: C.mutedFg, margin: 0 }}>No data yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
