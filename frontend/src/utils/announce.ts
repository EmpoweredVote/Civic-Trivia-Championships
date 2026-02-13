import { useAnnouncementStore } from '../store/announcementStore';

export const announce = {
  polite(message: string) {
    // Clear then set to ensure screen readers detect changes for repeated messages
    useAnnouncementStore.setState({ politeMessage: '' });
    setTimeout(() => {
      useAnnouncementStore.setState({ politeMessage: message });
      // Clear after screen reader has time to announce
      setTimeout(() => {
        useAnnouncementStore.setState({ politeMessage: '' });
      }, 1000);
    }, 50);
  },

  assertive(message: string) {
    // Clear then set to ensure screen readers detect changes for repeated messages
    useAnnouncementStore.setState({ assertiveMessage: '' });
    setTimeout(() => {
      useAnnouncementStore.setState({ assertiveMessage: message });
      // Clear after screen reader has time to announce
      setTimeout(() => {
        useAnnouncementStore.setState({ assertiveMessage: '' });
      }, 1000);
    }, 50);
  },
};
