import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchResults, fetchStatus, triggerScrape, fetchSources } from '../services/api';
import { DataTable } from '../components/DataTable';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { FilterPanel, type FilterState } from '../components/FilterPanel';
import type { Room } from '@scrapping/shared';
import { createColumnHelper } from '@tanstack/react-table';
import { useState, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';

const columnHelper = createColumnHelper<Room>();

const EMPTY_FILTER: FilterState = {
  priceMin: '',
  priceMax: '',
  bedrooms: [],
  propertyType: [],
  furnished: [],
  leaseType: [],
  location: '',
  postcode: '',
};

const columns = [
  columnHelper.accessor('source', { header: 'Source', enableSorting: false }),
  columnHelper.accessor('title', { header: 'Title', enableSorting: true }),
  columnHelper.accessor('location.area', { header: 'Location', enableSorting: false }),
  columnHelper.accessor('location.postcode', {
    header: 'Postcode',
    enableSorting: false,
    cell: info => info.getValue() ?? '—',
  }),
  columnHelper.accessor('price.amount', {
    header: 'Price',
    enableSorting: true,
    sortingFn: 'basic',
    cell: info => `£${info.getValue()}`,
  }),
  columnHelper.accessor('price.frequency', { header: 'Frequency', enableSorting: false }),
  columnHelper.accessor('details.bedrooms', { header: 'Beds', enableSorting: false }),
  columnHelper.accessor('details.bathrooms', { header: 'Baths', enableSorting: false }),
  columnHelper.accessor('details.propertyType', { header: 'Type', enableSorting: false }),
  columnHelper.accessor('details.furnished', { header: 'Furnished', enableSorting: false }),
  columnHelper.accessor('url', {
    header: 'Link',
    enableSorting: false,
    cell: info => <a href={info.getValue()} target="_blank" rel="noreferrer">View</a>,
  }),
];

interface AlreadyScrapedInfo {
  alreadyScraped: boolean;
  scrapedAt: string;
  count: number;
}

export function RoomsView() {
  const queryClient = useQueryClient();

  const [selectedSource, setSelectedSource] = useState<string>(() =>
    localStorage.getItem('selectedSource') || 'rightmove'
  );
  const [url, setUrl] = useState<string>(() => {
    const src = localStorage.getItem('selectedSource') || 'rightmove';
    return localStorage.getItem(`scrapeUrl_${src}`) || '';
  });
  const [alreadyScrapedInfo, setAlreadyScrapedInfo] = useState<AlreadyScrapedInfo | null>(null);

  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('roomFilters');
    return saved ? { ...EMPTY_FILTER, ...JSON.parse(saved) } : EMPTY_FILTER;
  });

  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('roomAppliedFilters');
    return saved ? { ...EMPTY_FILTER, ...JSON.parse(saved) } : EMPTY_FILTER;
  });

  useEffect(() => { localStorage.setItem('roomFilters', JSON.stringify(filters)); }, [filters]);
  useEffect(() => { localStorage.setItem('roomAppliedFilters', JSON.stringify(appliedFilters)); }, [appliedFilters]);
  useEffect(() => { localStorage.setItem('selectedSource', selectedSource); }, [selectedSource]);
  useEffect(() => { localStorage.setItem(`scrapeUrl_${selectedSource}`, url); }, [url, selectedSource]);

  const { data: sources = [] } = useQuery({
    queryKey: ['sources', 'rooms'],
    queryFn: () => fetchSources('rooms'),
    staleTime: Infinity,
  });

  const currentSourceConfig = sources.find(s => s.id === selectedSource);

  const { data: status } = useQuery({
    queryKey: ['status', 'rooms'],
    queryFn: () => fetchStatus('rooms'),
    refetchInterval: (query) => query.state.data?.status === 'scraping' ? 2000 : false,
  });

  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: ['results', 'rooms'],
    queryFn: () => fetchResults('rooms'),
  });

  useEffect(() => {
    if (status?.status === 'idle') {
      queryClient.invalidateQueries({ queryKey: ['results', 'rooms'] });
    }
  }, [status?.status, queryClient]);

  const mutation = useMutation({
    mutationFn: (force: boolean) => triggerScrape('rooms', selectedSource, url, force),
    onSuccess: () => {
      setAlreadyScrapedInfo(null);
      setFilters(EMPTY_FILTER);
      setAppliedFilters(EMPTY_FILTER);
      queryClient.invalidateQueries({ queryKey: ['status', 'rooms'] });
      queryClient.setQueryData(['results', 'rooms'], []);
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setAlreadyScrapedInfo(err.response.data);
      }
    },
  });

  const handleSourceChange = (sourceId: string) => {
    if (sourceId === selectedSource) return;
    setSelectedSource(sourceId);
    setAlreadyScrapedInfo(null);
    const stored = localStorage.getItem(`scrapeUrl_${sourceId}`);
    const src = sources.find(s => s.id === sourceId);
    setUrl(stored || src?.exampleUrl || '');
  };

  const handleExport = () => {
    window.open('http://localhost:3001/api/export/rooms', '_blank');
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTER);
    setAppliedFilters(EMPTY_FILTER);
  };

  const filteredData = useMemo(() => {
    return data.filter((room: Room) => {
      if (appliedFilters.priceMin !== '' && room.price.amount < appliedFilters.priceMin) return false;
      if (appliedFilters.priceMax !== '' && room.price.amount > appliedFilters.priceMax) return false;

      if (appliedFilters.location.trim() !== '') {
        if (!room.location.area.toLowerCase().includes(appliedFilters.location.toLowerCase())) return false;
      }

      if (appliedFilters.postcode.trim() !== '') {
        const normalize = (p: string) => p.toUpperCase().replace(/\s+/g, '');
        const search = normalize(appliedFilters.postcode);
        const roomPostcode = normalize(room.location.postcode || '');
        if (!roomPostcode.includes(search)) return false;
      }

      if (appliedFilters.bedrooms.length > 0) {
        if (room.details.bedrooms === undefined) return false;
        const bedroomMatch = appliedFilters.bedrooms.some(b => {
          if (b === 'Studio') return room.details.bedrooms === 0;
          if (b === '4+') return (room.details.bedrooms ?? 0) >= 4;
          return room.details.bedrooms === parseInt(b);
        });
        if (!bedroomMatch) return false;
      }

      if (appliedFilters.propertyType.length > 0) {
        if (!room.details.propertyType) return false;
        if (!appliedFilters.propertyType.some(t => t.toLowerCase() === room.details.propertyType?.toLowerCase())) return false;
      }

      if (appliedFilters.furnished.length > 0) {
        if (!room.details.furnished) return false;
        if (!appliedFilters.furnished.some(f => f.toLowerCase() === room.details.furnished?.toLowerCase())) return false;
      }

      if (appliedFilters.leaseType.length > 0) {
        if (!room.details.leaseType) return false;
        if (!appliedFilters.leaseType.some(l => l.toLowerCase() === room.details.leaseType?.toLowerCase())) return false;
      }

      return true;
    });
  }, [data, appliedFilters]);

  const isScraping = mutation.isPending || status?.status === 'scraping';
  const scrapeCount = status?.count || 0;
  const scrapeTotal = status?.total || 0;
  const progress = scrapeTotal > 0 ? Math.min((scrapeCount / scrapeTotal) * 100, 100) : 0;

  const getStatusType = (): 'idle' | 'scraping' | 'complete' | 'error' => {
    if (mutation.isError && !alreadyScrapedInfo) return 'error';
    if (status?.status === 'error') return 'error';
    if (isScraping) return 'scraping';
    if (data.length > 0) return 'complete';
    return 'idle';
  };

  return (
    <div className="view-container">
      <header className="view-header">
        <div className="view-header-left">
          <h1>Rooms</h1>
          <StatusBadge status={getStatusType()} count={scrapeCount} />
        </div>
        <div className="action-bar">
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

      {/* Source picker */}
      {sources.length > 0 && (
        <div className="source-picker">
          {sources.map(src => (
            <button
              key={src.id}
              className={`source-btn ${selectedSource === src.id ? 'active' : ''}`}
              onClick={() => handleSourceChange(src.id)}
              disabled={isScraping}
            >
              {src.label}
            </button>
          ))}
        </div>
      )}

      {/* URL input row */}
      <div className="url-row">
        <input
          type="text"
          value={url}
          onChange={e => { setUrl(e.target.value); setAlreadyScrapedInfo(null); }}
          placeholder={currentSourceConfig?.hint || 'Paste a search URL'}
          className="url-input url-input-full"
        />
        <button
          onClick={() => mutation.mutate(false)}
          disabled={isScraping || !url.trim()}
          className="scrape-btn"
        >
          {isScraping ? 'Scraping...' : 'Scrape'}
        </button>
        <button
          onClick={() => mutation.mutate(true)}
          disabled={isScraping || !url.trim()}
          className="scrape-btn force-scrape-btn"
          title="Force a fresh scrape even if this URL was scraped recently"
        >
          Force Re-Scrape
        </button>
      </div>

      {currentSourceConfig && (
        <p className="url-hint">
          Example: <span className="url-hint-example">{currentSourceConfig.exampleUrl}</span>
        </p>
      )}

      {alreadyScrapedInfo && !isScraping && (
        <div className="already-scraped-warning">
          <span>
            This URL was already scraped on{' '}
            <strong>{new Date(alreadyScrapedInfo.scrapedAt).toLocaleString('en-GB')}</strong>
            {' '}({alreadyScrapedInfo.count.toLocaleString()} results).
            Use <strong>Force Re-Scrape</strong> to fetch fresh data.
          </span>
          <button className="dismiss-btn" onClick={() => setAlreadyScrapedInfo(null)}>×</button>
        </div>
      )}

      {isScraping && (
        <div className="scraping-section">
          <ProgressBar progress={progress} isActive={isScraping} />
          <p className="scrape-count-label">
            {scrapeTotal > 0
              ? `${scrapeCount.toLocaleString()} / ${scrapeTotal.toLocaleString()} properties scraped`
              : `${scrapeCount.toLocaleString()} properties scraped so far...`}
          </p>
        </div>
      )}

      {data.length > 0 && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          onApply={() => setAppliedFilters(filters)}
          onClear={handleClearFilters}
        />
      )}

      {isLoading || isFetching || isScraping ? (
        <div className={`loading ${isScraping ? 'scraping' : ''}`}>
          {isScraping ? `Scraping in progress... Found ${scrapeCount.toLocaleString()} rooms so far.` : 'Loading data...'}
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">No rooms scraped yet. Select a source, paste a search URL, and click Scrape.</div>
      ) : (
        <div className="data-section">
          <div className="results-info">
            <p>
              Showing <strong>{filteredData.length.toLocaleString()}</strong> of <strong>{data.length.toLocaleString()}</strong> rooms
              {filteredData.length !== data.length && ' (filtered)'}
            </p>
          </div>
          <DataTable data={filteredData} columns={columns} storageKey="rooms" />
        </div>
      )}
    </div>
  );
}
