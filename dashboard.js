(function () {
  "use strict";
  var selectedServer = null;
  var settings = null;
  var profile = null;
  var saveTimer = null;
  var servers = [];
  var defaults = [
    { id: "police-traffic", label: "Traffic stop", text: "Dispatch, show me out on a traffic stop." },
    { id: "police-available", label: "Available", text: "Dispatch, show me available for calls." },
    { id: "police-responding", label: "Responding", text: "Dispatch, I am responding code 2." },
    { id: "police-scene", label: "On scene", text: "Dispatch, show me on scene." },
    { id: "police-backup", label: "Request backup", text: "Dispatch, send me another unit for backup." },
    { id: "police-clear", label: "Clear call", text: "Dispatch, I am clear from the call and back in service." }
  ];
  var $ = function (id) { return document.getElementById(id); };

  function notice(message) { $("dashboardNotice").textContent = message; $("dashboardNotice").hidden = !message; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function avatarUrl(user) {
    if (user.avatar) return "https://cdn.discordapp.com/avatars/" + encodeURIComponent(user.id) + "/" + encodeURIComponent(user.avatar) + ".png?size=96";
    return "https://cdn.discordapp.com/embed/avatars/" + (Number(user.discriminator) % 5 || 0) + ".png";
  }

  function drawServers() {
    var list = $("serverList");
    if (!servers.length) { list.innerHTML = '<p class="dashboard-empty-copy">No Discord servers found for this account.</p>'; return; }
    list.innerHTML = servers.map(function (server) {
      var avatar = server.icon ? '<img src="' + escapeHtml(server.icon) + '" alt="" />' : '<span class="dashboard-server-avatar">' + escapeHtml(server.name.slice(0, 1).toUpperCase()) + '</span>';
      return '<button type="button" class="dashboard-server-button' + (selectedServer && selectedServer.id === server.id ? ' is-active' : '') + '" data-server="' + escapeHtml(server.id) + '">' + avatar + '<span class="dashboard-server-name"><strong>' + escapeHtml(server.name) + '</strong><small>Open radio settings</small></span></button>';
    }).join("");
    list.querySelectorAll("[data-server]").forEach(function (button) {
      button.addEventListener("click", function () { chooseServer(servers.find(function (server) { return server.id === button.dataset.server; })); });
    });
  }

  function renderPresets() {
    var list = $("presetList");
    list.innerHTML = "";
    (settings.presets || []).forEach(function (preset, index) {
      var row = document.createElement("div");
      row.className = "dashboard-preset";
      row.innerHTML = '<input type="text" maxlength="40" aria-label="Phrase name" placeholder="Phrase name" value="' + escapeHtml(preset.label) + '"><textarea maxlength="500" aria-label="Phrase text" placeholder="Phrase text">' + escapeHtml(preset.text) + '</textarea><button type="button" class="dashboard-preset-remove" aria-label="Remove phrase" title="Remove phrase">×</button>';
      var fields = row.querySelectorAll("input,textarea");
      fields[0].addEventListener("input", function () { settings.presets[index].label = fields[0].value; if (fields[0].value.trim() && fields[1].value.trim()) queueSave(); });
      fields[1].addEventListener("input", function () { settings.presets[index].text = fields[1].value; if (fields[0].value.trim() && fields[1].value.trim()) queueSave(); });
      row.querySelector("button").addEventListener("click", function () { settings.presets.splice(index, 1); renderPresets(); queueSave(); });
      list.appendChild(row);
    });
    if (!settings.presets.length) list.innerHTML = '<p class="dashboard-empty-copy">No custom phrases yet. Add one to see it in Atlas Desktop.</p>';
  }

  function applySettings(next) {
    settings = Object.assign({ callSign: "", includeCallSign: false, sayOver: false, voiceStyle: "Natural", voiceRate: 0, voicePitch: 0, presets: defaults.map(function (item) { return Object.assign({}, item); }) }, next || {});
    settings.presets = Array.isArray(settings.presets) ? settings.presets : [];
    $("callSign").value = settings.callSign || "";
    $("voiceStyle").value = settings.voiceStyle || "Natural";
    $("includeCallSign").checked = Boolean(settings.includeCallSign);
    $("sayOver").checked = Boolean(settings.sayOver);
    renderPresets();
  }

  async function chooseServer(server) {
    if (!server) return;
    selectedServer = server;
    drawServers();
    $("emptyState").hidden = true;
    $("editorContent").hidden = false;
    $("editorName").textContent = server.name;
    $("editorIcon").src = server.icon || "";
    $("editorIcon").hidden = !server.icon;
    $("saveStatus").textContent = "Loading settings…";
    try {
      var response = await fetch("/api/dashboard/settings?guildId=" + encodeURIComponent(server.id), { credentials: "same-origin", cache: "no-store" });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load server settings.");
      applySettings(data.settings);
      $("saveStatus").textContent = "Saved settings are shared with Atlas Desktop.";
      location.hash = "settings";
    } catch (error) {
      applySettings(null);
      if (error.message === "settings_storage_not_configured") notice("Shared settings are not enabled yet. Add KV_REST_API_URL and KV_REST_API_TOKEN in Vercel to sync settings between this dashboard and Atlas Desktop.");
      else notice("Could not load saved settings. Please try again.");
      $("saveStatus").textContent = "Settings storage is unavailable.";
    }
  }

  async function saveSettings() {
    if (!selectedServer || !settings) return;
    clearTimeout(saveTimer);
    $("saveButton").disabled = true;
    $("saveStatus").textContent = "Saving…";
    try {
      settings.callSign = $("callSign").value;
      settings.voiceStyle = $("voiceStyle").value;
      settings.includeCallSign = $("includeCallSign").checked;
      settings.sayOver = $("sayOver").checked;
      var response = await fetch("/api/dashboard/settings?guildId=" + encodeURIComponent(selectedServer.id), {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings)
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save settings.");
      settings = data.settings;
      $("saveStatus").textContent = "Saved · available in Atlas Desktop";
      notice("");
    } catch (error) {
      $("saveStatus").textContent = "Could not save settings.";
      if (error.message === "settings_storage_not_configured") notice("Add KV_REST_API_URL and KV_REST_API_TOKEN in Vercel to enable shared website and desktop settings.");
      else notice("Settings could not be saved. Check your connection and try again.");
    } finally { $("saveButton").disabled = false; }
  }
  function queueSave() { if (!settings) return; $("saveStatus").textContent = "Unsaved changes"; clearTimeout(saveTimer); saveTimer = setTimeout(saveSettings, 1200); }

  function renderProfile(user) {
    profile = user;
    var button = $("userButton");
    button.hidden = !user;
    if (!user) return;
    button.innerHTML = '<img src="' + escapeHtml(avatarUrl(user)) + '" alt=""><span>' + escapeHtml(user.global_name || user.username) + '</span>⌄';
    $("profileDetails").textContent = (user.global_name || user.username) + " · @" + user.username;
    $("userSettings").hidden = false;
  }

  async function loadDashboard() {
    try {
      var profileResponse = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      if (!profileResponse.ok) throw new Error("not_authenticated");
      renderProfile(await profileResponse.json());
      $("signinPanel").hidden = true;
      $("dashboardContent").hidden = false;
      var response = await fetch("/api/discord/servers", { credentials: "same-origin", cache: "no-store" });
      var data = await response.json();
      if (!response.ok) {
        if (data.error === "discord_scope_missing") throw new Error("discord_scope_missing");
        if (data.error === "discord_unavailable") throw new Error("discord_unavailable");
        throw new Error(data.error || "Could not load servers.");
      }
      servers = data.servers || [];
      drawServers();
      if (servers.length) await chooseServer(servers[0]);
    } catch (error) {
      if (error.message === "not_authenticated" || error.message === "unauthorized") {
        $("signinPanel").hidden = false;
        $("dashboardContent").hidden = true;
        $("userSettings").hidden = true;
        return;
      }
      if (error.message === "discord_scope_missing") notice("Your Discord session needs the server-list permission. Log out, then continue with Discord and accept the requested access.");
      else if (error.message === "discord_unavailable") notice("Discord could not return your server list. Check your connection and try again.");
      else notice("Could not load your Discord servers. Refresh and try again.");
    }
  }

  async function connectDiscord() {
    try {
      var verifierBytes = new Uint8Array(32); crypto.getRandomValues(verifierBytes);
      var verifier = Array.from(verifierBytes).map(function (value) { return value.toString(16).padStart(2, "0"); }).join("");
      var digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      var challenge = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      var state = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(function (value) { return value.toString(16).padStart(2, "0"); }).join("");
      sessionStorage.setItem("atlas_oauth_state", state);
      window.location.href = "/api/auth/start?state=" + encodeURIComponent(state) + "&challenge=" + encodeURIComponent(challenge) + "&verifier=" + encodeURIComponent(verifier) + "&return_to=%2Fdashboard";
    } catch (_) { notice("Could not start Discord sign-in. Please use the Log in button on the Atlas home page."); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(function () {});
    window.location.href = "/";
  }

  var callback = new URLSearchParams(location.search);
  if (callback.has("atlas_session") || callback.has("atlas_error")) {
    var savedState = sessionStorage.getItem("atlas_oauth_state");
    if (!savedState || savedState !== callback.get("state")) notice("Discord sign-in expired. Please try again.");
    else if (callback.has("atlas_error")) notice("Discord sign-in could not be completed. Please try again.");
    sessionStorage.removeItem("atlas_oauth_state");
    history.replaceState(null, "", "/dashboard" + (location.hash || ""));
  }

  $("connectButton").addEventListener("click", connectDiscord);
  $("refreshButton").addEventListener("click", function () { void loadDashboard(); });
  $("saveButton").addEventListener("click", function () { void saveSettings(); });
  $("addPreset").addEventListener("click", function () {
    if (!settings || settings.presets.length >= 40) return notice("You can save up to 40 quick phrases per server.");
    settings.presets.push({ id: "web-" + Date.now(), label: "New phrase", text: "" });
    renderPresets(); queueSave();
  });
  ["callSign", "voiceStyle", "includeCallSign", "sayOver"].forEach(function (id) { $(id).addEventListener("input", queueSave); $(id).addEventListener("change", queueSave); });
  $("userButton").addEventListener("click", function () { $("userMenu").hidden = !$("userMenu").hidden; });
  $("logoutButton").addEventListener("click", logout);
  $("settingsLogout").addEventListener("click", logout);
  document.addEventListener("click", function (event) { if (!$("userMenu").hidden && !$("userMenu").contains(event.target) && !$("userButton").contains(event.target)) $("userMenu").hidden = true; });
  if (location.hash === "#settings") $("userSettings").hidden = false;
  void loadDashboard();
})();
