/* KHERJA location permission layer (shared by the passenger and driver views; exposed as window.KJLoc).
   Rules it enforces:
   - Foreground / While-Using location only. Never requests Always or background location.
   - Runtime request only, and only after our own explanation sheet; never at install or launch without context.
   - After a denial it never re-prompts by itself. It shows a denied sheet only when the user taps a location action.
   - Never blocks the app: every sheet offers "choose manually"; callers fall back to manual pickup.
   - Native (Capacitor) uses @capacitor/geolocation; plain browsers use navigator.geolocation. */
(function () {
  if (window.KJLoc) return;
  var W = window, doc = document;
  var cap = function () { return W.Capacitor; };
  var isNative = function () { try { return !!(cap() && cap().isNativePlatform && cap().isNativePlatform()); } catch (e) { return false; } };
  var plugin = function (n) { try { return cap() && cap().Plugins && cap().Plugins[n]; } catch (e) { return null; } };
  var platform = function () { try { return cap().getPlatform(); } catch (e) { return 'web'; } };
  var lang = function () { return doc.documentElement.lang === 'fr' ? 'fr' : 'ar'; };

  var TX = {
    ar: {
      r_title: 'نحددو موقعك',
      r_body_rider: 'باش نحددو موقعك بدقة ونلقاو لك السائقين القريبين، نحتاجو إذن الوصول للموقع. تقدر تختار موقع الانطلاق يدوياً إذا ما حبيتش تشارك موقعك.',
      r_body_driver: 'باش تظهر للركاب القريبين وتستقبل الطلبات، نحتاجو موقعك كي تكون متصل. موقعك ما يتشاركش كي تولي غير متصل.',
      r_fine: 'نستعملو الموقع غير وأنت تستعمل التطبيق.',
      allow: 'السماح بالموقع', manual: 'نختار يدوياً', close: 'إغلاق', retry: 'إعادة المحاولة', settings: 'فتح الإعدادات',
      d_title: 'الموقع غير مفعّل',
      d_body: 'ما عندناش إذن الوصول لموقعك. تقدر تختار موقع الانطلاق يدوياً، أو تفتح الإعدادات وتسمح بالموقع.',
      d_body_driver: 'بدون الموقع ما نقدروش نظهروك للركاب القريبين. افتح الإعدادات واسمح بالموقع باش تتصل.',
      d_ios_hint: 'الإعدادات ‹ خرجة ‹ الموقع ‹ أثناء استخدام التطبيق',
      s_title: 'خدمة الموقع (GPS) مطفية',
      s_body: 'فعّل خدمة الموقع من إعدادات الهاتف باش نحددو موقعك، أو اختر الانطلاق يدوياً.',
      u_title: 'تعذّر تحديد موقعك',
      u_body: 'ما قدرناش نحددو موقعك دابا. جرّب مرة أخرى أو اختر الانطلاق يدوياً.',
      detecting: 'جاري تحديد موقعك…', ok: 'تم تحديد موقعك', approx: 'الموقع تقريبي، تأكد من نقطة الانطلاق', here: 'موقعي الحالي'
    },
    fr: {
      r_title: 'Utiliser votre position',
      r_body_rider: 'Pour déterminer votre position avec précision et trouver les chauffeurs proches de vous, KHERJA a besoin d’accéder à votre localisation. Vous pouvez aussi choisir votre point de départ manuellement si vous préférez ne pas la partager.',
      r_body_driver: 'Pour apparaître auprès des passagers proches et recevoir des demandes, KHERJA a besoin de votre position tant que vous êtes en ligne. Elle n’est plus partagée dès que vous passez hors ligne.',
      r_fine: 'Votre position n’est utilisée que lorsque l’application est ouverte.',
      allow: 'Autoriser la localisation', manual: 'Choisir manuellement', close: 'Fermer', retry: 'Réessayer', settings: 'Ouvrir les réglages',
      d_title: 'Localisation désactivée',
      d_body: 'KHERJA n’a pas accès à votre position. Vous pouvez choisir le départ manuellement ou ouvrir les réglages pour autoriser la localisation.',
      d_body_driver: 'Sans localisation, nous ne pouvons pas vous montrer aux passagers proches. Ouvrez les réglages et autorisez la localisation pour passer en ligne.',
      d_ios_hint: 'Réglages › KHERJA › Localisation › Lorsque l’app est active',
      s_title: 'Le GPS est désactivé',
      s_body: 'Activez la localisation dans les réglages de l’appareil, ou choisissez le départ manuellement.',
      u_title: 'Position indisponible',
      u_body: 'Impossible de vous localiser pour le moment. Réessayez ou choisissez le départ manuellement.',
      detecting: 'Localisation en cours…', ok: 'Position détectée', approx: 'Position approximative, vérifiez le point de départ', here: 'Ma position actuelle'
    }
  };
  var tx = function (k) { return TX[lang()][k]; };

  /* ---- one-time rationale flag (per install). Failure to persist only means the sheet may show again. ---- */
  var FLAG = 'kj.loc.rationale';
  var seenRationale = function () { try { return !!localStorage.getItem(FLAG); } catch (e) { return false; } };
  var markRationale = function () { try { localStorage.setItem(FLAG, String(Date.now())); } catch (e) {} };

  /* ---- permission status: granted | granted_approx | prompt | prompt_again | denied | unsupported ---- */
  function fromNative(r) {
    if (!r) return 'prompt';
    if (r.location === 'granted') return 'granted';
    if (r.coarseLocation === 'granted') return 'granted_approx';
    if (r.location === 'denied' && (r.coarseLocation === 'denied' || r.coarseLocation == null)) return 'denied';
    if (r.location === 'prompt-with-rationale' || r.coarseLocation === 'prompt-with-rationale') return 'prompt_again';
    return 'prompt';
  }
  function status() {
    if (isNative()) {
      var g = plugin('Geolocation');
      if (!g) return Promise.resolve('unsupported');
      return g.checkPermissions().then(fromNative, function () { return 'unsupported'; });
    }
    if (!navigator.geolocation) return Promise.resolve('unsupported');
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve('prompt');
    return navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
      return p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'prompt';
    }, function () { return 'prompt'; });
  }
  function request() {
    if (!isNative()) return Promise.resolve('prompt'); // browsers prompt on the first position read
    return plugin('Geolocation').requestPermissions({ permissions: ['location', 'coarseLocation'] }).then(fromNative, function () { return 'denied'; });
  }

  /* ---- position ---- */
  function classify(e, st) {
    var m = String((e && (e.message || e.errorMessage)) || e || '') + ' ' + String((e && e.code) || '');
    if (st === 'denied' || /denied|not authori[sz]ed|permission/i.test(m) || (e && e.code === 1 && !isNative())) return 'denied';
    if (/not enabled|services?.*(off|disabled|unavailable)|location.*disabled|GLOC-0007/i.test(m)) return 'services_off';
    if (/time.?out|timed out/i.test(m) || (e && e.code === 3 && !isNative())) return 'timeout';
    return 'unavailable';
  }
  function fmt(p) {
    var c = (p && p.coords) || {};
    return { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy };
  }
  function getPosition(o) {
    o = o || {};
    var opts = { enableHighAccuracy: o.high !== false, timeout: o.timeout || 10000, maximumAge: o.maxAge == null ? 15000 : o.maxAge };
    var p = isNative()
      ? plugin('Geolocation').getCurrentPosition(opts)
      : new Promise(function (res, rej) { navigator.geolocation.getCurrentPosition(res, rej, opts); });
    return p.then(fmt).then(function (r) {
      if (!isFinite(r.lat) || !isFinite(r.lng)) throw new Error('invalid position');
      return r;
    }).catch(function (e) {
      return status().then(function (st) { var err = new Error('loc'); err.kind = classify(e, st); throw err; });
    });
  }

  /* ---- open system settings (user-initiated only) ---- */
  function openSettings(kind) {
    try {
      if (isNative() && platform() === 'ios') { W.location.href = 'app-settings:'; return true; } // public URL (UIApplication.openSettingsURLString)
      if (isNative() && platform() === 'android') {
        var ns = plugin('NativeSettings');
        if (ns) { ns.open({ optionAndroid: kind === 'services_off' ? 'location' : 'application_details', optionIOS: 'app' }); return true; }
      }
    } catch (e) {}
    return false;
  }

  /* ---- sheet UI (consistent with KHERJA tokens; see shell/kj-location.css) ---- */
  var openSheet = null;
  function sheet(kind, o) {
    o = o || {};
    if (openSheet) return openSheet;
    var driver = o.role === 'driver';
    return (openSheet = new Promise(function (resolve) {
      var prev = doc.activeElement;
      var ov = doc.createElement('div');
      ov.className = 'kjl-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      var title = kind === 'rationale' ? tx('r_title') : kind === 'denied' ? tx('d_title') : kind === 'services_off' ? tx('s_title') : tx('u_title');
      var body = kind === 'rationale' ? (driver ? tx('r_body_driver') : tx('r_body_rider')) :
        kind === 'denied' ? (driver ? tx('d_body_driver') : tx('d_body')) : kind === 'services_off' ? tx('s_body') : tx('u_body');
      var card = doc.createElement('div'); card.className = 'kjl-card';
      var ic = doc.createElement('div'); ic.className = 'kjl-ic'; ic.setAttribute('aria-hidden', 'true');
      ic.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
      var h = doc.createElement('h2'); h.className = 'kjl-h'; h.id = 'kjl-h'; h.textContent = title;
      ov.setAttribute('aria-labelledby', 'kjl-h');
      var p = doc.createElement('p'); p.className = 'kjl-p'; p.textContent = body;
      card.append(ic, h, p);
      if (kind === 'rationale') { var f = doc.createElement('p'); f.className = 'kjl-f'; f.textContent = tx('r_fine'); card.append(f); }
      if (kind === 'denied' && isNative() && platform() === 'ios') { var hint = doc.createElement('p'); hint.className = 'kjl-f'; hint.textContent = tx('d_ios_hint'); card.append(hint); }
      var row = doc.createElement('div'); row.className = 'kjl-row';
      var done = function (v) { ov.remove(); openSheet = null; try { if (prev && prev.focus) prev.focus(); } catch (e) {} resolve(v); };
      var mk = function (cls, label, v) { var b = doc.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label; b.onclick = function () { done(v); }; row.append(b); return b; };
      var first;
      if (kind === 'rationale') { first = mk('primary', tx('allow'), 'allow'); if (!driver) mk('ghost', tx('manual'), 'manual'); else mk('ghost', tx('close'), 'manual'); }
      else if (kind === 'denied' || kind === 'services_off') {
        var sb = doc.createElement('button'); sb.type = 'button'; sb.className = 'btn primary'; sb.textContent = tx('settings');
        sb.onclick = function () { openSettings(kind); done('settings'); }; row.append(sb); first = sb;
        mk('ghost', driver ? tx('close') : tx('manual'), 'manual');
      } else { first = mk('primary', tx('retry'), 'retry'); mk('ghost', driver ? tx('close') : tx('manual'), 'manual'); }
      card.append(row); ov.append(card);
      ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') done('manual'); });
      ov.addEventListener('click', function (e) { if (e.target === ov) done('manual'); });
      doc.body.appendChild(ov);
      try { first.focus(); } catch (e) {}
    }));
  }

  /* ---- main entry point -------------------------------------------------------------------------
     ensure({role:'rider'|'driver', interactive:bool})
       interactive=true  : the user tapped a location action. May show the rationale, denied or GPS sheets.
       interactive=false : automatic use at screen start. Reads silently if already allowed; shows the rationale at
                           most once per install; never prompts after a denial and never shows the denied sheet.
     Resolves {ok:true, lat, lng, accuracy, approx} or {ok:false, reason:'manual'|'denied'|'services_off'|'timeout'|
     'unavailable'|'unsupported'|'suppressed'}. Callers must fall back to manual pickup when ok is false. */
  function ensure(o) {
    o = o || {};
    return status().then(function (st) {
      if (st === 'unsupported') return { ok: false, reason: 'unsupported' };
      if (st === 'denied') {
        if (!o.interactive) return { ok: false, reason: 'denied' };
        return sheet('denied', o).then(function () { return { ok: false, reason: 'denied' }; });
      }
      var need = st === 'prompt' || st === 'prompt_again';
      var step = Promise.resolve(st);
      if (need) {
        if (!o.interactive && (st === 'prompt_again' || seenRationale())) return { ok: false, reason: 'suppressed' };
        step = sheet('rationale', o).then(function (c) {
          markRationale();
          if (c !== 'allow') return 'manual';
          return request();
        });
      }
      return step.then(function (s2) {
        if (s2 === 'manual') return { ok: false, reason: 'manual' };
        if (isNative() && (s2 === 'denied' || s2 === 'prompt' || s2 === 'prompt_again')) return { ok: false, reason: 'denied' };
        return read(o, s2);
      });
    });
  }
  function read(o, st) {
    return getPosition(o).then(function (pos) {
      pos.ok = true; pos.approx = st === 'granted_approx' || (pos.accuracy != null && pos.accuracy > 1000);
      return pos;
    }, function (err) {
      var reason = err.kind || 'unavailable';
      if (!o.interactive) return { ok: false, reason: reason };
      if (reason === 'denied') return sheet('denied', o).then(function () { return { ok: false, reason: 'denied' }; });
      return sheet(reason === 'services_off' ? 'services_off' : 'unavailable', o).then(function (c) {
        if (c === 'retry') return read(o, st);
        return { ok: false, reason: reason };
      });
    });
  }

  W.KJLoc = { status: status, ensure: ensure, getPosition: getPosition, openSettings: openSettings, text: tx, isNative: isNative };
})();
