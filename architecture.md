# Project Architecture & Workflow

Here is the complete architectural layout and sequential workflow of the Fernhill Stays Dashboard project, outlining how data transitions from raw CSV bookings to the dynamic React-based analytics dashboard.

---

## Table of Contents

| # | Section | What you'll learn |
|---|---|---|
| 1 | [Workflow Overview](#1-workflow-overview) | General two-stage pipeline of the application |
| 2 | [Data Processing Pipeline](#2-data-processing-pipeline) | Ingesting and cleaning raw CSV data into JSON |
| 3 | [Frontend Application Mount](#3-frontend-application-mount) | DOM entry bootstrap rendering and global styling sheets |
| 4 | [React Dashboard Application State](#4-react-dashboard-application-state) | Fetch Hooks, state declarations, and helper parameters |
| 5 | [Dashboard Interface Layout and Panels](#5-dashboard-interface-layout-and-panels) | Code breakdown of the visual headers, sidebar, and tab workspaces |
| 6 | [Pipeline Configs and Bundling](#6-pipeline-configs-and-bundling) | Building environments, dependencies, and Tailwind configurations |

---

## 1. Workflow Overview

The system operates in a decoupled **2-stage pipeline**:
1. **Data Cleaning (ETL Stage)**: An offline Python script processes raw booking transactions, sanitizes inconsistent formatting, fixes data quality anomalies, aggregates complex metrics (such as occupancy rate and health scores), and writes a flat JSON file.
2. **Dashboard Rendering (UI Stage)**: A fast React single-page application (SPA) loads the static JSON dataset, manages interactive selectors (properties and panels), and builds visual dashboards containing interactive Recharts graphs.

---

## 2. Data Processing Pipeline

This stage cleans and structures raw property statistics.

### [bookings_jan_may_2026.csv](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/bookings_jan_may_2026.csv)
- **Role**: Database Source.
- **Description**: Contains raw CSV inputs representing hotel reservations (Jan – May 2026). It contains dirty values such as casing mismatches, null values, 10x amount typos, negative figures, and missing rates.

### [clean.py](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/clean.py)
- **Role**: ETL/Cleaning Processor.
- **Description**: Pandas script that parses raw CSV columns and systematically fixes 12 distinct data quality issues:
  - **Issue 1-5 (Lines 11-56)**: Removes identical duplicate rows and normalizes strings for properties, reservation statuses, booking channels, and room types.
  - **Issue 6 (Lines 74-87)**: Parses mixed date formats (e.g. `MM-DD-YYYY` vs `DD-MM-YYYY`) to a clean `YYYY-MM-DD` standard.
  - **Issue 7-11 (Lines 89-130)**: Discards zero-night stays, converts negative total amounts using absolute values, detects and overrides 10x total amount typos, and recovers missing nightly rates/total amounts by calculation.
  - **Issue 12 (Lines 133-138)**: Discards any record that still contains critical null values.
  - **Aggregations & Calculations (Lines 156-238)**: For each property, it calculates occupancy rates (based on a 10-room assumption over 150 days), revenue efficiencies, channel mix percentages, cancellation scores, and calculates a custom weighted **Health Score** (occupancy 40%, revenue efficiency 30%, direct/corp channel mix 20%, cancellation rating 10%).
  - **Output Generator (Lines 275-278)**: Saves the cleaned outputs to `public/cleaned_data.json`.

### [public/cleaned_data.json](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/public/cleaned_data.json)
- **Role**: Dashboard Database.
- **Description**: The unified dashboard payload representing property arrays, channel statistics, and data quality indicators, serving as the API mock for the frontend.

---

## 3. Frontend Application Mount

Initializes the frontend layout and global stylesheet defaults.

### [index.html](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/index.html)
- **Role**: HTML Wrapper.
- **Description**: Standard HTML skeleton that provides the anchor tag `<div id="root"></div>` where the React components are injected.

### [src/main.jsx](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/main.jsx)
- **Role**: Application Root Entry.
- **Description**: Initial Javascript rendering logic that mounts `<App />` inside the strict mode container.

### [src/index.css](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/index.css) & [src/App.css](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.css)
- **Role**: Stylings and Layout Sheets.
- **Description**: Houses standard directives importing Tailwind stylesheets, along with custom overrides for loading animations and scrollbars.

---

## 4. React Dashboard Application State

Manages core state transitions, data conversions, and reusable layout parts.

### [src/App.jsx - State Management](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L162-L172)
- **Role**: State Hooks.
- **Description**: Controls React variables: `data` for storing property details, `selected` for tracking active sidebar selection, `tab` for switching layout workspaces, and `loading` for loader states.

### [src/App.jsx - Fetch Hooks](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L173-L180)
- **Role**: Data Fetching Hook.
- **Description**: Fires a `useEffect` call on load to fetch `/cleaned_data.json` and update local states asynchronously.

### [src/App.jsx - Core Utility Helpers](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L15-L53)
- **Role**: Layout Helper Functions.
- **Description**: Defines helpers for visual styling adjustments:
  - `fmt`: Truncates currency formatting.
  - `scoreColor`, `scoreBg`, `scoreBar`: Determine CSS text, background, and indicator colors dynamically based on health thresholds.

### [src/App.jsx - Sub-components](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L54-L157)
- **Role**: Reusable visual structures.
- **Description**: Renders isolated visual parts:
  - `ScoreRing` (Lines 64-86): SVG circular progress indicator highlighting property health scores.
  - `StatCard` (Lines 92-105): Modular KPI cards.
  - `PropertyCard` (Lines 111-133): Sidebar navigation cards displaying individual progress levels.
  - `CustomTooltip` (Lines 139-156): Tailored popups for the Recharts graphics.

---

## 5. Dashboard Interface Layout and Panels

Arranges sections and visual elements into active workspace panels.

### [Header Section](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L221-L244)
- **Role**: Logo and Metadata Bar.
- **Description**: Contains dashboard titles and simple data metrics badges showing cleaned rows.

### [Sidebar Section](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L248-L279)
- **Role**: Left Selector Menu.
- **Description**: Lists interactive properties and displays raw statistics on database quality.

### [Tabs Switcher](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L281-L306)
- **Role**: Views Navigator.
- **Description**: Switches views between Overview, Channels, and Health Score panels.

### [Overview Panel](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L307-L393)
- **Role**: Financial Workspace.
- **Description**: Focuses on core indicators:
  - **KPI grid (Lines 330-335)**: Cards displaying Realized Revenue, Average Nightly Rate (ADR), Checked Out bookings, and Cancellation metrics.
  - **Trend chart (Lines 354-371)**: Recharts `LineChart` showing monthly revenue trends.
  - **Comparison chart (Lines 374-391)**: Recharts `BarChart` comparing relative income sizes.

### [Channels Panel](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L395-L519)
- **Role**: Marketing Channel Analysis.
- **Description**: Analyzes reservation sources:
  - **Distribution cards (Lines 401-425)**: Overview of booking sizes and counts.
  - **Share pie chart (Lines 429-452)**: Recharts `PieChart` breaking down revenue by channel.
  - **Value bar chart (Lines 454-474)**: Recharts `BarChart` detailing average booking values.
  - **Breakdown table (Lines 478-518)**: Grid detailing booking data per channel.

### [Health Score Panel](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/src/App.jsx#L521-L611)
- **Role**: Performance Audit Workspace.
- **Description**: Explains operational calculations:
  - **Formula explanation card (Lines 527-538)**: Details the weighted score equation.
  - **Score grid (Lines 541-553)**: Performance rankings across properties.
  - **Health comparison (Lines 556-576)**: Visual bar chart mapping property health.
  - **Score components list (Lines 579-609)**: Details individual component contributions (Occupancy, Revenue Efficiency, Channel Mix, and Cancellation ratings).

---

## 6. Pipeline Configs and Bundling

Project build files and configuration parameters.

### [package.json](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/package.json)
- **Role**: Dependency Manager.
- **Description**: Defines build commands (`vite build`), styling packages (`tailwindcss`, `autoprefixer`), and core dependencies (`react`, `recharts`, `lucide-react`).

### [vite.config.js](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/vite.config.js)
- **Role**: Build Configurations.
- **Description**: Standard Vite configuration file loading `@vitejs/plugin-react` for JSX compilations.

### [tailwind.config.js](file:///c:/Users/arjun/Downloads/Documents/bookings/fernhill-dashboard/tailwind.config.js)
- **Role**: CSS Framework Setup.
- **Description**: Connects Tailwind to files in the `src` folder, defining typography configurations and visual responsive boundaries.
