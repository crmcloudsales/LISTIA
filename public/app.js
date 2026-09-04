const CFG = window.LISTIA_CONFIG || {};
const API_KEY = CFG.SUPABASE_PUBLISHABLE_KEY || CFG.SUPABASE_ANON_KEY || "";
const SESSION_KEY = "listia_session";
const I18N = window.LISTIA_I18N || null;
const t = (key, vars = {}) => I18N ? I18N.t(key, vars) : key;
const getLanguage = () => I18N ? I18N.getLanguage() : "en";

function localizeError(error) {
  const raw = String(error?.message || error || "");
  const known = {
    "Invalid login credentials": "msg.invalid_login",
    "Email not confirmed": "msg.email_not_confirmed",
    "User already registered": "msg.user_exists",
    "Signup requires a valid password": "msg.password_min8_signup",
    "property_limit_reached": "msg.free_property_limit",
    "material_required": "msg.property_material_required",
    "rate_limited": "msg.rate_limited"
  };
  if (known[raw]) return t(known[raw]);
  const localKeys = [
    "msg.session_expired",
    "msg.workspace_created_load_error",
    "msg.business_not_found",
    "msg.google_not_ready",
    "msg.google_first",
    "msg.discovery_completed"
  ];
  if (localKeys.some(key => raw === t(key))) return raw;
  if (raw === "property_limit_reached") return t("msg.free_property_limit");
  if (raw === "material_required") return t("msg.property_material_required");
  if (raw === "file_too_large") return t("msg.file_too_large");
  if (raw === "file_type_not_allowed") return t("msg.file_type_not_allowed");
  if (raw === "upload_failed") return t("msg.upload_failed");
  return t("msg.generic_error");
}

const isConfigured = () => Boolean(
  CFG.SUPABASE_URL &&
  API_KEY &&
  !CFG.SUPABASE_URL.includes("PASTE_") &&
  !API_KEY.includes("PASTE_")
);

const $ = id => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];
const toast = $("toast");

function go(name) {
  screens.forEach(s => s.classList.toggle("active", s.id === `screen-${name}`));
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.querySelectorAll("[data-go]").forEach(b => {
  b.addEventListener("click", () => go(b.dataset.go));
});

const languageSelect = $("languageSelect");
if (languageSelect && I18N) {
  languageSelect.value = getLanguage();
  languageSelect.addEventListener("change", () => {
    I18N.setLanguage(languageSelect.value, { persist: true });
  });
}

let localeSyncTimer = 0;
window.addEventListener("listia:languagechange", event => {
  clearTimeout(localeSyncTimer);
  localeSyncTimer = window.setTimeout(async () => {
    const language = event.detail?.language;
    const session = readSession();
    if (!language || !session?.access_token) return;

    try {
      const user = session.user?.id ? session.user : await getCurrentUser(session);
      const updates = [
        api("/auth/v1/user", {
          method: "PUT",
          accessToken: session.access_token,
          body: { data: { locale: language } }
        })
      ];
      if (user?.id) {
        updates.push(api(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
          method: "PATCH",
          accessToken: session.access_token,
          extraHeaders: { Prefer: "return=minimal" },
          body: { locale: language }
        }));
      }
      await Promise.allSettled(updates);
    } catch (error) {
      console.warn("LISTIA locale preference could not be synchronized", error);
    }
  }, 250);
});

function message(text, type = "") {
  toast.textContent = text;
  toast.className = `toast ${type}`.trim();
  toast.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

document.querySelectorAll("[data-toggle-password]").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = $(btn.dataset.togglePassword);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const label = show ? t("common.hide") : t("common.show");
    btn.textContent = label;
    btn.setAttribute("aria-label", label);
  });
});

window.addEventListener("listia:languagechange", () => {
  document.querySelectorAll("[data-toggle-password]").forEach(btn => {
    const input = $(btn.dataset.togglePassword);
    const label = input?.type === "text" ? t("common.hide") : t("common.show");
    btn.textContent = label;
    btn.setAttribute("aria-label", label);
  });
  if (discoveryContext?.org) renderDiscoveryState();
  if (officeContext?.org) {
    renderPropertyList();
    const google = $("officeGoogleState");
    if (google) google.textContent = officeContext.connection?.status === "connected" ? t("office.google_connected") : t("office.google_not_connected");
  }
  renderSelectedFiles();
});

