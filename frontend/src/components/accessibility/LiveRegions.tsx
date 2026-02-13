import { useAnnouncementStore } from '../../store/announcementStore';

export function LiveRegions() {
  const politeMessage = useAnnouncementStore((state) => state.politeMessage);
  const assertiveMessage = useAnnouncementStore((state) => state.assertiveMessage);

  return (
    <>
      {/* Polite announcements - don't interrupt screen reader */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>

      {/* Assertive announcements - interrupt screen reader immediately */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </>
  );
}
