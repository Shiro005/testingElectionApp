import { useMemo } from 'react';

export const useVoterSearch = (voters, searchTerm, filters) => {
  return useMemo(() => {
    if (!voters.length) {
      return {
        filteredVoters: [],
        boothNumbers: [],
        pollingStations: [],
        stats: { total: 0, filtered: 0, filteredOut: 0 }
      };
    }

    let matched = voters;

    // FAST SEARCH IMPLEMENTATION
    if (searchTerm.trim()) {
      const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      
      matched = voters.filter(voter => {
        const searchableText = `${voter.name || ''} ${voter.voterId || ''}`.toLowerCase();
        return searchTerms.every(term => searchableText.includes(term));
      });
    }

    // Apply filters
    const filtered = matched.filter(voter => {
      const matchesBooth = !filters.boothNumber || 
        (voter.boothNumber && voter.boothNumber.toString().includes(filters.boothNumber));
      
      const matchesPollingStation = !filters.pollingStationAddress ||
        (voter.pollingStationAddress && 
         voter.pollingStationAddress.toLowerCase().includes(filters.pollingStationAddress.toLowerCase()));
      
      return matchesBooth && matchesPollingStation;
    });

    // Derived data
    const boothNumbers = [...new Set(voters.map(voter => voter.boothNumber).filter(Boolean))].sort();
    const pollingStations = [...new Set(voters.map(voter => voter.pollingStationAddress).filter(Boolean))].sort();
    
    const stats = {
      total: voters.length,
      filtered: filtered.length,
      filteredOut: voters.length - filtered.length
    };

    return {
      filteredVoters: filtered,
      boothNumbers,
      pollingStations,
      stats
    };
  }, [voters, searchTerm, filters]);
};