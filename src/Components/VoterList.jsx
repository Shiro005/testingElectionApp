import React, { memo, useCallback } from 'react';
import {
  FiEye,
  FiMapPin,
  FiPhone,
  FiUser,
  FiHome,
  FiCheckCircle,
  FiXCircle
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TranslatedText from './TranslatedText';

const VoterList = memo(({ voters = [], loading = false }) => {
  const navigate = useNavigate();

  const handleViewDetails = useCallback((voterId, e) => {
    if (e) e.stopPropagation();
    navigate(`/voter/${voterId}`);
  }, [navigate]);

  const handleCardClick = useCallback((voterId) => {
    navigate(`/voter/${voterId}`);
  }, [navigate]);

  // Format phone number
  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return phone;
  };

  // No results state
  if (!loading && (!Array.isArray(voters) || voters.length === 0)) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <div className="text-4xl mb-3 text-gray-300">👥</div>
        <h3 className="text-sm font-semibold text-gray-600 mb-1">
          <TranslatedText>No Voters Found</TranslatedText>
        </h3>
        <p className="text-xs text-gray-500">
          <TranslatedText>Adjust your search or filters</TranslatedText>
        </p>
      </div>
    );
  }

  // Loading state - compact skeleton
  if (loading && voters.length === 0) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-2 animate-pulse"
          >
            {/* <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                  <div className="h-3 bg-gray-200 rounded w-12"></div>
                  <div className="h-3 bg-gray-200 rounded w-8"></div>
                </div>
              </div>
              <div className="w-6 h-6 bg-gray-200 rounded"></div>
            </div> */}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {voters.map((voter, index) => (
        <div
          key={voter.id || index}
          onClick={() => handleCardClick(voter.id)}
          className="bg-white border border-gray-200 rounded-lg p-2 hover:border-orange-300 hover:shadow-sm cursor-pointer transition-all duration-150"
        >
          <div className="flex items-center justify-between">
            {/* Left Section - Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-800 text-sm truncate flex items-center gap-1">
                  <FiUser className="text-orange-500 text-lg flex-shrink-0" />
                  <span>{voter.name || 'N/A'}</span>
                </h3>

                {/* Voting Status Badge */}
                {/* {voter.hasVoted !== undefined && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${voter.hasVoted
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {voter.hasVoted ? (
                      <FiCheckCircle className="text-xs" />
                    ) : (
                      <FiXCircle className="text-xs" />
                    )}
                    {voter.hasVoted ? 'Voted' : 'Not Voted'}
                  </span>
                )} */}
              </div>

              {/* Tertiary Info Row */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {/* Phone */}
                {/* {voter.phone ? (
                  <span className="flex items-center gap-1">
                    <FiPhone className="text-xs" />
                    {formatPhone(voter.phone)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    <FiPhone className="text-xs" />
                    No Phone
                  </span>
                )} */}

                {/* Village/Location */}
                {/* {voter.village && (
                  <span className="flex items-center gap-1 truncate max-w-[100px]">
                    <FiMapPin className="text-xs" />
                    {voter.village}
                  </span>
                )} */}

                {/* Father Name */}
                {/* {voter.fatherName && (
                  <span className="hidden sm:inline">
                    S/O {voter.fatherName}
                  </span>
                )} */}
              </div>

              {/* Bottom Row - IDs */}
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                {voter.boothNumber && (
                  <span className="flex items-center bg-orange-100 gap-1 text-orange-500 px-1.5 py-0.5 rounded">
                    {/* <FiHome className="text-xs" /> */}
                    {voter.boothNumber}
                  </span>
                )}

                {/* Age & Gender */}
                {voter.age && (
                  <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                    {voter.age}y
                  </span>
                )}

                {voter.gender && (
                  <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded capitalize">
                    {voter.gender}
                  </span>
                )}
                {voter.voterId && (
                  <span>ID: {voter.voterId}</span>
                )}
                {voter.serialNumber && (
                  <span>Serial: {voter.serialNumber}</span>
                )}
              </div>
            </div>

            {/* Right Section - Action Button */}
            <button
              onClick={(e) => handleViewDetails(voter.id, e)}
              className="ml-2 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-150 flex-shrink-0"
              title="View Details"
            >
              <FiEye className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Address - Only show if available and space permits */}
          {(voter.pollingStationAddress || voter.yadiBhagAddress) && (
            <div className="mt-1 pt-1 border-t border-gray-100">
              <div className="flex items-start gap-1 text-xs text-gray-500">
                <FiMapPin className="text-orange-500 mt-0.5 flex-shrink-0 text-xs" />
                <span className="line-clamp-1">
                  {voter.pollingStationAddress || voter.yadiBhagAddress}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

VoterList.displayName = 'VoterList';

export default VoterList;