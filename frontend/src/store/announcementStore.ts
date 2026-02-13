import { create } from 'zustand';

interface AnnouncementState {
  politeMessage: string;
  assertiveMessage: string;
}

export const useAnnouncementStore = create<AnnouncementState>(() => ({
  politeMessage: '',
  assertiveMessage: '',
}));
