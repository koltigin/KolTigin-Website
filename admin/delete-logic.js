(function (root) {
  const ENTITY_FAMILIES = ['writing', 'video', 'guide', 'project'];
  const CORE_PAGES = ['about', 'resume', 'profile', 'social', 'contact'];

  function showEntityDelete(existing) {
    return Boolean(existing);
  }

  function allowsEntityDelete(family) {
    return ENTITY_FAMILIES.includes(family);
  }

  function isProtectedCorePage(page) {
    return CORE_PAGES.includes(page);
  }

  function deletedMessage(isProduction, translate) {
    return isProduction ? translate('save.deleted') : translate('save.deletedLocally');
  }

  function deleteRequest(family, payload) {
    const id = String((payload && payload.id) || '');
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

  function listHashFor(family) {
    if (family === 'writing') return '#/writings';
    if (family === 'video') return '#/videos';
    if (family === 'guide') return '#/guides';
    if (family === 'project') return '#/projects';
    return '#/dashboard';
  }

  function createDeleteConfirm() {
    let pending = null;
    return {
      current() {
        return pending;
      },
      request(spec) {
        if (!spec || !allowsEntityDelete(spec.family) || !showEntityDelete(true)) {
          pending = null;
          return null;
        }
        pending = {
          family: spec.family,
          id: spec.id,
          kind: spec.kind || '',
          title: spec.title || spec.id,
          confirmed: false
        };
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
    showEntityDelete,
    allowsEntityDelete,
    isProtectedCorePage,
    deletedMessage,
    deleteRequest,
    listHashFor,
    createDeleteConfirm
  };
  root.KTAdminDelete = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
