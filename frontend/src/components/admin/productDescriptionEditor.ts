export function descriptionHtmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .trim();
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('br').forEach((element) => element.replaceWith('\n'));
  document.querySelectorAll('strong, b').forEach((element) => {
    element.replaceWith(`**${element.textContent || ''}**`);
  });
  document.querySelectorAll('em, i').forEach((element) => {
    element.replaceWith(`*${element.textContent || ''}*`);
  });
  document.querySelectorAll('li').forEach((element) => {
    element.replaceWith(`• ${element.textContent || ''}\n`);
  });
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((element) => {
    element.replaceWith(`### ${element.textContent || ''}\n`);
  });
  document.querySelectorAll('p, div').forEach((element) => {
    element.append('\n\n');
  });

  return (document.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function descriptionTextToHtml(text: string): string {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = text.split(/\r?\n/);
  const output: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      output.push(`<ul>${listItems.join('')}</ul>`);
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^(?:•|-)\s+(.+)$/);
    if (bullet) {
      listItems.push(`<li>${formatInline(escapeHtml(bullet[1]))}</li>`);
      continue;
    }

    flushList();
    if (!trimmed) continue;

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      output.push(`<h3>${formatInline(escapeHtml(heading[1]))}</h3>`);
    } else {
      output.push(`<p>${formatInline(escapeHtml(trimmed))}</p>`);
    }
  }

  flushList();
  return output.join('\n');
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
