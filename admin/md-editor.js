(function (root) {
  function dispatchInput(textarea) {
    if (typeof textarea.dispatchEvent !== 'function') return;
    const event = typeof Event === 'function' ? new Event('input') : { type: 'input' };
    textarea.dispatchEvent(event);
  }

  function applyChange(textarea, transform) {
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft || 0;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const result = transform(textarea.value, start, end);
    textarea.value = result.value;
    textarea.focus();
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    textarea.scrollTop = scrollTop;
    textarea.scrollLeft = scrollLeft;
    dispatchInput(textarea);
    return result;
  }

  function wrapSelection(textarea, before, after) {
    const close = after == null ? before : after;
    return applyChange(textarea, (value, start, end) => {
      const selected = value.slice(start, end) || 'text';
      return {
        value: value.slice(0, start) + before + selected + close + value.slice(end),
        selectionStart: start + before.length,
        selectionEnd: start + before.length + selected.length
      };
    });
  }

  function lineBounds(value, start, end) {
    const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let to = value.indexOf('\n', end);
    if (end > start && value.charAt(end - 1) === '\n') to = end - 1;
    else if (to === -1) to = value.length;
    return [from, to];
  }

  function prefixLines(textarea, prefix) {
    return applyChange(textarea, (value, selStart, selEnd) => {
      const [start, end] = lineBounds(value, selStart, selEnd);
      const block = value.slice(start, end);
      const lines = block.split('\n');
      let next;
      if (prefix === '> ') {
        const nonempty = lines.filter((line) => line.trim() !== '');
        const quoted = nonempty.length > 0 && nonempty.every((line) => /^\s*> ?/.test(line));
        next = lines.map((line) => {
          if (quoted) return line.replace(/^\s*> ?/, '');
          if (/^\s*> ?/.test(line)) return line.replace(/^\s*> ?/, '> ');
          if (line.trim() === '') return '>';
          return `> ${line}`;
        }).join('\n');
      } else {
        const fallback = lines.length === 1 && lines[0] === '' ? ['item'] : lines;
        next = fallback.map((line, index) => {
          if (prefix === '1. ') return `${index + 1}. ${line.replace(/^\d+\.\s+/, '')}`;
          return prefix + line.replace(/^([-*]|>)\s+/, '');
        }).join('\n');
      }
      return {
        value: value.slice(0, start) + next + value.slice(end),
        selectionStart: start,
        selectionEnd: start + next.length
      };
    });
  }

  function insertSnippet(textarea, snippet, selectStart, selectEnd) {
    return applyChange(textarea, (value, start, end) => {
      const next = value.slice(0, start) + snippet + value.slice(end);
      const caretStart = selectStart == null ? start + snippet.length : selectStart;
      const caretEnd = selectEnd == null ? caretStart : selectEnd;
      return { value: next, selectionStart: caretStart, selectionEnd: caretEnd };
    });
  }

  function applyMd(cmd, textarea) {
    if (cmd === 'h2') return prefixLines(textarea, '## ');
    if (cmd === 'bold') return wrapSelection(textarea, '**');
    if (cmd === 'italic') return wrapSelection(textarea, '*');
    if (cmd === 'link') return wrapSelection(textarea, '[', '](https://)');
    if (cmd === 'ul') return prefixLines(textarea, '- ');
    if (cmd === 'ol') return prefixLines(textarea, '1. ');
    if (cmd === 'quote') return prefixLines(textarea, '> ');
    if (cmd === 'code') return wrapSelection(textarea, '`');
    if (cmd === 'hr') {
      const start = textarea.selectionStart;
      return insertSnippet(textarea, '\n---\n', start + 5, start + 5);
    }
    if (cmd === 'codeblock') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end);
      const insert = selected ? `\`\`\` bash\n${selected}\n\`\`\`\n` : '``` bash\n\n```\n';
      const innerStart = start + 8;
      return insertSnippet(textarea, insert, innerStart, innerStart + (selected ? selected.length : 0));
    }
  }

  const api = { applyChange, wrapSelection, prefixLines, insertSnippet, applyMd, lineBounds };
  root.KTAdminMd = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
