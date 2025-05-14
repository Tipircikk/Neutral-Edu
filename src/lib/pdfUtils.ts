
"use client"; // This utility will be used client-side

// IMPORTANT: Manually copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` 
// to your `public` folder and rename it to `pdf.worker.min.js` or ensure it's accessible via `/pdf.worker.min.js`.
// Alternatively, you can configure your build process to do this.

import * as pdfjsLib from 'pdfjs-dist';

// Set workerSrc to point to where pdf.worker.min.js is served from.
// Assuming it's in the public folder.
if (typeof window !== 'undefined') {
  // pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  // Using a local copy is preferred for stability and offline capability if needed.
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}


export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => {
      if ('str' in item) { // Type guard for TextItem
        return item.str;
      }
      return '';
    }).join(" ");
    fullText += pageText + "\n\n"; // Add double newline between pages
  }

  return fullText.trim();
}
