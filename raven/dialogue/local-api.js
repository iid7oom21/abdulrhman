(() => {
  // src/crypto-shim.js
  var randomUUID = () => crypto.randomUUID();
  function createHash() {
    let s = "";
    return { update(t) {
      s += t;
      return this;
    }, digest() {
      let h1 = 2166136261, h2 = 16777619;
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
      }
      return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
    } };
  }

  // src/materials.js
  var MATERIAL_TYPES = Object.freeze([
    "statement",
    "correction",
    "motive",
    "private_note",
    "evidence",
    "report",
    "receipt"
  ]);
  var validId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  var own = (value, key) => Object.hasOwn(value, key);
  var freeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  var MaterialError = class extends Error {
    constructor(code) {
      super(code);
      this.name = "MaterialError";
      this.code = code;
    }
  };
  var fail = (code) => {
    throw new MaterialError(code);
  };
  function createMaterialStore({ actors = ["player", "jonas", "claire", "matteo", "elena"] } = {}) {
    if (!Array.isArray(actors) || !actors.length || actors.some((actor) => !validId(actor)) || new Set(actors).size !== actors.length) fail("invalid_actors");
    const known = new Map(actors.map((actor) => [actor, /* @__PURE__ */ new Set()]));
    const materials2 = /* @__PURE__ */ new Map();
    const creationPayloads = /* @__PURE__ */ new Map();
    const revisions = /* @__PURE__ */ new Map();
    const shares = /* @__PURE__ */ new Map();
    const sourceGroups = new Map(actors.map((actor) => [actor, /* @__PURE__ */ new Map()]));
    const actorExists = (actor) => {
      if (!known.has(actor)) fail("unknown_actor");
    };
    const requireKnown = (actor, id) => {
      if (!validId(id) || !known.get(actor).has(id)) fail("material_unavailable");
      return materials2.get(id);
    };
    function createMaterial(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) fail("invalid_material");
      const { type, text } = input;
      const author = input.author ?? "player";
      actorExists(author);
      if (!MATERIAL_TYPES.includes(type) || typeof text !== "string" || !text.trim() || text.length > 8e3) {
        fail("invalid_material");
      }
      const id = input.id === void 0 ? randomUUID() : input.id;
      if (!validId(id)) fail("invalid_material_id");
      const relationKeys = {
        statement: [],
        correction: ["originalId"],
        motive: ["originalId"],
        private_note: [],
        evidence: ["sourceId"],
        report: ["attachments"],
        receipt: ["reportId", "depositId"]
      }[type];
      const allowedKeys = /* @__PURE__ */ new Set(["id", "type", "text", "author", ...relationKeys]);
      if (Object.keys(input).some((key) => !allowedKeys.has(key))) fail("unexpected_material_field");
      const normalized = { id, type, text, author };
      for (const key of relationKeys) {
        if (own(input, key)) normalized[key] = input[key];
      }
      if (type === "report" && !own(normalized, "attachments")) normalized.attachments = [];
      const signature = JSON.stringify(normalized);
      if (materials2.has(id)) {
        if (creationPayloads.get(id) !== signature) fail("material_id_conflict");
        return materials2.get(id);
      }
      if (type === "correction" || type === "motive" && own(normalized, "originalId")) {
        const original = requireKnown(author, normalized.originalId);
        if (original.type !== "statement" || original.author !== author) fail("invalid_original");
      }
      if (type === "evidence" && !validId(normalized.sourceId)) fail("invalid_source");
      if (type === "report") {
        const attachments = normalized.attachments;
        if (!Array.isArray(attachments) || attachments.length > 100 || new Set(attachments).size !== attachments.length) fail("invalid_attachments");
        attachments.forEach((attachment) => requireKnown(author, attachment));
        normalized.attachments = [...attachments];
      }
      if (type === "receipt") {
        const report = requireKnown(author, normalized.reportId);
        if (report.type !== "report" || !validId(normalized.depositId)) fail("invalid_receipt");
      }
      const record = { ...normalized };
      if (type === "correction") {
        record.revision = (revisions.get(record.originalId) || 0) + 1;
        revisions.set(record.originalId, record.revision);
      }
      if (["statement", "correction", "motive", "private_note"].includes(type)) record.epistemicStatus = "reported";
      if (type === "report") record.status = "draft";
      materials2.set(id, freeze(record));
      creationPayloads.set(id, signature);
      known.get(author).add(id);
      return materials2.get(id);
    }
    function share({ eventId, sender = "player", materialId, recipients } = {}) {
      actorExists(sender);
      if (!validId(eventId) || !Array.isArray(recipients) || !recipients.length || recipients.length > actors.length || new Set(recipients).size !== recipients.length) fail("invalid_share");
      recipients.forEach(actorExists);
      const material = requireKnown(sender, materialId);
      const recipientSet = [...recipients].sort();
      const signature = JSON.stringify({ sender, materialId, recipients: recipientSet });
      const previous = shares.get(eventId);
      if (previous) {
        if (previous.signature !== signature) fail("share_id_conflict");
        return freeze({ ...previous.event, duplicated: true });
      }
      const deliveredIds = [material.id, ...material.type === "report" ? material.attachments : []];
      deliveredIds.forEach((id) => requireKnown(sender, id));
      for (const recipient of recipientSet) {
        for (const id of deliveredIds) known.get(recipient).add(id);
      }
      const event = freeze({ eventId, sender, materialId, recipients: recipientSet, deliveredIds: [...deliveredIds] });
      shares.set(eventId, { signature, event });
      return freeze({ ...event, duplicated: false });
    }
    function contextFor(actor, { visibleTo } = {}) {
      actorExists(actor);
      if (visibleTo !== void 0) actorExists(visibleTo);
      const received = new Set([...known.get(actor)].filter((id) => visibleTo === void 0 || known.get(visibleTo).has(id)));
      const latest = /* @__PURE__ */ new Map();
      for (const id of received) {
        const material = materials2.get(id);
        if (material.type === "correction" && (!latest.has(material.originalId) || latest.get(material.originalId).revision < material.revision)) {
          latest.set(material.originalId, material);
        }
      }
      const projected = [...received].map((id) => {
        const material = materials2.get(id);
        const out = { id, type: material.type, text: material.text, author: material.author };
        if (material.epistemicStatus) out.epistemicStatus = material.epistemicStatus;
        if (material.status) out.status = material.status;
        if (material.originalId && received.has(material.originalId)) out.originalId = material.originalId;
        if (material.type === "correction") out.isLatestKnownCorrection = latest.get(material.originalId).id === id;
        if (material.type === "evidence") {
          const groupKey = visibleTo === void 0 ? actor : `${actor}:${visibleTo}`;
          if (!sourceGroups.has(groupKey)) sourceGroups.set(groupKey, /* @__PURE__ */ new Map());
          const groups = sourceGroups.get(groupKey);
          if (!groups.has(material.sourceId)) groups.set(material.sourceId, `source-${groups.size + 1}`);
          out.sourceGroup = groups.get(material.sourceId);
        }
        if (material.type === "report") out.attachments = material.attachments.filter((attachment) => received.has(attachment));
        if (material.type === "receipt" && received.has(material.reportId)) out.reportId = material.reportId;
        return out;
      });
      return freeze({ actor, materials: projected, latestCorrections: [...latest.values()].map((material) => material.id) });
    }
    function listMaterials(actor = "player") {
      return contextFor(actor).materials;
    }
    function listShareEvents(actor = "player") {
      actorExists(actor);
      return freeze([...shares.values()].filter(({ event }) => event.sender === actor).map(({ event }) => event));
    }
    return Object.freeze({ createMaterial, share, contextFor, listMaterials, listShareEvents });
  }

  // src/knowledge.js
  var CHARACTERS = Object.freeze({
    jonas: Object.freeze({ id: "jonas", name: "\u064A\u0648\u0646\u0627\u0633", allowedKnowledge: Object.freeze([]) }),
    claire: Object.freeze({ id: "claire", name: "\u0643\u0644\u064A\u0631", allowedKnowledge: Object.freeze([]) })
  });
  function buildContext(characterId, received) {
    if (!Object.hasOwn(CHARACTERS, characterId)) throw new Error("unknown_character");
    const context = { characterId, allowed: [...CHARACTERS[characterId].allowedKnowledge] };
    if (received?.actor === characterId && Array.isArray(received.materials)) context.received = received;
    return context;
  }

  // src/dialogue.js
  var requests = /* @__PURE__ */ new Map();
  var MAX_REQUESTS_PER_OWNER = 100;
  var idsByOwner = /* @__PURE__ */ new Map();
  function remember(ownerId, requestId) {
    const ids = idsByOwner.get(ownerId) || [];
    ids.push(requestId);
    while (ids.length > MAX_REQUESTS_PER_OWNER) requests.delete(ids.shift());
    idsByOwner.set(ownerId, ids);
  }
  var fingerprint = (content) => createHash("sha256").update(JSON.stringify(content)).digest("hex");
  function simulateReply(characterId, playerMessage, received) {
    const context = buildContext(characterId, received);
    const receivedFromPlayer = context.received?.materials.filter((item) => item.author === "player") || [];
    if (/المواد|شارك|تصحيح/.test(playerMessage) && receivedFromPlayer.length) {
      return { text: "\u0647\u0630\u0647 \u0627\u0644\u0645\u0648\u0627\u062F \u0648\u0635\u0644\u062A\u0646\u064A\u061B \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0642\u0648\u0644 \u0644\u0627 \u064A\u062B\u0628\u062A \u0635\u062D\u062A\u0647:\n" + receivedFromPlayer.map((item) => (item.type === "correction" ? item.isLatestKnownCorrection ? "\u062A\u0635\u062D\u064A\u062D \u0623\u062D\u062F\u062B \u0645\u0639\u0631\u0648\u0641" : "\u062A\u0635\u062D\u064A\u062D \u0633\u0627\u0628\u0642" : item.type === "report" ? "\u0645\u0633\u0648\u062F\u0629 \u062A\u0642\u0631\u064A\u0631" : item.type === "receipt" ? "\u0625\u064A\u0635\u0627\u0644" : item.type === "motive" ? "\u062A\u0641\u0633\u064A\u0631 \u062F\u0627\u0641\u0639" : item.type === "evidence" ? "\u0645\u0627\u062F\u0629 \u0645\u0635\u062F\u0631" : "\u0642\u0648\u0644 \u0623\u0648 \u0645\u0644\u0627\u062D\u0638\u0629 \u0645\u0633\u062C\u0644\u0629") + ": " + item.text).join("\n"), refused: false };
    }
    return {
      text: "\u0627\u0644\u0646\u0635 \u0627\u0644\u0623\u0635\u0644\u064A \u0644\u0647\u0630\u0647 \u0627\u0644\u0625\u0641\u0627\u062F\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629. \u0644\u0627 \u0623\u0633\u062A\u0637\u064A\u0639 \u062A\u0623\u0643\u064A\u062F \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0648\u0627\u0642\u0639\u0629 \u0623\u0648 \u0625\u0646\u0634\u0627\u0621 \u062F\u0644\u064A\u0644 \u0645\u0646 \u0627\u0644\u062D\u0648\u0627\u0631.",
      refused: true
    };
  }
  function submitRequest(requestId, characterId, message, sharedFacts = [], contentVersion = "deleted-name-preview-v2", ownerId, received) {
    if (!ownerId || !Object.hasOwn(CHARACTERS, characterId) || typeof requestId !== "string" || !/^[\w-]{1,100}$/.test(requestId) || typeof message !== "string" || !message.trim() || message.length > 8e3) {
      return { error: "invalid_request", status: "error" };
    }
    if (!Array.isArray(sharedFacts) || sharedFacts.length) return { error: "untrusted_facts", status: "error" };
    const fp = fingerprint({ characterId, message, contentVersion });
    const existing = requests.get(requestId);
    if (existing) {
      if (existing.owner !== ownerId) return { error: "forbidden", status: "error" };
      if (existing.fingerprint !== fp) return { error: "request_id_conflict", status: "conflict" };
      return { ...existing, replayed: true };
    }
    const record = {
      id: requestId,
      fingerprint: fp,
      status: "pending",
      contentVersion,
      owner: ownerId,
      characterId,
      message,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      storage: "server-memory"
    };
    requests.set(requestId, record);
    remember(ownerId, requestId);
    try {
      record.response = simulateReply(characterId, message, received);
      record.status = "completed";
    } catch {
      record.status = "error";
      record.error = "simulation_error";
    }
    return { ...record, replayed: false };
  }
  function getRequest(requestId, ownerId) {
    const rec = requests.get(requestId);
    if (!rec || !ownerId || rec.owner !== ownerId) return null;
    return { ...rec };
  }
  function listRequests(ownerId) {
    return [...requests.values()].filter((rec) => ownerId && rec.owner === ownerId).map((rec) => ({ ...rec }));
  }

  // src/backend.js
  var LOG_KEY = "raven_dialogue_static_backend_v1";
  var STATE_KEY = "raven_dialogue_static_backend_v2";
  var DIALOGUE_KEEP = 100;
  var owner = "local-browser";
  var materials = createMaterialStore();
  var log = [];
  // saved: last write landed. failed: action is in memory but localStorage rejected it.
  // incompatible: a stored copy could not be read and was left untouched.
  // unavailable: localStorage itself could not be read.
  var lastPersist = "saved";
  var writableBackup = true;
  var ok = (status, data) => new Response(
    JSON.stringify(data, (k, v) => ["owner", "fingerprint"].includes(k) ? void 0 : v),
    { status, headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
  function compact(entries) {
    var dialogues = [];
    for (var i = 0; i < entries.length; i++) if (entries[i] && entries[i].path === "/api/dialogue") dialogues.push(entries[i]);
    var keep = new Set(dialogues.slice(-DIALOGUE_KEEP));
    var out = [];
    for (var j = 0; j < entries.length; j++) {
      var entry = entries[j];
      if (!entry) continue;
      if (entry.path === "/api/dialogue") { if (keep.has(entry)) out.push(entry); }
      else if (entry.path === "/api/materials" || entry.path === "/api/shares") out.push(entry);
    }
    return out;
  }
  function persist() {
    if (!writableBackup) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({ version: 2, log: log }));
      lastPersist = "saved";
    } catch (e) {
      lastPersist = "failed";
    }
  }
  function handle(method, path, params, data, replaying) {
    if (method === "GET" && path === "/api/materials") return [200, { items: materials.listMaterials(), events: materials.listShareEvents(), storage: "server-memory" }];
    if (method === "GET" && path === "/api/knowledge") {
      const c = params.get("characterId");
      if (!["jonas", "claire", "matteo", "elena"].includes(c)) return [400, { error: "unknown_character" }];
      return [200, materials.contextFor(c, { visibleTo: "player" })];
    }
    if (method === "GET" && path === "/api/history") return [200, { items: listRequests(owner), storage: "server-memory" }];
    if (method === "GET" && path.startsWith("/api/operations/")) {
      const r = getRequest(decodeURIComponent(path.slice("/api/operations/".length)), owner);
      return r ? [200, r] : [404, { error: "operation_unavailable" }];
    }
    if (method === "POST" && ["/api/dialogue", "/api/materials", "/api/shares"].includes(path)) {
      if (!data || typeof data !== "object" || Array.isArray(data)) return [400, { error: "invalid_request" }];
      try {
        let out;
        if (path === "/api/materials") {
          if (!["statement", "correction", "motive", "private_note", "report"].includes(data.type) || typeof data.id !== "string" || Object.hasOwn(data, "author")) return [400, { error: "player_material_required" }];
          if (materials.listMaterials().length >= 200 && !materials.listMaterials().some((r) => r.id === data.id)) return [400, { error: "materials_limit" }];
          const item = materials.createMaterial({ ...data, author: "player" });
          out = [200, { item: materials.listMaterials().find((r) => r.id === item.id), storage: "server-memory" }];
        } else if (path === "/api/shares") {
          if (Object.keys(data).some((k) => !["eventId", "materialId", "recipients"].includes(k)) || !Array.isArray(data.recipients) || data.recipients.includes("player")) return [400, { error: "invalid_share" }];
          if (materials.listShareEvents().length >= 500 && !materials.listShareEvents().some(e => e.eventId === data.eventId)) return [400, {error:"shares_limit"}];
          out = [200, { event: materials.share({ ...data, sender: "player" }), storage: "server-memory" }];
        } else {
          if (!["jonas", "claire"].includes(data.characterId)) return [400, { error: "invalid_request" }];
          const r = submitRequest(data.requestId, data.characterId, data.message, data.sharedFacts, data.contentVersion, owner, materials.contextFor(data.characterId));
          out = [r.error ? r.status === "conflict" ? 409 : r.error === "forbidden" ? 403 : 400 : 200, r];
        }
        if (out[0] === 200 && !replaying) {
          log.push({ path, data });
          log = compact(log);
          persist();
        }
        return out;
      } catch (e) {
        if (e instanceof MaterialError) return [e.code.endsWith("_conflict") ? 409 : 400, { error: e.code }];
        return [500, { error: "server_error" }];
      }
    }
    return [404, { error: "not_found" }];
  }
  function replay(entries) {
    const beforeMaterials = materials, beforeRequests = new Map(requests), beforeIds = new Map(idsByOwner);
    materials = createMaterialStore();
    try {
    for (const e of entries) {
      if (!e || Object.keys(e).some(k => !['path','data'].includes(k)) || !['/api/dialogue','/api/materials','/api/shares'].includes(e.path)) throw new Error('schema');
      const result = handle("POST", e.path, null, e.data, true);
      if (result[0] !== 200) throw new Error('schema');
    }
    } catch (error) {
      materials = beforeMaterials;
      requests.clear(); for (const [id,value] of beforeRequests) requests.set(id,value);
      idsByOwner.clear(); for (const [id,value] of beforeIds) idsByOwner.set(id,value);
      throw error;
    }
  }
  function loadState() {
    var raw = null;
    try { raw = localStorage.getItem(STATE_KEY); }
    catch (e) { lastPersist = "unavailable"; writableBackup = false; return; }
    if (raw) {
      try {
        var saved = JSON.parse(raw);
        if (!saved || saved.version !== 2 || !Array.isArray(saved.log)) throw new Error("schema");
        replay(saved.log);
        log = compact(saved.log);
        return;
      } catch (e) {
        lastPersist = "incompatible";
        writableBackup = false; log = [];
        return;
      }
    }
    try {
      var oldRaw = localStorage.getItem(LOG_KEY);
      var old = JSON.parse(oldRaw || "[]");
      if (!Array.isArray(old)) throw new Error("schema");
      replay(old);
      log = compact(old);
      if (oldRaw) persist();
    } catch (e) {
      lastPersist = "incompatible";
      writableBackup = false; log = [];
    }
  }
  loadState();
  async function localApi(input, options = {}) {
    const url = new URL(typeof input === "string" ? input : input.url, "https://local.invalid");
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    let body = null;
    if (options.body) {
      try {
        body = JSON.parse(options.body);
      } catch {
        return ok(400, { error: "invalid_json", localPersist: lastPersist });
      }
    }
    const [status, data] = handle((options.method || "GET").toUpperCase(), url.pathname, url.searchParams, body, false);
    if (data && typeof data === "object" && !Array.isArray(data)) data.localPersist = lastPersist;
    await new Promise((r) => setTimeout(r, 250));
    return ok(status, data);
  }

  // src/entry.js
  // mode=server leaves /api/ requests to the network. The default stays a local simulation.
  var serverMode = false;
  try { serverMode = new URLSearchParams(location.search).get("mode") === "server"; } catch (e) {}
  if (!serverMode) {
    var realFetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      const u = typeof input === "string" ? input : input?.url || "";
      if (u.startsWith("/api/")) return localApi(input, options);
      return realFetch(input, options);
    };
  }
  window.RAVEN_DIALOGUE_MODE = serverMode ? "server" : "local";
})();
