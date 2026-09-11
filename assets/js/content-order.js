'use strict';

(function (root) {
  function publicationStamp(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return 0;
    let year;
    let month;
    let day;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    const euro = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]);
      day = Number(iso[3]);
    } else if (euro) {
      day = Number(euro[1]);
      month = Number(euro[2]);
      year = Number(euro[3]);
    } else {
      return 0;
    }
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return 0;
    const time = Date.UTC(year, month - 1, day);
    return Number.isFinite(time) ? time : 0;
  }

  function itemStamp(item, dateKeys) {
    if (item == null || typeof item !== 'object') return 0;
    for (const key of dateKeys) {
      const stamp = publicationStamp(item[key]);
      if (stamp) return stamp;
    }
    return 0;
  }

  function itemId(item, idKeys) {
    if (item == null) return '';
    if (typeof item === 'string') return String(item);
    for (const key of idKeys) {
      if (item[key] != null && String(item[key])) return String(item[key]);
    }
    return '';
  }

  function compareByPublicationDate(a, b, options) {
    const opts = options || {};
    const dateKeys = opts.dateKeys || ['date'];
    const idKeys = opts.idKeys || ['id', 'slug', 'file'];
    const right = itemStamp(b, dateKeys);
    const left = itemStamp(a, dateKeys);
    if (right !== left) return right - left;
    if (opts.useSourceIndex) {
      const indexA = Number.isFinite(a && a._sourceIndex) ? a._sourceIndex : 0;
      const indexB = Number.isFinite(b && b._sourceIndex) ? b._sourceIndex : 0;
      if (indexA !== indexB) return indexA - indexB;
    }
    return itemId(a, idKeys).localeCompare(itemId(b, idKeys), 'en');
  }

  function sortByPublicationDate(items, options) {
    const list = Array.isArray(items) ? items.slice() : [];
    return list
      .map((item, index) => {
        if (item && typeof item === 'object') {
          return Object.assign({}, item, { _sourceIndex: index });
        }
        return { id: item, date: '', _sourceIndex: index };
      })
      .sort((left, right) => compareByPublicationDate(left, right, options));
  }

  const api = {
    publicationStamp,
    compareByPublicationDate,
    sortByPublicationDate
  };
  root.KolTiginContentOrder = api;
})(typeof window !== 'undefined' ? window : globalThis);