async function api(path, { method = "GET", body, accessToken, extraHeaders = {} } = {}) {
  if (!isConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");

  const headers = {
    apikey: API_KEY,
    ...extraHeaders
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${CFG.SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { message: text }; }
  }

  if (!res.ok) {
    const msg = data.msg || data.message || data.error_description || data.error || data.hint || `Error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(data) {
  if (!data?.access_token) return null;
  const existing = readSession() || {};
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || existing.refresh_token || "",
    expires_at: Date.now() + (Number(data.expires_in || 3600) * 1000),
    user: data.user || existing.user || null
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  try {
    const data = await api("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token }
    });
    return saveSession(data);
  } catch {
    clearSession();
    return null;
  }
}

async function getValidSession() {
  const session = readSession();
  if (!session?.access_token) return null;
  if ((session.expires_at || 0) > Date.now() + 30000) return session;
  return refreshSession(session);
}

function consumeAuthHash() {
  if (!location.hash || !location.hash.includes("access_token=")) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  const data = {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") || "",
    expires_in: Number(params.get("expires_in") || 3600)
  };
  saveSession(data);
  const type = params.get("type") || "";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  return type;
}

async function getCurrentUser(session) {
  const data = await api("/auth/v1/user", { accessToken: session.access_token });
  const saved = readSession();
  if (saved) {
    saved.user = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
  }
  return data;
}

async function getUserOrganization(session, userId) {
  let membership = null;

  if (window.LISTIA_WORKSPACE?.getActiveWorkspace) {
    try {
      const active = await window.LISTIA_WORKSPACE.getActiveWorkspace({ force: true });
      if (active?.organization_id) {
        membership = { organization_id: active.organization_id, role: active.role || "member" };
      }
    } catch (error) {
      console.warn("LISTIA canonical workspace unavailable; using deterministic membership fallback", error);
    }
  }

  if (!membership?.organization_id) {
    const memberPath = `/rest/v1/organization_members?select=organization_id,role,status,created_at&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc,organization_id.asc&limit=1`;
    const memberships = await api(memberPath, { accessToken: session.access_token });
    membership = Array.isArray(memberships) ? memberships[0] : null;
  }

  if (!membership?.organization_id) return null;
  const orgPath = `/rest/v1/organizations?select=id,name,business_type,primary_market,onboarding_completed&id=eq.${encodeURIComponent(membership.organization_id)}&limit=1`;
  const organizations = await api(orgPath, { accessToken: session.access_token });
  const org = Array.isArray(organizations) ? organizations[0] : null;
  if (!org) return null;
  return { ...org, membership_role: membership.role };
}

async function getOnboardingState(session, organizationId) {
  const path = `/rest/v1/organization_onboarding?select=organization_id,current_step,selected_plan,completed_steps,ecosystem_preferences,discovery_inputs,business_dna,validation_state&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`;
  const rows = await api(path, { accessToken: session.access_token });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function updateOnboardingState(session, organizationId, patch) {
  await api(`/rest/v1/organization_onboarding?organization_id=eq.${encodeURIComponent(organizationId)}`, {
    method: "PATCH",
    accessToken: session.access_token,
    extraHeaders: { Prefer: "return=minimal" },
    body: { ...patch, updated_at: new Date().toISOString() }
  });
}

async function getGoogleConnection(session, organizationId) {
  const path = `/rest/v1/integration_connections?select=id,provider,status,external_account_email,display_name,granted_scopes,metadata,connected_at&organization_id=eq.${encodeURIComponent(organizationId)}&provider=eq.google&status=eq.connected&order=connected_at.desc&limit=1`;
  const rows = await api(path, { accessToken: session.access_token });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getDiscoveryItems(session, organizationId) {
  const path = `/rest/v1/discovery_items?select=id,source_type,source_key,name,mime_type,candidate_type,selected,import_status,source_modified_at,metadata&organization_id=eq.${encodeURIComponent(organizationId)}&order=source_modified_at.desc.nullslast,created_at.desc`;
  const rows = await api(path, { accessToken: session.access_token });
  return Array.isArray(rows) ? rows : [];
}

async function updateDiscoverySelection(session, itemId, selected) {
  await api(`/rest/v1/discovery_items?id=eq.${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    accessToken: session.access_token,
    extraHeaders: { Prefer: "return=minimal" },
    body: { selected: Boolean(selected) }
  });
}

let discoveryContext = {
  org: null,
  session: null,
  connection: null,
  result: null,
  items: []
};

function candidateLabel(type) {
  const key = `discovery.type_${type || "other"}`;
  const translated = t(key);
  return translated === key ? String(type || "other").replaceAll("_", " ") : translated;
}

function renderDiscoveryItems() {
  const wrap = $("discoveryItems");
  if (!wrap) return;

  const driveItems = (discoveryContext.items || []).filter(item => item.source_type === "google_drive");
  wrap.replaceChildren();
  wrap.hidden = driveItems.length === 0;

  for (const item of driveItems) {
    const row = document.createElement("label");
    row.className = "discovery-item";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = item.selected !== false;
    check.setAttribute("aria-label", item.name || "Drive file");
    check.addEventListener("change", async () => {
      const desired = check.checked;
      check.disabled = true;
      try {
        const session = await getValidSession();
        if (!session) throw new Error(t("msg.session_expired"));
        await updateDiscoverySelection(session, item.id, desired);
        item.selected = desired;
      } catch (err) {
        check.checked = !desired;
        message(localizeError(err), "error");
      } finally {
        check.disabled = false;
      }
    });

    const copy = document.createElement("span");
    copy.className = "discovery-item-copy";
    const name = document.createElement("strong");
    name.textContent = item.name || t("discovery.untitled");
    const meta = document.createElement("small");
    meta.textContent = candidateLabel(item.candidate_type);
    copy.append(name, meta);

    row.append(check, copy);
    wrap.append(row);
  }
}

function renderDiscoveryState() {
  const connection = discoveryContext.connection;
  const result = discoveryContext.result;
  const items = discoveryContext.items || [];
  const driveItems = items.filter(item => item.source_type === "google_drive");

  const googleStatus = $("checkpointGoogleStatus");
  if (googleStatus) {
    googleStatus.textContent = connection?.status === "connected"
      ? t("checkpoint.google_connected")
      : t("checkpoint.google_not_connected");
  }

  const email = $("discoveryGoogleEmail");
  if (email) email.textContent = connection?.external_account_email || "";

  const calendar = $("discoveryCalendarState");
  if (calendar) {
    const ready = Boolean(result?.calendar?.ready || connection?.metadata?.calendar_id);
    calendar.textContent = ready ? t("discovery.calendar_ready") : t("discovery.calendar_none");
    calendar.classList.toggle("ready", ready);
  }

  const pill = $("discoveryStatusPill");
  if (pill) pill.textContent = result ? t("discovery.ready") : t("discovery.waiting");

  const summary = $("discoverySummary");
  if (summary) {
    if (!connection) summary.textContent = t("discovery.summary_no_google");
    else if (result?.error) summary.textContent = t("discovery.error");
    else if (driveItems.length) summary.textContent = t("discovery.summary_found", { count: driveItems.length });
    else if (result) summary.textContent = t("discovery.summary_none");
    else summary.textContent = t("discovery.loading");
  }

  const limited = $("discoveryLimitedNote");
  if (limited) limited.hidden = !(connection && result?.drive?.drive_file_scope_limited);

  renderDiscoveryItems();
}

async function scanDiscovery({ silent = false } = {}) {
  const session = await getValidSession();
  if (!session) throw new Error(t("msg.session_expired"));
  const user = await getCurrentUser(session);
  const org = await getUserOrganization(session, user.id);
  if (!org) throw new Error(t("msg.business_not_found"));

  const connection = await getGoogleConnection(session, org.id);
  discoveryContext = { org, session, connection, result: null, items: [] };
  renderDiscoveryState();

  if (!connection) {
    discoveryContext.result = { skipped: true, calendar: { ready: false }, drive: { drive_file_scope_limited: false } };
    renderDiscoveryState();
    return discoveryContext;
  }

  const btn = $("scanDiscoveryBtn");
  const pill = $("discoveryStatusPill");
  if (btn) btn.disabled = true;
  if (pill) pill.textContent = t("discovery.scanning");
  if (!silent) message(t("msg.discovery_loading"));

  try {
    const result = await api("/functions/v1/google-discovery", {
      method: "POST",
      accessToken: session.access_token,
      body: { organization_id: org.id, action: "scan" }
    });
    const items = await getDiscoveryItems(session, org.id);
    discoveryContext = { org, session, connection, result, items };
    renderDiscoveryState();
    if (!silent) message(t("msg.discovery_completed"), "success");
    return discoveryContext;
  } catch (err) {
    console.error("LISTIA discovery", err);
    discoveryContext.result = { error: true, calendar: { ready: Boolean(connection?.metadata?.calendar_id) } };
    renderDiscoveryState();
    if (!silent) message(t("discovery.error"), "error");
    return discoveryContext;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function setPlanSelection(plan) {
  document.querySelectorAll(".plan-card").forEach(card => {
    const selected = card.dataset.plan === plan;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const input = $("selectedPlan");
  if (input) input.value = plan || "";
}

function showPlan(org, onboarding) {
  const business = $("planBusinessName");
  if (business) business.textContent = org?.name || t("common.your_business");
  setPlanSelection(onboarding?.selected_plan || "free");
  go("plan");
}

function showGoogleConnect(org, connection) {
  const business = $("googleBusinessName");
  if (business) business.textContent = org?.name || t("common.your_business");

  const card = $("googleConnectionStatus");
  const connectBtn = $("connectGoogleBtn");
  const continueBtn = $("continueGoogleBtn");

  if (connection?.status === "connected") {
    card.hidden = false;
    card.classList.add("connected");
    $("googleConnectedName").textContent = connection.display_name || "Google";
    $("googleConnectedEmail").textContent = connection.external_account_email || t("common.connected_account");
    connectBtn.hidden = true;
    continueBtn.hidden = false;
  } else {
    card.hidden = true;
    card.classList.remove("connected");
    connectBtn.hidden = false;
    continueBtn.hidden = true;
  }

  go("google");
}

async function showJourneyCheckpoint(org, session) {
  const business = $("checkpointBusinessName");
  if (business) business.textContent = org?.name || t("common.your_workspace");
  const market = $("checkpointBusinessMarket");
  if (market) market.textContent = org?.primary_market || "";
  go("checkpoint");

  try {
    await scanDiscovery({ silent: true });
  } catch (err) {
    console.error("LISTIA discovery checkpoint", err);
    renderDiscoveryState();
  }
}

async function showBusinessDNA(org, session, onboarding = null) {
  const business = $("dnaBusinessName");
  if (business) business.textContent = org?.name || t("common.your_workspace");
  const market = $("dnaBusinessMarket");
  if (market) market.textContent = org?.primary_market || "";

  let connection = null;
  let items = [];
  try {
    connection = await getGoogleConnection(session, org.id);
    items = await getDiscoveryItems(session, org.id);
  } catch (err) {
    console.error("LISTIA Business DNA baseline", err);
  }

  const google = $("dnaGoogleState");
  if (google) google.textContent = connection ? t("dna.connected") : t("dna.not_connected");
  const assets = $("dnaAssetCount");
  if (assets) assets.textContent = String(items.filter(item => item.selected !== false && item.source_type !== "google_calendar").length);

  go("business-dna");
}

let officeContext = { org: null, properties: [], leads: [], appointments: [], connection: null };

async function getProperties(session, organizationId) {
  const path = `/rest/v1/properties?select=id,title,operation_type,description,price,currency,commission_text,location_text,postal_code,status,processing_state,locale,created_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&status=neq.archived&order=created_at.desc`;
  const rows = await api(path, { accessToken: session.access_token });
  return Array.isArray(rows) ? rows : [];
}

async function getLeads(session, organizationId) {
  const path = `/rest/v1/leads?select=id,property_id,status,created_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=created_at.desc`;
  const rows = await api(path, { accessToken: session.access_token });
  return Array.isArray(rows) ? rows : [];
}

async function getAppointments(session, organizationId) {
  const path = `/rest/v1/appointments?select=id,starts_at,status&organization_id=eq.${encodeURIComponent(organizationId)}&status=in.(scheduled,confirmed)&order=starts_at.asc`;
  const rows = await api(path, { accessToken: session.access_token });
  return Array.isArray(rows) ? rows : [];
}

function moneyLabel(property) {
  if (property?.price === null || property?.price === undefined || property?.price === "") return t("properties.no_price");
  const value = Number(property.price);
  if (!Number.isFinite(value)) return t("properties.no_price");
  try {
    return new Intl.NumberFormat(getLanguage(), { style: "currency", currency: property.currency || "MXN", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${property.currency || ""} ${value.toLocaleString()}`.trim();
  }
}

function propertyStatusLabel(status) {
  const key = `properties.status_${status || "material_received"}`;
  const value = t(key);
  return value === key ? String(status || "material_received").replaceAll("_", " ") : value;
}

function renderPropertyList(properties = officeContext.properties || []) {
  const list = $("propertyList");
  const empty = $("propertiesEmpty");
  if (!list || !empty) return;
  list.replaceChildren();
  empty.hidden = properties.length > 0;

  for (const property of properties) {
    const card = document.createElement("article");
    card.className = "property-card";

    const top = document.createElement("div");
    top.className = "property-card-top";
    const titleWrap = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = property.title || t("properties.empty_title");
    const location = document.createElement("small");
    location.textContent = property.location_text || t("properties.no_location");
    titleWrap.append(title, location);
    const status = document.createElement("span");
    status.className = `property-status status-${property.status || "material_received"}`;
    status.textContent = propertyStatusLabel(property.status);
    top.append(titleWrap, status);

    const meta = document.createElement("div");
    meta.className = "property-card-meta";
    const price = document.createElement("b");
    price.textContent = moneyLabel(property);
    const operation = document.createElement("span");
    operation.textContent = property.operation_type === "sale" ? t("properties.sale") : property.operation_type === "rent" ? t("properties.rent") : "LISTIA";
    meta.append(price, operation);

    card.append(top, meta);
    list.append(card);
  }
}

async function refreshOffice() {
  const session = await getValidSession();
  if (!session) throw new Error(t("msg.session_expired"));
  const user = await getCurrentUser(session);
  const org = officeContext.org || await getUserOrganization(session, user.id);
  if (!org) throw new Error(t("msg.business_not_found"));

  const [properties, leads, appointments, connection] = await Promise.all([
    getProperties(session, org.id),
    getLeads(session, org.id),
    getAppointments(session, org.id),
    getGoogleConnection(session, org.id).catch(() => null)
  ]);
  officeContext = { org, properties, leads, appointments, connection };

  const today = new Date().toDateString();
  const todayAppointments = appointments.filter(a => new Date(a.starts_at).toDateString() === today).length;
  const opportunities = leads.filter(l => l.status === "new").length;
  $("officeAppointmentCount").textContent = String(todayAppointments);
  $("officeOpportunityCount").textContent = String(opportunities);
  $("officeLeadCount").textContent = String(leads.length);
  $("officePropertyCount").textContent = String(properties.length);
  const google = $("officeGoogleState");
  if (google) google.textContent = connection?.status === "connected" ? t("office.google_connected") : t("office.google_not_connected");
  renderPropertyList(properties);
}

function showReady(org) {
  officeContext.org = org || officeContext.org;
  const businessName = $("readyBusinessName");
  if (businessName) businessName.textContent = org?.name || t("common.your_workspace");
  const market = $("readyBusinessMarket");
  if (market) market.textContent = org?.primary_market || "";
  go("ready");
  refreshOffice().catch(err => {
    console.error("LISTIA Office", err);
    message(t("msg.workspace_load_error"), "error");
  });
}

async function showProperties() {
  go("properties");
  try {
    await refreshOffice();
    renderPropertyList();
  } catch (err) {
    console.error("LISTIA properties", err);
    message(t("msg.properties_load_error"), "error");
  }
}

async function showPropertyIntake() {
  const session = await getValidSession();
  if (!session) { go("login"); return; }
  const user = await getCurrentUser(session);
  const org = officeContext.org || await getUserOrganization(session, user.id);
  if (!org) throw new Error(t("msg.business_not_found"));
  officeContext.org = org;
  try {
    const onboarding = await getOnboardingState(session, org.id);
    const note = $("intakePlanNote");
    if (note) note.textContent = onboarding?.selected_plan === "free" ? t("intake.free_note") : "";
  } catch {}
  $("propertyMaterialForm")?.reset();
  renderSelectedFiles();
  go("property-intake");
}

function fileMime(file) {
  if (file?.type) return file.type;
  const n = String(file?.name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (/\.(jpg|jpeg)$/.test(n)) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".csv")) return "text/csv";
  if (n.endsWith(".xls")) return "application/vnd.ms-excel";
  if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".doc")) return "application/msword";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function assetType(file) {
  const mime = fileMime(file);
  const n = String(file?.name || "").toLowerCase();
  if (mime === "application/pdf") return /brochure|brochure|ficha/.test(n) ? "brochure" : "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (/csv|excel|spreadsheet/.test(mime) || /lista.*precio|price.*list/.test(n)) return "price_list";
  if (/word|text/.test(mime)) return "document";
  return "other";
}

const allowedUploadMimes = new Set([
  "application/pdf","image/jpeg","image/png","image/webp","image/heic","image/heif",
  "video/mp4","video/quicktime","video/webm","text/plain","text/csv","application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function renderSelectedFiles() {
  const input = $("propertyFiles");
  const wrap = $("selectedFiles");
  if (!input || !wrap) return;
  const files = [...(input.files || [])];
  wrap.replaceChildren();
  wrap.hidden = files.length === 0;
  if (!files.length) return;
  const head = document.createElement("strong");
  head.textContent = t("intake.files_selected", { count: files.length });
  wrap.append(head);
  files.slice(0, 8).forEach(file => {
    const row = document.createElement("span");
    row.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(file.size > 1024*1024 ? 1 : 2)} MB`;
    wrap.append(row);
  });
  if (files.length > 8) {
    const more = document.createElement("span");
    more.textContent = `+${files.length - 8}`;
    wrap.append(more);
  }
}

async function uploadPropertyFile(session, org, property, user, file) {
  const mime = fileMime(file);
  if (!allowedUploadMimes.has(mime)) throw new Error("file_type_not_allowed");
  if (file.size > 50 * 1024 * 1024) throw new Error("file_too_large");
  const original = String(file.name || "file");
  const dot = original.lastIndexOf(".");
  const ext = dot >= 0 ? original.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const key = `${crypto.randomUUID()}${ext}`;
  const storagePath = `${org.id}/${property.id}/${key}`;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${CFG.SUPABASE_URL}/storage/v1/object/property-materials/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": mime,
      "x-upsert": "false"
    },
    body: file
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("LISTIA upload", response.status, text);
    throw new Error("upload_failed");
  }

  await api("/rest/v1/property_assets", {
    method: "POST",
    accessToken: session.access_token,
    extraHeaders: { Prefer: "return=minimal" },
    body: {
      organization_id: org.id,
      property_id: property.id,
      uploaded_by: user.id,
      asset_type: assetType(file),
      storage_bucket: "property-materials",
      storage_path: storagePath,
      original_name: original.slice(0, 500),
      mime_type: mime,
      size_bytes: file.size,
      metadata: { source: "property_intake_v086" }
    }
  });
}


async function routeAuthenticated(session) {
  const current = session || await getValidSession();
  if (!current) {
    go("login");
    return;
  }

  try {
    const user = await getCurrentUser(current);
    const org = await getUserOrganization(current, user.id);
    if (!org) {
      go("onboarding");
      return;
    }

    const onboarding = await getOnboardingState(current, org.id);
    if (!onboarding) {
      showPlan(org, { selected_plan: "free" });
      return;
    }

    const step = Number(onboarding.current_step || 2);
    if (step <= 2) {
      showPlan(org, onboarding);
      return;
    }

    if (step === 3) {
      const googleConnection = await getGoogleConnection(current, org.id);
      showGoogleConnect(org, googleConnection);
      return;
    }

    if (step === 4) {
      await showJourneyCheckpoint(org, current);
      return;
    }

    if (step === 5 && !org.onboarding_completed) {
      await showBusinessDNA(org, current, onboarding);
      return;
    }

    showReady(org);
  } catch (err) {
    if (/jwt|token|session|unauthorized/i.test(err.message)) {
      clearSession();
      go("login");
      return;
    }
    console.error(err);
    message(t("msg.workspace_load_error"), "error");
    go("login");
  }
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!validEmail(email)) { message(t("msg.invalid_email"), "error"); return; }
  if (password.length < 8) { message(t("msg.password_min8"), "error"); return; }

  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = t("msg.login_loading");

  try {
    const data = await api("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password }
    });
    const session = saveSession(data);
    message(t("msg.login_success"), "success");
    await routeAuthenticated(session);
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("login.submit");
  }
});

$("signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const accepted = $("termsCheck").checked;

  if (name.length < 2) { message(t("msg.name_required"), "error"); return; }
  if (!validEmail(email)) { message(t("msg.invalid_email"), "error"); return; }
  if (password.length < 8) { message(t("msg.password_min8_signup"), "error"); return; }
  if (!accepted) { message(t("msg.terms_required"), "error"); return; }

  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = t("msg.signup_loading");

  try {
    const data = await api("/auth/v1/signup", {
      method: "POST",
      body: {
        email,
        password,
        data: {
  full_name: name,
  locale: getLanguage(),
  legal_terms_accepted: true,
  terms_version: window.LISTIA_LEGAL?.termsVersion || "1.4.1",
  privacy_version: window.LISTIA_LEGAL?.privacyVersion || "1.3",
  legal_acceptance_source: window.LISTIA_LEGAL?.acceptanceSource || "pwa_signup_checkbox"
}
      }
    });

    if (data?.access_token) {
      const session = saveSession(data);
      message(t("msg.account_created"), "success");
      await routeAuthenticated(session);
    } else {
      message(t("msg.account_created_confirm"), "success");
      go("login");
    }
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("signup.submit");
  }
});

