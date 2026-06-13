interface ProgressBarProps {
  progress: number; // 0-100
  isActive: boolean;
}

export function ProgressBar({ progress, isActive }: ProgressBarProps) {
  // Calculate color based on progress: red (0%) -> yellow (50%) -> green (100%)
  const getColor = (percent: number): string => {
    if (percent < 50) {
      // Red to Yellow: #ef4444 to #eab308
      const ratio = percent / 50;
      const r = Math.round(239 - (239 - 234) * ratio);
      const g = Math.round(68 + (179 - 68) * ratio);
      const b = Math.round(68 - 68 * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to Green: #eab308 to #22c55e
      const ratio = (percent - 50) / 50;
      const r = Math.round(234 - (234 - 34) * ratio);
      const g = Math.round(179 + (197 - 179) * ratio);
      const b = Math.round(8 + (94 - 8) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  const barColor = getColor(progress);

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-wrapper">
        <div
          className={`progress-bar-fill ${isActive ? 'active' : ''}`}
          style={{
            width: `${Math.min(progress, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <div className="progress-bar-text">{Math.round(progress)}%</div>
    </div>
  );
}
