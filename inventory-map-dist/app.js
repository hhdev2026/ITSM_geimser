const API_BASE = "/api";

const state = {
  workspaces: [],
  options: { users: [], assets: [] },
  selected: null,
  activeFloor: "p1",
  form: { user_id: "", asset_id: "" },
  remoteQuery: "",
  status: "Cargando plano..."
};

let optionsRefreshTimer = null;
let mapRefreshTimer = null;
let mapRefreshInFlight = false;
let inventoryRequestSequence = 0;

const floors = {
  p1: { title: "PISO 1", subtitle: "Sala KREA", cols: 8, rows: 12, width: 560 },
  p2: { title: "PISO 2", subtitle: "Huerfanos / Merced", cols: 14, rows: 29, width: 1060 },
  remote: { title: "REMOTO", subtitle: "Portatiles / Q3E1P61", width: 1060 }
};

const rooms = [
  { floor: "p1", label: "SALA KREA (1er Piso)", x: 2, y: 1, w: 4, h: 1, type: "room room-soft room-label" },
  { floor: "p1", label: "SUP", x: 6, y: 1, w: 1, h: 2, type: "room room-soft room-small" },
  { floor: "p2", label: "Sala Huerfanos 2do Piso", x: 9, y: 1, w: 3, h: 1, type: "room room-soft room-label" },
  { floor: "p2", label: "SUP", x: 8, y: 3, w: 1, h: 3, type: "room room-soft room-small" },
  { floor: "p2", label: "CASINO", x: 1, y: 2, w: 3, h: 8, type: "room", fill: "#fff2cc" },
  { floor: "p2", label: "BANO", x: 0, y: 6, w: 1, h: 3, type: "room room-small", fill: "#e2f0d9" },
  { floor: "p2", label: "COCINA", x: 0, y: 9, w: 1, h: 4, type: "room room-small", fill: "#fce4d6" },
  { floor: "p2", label: "BANO", x: 0, y: 13, w: 1, h: 5, type: "room room-small", fill: "#e2f0d9" },
  { floor: "p2", label: "BANO", x: 6, y: 14, w: 1, h: 5, type: "room room-small", fill: "#e2f0d9" },
  { floor: "p2", label: "LOCKET", x: 7, y: 14, w: 1, h: 5, type: "room room-small" },
  { floor: "p2", label: "ESCALERA", x: 11, y: 14, w: 3, h: 4, type: "room room-small" },
  { floor: "p2", label: "SALA MERCED 2do Piso", x: 11, y: 21, w: 2, h: 1, type: "room room-soft room-label" },
  { floor: "p2", label: "SUP", x: 13, y: 20, w: 1, h: 3, type: "room room-soft room-small" }
];

const workspaces = [
  ...makeRow("KREA", "SALA KREA (1er Piso)", "p1", 2, 3, ["P1", "P2", "P3", "P4"]),
  ...makeRow("KREA", "SALA KREA (1er Piso)", "p1", 2, 5, ["P8", "P7", "P6", "P5"]),
  ...makeRow("KREA", "SALA KREA (1er Piso)", "p1", 2, 8, ["P9", "P10", "P11", "P12"]),
  ...makeRow("HUERFANOS", "Sala Huerfanos 2do Piso", "p2", 10, 2, ["P1", "P2", "P3", "P4"]),
  ...makeRow("HUERFANOS", "Sala Huerfanos 2do Piso", "p2", 10, 4, ["P8", "P7", "P6", "P5"]),
  ...makeRow("MERCED", "SALA MERCED 2do Piso", "p2", 1, 20, ["P25", "P24", null, "P23", "P22", null, "P21", "P20", "P19", "P18"]),
  ...makeRow("MERCED", "SALA MERCED 2do Piso", "p2", 1, 22, ["P10", "P11", null, "P12", "P13", null, "P14", "P15", "P16", "P17"]),
  ...makeRow("MERCED", "SALA MERCED 2do Piso", "p2", 1, 26, ["P9", "P8", null, "P7", null, "P6", null, "P5", "P4", null, "P3", "P2"]),
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P26", x: 1, y: 14 },
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P27", x: 4, y: 15 },
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P28", x: 5, y: 15 },
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P30", x: 4, y: 17 },
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P29", x: 5, y: 17 },
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P31", x: 11, y: 10 },
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P32", x: 12, y: 10 },
  { prefix: "MERCED", room: "SALA MERCED 2do Piso", floor: "p2", label: "P1", x: 12, y: 18 }
].map((seat, index) => ({
  ...seat,
  id: `seat-${index + 1}`,
  code: `${seat.prefix}-${seat.label}`
}));

