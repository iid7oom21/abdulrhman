// Storage is scoped to the playground. A stale tab retains its own working copy.
const namespace = 'raven.after-show.v1.';
const format = 1;

export function activityStore(storageForPage, notify = () => {}) {
  const views = new Map();
  function read(key) {
    if (views.has(key)) return views.get(key);
    const view = {raw:null, value:undefined, issue:null, valid:false};
    try {
      view.raw = storageForPage().getItem(namespace + key);
      if (view.raw !== null) {
        const item = JSON.parse(view.raw);
        if (item?.v !== format || !Object.hasOwn(item, 'data')) throw new SyntaxError();
        view.value = item.data;
        view.valid = true;
      }
    } catch (error) {
      view.issue = error instanceof SyntaxError ? 'incompatible' : 'unavailable';
    }
    views.set(key, view);
    if (view.issue) notify(view.issue, key);
    return view;
  }
  function save(key, value) {
    const view = read(key);
    view.value = structuredClone(value);
    if (view.issue === 'conflict' || view.issue === 'incompatible') {
      notify(view.issue, key);
      return false;
    }
    try {
      const storage = storageForPage();
      if (storage.getItem(namespace + key) !== view.raw) {
        view.issue = 'conflict';
        notify(view.issue, key);
        return false;
      }
      const next = JSON.stringify({v:format, data:value});
      storage.setItem(namespace + key, next);
      if (storage.getItem(namespace + key) !== next) throw new Error('write_unconfirmed');
      view.raw = next;
      view.valid = true;
      view.issue = null;
      return true;
    } catch {
      view.issue = 'unavailable';
      notify(view.issue, key);
      return false;
    }
  }
  function clear(key) {
    const view = read(key);
    try {
      const storage = storageForPage();
      if (storage.getItem(namespace + key) !== view.raw) {
        view.issue = 'conflict';
        notify(view.issue, key);
        return false;
      }
      storage.removeItem(namespace + key);
      if (storage.getItem(namespace + key) !== null) throw new Error('delete_unconfirmed');
      views.delete(key);
      return true;
    } catch {
      notify('unavailable', key);
      return false;
    }
  }
  return {
    load(key, fallback) {const view = read(key); return structuredClone(view.value === undefined ? fallback : view.value);},
    saved(key) {const view = read(key); return view.valid && !view.issue;},
    issue(key) {return read(key).issue;},
    refresh(key) {views.delete(key);},
    save, clear
  };
}
