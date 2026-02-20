interface DifficultyRateProps {
  correctCount: number;
  encounterCount: number;
  minEncounters?: number;
}

export function DifficultyRate({
  correctCount,
  encounterCount,
  minEncounters = 20,
}: DifficultyRateProps) {
  // Insufficient data for calculated difficulty rate
  if (encounterCount < minEncounters) {
    return (
      <span className="text-gray-500 text-sm">
        Insufficient data ({encounterCount} encounters)
      </span>
    );
  }

  // Calculate percentage
  const percentage = Math.round((correctCount / encounterCount) * 100);

  // Color coding based on difficulty
  let colorClass = 'text-green-600'; // Easy (>60%)
  if (percentage < 30) {
    colorClass = 'text-red-600'; // Very hard
  } else if (percentage < 60) {
    colorClass = 'text-yellow-600'; // Moderate
  }

  return <span className={`font-medium ${colorClass}`}>{percentage}%</span>;
}
