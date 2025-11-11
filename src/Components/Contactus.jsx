import React, { useState } from 'react';
import TranslatedText from './TranslatedText';
import { FiMail, FiPhone, FiMapPin, FiGlobe, FiMessageCircle } from 'react-icons/fi';

const Contactus = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically handle the form submission
    setSubmitted(true);
    // Reset form after submission
    setFormData({
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: ''
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const faqs = [
    {
      question: 'What services does WebReich Solutions provide?',
      answer: 'WebReich Solutions offers comprehensive PR services, digital marketing, technology solutions, web development, and IT consulting services.'
    },
    {
      question: 'Where is WebReich Solutions located?',
      answer: 'We are located in Nagpur, Maharashtra, India, with our main office in the heart of the city.'
    },
    {
      question: 'How can I request a quote for services?',
      answer: 'You can request a quote by filling out our contact form, calling us directly, or sending us an email. We\'ll respond within 24 hours.'
    },
    {
      question: 'What are your working hours?',
      answer: 'Our office is open Monday through Friday, 9:00 AM to 6:00 PM IST. We also provide 24/7 support for urgent matters.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Company Information Section */}
      <div className="max-w-7xl mx-auto">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              <TranslatedText>Our Contact Information</TranslatedText>
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FiMapPin className="text-orange-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    <TranslatedText>Office Address</TranslatedText>
                  </h3>
                  <p className="text-gray-600 mt-1">
                    <TranslatedText>VodafoneIdea Gallery, GMD Market, Shop Number 12, Opposite Tongse Hospital, Ranpise Nagar</TranslatedText><br />
                    <TranslatedText>Akola, Maharashtra 444001</TranslatedText><br />
                    <TranslatedText>India</TranslatedText>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiPhone className="text-blue-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    <TranslatedText>Phone</TranslatedText>
                  </h3>
                  <p className="text-gray-600 mt-1">+91 9689918086</p>
                  <p className="text-gray-600 mt-1">+91 7391913935</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiMail className="text-green-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    <TranslatedText>Email</TranslatedText>
                  </h3>
                  <p className="text-gray-600 mt-1">pravinrulhe35@gmail.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FiGlobe className="text-purple-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    <TranslatedText>Website</TranslatedText>
                  </h3>
                  <p className="text-gray-600 mt-1">theprservices.com</p>
                  <p className="text-gray-600 mt-1">webreich.vercel.app</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              <TranslatedText>Send us a Message</TranslatedText>
            </h2>

            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <FiMessageCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  <TranslatedText>Thank you for contacting us!</TranslatedText>
                </h3>
                <p className="text-green-700">
                  <TranslatedText>We'll get back to you soon.</TranslatedText>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <TranslatedText>Name</TranslatedText>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <TranslatedText>Email</TranslatedText>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <TranslatedText>Phone</TranslatedText>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <TranslatedText>Subject</TranslatedText>
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <TranslatedText>Message</TranslatedText>
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-500 text-white py-3 px-6 rounded-lg hover:bg-orange-600 transition-all duration-200 font-medium"
                >
                  <TranslatedText>Send Message</TranslatedText>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            <TranslatedText>Frequently Asked Questions</TranslatedText>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-3">
                  <TranslatedText>{faq.question}</TranslatedText>
                </h3>
                <p className="text-gray-600">
                  <TranslatedText>{faq.answer}</TranslatedText>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contactus;