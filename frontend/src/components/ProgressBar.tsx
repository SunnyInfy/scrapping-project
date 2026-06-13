interface ProgressBarProps {
  progress: number; // 0-100
  isActive: boolean;
}

export function ProgressBar({ progress, isActive }: ProgressBarProps) {
  const isIndeterminate = isActive && progress === 0;

  const getColor = (percent: number): string => {
    if (percent < 50) {
      const ratio = percent / 50;
      const r = Math.round(239 - (239 - 234) * ratio);
      const g = Math.round(68 + (179 - 68) * ratio);
      const b = Math.round(68 - 68 * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const ratio = (percent - 50) / 50;
      const r = Math.round(234 - (234 - 34) * ratio);
      const g = Math.round(179 + (197 - 179) * ratio);
      const b = Math.round(8 + (94 - 8) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-wrapper">
        <div
          className={`progress-bar-fill ${isActive ? 'active' : ''} ${isIndeterminate ? 'indeterminate' : ''}`}
          style={isIndeterminate ? { width: '100%' } : {
            width: `${Math.min(progress, 100)}%`,
            backgroundColor: getColor(progress),
          }}
        />
      </div>
      <div className="progress-bar-text">
        {isIndeterminate ? '...' : `${Math.round(progress)}%`}
      </div>
    </div>
  );
}
