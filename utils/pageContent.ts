// utils/pageContent.ts
export function extractPageContent(max = 4000): string {
  // 1. prendi se c’è <main>, altrimenti tutto <body>
  const root = document.querySelector('main') ?? document.body;
  if (!root) return '';

  // 2. innerText conserva già i line-break visivi
  let txt = root.innerText
    .replace(/\u00A0/g, ' ')   // nbsp → spazio normale
    .replace(/\s+\n/g, '\n')   // spazi prima di \n
    .replace(/\n{3,}/g, '\n\n')// massimo 2 newline consecutivi
    .trim();

  if (txt.length > max) txt = txt.slice(0, max) + ' …';
  return txt;
}