// ImageUtils.js
/**
 * Utility functions for image handling
 */

/**
 * Get image as blob from public URL
 */
export const getImageBlob = async (imagePath) => {
  try {
    const response = await fetch(imagePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Error getting image blob:', error);
    throw error;
  }
};

/**
 * Convert image to base64 for fallback sharing
 */
export const imageToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};