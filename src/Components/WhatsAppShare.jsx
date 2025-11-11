import React, { useState } from "react";

export default function WhatsAppShare() {
  const [caption, setCaption] = useState("");

  // 🔹 Fixed WhatsApp number (change this)
  const whatsappNumber = "8668722207";

  // 🔹 Fixed image (can also be base64: "data:image/png;base64,....")
  const imageUrl =
    "https://tse3.mm.bing.net/th/id/OIP.FEqv7YYMNjXtrVYqo7HHzAHaE7?cb=ucfimgc2&rs=1&pid=ImgDetMain&o=7&rm=3";

  // Convert base64/URL image to File
  async function getImageFile(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new File([blob], "share.png", { type: blob.type });
  }

  // Handle share button click
  const handleShare = async () => {
    try {
      const file = await getImageFile(imageUrl);
      const message = caption.trim() || "Default caption text";

      // ✅ Use Web Share API if available (works in PWA/mobile browsers)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Share via WhatsApp",
          text: message,
          files: [file],
        });
      } else {
        // ⚠️ Fallback: only send text if files unsupported
        const encodedMsg = encodeURIComponent(message);
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMsg}`, "_blank");
      }
    } catch (err) {
      console.error("Sharing failed:", err);
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
          src={imageUrl}
          alt="Preview"
          className="rounded-xl shadow-md w-full mb-4 border"
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Enter caption text..."
          className="w-full p-3 border rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none mb-4"
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
        </p>
      </div>
    </div>
  );
}
