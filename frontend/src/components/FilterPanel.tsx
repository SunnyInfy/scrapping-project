import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface FilterState {
  priceMin: number | '';
  priceMax: number | '';
  bedrooms: string[];
  propertyType: string[];
  furnished: string[];
  leaseType: string[];
  location: string;
  postcode: string;
}

interface FilterPanelProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  onApply: () => void;
  onClear: () => void;
}

const BEDROOM_OPTIONS = ['Studio', '1', '2', '3', '4+'];
const PROPERTY_TYPE_OPTIONS = ['Flat', 'House', 'Studio', 'Bungalow', 'Terraced', 'Semi-detached'];
const FURNISHED_OPTIONS = ['Furnished', 'Unfurnished', 'Part-furnished'];
const LEASE_TYPE_OPTIONS = ['Long-term', 'Short-term'];

export function FilterPanel({ filters, setFilters, onApply, onClear }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePriceMinChange = (value: string) => {
    setFilters({ ...filters, priceMin: value === '' ? '' : parseFloat(value) || '' });
  };

  const handlePriceMaxChange = (value: string) => {
    setFilters({ ...filters, priceMax: value === '' ? '' : parseFloat(value) || '' });
  };

  const handleBedroomToggle = (bedroom: string) => {
    setFilters({
      ...filters,
      bedrooms: filters.bedrooms.includes(bedroom)
        ? filters.bedrooms.filter(b => b !== bedroom)
        : [...filters.bedrooms, bedroom],
    });
  };

  const handlePropertyTypeToggle = (type: string) => {
    setFilters({
      ...filters,
      propertyType: filters.propertyType.includes(type)
        ? filters.propertyType.filter(t => t !== type)
        : [...filters.propertyType, type],
    });
  };

  const handleFurnishedToggle = (status: string) => {
    setFilters({
      ...filters,
      furnished: filters.furnished.includes(status)
        ? filters.furnished.filter(f => f !== status)
        : [...filters.furnished, status],
    });
  };

  const handleLeaseTypeToggle = (type: string) => {
    setFilters({
      ...filters,
      leaseType: filters.leaseType.includes(type)
        ? filters.leaseType.filter(t => t !== type)
        : [...filters.leaseType, type],
    });
  };

  const hasActiveFilters =
    filters.priceMin !== '' ||
    filters.priceMax !== '' ||
    filters.bedrooms.length > 0 ||
    filters.propertyType.length > 0 ||
    filters.furnished.length > 0 ||
    filters.leaseType.length > 0 ||
    filters.location.trim() !== '' ||
    filters.postcode.trim() !== '';

  const activeFilterCount =
    (filters.priceMin !== '' ? 1 : 0) +
    (filters.priceMax !== '' ? 1 : 0) +
    filters.bedrooms.length +
    filters.propertyType.length +
    filters.furnished.length +
    filters.leaseType.length +
    (filters.location.trim() !== '' ? 1 : 0) +
    (filters.postcode.trim() !== '' ? 1 : 0);

  return (
    <div className="filter-panel">
      <div className="filter-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="filter-title">
          <h3>Filters</h3>
          {hasActiveFilters && (
            <span className="filter-badge">{activeFilterCount}</span>
          )}
        </div>
        <button className="filter-toggle">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Price Range */}
          <div className="filter-section">
            <h4 className="filter-section-title">Price Range (£)</h4>
            <div className="filter-row">
              <div className="filter-input-group">
                <label htmlFor="price-min">Min</label>
                <input
                  id="price-min"
                  type="number"
                  value={filters.priceMin}
                  onChange={(e) => handlePriceMinChange(e.target.value)}
                  placeholder="0"
                  className="filter-input-small"
                />
              </div>
              <div className="filter-input-group">
                <label htmlFor="price-max">Max</label>
                <input
                  id="price-max"
                  type="number"
                  value={filters.priceMax}
                  onChange={(e) => handlePriceMaxChange(e.target.value)}
                  placeholder="∞"
                  className="filter-input-small"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="filter-section">
            <h4 className="filter-section-title">Location</h4>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              placeholder="Search location..."
              className="filter-input"
            />
          </div>

          {/* Postcode (exact) */}
          <div className="filter-section">
            <h4 className="filter-section-title">Postcode</h4>
            <input
              type="text"
              value={filters.postcode}
              onChange={(e) => setFilters({ ...filters, postcode: e.target.value })}
              placeholder="e.g. E1 1AA or E1"
              className="filter-input"
            />
          </div>

          {/* Bedrooms */}
          <div className="filter-section">
            <h4 className="filter-section-title">Bedrooms</h4>
            <div className="filter-checkboxes">
              {BEDROOM_OPTIONS.map((bedroom) => (
                <label key={bedroom} className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.bedrooms.includes(bedroom)}
                    onChange={() => handleBedroomToggle(bedroom)}
                    className="filter-checkbox"
                  />
                  <span>{bedroom}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Property Type */}
          <div className="filter-section">
            <h4 className="filter-section-title">Property Type</h4>
            <div className="filter-checkboxes">
              {PROPERTY_TYPE_OPTIONS.map((type) => (
                <label key={type} className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.propertyType.includes(type)}
                    onChange={() => handlePropertyTypeToggle(type)}
                    className="filter-checkbox"
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Furnished Status */}
          <div className="filter-section">
            <h4 className="filter-section-title">Furnished Status</h4>
            <div className="filter-checkboxes">
              {FURNISHED_OPTIONS.map((status) => (
                <label key={status} className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.furnished.includes(status)}
                    onChange={() => handleFurnishedToggle(status)}
                    className="filter-checkbox"
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Lease Type */}
          <div className="filter-section">
            <h4 className="filter-section-title">Lease Type</h4>
            <div className="filter-checkboxes">
              {LEASE_TYPE_OPTIONS.map((type) => (
                <label key={type} className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.leaseType.includes(type)}
                    onChange={() => handleLeaseTypeToggle(type)}
                    className="filter-checkbox"
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="filter-actions">
            <button
              onClick={onApply}
              disabled={!hasActiveFilters}
              className="filter-btn filter-btn-apply"
            >
              Apply Filters
            </button>
            <button
              onClick={onClear}
              disabled={!hasActiveFilters}
              className="filter-btn filter-btn-clear"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
