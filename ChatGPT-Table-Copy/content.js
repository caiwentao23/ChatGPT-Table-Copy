/* Runs in Chrome's isolated extension world. */
(() => {
  'use strict';
  if (!globalThis.ChatGPTTableCopy) return;
  globalThis.__cgtcController?.dispose();
  const entries = new Map();
  let scanTimer = null;
  let disposed = false;

  function isConversationTable(table) {
    return !table.parentElement?.closest('table') &&
      !table.closest('[data-message-author-role="user"],nav,aside,[contenteditable="true"],[data-cgtc-clipboard]') &&
      Boolean(table.closest('[data-message-author-role="assistant"],main'));
  }

  function anchorFor(table) {
    let anchor = table;
    for (let parent = table.parentElement; parent; parent = parent.parentElement) {
      if (parent.matches('main,article,[data-message-author-role],.markdown,.prose')) break;
      if (parent.querySelectorAll('table').length !== 1) break;
      // Stay outside scrolling and flex/grid wrappers so reverse layouts can't move the button below the table.
      const style = getComputedStyle(parent);
      if (/^(auto|scroll|overlay|hidden)$/.test(style.overflowX) || /^(inline-)?(flex|grid)$/.test(style.display)) anchor = parent;
    }
    return anchor;
  }

  function copyIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(ns, 'svg');
    for (const [name, value] of Object.entries({viewBox:'0 0 20 20',width:'15',height:'15',fill:'none','aria-hidden':'true'})) icon.setAttribute(name, value);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M7 6V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5v7a1.5 1.5 0 0 1-1.5 1.5H14M4.5 7h7a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7Z');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    icon.append(path);
    return icon;
  }

  function setState(entry, state, message) {
    entry.button.dataset.state = state;
    entry.label.textContent = {idle:'复制表格',busy:'正在复制…',success:'已复制',error:'复制失败，重试'}[state];
    entry.button.title = message || '复制为可粘贴到 Word 的表格';
    entry.button.setAttribute('aria-label', state === 'idle' ? '复制表格，粘贴到 Word 时保留表格格式' : entry.label.textContent);
    entry.status.textContent = message || '';
  }

  function makeEntry(table) {
    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-cgtc-toolbar', '');
    const button = document.createElement('button');
    button.type = 'button';
    const label = document.createElement('span');
    button.append(copyIcon(), label);
    const status = document.createElement('span');
    status.className = 'cgtc-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    toolbar.append(button, status);
    const entry = {toolbar, button, label, status, resetTimer:null, copying:false};
    setState(entry, 'idle');
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (entry.copying) return;
      entry.copying = true;
      clearTimeout(entry.resetTimer);
      button.setAttribute('aria-busy', 'true');
      setState(entry, 'busy', '正在复制表格');
      try {
        if (!table.isConnected) throw new Error('表格已更新');
        await globalThis.ChatGPTTableCopy.copyTable(table);
        setState(entry, 'success', '表格已复制。在 Word 中按 Ctrl+V，并选择保留源格式。');
        entry.resetTimer = setTimeout(() => setState(entry, 'idle'), 2200);
      } catch {
        setState(entry, 'error', '复制未完成。请保持当前标签页在前台，然后点击重试。');
      } finally {
        entry.copying = false;
        button.removeAttribute('aria-busy');
      }
    });
    return entry;
  }

  function scan() {
    scanTimer = null;
    if (disposed) return;
    const tables = new Set(Array.from(document.querySelectorAll('table')).filter(isConversationTable));
    for (const [table, entry] of entries) {
      if (tables.has(table)) continue;
      clearTimeout(entry.resetTimer);
      entry.toolbar.remove();
      entries.delete(table);
    }
    for (const table of tables) {
      let entry = entries.get(table);
      if (!entry) {
        entry = makeEntry(table);
        entries.set(table, entry);
      }
      const anchor = anchorFor(table);
      if (anchor.previousElementSibling !== entry.toolbar) anchor.before(entry.toolbar);
    }
  }

  function scheduleScan() {
    if (scanTimer === null && !disposed) scanTimer = setTimeout(scan, 80);
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.target.nodeType === Node.ELEMENT_NODE && record.target.closest('[data-cgtc-toolbar],[data-cgtc-clipboard]')) continue;
      if (record.type === 'attributes') { scheduleScan(); return; }
      // Streaming cell text doesn't require a rescan: copying always reads the current table.
      for (const node of [...record.addedNodes, ...record.removedNodes]) {
        if (node.nodeType === Node.ELEMENT_NODE &&
            (node.matches('table,[data-cgtc-toolbar]') || node.querySelector('table,[data-cgtc-toolbar]'))) {
          scheduleScan();
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['data-message-author-role']});
  scan();
  globalThis.__cgtcController = {
    dispose() {
      disposed = true;
      observer.disconnect();
      clearTimeout(scanTimer);
      for (const entry of entries.values()) {
        clearTimeout(entry.resetTimer);
        entry.toolbar.remove();
      }
      entries.clear();
    }
  };
})();
