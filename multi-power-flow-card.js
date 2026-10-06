class MultiPowerFlowCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
    this._nodeKey = '';
  }

  setConfig(config) {
    this._config = config;
    if (this._hass) {
      this.syncLayout();
      this.updateValues();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this.syncLayout();
      this._initialized = true;
    }
    this.updateValues();
  }

  getCardSize() {
    return 5;
  }

  static getLayoutOptions() {
    return {
      grid_rows: 5,
      grid_columns: 4,
      grid_min_columns: 3,
    };
  }

  getEntityId(obj) {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object' && obj.entity) return obj.entity;
    return null;
  }

  getIconSymbol(icon, defaultEmoji) {
    if (!icon) return defaultEmoji;
    if (typeof icon === 'string' && !icon.startsWith('mdi:')) return icon;
    const map = {
      'mdi:leaf': '🍃',
      'mdi:transmission-tower': '🗼',
      'mdi:solar-power': '☀️',
      'mdi:battery-high': '🔋',
      'mdi:battery-charging-100': '🔋',
      'mdi:home': '🏠',
      'mdi:heat-pump': '🌀',
      'mdi:server-network': '🖥️',
      'mdi:car-electric': '🚗',
      'mdi:tumble-dryer': '♨️',
      'mdi:washing-machine': '🫧',
      'mdi:television': '📺'
    };
    return map[icon] || defaultEmoji;
  }

  parseWatts(entityRef) {
    const entityId = this.getEntityId(entityRef);
    if (!this._hass || !entityId || !this._hass.states[entityId]) return 0;
    const st = this._hass.states[entityId];
    let val = parseFloat(st.state) || 0;
    const uom = (st.attributes.unit_of_measurement || '').toLowerCase();
    if (uom.includes('kw')) val *= 1000;
    return val;
  }

  getDisplayVal(entityRef, defaultUnit = 'W', absolute = true) {
    const entityId = this.getEntityId(entityRef);
    if (!this._hass || !entityId || !this._hass.states[entityId]) return '0 W';
    const st = this._hass.states[entityId];
    let val = parseFloat(st.state) || 0;
    if (absolute) val = Math.abs(val);
    const uom = st.attributes.unit_of_measurement || defaultUnit;
    if (Math.abs(val) >= 1000) {
      return (val / 1000).toFixed(1) + ' kW';
    }
    return Math.round(val) + ' ' + uom;
  }

  getSocVal(entityRef) {
    const entityId = this.getEntityId(entityRef);
    if (!this._hass || !entityId || !this._hass.states[entityId]) return '';
    const st = this._hass.states[entityId];
    let val = Math.round(parseFloat(st.state) || 0);
    return val + '%';
  }

  getActiveNodes() {
    const entities = (this._config && this._config.entities) || {};

    const gridEnt = entities.grid || 'sensor.myenergi_hub_11180810_power_grid';
    const solarEnt = entities.solar || 'sensor.givtcp_fd2311g775_pv_power';
    const homeEnt = entities.home || 'sensor.givtcp_fd2311g775_load_power';
    const lowCarbonEnt = entities.fossil_fuel_percentage || 'sensor.electricity_maps_grid_fossil_fuel_percentage_2';

    const batteries = Array.isArray(entities.batteries) ? entities.batteries : [];
    const givConfig = batteries.find(b => b.id === 'givenergy') || entities.givenergy || {
      entity: 'sensor.givtcp_fd2311g775_battery_power',
      state_of_charge: 'sensor.givtcp_fd2311g775_soc'
    };
    const solixConfig = batteries.find(b => b.id === 'solix') || entities.solix || {
      entity: 'sensor.solix_s2000_net_power',
      state_of_charge: 'sensor.solix_s2000_state_of_charge',
      ac_output: 'sensor.solix_s2000_ac_output_power'
    };

    const individual = Array.isArray(entities.individual) ? entities.individual : [];

    const findIndiv = (keys, defaultEntity, defaultName, defaultIcon, defaultColor) => {
      const found = individual.find(item => {
        const id = (item.id || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const ent = (item.entity || '').toLowerCase();
        return keys.some(k => id === k || name.includes(k) || ent.includes(k));
      });
      if (found) {
        return {
          enabled: true,
          entity: found.entity,
          name: found.name || defaultName,
          icon: this.getIconSymbol(found.icon, defaultIcon),
          color: found.color ? (Array.isArray(found.color) ? `rgb(${found.color.join(',')})` : found.color) : defaultColor
        };
      }
      return { enabled: false, entity: defaultEntity, name: defaultName, icon: defaultIcon, color: defaultColor };
    };

    const ashp = findIndiv(['ashp', 'heat pump', 'harvi'], 'sensor.myenergi_harvi_2151436_none_ct2', 'ASHP', '🌀', '#FF24BA');
    const homelab = findIndiv(['homelab', 'ac_output_power', 'server'], 'sensor.solix_s2000_ac_output_power', 'Homelab', '🖥️', '#9C27B0');
    const dryer = findIndiv(['dryer', 'tumble_dryer'], 'sensor.tumble_dryer_zigbee_power', 'Tumble Dryer', '♨️', '#FF9800');
    const washer = findIndiv(['washer', 'washing_machine'], 'sensor.washing_machine_zigbee_power', 'Washing Machine', '🫧', '#2196F3');
    const polestar = findIndiv(['polestar', 'ev', 'zappi'], 'sensor.myenergi_zappi_17111898_internal_load_ct1', 'Polestar', '🚗', '#07607E');
    const tv = findIndiv(['tv', 'lounge_tv'], 'sensor.lounge_tv_power', 'Lounge TV', '📺', '#8BC34A');

    return {
      lowcarbon: { id: 'lowcarbon', label: (entities.fossil_fuel_percentage && entities.fossil_fuel_percentage.name) || 'Low Carbon', icon: this.getIconSymbol(entities.fossil_fuel_percentage?.icon, '🍃'), color: '#00C853', x: 35, y: 25, entity: lowCarbonEnt, enabled: true },
      grid: { id: 'grid', label: (entities.grid && entities.grid.name) || 'Grid', icon: this.getIconSymbol(entities.grid?.icon, '🗼'), color: '#0288D1', x: 35, y: 170, entity: gridEnt, enabled: true },
      solar: { id: 'solar', label: (entities.solar && entities.solar.name) || 'Solar', icon: this.getIconSymbol(entities.solar?.icon, '☀️'), color: '#FF9800', x: 175, y: 25, entity: solarEnt, enabled: true },
      givenergy: { id: 'givenergy', label: givConfig.name || 'GivEnergy', icon: this.getIconSymbol(givConfig.icon, '🔋'), color: '#00BCD4', x: 175, y: 315, entity: givConfig.entity, socEntity: givConfig.state_of_charge, enabled: true },
      ashp: { id: 'ashp', label: ashp.name, icon: ashp.icon, color: ashp.color, x: 315, y: 25, entity: ashp.entity, enabled: ashp.enabled },
      home: { id: 'home', label: (entities.home && entities.home.name) || 'Home', icon: this.getIconSymbol(entities.home?.icon, '🏠'), color: '#FF9800', x: 315, y: 170, entity: homeEnt, isHome: true, enabled: true },
      solix: { id: 'solix', label: solixConfig.name || 'Solix S2000', icon: this.getIconSymbol(solixConfig.icon, '🔋'), color: '#FFC107', x: 315, y: 315, entity: solixConfig.entity, socEntity: solixConfig.state_of_charge, enabled: true },
      dryer: { id: 'dryer', label: dryer.name, icon: dryer.icon, color: dryer.color, x: 455, y: 25, entity: dryer.entity, enabled: dryer.enabled },
      homelab: { id: 'homelab', label: homelab.name, icon: homelab.icon, color: homelab.color, x: 455, y: 315, entity: homelab.entity, enabled: homelab.enabled },
      washer: { id: 'washer', label: washer.name, icon: washer.icon, color: washer.color, x: 595, y: 25, entity: washer.entity, enabled: washer.enabled },
      polestar: { id: 'polestar', label: polestar.name, icon: polestar.icon, color: polestar.color, x: 595, y: 315, entity: polestar.entity, enabled: polestar.enabled },
      lounge_tv: { id: 'lounge_tv', label: tv.name, icon: tv.icon, color: tv.color, x: 735, y: 315, entity: tv.entity, enabled: tv.enabled }
    };
  }

  getPathD(cId, isReverse = false) {
    const R = 48;
    const hcX = 363;
    const hcY = 218;

    const gcX = 83;
    const gcY = 218;

    const scX = 223;
    const scY = 73;

    const givX = 223;
    const givY = 363;

    const getCircleEdgeX = (dy, isRightSide = true) => {
      const dx = Math.sqrt(Math.max(0, R * R - dy * dy));
      return isRightSide ? (hcX + dx) : (hcX - dx);
    };

    const getGridEdgeX = (dy) => {
      const dx = Math.sqrt(Math.max(0, R * R - dy * dy));
      return gcX + dx;
    };

    const getSolarBottomY = (x) => {
      const dx = Math.abs(x - scX);
      const dy = Math.sqrt(Math.max(0, R * R - dx * dx));
      return scY + dy;
    };

    const getGivenergyTopY = (x) => {
      const dx = Math.abs(x - givX);
      const dy = Math.sqrt(Math.max(0, R * R - dx * dx));
      return givY - dy;
    };

    const r = 14;

    switch (cId) {
      case 'lowcarbon-grid':
        return `M 83 121 L 83 170`;

      case 'grid-home': {
        const dy = 0;
        const gExitX = getGridEdgeX(dy);
        const hEntryX = getCircleEdgeX(dy, false);
        if (isReverse) {
          return `M ${hEntryX} 218 L ${gExitX} 218`;
        } else {
          return `M ${gExitX} 218 L ${hEntryX} 218`;
        }
      }

      case 'solar-home': {
        const sExitY = getSolarBottomY(247);
        const hEntryX = getCircleEdgeX(-24, false);
        if (isReverse) {
          return `M ${hEntryX.toFixed(2)} 194 L 261 194 Q 247 194, 247 180 L 247 ${sExitY.toFixed(2)}`;
        } else {
          return `M 247 ${sExitY.toFixed(2)} L 247 180 Q 247 194, 261 194 L ${hEntryX.toFixed(2)} 194`;
        }
      }

      case 'solar-givenergy': {
        const sExitY = getSolarBottomY(223);
        const givEntryY = getGivenergyTopY(223);
        if (isReverse) {
          return `M 223 ${givEntryY.toFixed(2)} L 223 ${sExitY.toFixed(2)}`;
        } else {
          return `M 223 ${sExitY.toFixed(2)} L 223 ${givEntryY.toFixed(2)}`;
        }
      }

      case 'solar-grid': {
        const sExitY = getSolarBottomY(199);
        const gEntryX = getGridEdgeX(-24);
        if (isReverse) {
          return `M ${gEntryX.toFixed(2)} 194 L 185 194 Q 199 194, 199 180 L 199 ${sExitY.toFixed(2)}`;
        } else {
          return `M 199 ${sExitY.toFixed(2)} L 199 180 Q 199 194, 185 194 L ${gEntryX.toFixed(2)} 194`;
        }
      }

      case 'grid-givenergy': {
        const givEntryY = getGivenergyTopY(199);
        const gExitX = getGridEdgeX(24);
        if (isReverse) {
          return `M 199 ${givEntryY.toFixed(2)} L 199 256 Q 199 242, 185 242 L ${gExitX.toFixed(2)} 242`;
        } else {
          return `M ${gExitX.toFixed(2)} 242 L 185 242 Q 199 242, 199 256 L 199 ${givEntryY.toFixed(2)}`;
        }
      }

      case 'givenergy-home': {
        const givEntryY = getGivenergyTopY(247);
        const hEntryX = getCircleEdgeX(24, false);
        if (isReverse) {
          return `M ${hEntryX.toFixed(2)} 242 L 261 242 Q 247 242, 247 256 L 247 ${givEntryY.toFixed(2)}`;
        } else {
          return `M 247 ${givEntryY.toFixed(2)} L 247 256 Q 247 242, 261 242 L ${hEntryX.toFixed(2)} 242`;
        }
      }

      case 'home-ashp': {
        return `M 363 170 L 363 121`;
      }

      case 'solix-home': {
        if (isReverse) {
          return `M 363 266 L 363 315`;
        } else {
          return `M 363 315 L 363 266`;
        }
      }

      case 'solix-homelab': {
        return `M 411 363 L 455 363`;
      }

      case 'home-dryer': {
        const dy = -24;
        const hExitX = getCircleEdgeX(dy, true);
        const hExitY = hcY + dy;
        const endX = 503;
        const targetBottomY = 121;
        return `M ${hExitX} ${hExitY} L ${endX - r} ${hExitY} Q ${endX} ${hExitY}, ${endX} ${hExitY - r} L ${endX} ${targetBottomY}`;
      }

      case 'home-washer': {
        const dy = -12;
        const hExitX = getCircleEdgeX(dy, true);
        const hExitY = hcY + dy;
        const endX = 643;
        const targetBottomY = 121;
        return `M ${hExitX} ${hExitY} L ${endX - r} ${hExitY} Q ${endX} ${hExitY}, ${endX} ${hExitY - r} L ${endX} ${targetBottomY}`;
      }

      case 'home-lounge_tv': {
        const dy = 12;
        const hExitX = getCircleEdgeX(dy, true);
        const hExitY = hcY + dy;
        const endX = 783;
        const targetTopY = 315;
        return `M ${hExitX} ${hExitY} L ${endX - r} ${hExitY} Q ${endX} ${hExitY}, ${endX} ${hExitY + r} L ${endX} ${targetTopY}`;
      }

      case 'home-polestar': {
        const dy = 24;
        const hExitX = getCircleEdgeX(dy, true);
        const hExitY = hcY + dy;
        const endX = 643;
        const targetTopY = 315;
        return `M ${hExitX} ${hExitY} L ${endX - r} ${hExitY} Q ${endX} ${hExitY}, ${endX} ${hExitY + r} L ${endX} ${targetTopY}`;
      }

      default:
        return '';
    }
  }

  syncLayout() {
    const nodes = this.getActiveNodes();
    const activeKeys = Object.keys(nodes).filter(k => nodes[k].enabled).join(',');

    if (this._nodeKey === activeKeys && this.shadowRoot.querySelector('svg.power-svg')) return;
    this._nodeKey = activeKeys;

    const connections = [
      { id: 'lowcarbon-grid', from: 'lowcarbon', to: 'grid', color: '#00C853' },
      { id: 'grid-home', from: 'grid', to: 'home', color: '#0288D1' },
      { id: 'solar-home', from: 'solar', to: 'home', color: '#FF9800' },
      { id: 'solar-givenergy', from: 'solar', to: 'givenergy', color: '#00BCD4' },
      { id: 'solar-grid', from: 'solar', to: 'grid', color: '#FF9800' },
      { id: 'grid-givenergy', from: 'grid', to: 'givenergy', color: '#00BCD4' },
      { id: 'givenergy-home', from: 'givenergy', to: 'home', color: '#00BCD4' },
      { id: 'home-ashp', from: 'home', to: 'ashp', color: nodes.ashp.color },
      { id: 'solix-home', from: 'solix', to: 'home', color: '#FFC107' },
      { id: 'solix-homelab', from: 'solix', to: 'homelab', color: nodes.homelab.color },
      { id: 'home-dryer', from: 'home', to: 'dryer', color: nodes.dryer.color },
      { id: 'home-washer', from: 'home', to: 'washer', color: nodes.washer.color },
      { id: 'home-lounge_tv', from: 'home', to: 'lounge_tv', color: nodes.lounge_tv.color },
      { id: 'home-polestar', from: 'home', to: 'polestar', color: nodes.polestar.color }
    ].filter(c => nodes[c.from]?.enabled && nodes[c.to]?.enabled);

    let pathsHtml = '';
    let dotsHtml = '';
    connections.forEach(c => {
      const initialD = this.getPathD(c.id, false);
      pathsHtml += `<path id="path-${c.id}" d="${initialD}" stroke="${c.color}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
      dotsHtml += `<g id="dotgroup-${c.id}" style="display: none;"></g>`;
    });

    let nodesHtml = '';
    Object.values(nodes).forEach(n => {
      if (!n.enabled) return;
      const isHome = n.isHome;
      const borderCol = isHome ? '#00bcd4' : n.color;
      const labelY = n.y < 100 ? -14 : 116;

      nodesHtml += `
        <g transform="translate(${n.x}, ${n.y})">
          <circle cx="48" cy="48" r="46" fill="#0b0f19" stroke="${borderCol}" stroke-width="3.5" />
          ${isHome ? `<circle cx="48" cy="48" r="41" fill="none" stroke="#ff9800" stroke-width="2.5"/>` : ''}
          <text x="48" y="${labelY}" text-anchor="middle" fill="#cbd5e1" font-size="13.5" font-weight="700" font-family="system-ui, sans-serif">${n.label}</text>
          <text id="soc-${n.id}" x="48" y="24" text-anchor="middle" fill="${n.color}" font-size="13.5" font-weight="800" font-family="system-ui, sans-serif"></text>
          <text x="48" y="48" id="icon-${n.id}" text-anchor="middle" font-size="30" font-family="system-ui, apple color emoji, segoe ui emoji">${n.icon}</text>
          <text id="val-${n.id}" x="48" y="72" text-anchor="middle" fill="#f1f5f9" font-size="13.5" font-weight="800" font-family="system-ui, sans-serif">${n.val || ''}</text>
        </g>
      `;
    });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }
        ha-card {
          background: #111827;
          border-radius: 16px;
          padding: 16px;
          color: #f1f5f9;
          font-family: system-ui, -apple-system, sans-serif;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 auto;
          box-sizing: border-box;
          overflow: hidden;
        }
        .card-header {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
          text-align: center;
        }
        .svg-wrapper {
          width: 100%;
          height: auto;
          overflow: hidden;
        }
        svg.power-svg {
          width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
          overflow: visible;
        }
      </style>
      <ha-card>
        <div class="card-header" id="cardTitle">${(this._config && this._config.title) || 'Power Flow Plus'}</div>
        <div class="svg-wrapper">
          <svg class="power-svg" viewBox="0 -18 850 456" preserveAspectRatio="xMidYMid meet">
            ${pathsHtml}
            ${dotsHtml}
            ${nodesHtml}
          </svg>
        </div>
      </ha-card>
    `;
  }

  updateValues() {
    if (!this.shadowRoot || !this._hass) return;

    const nodes = this.getActiveNodes();

    const rawGridW = this.parseWatts(nodes.grid.entity);
    const isExportingGrid = rawGridW < 0;
    const gridW = Math.abs(rawGridW);

    const solarW = Math.abs(this.parseWatts(nodes.solar.entity));
    const homeW = Math.abs(this.parseWatts(nodes.home.entity));

    const givRaw = this.parseWatts(nodes.givenergy.entity);
    const givStateStr = (this._hass?.states[nodes.givenergy.entity]?.state || '').toString();
    const isGivCharging = givRaw < 0 || givStateStr.includes('-');
    const givW = Math.abs(givRaw);
    const givSoc = this.getSocVal(nodes.givenergy.socEntity);

    const solarToGivW = isGivCharging ? Math.min(solarW, givW) : 0;
    const remSolar = Math.max(0, solarW - solarToGivW);

    const solarToGridW = isExportingGrid ? Math.min(remSolar, gridW) : 0;
    const solarToHomeW = Math.max(0, remSolar - solarToGridW);

    const gridToGivW = isGivCharging ? Math.max(0, givW - solarToGivW) : 0;
    const givToGridW = (!isGivCharging && isExportingGrid) ? Math.min(givW, Math.max(0, gridW - solarToGridW)) : 0;

    const gridToHomeW = isExportingGrid ? 0 : Math.max(0, gridW - gridToGivW);
    const givToHomeW = !isGivCharging ? Math.max(0, givW - givToGridW) : 0;

    const solixRaw = this.parseWatts(nodes.solix.entity);
    const solixW = Math.abs(solixRaw);
    const solixSoc = this.getSocVal(nodes.solix.socEntity);
    const solixStateStr = (this._hass?.states[nodes.solix.entity]?.state || '').toString().toLowerCase();
    const solixStatusStr = (this._hass?.states['sensor.solix_s2000_battery_status']?.state || '').toString().toLowerCase();
    const solixAcInput = this.parseWatts('sensor.solix_s2000_ac_input_power');
    const solixAcOutput = this.parseWatts('sensor.solix_s2000_ac_output_power');

    const isSolixCharging = solixStatusStr === 'charging' ||
                             solixStateStr === 'charging' ||
                             (solixAcInput > 0 && solixAcInput > solixAcOutput) ||
                             solixStateStr.includes('-') ||
                             parseFloat(solixStateStr) < 0;

    const homelabW = Math.abs(this.parseWatts(nodes.homelab.entity));
    const ashpW = Math.abs(this.parseWatts(nodes.ashp.entity));
    const polestarW = Math.abs(this.parseWatts(nodes.polestar.entity));
    const dryerW = Math.abs(this.parseWatts(nodes.dryer.entity));
    const washerW = Math.abs(this.parseWatts(nodes.washer.entity));
    const tvW = Math.abs(this.parseWatts(nodes.lounge_tv.entity));

    const nodeVals = {
      lowcarbon: { val: this.getSocVal(nodes.lowcarbon.entity) || '86%' },
      grid: { val: (isExportingGrid ? '← ' : '→ ') + this.getDisplayVal(nodes.grid.entity, 'W', true) },
      solar: { val: this.getDisplayVal(nodes.solar.entity) },
      givenergy: { val: (isGivCharging ? '↓ ' : (givW > 0 ? '↑ ' : '')) + this.getDisplayVal(nodes.givenergy.entity), soc: givSoc },
      ashp: { val: this.getDisplayVal(nodes.ashp.entity, 'W', true) },
      home: { val: this.getDisplayVal(nodes.home.entity) },
      solix: { val: (isSolixCharging ? '↓ ' : (solixW > 0 ? '↑ ' : '')) + this.getDisplayVal(nodes.solix.entity), soc: solixSoc },
      dryer: { val: this.getDisplayVal(nodes.dryer.entity) },
      homelab: { val: this.getDisplayVal(nodes.homelab.entity) },
      washer: { val: this.getDisplayVal(nodes.washer.entity) },
      polestar: { val: this.getDisplayVal(nodes.polestar.entity) },
      lounge_tv: { val: this.getDisplayVal(nodes.lounge_tv.entity) }
    };

    Object.keys(nodes).forEach(id => {
      if (!nodes[id].enabled) return;
      const data = nodeVals[id];
      const valEl = this.shadowRoot.getElementById('val-' + id);
      if (valEl && data) valEl.textContent = data.val;

      const socEl = this.shadowRoot.getElementById('soc-' + id);
      if (socEl && data) socEl.textContent = data.soc || '';

      const iconEl = this.shadowRoot.getElementById('icon-' + id);
      if (iconEl && data) {
        iconEl.setAttribute('y', data.soc ? '54' : '48');
      }
    });

    const connData = [
      { id: 'lowcarbon-grid', color: '#00C853', watts: 100, isReverse: false },
      { id: 'grid-home', color: '#0288D1', watts: gridToHomeW, isReverse: false },
      { id: 'solar-home', color: '#FF9800', watts: solarToHomeW, isReverse: false },
      { id: 'solar-givenergy', color: '#00BCD4', watts: solarToGivW, isReverse: false },
      { id: 'solar-grid', color: '#FF9800', watts: solarToGridW, isReverse: false },
      { id: 'grid-givenergy', color: '#00BCD4', watts: (gridToGivW > 0 ? gridToGivW : givToGridW), isReverse: (givToGridW > 0) },
      { id: 'givenergy-home', color: '#00BCD4', watts: givToHomeW, isReverse: false },
      { id: 'home-ashp', color: nodes.ashp.color, watts: ashpW, isReverse: false },
      { id: 'solix-home', color: '#FFC107', watts: solixW, isReverse: isSolixCharging },
      { id: 'solix-homelab', color: nodes.homelab.color, watts: homelabW, isReverse: false },
      { id: 'home-dryer', color: nodes.dryer.color, watts: dryerW, isReverse: false },
      { id: 'home-washer', color: nodes.washer.color, watts: washerW, isReverse: false },
      { id: 'home-lounge_tv', color: nodes.lounge_tv.color, watts: tvW, isReverse: false },
      { id: 'home-polestar', color: nodes.polestar.color, watts: polestarW, isReverse: false }
    ].filter(c => nodes[c.id.split('-')[0]]?.enabled && nodes[c.id.split('-')[1]]?.enabled);

    connData.forEach(c => {
      const active = c.watts > 0 || c.id === 'lowcarbon-grid';
      const groupEl = this.shadowRoot.getElementById('dotgroup-' + c.id);
      const pathEl = this.shadowRoot.getElementById('path-' + c.id);

      const d = this.getPathD(c.id, c.isReverse);

      if (pathEl && pathEl.getAttribute('d') !== d) {
        pathEl.setAttribute('d', d);
      }

      if (groupEl) {
        groupEl.style.display = active ? 'block' : 'none';

        if (active) {
          const durVal = Math.max(0.8, Math.min(5.5, (2400 / Math.max(c.watts, 10)))).toFixed(2);
          const durStr = durVal + 's';
          const halfDurStr = '-' + (durVal / 2).toFixed(2) + 's';

          const currentD = groupEl.getAttribute('data-path');
          const currentDur = groupEl.getAttribute('data-dur');

          if (currentD !== d || !currentDur || Math.abs(parseFloat(currentDur) - parseFloat(durVal)) > 0.5) {
            groupEl.setAttribute('data-path', d);
            groupEl.setAttribute('data-dur', durVal);

            groupEl.innerHTML = `
              <circle r="4.8" fill="${c.color}">
                <animateMotion path="${d}" dur="${durStr}" repeatCount="indefinite" calcMode="linear" />
              </circle>
              <circle r="4.8" fill="${c.color}">
                <animateMotion path="${d}" dur="${durStr}" begin="${halfDurStr}" repeatCount="indefinite" calcMode="linear" />
              </circle>
            `;
          }
        }
      }
    });
  }

  static getConfigElement() {
    return document.createElement('multi-power-flow-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'Power Flow Plus',
      entities: {
        grid: 'sensor.myenergi_hub_11180810_power_grid',
        solar: 'sensor.givtcp_fd2311g775_pv_power',
        home: 'sensor.givtcp_fd2311g775_load_power',
        fossil_fuel_percentage: 'sensor.electricity_maps_grid_fossil_fuel_percentage_2',
        givenergy: {
          entity: 'sensor.givtcp_fd2311g775_battery_power',
          state_of_charge: 'sensor.givtcp_fd2311g775_soc'
        },
        solix: {
          entity: 'sensor.solix_s2000_net_power',
          state_of_charge: 'sensor.solix_s2000_state_of_charge',
          ac_output: 'sensor.solix_s2000_ac_output_power'
        }
      }
    };
  }
}

class MultiPowerFlowCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = config || {};
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _valueChanged(ev) {
    if (!this._config) return;
    const target = ev.target;
    const path = target.getAttribute('data-path');
    if (!path) return;

    const value = ev.target.value;
    const newConfig = JSON.parse(JSON.stringify(this._config));

    const parts = path.split('.');
    let curr = newConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;

    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    if (!this._config) return;
    const entities = this._config.entities || {};

    const getEntVal = (field) => {
      if (typeof field === 'string') return field;
      if (typeof field === 'object' && field) return field.entity || '';
      return '';
    };

    const title = this._config.title || 'Power Flow Plus';
    const grid = getEntVal(entities.grid);
    const solar = getEntVal(entities.solar);
    const home = getEntVal(entities.home);
    const fossil = getEntVal(entities.fossil_fuel_percentage);

    const givPower = entities.givenergy?.entity || (typeof entities.givenergy === 'string' ? entities.givenergy : '');
    const givSoc = entities.givenergy?.state_of_charge || '';

    const solixPower = entities.solix?.entity || (typeof entities.solix === 'string' ? entities.solix : '');
    const solixSoc = entities.solix?.state_of_charge || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 8px;
          font-family: system-ui, -apple-system, sans-serif;
          color: var(--primary-text-color, #fff);
        }
        .section {
          margin-bottom: 16px;
          background: var(--card-background-color, #1f2937);
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #374151);
        }
        .section-title {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 10px;
          color: var(--primary-color, #00bcd4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-row {
          display: flex;
          flex-direction: column;
          margin-bottom: 10px;
        }
        label {
          font-size: 12px;
          margin-bottom: 4px;
          color: var(--secondary-text-color, #9ca3af);
        }
        input {
          padding: 8px 10px;
          background: var(--input-background-color, #111827);
          border: 1px solid var(--divider-color, #4b5563);
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
        }
        input:focus {
          outline: none;
          border-color: var(--primary-color, #00bcd4);
        }
      </style>
      <div class="card-config">
        <div class="section">
          <div class="section-title">General Settings</div>
          <div class="form-row">
            <label>Card Title</label>
            <input type="text" data-path="title" value="${title}" />
          </div>
        </div>

        <div class="section">
          <div class="section-title">Main Power Entities</div>
          <div class="form-row">
            <label>Grid Entity ID</label>
            <input type="text" data-path="entities.grid" value="${grid}" />
          </div>
          <div class="form-row">
            <label>Solar Entity ID</label>
            <input type="text" data-path="entities.solar" value="${solar}" />
          </div>
          <div class="form-row">
            <label>Home Load Entity ID</label>
            <input type="text" data-path="entities.home" value="${home}" />
          </div>
          <div class="form-row">
            <label>Low Carbon / Fossil Fuel Entity ID</label>
            <input type="text" data-path="entities.fossil_fuel_percentage" value="${fossil}" />
          </div>
        </div>

        <div class="section">
          <div class="section-title">Battery Entities</div>
          <div class="form-row">
            <label>GivEnergy Power Entity</label>
            <input type="text" data-path="entities.givenergy.entity" value="${givPower}" />
          </div>
          <div class="form-row">
            <label>GivEnergy SOC Entity</label>
            <input type="text" data-path="entities.givenergy.state_of_charge" value="${givSoc}" />
          </div>
          <div class="form-row">
            <label>Solix Power Entity</label>
            <input type="text" data-path="entities.solix.entity" value="${solixPower}" />
          </div>
          <div class="form-row">
            <label>Solix SOC Entity</label>
            <input type="text" data-path="entities.solix.state_of_charge" value="${solixSoc}" />
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => this._valueChanged(e));
      input.addEventListener('input', (e) => this._valueChanged(e));
    });
  }
}

if (!customElements.get('multi-power-flow-card')) {
  customElements.define('multi-power-flow-card', MultiPowerFlowCard);
}
if (!customElements.get('multi-power-flow-card-v2')) {
  customElements.define('multi-power-flow-card-v2', MultiPowerFlowCard);
}
if (!customElements.get('multi-power-flow-card-editor')) {
  customElements.define('multi-power-flow-card-editor', MultiPowerFlowCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'multi-power-flow-card')) {
  window.customCards.push({
    type: 'multi-power-flow-card',
    name: 'Multi Power Flow Card',
    description: 'A custom power flow card with Solix S2000 & GivEnergy dual-battery layout and multi-device support.',
    preview: true
  });
}
