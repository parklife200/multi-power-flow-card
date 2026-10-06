# Multi Power Flow Card for Home Assistant

A generic, highly configurable custom Lovelace power-flow card for Home Assistant supporting dual batteries (e.g. GivEnergy & Anker Solix S2000), solar generation, grid import/export, low-carbon grid percentage, and multiple individual load appliances.

![Multi Power Flow Card](https://raw.githubusercontent.com/parklife200/multi-power-flow-card/main/preview.png)

## Features

- **⚡ Animated Power Flows**: Dynamic dots move along curved paths showing active energy transfer direction and rate.
- **🔋 Dual Battery Support**: Native support for multiple batteries with state-of-charge (SoC) percentages and charging/discharging indicators (`↓` / `↑`).
- **🔌 Unlimited Individual Appliances**: Easily add heat pumps, EV chargers, servers, washing machines, tumble dryers, TVs, and custom devices.
- **🍃 Grid Low-Carbon Intensity**: Optional node displaying real-time fossil fuel percentage or green energy mix.
- **🖱️ Interactive More-Info Popups**: Clicking any node opens the standard Home Assistant entity detail modal.
- **🎨 Full Visual Editor & YAML Config**: Edit directly in the Home Assistant UI card editor or customize via YAML.
- **🔄 Sign Inversion**: Per-sensor `invert: true` flag for integrations with reversed power conventions.

---

## Installation

### Method 1: HACS (Recommended)

1. Open **HACS** in Home Assistant.
2. Click the top-right menu icon (⋮) and select **Custom repositories**.
3. Add repository URL: `https://github.com/parklife200/multi-power-flow-card`
4. Select Category: **Dashboard** (or Lovelace).
5. Click **Download** and reload your dashboard.

### Method 2: Manual Installation

1. Download `multi-power-flow-card.js` from the latest release.
2. Place the file in your Home Assistant `/config/www/` directory (`/local/multi-power-flow-card.js`).
3. In Home Assistant, navigate to **Settings** -> **Dashboards** -> **Resources** (top right menu).
4. Add resource:
   - **URL**: `/local/multi-power-flow-card.js`
   - **Resource Type**: `JavaScript Module`

---

## Example YAML Configuration

```yaml
type: custom:multi-power-flow-card
title: Home Energy Flow

core:
  grid:
    entity: sensor.grid_power
    name: Grid
    icon: mdi:transmission-tower
    color: "#0288D1"
    invert: false

  solar:
    entity: sensor.solar_power
    name: Solar
    icon: mdi:solar-power
    color: "#FF9800"

  home:
    entity: sensor.home_power
    name: Home
    icon: mdi:home
    color: "#00BCD4"

  low_carbon:
    entity: sensor.grid_fossil_fuel_percentage
    name: Low Carbon
    icon: mdi:leaf
    color: "#00C853"

batteries:
  - id: givenergy
    entity: sensor.givenergy_battery_power
    soc_entity: sensor.givenergy_soc
    name: GivEnergy
    icon: mdi:battery
    color: "#00BCD4"

  - id: solix
    entity: sensor.solix_s2000_net_power
    soc_entity: sensor.solix_s2000_soc
    name: Solix S2000
    icon: mdi:battery
    color: "#FFC107"

devices:
  - id: heat_pump
    entity: sensor.heat_pump_power
    name: Heat Pump
    icon: mdi:heat-pump
    color: "#FF24BA"

  - id: homelab
    entity: sensor.homelab_power
    name: Homelab
    icon: mdi:server-network
    color: "#9C27B0"

  - id: ev_charger
    entity: sensor.ev_charger_power
    name: Polestar
    icon: mdi:car-electric
    color: "#07607E"

display:
  show_title: true
  show_values: true
  show_soc: true
  show_icons: true

flow:
  animate: true
  animation_speed: 1
```

---

## Configuration Reference

### Core Node Properties
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `entity` | string | *required* | Entity ID for power in W or kW |
| `name` | string | Friendly name | Label text displayed under node |
| `icon` | string | `mdi:...` | MDI icon or emoji symbol |
| `color` | string | Hex code | Stroke & theme color for node and animated dots |
| `invert` | boolean | `false` | Invert sign of power values |

### Battery Node Properties
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | `battery_1` | Unique ID for the battery |
| `entity` | string | *required* | Battery power sensor (positive = discharge, negative = charge) |
| `soc_entity` | string | `null` | Battery State of Charge percentage entity |
| `name` | string | `Battery` | Battery label |
| `color` | string | `#00BCD4` | Theme color |

---

## License

MIT License © [parklife200](https://github.com/parklife200)
