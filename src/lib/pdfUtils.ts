
"use client"; // This utility will be used client-side

import * as pdfjsLib from 'pdfjs-dist';

// Set workerSrc to point to a CDN-hosted version of pdf.worker.min.js.
if (typeof window !== 'undefined') {
  // Using a CDN-hosted version to avoid issues with local file serving.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
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
