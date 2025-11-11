import React from 'react';
import TranslatedText from './TranslatedText';

const Setting = () => {
  const appPolicies = [
    {
      id: 1,
      title: "Privacy Policy",
      content: "We are committed to protecting your personal information and ensuring the security of all voting data. All votes are anonymous and cannot be traced back to individual voters.",
      icon: "🔒"
    },
    {
      id: 2,
      title: "Terms of Service",
      content: "By using this application, you agree to comply with all applicable laws and regulations. Any attempt to manipulate election results will result in immediate account termination.",
      icon: "📝"
    },
    {
      id: 3,
      title: "Security Measures",
      content: "Our platform uses end-to-end encryption, multi-factor authentication, and regular security audits to ensure the integrity of every election process.",
      icon: "🛡️"
    },
    {
      id: 4,
      title: "Data Retention",
      content: "Election data is stored securely for audit purposes as required by law. Personal voter information is minimized and protected according to data protection regulations.",
      icon: "💾"
    }
  ];

  const appRules = [
    "One vote per verified user per election",
    "Election results are final once published",
    "Campaigning through the app is prohibited",
    "All users must verify their identity",
    "Admins are responsible for election integrity",
    "Real-time monitoring and audit trails",
    "Secure encrypted data transmission",
    "Regular system updates and maintenance"
  ];

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Demo Notice Banner */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 mb-8 shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="text-3xl text-orange-500">🚀</div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                <TranslatedText>Demo Version</TranslatedText>
              </h3>
              <p className="text-gray-700 text-lg">
                <TranslatedText>
                  This is a demonstration version. Settings functionality is not available in the trial version. 
                  Please upgrade to the full version to access all features and customization options.
                </TranslatedText>
              </p>
            </div>
            <div className="hidden md:block">
              <div className="bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-semibold">
                <TranslatedText>Trial Version</TranslatedText>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* App Information Section */}
            <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-orange-500">
                <TranslatedText>About Election Management App</TranslatedText>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-300 border border-gray-200">
                  <div className="text-4xl mb-4">🛡️</div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3">
                    <TranslatedText>Secure & Reliable</TranslatedText>
                  </h4>
                  <p className="text-gray-600">
                    <TranslatedText>Enterprise-grade security with military-grade encryption for your election processes</TranslatedText>
                  </p>
                </div>
                <div className="text-center p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-300 border border-gray-200">
                  <div className="text-4xl mb-4">⚡</div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3">
                    <TranslatedText>Fast & Efficient</TranslatedText>
                  </h4>
                  <p className="text-gray-600">
                    <TranslatedText>Streamlined voting experience with real-time results and instant notifications</TranslatedText>
                  </p>
                </div>
                <div className="text-center p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-300 border border-gray-200">
                  <div className="text-4xl mb-4">🔍</div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3">
                    <TranslatedText>Transparent</TranslatedText>
                  </h4>
                  <p className="text-gray-600">
                    <TranslatedText>Complete audit trails, verifiable results, and comprehensive reporting</TranslatedText>
                  </p>
                </div>
              </div>
            </section>

            {/* Policies Section */}
            <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-orange-500">
                <TranslatedText>App Policies & Guidelines</TranslatedText>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {appPolicies.map(policy => (
                  <div 
                    key={policy.id} 
                    className="bg-gray-50 p-6 rounded-xl border border-gray-200 hover:border-orange-300 transition-all duration-300"
                  >
                    <div className="flex items-center mb-4">
                      <span className="text-2xl mr-3">{policy.icon}</span>
                      <h4 className="text-xl font-semibold text-gray-900">
                        <TranslatedText>{policy.title}</TranslatedText>
                      </h4>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      <TranslatedText>{policy.content}</TranslatedText>
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Rules Section */}
            <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-orange-500">
                <TranslatedText>Rules & Guidelines</TranslatedText>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appRules.map((rule, index) => (
                  <div 
                    key={index} 
                    className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-300 border border-gray-200"
                  >
                    <span className="text-orange-500 text-xl mr-3">•</span>
                    <span className="text-gray-700 font-medium">
                      <TranslatedText>{rule}</TranslatedText>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Feature Access Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-orange-200">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4 text-orange-500">🔒</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  <TranslatedText>Full Access Required</TranslatedText>
                </h3>
                <p className="text-gray-600">
                  <TranslatedText>Settings and customization features are available in the full version</TranslatedText>
                </p>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="text-lg font-semibold text-gray-900 mb-2">
                    <TranslatedText>Current Version</TranslatedText>
                  </div>
                  <div className="text-orange-600 font-bold text-xl">
                    <TranslatedText>Demo Trial</TranslatedText>
                  </div>
                </div>
              </div>

              <button className="w-full bg-orange-500 text-white font-semibold py-3 px-6 rounded-xl hover:bg-orange-600 transition-colors duration-300 border border-orange-500">
                <TranslatedText>Learn About Full Version</TranslatedText>
              </button>
            </div>

            {/* Support Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <div className="text-center">
                <div className="text-3xl mb-4 text-gray-600">💬</div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">
                  <TranslatedText>Need Assistance?</TranslatedText>
                </h4>
                <p className="text-gray-600 mb-4">
                  <TranslatedText>Our team is here to help you with any questions</TranslatedText>
                </p>
                <button className="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors duration-300 border border-gray-300">
                  <TranslatedText>Contact Support</TranslatedText>
                </button>
              </div>
            </div>

            {/* Platform Info Card */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <div className="text-center">
                <div className="text-3xl mb-4 text-gray-600">🏢</div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">
                  <TranslatedText>Platform Information</TranslatedText>
                </h4>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span><TranslatedText>Version</TranslatedText></span>
                    <span className="font-medium">2.1.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span><TranslatedText>Status</TranslatedText></span>
                    <span className="font-medium text-orange-600">
                      <TranslatedText>Trial Active</TranslatedText>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span><TranslatedText>Last Updated</TranslatedText></span>
                    <span className="font-medium">2024-01-15</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Information */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              <TranslatedText>Professional Election Management</TranslatedText>
            </h3>
            <p className="text-gray-600 mb-6 text-lg">
              <TranslatedText>
                Experience the full capabilities of our enterprise-grade election management platform 
                with the complete version featuring advanced settings and customization options.
              </TranslatedText>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-orange-500 text-white font-semibold py-3 px-6 rounded-xl hover:bg-orange-600 transition-colors duration-300 border border-orange-500">
                <TranslatedText>Request Full Version Demo</TranslatedText>
              </button>
              <button className="border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-50 transition-colors duration-300">
                <TranslatedText>View Documentation</TranslatedText>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setting;