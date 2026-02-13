export function GemIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Diamond/gem icon */}
      <path d="M12 2L4 8l8 14 8-14-8-6zM6.5 8h11L12 5l-5.5 3zm1.5 1l4 10 4-10H8z" />
    </svg>
  );
}
