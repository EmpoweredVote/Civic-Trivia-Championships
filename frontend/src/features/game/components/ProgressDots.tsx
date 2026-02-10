interface ProgressDotsProps {
  currentIndex: number;
  total?: number;
}

export function ProgressDots({ currentIndex, total = 10 }: ProgressDotsProps) {
  return (
    <div className="flex gap-2 items-center justify-center">
      {Array.from({ length: total }).map((_, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div
            key={index}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              isCurrent
                ? 'bg-teal-500 scale-125'
                : isPast
                ? 'bg-teal-500/40'
                : 'bg-slate-600 border border-slate-500'
            }`}
            aria-label={`Question ${index + 1} ${
              isCurrent ? '(current)' : isPast ? '(completed)' : '(upcoming)'
            }`}
          />
        );
      })}
    </div>
  );
}
