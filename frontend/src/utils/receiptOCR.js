import Tesseract from 'tesseract.js';

/**
 * Run Tesseract OCR on an image (base64 data URL or file path).
 * @param {string} imageSource - base64 data URL
 * @param {function} onProgress - called with 0-100 progress value
 * @returns {string} raw extracted text
 */
export async function runOCR(imageSource, onProgress) {
  const { data: { text } } = await Tesseract.recognize(imageSource, 'eng', {
    logger: ({ status, progress }) => {
      if (status === 'recognizing text') {
        onProgress?.(Math.round(progress * 100));
      }
    }
  });
  return text;
}

/**
 * Parse raw OCR text from a restaurant/hotel receipt and extract line items.
 * Handles common Indian receipt formats (₹, Rs, GST, CGST, SGST lines).
 * @param {string} rawText
 * @returns {{ id: string, itemName: string, amount: number }[]}
 */
export function parseReceiptText(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 3);

  // Lines to skip (totals, taxes, headers, metadata)
  const SKIP_PATTERNS = [
    /^\s*total[:\s]*[\d₹]/i,            // "Total: 1139" or "Total ₹1139"
    /^\s*total\s*$/i,                    // just the word "Total"
    /\b(sub[\s\-]?total|grand total|net total|total amount|amount due|amount payable)\b/i,
    /\b(cgst|sgst|igst|vat|service tax|service charge|cess)\b/i,
    /\b(discount|round[\s\-]?off|cash|card|upi|online|paid|change|balance)\b/i,
    /\b(invoice|receipt|order|bill no|table|date|time|phone|mob|address|pin|gst no|gstin|fssai)\b/i,
    /\b(thank you|welcome|visit|please|customer copy|duplicate)\b/i,
    /\b(qty|quantity|item|price|rate|total)\b.*\b(qty|quantity|item|price|rate|total)\b/i, // header row
    /^[^a-zA-Z₹₨]*$/, // no letters or currency symbols at all
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // dates
    /^[0-9\s:\/\-\.,%]+$/, // pure numbers/punctuation
  ];

  const items = [];

  for (const line of lines) {
    if (SKIP_PATTERNS.some(p => p.test(line))) continue;

    // Match price at end of line.
    // Supports: ₹499, Rs.499, 499.00, 1,499.00, 1499
    const priceMatch = line.match(/[₹₨]?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/);
    if (!priceMatch) continue;

    const amountStr = priceMatch[1].replace(/,/g, '');
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0 || amount > 50000) continue;

    // Everything before the price is the item name
    const beforePrice = line.slice(0, line.lastIndexOf(priceMatch[0])).trim();

    // Clean up common OCR artifacts and qty markers (e.g. "x2", "2 x", "* 2", trailing numbers)
    let name = beforePrice
      .replace(/\s*[xX\*×]\s*\d+\s*$/, '')  // trailing "x2"
      .replace(/\s+\d+\s+[₹₨]?\d+.*$/, '')  // trailing "qty unitprice"
      .replace(/\s+\d{1,3}\s*$/, '')          // trailing standalone number (qty)
      .replace(/[|\\\/`~^]/g, ' ')             // OCR noise characters
      .replace(/\s+/g, ' ')
      .trim();

    // Must have at least 2 chars, must contain a letter, must not be only digits
    if (name.length < 2 || !/[a-zA-Z]/.test(name) || /^\d+$/.test(name)) continue;

    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);

    items.push({
      id: `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      itemName: name,
      amount
    });
  }

  return items;
}
