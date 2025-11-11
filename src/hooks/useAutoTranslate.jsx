import { useState, useCallback, useEffect } from 'react';

// Cache for translations to avoid repeated API calls
const translationCache = new Map();

const useAutoTranslate = () => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translating, setTranslating] = useState(false);

  const languages = [
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  ];

  // Improved translation function with caching
  const translateText = useCallback(async (text, targetLang) => {
    if (!text || targetLang === 'en') return text;

    const cacheKey = `${text}-${targetLang}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey);
    }

    try {
      setTranslating(true);
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      );

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      const translatedText = data[0][0][0] || text;

      // Cache the translation
      translationCache.set(cacheKey, translatedText);
      return translatedText;
    } catch (error) {
      console.warn('Translation failed for:', text, error);
      return text;
    } finally {
      setTranslating(false);
    }
  }, []);

  // Batch translation for multiple texts
  const translateMultiple = useCallback(async (texts, targetLang) => {
    if (targetLang === 'en') return texts;

    const translatedTexts = [];
    for (const text of texts) {
      const translated = await translateText(text, targetLang);
      translatedTexts.push(translated);
    }
    return translatedTexts;
  }, [translateText]);

  const changeLanguage = async (langCode) => {
    if (langCode === currentLanguage) return;

    setCurrentLanguage(langCode);
    localStorage.setItem('preferredLanguage', langCode);

    // Clear cache when language changes
    translationCache.clear();

    // Force re-render of all components
    window.location.reload();
  };

  // Enhanced useAutoTranslate hook (if you can modify it)
  const useEnhancedAutoTranslate = () => {
    const { currentLanguage, translateText, translating } = useAutoTranslate();

    const smartTranslateText = useCallback(async (text, targetLanguage) => {
      if (!text || typeof text !== 'string') return text;

      // Skip translation if text doesn't need it
      if (!needsTranslation(text, targetLanguage)) {
        return text;
      }

      return await translateText(text, targetLanguage);
    }, [translateText]);

    return {
      currentLanguage,
      translateText: smartTranslateText,
      translating
    };
  };

  useEffect(() => {
    const savedLang = localStorage.getItem('preferredLanguage') || 'en';
    setCurrentLanguage(savedLang);
  }, []);

  return {
    currentLanguage,
    languages,
    changeLanguage,
    translateText,
    translateMultiple,
    translating
  };
};

export default useAutoTranslate; 