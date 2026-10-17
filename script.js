/* Atlas — landing page interactions (vanilla, no dependencies) */

(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================================================================
     Configuration.
     - On Vercel, values come from environment variables via /api/config
       (DISCORD_CLIENT_ID, DEVELOPER_IDS — see .env.example).
     - Elsewhere (GitHub Pages, plain static hosting), the hardcoded
       fallbacks below are used.
     ================================================================ */

  var FALLBACK_CLIENT_ID = "";
  var FALLBACK_DEVELOPER_IDS = [];

  var CONFIG = { clientId: FALLBACK_CLIENT_ID, developerIds: FALLBACK_DEVELOPER_IDS };

  var TOKEN_KEY = "atlas_discord_token";

  /* ================================================================
     Bans. Local bans live in localStorage; HARDCODED_BANNED_IDS ships
     with the site and applies everywhere. Export from the dev panel
     and paste here to make a ban permanent for everyone.
     NOTE: client-side enforcement only on a static site — mirror the
     ban list in the desktop app's backend when it ships.
     ================================================================ */

  var HARDCODED_BANNED_IDS = [];
  var BANS_KEY = "atlas_bans";

  function toast(message) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-show");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove("is-show");
    }, 3200);
  }

  /* ---------- config ---------- */

  function loadRemoteConfig() {
    if (location.protocol === "file:") return Promise.resolve();
    return fetch("/api/config")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) {
        if (!remote) return;
        if (remote.clientId) CONFIG.clientId = remote.clientId;
        if (Array.isArray(remote.developerIds) && remote.developerIds.length) {
          CONFIG.developerIds = remote.developerIds;
        }
      })
      .catch(function () { /* static hosting — fallbacks already in place */ });
  }

  /* ---------- ban storage ---------- */

  function getBans() {
    try {
      var raw = JSON.parse(localStorage.getItem(BANS_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter(function (b) { return b && b.id; }) : [];
    } catch (e) {
      return [];
    }
  }

  function setBans(bans) {
    try { localStorage.setItem(BANS_KEY, JSON.stringify(bans)); } catch (e) { /* ignore */ }
  }

  function isUserBanned(userId) {
    if (!userId) return null;
    if (HARDCODED_BANNED_IDS.indexOf(String(userId)) !== -1) {
      return { id: String(userId), reason: "Banned by the Atlas team." };
    }
    var stored = getBans();
    for (var i = 0; i < stored.length; i++) {
      if (String(stored[i].id) === String(userId)) return stored[i];
    }
    return null;
  }

  function addBan(id, reason) {
    var bans = getBans().filter(function (b) { return String(b.id) !== String(id); });
    bans.push({ id: String(id), reason: reason || "Banned by the Atlas team.", at: new Date().toISOString() });
    setBans(bans);
    return bans;
  }

  function removeBan(id) {
    var bans = getBans().filter(function (b) { return String(b.id) !== String(id); });
    setBans(bans);
    return bans;
  }

  function showBanOverlay(ban) {
    var old = document.getElementById("banOverlay");
    if (old) old.remove();
    var overlay = document.createElement("div");
    overlay.id = "banOverlay";
    overlay.className = "ban-overlay";
    overlay.innerHTML =
      '<div class="ban-overlay__card">' +
      '<h2>Access restricted</h2>' +
      '<p>This Discord account is banned from Atlas.</p>' +
      (ban && ban.reason ? '<p class="ban-overlay__reason">' + ban.reason + '</p>' : '') +
      '<p class="ban-overlay__meta">If you believe this is a mistake, appeal in the Atlas Discord.</p>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  /* ---------- discord login ---------- */

  function discordAvatarUrl(user) {
    return user.avatar
      ? "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png?size=64"
      : "https://cdn.discordapp.com/embed/avatars/" + (Number(user.discriminator) % 5 || 0) + ".png";
  }

  function currentUser() {
    var btn = document.getElementById("discordLogin");
    return btn && btn._user ? btn._user : null;
  }

  function isDeveloper(user) {
    if (!user) return false;
    return CONFIG.developerIds.map(String).indexOf(String(user.id)) !== -1;
  }

  function renderLogin(user) {
    var btn = document.getElementById("discordLogin");
    if (!btn) return;
    btn._user = user || null;
    if (user) {
      btn.classList.add("is-user");
      btn.innerHTML =
        '<img class="nav__avatar" src="' + discordAvatarUrl(user) + '" alt="" />' +
        '<span>' + (user.global_name || user.username) + '</span>';
      btn.removeAttribute("href");
      btn.setAttribute("role", "button");
      btn.title = "Log out";
    } else {
      btn.classList.remove("is-user");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.04.03C.53 9.05-.32 13.58.1 18.06c0 .02.02.05.04.06a19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.1 13 13 0 0 1-1.87-.9.08.08 0 0 1-.01-.12c.13-.1.25-.19.37-.29a.07.07 0 0 1 .08 0 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0c.12.1.25.2.37.3a.08.08 0 0 1 0 .12 12.3 12.3 0 0 1-1.88.9.08.08 0 0 0-.04.1c.36.7.77 1.36 1.22 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.02-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.22 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"/></svg><span>Log in</span>';
      btn.setAttribute("href", "#");
      btn.removeAttribute("role");
      btn.removeAttribute("title");
    }
    if (devPanel && devPanel.classList.contains("is-open")) refreshDevLock();
  }

  function handleAuthCallback() {
    var hash = location.hash;
    if (hash.indexOf("access_token=") === -1) return false;
    var params = new URLSearchParams(hash.slice(1));
    var token = params.get("access_token");
    var state = params.get("state");
    var savedState = null;
    try { savedState = sessionStorage.getItem("atlas_oauth_state"); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem("atlas_oauth_state"); } catch (e) { /* ignore */ }
    history.replaceState(null, "", location.pathname + location.search);
    if (!token || (savedState && state !== savedState)) {
      toast("Discord sign-in was cancelled or expired.");
      return true;
    }
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) { /* ignore */ }
    return true;
  }

  function onUserLoaded(user) {
    var ban = isUserBanned(user.id);
    if (ban) {
      try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
      renderLogin(null);
      showBanOverlay(ban);
      return;
    }
    renderLogin(user);
  }

  function loadUser() {
    var token = null;
    try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    if (!token) return;
    fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: "Bearer " + token }
    })
      .then(function (r) {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then(onUserLoaded)
      .catch(function () {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
        renderLogin(null);
      });
  }

  function loginUrl() {
    var redirect = location.origin + location.pathname;
    var state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem("atlas_oauth_state", state); } catch (e) { /* ignore */ }
    return (
      "https://discord.com/oauth2/authorize" +
      "?client_id=" + encodeURIComponent(CONFIG.clientId) +
      "&response_type=token" +
      "&redirect_uri=" + encodeURIComponent(redirect) +
      "&scope=identify" +
      "&state=" + encodeURIComponent(state)
    );
  }

  function startDiscordLogin() {
    if (!CONFIG.clientId) {
      toast("Discord login isn't configured — set DISCORD_CLIENT_ID (see .env.example).");
      return;
    }
    location.href = loginUrl();
  }

  function initDiscordLogin() {
    var btn = document.getElementById("discordLogin");
    if (!btn) return;
    if (handleAuthCallback()) loadUser();

    btn.addEventListener("click", function (e) {
      if (btn.classList.contains("is-user")) {
        e.preventDefault();
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (err) { /* ignore */ }
        renderLogin(null);
        toast("Logged out of Discord.");
        return;
      }
      e.preventDefault();
      startDiscordLogin();
    });
  }

  /* ================================================================
     Developer panel — Ctrl+Shift+D or #dev.
     Access requires signing in with a Discord account whose ID is in
     CONFIG.developerIds (set via the DEVELOPER_IDS env var on Vercel).
     ================================================================ */

  var devPanel = null;

  function renderBanList() {
    if (!devPanel) return;
    var list = devPanel.querySelector(".dev__bans");
    if (!list) return;
    var bans = getBans();
    var hardcoded = HARDCODED_BANNED_IDS.map(String);
    if (!bans.length && !hardcoded.length) {
      list.innerHTML = '<p class="dev__empty">No bans yet.</p>';
      return;
    }
    list.innerHTML = "";
    hardcoded.forEach(function (id) {
      var row = document.createElement("div");
      row.className = "dev__ban";
      row.innerHTML = '<code>' + id + '</code><span>permanent (shipped in script.js)</span>';
      list.appendChild(row);
    });
    bans.forEach(function (ban) {
      var row = document.createElement("div");
      row.className = "dev__ban";
      var code = document.createElement("code");
      code.textContent = ban.id;
      var reason = document.createElement("span");
      reason.textContent = ban.reason || "";
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "dev__btn dev__btn--danger";
      remove.textContent = "Unban";
      remove.addEventListener("click", function () {
        removeBan(ban.id);
        renderBanList();
        toast("Unbanned " + ban.id + ".");
      });
      row.appendChild(code);
      row.appendChild(reason);
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  function setDevStatus(message) {
    var status = devPanel ? devPanel.querySelector(".dev__status") : null;
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !message;
  }

  function refreshDevLock() {
    if (!devPanel || !devPanel.classList.contains("is-open")) return;
    var user = currentUser();
    if (isDeveloper(user)) {
      devPanel.querySelector(".dev__lock").hidden = true;
      devPanel.querySelector(".dev__main").hidden = false;
      setDevStatus("");
      var banSelf = devPanel.querySelector("[data-banself]");
      if (banSelf) banSelf.hidden = false;
      renderBanList();
    } else {
      devPanel.querySelector(".dev__lock").hidden = false;
      devPanel.querySelector(".dev__main").hidden = true;
      if (user) {
        setDevStatus("Signed in as " + (user.global_name || user.username) + " — that account isn't a developer.");
      } else {
        setDevStatus("");
      }
    }
  }

  function buildDevPanel() {
    devPanel = document.createElement("aside");
    devPanel.id = "devPanel";
    devPanel.className = "dev";
    devPanel.setAttribute("role", "dialog");
    devPanel.setAttribute("aria-label", "Atlas developer panel");
    devPanel.innerHTML =
      '<header class="dev__head">' +
      '<strong>Atlas developer panel</strong>' +
      '<button type="button" class="dev__btn" data-close>Close</button>' +
      '</header>' +
      '<div class="dev__body">' +
      '<div class="dev__lock">' +
      '<p class="dev__hint">Developer access is tied to specific Discord accounts. Sign in with a developer account to continue.</p>' +
      '<button type="button" class="dev__btn dev__btn--primary dev__discord" data-discord>Continue with Discord</button>' +
      '<p class="dev__status" hidden></p>' +
      '</div>' +
      '<div class="dev__main" hidden>' +
      '<p class="dev__hint">Bans block Discord sign-in and show a restriction notice. Export and paste into <code>HARDCODED_BANNED_IDS</code> in script.js to make them permanent for everyone.</p>' +
      '<div class="dev__row">' +
      '<input class="dev__input dev__id" placeholder="Discord user ID" aria-label="Discord user ID to ban" />' +
      '<input class="dev__input dev__reason" placeholder="Reason (optional)" aria-label="Ban reason" />' +
      '<button type="button" class="dev__btn dev__btn--primary" data-add>Ban</button>' +
      '</div>' +
      '<button type="button" class="dev__btn dev__banself" data-banself hidden>Ban the logged-in user</button>' +
      '<div class="dev__bans"></div>' +
      '<div class="dev__io">' +
      '<textarea class="dev__area" rows="4" aria-label="Ban list JSON import/export"></textarea>' +
      '<div class="dev__row">' +
      '<button type="button" class="dev__btn" data-export>Export JSON</button>' +
      '<button type="button" class="dev__btn" data-import>Import JSON</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(devPanel);

    devPanel.querySelector("[data-close]").addEventListener("click", closeDevPanel);
    devPanel.querySelector("[data-discord]").addEventListener("click", startDiscordLogin);
    devPanel.querySelector("[data-add]").addEventListener("click", function () {
      var id = devPanel.querySelector(".dev__id").value.trim();
      var reason = devPanel.querySelector(".dev__reason").value.trim();
      if (!/^\d{5,}$/.test(id)) {
        toast("Enter a numeric Discord user ID.");
        return;
      }
      addBan(id, reason);
      devPanel.querySelector(".dev__id").value = "";
      devPanel.querySelector(".dev__reason").value = "";
      renderBanList();
      toast("Banned " + id + ".");
    });
    devPanel.querySelector("[data-banself]").addEventListener("click", function () {
      var user = currentUser();
      if (!user) return;
      addBan(user.id, "Banned from the developer panel.");
      try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
      renderLogin(null);
      renderBanList();
      showBanOverlay({ reason: "Banned from the developer panel." });
    });
    devPanel.querySelector("[data-export]").addEventListener("click", function () {
      devPanel.querySelector(".dev__area").value = JSON.stringify(
        getBans().map(function (b) { return b.id; }),
        null, 2
      );
    });
    devPanel.querySelector("[data-import]").addEventListener("click", function () {
      var raw = devPanel.querySelector(".dev__area").value.trim();
      if (!raw) {
        toast("Paste a JSON array of IDs first.");
        return;
      }
      try {
        var ids = JSON.parse(raw);
        if (!Array.isArray(ids)) throw new Error("not an array");
        ids.forEach(function (id) { addBan(String(id), "Imported ban."); });
        renderBanList();
        toast("Imported " + ids.length + " ban(s).");
      } catch (err) {
        toast("That isn't valid JSON.");
      }
    });

    renderBanList();
  }

  function openDevPanel() {
    if (!devPanel) buildDevPanel();
    devPanel.classList.add("is-open");
    refreshDevLock();
  }

  function closeDevPanel() {
    if (devPanel) devPanel.classList.remove("is-open");
  }

  function initDevPanel() {
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (devPanel && devPanel.classList.contains("is-open")) closeDevPanel();
        else openDevPanel();
      }
      if (e.key === "Escape") closeDevPanel();
    });
    if (location.hash === "#dev") {
      history.replaceState(null, "", location.pathname + location.search);
      openDevPanel();
    }
  }

  /* ---------- mobile nav ---------- */

  var burger = document.getElementById("navBurger");
  var links = document.getElementById("navLinks");
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- FAQ accordion ---------- */

  document.querySelectorAll(".faq__q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var expanded = btn.getAttribute("aria-expanded") === "true";
      document.querySelectorAll('.faq__q[aria-expanded="true"]').forEach(function (other) {
        if (other !== btn) {
          other.setAttribute("aria-expanded", "false");
          other.closest(".faq__item").querySelector(".faq__a").style.gridTemplateRows = "0fr";
        }
      });
      btn.setAttribute("aria-expanded", String(!expanded));
      btn.closest(".faq__item").querySelector(".faq__a").style.gridTemplateRows = expanded ? "0fr" : "1fr";
    });
  });

  /* ---------- reveal on scroll ---------- */

  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- footer year ---------- */

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- boot ---------- */

  loadRemoteConfig().then(function () {
    initDiscordLogin();
    initDevPanel();

    /* Debug/testing hooks — harmless client-side (bans are per-browser),
       used by automated verification. Remove if you like. */
    window.__atlas = {
      config: function () { return JSON.parse(JSON.stringify(CONFIG)); },
      getBans: getBans,
      isUserBanned: isUserBanned,
      addBan: addBan,
      removeBan: removeBan,
      setDeveloperIds: function (ids) { CONFIG.developerIds = ids.map(String); },
      testLoginAs: function (user) { onUserLoaded(user); },
      dev: { open: openDevPanel, close: closeDevPanel, refresh: refreshDevLock }
    };
  });
})();
