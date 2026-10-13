// The home page's primary CTA colours ("Start Playing"): bright gold, near-black ink.
//
// These live in their own leaf module rather than in PillButton.tsx because the
// game palette (features/game/gameTheme.ts) is built from them, and a palette
// should not have to import a React component to learn its own colours. Nothing
// is imported here, so no consumer can create a cycle.
export const CTA_BG = '#FFD426';
export const CTA_BG_HOVER = '#DBB621';
export const CTA_BG_DISABLED = '#E8DAA0';
export const CTA_TEXT = '#0F0D09';