function makeRow(prefix, room, floor, x, y, labels) {
  return labels
    .map((label, index) => label ? { prefix, room, floor, label, x: x + index, y } : null)
    .filter(Boolean);
}

function pct(value, total) {
  return `${(value / total) * 100}%`;
}

function boxStyle(item, floor) {
  const floorData = floors[floor];
  return [
    `left:${pct(item.x, floorData.cols)}`,
    `top:${pct(item.y, floorData.rows)}`,
    `width:${pct(item.w || 1, floorData.cols)}`,
    `height:${pct(item.h || 2, floorData.rows)}`,
    item.fill ? `background:${item.fill}` : ""
  ].filter(Boolean).join(";");
}

function byCode(code) {
  return state.workspaces.find((item) => item.code === code);
}

function selectedSeatRecord(seat) {
  const existing = byCode(seat.code);
  return existing || {
    id: 0,
    code: seat.code,
    room: seat.room,
    seat_label: seat.label,
    user_name: null,
    user_email: null,
    user_role: null,
    user_area: null,
    asset_hostname: null,
    asset_ip: null,
    asset_status: null,
    asset_brand: null,
    asset_model: null,
    user_id: null,
    asset_id: null
  };
}

function render() {
  const current = floors[state.activeFloor];
  document.getElementById("root").innerHTML = `
    <main class="app">
      <section class="main">
        <div class="toolbar">
          <div class="title">
            ${monitorIcon()}
            <div>
              <h1>Mapa de Activos TI</h1>
              <p>Plano por piso para configurar usuarios y equipos por puesto.</p>
            </div>
          </div>
          <div class="toolbar-actions">
            <div class="legend">
              <span class="legend-item"><span class="dot online"></span>Online</span>
              <span class="legend-item"><span class="dot offline"></span>Offline</span>
              <span class="legend-item"><span class="dot empty"></span>Sin equipo</span>
            </div>
          </div>
        </div>
        ${state.status ? `<div class="status">${escapeHtml(state.status)}</div>` : ""}
        <div class="plan-wrap">
          <div class="plan-controls">
            <div class="floor-switch floor-switch-floating" role="tablist" aria-label="Seleccion de piso">
              ${renderFloorButton("p1")}
              ${renderFloorButton("p2")}
              ${renderFloorButton("remote")}
            </div>
          </div>
          <div class="floor-summary">
            <strong>${escapeHtml(current.title)}</strong>
            <span>${escapeHtml(current.subtitle)}</span>
          </div>
          ${state.activeFloor === "remote" ? renderRemoteAssetsView() : renderFloor(state.activeFloor)}
        </div>
      </section>
      ${renderConfigModal()}
    </main>
  `;
  bindEvents();
  syncOptionsRefreshTimer();
}

function renderFloorButton(floor) {
  const active = state.activeFloor === floor ? "is-active" : "";
  return `<button class="floor-button ${active}" type="button" data-floor="${floor}" role="tab" aria-selected="${state.activeFloor === floor}">${escapeHtml(floors[floor].title)}</button>`;
}

function renderFloor(floor) {
  const floorData = floors[floor];
  return `
    <section class="floor floor-${floor}" style="--floor-width:${floorData.width}px">
      <div class="floor-header">${escapeHtml(floorData.title)} - ${escapeHtml(floorData.subtitle)}</div>
      <div class="grid">
        ${rooms.filter((room) => room.floor === floor).map(renderRoom).join("")}
        ${workspaces.filter((seat) => seat.floor === floor).map(renderSeat).join("")}
      </div>
    </section>
  `;
}

function renderRoom(room) {
  return `<div class="${room.type}" style="${boxStyle(room, room.floor)}">${escapeHtml(room.label)}</div>`;
}

