import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiSearch, FiX, FiFilter, FiSliders } from 'react-icons/fi';
import TranslatedText from './TranslatedText';
import debounce from 'lodash.debounce';

const SearchBar = ({
  // Basic props
  placeholder = "Search by name, voter ID, booth, or address... (English/Marathi)",
  onSearch,
  onFiltersChange,
  debounceTime = 300,
  className = "",
  showClearButton = true,
  initialValue = "",
  disabled = false,
  
  // Advanced props
  showFiltersButton = false,
  filters = {},
  searchTypes = ['all'], // 'all', 'name', 'voterId', 'booth', 'address'
  quickFilters = [],
  size = 'medium' // 'small', 'medium', 'large'
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inputRef = useRef(null);

  // Size classes
  const sizeClasses = {
    small: 'py-2 text-sm',
    medium: 'py-2.5 text-sm',
    large: 'py-3 text-base'
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term) => {
      if (onSearch) {
        onSearch(term);
      }
    }, debounceTime),
    [onSearch, debounceTime]
  );

  // Handle search term changes
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    if (onSearch) {
      onSearch('');
    }
    inputRef.current?.focus();
  };

  // Handle quick filter selection
  const handleQuickFilter = (filter) => {
    setSearchTerm(filter);
    if (onSearch) {
      onSearch(filter);
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Update internal state when initialValue changes
  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);

  return (
    <div className={`relative ${className}`}>
      <div className={`relative transition-all duration-200 ${
        isFocused ? 'ring-2 ring-orange-500 ring-opacity-20 rounded-xl' : ''
      }`}>
        {/* Search Icon */}
        <FiSearch className={`absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors ${
          isFocused ? 'text-orange-500' : 'text-gray-400'
        } ${size === 'small' ? 'text-base' : 'text-lg'}`} />
        
        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          disabled={disabled}
          className={`
            w-full pl-10 pr-10 rounded-xl border transition-all duration-200 
            bg-white placeholder-gray-400 focus:outline-none
            ${sizeClasses[size]}
            ${disabled 
              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' 
              : isFocused
                ? 'border-orange-500 bg-white text-gray-900'
                : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
            }
          `}
        />

        {/* Right side buttons */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {/* Clear button */}
          {showClearButton && searchTerm && !disabled && (
            <button
              onClick={handleClearSearch}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              type="button"
            >
              <FiX className={size === 'small' ? 'text-base' : 'text-lg'} />
            </button>
          )}

          {/* Filters button */}
          {showFiltersButton && onFiltersChange && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-1 rounded transition-colors ${
                Object.keys(filters).length > 0 
                  ? 'text-orange-500' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              type="button"
            >
              <FiSliders className={size === 'small' ? 'text-base' : 'text-lg'} />
            </button>
          )}
        </div>
      </div>

      {/* Quick filters */}
      {quickFilters.length > 0 && searchTerm.length === 0 && isFocused && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2">
          <div className="text-xs text-gray-500 font-medium mb-2 px-2">
            <TranslatedText>Quick searches</TranslatedText>
          </div>
          <div className="flex flex-wrap gap-1">
            {quickFilters.map((filter, index) => (
              <button
                key={index}
                onClick={() => handleQuickFilter(filter)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs transition-colors"
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search tips */}
      {isFocused && !showAdvanced && quickFilters.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3 text-xs text-gray-500">
          <TranslatedText>Search tips: You can search by name, voter ID, booth number, or address in English or Marathi</TranslatedText>
        </div>
      )}

      {/* Advanced filters panel */}
      {showAdvanced && showFiltersButton && onFiltersChange && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 p-4">
          <div className="text-sm font-medium text-gray-900 mb-3">
            <TranslatedText>Advanced Filters</TranslatedText>
          </div>
          
          {/* Add your custom filter components here */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <TranslatedText>Search Type</TranslatedText>
              </label>
              <select 
                className="w-full p-2 border border-gray-300 rounded text-sm"
                value={filters.searchType || 'all'}
                onChange={(e) => onFiltersChange({ ...filters, searchType: e.target.value })}
              >
                <option value="all">All Fields</option>
                <option value="name">Name Only</option>
                <option value="voterId">Voter ID Only</option>
                <option value="booth">Booth Only</option>
                <option value="address">Address Only</option>
              </select>
            </div>
            
            {/* Add more filter fields as needed */}
          </div>
          
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => setShowAdvanced(false)}
              className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm transition-colors"
            >
              <TranslatedText>Cancel</TranslatedText>
            </button>
            <button
              onClick={() => {
                onFiltersChange({});
                setShowAdvanced(false);
              }}
              className="px-3 py-1.5 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
            >
              <TranslatedText>Apply</TranslatedText>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;