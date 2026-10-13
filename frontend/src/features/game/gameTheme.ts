import { useThemeStore } from '../../store/themeStore';
import { CTA_BG, CTA_BG_HOVER, CTA_TEXT } from '../../components/ui/PillButton';

export const GAME_DARK = {
  bg:               '#0D1117',
  idleBg:           '#0D1117',
  surface:          '#161B22',
  surfaceHover:     '#1C2128',
  ink:              '#F1F1F1',
  inkMuted:         '#7A8FA8',
  accent:           '#14B8A6',
  accentBg:         'rgba(20,184,166,0.10)',
  accentLeft:       '#0D9488',
  correct:          '#2D9B5F',
  correctBg:        'rgba(45,155,95,0.14)',
  incorrect:        '#C0152A',
  incorrectBg:      'rgba(192,21,42,0.14)',
  rule:             '#21262D',
  hudCard:          'rgba(255,255,255,0.06)',
  hudBorder:        'rgba(255,255,255,0.08)',
  timerTrail:       '#21262D',
  segmentEmpty:     'rgba(255,255,255,0.08)',
  segmentActive:    'rgba(20,184,166,0.40)',
  topicRule:        'rgba(20,184,166,0.45)',
  explanationBg:    '#161B22',
  spotlight:        'rgba(20,184,166,0.07)',
  btn:              CTA_BG,
  btnHover:         CTA_BG_HOVER,
  btnText:          CTA_TEXT,
  gold:             CTA_BG,
  explanationText:  '#A8C0D8',
  revealDimOpacity: 0.22,
  // Card & option tokens
  questionCard:     '#161B22',
  questionCardBorder:'rgba(255,255,255,0.07)',
  optionBg:         '#1C2128',
  optionBorder:     'rgba(255,255,255,0.07)',
  optionHoverBg:    '#21262D',
  badgeBg:          '#21262D',
  badgeText:        '#8090A8',
  leftDefault:      CTA_BG,
  leftDefaultText:  CTA_TEXT,
  leftHover:        CTA_BG_HOVER,
} as const;

export const GAME_LIGHT = {
  bg:               '#EEF4F7',
  idleBg:           '#EEF4F7',
  surface:          '#FFFFFF',
  surfaceHover:     '#F0F9F8',
  ink:              '#17120E',
  inkMuted:         '#7A6A5A',
  accent:           '#0D9488',
  accentBg:         'rgba(13,148,136,0.10)',
  accentLeft:       '#0A7870',
  correct:          '#255C3F',
  correctBg:        'rgba(37,92,63,0.10)',
  incorrect:        '#C0152A',
  incorrectBg:      'rgba(192,21,42,0.10)',
  rule:             '#C8BAA6',
  hudCard:          '#FFFFFF',
  hudBorder:        'rgba(0,0,0,0.10)',
  timerTrail:       '#CBD5E1',
  segmentEmpty:     'rgba(0,0,0,0.10)',
  segmentActive:    'rgba(13,148,136,0.35)',
  topicRule:        'rgba(13,148,136,0.45)',
  explanationBg:    '#F0F9F8',
  spotlight:        'rgba(13,148,136,0.05)',
  btn:              CTA_BG,
  btnHover:         CTA_BG_HOVER,
  btnText:          CTA_TEXT,
  gold:             '#8A6700',
  explanationText:  '#4A3828',
  revealDimOpacity: 0.35,
  // Card & option tokens
  questionCard:     '#FFFFFF',
  questionCardBorder:'rgba(0,0,0,0.08)',
  optionBg:         '#F2F5F9',
  optionBorder:     'rgba(0,0,0,0.08)',
  optionHoverBg:    '#E8EDF4',
  badgeBg:          '#E2E8F0',
  badgeText:        '#7A8A9A',
  leftDefault:      CTA_BG,
  leftDefaultText:  CTA_TEXT,
  leftHover:        CTA_BG_HOVER,
} as const;

export type GamePalette = {
  [K in keyof typeof GAME_DARK]: (typeof GAME_DARK)[K] extends number ? number : string;
};

export function useGameTheme(): { G: GamePalette; darkMode: boolean } {
  const { darkMode } = useThemeStore();
  return { G: darkMode ? GAME_DARK : GAME_LIGHT, darkMode };
}