function renderSeat(seat) {
  const data = byCode(seat.code);
  const classes = ["workspace"];
  let dot = "";
  if (data) classes.push("has-record");
  if (state.selected && state.selected.code === seat.code) classes.push("is-selected");
  if (data && data.asset_hostname) {
    if (data.asset_status === "Activo") {
      classes.push("is-online");
      dot = '<span class="workspace-dot online"></span>';
    } else if (data.asset_status === "Fuera de Linea") {
      classes.push("is-offline");
      dot = '<span class="workspace-dot offline"></span>';
    } else {
      dot = '<span class="workspace-dot empty"></span>';
    }
  }
  let tooltipHtml = '';
  if (data && (data.user_name || data.asset_hostname || data.asset_ip)) {
    tooltipHtml = `
      <div class="workspace-tooltip">
        ${data.user_source === "mesh" ? '<div class="workspace-tooltip-source">Sesion actual detectada</div>' : ''}
        ${data.asset_ip ? `<div class="workspace-tooltip-ip">IP: ${escapeHtml(data.asset_ip)}</div>` : ''}
        ${data.user_name ? `<div style="margin-bottom: 2px;">👤 ${escapeHtml(data.user_name)}</div>` : ''}
        ${data.asset_hostname ? `<div>💻 ${escapeHtml(data.asset_hostname)}</div>` : ''}
      </div>
    `;
  }

  const titleParts = [
    `${seat.room} - ${seat.label}`,
    data?.user_name ? `Usuario: ${data.user_name}` : "Usuario: Sin asignar",
    data?.asset_hostname ? `Equipo: ${data.asset_hostname}` : "Equipo: Sin asignar",
    data?.asset_ip ? `IP: ${data.asset_ip}` : "IP: Sin IP reportada"
  ];

  return `
    <button class="${classes.join(" ")}" data-seat="${seat.code}" style="${boxStyle(seat, seat.floor)}" title="${escapeHtml(titleParts.join("\n"))}">
      <span class="workspace-label">${escapeHtml(seat.label)}</span>
      <span class="workspace-action">Configurar</span>
      ${dot}
      ${tooltipHtml}
    </button>
  `;
}