$("forgotForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("forgotEmail").value.trim();
  if (!validEmail(email)) { message(t("msg.invalid_email"), "error"); return; }

  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = t("msg.sending");

  try {
    await api("/auth/v1/recover", {
      method: "POST",
      body: {
        email,
        redirect_to: `${location.origin}/`
      }
    });
    message(t("msg.recovery_sent"), "success");
    go("login");
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("forgot.submit");
  }
});

$("resetForm").addEventListener("submit", async e => {
  e.preventDefault();
  const password = $("resetPassword").value;
  const confirm = $("resetPasswordConfirm").value;

  if (password.length < 8) { message(t("msg.password_min8_signup"), "error"); return; }
  if (password !== confirm) { message(t("msg.password_mismatch"), "error"); return; }

  const session = await getValidSession();
  if (!session) {
    message(t("msg.recovery_expired"), "error");
    go("forgot");
    return;
  }

  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = t("msg.saving");

  try {
    await api("/auth/v1/user", {
      method: "PUT",
      accessToken: session.access_token,
      body: { password }
    });
    message(t("msg.password_updated"), "success");
    await routeAuthenticated(session);
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("reset.submit");
  }
});

$("businessForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("businessName").value.trim();
  const type = $("businessType").value;
  const market = $("businessMarket").value.trim();

  if (!name || !type || !market) {
    message(t("msg.complete_three_fields"), "error");
    return;
  }

  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = t("msg.saving");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));

    const user = await getCurrentUser(session);
    const existing = await getUserOrganization(session, user.id);
    if (existing) {
      showReady(existing);
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await api("/rest/v1/organizations", {
      method: "POST",
      accessToken: session.access_token,
      extraHeaders: { Prefer: "return=minimal" },
      body: {
        name,
        business_type: type,
        primary_market: market,
        timezone
      }
    });

    // The owner membership is created by a protected database trigger.
    // Read the organization only after the INSERT transaction has completed so RLS
    // evaluates against the newly-created active membership.
    const org = await getUserOrganization(session, user.id);
    if (!org) {
      throw new Error(t("msg.workspace_created_load_error"));
    }

    message(t("msg.workspace_created"), "success");
    const onboarding = await getOnboardingState(session, org.id);
    showPlan(org, onboarding || { selected_plan: "free" });
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("common.continue");
  }
});


