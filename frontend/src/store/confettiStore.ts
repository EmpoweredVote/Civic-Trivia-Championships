import { create } from 'zustand';

interface ConfettiStore {
  conductor: any | null;
  setConductor: (conductor: any) => void;
  fireSmallBurst: () => void;
  fireMediumBurst: () => void;
  fireConfettiRain: () => void;
  fireTopRain: (duration?: number) => void;
  fireFireworks: () => void;
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

  fireTopRain: (duration = 2000) => {
    const { conductor } = get();
    if (conductor) {
      conductor.rain({ duration });
    }
  },

  fireFireworks: () => {
    const { conductor } = get();
    if (conductor) {
      conductor.fireworks({ duration: 3000 });
    }
  },
}));
