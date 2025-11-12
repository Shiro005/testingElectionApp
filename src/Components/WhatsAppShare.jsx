import React, { useState } from "react";

export default function WhatsAppShare() {
  const [caption, setCaption] = useState("");
  const [number, setNumber] = useState("8668722207");

  // 🔹 Host your image (can be on localhost, Cloudinary, Firebase Storage, etc.)
  const hostedImageURL =
    "https://yourdomain.com/uploads/share-image.png"; // change this

  // Convert hosted/base64 image to File
  async function getImageFile(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], "share.png", { type: blob.type });
  }

  const handleShare = async () => {
    const message =
      caption.trim() ||
      `Hello! Check out this image 👉 ${hostedImageURL}`;

    try {
      const file = await getImageFile(hostedImageURL);

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Share via WhatsApp",
          text: message,
          files: [file],
        });
      } else {
        // 📞 Direct WhatsApp text fallback (no image)
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/${number}?text=${encoded}`, "_blank");
      }
    } catch (err) {
      console.error("Share failed:", err);
      alert("Sharing not supported on this device.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 px-4">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-orange-600 mb-4">
          📤 Share Image + Caption
        </h2>

        <img
          src={hostedImageURL}
          alt="Preview"
          className="rounded-xl shadow-md w-full mb-4 border"
        />

        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Enter WhatsApp number"
          className="w-full mb-3 p-2 border rounded-xl text-gray-700 focus:ring-2 focus:ring-orange-400"
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Enter caption text..."
          className="w-full p-3 border rounded-xl text-gray-700 focus:ring-2 focus:ring-orange-400 resize-none mb-4"
          rows="3"
        />

        <button
          onClick={handleShare}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 w-full"
        >
          <span>📱 Share on WhatsApp</span>
        </button>

        <p className="text-sm text-gray-500 mt-3">
          Works best on mobile or installed PWA.  
          (Direct image + caption sending to number needs WhatsApp API.)
        </p>
      </div>
    </div>
  );
}