document.querySelectorAll(".plan-card").forEach(card => {
  card.addEventListener("click", () => setPlanSelection(card.dataset.plan));
});

$("planForm").addEventListener("submit", async e => {
  e.preventDefault();
  const selectedPlan = $("selectedPlan").value || "free";
  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = t("msg.saving");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));
    const user = await getCurrentUser(session);
    const org = await getUserOrganization(session, user.id);
    if (!org) throw new Error(t("msg.business_not_found"));

    await updateOnboardingState(session, org.id, {
      selected_plan: selectedPlan,
      current_step: 3,
      completed_steps: [1, 2]
    });

    const connection = await getGoogleConnection(session, org.id);
    message(t("msg.plan_saved"), "success");
    showGoogleConnect(org, connection);
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("common.continue");
  }
});

$("connectGoogleBtn").addEventListener("click", async () => {
  const btn = $("connectGoogleBtn");
  btn.disabled = true;
  btn.textContent = t("msg.google_opening");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));
    const user = await getCurrentUser(session);
    const org = await getUserOrganization(session, user.id);
    if (!org) throw new Error(t("msg.business_not_found"));

    const data = await api("/functions/v1/google-oauth-start", {
      method: "POST",
      accessToken: session.access_token,
      body: {
        organization_id: org.id,
        redirect_to: `${location.origin}/`
      }
    });

    if (!data?.authorization_url) throw new Error(t("msg.google_not_ready"));
    location.assign(data.authorization_url);
  } catch (err) {
    message(localizeError(err), "error");
    btn.disabled = false;
    btn.textContent = t("google.connect");
  }
});

