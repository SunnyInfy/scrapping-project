import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchResults, fetchStatus, triggerScrape } from '../services/api';
import { DataTable } from '../components/DataTable';
import type { Room } from '@scrapping/shared';
import { createColumnHelper } from '@tanstack/react-table';
import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const columnHelper = createColumnHelper<Room>();

const columns = [
  columnHelper.accessor('title', { header: 'Title' }),
  columnHelper.accessor('location.area', { header: 'Location' }),
  columnHelper.accessor('price.amount', {
    header: 'Price',
    cell: info => `£${info.getValue()}`
  }),
  columnHelper.accessor('price.frequency', { header: 'Frequency' }),
  columnHelper.accessor('details.bedrooms', { header: 'Beds' }),
  columnHelper.accessor('url', {
    header: 'Link',
    cell: info => <a href={info.getValue()} target="_blank" rel="noreferrer">View</a>
  })
];

export function RoomsView() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('https://www.rightmove.co.uk/property-to-rent/find.html?searchType=RENT&locationIdentifier=REGION%5E87490&insId=1&radius=0.0');

  const { data: status } = useQuery({
    queryKey: ['status', 'rooms'],
    queryFn: () => fetchStatus('rooms'),
    refetchInterval: 2000, // Poll every 2 seconds to get live progress
  });

  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: ['results', 'rooms'],
    queryFn: () => fetchResults('rooms'),
  });

  // When scraping finishes (transitions to idle), invalidate results to fetch final data
  useEffect(() => {
    if (status?.status === 'idle') {
      queryClient.invalidateQueries({ queryKey: ['results', 'rooms'] });
    }
  }, [status?.status, queryClient]);

  const mutation = useMutation({
    mutationFn: () => triggerScrape('rooms', 'rightmove', url),
    onSuccess: () => {
      // Force an immediate status check
      queryClient.invalidateQueries({ queryKey: ['status', 'rooms'] });
      // Wipe the table immediately while we wait for new data
      queryClient.setQueryData(['results', 'rooms'], []);
    }
  });

  const handleExport = () => {
    window.open('http://localhost:3001/api/export/rooms', '_blank');
  };

  const isScraping = mutation.isPending || status?.status === 'scraping';
  const scrapeCount = status?.count || 0;

  return (
    <div className="view-container">
      <header className="view-header">
        <h1>Rooms (Rightmove)</h1>
        <div className="action-bar">
          <input 
            type="text" 
            value={url} 
            onChange={e => setUrl(e.target.value)} 
            placeholder="Rightmove Search URL"
            className="url-input"
          />
          <button 
            onClick={() => mutation.mutate()} 
            disabled={isScraping}
            className="scrape-btn"
            style={{ width: '200px' }}
          >
            {isScraping ? `Scraping... (${scrapeCount} found)` : 'Trigger Scrape'}
          </button>
          <button 
            onClick={handleExport} 
            disabled={data.length === 0 || isScraping}
            className="export-btn"
            title="Export to CSV"
          >
            <Download size={20} />
          </button>
        </div>
      </header>
      
      {isLoading || isFetching || isScraping ? (
        <div className="loading">
          {isScraping ? `Scraping in progress... Found ${scrapeCount} rooms so far.` : 'Loading data...'}
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">No rooms scraped yet. Enter a Rightmove URL and trigger a scrape to get started.</div>
      ) : (
        <DataTable data={data} columns={columns} />
      )}
    </div>
  );
}
