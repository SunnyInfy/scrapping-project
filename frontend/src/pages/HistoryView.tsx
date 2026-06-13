import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchHistory, deleteHistoryItem, fetchHistoryData } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import type { Room } from '@scrapping/shared';

interface HistoryItem {
  filename: string;
  source: string;
  date: string;
  size: number;
  count: number;
}

const colHelper = createColumnHelper<Room>();

const previewColumns = [
  colHelper.accessor('title', { header: 'Title', enableSorting: false }),
  colHelper.accessor('location.postcode', {
    header: 'Postcode',
    enableSorting: false,
    cell: info => info.getValue() ?? '—',
  }),
  colHelper.accessor('price.amount', {
    header: 'Price',
    enableSorting: true,
    cell: info => `£${info.getValue()}`,
  }),
  colHelper.accessor('details.bedrooms', { header: 'Beds', enableSorting: false }),
  colHelper.accessor('details.propertyType', { header: 'Type', enableSorting: false }),
  colHelper.accessor('details.furnished', { header: 'Furnished', enableSorting: false }),
  colHelper.accessor('url', {
    header: 'Link',
    enableSorting: false,
    cell: info => <a href={info.getValue()} target="_blank" rel="noreferrer">View</a>,
  }),
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function HistoryView() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { data: history = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: ['history', 'rooms'],
    queryFn: () => fetchHistory('rooms'),
  });

  const { data: viewData, isLoading: isLoadingView } = useQuery<Room[]>({
    queryKey: ['history-data', 'rooms', selectedFile],
    queryFn: () => fetchHistoryData('rooms', selectedFile!),
    enabled: !!selectedFile,
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => deleteHistoryItem('rooms', filename),
    onSuccess: (_, filename) => {
      if (selectedFile === filename) setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['history', 'rooms'] });
      queryClient.invalidateQueries({ queryKey: ['results', 'rooms'] });
    },
  });

  const handleDelete = (item: HistoryItem) => {
    if (window.confirm(`Delete this scrape session?\n${item.count.toLocaleString()} results from ${formatDate(item.date)}`)) {
      deleteMutation.mutate(item.filename);
    }
  };

  const handleToggleView = (filename: string) => {
    setSelectedFile(prev => prev === filename ? null : filename);
  };

  const totalResults = history.reduce((sum, item) => sum + item.count, 0);
  const totalSize = history.reduce((sum, item) => sum + item.size, 0);

  return (
    <div className="view-container">
      <header className="view-header">
        <div className="view-header-left">
          <h1>Scrape History</h1>
        </div>
      </header>

      {isLoading ? (
        <div className="loading">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          No scrape history found. Run a scrape from the Rooms tab to get started.
        </div>
      ) : (
        <>
          <div className="history-summary">
            <div className="history-stat">
              <span className="history-stat-value">{history.length}</span>
              <span className="history-stat-label">Scrape Sessions</span>
            </div>
            <div className="history-stat">
              <span className="history-stat-value">{totalResults.toLocaleString()}</span>
              <span className="history-stat-label">Total Results</span>
            </div>
            <div className="history-stat">
              <span className="history-stat-value">{formatSize(totalSize)}</span>
              <span className="history-stat-label">Disk Usage</span>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Date Scraped</th>
                  <th>Results</th>
                  <th>File Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.filename} className={selectedFile === item.filename ? 'history-row-active' : ''}>
                    <td style={{ textTransform: 'capitalize' }}>{item.source}</td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.count.toLocaleString()} listings</td>
                    <td>{formatSize(item.size)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className={`view-btn ${selectedFile === item.filename ? 'active' : ''}`}
                          onClick={() => handleToggleView(item.filename)}
                          title={selectedFile === item.filename ? 'Hide data' : 'View data'}
                        >
                          {selectedFile === item.filename ? <EyeOff size={15} /> : <Eye size={15} />}
                          {selectedFile === item.filename ? 'Hide' : 'View'}
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(item)}
                          disabled={deleteMutation.isPending}
                          title="Delete this scrape session"
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedFile && (
            <div className="history-preview">
              <div className="history-preview-header">
                <h3>Viewing: {selectedFile}</h3>
                {viewData && <span className="history-preview-count">{viewData.length.toLocaleString()} listings</span>}
              </div>
              {isLoadingView ? (
                <div className="loading">Loading data...</div>
              ) : viewData && viewData.length > 0 ? (
                <DataTable data={viewData} columns={previewColumns} />
              ) : (
                <div className="empty-state">No data found in this file.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