$("continueGoogleBtn").addEventListener("click", async () => {
  const btn = $("continueGoogleBtn");
  btn.disabled = true;
  btn.textContent = t("msg.continuing");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));
    const user = await getCurrentUser(session);
    const org = await getUserOrganization(session, user.id);
    if (!org) throw new Error(t("msg.business_not_found"));

    const connection = await getGoogleConnection(session, org.id);
    if (!connection) throw new Error(t("msg.google_first"));

    await updateOnboardingState(session, org.id, {
      current_step: 4,
      completed_steps: [1, 2, 3]
    });

    message(t("msg.google_connected"), "success");
    await showJourneyCheckpoint(org, session);
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("common.continue");
  }
});

$("skipGoogleBtn").addEventListener("click", async () => {
  const btn = $("skipGoogleBtn");
  btn.disabled = true;
  btn.textContent = t("msg.continuing");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));
    const user = await getCurrentUser(session);
    const org = await getUserOrganization(session, user.id);
    if (!org) throw new Error(t("msg.business_not_found"));

    await updateOnboardingState(session, org.id, {
      current_step: 4,
      completed_steps: [1, 2, 3]
    });

    await showJourneyCheckpoint(org, session);
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("google.skip");
  }
});

$("scanDiscoveryBtn").addEventListener("click", async () => {
  try {
    await scanDiscovery({ silent: false });
  } catch (err) {
    message(localizeError(err), "error");
  }
});

