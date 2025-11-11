import html2canvas from 'html2canvas';

// named export (FullVoterDetails imports { PrintService })
export const PrintService = {
  // htmlString: full HTML string to render and print
  printContent: async (htmlString, characteristic = null, opts = {}) => {
    const printDiv = document.createElement('div');
    // hide offscreen so html2canvas can render
    printDiv.style.position = 'fixed';
    printDiv.style.left = '-9999px';
    printDiv.style.top = '0';
    printDiv.style.width = '380px'; // match narrow receipt width
    printDiv.innerHTML = htmlString;
    document.body.appendChild(printDiv);

    try {
      const canvas = await html2canvas(printDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        ...opts
      });

      // If no BLE characteristic provided, open preview window (useful during dev)
      if (!characteristic) {
        const dataUrl = canvas.toDataURL('image/png');
        const w = window.open('');
        if (w) {
          w.document.write(`<img src="${dataUrl}" style="width:100%"/>`);
          w.document.close();
          w.focus();
        } else {
          console.warn('Popup blocked - cannot preview print image.');
        }
        return true;
      }

      const escImage = PrintService.canvasToEscPosRaster(canvas);
      await PrintService.sendToPrinter(escImage, characteristic);
      return true;
    } catch (err) {
      console.error('PrintService.printContent error:', err);
      throw err;
    } finally {
      document.body.removeChild(printDiv);
    }
  },

  // Convert canvas pixels to ESC/POS raster format (GS v 0)
  canvasToEscPosRaster: (canvas) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const widthBytes = Math.ceil(width / 8);
    const imageData = ctx.getImageData(0, 0, width, height).data;
    const raster = new Uint8Array(widthBytes * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2], a = imageData[i + 3];
        // alpha-aware luminance
        const lum = a === 0 ? 255 : (0.299 * r + 0.587 * g + 0.114 * b);
        if (lum < 160) { // threshold - adjust if needed
          const byteIndex = y * widthBytes + (x >> 3);
          raster[byteIndex] |= (0x80 >> (x % 8));
        }
      }
    }

    // ESC/POS raster header: GS v 0 m xL xH yL yH <data>
    const header = [0x1D, 0x76, 0x30, 0x00];
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    const command = new Uint8Array(header.length + 4 + raster.length);
    let offset = 0;
    command.set(header, offset); offset += header.length;
    command[offset++] = xL;
    command[offset++] = xH;
    command[offset++] = yL;
    command[offset++] = yH;
    command.set(raster, offset);

    return command;
  },

  // Send bytes to BLE characteristic in safe chunks
  sendToPrinter: async (escData, characteristic) => {
    const init = new Uint8Array([0x1B, 0x40]); // initialize
    const center = new Uint8Array([0x1B, 0x61, 0x01]); // center
    const feed = new Uint8Array([0x0A, 0x0A, 0x0A]);
    const cut = new Uint8Array([0x1D, 0x56, 0x00]);

    const full = new Uint8Array(init.length + center.length + escData.length + feed.length + cut.length);
    let off = 0;
    full.set(init, off); off += init.length;
    full.set(center, off); off += center.length;
    full.set(escData, off); off += escData.length;
    full.set(feed, off); off += feed.length;
    full.set(cut, off);

    const CHUNK = 180; // safe BLE MTU chunk
    for (let i = 0; i < full.length; i += CHUNK) {
      const chunk = full.slice(i, i + CHUNK);
      try {
        await characteristic.writeValue(chunk);
        // small delay helps some printers
        await new Promise(r => setTimeout(r, 40));
      } catch (err) {
        console.error('Error writing chunk to printer:', err);
        throw err;
      }
    }
  }
};