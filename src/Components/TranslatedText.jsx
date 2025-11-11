import React, { useState, useEffect, useCallback } from 'react';
import useAutoTranslate from '../hooks/useAutoTranslate.jsx';

// Helper function to detect if text contains Devanagari characters (Hindi/Marathi)
const containsDevanagari = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /[\u0900-\u097F]/.test(text);
};

// Helper function to check if translation is needed
const needsTranslation = (text, currentLanguage) => {
  if (!text || typeof text !== 'string') return false;
  
  // If current language is English and text contains Devanagari, translate to English
  if (currentLanguage === 'en' && containsDevanagari(text)) {
    return true;
  }
  
  // If current language is Hindi/Marathi and text contains Devanagari, no translation needed
  if ((currentLanguage === 'hi' || currentLanguage === 'mr') && containsDevanagari(text)) {
    return false;
  }
  
  // If current language is not English and text contains Devanagari, translate to current language
  if (currentLanguage !== 'en' && containsDevanagari(text)) {
    return true;
  }
  
  // For other cases, use default translation logic
  return currentLanguage !== 'en';
};

const TranslatedText = ({ children, className = '', asText = false, forceTranslate = false }) => {
  const [translatedText, setTranslatedText] = useState(children);
  const [isTranslating, setIsTranslating] = useState(false);
  const { currentLanguage, translateText } = useAutoTranslate();

  const translateContent = useCallback(async (text, targetLanguage) => {
    if (!text || typeof text !== 'string') return text;
    
    try {
      setIsTranslating(true);
      const translated = await translateText(text, targetLanguage);
      return translated;
    } catch (error) {
      console.error('Translation failed:', error);
      return text; // Return original text on failure
    } finally {
      setIsTranslating(false);
    }
  }, [translateText]);

  useEffect(() => {
    let mounted = true;

    const processTranslation = async () => {
      if (!children) {
        if (mounted) setTranslatedText(children);
        return;
      }

      // Convert children to string for processing
      const textContent = String(children);
      
      // Check if translation is needed
      const shouldTranslate = forceTranslate || needsTranslation(textContent, currentLanguage);

      if (shouldTranslate) {
        if (mounted) setIsTranslating(true);
        
        const translated = await translateContent(textContent, currentLanguage);
        
        if (mounted) {
          setTranslatedText(translated);
          setIsTranslating(false);
        }
      } else {
        // No translation needed, use original text
        if (mounted) {
          setTranslatedText(textContent);
          setIsTranslating(false);
        }
      }
    };

    processTranslation();

    return () => {
      mounted = false;
    };
  }, [children, currentLanguage, forceTranslate, translateContent]);

  // Determine what content to display
  const getContent = () => {
    if (isTranslating) {
      return 'Translating...';
    }
    
    if (!translatedText && translatedText !== 0) {
      return '';
    }
    
    return translatedText;
  };

  const content = getContent();

  if (asText) return content;

  return (
    <span className={className}>
      {content}
    </span>
  );
};

export default TranslatedText;