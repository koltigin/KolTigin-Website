(function (root) {
  const ENTITY_FAMILIES = ['writing', 'video', 'guide', 'project'];
  const CORE_PAGES = ['about', 'resume', 'profile', 'social', 'contact'];

  function allowsEntityDelete(family) {
    return ENTITY_FAMILIES.includes(String(family || ''));
  }

  function isProtectedCorePage(page) {
    return CORE_PAGES.includes(page);
  }

  function deletedItemMessage(title, translate) {
    return translate('save.deletedItem', { title: title || '' });
  }

  function sourcePaths(spec) {
    const id = String((spec && spec.id) || '');
    const kind = String((spec && spec.kind) || '');
    const family = spec && (spec.type || spec.family);
    if (family === 'writing' && kind && id) {
      return [`content/${kind}/en/${id}.md`, `content/${kind}/tr/${id}.md`];
    }
    if (family === 'video' && id) return [`content/videos/${id}.md`];
    if (family === 'guide' && id) return [`guides/${id}/EN.md`, `guides/${id}/TR.md`];
    if (family === 'project' && id) return [`content/projects/*/${id}.md`];
    return [];
  }

  function specFromDataset(dataset) {
    const data = dataset || {};
    const family = String(data.entityDelete || data.type || '');
    const id = String(data.deleteId || data.id || '').trim();
    const title = String(data.deleteTitle || data.title || id).trim() || id;
    const kind = String(data.deleteKind || data.kind || '').trim();
    if (!allowsEntityDelete(family) || !id) return null;
    const spec = { type: family, family, id, title, kind };
    spec.sourcePaths = sourcePaths(spec);
    return spec;
  }

  function deleteRequest(spec) {
    const payload = spec || {};
    const family = payload.type || payload.family;
    const id = String(payload.id || '');
    if (family === 'writing') {
      return {
        path: '/admin/api/save',
        body: { action: 'delete', kind: payload.kind, id }
      };
    }
    if (family === 'video') {
      return {
        path: '/admin/api/save',
        body: { action: 'delete', kind: 'videos', id }
      };
    }
    if (family === 'guide') {
      return { path: '/admin/api/guide-delete', body: { id } };
    }
    if (family === 'project') {
      return {
        path: '/admin/api/project-save',
        body: { action: 'delete', id }
      };
    }
    throw new Error('Unknown delete family');
  }

  function createDeleteConfirm() {
    let pending = null;
    return {
      current() {
        return pending;
      },
      request(input) {
        const spec = input && input.entityDelete ? specFromDataset(input) : specFromDataset({
          entityDelete: input && (input.type || input.family),
          deleteId: input && input.id,
          deleteTitle: input && input.title,
          deleteKind: input && input.kind
        });
        pending = spec;
        if (pending) pending.confirmed = false;
        return pending;
      },
      cancel() {
        pending = null;
        return pending;
      },
      confirm() {
        if (!pending) return null;
        pending.confirmed = true;
        return { ...pending };
      }
    };
  }

  const api = {
    ENTITY_FAMILIES,
    CORE_PAGES,
    allowsEntityDelete,
    isProtectedCorePage,
    deletedItemMessage,
    sourcePaths,
    specFromDataset,
    deleteRequest,
    createDeleteConfirm
  };
  root.KTAdminDelete = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
