import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchResults, fetchStatus, triggerScrape } from '../services/api';
import { DataTable } from '../components/DataTable';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { FilterPanel, type FilterState } from '../components/FilterPanel';
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
  columnHelper.accessor('details.bathrooms', { header: 'Baths' }),
  columnHelper.accessor('details.propertyType', { header: 'Type' }),
  columnHelper.accessor('details.furnished', { header: 'Furnished' }),
  columnHelper.accessor('url', {
    header: 'Link',
    cell: info => <a href={info.getValue()} target="_blank" rel="noreferrer">View</a>
  })
];

export function RoomsView() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('https://www.rightmove.co.uk/property-to-rent/find.html?searchType=RENT&locationIdentifier=REGION%5E87490&insId=1&radius=0.0');
  
  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('roomFilters');
    return saved ? JSON.parse(saved) : {
      priceMin: '',
      priceMax: '',
      bedrooms: [],
      propertyType: [],
      furnished: [],
      leaseType: [],
      location: '',
    };
  });

  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('roomAppliedFilters');
    return saved ? JSON.parse(saved) : {
      priceMin: '',
      priceMax: '',
      bedrooms: [],
      propertyType: [],
      furnished: [],
      leaseType: [],
      location: '',
    };
  });

  // Persist filters to localStorage when they change
  useEffect(() => {
    localStorage.setItem('roomFilters', JSON.stringify(filters));
  }, [filters]);

  // Persist applied filters to localStorage when they change
  useEffect(() => {
    localStorage.setItem('roomAppliedFilters', JSON.stringify(appliedFilters));
  }, [appliedFilters]);

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

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    const emptyFilters: FilterState = {
      priceMin: '',
      priceMax: '',
      bedrooms: [],
      propertyType: [],
      furnished: [],
      leaseType: [],
      location: '',
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const applyFilterFunction = (data: Room[]) => {
    return data.filter(room => {
      // Price filter
      if (appliedFilters.priceMin !== '' && room.price.amount < appliedFilters.priceMin) {
        return false;
      }
      if (appliedFilters.priceMax !== '' && room.price.amount > appliedFilters.priceMax) {
        return false;
      }

      // Location filter
      if (appliedFilters.location.trim() !== '') {
        const searchLower = appliedFilters.location.toLowerCase();
        if (!room.location.area.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Bedrooms filter
      if (appliedFilters.bedrooms.length > 0) {
        if (room.details.bedrooms === undefined) return false;
        const bedroomMatch = appliedFilters.bedrooms.some(b => {
          if (b === 'Studio') return room.details.bedrooms === 0;
          if (b === '4+') return (room.details.bedrooms ?? 0) >= 4;
          return room.details.bedrooms === parseInt(b);
        });
        if (!bedroomMatch) return false;
      }

      // Property Type filter
      if (appliedFilters.propertyType.length > 0) {
        if (!room.details.propertyType) return false;
        const typeMatch = appliedFilters.propertyType.some(t =>
          t.toLowerCase() === room.details.propertyType?.toLowerCase()
        );
        if (!typeMatch) return false;
      }

      // Furnished filter
      if (appliedFilters.furnished.length > 0) {
        if (!room.details.furnished) return false;
        const furnishedMatch = appliedFilters.furnished.some(f =>
          f.toLowerCase() === room.details.furnished?.toLowerCase()
        );
        if (!furnishedMatch) return false;
      }

      // Lease Type filter
      if (appliedFilters.leaseType.length > 0) {
        if (!room.details.leaseType) return false;
        const leaseMatch = appliedFilters.leaseType.some(l =>
          l.toLowerCase() === room.details.leaseType?.toLowerCase()
        );
        if (!leaseMatch) return false;
      }

      return true;
    });
  };

  const isScraping = mutation.isPending || status?.status === 'scraping';
  const scrapeCount = status?.count || 0;
  const estimatedMax = 100; // Conservative estimate for percentage calculation
  const progress = Math.min((scrapeCount / estimatedMax) * 100, 100);

  const getStatusType = (): 'idle' | 'scraping' | 'complete' | 'error' => {
    if (mutation.isError || status?.status === 'error') return 'error';
    if (isScraping) return 'scraping';
    if (data.length > 0) return 'complete';
    return 'idle';
  };

  return (
    <div className="view-container">
      <header className="view-header">
        <div className="view-header-left">
          <h1>Rooms (Rightmove)</h1>
          <StatusBadge status={getStatusType()} count={scrapeCount} />
        </div>
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
          >
            {isScraping ? 'Scraping...' : 'Trigger Scrape'}
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

      {isScraping && (
        <div className="scraping-section">
          <ProgressBar progress={progress} isActive={isScraping} />
        </div>
      )}

      {data.length > 0 && (
        <FilterPanel 
          filters={filters}
          setFilters={setFilters}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />
      )}

      {isLoading || isFetching || isScraping ? (
        <div className={`loading ${isScraping ? 'scraping' : ''}`}>
          {isScraping ? `Scraping in progress... Found ${scrapeCount} rooms so far.` : 'Loading data...'}
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">No rooms scraped yet. Enter a Rightmove URL and trigger a scrape to get started.</div>
      ) : (
        <div className="data-section">
          <div className="results-info">
            <p>
              Showing <strong>{applyFilterFunction(data).length}</strong> of <strong>{data.length}</strong> rooms
              {applyFilterFunction(data).length !== data.length && ' (filtered)'}
            </p>
          </div>
          <DataTable 
            data={data} 
            columns={columns}
            filterFunction={applyFilterFunction}
          />
        </div>
      )}
    </div>
  );
}
