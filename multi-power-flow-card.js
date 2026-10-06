/* Multi Power Flow Card - generic/shareable Home Assistant custom card */

class MultiPowerFlowCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
    this._nodeKey = '';
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
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

  getGridOptions() {
    return { rows: 5, columns: 4, min_columns: 3 };
  }

  static getLayoutOptions() {
    return { grid_rows: 5, grid_columns: 4, grid_min_columns: 3 };
  }

  // Home Assistant Native UI Card Visual Form Editor (Native HA Entity Pickers)
  static getConfigForm() {
    const sensor = (name, label, helper) => ({
      name,
      selector: { entity: { filter: { domain: 'sensor' } } },
      computeLabel: () => label,
      computeHelper: () => helper
    });

    return {
      schema: [
        {
          name: 'title',
          selector: { text: {} },
          computeLabel: () => 'Card Title'
        },
        {
          type: 'expandable',
          name: 'core',
          title: '⚡ Core Sensors',
          flatten: true,
          schema: [
            sensor('grid', 'Grid Power Sensor', 'Positive = import, negative = export (W or kW).'),
            sensor('solar', 'Solar Generation Sensor', 'PV power generation (W or kW).'),
            sensor('home', 'Home Load Sensor', 'Total household load power (W or kW).'),
            sensor('fossil_fuel_percentage', 'Low Carbon / Grid Fossil Fuel %', 'Grid intensity or green power %.')
          ]
        },
        {
          type: 'expandable',
          name: 'battery1',
          title: '🔋 Battery 1 (Main Battery)',
          flatten: true,
          schema: [
            sensor('battery1_power', 'Battery 1 Power Sensor', 'Power sensor (positive = discharge, negative = charge).'),
            sensor('battery1_soc', 'Battery 1 State of Charge', 'State of charge percentage (0-100%).')
          ]
        },
        {
          type: 'expandable',
          name: 'battery2',
          title: '🔋 Battery 2 (Secondary Battery)',
          flatten: true,
          schema: [
            sensor('battery2_power', 'Battery 2 Power Sensor', 'Power sensor.'),
            sensor('battery2_soc', 'Battery 2 State of Charge', 'State of charge percentage.')
          ]
        },
        {
          type: 'expandable',
          name: 'devices',
          title: '🔌 Appliances & Individual Loads',
          flatten: true,
          schema: [
            sensor('ashp', 'Heat Pump / Heating', 'Leave empty if not installed.'),
            sensor('homelab', 'Homelab / Server', 'Leave empty if not installed.'),
            sensor('dryer', 'Tumble Dryer', 'Leave empty if not installed.'),
            sensor('washer', 'Washing Machine', 'Leave empty if not installed.'),
            sensor('polestar', 'EV Charger', 'Leave empty if not installed.'),
            sensor('lounge_tv', 'TV / Entertainment', 'Leave empty if not installed.')
          ]
        },
        {
          type: 'expandable',
          name: 'options',
          title: '⚙️ Options',
          flatten: true,
          schema: [
            {
              name: 'kw_threshold',
              selector: { number: { min: 100, max: 10000, step: 100, unit_of_measurement: 'W' } },
              computeLabel: () => 'kW Conversion Threshold',
              computeHelper: () => 'Values above this threshold display in kW (default 1000 W).'
            },
            {
              name: 'hide_inactive_nodes',
              selector: { boolean: {} },
              computeLabel: () => 'Hide Unconfigured Nodes',
              computeHelper: () => 'Hide load or battery nodes that have no sensor assigned.'
            }
          ]
        }
      ],
      computeHelper: (schema) => schema.name === 'title' ? 'Title shown at top of the card.' : undefined
    };
  }

  _handleNodeClick(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: entityId },
      bubbles: true,
      composed: true
    }));
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
    const kwThreshold = (this._config && this._config.kw_threshold) || 1000;

    if (Math.abs(val) >= kwThreshold) {
      return (val / 1000).toFixed(1) + ' kW';
    }
    return Math.round(val) + ' ' + uom;
  }

  getSocVal(entityRef) {
    const entityId = this.getEntityId(entityRef);
    if (!this._hass || !entityId || !this._hass.states[entityId]) return '';
    const st = this._hass.states[entityId];
    const val = Math.round(parseFloat(st.state) || 0);
    return val + '%';
  }

  _configEntity(key, legacyPath, fallbackEntity = null) {
    const v = this._config?.[key];
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && v.entity) return v.entity;
    if (typeof legacyPath === 'string') return legacyPath;
    if (legacyPath && typeof legacyPath === 'object' && legacyPath.entity) return legacyPath.entity;
    return fallbackEntity;
  }

  getActiveNodes() {
    const entities = (this._config && this._config.entities) || {};
    const core = (this._config && this._config.core) || {};

    const gridEnt = this._configEntity('grid', core.grid || entities.grid);
    const solarEnt = this._configEntity('solar', core.solar || entities.solar);
    const homeEnt = this._configEntity('home', core.home || entities.home);
    const lowCarbonEnt = this._configEntity('fossil_fuel_percentage', core.low_carbon || entities.fossil_fuel_percentage);

    const batteries = Array.isArray(this._config?.batteries) ? this._config.batteries : (Array.isArray(entities.batteries) ? entities.batteries : []);
    const b1Config = batteries[0] || entities.givenergy || {};
    const b2Config = batteries[1] || entities.solix || {};

    const b1Power = this._configEntity('battery1_power', b1Config.entity || this._configEntity('givenergy_entity', null));
    const b1Soc = this._configEntity('battery1_soc', b1Config.soc_entity || b1Config.state_of_charge || this._configEntity('givenergy_soc', null));

    const b2Power = this._configEntity('battery2_power', b2Config.entity || this._configEntity('solix_entity', null));
    const b2Soc = this._configEntity('battery2_soc', b2Config.soc_entity || b2Config.state_of_charge || this._configEntity('solix_soc', null));

    const individual = Array.isArray(this._config?.devices) ? this._config.devices : (Array.isArray(entities.individual) ? entities.individual : []);

    const findIndiv = (keys, cfgKey, defaultName, defaultIcon, defaultColor) => {
      const explicit = this._configEntity(cfgKey, null);
      if (explicit) {
        return { enabled: true, entity: explicit, name: defaultName, icon: defaultIcon, color: defaultColor };
      }
      const found = individual.find(item => {
        if (!item || typeof item !== 'object') return false;
        const id = (item.id || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const ent = (item.entity || '').toLowerCase();
        return keys.some(k => id === k || name.includes(k) || ent.includes(k));
      });

      if (found) {
        return {
          enabled: !!found.entity,
          entity: found.entity,
          name: found.name || defaultName,
          icon: this.getIconSymbol(found.icon, defaultIcon),
          color: found.color ? (Array.isArray(found.color) ? `rgb(${found.color.join(',')})` : found.color) : defaultColor
        };
      }
      return { enabled: false, entity: null, name: defaultName, icon: defaultIcon, color: defaultColor };
    };

    const ashp = findIndiv(['ashp', 'heat pump', 'harvi'], 'ashp', 'Heat Pump', '🌀', '#FF24BA');
    const homelab = findIndiv(['homelab', 'server'], 'homelab', 'Homelab', '🖥️', '#9C27B0');
    const dryer = findIndiv(['dryer', 'tumble_dryer'], 'dryer', 'Tumble Dryer', '♨️', '#FF9800');
    const washer = findIndiv(['washer', 'washing_machine'], 'washer', 'Washing Machine', '🫧', '#2196F3');
    const polestar = findIndiv(['polestar', 'ev', 'zappi'], 'polestar', 'EV Charger', '🚗', '#07607E');
    const tv = findIndiv(['tv', 'lounge_tv'], 'lounge_tv', 'TV', '📺', '#8BC34A');

    const hideInactive = !!this._config?.hide_inactive_nodes;

    return {
      lowcarbon: { id: 'lowcarbon', label: 'Low Carbon', icon: '🍃', color: '#00C853', x: 35, y: 25, entity: lowCarbonEnt, enabled: hideInactive ? !!lowCarbonEnt : true },
      grid: { id: 'grid', label: 'Grid', icon: '🗼', color: '#0288D1', x: 35, y: 170, entity: gridEnt, enabled: true },
      solar: { id: 'solar', label: 'Solar', icon: '☀️', color: '#FF9800', x: 175, y: 25, entity: solarEnt, enabled: hideInactive ? !!solarEnt : true },
      givenergy: { id: 'givenergy', label: b1Config.name || 'Battery 1', icon: '🔋', color: '#00BCD4', x: 175, y: 315, entity: b1Power, socEntity: b1Soc, enabled: hideInactive ? !!b1Power : true },
      ashp: { id: 'ashp', label: ashp.name, icon: ashp.icon, color: ashp.color, x: 315, y: 25, entity: ashp.entity, enabled: ashp.enabled },
      home: { id: 'home', label: 'Home', icon: '🏠', color: '#FF9800', x: 315, y: 170, entity: homeEnt, isHome: true, enabled: true },
      solix: { id: 'solix', label: b2Config.name || 'Battery 2', icon: '🔋', color: '#FFC107', x: 315, y: 315, entity: b2Power, socEntity: b2Soc, enabled: hideInactive ? !!b2Power : true },
      dryer: { id: 'dryer', label: dryer.name, icon: dryer.icon, color: dryer.color, x: 455, y: 25, entity: dryer.entity, enabled: dryer.enabled },
      homelab: { id: 'homelab', label: homelab.name, icon: homelab.icon, color: homelab.color, x: 455, y: 315, entity: homelab.entity, enabled: homelab.enabled },
      washer: { id: 'washer', label: washer.name, icon: washer.icon, color: washer.color, x: 595, y: 25, entity: washer.entity, enabled: washer.enabled },
      polestar: { id: 'polestar', label: polestar.name, icon: polestar.icon, color: polestar.color, x: 595, y: 315, entity: polestar.entity, enabled: polestar.enabled },
      lounge_tv: { id: 'lounge_tv', label: tv.name, icon: tv.icon, color: tv.color, x: 735, y: 315, entity: tv.entity, enabled: tv.enabled }
    };
  }

  getPathD(cId, isReverse = false) {
    const R = 48, hcX = 363, hcY = 218, gcX = 83, scX = 223, scY = 73, givX = 223, givY = 363, r = 14;
    const getCircleEdgeX = (dy, right = true) => hcX + (right ? 1 : -1) * Math.sqrt(Math.max(0, R * R - dy * dy));
    const getGridEdgeX = (dy) => gcX + Math.sqrt(Math.max(0, R * R - dy * dy));
    const getSolarBottomY = (x) => scY + Math.sqrt(Math.max(0, R * R - Math.pow(x - scX, 2)));
    const getGivenergyTopY = (x) => givY - Math.sqrt(Math.max(0, R * R - Math.pow(x - givX, 2)));

    switch (cId) {
      case 'lowcarbon-grid': return `M 83 121 L 83 170`;
      case 'grid-home': return isReverse ? `M ${getCircleEdgeX(0, false)} 218 L ${getGridEdgeX(0)} 218` : `M ${getGridEdgeX(0)} 218 L ${getCircleEdgeX(0, false)} 218`;
      case 'solar-home': return isReverse ? `M ${getCircleEdgeX(-24, false).toFixed(2)} 194 L 261 194 Q 247 194, 247 180 L 247 ${getSolarBottomY(247).toFixed(2)}` : `M 247 ${getSolarBottomY(247).toFixed(2)} L 247 180 Q 247 194, 261 194 L ${getCircleEdgeX(-24, false).toFixed(2)} 194`;
      case 'solar-givenergy': return isReverse ? `M 223 ${getGivenergyTopY(223).toFixed(2)} L 223 ${getSolarBottomY(223).toFixed(2)}` : `M 223 ${getSolarBottomY(223).toFixed(2)} L 223 ${getGivenergyTopY(223).toFixed(2)}`;
      case 'solar-grid': return isReverse ? `M ${getGridEdgeX(-24).toFixed(2)} 194 L 185 194 Q 199 194, 199 180 L 199 ${getSolarBottomY(199).toFixed(2)}` : `M 199 ${getSolarBottomY(199).toFixed(2)} L 199 180 Q 199 194, 185 194 L ${getGridEdgeX(-24).toFixed(2)} 194`;
      case 'grid-givenergy': return isReverse ? `M 199 ${getGivenergyTopY(199).toFixed(2)} L 199 256 Q 199 242, 185 242 L ${getGridEdgeX(24).toFixed(2)} 242` : `M ${getGridEdgeX(24).toFixed(2)} 242 L 185 242 Q 199 242, 199 256 L 199 ${getGivenergyTopY(199).toFixed(2)}`;
      case 'givenergy-home': return isReverse ? `M ${getCircleEdgeX(24, false).toFixed(2)} 242 L 261 242 Q 247 242, 247 256 L 247 ${getGivenergyTopY(247).toFixed(2)}` : `M 247 ${getGivenergyTopY(247).toFixed(2)} L 247 256 Q 247 242, 261 242 L ${getCircleEdgeX(24, false).toFixed(2)} 242`;
      case 'home-ashp': return `M 363 170 L 363 121`;
      case 'solix-home': return isReverse ? `M 363 266 L 363 315` : `M 363 315 L 363 266`;
      case 'solix-homelab': return `M 411 363 L 455 363`;
      case 'home-dryer': return `M ${getCircleEdgeX(-24, true)} ${hcY - 24} L 489 ${hcY - 24} Q 503 ${hcY - 24}, 503 ${hcY - 24 - r} L 503 121`;
      case 'home-washer': return `M ${getCircleEdgeX(-12, true)} ${hcY - 12} L 629 ${hcY - 12} Q 643 ${hcY - 12}, 643 ${hcY - 12 - r} L 643 121`;
      case 'home-lounge_tv': return `M ${getCircleEdgeX(12, true)} ${hcY + 12} L 769 ${hcY + 12} Q 783 ${hcY + 12}, 783 ${hcY + 12 + r} L 783 315`;
      case 'home-polestar': return `M ${getCircleEdgeX(24, true)} ${hcY + 24} L 629 ${hcY + 24} Q 643 ${hcY + 24}, 643 ${hcY + 24 + r} L 643 315`;
      default: return '';
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

    let pathsHtml = '', dotsHtml = '';
    connections.forEach(c => {
      pathsHtml += `<path id="path-${c.id}" d="${this.getPathD(c.id, false)}" stroke="${c.color}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
      dotsHtml += `<g id="dotgroup-${c.id}" style="display: none;"></g>`;
    });

    let nodesHtml = '';
    Object.values(nodes).forEach(n => {
      if (!n.enabled) return;
      const borderCol = n.isHome ? '#00bcd4' : n.color;
      nodesHtml += `
        <g transform="translate(${n.x}, ${n.y})" class="node-group" data-entity="${n.entity || ''}">
          <circle cx="48" cy="48" r="46" fill="#0b0f19" stroke="${borderCol}" stroke-width="3.5" />
          ${n.isHome ? `<circle cx="48" cy="48" r="41" fill="none" stroke="#ff9800" stroke-width="2.5"/>` : ''}
          <text x="48" y="${n.y < 100 ? -14 : 116}" text-anchor="middle" fill="#cbd5e1" font-size="13.5" font-weight="700">${n.label}</text>
          <text id="soc-${n.id}" x="48" y="24" text-anchor="middle" fill="${n.color}" font-size="13.5" font-weight="800"></text>
          <text x="48" y="48" id="icon-${n.id}" text-anchor="middle" font-size="30">${n.icon}</text>
          <text id="val-${n.id}" x="48" y="72" text-anchor="middle" fill="#f1f5f9" font-size="13.5" font-weight="800"></text>
        </g>
      `;
    });

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        ha-card { background: #111827; border-radius: 16px; padding: 16px; color: #f1f5f9; font-family: system-ui, sans-serif; overflow: hidden; }
        .card-header { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px; text-align: center; }
        .svg-wrapper { width: 100%; overflow: hidden; }
        svg.power-svg { width: 100%; display: block; overflow: visible; }
        .node-group { cursor: pointer; }
      </style>
      <ha-card>
        <div class="card-header">${(this._config && this._config.title) || 'Multi Power Flow'}</div>
        <div class="svg-wrapper">
          <svg class="power-svg" viewBox="0 -18 850 456" preserveAspectRatio="xMidYMid meet">
            ${pathsHtml}${dotsHtml}${nodesHtml}
          </svg>
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll('.node-group').forEach(el => {
      el.addEventListener('click', () => this._handleNodeClick(el.getAttribute('data-entity')));
    });
  }

  updateValues() {
    if (!this.shadowRoot || !this._hass) return;
    const nodes = this.getActiveNodes();

    const rawGridW = this.parseWatts(nodes.grid.entity);
    const isExportingGrid = rawGridW < 0;
    const gridW = Math.abs(rawGridW);
    const solarW = Math.abs(this.parseWatts(nodes.solar.entity));

    const b1Raw = this.parseWatts(nodes.givenergy.entity);
    const isB1Charging = b1Raw < 0;
    const b1W = Math.abs(b1Raw);

    const solarToB1W = isB1Charging ? Math.min(solarW, b1W) : 0;
    const remSolar = Math.max(0, solarW - solarToB1W);

    const solarToGridW = isExportingGrid ? Math.min(remSolar, gridW) : 0;
    const solarToHomeW = Math.max(0, remSolar - solarToGridW);

    const gridToB1W = isB1Charging ? Math.max(0, b1W - solarToB1W) : 0;
    const b1ToGridW = (!isB1Charging && isExportingGrid) ? Math.min(b1W, Math.max(0, gridW - solarToGridW)) : 0;

    const gridToHomeW = isExportingGrid ? 0 : Math.max(0, gridW - gridToB1W);
    const b1ToHomeW = !isB1Charging ? Math.max(0, b1W - b1ToGridW) : 0;

    const b2Raw = this.parseWatts(nodes.solix.entity);
    const b2W = Math.abs(b2Raw);
    const isB2Charging = b2Raw < 0;

    const homelabW = Math.abs(this.parseWatts(nodes.homelab.entity));
    const ashpW = Math.abs(this.parseWatts(nodes.ashp.entity));
    const polestarW = Math.abs(this.parseWatts(nodes.polestar.entity));
    const dryerW = Math.abs(this.parseWatts(nodes.dryer.entity));
    const washerW = Math.abs(this.parseWatts(nodes.washer.entity));
    const tvW = Math.abs(this.parseWatts(nodes.lounge_tv.entity));

    const nodeVals = {
      lowcarbon: { val: nodes.lowcarbon.entity ? (this.getSocVal(nodes.lowcarbon.entity) || '86%') : '' },
      grid: { val: (isExportingGrid ? '← ' : '→ ') + (nodes.grid.entity ? this.getDisplayVal(nodes.grid.entity, 'W', true) : '0 W') },
      solar: { val: nodes.solar.entity ? this.getDisplayVal(nodes.solar.entity) : '0 W' },
      givenergy: { val: nodes.givenergy.entity ? ((isB1Charging ? '↓ ' : '↑ ') + this.getDisplayVal(nodes.givenergy.entity)) : '0 W', soc: this.getSocVal(nodes.givenergy.socEntity) },
      ashp: { val: nodes.ashp.entity ? this.getDisplayVal(nodes.ashp.entity, 'W', true) : '' },
      home: { val: nodes.home.entity ? this.getDisplayVal(nodes.home.entity) : '0 W' },
      solix: { val: nodes.solix.entity ? ((isB2Charging ? '↓ ' : '↑ ') + this.getDisplayVal(nodes.solix.entity)) : '0 W', soc: this.getSocVal(nodes.solix.socEntity) },
      dryer: { val: nodes.dryer.entity ? this.getDisplayVal(nodes.dryer.entity) : '' },
      homelab: { val: nodes.homelab.entity ? this.getDisplayVal(nodes.homelab.entity) : '' },
      washer: { val: nodes.washer.entity ? this.getDisplayVal(nodes.washer.entity) : '' },
      polestar: { val: nodes.polestar.entity ? this.getDisplayVal(nodes.polestar.entity) : '' },
      lounge_tv: { val: nodes.lounge_tv.entity ? this.getDisplayVal(nodes.lounge_tv.entity) : '' }
    };

    Object.keys(nodes).forEach(id => {
      if (!nodes[id].enabled) return;
      const data = nodeVals[id];
      const valEl = this.shadowRoot.getElementById('val-' + id);
      if (valEl && data) valEl.textContent = data.val;
      const socEl = this.shadowRoot.getElementById('soc-' + id);
      if (socEl && data) socEl.textContent = data.soc || '';
      const iconEl = this.shadowRoot.getElementById('icon-' + id);
      if (iconEl && data) iconEl.setAttribute('y', data.soc ? '54' : '48');
    });

    const connData = [
      { id: 'lowcarbon-grid', color: '#00C853', watts: nodes.lowcarbon.entity ? 100 : 0, isReverse: false },
      { id: 'grid-home', color: '#0288D1', watts: gridToHomeW, isReverse: false },
      { id: 'solar-home', color: '#FF9800', watts: solarToHomeW, isReverse: false },
      { id: 'solar-givenergy', color: '#00BCD4', watts: solarToB1W, isReverse: false },
      { id: 'solar-grid', color: '#FF9800', watts: solarToGridW, isReverse: false },
      { id: 'grid-givenergy', color: '#00BCD4', watts: (gridToGivW > 0 ? gridToGivW : b1ToGridW), isReverse: (b1ToGridW > 0) },
      { id: 'givenergy-home', color: '#00BCD4', watts: b1ToHomeW, isReverse: false },
      { id: 'home-ashp', color: nodes.ashp.color, watts: ashpW, isReverse: false },
      { id: 'solix-home', color: '#FFC107', watts: b2W, isReverse: isB2Charging },
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

      if (pathEl && pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d);

      if (groupEl) {
        groupEl.style.display = active ? 'block' : 'none';
        if (active) {
          const durVal = Math.max(0.8, Math.min(5.5, (2400 / Math.max(c.watts, 10)))).toFixed(2);
          const durStr = durVal + 's';
          if (groupEl.getAttribute('data-path') !== d || groupEl.getAttribute('data-dur') !== durVal) {
            groupEl.setAttribute('data-path', d);
            groupEl.setAttribute('data-dur', durVal);
            groupEl.innerHTML = `
              <circle r="4.8" fill="${c.color}"><animateMotion path="${d}" dur="${durStr}" repeatCount="indefinite" calcMode="linear" /></circle>
              <circle r="4.8" fill="${c.color}"><animateMotion path="${d}" dur="${durStr}" begin="-${(durVal/2).toFixed(2)}s" repeatCount="indefinite" calcMode="linear" /></circle>
            `;
          }
        }
      }
    });
  }

  static getStubConfig() {
    return {
      title: 'Power Flow',
      grid: '',
      solar: '',
      home: ''
    };
  }
}

if (!customElements.get('multi-power-flow-card')) {
  customElements.define('multi-power-flow-card', MultiPowerFlowCard);
}
if (!customElements.get('multi-power-flow-card-v2')) {
  customElements.define('multi-power-flow-card-v2', MultiPowerFlowCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'multi-power-flow-card')) {
  window.customCards.push({
    type: 'multi-power-flow-card',
    name: 'Multi Power Flow Card',
    description: 'Generic configurable Home Assistant power-flow card.',
    preview: true
  });
}
