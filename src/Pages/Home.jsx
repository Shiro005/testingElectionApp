import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TranslatedText from '../Components/TranslatedText';
import { useCandidate } from '../Context/CandidateContext'; // ✅ Updated import

const Home = () => {
  const navigate = useNavigate();
  const [showBranding, setShowBranding] = useState(true);
  const { candidateInfo } = useCandidate();


  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBranding(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      id: 'search',
      title: 'Search',
      image: 'https://cdn-icons-gif.flaticon.com/15309/15309754.gif', // Replace with actual image path
      action: () => navigate('/search'),
    },
    {
      id: 'lists',
      title: 'Lists',
      image: 'https://cdn-icons-gif.flaticon.com/16875/16875019.gif', // Replace with actual image path
      action: () => navigate('/lists'),
    },
    {
      id: 'survey',
      title: 'Survey',
      image: 'https://cdn-icons-gif.flaticon.com/11677/11677519.gif', // Replace with actual image path
      action: () => navigate('/survey'),
    },
    {
      id: 'booth-management',
      title: 'Booths',
      image: 'https://cdn-icons-gif.flaticon.com/11186/11186810.gif', // Replace with actual image path
      action: () => navigate('/booths'),
    },
  ];

  const bottomFeatures = [
    {
      id: 'settings',
      title: 'Settings',
      image: 'https://cdn-icons-gif.flaticon.com/11186/11186733.gif', // Replace with actual image path
      action: () => navigate('/settings'),
    },
    {
      id: 'contact',
      title: 'Contact',
      image: 'https://cdn-icons-gif.flaticon.com/19018/19018390.gif', // Replace with actual image path
      action: () => navigate('/contact'),
    },
  ];

  if (showBranding) {
    return (
      <div className="flex items-center justify-center bg-white">
        <div className="w-full mt-10 mx-10 overflow-hidden rounded-lg shadow-lg flex justify-center">
          <img
            src={candidateInfo.mainFrontImage}
            alt="Campaign banner"
            loading="eager"
            className="max-w-full h-80vh object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    // Use a positioned full-bleed image so it's always visible at 100% opacity
    <div className="relative min-h-screen pb-8">
      {/* Full-bleed background image (opacity 100%) - replace URL with preferred image or local asset */}
      <img
        src="https://static.vecteezy.com/system/resources/thumbnails/029/752/340/small_2x/golden-corner-element-png.png"
        // src="https://media.tenor.com/EI4jixQMz7QAAAAd/day-night.gif"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover opacity-90 z-0 "
      />

      {/* Content container sits above the image */}
      <div className="relative z-10 min-h-screen pb-8">
        {/* Main Content */}
        <div className="max-w-md mx-auto mb-8 mt-3 px-4">
          <div className="rounded-md overflow-hidden shadow-2xl border-1 border-white/80">
            <img
              src={candidateInfo.mainWhatsappBrandingImage}
              alt="Political campaign"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
        <div className="pt-0 px-4">

          {/* Combined Features Grid (merged top + bottom) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto px-4">
            {([...features, ...bottomFeatures]).map((feature) => (
              <div
                key={feature.id}
                onClick={feature.action}
                className="group cursor-pointer transform transition-all duration-250 hover:scale-102 active:scale-98"
              >
                <div className="relative bg-white rounded-2xl shadow-lg border border-orange-200 p-4 pb-5 text-center hover:shadow-xl transition-all duration-200 hover:border-orange-300 h-full flex flex-col items-center justify-center backdrop-blur-sm overflow-hidden">
                  <div className="flex justify-center">
                    <div className="">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="w-15 h-15 object-contain bg-transparent"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          // show fallback as flex so it centers its content
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      {/* Fallback if image doesn't load */}
                      <div className="w-10 h-10 items-center justify-center text-orange-600 font-bold text-base hidden">
                        {feature.title.charAt(0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 font-sans">
                    <TranslatedText>{feature.title}</TranslatedText>
                  </div>

                  {/* Decorative bottom wave (matches brand) */}
                  <svg
                    className="absolute left-0 bottom-0 w-full h-8"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id={`grad-${feature.id}`} x1="0%" x2="100%" y1="0%" y2="0%">
                        <stop offset="0%" stopColor="#ff8a00" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#ff5e00" stopOpacity="0.95" />
                      </linearGradient>
                    </defs>
                    <path d="M0,0 C150,100 350,0 600,50 C850,100 1050,10 1200,80 L1200,120 L0,120 Z" fill={`url(#grad-${feature.id})`} />
                  </svg>
                </div>
              </div>

            ))}
          </div>

        </div>

        {/* Political Image Banner */}


        <footer className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[95%] md:w-auto">
          <div className="backdrop-blur-sm bg-white border border-white/30 shadow-lg w-auto rounded-full px-4 py-2 flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap select-none">
            <strong className="text-orange-500 font-semibold tracking-wide">
              <CandidateFooter />
            </strong>
          </div>
        </footer>

      </div>
    </div>
  );
};

// Separate component for footer to use candidate hook
const CandidateFooter = () => {
  const { candidateInfo } = useCandidate();
  return candidateInfo?.ReSellerName;
};

export default Home;