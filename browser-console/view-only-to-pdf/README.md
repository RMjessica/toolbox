# view-only-to-pdf

*A browser-console script that saves the pages shown in a view-only document viewer as PDF files. It needs no external libraries.*

---

## How it works

Many viewers show each page as an `<img>` with a `blob:` URL and only keep the pages near your scroll position.

The script:

1. Watches the page and captures every `blob:` image as it loads while you scroll.
2. Converts each image to a JPEG at its original resolution.
3. Remembers each page’s position in the document, so the order is correct even if you scroll back up or skip around.
4. Builds the PDF itself by embedding the JPEG data, so nothing has to be injected into the page. This avoids CSP and Trusted Types errors that block library loading. Each PDF page matches its image size.

## Usage

1. Open the document and let the first page load.
2. Open DevTools, go to the Console, paste [`view-only-to-pdf.js`](view-only-to-pdf.js) and press Enter.
3. Scroll slowly through the whole document. The console prints `Captured page N` for each page.
4. **Check the count:**

   ```js
   pdfStatus()
   ```

5. **Save:**

   ```js
   pdfSave()          // parts of 10 pages
   pdfSave(20)        // parts of 20 pages
   pdfSave(Infinity)  // one single PDF
   ```

   Parts are named like `document-part2-pages11-20.pdf`. Allow multiple downloads if the browser asks.

## Notes

- Call the functions with parentheses. `pdfSave` alone only prints its source.
- Reloading the page clears the captured pages. Paste the script again after a reload.
- Scroll slowly. Pages the viewer has not rendered yet can be missed, so compare `pdfStatus()` with the real page count.
- The output is re-encoded as JPEG (quality 0.92). It has no selectable text.
- Some viewers swap an image’s `src` when they re-render at a higher resolution, which can cause duplicate pages.
- An error like `A listener indicated an asynchronous response...` in the console comes from a browser extension, not from this script.
- Parts can be merged into one PDF with any PDF merge tool.

## Disclaimer

Use only on documents you own or have permission to copy. Provided as is, without warranty. See the [MIT License](../../LICENSE).