$("completeDiscoveryBtn").addEventListener("click", async () => {
  const btn = $("completeDiscoveryBtn");
  btn.disabled = true;
  btn.textContent = t("msg.continuing");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));
    const user = await getCurrentUser(session);
    const org = await getUserOrganization(session, user.id);
    if (!org) throw new Error(t("msg.business_not_found"));

    await api("/functions/v1/google-discovery", {
      method: "POST",
      accessToken: session.access_token,
      body: { organization_id: org.id, action: "complete" }
    });

    const onboarding = await getOnboardingState(session, org.id);
    await showBusinessDNA(org, session, onboarding);
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("common.continue");
  }
});

$("finishOnboardingBtn").addEventListener("click", async () => {
  const btn = $("finishOnboardingBtn");
  btn.disabled = true;
  btn.textContent = t("msg.finishing_onboarding");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));
    const user = await getCurrentUser(session);
    const org = await getUserOrganization(session, user.id);
    if (!org) throw new Error(t("msg.business_not_found"));

    await api("/functions/v1/business-dna-finalize", {
      method: "POST",
      accessToken: session.access_token,
      body: { organization_id: org.id, locale: getLanguage() }
    });

    message(t("msg.onboarding_completed"), "success");
    showReady({ ...org, onboarding_completed: true });
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("dna.finish");
  }
});

