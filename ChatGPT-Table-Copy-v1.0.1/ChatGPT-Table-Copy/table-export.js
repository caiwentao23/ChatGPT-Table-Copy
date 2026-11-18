/* ChatGPT Table Copy · MIT License · No network or clipboard reads. */
(() => {
  'use strict';
  if (globalThis.ChatGPTTableCopy) return;

  const OMIT = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT',
    'SVG', 'IMG', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS', 'NOSCRIPT', 'TEMPLATE', 'VIDEO', 'AUDIO']);
  const KEEP = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION',
    'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'SUP', 'SUB', 'CODE', 'PRE', 'KBD',
    'BR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE']);
  const BLOCK = new Set(['P', 'DIV', 'UL', 'OL', 'LI', 'PRE', 'BLOCKQUOTE', 'TR']);
  const FONT = 'Calibri, "Microsoft YaHei", Arial, sans-serif';

  function excluded(node) {
    return OMIT.has(node.tagName) || node.hasAttribute('hidden') ||
      node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('data-cgtc-toolbar');
  }

  function cleanNode(node, doc) {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE || excluded(node)) return doc.createDocumentFragment();
    const tag = KEEP.has(node.tagName) ? node.tagName.toLowerCase() : 'span';
    const target = doc.createElement(tag);
    for (const child of node.childNodes) target.append(cleanNode(child, doc));

    if (tag === 'table') {
      target.setAttribute('border', '1');
      target.setAttribute('cellpadding', '0');
      target.setAttribute('cellspacing', '0');
      target.setAttribute('width', '100%');
      target.style.cssText = `border-collapse:collapse;border-spacing:0;width:100%;border:1px solid #808080;background-color:#ffffff;color:#000000;font-family:${FONT};font-size:11pt;line-height:1.4;mso-table-lspace:0pt;mso-table-rspace:0pt;`;
    } else if (tag === 'th' || tag === 'td') {
      for (const name of ['colspan', 'rowspan']) {
        if (!node.hasAttribute(name)) continue;
        let value = Number.parseInt(node.getAttribute(name), 10);
        if (name === 'rowspan' && value === 0) {
          value = node.parentElement.parentElement.rows.length - node.parentElement.sectionRowIndex;
        }
        if (Number.isFinite(value) && value > 1) target.setAttribute(name, String(Math.min(value, 1000)));
      }
      const alignment = node.style.textAlign || node.getAttribute('align');
      const align = ['left', 'right', 'center', 'justify'].includes(alignment) ? alignment : 'left';
      const heading = tag === 'th';
      target.style.cssText = `border:1px solid #808080;padding:6pt 8pt;vertical-align:top;text-align:${align};background-color:${heading ? '#f2f2f2' : '#ffffff'};color:#000000;font-family:${FONT};font-size:11pt;line-height:1.4;font-weight:${heading ? 'bold' : 'normal'};`;
    } else if (tag === 'a') {
      try {
        const address = new URL(node.getAttribute('href') || '', node.baseURI);
        if (node.hasAttribute('href') && ['http:', 'https:', 'mailto:'].includes(address.protocol)) {
          target.setAttribute('href', address.href);
          target.style.cssText = 'color:#0563c1;text-decoration:underline;';
        }
      } catch { /* Keep the readable label when a link is invalid. */ }
    } else if (['p', 'div', 'blockquote'].includes(tag)) {
      target.style.cssText = 'margin:0 0 4pt 0;';
    } else if (['code', 'kbd', 'pre'].includes(tag)) {
      target.style.cssText = 'font-family:Consolas,monospace;font-size:10pt;white-space:pre-wrap;color:#000000;background-color:#f5f5f5;';
    } else if (tag === 'ul' || tag === 'ol') {
      target.style.cssText = 'margin:0;padding-left:18pt;';
      if (tag === 'ol' && /^\d{1,6}$/.test(node.getAttribute('start') || '')) target.setAttribute('start', node.getAttribute('start'));
    }
    return target;
  }

  function textOf(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/[\t\r\n ]+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE || excluded(node)) return '';
    if (node.tagName === 'BR') return '\n';
    const value = Array.from(node.childNodes, textOf).join('');
    return BLOCK.has(node.tagName) ? `\n${value}\n` : value;
  }

  function tableText(table) {
    const rows = Array.from(table.rows);
    const grid = rows.map(() => []);
    rows.forEach((row, rowIndex) => {
      let column = 0;
      for (const cell of row.cells) {
        while (grid[rowIndex][column] !== undefined) column++;
        const spanRows = Math.min(cell.rowSpan === 0 ? rows.length - rowIndex : cell.rowSpan, rows.length - rowIndex);
        const spanColumns = cell.colSpan;
        for (let r = rowIndex; r < rowIndex + spanRows; r++) {
          for (let c = column; c < column + spanColumns; c++) grid[r][c] = '';
        }
        grid[rowIndex][column] = textOf(cell).split('\n').map(part => part.replace(/\s+/g, ' ').trim())
          .filter(Boolean).join(' / ');
        column += spanColumns;
      }
    });
    const width = Math.max(0, ...grid.map(row => row.length));
    return grid.map(row => Array.from({length: width}, (_, i) => row[i] || '').join('\t')).join('\r\n');
  }

  function serializeTable(table) {
    if (!table || table.tagName !== 'TABLE') throw new TypeError('请选择一个表格。');
    const doc = document.implementation.createHTMLDocument('');
    doc.documentElement.lang = 'zh-CN';
    const charset = doc.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    doc.head.prepend(charset);
    doc.body.style.cssText = `margin:0;color:#000000;background-color:#ffffff;font-family:${FONT};font-size:11pt;`;
    doc.body.append(cleanNode(table, doc));
    return {html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML, text: tableText(table)};
  }

  function legacyCopy(data) {
    const selection = window.getSelection();
    if (!selection || !document.body) throw new Error('当前页面无法复制表格。');
    const ranges = Array.from({length: selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange());
    const active = document.activeElement;
    const box = document.createElement('div');
    box.setAttribute('data-cgtc-clipboard', '');
    box.contentEditable = 'true';
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;pointer-events:none;';
    // Only sanitized, locally constructed table markup enters this temporary element.
    box.append(...new DOMParser().parseFromString(data.html, 'text/html').body.childNodes);
    let wrote = false;
    const onCopy = event => {
      if (!event.clipboardData) return;
      event.clipboardData.setData('text/html', data.html);
      event.clipboardData.setData('text/plain', data.text);
      event.preventDefault();
      wrote = true;
    };
    document.addEventListener('copy', onCopy, true);
    try {
      document.body.append(box);
      box.focus({preventScroll: true});
      const range = document.createRange();
      range.selectNodeContents(box);
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand('copy') || !wrote) throw new Error('复制未完成。');
    } finally {
      document.removeEventListener('copy', onCopy, true);
      box.remove();
      selection.removeAllRanges();
      for (const range of ranges) {
        if (range.commonAncestorContainer.isConnected) selection.addRange(range);
      }
      if (active?.isConnected && typeof active.focus === 'function') active.focus({preventScroll: true});
    }
  }

  async function copyTable(table) {
    const data = serializeTable(table);
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([data.html], {type: 'text/html'}),
          'text/plain': new Blob([data.text], {type: 'text/plain'})
        })]);
        return;
      } catch { /* A native copy event is the compatibility fallback, with both formats. */ }
    }
    legacyCopy(data);
  }

  globalThis.ChatGPTTableCopy = Object.freeze({serializeTable, copyTable});
})();
