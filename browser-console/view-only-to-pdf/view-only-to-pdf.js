/**
 * view-only-to-pdf
 *
 * Paste into the browser console (DevTools) on a document viewer that renders
 * its pages as blob: images. It captures each page while you scroll, then
 * builds PDF files from them. No external libraries needed.
 *
 * Usage:
 *   1. Paste this script and press Enter.
 *   2. Scroll slowly through the whole document.
 *   3. pdfStatus()          -> how many pages were captured
 *   4. pdfSave()            -> download in parts of 10 pages
 *      pdfSave(20)          -> parts of 20 pages
 *      pdfSave(Infinity)    -> a single PDF
 *
 * Use only on documents you own or have permission to copy.
 * Provided as is, without warranty. See the LICENSE file.
 */
(() => {
  clearInterval(window.__pdfTimer);
  const pages = new Map(); // src -> { pos, w, h, bytes }
  let scroller = null;

  const blobImgs = () =>
    Array.from(document.getElementsByTagName("img")).filter((img) =>
      img.src.startsWith("blob:")
    );

  // Find the element that actually scrolls (a container or the whole page)
  const findScroller = (img) => {
    for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) return el;
    }
    return document.scrollingElement;
  };

  let busy = false;
  const capture = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const img of blobImgs()) {
        if (pages.has(img.src) || !img.complete || !img.naturalWidth) continue;
        scroller = scroller || findScroller(img);
        // Position in the document, so pages end up in order however you scroll
        const pos = img.getBoundingClientRect().top + scroller.scrollTop;
        const w = img.naturalWidth;
        const h = img.naturalHeight;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; // avoid a black background on transparent images
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
        pages.set(img.src, { pos, w, h, bytes: new Uint8Array(await blob.arrayBuffer()) });
        console.log(`Captured page ${pages.size}`);
      }
    } finally {
      busy = false;
    }
  };
  window.__pdfTimer = setInterval(capture, 500);

  // Builds a PDF by hand, embedding the JPEG data directly
  const buildPdf = (list) => {
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let len = 0;
    const push = (d) => {
      const b = typeof d === "string" ? enc.encode(d) : d;
      chunks.push(b);
      len += b.length;
    };

    // Objects: 1 = catalog, 2 = page tree, then 3 per page (page, content, image)
    const pageNum = (i) => 3 + 3 * i;
    const kids = list.map((_, i) => `${pageNum(i)} 0 R`).join(" ");

    push("%PDF-1.4\n");
    offsets[1] = len;
    push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    offsets[2] = len;
    push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${list.length} >>\nendobj\n`);

    list.forEach((p, i) => {
      const pg = pageNum(i);
      const content = pg + 1;
      const image = pg + 2;
      const stream = `q ${p.w} 0 0 ${p.h} 0 0 cm /Im0 Do Q`;

      offsets[pg] = len;
      push(
        `${pg} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] ` +
          `/Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>\nendobj\n`
      );

      offsets[content] = len;
      push(`${content} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

      offsets[image] = len;
      push(
        `${image} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`
      );
      push(p.bytes);
      push("\nendstream\nendobj\n");
    });

    const total = 3 + 3 * list.length;
    const xrefPos = len;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let n = 1; n < total; n++) xref += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    push(xref + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

    return new Blob(chunks, { type: "application/pdf" });
  };

  const download = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  window.pdfSave = async (size = 10) => {
    await capture();
    const list = [...pages.values()].sort((a, b) => a.pos - b.pos);
    if (!list.length) return console.warn("Nothing captured yet.");
    const parts = Math.max(1, Math.ceil(list.length / size));
    for (let i = 0; i < parts; i++) {
      const slice = list.slice(i * size, (i + 1) * size);
      const name =
        parts === 1
          ? "document.pdf"
          : `document-part${i + 1}-pages${i * size + 1}-${i * size + slice.length}.pdf`;
      download(buildPdf(slice), name);
      console.log(`Saved ${name}`);
      await new Promise((r) => setTimeout(r, 800)); // spacing so the browser allows several downloads
    }
  };

  window.pdfStatus = () => console.log(`${pages.size} page(s) captured.`);

  console.log("Collector running. Scroll through the whole document, then run pdfSave().");
})();