async function logoutFromCurrentScreen() {
  const session = readSession();
  try {
    if (session?.access_token) {
      await api("/auth/v1/logout", { method: "POST", accessToken: session.access_token });
    }
  } catch {
  } finally {
    clearSession();
    go("login");
    message(t("msg.logout"), "success");
  }
}


$("officeAddPropertyBtn").addEventListener("click", () => showPropertyIntake().catch(err => message(localizeError(err), "error")));
$("officePropertiesBtn").addEventListener("click", () => showProperties());
$("propertiesBackBtn").addEventListener("click", () => showReady(officeContext.org));
$("propertiesAddBtn").addEventListener("click", () => showPropertyIntake().catch(err => message(localizeError(err), "error")));
$("intakeBackBtn").addEventListener("click", () => showProperties());
$("propertyFiles").addEventListener("change", renderSelectedFiles);

$("propertyMaterialForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("propertySubmitBtn");
  const files = [...($("propertyFiles").files || [])];
  const description = $("propertyDescription").value.trim();
  const location = $("propertyLocation").value.trim();
  const priceRaw = $("propertyPrice").value.trim();

  if (!files.length && !description && !location && !priceRaw) {
    message(t("msg.property_material_required"), "error");
    return;
  }
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) { message(t("msg.file_too_large"), "error"); return; }
    if (!allowedUploadMimes.has(fileMime(file))) { message(t("msg.file_type_not_allowed"), "error"); return; }
  }

  btn.disabled = true;
  const originalText = t("intake.submit");
  btn.textContent = t("msg.property_creating");

  try {
    const session = await getValidSession();
    if (!session) throw new Error(t("msg.session_expired"));
    const user = await getCurrentUser(session);
    const org = officeContext.org || await getUserOrganization(session, user.id);
    if (!org) throw new Error(t("msg.business_not_found"));

    const result = await api("/functions/v1/property-intake-start", {
      method: "POST",
      accessToken: session.access_token,
      body: {
        organization_id: org.id,
        operation_type: $("propertyOperation").value || null,
        description: description || null,
        price: priceRaw || null,
        currency: $("propertyCurrency").value || null,
        commission_text: $("propertyCommission").value.trim() || null,
        location_text: location || null,
        postal_code: $("propertyPostal").value.trim() || null,
        locale: getLanguage(),
        has_files: files.length > 0
      }
    });
    const property = result.property;
    let failures = 0;
    for (let i = 0; i < files.length; i++) {
      btn.textContent = t("intake.uploading", { current: i + 1, total: files.length });
      try {
        await uploadPropertyFile(session, org, property, user, files[i]);
      } catch (err) {
        failures++;
        console.error("LISTIA material upload", err);
      }
    }

    officeContext.org = org;
    await refreshOffice();
    message(failures ? t("msg.property_partial_upload") : t("msg.property_received"), failures ? "error" : "success");
    await showProperties();
  } catch (err) {
    message(localizeError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

$("businessDnaLogoutBtn").addEventListener("click", logoutFromCurrentScreen);

$("checkpointLogoutBtn").addEventListener("click", async () => {
  const session = readSession();
  try {
    if (session?.access_token) {
      await api("/auth/v1/logout", { method: "POST", accessToken: session.access_token });
    }
  } catch {
  } finally {
    clearSession();
    go("login");
    message(t("msg.logout"), "success");
  }
});

$("logoutBtn").addEventListener("click", async () => {
  const session = readSession();
  try {
    if (session?.access_token) {
      await api("/auth/v1/logout", { method: "POST", accessToken: session.access_token });
    }
  } catch {
    // Local logout still proceeds if the remote session has already expired.
  } finally {
    clearSession();
    $("loginForm").reset();
    go("login");
    message(t("msg.logout"), "success");
  }
});

async function boot() {
  if (!isConfigured()) {
    message(t("msg.config_incomplete"), "error");
    go("login");
    return;
  }

  const authType = consumeAuthHash();
  if (authType === "recovery") {
    go("reset");
    return;
  }

  const query = new URLSearchParams(location.search);
  const integration = query.get("integration");
  const integrationStatus = query.get("status");
  const integrationDetail = query.get("detail");

  if (integration === "google") {
    history.replaceState(null, "", `${location.pathname}${location.hash || ""}`);
    if (integrationStatus === "connected") {
      message(t("msg.google_connected_return"), "success");
    } else if (integrationStatus === "cancelled") {
      message(t("msg.google_cancelled"), "error");
     } else if (integrationStatus === "error") {
      const details = integrationDetail ? ` (${integrationDetail})` : "";
      message(`${t("msg.google_error")}${details}.`, "error");
    }
  }

  await routeAuthenticated();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  });
}

boot();