function assetRemoteText(asset) {
  return [
    asset.name,
    asset.hostname,
    asset.node_id,
    asset.brand,
    asset.model,
    asset.os,
    asset.type,
    asset.asset_type,
    asset.occupant,
    asset.user
  ].filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function assetAllowedInRemoteView(asset) {
  const text = assetRemoteText(asset);
  return text.includes("portatil") || text.includes("q3e1p61");
}

function remotePanelAssets() {
  const assets = state.options?.assets || [];
  return assets.filter(assetAllowedInRemoteView);
}

function filteredRemotePanelAssets() {
  const query = state.remoteQuery.trim().toLowerCase();
  const assets = remotePanelAssets();
  if (!query) return assets;
  return assets.filter((asset) => [
    asset.name,
    asset.hostname,
    asset.ip,
    asset.group,
    asset.os,
    asset.occupant,
    asset.user,
    asset.brand,
    asset.model
  ].filter(Boolean).join(" ").toLowerCase().includes(query));
}

function remoteControlUrl(asset) {
  if (!asset || !/^node\/\//.test(String(asset.node_id || ""))) return "";
  const nodeId = String(asset.node_id);
  const gotonode = nodeId.split("/").pop();
  const next = `/?node=${encodeURIComponent(nodeId)}&gotonode=${encodeURIComponent(gotonode)}&viewmode=11&hide=0&geimserautoconnect=1`;
  return `/geimser/mesh/login?next=${encodeURIComponent(next)}`;
}

function renderRemoteAssetsView() {
  const assets = filteredRemotePanelAssets();
  const allRemote = remotePanelAssets();
  const online = allRemote.filter((asset) => asset.status === "Activo" || asset.raw_status === "online").length;
  const offline = Math.max(allRemote.length - online, 0);

  return `
    <section class="remote-view" aria-label="Equipos remotos">
      <header class="remote-panel-head">
        <div>
          <span>Control remoto</span>
          <h2>Portatiles y Q3E1P61</h2>
        </div>
        <button type="button" class="remote-refresh" data-refresh-remotes title="Actualizar equipos">Actualizar</button>
      </header>
      <div class="remote-stats" aria-label="Resumen remoto">
        <article><span>Total</span><strong>${allRemote.length}</strong></article>
        <article><span>Online</span><strong>${online}</strong></article>
        <article><span>Offline</span><strong>${offline}</strong></article>
      </div>
      <input class="remote-search" type="search" data-remote-search value="${escapeHtml(state.remoteQuery)}" placeholder="Buscar portatil, usuario, IP o grupo">
      <div class="remote-list" role="list">
        ${assets.length ? assets.map(renderRemoteAssetCard).join("") : `
          <div class="remote-empty">
            <strong>No hay equipos remotos para mostrar.</strong>
            <span>Solo se muestran equipos con PORTATIL en el nombre y el PC Q3E1P61.</span>
          </div>
        `}
      </div>
    </section>
  `;
}

function updateRemoteAssetsPanel() {
  const panel = document.querySelector(".remote-view");
  if (!panel) return;
  const list = panel.querySelector(".remote-list");
  if (!list) return;
  const assets = filteredRemotePanelAssets();
  list.innerHTML = assets.length ? assets.map(renderRemoteAssetCard).join("") : `
    <div class="remote-empty">
      <strong>No hay equipos remotos para mostrar.</strong>
      <span>Solo se muestran equipos con PORTATIL en el nombre y el PC Q3E1P61.</span>
    </div>
  `;
  bindPowerButtons();
}

function renderRemoteAssetCard(asset) {
  const online = asset.status === "Activo" || asset.raw_status === "online";
  const name = asset.name || asset.hostname || asset.node_id || `Equipo ${asset.id}`;
  const detail = [asset.group, asset.ip].filter(Boolean).join(" | ") || asset.os || "Sin detalle";
  const user = asset.occupant || asset.user || "Sin usuario informado";
  const url = remoteControlUrl(asset);
  return `
    <article class="remote-card ${online ? "is-online" : "is-offline"}" role="listitem">
      <span class="remote-dot ${online ? "online" : "offline"}" aria-hidden="true"></span>
      <div class="remote-card-main">
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(detail)}</small>
        <span>${escapeHtml(user)}</span>
      </div>
      <div class="remote-card-actions">
        <em>${online ? "Online" : "Offline"}</em>
        <div class="quick-actions">
          ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Tomar control</a>` : `<button type="button" disabled>Sin enlace</button>`}
          ${powerButtonHtml(asset)}
        </div>
      </div>
    </article>
  `;
}

function renderConfigModal() {
  if (!state.selected) return "";
  const seat = workspaces.find((item) => item.code === state.selected.code);
  const room = state.selected.room || seat?.room || "";
  const label = state.selected.seat_label || seat?.label || state.selected.code;
  return `
    <div class="modal-backdrop" data-backdrop>
      <section class="config-modal" role="dialog" aria-modal="true" aria-labelledby="config-title">
        <div class="side-head">
          <div>
            <span class="modal-kicker">Configurar puesto</span>
            <h2 id="config-title">${escapeHtml(label)}</h2>
            <p>${escapeHtml(room)} - ${escapeHtml(state.selected.code)}</p>
          </div>
          <button class="icon-button" data-close title="Cerrar">x</button>
        </div>
        <div class="config-body">
          ${renderDetails()}
          ${renderEditForm()}
        </div>
      </section>
    </div>
  `;
}

function renderDetails() {
  const item = state.selected;
  const statusClass = item.asset_status === "Activo" ? "badge-ok" : "badge-bad";
  return `
    <section class="panel">
      <h3>Estado actual</h3>
      <div class="row"><span>Puesto</span><strong>${escapeHtml(item.code)}</strong></div>
      ${item.asset_hostname ? `
        <div class="row"><span>Hostname</span><strong class="mono">${escapeHtml(item.asset_hostname)}</strong></div>
        <div class="row"><span>IP</span><strong class="mono">${escapeHtml(item.asset_ip || "")}</strong></div>
        <div class="row"><span>Estado</span><strong class="badge ${statusClass}">${item.asset_status === "Activo" ? "Online" : "Offline"}</strong></div>
        ${item.asset_brand || item.asset_model ? `<div class="row"><span>Hardware</span><strong>${escapeHtml(`${item.asset_brand || ""} ${item.asset_model || ""}`.trim())}</strong></div>` : ""}
      ` : '<p>No hay equipo asignado a este puesto.</p>'}
      ${item.user_name ? `
        <div class="row"><span>Usuario</span><strong>${escapeHtml(item.user_name)}</strong></div>
        ${item.user_email ? `<div class="row"><span>Email</span><strong>${escapeHtml(item.user_email)}</strong></div>` : ""}
        ${item.user_area ? `<div class="row"><span>Area</span><strong>${escapeHtml(item.user_area)}</strong></div>` : ""}
      ` : '<p>No hay usuario asignado a este puesto.</p>'}
    </section>
  `;
}

function getRemoteControlHtml(assetId) {
  if (!assetId || !state.options || !state.options.assets) return '';
  const asset = state.options.assets.find(a => String(a.id) === String(assetId));
  if (asset && /^node\/\//.test(String(asset.node_id || ""))) {
    const nodeId = String(asset.node_id);
    const gotonode = nodeId.split("/").pop();
    const next = `/?node=${encodeURIComponent(nodeId)}&gotonode=${encodeURIComponent(gotonode)}&viewmode=11&hide=0&geimserautoconnect=1`;
    const url = `/geimser/mesh/login?next=${encodeURIComponent(next)}`;
    return `
      <div class="remote-quick-actions">
        <a href="${escapeHtml(url)}" target="_blank" class="button button-primary remote-control-button"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/></svg> Tomar Equipo</a>
        ${powerButtonHtml(asset)}
      </div>
    `;
  }
  return '';
}

function powerButtonHtml(asset) {
  if (!asset || !asset.id) return "";
  const online = asset.status === "Activo" || asset.raw_status === "online";
  const action = online ? "shutdown" : "wake";
  const label = online ? "Apagar" : "Despertar";
  const klass = online ? "power-button is-shutdown" : "power-button is-wake";
  return `<button type="button" class="${klass}" data-power-asset="${escapeHtml(asset.id)}" data-power-action="${action}">${label}</button>`;
}

function renderEditForm() {
  return `
    <form class="panel edit-form config-panel" data-form>
      <h3>Asignar usuario y equipo</h3>
      <div class="field">
        <label for="user">Usuario asignado</label>
        <select id="user" name="user_id">
          <option value="">-- Sin asignar --</option>
          ${state.options.users.map((user) => `<option value="${user.id}" ${String(user.id) === state.form.user_id ? "selected" : ""}>${escapeHtml(userOptionLabel(user))}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="asset">Equipo (Activo IT)</label>
        <select id="asset" name="asset_id">
          <option value="">-- Sin asignar --</option>
          ${state.options.assets.map((asset) => `<option value="${asset.id}" ${String(asset.id) === state.form.asset_id ? "selected" : ""}>${escapeHtml(assetOptionLabel(asset))}</option>`).join("")}
        </select>
        <div id="remote-control-container" style="margin-top: 8px;">
          ${getRemoteControlHtml(state.form.asset_id)}
        </div>
      </div>
      <div class="actions">
        <button class="button button-secondary" type="button" data-cancel>Cancelar</button>
        <button class="button button-primary" type="submit">Guardar</button>
      </div>
    </form>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-floor]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFloor = button.dataset.floor;
      state.selected = null;
      render();
    });
  });
  document.querySelector("[data-refresh-remotes]")?.addEventListener("click", async () => {
    await loadOptions();
    render();
  });
  document.querySelector("[data-remote-search]")?.addEventListener("input", (event) => {
    state.remoteQuery = event.target.value;
    updateRemoteAssetsPanel();
  });
  bindPowerButtons();
  document.querySelectorAll("[data-seat]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadOptions();
      const seat = workspaces.find((item) => item.code === button.dataset.seat);
      state.selected = selectedSeatRecord(seat);
      
      let formUserId = state.selected?.user_id ? String(state.selected.user_id) : "";
      
      // Si no hay ID pero hay nombre (ej. un usuario de Zammad guardado en temp_user_name)
      // Buscamos su ID en las opciones para que el combobox aparezca seleccionado.
      if (!formUserId && state.selected?.user_name) {
         const match = state.options?.users?.find(u => u.name === state.selected.user_name);
         if (match) formUserId = String(match.id);
      }
      
      state.form = {
        user_id: formUserId,
        asset_id: state.selected?.asset_id ? String(state.selected.asset_id) : ""
      };
      
      render();
    });
  });
  document.querySelector("[data-backdrop]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      state.selected = null;
      render();
    }
  });
  document.querySelector("[data-close]")?.addEventListener("click", () => {
    state.selected = null;
    render();
  });
  document.querySelector("[data-cancel]")?.addEventListener("click", () => {
    state.selected = null;
    render();
  });
  document.querySelector("select[name='user_id']")?.addEventListener("change", async (event) => {
    state.form.user_id = event.target.value;
    if (!state.form.user_id) return;
    try {
      const response = await fetch(`${API_BASE}/inventory-map/recommend-asset/${state.form.user_id}`, { credentials: "include" });
      if (response.ok) {
        const recommendation = await response.json();
        if (recommendation.asset_id) {
          state.form.asset_id = String(recommendation.asset_id);
          render();
        }
      }
    } catch (error) {
      console.error("Failed to fetch recommendation", error);
    }
  });
  document.querySelector("select[name='user_id']")?.addEventListener("blur", renderIfSelectionIsStable);
  document.querySelector("select[name='asset_id']")?.addEventListener("blur", renderIfSelectionIsStable);
  document.querySelector("select[name='asset_id']")?.addEventListener("change", async (event) => {
    state.form.asset_id = event.target.value;
    
    // Actualizar botón de control remoto
    const rcContainer = document.getElementById("remote-control-container");
    if (rcContainer) {
      rcContainer.innerHTML = getRemoteControlHtml(state.form.asset_id);
    }
    event.target.value = state.form.asset_id;
    
    if (!state.form.asset_id) return;
    try {
      const response = await fetch(`${API_BASE}/inventory-map/recommend-user/${state.form.asset_id}`, { credentials: "include" });
      if (response.ok) {
        const recommendation = await response.json();
        if (recommendation.user_id) {
          state.form.user_id = String(recommendation.user_id);
          state.form.temp_user_name = null;
          render();
        } else if (recommendation.pc_username) {
          if (!state.options.users.find(u => u.id === 'temp_user')) {
             state.options.users.push({ id: 'temp_user', name: recommendation.pc_username + ' (PC)', email: 'No integrado' });
          } else {
             const tempUser = state.options.users.find(u => u.id === 'temp_user');
             tempUser.name = recommendation.pc_username + ' (PC)';
          }
          state.form.user_id = 'temp_user';
          state.form.temp_user_name = recommendation.pc_username;
          render();
        }
      }
    } catch (error) {
      console.error("Failed to fetch user recommendation", error);
    }
  });
  document.querySelector("[data-form]")?.addEventListener("submit", saveAssignment);
}

function bindPowerButtons() {
  document.querySelectorAll("[data-power-asset]").forEach((button) => {
    if (button.dataset.powerBound === "true") return;
    button.dataset.powerBound = "true";
    button.addEventListener("click", () => sendPowerAction(button));
  });
}

async function sendPowerAction(button) {
  const assetId = button.dataset.powerAsset;
  const action = button.dataset.powerAction;
  if (!assetId || !action) return;
  if (action === "shutdown" && !window.confirm("¿Seguro que quieres apagar este equipo?")) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = action === "wake" ? "Despertando..." : "Apagando...";

  try {
    const response = await fetch(`${API_BASE}/inventory-map/power`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": await csrfToken()
      },
      credentials: "include",
      body: JSON.stringify({ asset_id: assetId, power_action: action })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
    }
    state.status = payload.message || "Solicitud enviada.";
    await loadOptions();
    render();
  } catch (error) {
    window.alert(error.message || "No se pudo ejecutar la accion.");
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function loadInventory() {
  const requestSequence = ++inventoryRequestSequence;
  try {
    const response = await fetch(`${API_BASE}/inventory-map?refresh=${Date.now()}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const records = await response.json();
    if (requestSequence !== inventoryRequestSequence) return false;

    state.workspaces = normalizeWorkspaceRecords(records);
    state.status = "";
    return true;
  } catch (error) {
    if (requestSequence !== inventoryRequestSequence) return false;
    console.error("Fetch failed", error);
    state.workspaces = [];
    state.status = "Backend no disponible: se muestra el plano base para ordenar puestos.";
    return false;
  }
}

function normalizeWorkspaceRecords(records) {
  const byWorkspaceCode = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.code) continue;
    const previous = byWorkspaceCode.get(record.code);
    const previousUpdatedAt = Date.parse(previous?.updated_at || 0) || 0;
    const recordUpdatedAt = Date.parse(record.updated_at || 0) || 0;

    if (!previous || recordUpdatedAt >= previousUpdatedAt) {
      byWorkspaceCode.set(record.code, record);
    }
  }

  return [...byWorkspaceCode.values()];
}

