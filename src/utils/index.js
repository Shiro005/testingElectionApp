const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.searchVoters = functions.https.onCall(async (data, context) => {
  const { searchTerm, filters, limit = 50, offset = 0 } = data;
  
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const db = admin.database();
  let ref = db.ref('voters');

  // Simple server-side filtering logic
  const snapshot = await ref.once('value');
  const allVoters = [];
  
  snapshot.forEach((childSnapshot) => {
    const voter = {
      id: childSnapshot.key,
      ...childSnapshot.val()
    };
    allVoters.push(voter);
  });

  // Server-side search logic
  let filtered = allVoters;
  
  if (searchTerm) {
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    filtered = filtered.filter(voter => {
      const searchText = `${voter.name || ''} ${voter.voterId || ''}`.toLowerCase();
      return terms.every(term => searchText.includes(term));
    });
  }

  // Apply filters
  if (filters.boothNumber) {
    filtered = filtered.filter(voter => 
      voter.boothNumber && voter.boothNumber.toString().includes(filters.boothNumber)
    );
  }

  if (filters.pollingStationAddress) {
    filtered = filtered.filter(voter =>
      voter.pollingStationAddress && 
      voter.pollingStationAddress.toLowerCase().includes(filters.pollingStationAddress.toLowerCase())
    );
  }

  // Pagination
  const paginated = filtered.slice(offset, offset + limit);
  
  return {
    voters: paginated,
    totalCount: filtered.length,
    hasMore: (offset + limit) < filtered.length
  };
});