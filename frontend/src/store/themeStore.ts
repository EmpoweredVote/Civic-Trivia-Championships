import { create } from 'zustand';

const COOKIE_NAME = 'ev_theme';
const LOCAL_KEY = 'ctc-theme';

/**
 * The ev_theme cookie on .empowered.vote is how a light/dark choice travels between
 * Empowered Vote sites. localStorage cannot do it — it is scoped per origin, so what this
 * app stored was invisible to essentials, Compass, Profile and the rest, and theirs was
 * invisible here. This app read and wrote only localStorage, so it was the last tool still
 * outside that contract.
 *
 * Read order: cookie, then this app's own key, then dark. LOCAL_KEY stays `ctc-theme` rather
 * than moving to the estate's `ev:color-scheme`, because a localStorage key is per-origin and
 * nothing else writes to this one — renaming it would only throw away the choices players
 * have already made here.
 *
 * ⚠ On localhost the browser rejects a .empowered.vote cookie, so in dev only the localStorage
 * half takes effect and the theme will not follow you between apps. Expected, not a bug.
 */
function readCookie(): 'dark' | 'light' | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)ev_theme=([^;]+)/);
  const value = match ? match[1] : null;
  return value === 'dark' || value === 'light' ? value : null;
}

function readStored(): 'dark' | 'light' | null {
  try {
    const value = localStorage.getItem(LOCAL_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    // Private mode or storage blocked. The cookie or the dark default covers us.
    return null;
  }
}

/**
 * Dark unless the player chose light on an Empowered Vote site. The OS is deliberately not
 * consulted: a browser reports prefers-color-scheme: light when the OS has no preference set
 * at all, so reading it cannot tell "never chose" apart from "chose light".
 */
function resolveInitial(): boolean {
  return (readCookie() ?? readStored()) !== 'light';
}

function persist(value: 'dark' | 'light') {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${COOKIE_NAME}=${value}; domain=.empowered.vote; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
  try {
    localStorage.setItem(LOCAL_KEY, value);
  } catch {
    // Blocked or full storage. The cookie above already carries the choice.
  }
}

interface ThemeStore {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  darkMode: resolveInitial(),
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode;
      persist(next ? 'dark' : 'light');
      return { darkMode: next };
    }),
}));
