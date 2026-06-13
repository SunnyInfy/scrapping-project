interface StatusBadgeProps {
  status: 'idle' | 'scraping' | 'complete' | 'error';
  count?: number;
}

export function StatusBadge({ status, count = 0 }: StatusBadgeProps) {
  const getStatusText = (): string => {
    switch (status) {
      case 'scraping':
        return `Scraping... (${count})`;
      case 'complete':
        return `Complete (${count})`;
      case 'error':
        return 'Error';
      case 'idle':
      default:
        return 'Idle';
    }
  };

  return (
    <div className={`status-badge status-badge-${status}`}>
      {status === 'scraping' && <span className="status-spinner" />}
      <span className="status-text">{getStatusText()}</span>
    </div>
  );
}
