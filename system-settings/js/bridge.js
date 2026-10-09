/* bridge.js - connection to the local Otzaria Bridge (Windows helper service).
   All traffic goes through Otzaria.call network.fetchStream.
   When window.Otzaria is missing (plain browser), a mock bridge with fake state is used. */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});

  var PORTS = [47917, 47918, 47919, 47920, 47921];
  var HEADERS = { 'X-Otzaria-Bridge': '1', 'Content-Type': 'application/json; charset=utf-8' };

  function BridgeError(code, message, status) {
    var e = new Error(message || code);
    e.code = code || 'internal';
    e.status = status || 0;
    return e;
  }

  /* ---------- real transport ---------- */
  async function rawRequest(url, method, bodyObj, timeoutMs) {
    var params = { url: url, method: method, headers: HEADERS, timeoutMs: timeoutMs || 15000 };
    if (method !== 'GET') params.body = JSON.stringify(bodyObj || {});
    var it = window.Otzaria.call('network.fetchStream', params);
    if (it && typeof it.then === 'function') it = await it;
    if (it && it.success === false) {
      var er = it.error || {};
      throw BridgeError(er.code === 'error.timeout' ? 'timeout' : 'transport', er.message || er.code);
    }
    if (!it || typeof it[Symbol.asyncIterator] !== 'function') {
      throw BridgeError('transport', 'fetchStream returned no stream');
    }
    var status = 0;
    var text = '';
    try {
      for await (var chunk of it) {
        if (!chunk) continue;
        if (chunk.type === 'response') { status = chunk.status; continue; }
        if (chunk.type === 'data' && typeof chunk.body === 'string') text += chunk.body;
      }
    } catch (err) {
      var msg = (err && (err.message || err.code)) || String(err);
      var code = /timeout/i.test(msg) ? 'timeout' : 'transport';
      throw BridgeError(code, msg);
    }
    var json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    if (!json) throw BridgeError('bad_response', 'HTTP ' + status, status);
    return { status: status, json: json };
  }

  var real = {
    port: null,
    async probe() {
      for (var i = 0; i < PORTS.length; i++) {
        var p = PORTS[i];
        try {
          var r = await rawRequest("http://127.0.0.1:" + p + "/health", "GET", null, 1500);
          if (r.json && r.json.ok && r.json.data && r.json.data.name === 'otzaria-bridge') {
            real.port = p;
            return r.json.data;
          }
        } catch (e) { /* next port */ }
      }
      real.port = null;
      return null;
    },
    async call(path, body, opts) {
      if (!real.port) throw BridgeError('offline', 'bridge not connected');
      var timeout = (opts && opts.timeoutMs) || 15000;
      var r;
      try {
        r = await rawRequest("http://127.0.0.1:" + real.port + path, "POST", body || {}, timeout);
      } catch (e) {
        if (e.code === 'transport') SS.bridge.onLost && SS.bridge.onLost();
        throw e;
      }
      if (r.json.ok) return r.json.data;
      var err = r.json.error || {};
      throw BridgeError(err.code || 'internal', err.message || '', r.status);
    }
  };

  /* ---------- mock bridge (browser preview) ---------- */
  function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var M = {
    audio: { volume: 42, muted: false, deviceName: 'רמקולים (Realtek High Definition Audio)' },
    devices: [
      { id: 'spk', name: 'רמקולים (Realtek High Definition Audio)', isDefault: true },
      { id: 'hdmi', name: 'מסך LG (NVIDIA High Definition Audio)', isDefault: false },
      { id: 'bt', name: 'אוזניות Soundcore Life Q30', isDefault: false }
    ],
    display: { brightness: 70, supported: true },
    radios: [
      { kind: 'bluetooth', name: 'Bluetooth', state: 'on' },
      { kind: 'wifi', name: 'Wi-Fi', state: 'on' }
    ],
    bt: [
      { id: 'bt1', name: 'אוזניות Soundcore Life Q30', paired: true, connected: true, kind: 'audio' },
      { id: 'bt2', name: 'עכבר Logitech M650', paired: true, connected: false, kind: 'input' }
    ],
    btFound: [
      { id: 'bt3', name: 'רמקול JBL Flip 6', paired: false, connected: false, kind: 'audio' },
      { id: 'bt4', name: 'מקלדת Keychron K3', paired: false, connected: false, kind: 'input' }
    ],
    wifi: {
      connected: 'Beit-Midrash',
      networks: [
        { ssid: 'Beit-Midrash', signal: 92, secured: true, connected: true, known: true },
        { ssid: 'Kollel-5G', signal: 71, secured: true, connected: false, known: true },
        { ssid: 'Shalom_Guest', signal: 54, secured: false, connected: false, known: false },
        { ssid: 'Cohen-Home', signal: 33, secured: true, connected: false, known: false },
        { ssid: 'HOTBOX-4A21', signal: 12, secured: true, connected: false, known: false }
      ]
    },
    kiosk: {
      active: false, hasPassword: false, strict: false, autoStartBridge: true,
      otzariaPath: 'C:\\Program Files\\Otzaria\\otzaria.exe', blockTaskManager: true,
      allowOpenExtensions: ['pdf', 'txt']
    },
    password: null,
    recovery: null,
    fails: 0,
    lockedUntil: 0
  };

  function mockErr(code, message) { return BridgeError(code, message, 400); }

  function checkPw(pw, allowRecovery) {
    if (Date.now() < M.lockedUntil) {
      throw mockErr('forbidden', 'יותר מדי ניסיונות שגויים. נסו שוב בעוד ' + Math.ceil((M.lockedUntil - Date.now()) / 1000) + ' שניות.');
    }
    var ok = pw === M.password || (allowRecovery && pw && pw.toUpperCase() === M.recovery);
    if (!ok) {
      M.fails++;
      if (M.fails >= 5) { M.fails = 0; M.lockedUntil = Date.now() + 60000; }
      throw mockErr('wrong_password', 'הסיסמה שגויה');
    }
    M.fails = 0;
  }

  var mockRoutes = {
    '/sys/info': function () {
      return { computerName: 'BEIT-MIDRASH-PC', userName: 'talmid', os: 'Windows 11 Pro 23H2',
        battery: { percent: 78, charging: true }, time: new Date().toISOString() };
    },
    '/sys/audio/get': function () { return clone(M.audio); },
    '/sys/audio/set': function (b) {
      if (typeof b.volume === 'number') M.audio.volume = Math.max(0, Math.min(100, Math.round(b.volume)));
      if (typeof b.muted === 'boolean') M.audio.muted = b.muted;
      return clone(M.audio);
    },
    '/sys/audio/devices': function () { return { devices: clone(M.devices) }; },
    '/sys/audio/set-default': function (b) {
      var d = M.devices.find(function (x) { return x.id === b.id; });
      if (!d) throw mockErr('not_found', 'ההתקן לא נמצא');
      M.devices.forEach(function (x) { x.isDefault = x.id === b.id; });
      M.audio.deviceName = d.name;
      return { ok: true };
    },
    '/sys/display/get': function () { return clone(M.display); },
    '/sys/display/set': function (b) { M.display.brightness = Math.round(b.brightness); return clone(M.display); },
    '/sys/radios/get': function () { return { radios: clone(M.radios) }; },
    '/sys/radios/set': function (b) {
      M.radios.forEach(function (r) { if (r.kind === b.kind) r.state = b.on ? 'on' : 'off'; });
      if (b.kind === 'wifi' && !b.on) { M.wifi.connected = null; M.wifi.networks.forEach(function (n) { n.connected = false; }); }
      if (b.kind === 'bluetooth' && !b.on) M.bt.forEach(function (d) { d.connected = false; });
      return { radios: clone(M.radios) };
    },
    '/sys/bluetooth/devices': async function (b) {
      var on = M.radios[0].state === 'on';
      if (!on) return { devices: [] };
      if (b.scan) { await delay(2200); return { devices: clone(M.bt.concat(M.btFound.filter(function (f) { return !M.bt.some(function (x) { return x.id === f.id; }); }))) }; }
      return { devices: clone(M.bt) };
    },
    '/sys/bluetooth/pair': async function (b) {
      await delay(900);
      var f = M.btFound.find(function (x) { return x.id === b.id; });
      if (!f) throw mockErr('not_found', 'המכשיר לא נמצא');
      var d = clone(f); d.paired = true; d.connected = true;
      M.bt.push(d);
      return { paired: true };
    },
    '/sys/bluetooth/unpair': function (b) {
      M.bt = M.bt.filter(function (x) { return x.id !== b.id; });
      return { unpaired: true };
    },
    '/sys/wifi/networks': function () {
      if (M.radios[1].state !== 'on') return { connected: null, networks: [] };
      return clone(M.wifi);
    },
    '/sys/wifi/connect': async function (b) {
      await delay(1200);
      var n = M.wifi.networks.find(function (x) { return x.ssid === b.ssid; });
      if (!n) throw mockErr('not_found', 'הרשת לא נמצאה');
      if (n.secured && !n.known && (!b.password || b.password.length < 8)) throw mockErr('bad_request', 'סיסמת הרשת שגויה');
      M.wifi.networks.forEach(function (x) { x.connected = x.ssid === b.ssid; });
      n.known = true;
      M.wifi.connected = b.ssid;
      return { connected: true };
    },
    '/sys/wifi/disconnect': function () {
      M.wifi.connected = null;
      M.wifi.networks.forEach(function (x) { x.connected = false; });
      return { ok: true };
    },
    '/sys/power': function (b) {
      if (M.kiosk.active && b.action !== 'lock') throw mockErr('locked', 'הפעולה חסומה במצב נעילה');
      return { ok: true };
    },
    '/kiosk/status': function () { return clone(M.kiosk); },
    '/kiosk/set-password': function (b) {
      if (!b.newPassword || b.newPassword.length < 4) throw mockErr('bad_request', 'הסיסמה חייבת להכיל לפחות 4 תווים');
      if (M.kiosk.hasPassword) {
        checkPw(b.oldPassword, false);
        M.password = b.newPassword;
        return { ok: true };
      }
      M.password = b.newPassword;
      M.kiosk.hasPassword = true;
      var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      var code = '';
      for (var i = 0; i < 12; i++) code += abc[Math.floor(Math.random() * abc.length)];
      M.recovery = code;
      return { ok: true, recoveryCode: code };
    },
    '/kiosk/enable': function (b) {
      if (!M.kiosk.hasPassword) throw mockErr('bad_request', 'יש להגדיר סיסמה תחילה');
      checkPw(b.password, false);
      M.kiosk.active = true;
      M.kiosk.strict = !!b.strict;
      M.kiosk.blockTaskManager = b.blockTaskManager !== false;
      return { active: true };
    },
    '/kiosk/disable': function (b) {
      checkPw(b.password, true);
      M.kiosk.active = false;
      M.kiosk.strict = false;
      return { active: false };
    },
    '/kiosk/settings': function (b) {
      checkPw(b.password, false);
      if (Array.isArray(b.allowOpenExtensions)) M.kiosk.allowOpenExtensions = b.allowOpenExtensions.slice();
      if (typeof b.otzariaPath === 'string') M.kiosk.otzariaPath = b.otzariaPath;
      return clone(M.kiosk);
    }
  };

  var mock = {
    port: 47917,
    async probe() {
      await delay(250);
      if (/[?&]offline=1/.test(location.search)) return null;
      return { name: 'otzaria-bridge', version: '1.0.0', port: 47917, kioskActive: M.kiosk.active, platform: 'windows' };
    },
    async call(path, body) {
      await delay(180);
      var fn = mockRoutes[path];
      if (!fn) throw mockErr('not_found', 'נתיב לא קיים');
      return await fn(body || {});
    }
  };

  var impl = window.Otzaria ? real : mock;

  SS.bridge = {
    isMock: !window.Otzaria,
    health: null,
    onLost: null,
    get port() { return impl.port; },
    async probe() {
      var h = await impl.probe();
      SS.bridge.health = h;
      return h;
    },
    call: function (path, body, opts) { return impl.call(path, body, opts); },
    Error: BridgeError
  };
})();
