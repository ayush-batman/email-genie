/* Waypoint tracker. Private mode: no cookies, no storage. Product mode: first-party visitor id in localStorage. */
(function () {
  "use strict";
  var d = document, w = window, s = d.currentScript, ls;
  if (!s) return;
  var attr = function (k) { return s.getAttribute("data-" + k); };
  var site = attr("site");
  var api = attr("api") || new URL("/api/e", s.src).href;
  var product = attr("mode") === "product";
  var debug = attr("debug") === "true";
  var exclude = (attr("exclude") || "").split(",").filter(Boolean).map(function (g) {
    return new RegExp("^" + g.trim().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  });
  try { ls = w.localStorage; } catch (e) {}

  function stored(k, v) {
    if (!product || !ls) return null;
    try { if (v !== undefined) v === null ? ls.removeItem(k) : ls.setItem(k, v); return ls.getItem(k); } catch (e) { return null; }
  }
  function uuid() {
    return w.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }
  function vid() { return stored("wp_vid") || stored("wp_vid", uuid()); }
  function optedOut() { try { return ls && ls.getItem("wp_ignore") === "1"; } catch (e) { return false; } }

  function send(t, n, props, extra) {
    try {
      if (!site || optedOut()) return;
      if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !debug && attr("allow-localhost") !== "true") return;
      if (location.protocol === "file:") return;
      var path = location.pathname;
      for (var i = 0; i < exclude.length; i++) if (exclude[i].test(path)) return;
      var body = { s: site, t: t, u: location.href, r: d.referrer, ti: d.title, w: screen.width, l: navigator.language };
      if (n) body.n = String(n).slice(0, 64);
      if (props) body.p = props;
      if (product) { body.vid = vid(); var uid = stored("wp_uid"); if (uid) body.uid = uid; }
      for (var k in extra) body[k] = extra[k];
      if (debug) return console.log("[waypoint]", body);
      var data = JSON.stringify(body);
      if (!(navigator.sendBeacon && navigator.sendBeacon(api, new Blob([data], { type: "text/plain" })))) {
        fetch(api, { method: "POST", body: data, keepalive: true, headers: { "content-type": "text/plain" } });
      }
    } catch (e) {}
  }

  // Engaged time: only while the tab is visible; flushed as a "ping" when the page is hidden or left.
  var engaged = 0, visibleSince = d.visibilityState === "visible" ? Date.now() : 0;
  function flushEngagement() {
    if (visibleSince) { engaged += Date.now() - visibleSince; visibleSince = 0; }
    if (engaged > 1000) send("ping", null, null, { et: Math.round(engaged) });
    engaged = 0;
  }
  d.addEventListener("visibilitychange", function () {
    if (d.visibilityState === "hidden") flushEngagement(); else visibleSince = Date.now();
  });
  w.addEventListener("pagehide", flushEngagement);

  var lastUrl = null, lastAt = 0;
  function pageview() {
    var url = location.pathname + location.search + (attr("hash") === "true" ? location.hash : "");
    if (url === lastUrl && Date.now() - lastAt < 500) return;
    if (lastUrl !== null) { flushEngagement(); if (d.visibilityState === "visible") visibleSince = Date.now(); }
    lastUrl = url; lastAt = Date.now();
    send("pageview");
  }

  var api_ = {
    track: function (name, props, opts) {
      send("event", name, props, opts && opts.revenue ? { rev: { a: Math.round(opts.revenue.amount), c: opts.revenue.currency } } : null);
    },
    pageview: pageview,
    identify: function (userId) {
      if (!product) return console.warn("[waypoint] identify() needs Product mode");
      stored("wp_uid", String(userId));
    },
    reset: function () { stored("wp_uid", null); stored("wp_vid", null); },
    getVisitorId: function () { return product ? vid() : null; },
    optOut: function () { try { ls.setItem("wp_ignore", "1"); } catch (e) {} },
    optIn: function () { try { ls.removeItem("wp_ignore"); } catch (e) {} },
  };

  // Replay calls queued before the script loaded: window.waypoint = window.waypoint || function(){(waypoint.q=waypoint.q||[]).push(arguments)}
  var queued = (w.waypoint && w.waypoint.q) || [];
  w.waypoint = function (method) { var f = api_[method]; if (f) return f.apply(null, [].slice.call(arguments, 1)); };
  for (var m in api_) w.waypoint[m] = api_[m];
  for (var q = 0; q < queued.length; q++) w.waypoint.apply(null, queued[q]);

  // Clicks: declarative events, outbound links, file downloads.
  d.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-waypoint-event],a[href]") : null;
    if (!el) return;
    var name = el.getAttribute("data-waypoint-event");
    if (name) {
      var props = {};
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf("data-waypoint-prop-") === 0) props[a.name.slice(19)] = a.value;
      }
      return api_.track(name, props);
    }
    var href = el.href;
    if (!href || !/^https?:/.test(href)) return;
    var u = new URL(href);
    if (attr("downloads") !== "false" && /\.(pdf|zip|dmg|exe|msi|pkg|csv|xlsx?|docx?|pptx?|mp4|mp3|apk|gz|rar|7z)$/i.test(u.pathname)) {
      api_.track("file_download", { url: href });
    } else if (attr("outbound") !== "false" && u.hostname !== location.hostname) {
      api_.track("outbound_click", { url: href });
    }
  }, true);

  if (attr("auto-pageview") !== "false") {
    var push = history.pushState;
    history.pushState = function () { push.apply(this, arguments); pageview(); };
    var replace = history.replaceState;
    history.replaceState = function () { replace.apply(this, arguments); if (location.pathname + location.search !== (lastUrl || "").split("#")[0]) pageview(); };
    w.addEventListener("popstate", pageview);
    if (attr("hash") === "true") w.addEventListener("hashchange", pageview);
    pageview();
  }
})();
