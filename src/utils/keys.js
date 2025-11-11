// utils/keys.js
export const makeVoterKey = (voter) => {
  // prefer voter.voterId if present, fallback to id or serialNumber
  const raw = (voter.voterId || voter.id || voter.serialNumber || '').toString().trim();
  return raw.replace(/\s+/g, '').toUpperCase();
};
