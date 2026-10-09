/* סייר קבצים - ספק קבצים במצב מוגבל (ללא גשר), על בסיס ממשקי fs של אוצריא */
(function () {
  'use strict';
  var FX = window.FX = window.FX || {};

  var STORE_KEY = 'fx.folders';
  var SEP = '::';
  var folders = [];   /* [{ token, name, path }] */
  var fileTokens = {}; /* מטמון path וירטואלי -> token של קובץ */

  function splitPath(p) {
    var i = String(p || '').indexOf(SEP);
    if (i < 0) return null;
    return { token: p.slice(0, i), rel: p.slice(i + SEP.length) };
  }
  function makePath(token, rel) { return token + SEP + (rel || ''); }
  function folderOf(token) {
    for (var i = 0; i < folders.length; i++) if (folders[i].token === token) return folders[i];
    return null;
  }
  function osSep(folder) { return folder && /\\/.test(folder.path || '') ? '\\' : '/'; }
  function absPath(token, rel) {
    var f = folderOf(token);
    if (!f) throw FX.OpError('not_found', 'התיקייה אינה מאושרת עוד');
    if (!rel) return f.path;
    var s = osSep(f);
    return f.path.replace(/[\\/]+$/, '') + s + rel.split('/').join(s);
  }
  function relParent(rel) {
    if (!rel) return null;
    var i = rel.lastIndexOf('/');
    return i < 0 ? '' : rel.slice(0, i);
  }
  function relName(rel) { return rel.slice(rel.lastIndexOf('/') + 1); }
  function relJoin(rel, name) { return rel ? rel + '/' + name : name; }

  async function save() {
    try {
      await FX.callHost('storage.set', { key: STORE_KEY, value: folders });
    } catch (e) {
      FX.ui && FX.ui.toast('שמירת רשימת התיקיות נכשלה: ' + FX.errorText(e), 'error');
    }
  }

  async function fileToken(entry) {
    if (fileTokens[entry.path]) return fileTokens[entry.path];
    var sp = splitPath(entry.path);
    var d = await FX.callHost('fs.openFolderFile', { folderToken: sp.token, path: sp.rel, access: 'read' });
    if (!d || !d.token) throw FX.OpError('not_found', 'פתיחת הקובץ נכשלה');
    fileTokens[entry.path] = d.token;
    return d.token;
  }

  var Prov = FX.FallbackProvider = {
    kind: 'fallback',
    caps: {
      copy: false, move: true, mkdir: false, newFile: false, rename: true, recycle: false, permanentDelete: true,
      open: false, reveal: false, clipboardSync: false, contentSearch: false, hidden: false, properties: true, editPath: false,
      saveCopy: true, addFolder: true
    },
    capReasons: {
      copy: 'העתקה דורשת את גשר אוצריא. במצב זה אפשר לשמור עותק של קובץ בודד בשם',
      mkdir: 'יצירת תיקייה דורשת את גשר אוצריא',
      newFile: 'יצירת קובץ דורשת את גשר אוצריא',
      open: 'פתיחה ביישום חיצוני דורשת את גשר אוצריא',
      recycle: 'ללא הגשר המחיקה היא לצמיתות (ללא סל המיחזור)'
    },
    rootLabel: 'התיקיות שלי',
    rootPath: '',

    init: async function () {
      try {
        var v = await FX.callHost('storage.get', { key: STORE_KEY });
        folders = Array.isArray(v) ? v.filter(function (f) { return f && f.token; }) : [];
      } catch (e) {
        folders = [];
        FX.ui && FX.ui.toast('טעינת רשימת התיקיות נכשלה: ' + FX.errorText(e), 'error');
      }
    },
    folders: function () { return folders.slice(); },

    addFolder: async function () {
      var d = await FX.callHost('fs.pickUserFolder', { title: 'הוספת תיקייה לסייר הקבצים' });
      if (!d || d.cancelled) return null;
      if (!folderOf(d.folderToken)) {
        folders.push({ token: d.folderToken, name: d.name, path: d.path });
        await save();
      }
      return makePath(d.folderToken, '');
    },
    removeFolder: async function (token) {
      try { await FX.callHost('fs.revokeFolder', { folderToken: token }); } catch (e) { /* ממשיכים בכל זאת להסיר מהרשימה */ }
      folders = folders.filter(function (f) { return f.token !== token; });
      await save();
    },

    roots: async function () {
      return {
        drives: [],
        known: folders.map(function (f) { return { id: f.token, name: f.name, path: makePath(f.token, ''), icon: 'folder', removable: true, token: f.token, full: f.path }; })
      };
    },

    list: async function (path) {
      if (!path) {
        return {
          path: '', parent: null, isRoot: true,
          entries: folders.map(function (f) { return { name: f.name, path: makePath(f.token, ''), type: 'dir', size: null, modified: null, approvedRoot: true, full: f.path }; })
        };
      }
      var sp = splitPath(path);
      if (!sp || !folderOf(sp.token)) throw FX.OpError('not_found', 'התיקייה אינה ברשימת התיקיות המאושרות');
      var d = await FX.callHost('fs.listUserFolder', { folderToken: sp.token, path: sp.rel });
      var par = relParent(sp.rel);
      return {
        path: path,
        parent: par == null ? '' : makePath(sp.token, par),
        truncated: !!d.truncated,
        entries: (d.entries || []).map(function (e) {
          return { name: e.name, path: makePath(sp.token, e.path), type: e.type === 'dir' ? 'dir' : 'file', size: e.size, modified: e.modified, ext: FX.extOf(e.name) };
        })
      };
    },

    displayPath: function (p) {
      if (!p) return 'התיקיות שלי';
      var sp = splitPath(p);
      var f = sp && folderOf(sp.token);
      if (!f) return p;
      return absPath(sp.token, sp.rel);
    },
    parentOf: function (p) {
      var sp = splitPath(p);
      if (!sp) return null;
      var par = relParent(sp.rel);
      return par == null ? '' : makePath(sp.token, par);
    },
    nameOf: function (p) {
      if (!p) return 'התיקיות שלי';
      var sp = splitPath(p);
      if (!sp) return p;
      if (!sp.rel) { var f = folderOf(sp.token); return f ? f.name : 'תיקייה'; }
      return relName(sp.rel);
    },
    join: function (dir, name) {
      var sp = splitPath(dir);
      return makePath(sp.token, relJoin(sp.rel, name));
    },
    segments: function (p) {
      var out = [{ label: 'התיקיות שלי', path: '' }];
      var sp = splitPath(p);
      if (!sp) return out;
      var f = folderOf(sp.token);
      out.push({ label: f ? f.name : 'תיקייה', path: makePath(sp.token, '') });
      var acc = '';
      sp.rel.split('/').filter(Boolean).forEach(function (part) {
        acc = relJoin(acc, part);
        out.push({ label: part, path: makePath(sp.token, acc) });
      });
      return out;
    },
    same: function (a, b) { return String(a) === String(b); },
    isInside: function (c, p) { return c === p || String(c).indexOf(p.replace(/\/$/, '') + (splitPath(p).rel ? '/' : '')) === 0; },
    normalizeInput: function (s) { return s; },

    stat: async function (path, entry) {
      var sp = splitPath(path);
      var out = { name: Prov.nameOf(path), path: Prov.displayPath(path), type: entry ? entry.type : 'dir', size: entry ? entry.size : null, modified: entry ? entry.modified : null };
      if (out.type === 'dir') {
        var d = await FX.callHost('fs.listUserFolder', { folderToken: sp.token, path: sp.rel });
        out.itemCount = (d.entries || []).length;
      }
      return out;
    },

    rename: async function (path, newName) {
      var sp = splitPath(path);
      if (!sp.rel) throw FX.OpError('forbidden', 'אי אפשר לשנות שם של תיקייה מאושרת');
      var to = relJoin(relParent(sp.rel), newName);
      await FX.callHost('fs.moveEntry', { from: absPath(sp.token, sp.rel), to: absPath(sp.token, to) });
      delete fileTokens[path];
      return { path: makePath(sp.token, to) };
    },

    move: async function (sources, destDir, conflict) {
      var dsp = splitPath(destDir);
      if (!dsp) throw FX.OpError('forbidden', 'יש לבחור תיקיית יעד מאושרת');
      var res = { moved: 0, skipped: 0, failed: [] };
      for (var i = 0; i < sources.length; i++) {
        var src = sources[i];
        var sp = splitPath(src);
        try {
          if (!sp.rel) throw FX.OpError('forbidden', 'אי אפשר להעביר תיקייה מאושרת');
          var name = relName(sp.rel);
          var to = relJoin(dsp.rel, name);
          if (sp.token === dsp.token && relParent(sp.rel) === dsp.rel) { res.skipped++; continue; }
          var fromAbs = absPath(sp.token, sp.rel);
          var toAbs = absPath(dsp.token, to);
          try {
            await FX.callHost('fs.moveEntry', { from: fromAbs, to: toAbs });
          } catch (e) {
            if (String(e.code).indexOf('invalid_params') < 0) throw e;
            if (conflict === 'skip') { res.skipped++; continue; }
            if (conflict === 'overwrite') throw FX.OpError('unsupported', 'דריסה אינה נתמכת ללא הגשר');
            var base = name.replace(/(\.[^.]*)?$/, ''), ext = (name.match(/\.[^.]*$/) || [''])[0];
            var done = false;
            for (var n = 2; n < 50 && !done; n++) {
              try {
                await FX.callHost('fs.moveEntry', { from: fromAbs, to: absPath(dsp.token, relJoin(dsp.rel, base + ' (' + n + ')' + ext)) });
                done = true;
              } catch (e2) { if (String(e2.code).indexOf('invalid_params') < 0) throw e2; }
            }
            if (!done) throw e;
          }
          delete fileTokens[src];
          res.moved++;
        } catch (e) {
          res.failed.push({ path: Prov.displayPath(src), message: FX.errorText(e) });
        }
      }
      return res;
    },

    remove: async function (paths, entries) {
      var res = { deleted: 0, failed: [] };
      for (var i = 0; i < paths.length; i++) {
        var p = paths[i];
        var sp = splitPath(p);
        var ent = entries && entries[i];
        try {
          if (!sp.rel) throw FX.OpError('forbidden', 'אי אפשר למחוק תיקייה מאושרת. להסרה מהרשימה השתמשו בתפריט שבחלונית הצד');
          var abs = absPath(sp.token, sp.rel);
          if (ent && ent.type === 'dir') await FX.callHost('fs.deleteFolder', { path: abs });
          else await FX.callHost('fs.deleteFile', { path: abs });
          delete fileTokens[p];
          res.deleted++;
        } catch (e) {
          res.failed.push({ path: Prov.displayPath(p), message: FX.errorText(e) });
        }
      }
      return res;
    },

    read: async function (entry) {
      var token = await fileToken(entry);
      var ext = FX.extOf(entry.name);
      var out = { name: entry.name, size: entry.size, truncated: false };
      if (FX.isTextExt(ext)) {
        if (entry.size > 2 * 1024 * 1024) { out.tooLarge = true; return out; }
        out.text = await FX.callHost('fs.readTextFile', { token: token });
        if (typeof out.text !== 'string') out.text = String(out.text == null ? '' : out.text);
      } else {
        var u = await FX.callHost('fs.resolveFileUrl', { token: token });
        out.url = u.url;
        if (ext === 'pdf') out.mime = 'application/pdf';
      }
      return out;
    },

    /* שמירת עותק של קובץ בודד דרך דיאלוג שמירה בשם של אוצריא */
    saveCopy: async function (entry) {
      var token = await fileToken(entry);
      var u = await FX.callHost('fs.resolveFileUrl', { token: token });
      var resp = await fetch(u.url);
      if (!resp.ok) throw FX.OpError('internal', 'קריאת הקובץ נכשלה (HTTP ' + resp.status + ')');
      var blob = await resp.blob();
      var w = await FX.callHost('fs.beginBinaryWrite', { purpose: 'user-file', expectedSize: blob.size || undefined });
      try {
        var put = await fetch(w.uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
        if (!put.ok) throw FX.OpError('internal', 'העלאת הקובץ נכשלה (HTTP ' + put.status + ')');
      } catch (e) {
        try { await FX.callHost('fs.abortBinaryWrite', { writeToken: w.writeToken }); } catch (e2) { /* אין מה לעשות */ }
        throw e;
      }
      var ext = FX.extOf(entry.name);
      var base = ext ? entry.name.slice(0, -(ext.length + 1)) : entry.name;
      var c = await FX.callHost('fs.commitUserFileWrite', { writeToken: w.writeToken, suggestedName: base + ' - עותק', extension: ext || undefined, title: 'שמירת עותק' });
      return c && !c.cancelled;
    },

    /* חיפוש רקורסיבי בצד הלקוח עם מקביליות מוגבלת */
    search: async function (root, opts, handlers, isCancelled) {
      var match = FX.nameMatcher(opts.query);
      var exts = opts.extensions || [];
      var max = Math.min(opts.maxResults || 2000, 2000);
      var hits = 0, scanned = 0, truncated = false;
      var queue = [];
      if (!root) folders.forEach(function (f) { queue.push(makePath(f.token, '')); });
      else queue.push(root);
      var lastProgress = 0;
      var CONC = 4;

      async function worker() {
        while (queue.length && !truncated) {
          if (isCancelled()) return;
          var dir = queue.shift();
          var sp = splitPath(dir);
          var d;
          try {
            d = await FX.callHost('fs.listUserFolder', { folderToken: sp.token, path: sp.rel });
          } catch (e) {
            if (String(e.code).indexOf('rate_limited') >= 0) { queue.push(dir); await FX.sleep(200); }
            continue;
          }
          scanned++;
          var now = Date.now();
          if (now - lastProgress > 250) { lastProgress = now; handlers.progress({ scanned: scanned, current: Prov.displayPath(dir) }); }
          var list = d.entries || [];
          for (var i = 0; i < list.length; i++) {
            var e = list[i];
            var vp = makePath(sp.token, e.path);
            if (e.type === 'dir') queue.push(vp);
            if (hits >= max) { truncated = true; break; }
            var isDir = e.type === 'dir';
            if (isDir && (opts.includeDirs === false || exts.length)) continue;
            if (!isDir && exts.length && exts.indexOf(FX.extOf(e.name)) < 0) continue;
            if (!match(e.name)) continue;
            hits++;
            handlers.hit({ name: e.name, path: vp, type: isDir ? 'dir' : 'file', size: e.size, modified: e.modified, display: Prov.displayPath(vp) });
          }
          await FX.sleep(12);
        }
      }
      var workers = [];
      for (var w = 0; w < CONC; w++) workers.push(worker());
      /* תור שמתמלא אחרי שעובדים כבר סיימו: מריצים סבבים עד שמתרוקן */
      await Promise.all(workers);
      while (queue.length && !truncated && !isCancelled()) {
        workers = [];
        for (var w2 = 0; w2 < CONC; w2++) workers.push(worker());
        await Promise.all(workers);
      }
      handlers.progress({ scanned: scanned, current: '' });
      return { cancelled: isCancelled(), truncated: truncated, scanned: scanned, hits: hits, complete: true };
    }
  };
})();