async function loadOptions() {
  try {
    const response = await fetch(`${API_BASE}/inventory-map/options?refresh=${Date.now()}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.options = mergeOptions(await response.json());
  } catch (error) {
    console.error("Options fetch failed", error);
    state.options = state.options || { users: [], assets: [] };
  }
}

function mergeOptions(nextOptions) {
  const options = nextOptions || { users: [], assets: [] };
  if (state.form.user_id === "temp_user" && state.form.temp_user_name) {
    const exists = options.users.some((user) => user.id === "temp_user");
    if (!exists) {
      options.users = [
        ...options.users,
        { id: "temp_user", name: `${state.form.temp_user_name} (PC)`, email: "No integrado" }
      ];
    }
  }
  return options;
}

async function refreshOptionsFromSelect() {
  const selectedCode = state.selected?.code;
  await loadOptions();
  if (!selectedCode || state.selected?.code !== selectedCode) return;
  updateSelectOptions();
}

function updateSelectOptions() {
  const userSelect = document.querySelector("select[name='user_id']");
  const assetSelect = document.querySelector("select[name='asset_id']");

  if (userSelect) {
    const currentValue = state.form.user_id || userSelect.value || "";
    userSelect.innerHTML = `
      <option value="">-- Sin asignar --</option>
      ${state.options.users.map((user) => `<option value="${user.id}">${escapeHtml(userOptionLabel(user))}</option>`).join("")}
    `;
    userSelect.value = currentValue;
  }

  if (assetSelect) {
    const currentValue = state.form.asset_id || assetSelect.value || "";
    assetSelect.innerHTML = `
      <option value="">-- Sin asignar --</option>
      ${state.options.assets.map((asset) => `<option value="${asset.id}">${escapeHtml(assetOptionLabel(asset))}</option>`).join("")}
    `;
    assetSelect.value = currentValue;
  }

  const rcContainer = document.getElementById("remote-control-container");
  if (rcContainer) {
    rcContainer.innerHTML = getRemoteControlHtml(state.form.asset_id);
  }
}

function userOptionLabel(user) {
  const detail = user.email || user.area || "";
  return detail ? `${user.name} (${detail})` : user.name;
}

function assetOptionLabel(asset) {
  const detail = asset.occupant || "Sin usuario";
  return detail ? `${asset.name} (${detail})` : asset.name;
}

function selectIsActive() {
  return document.activeElement?.matches?.("select[name='user_id'], select[name='asset_id']");
}

function renderIfSelectionIsStable() {
  setTimeout(() => {
    if (state.selected && !selectIsActive()) render();
  }, 120);
}

function syncOptionsRefreshTimer() {
  if (!state.selected) {
    if (optionsRefreshTimer) {
      clearInterval(optionsRefreshTimer);
      optionsRefreshTimer = null;
    }
    return;
  }

  if (optionsRefreshTimer) return;
  optionsRefreshTimer = setInterval(async () => {
    if (!state.selected) return;
    await loadOptions();
    if (!selectIsActive()) render();
  }, 15000);
}

function syncMapRefreshTimer() {
  if (mapRefreshTimer) return;

  mapRefreshTimer = setInterval(async () => {
    if (mapRefreshInFlight) return;
    mapRefreshInFlight = true;

    try {
      const selectedCode = state.selected?.code || "";
      const [inventoryLoaded] = await Promise.all([loadInventory(), loadOptions()]);

      if (inventoryLoaded && selectedCode) {
        const updatedSelection = byCode(selectedCode);
        if (updatedSelection) {
          state.selected = updatedSelection;
        } else if (state.selected?.id) {
          state.selected = null;
        }
      }

      // Do not rebuild the form while the operator is choosing a user/equipment.
      // The next 15-second cycle will apply the fresh assignment safely.
      if (!selectIsActive()) render();
    } finally {
      mapRefreshInFlight = false;
    }
  }, 15000);
}

async function saveAssignment(event) {
  event.preventDefault();
  if (!state.selected) return;
  const selectedCode = state.selected.code;
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  const originalSubmitText = submitButton?.textContent;

  // Avoid a scheduled refresh replacing the selected workspace while its
  // assignment request is in flight.
  mapRefreshInFlight = true;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Guardando...";
  }

  try {
    const csrf = await csrfToken();
    
    let submitUserId = state.form.user_id;
    let submitTempName = state.form.temp_user_name;
    
    if (submitUserId && String(submitUserId).startsWith("zammad_")) {
      const zUser = state.options.users.find(u => String(u.id) === String(submitUserId));
      submitTempName = zUser ? zUser.name : "Usuario Zammad";
      submitUserId = null;
    } else if (submitUserId === "temp_user") {
      submitUserId = null;
    } else {
      submitUserId = submitUserId ? parseInt(submitUserId, 10) : null;
    }

    const response = await fetch(`${API_BASE}/inventory-map/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf
      },
      credentials: "include",
      body: JSON.stringify({
        workspace_id: state.selected.id || null,
        code: state.selected.code,
        user_id: submitUserId,
        asset_id: state.form.asset_id ? parseInt(state.form.asset_id, 10) : null,
        temp_user_name: submitTempName || null
      })
    });
    const savedWorkspace = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(savedWorkspace.error || `HTTP ${response.status}`);

    const existingIndex = state.workspaces.findIndex((workspace) => workspace.code === selectedCode);
    if (existingIndex >= 0) state.workspaces[existingIndex] = savedWorkspace;
    else state.workspaces.push(savedWorkspace);

    state.selected = savedWorkspace.code ? savedWorkspace : state.selected;
    state.status = "Puesto guardado correctamente.";
    render();

    // Refresh server data in the background. Its failure must never report a
    // successful assignment as failed.
    loadInventory().then((inventoryLoaded) => {
      if (!inventoryLoaded || state.selected?.code !== selectedCode) return;
      state.selected = byCode(selectedCode) || state.selected;
      if (!selectIsActive()) render();
    });
  } catch (error) {
    console.error("Save failed", error);
    state.status = "No se pudo guardar la asignacion. Revisa la conexion con el backend.";
    render();
  } finally {
    mapRefreshInFlight = false;
    if (submitButton && document.body.contains(submitButton)) {
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitText;
    }
  }
}

function connectSocket() {
  // Realtime status updates are optional; the local Rails backend serves fresh data on load/save.
}

async function csrfToken() {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (token) return token;

  try {
    const parentDocument = window.parent && window.parent !== window ? window.parent.document : null;
    const parentToken = parentDocument?.querySelector('meta[name="csrf-token"]')?.content;
    if (parentToken) return parentToken;
  } catch (error) {
    console.warn("No se pudo leer el CSRF del contenedor Zammad", error);
  }

  const cookie = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  if (cookie) return decodeURIComponent(cookie[1]);

  const response = await fetch(`${API_BASE}/inventory-map/csrf`, { credentials: "include" });
  if (!response.ok) return "";
  const payload = await response.json();
  return payload.csrf_token || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function monitorIcon() {
  return `
    <svg class="monitor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2"></rect>
      <line x1="8" x2="16" y1="21" y2="21"></line>
      <line x1="12" x2="12" y1="17" y2="21"></line>
    </svg>
  `;
}

await loadInventory();
await loadOptions();
render();
syncMapRefreshTimer();
connectSocket();
