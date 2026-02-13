import { create } from 'zustand';

interface ConfettiStore {
  conductor: any | null;
  setConductor: (conductor: any) => void;
  fireSmallBurst: () => void;
  fireMediumBurst: () => void;
  fireConfettiRain: () => void;
}

export const useConfettiStore = create<ConfettiStore>((set, get) => ({
  conductor: null,

  setConductor: (conductor: any) => {
    set({ conductor });
  },

  fireSmallBurst: () => {
    const { conductor } = get();
    if (conductor) {
      conductor.shoot();
    }
  },

  fireMediumBurst: () => {
    const { conductor } = get();
    if (conductor) {
      conductor.run({ speed: 3, duration: 1500 });
    }
  },

  fireConfettiRain: () => {
    const { conductor } = get();
    if (conductor) {
      conductor.run({ speed: 1, duration: 5000 });
    }
  },
}));
