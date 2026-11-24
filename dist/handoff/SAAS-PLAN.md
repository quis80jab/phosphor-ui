# Phosphor operations SaaS

Working product plan · 23 November 2026

Phosphor is an inspection workspace that connects an asset and its mission to captured evidence, findings, and a reviewed result. The existing VFD viewer becomes the evidence workbench; the new SaaS shell makes the work around that viewer visible and manageable.

## Delivery boundary

The first screen set is implemented as a local prototype: overview, fleet, inspections, analytics, component library, and workspace settings. All six screens were verified in the browser at the default desktop viewport with the shared shader active and no console errors. Verified interactions include reporting-period changes, keyboard chart selection, fleet search and detail views, saved inspection decisions/notes across reload, instrument value/color accessibility updates, and specification download. Responsive layouts have not yet been browser-verified. It uses labeled demonstration data and browser-local preferences. It is a product and interaction prototype, not a connected fleet service. No cloud account, organization isolation, payment processing, real drone command, or production telemetry connection is implied.

Existing reusable capabilities include the VFD renderer, bitmap glyphs, two divisible grids, the original control workbench, the 3D inspection viewer, simulated drone gauges/joysticks, and settings backup/restore. The SaaS screen set composes these capabilities through the shared page skin and chart binder.

## Screens and decisions

| Screen | User decision | Complete first-pass behavior | Connected product extension |
| --- | --- | --- | --- |
| Overview | What needs my attention? | Site and date scope, inspection-volume trend, coverage meter, fleet readiness, review queue, direct links into work | Freshness indicators, assigned work, organization-scoped aggregates |
| Fleet | Which aircraft is ready for this mission? | Search and status filters, aircraft detail, battery/signal meters, sensor kit and mission context | Device identity, telemetry adapter, maintenance history, heartbeat/stale/offline states |
| Inspections | Is the evidence ready to approve? | Search/filter queue, detail view, finding severity, coverage, review status and saved review note | Capture upload, real evidence references, reviewer assignment, immutable decision history |
| Analytics | Where are inspections slowing down? | Date/site scope, trend and comparison charts, severity distribution, utilization/activity view, data export | Aggregates computed from versioned events, comparable baselines and data-quality coverage |
| Component library | Which element fits this information? | Live charts, graphs and meters with editable values, palette/pattern controls and per-element notes | Versioned component definitions and reusable application layouts |
| Workspace | How should this team work? | Workspace name, local notification/display/unit preferences, save feedback, product-plan link | Membership, roles, integrations, retention, usage limits and billing controls |

Every empty result should explain the active filter and provide a clear reset. Every save should distinguish saved-on-device from session-only failure. A metric should identify its period, scope and unit; a simulated or unavailable value should never look like fresh telemetry.

## Roles

- **Operator:** select a site and asset, prepare a mission, monitor a connected or simulated aircraft, capture evidence, and submit an inspection. Real aircraft commands require their own authorized control workflow; the existing Direct Operate demo remains simulated.
- **Reviewer:** inspect evidence, annotate findings, return work for follow-up, and approve a result. Approval must retain the evidence version and author used for the decision.
- **Workspace admin:** manage members, role assignments, site access, integrations, retention and limits. Admin permissions do not silently grant aircraft control.

A person can hold multiple roles. Production enforcement belongs on the server for every operation and resource; hiding a button is not access control.

## Core records

| Record | Minimum relationship and state |
| --- | --- |
| Workspace | Tenant boundary, members, preferences and resource limits |
| Site | Workspace, location, operating context and assigned assets |
| Asset | Site, asset type, inspection history and evidence coordinate system |
| Drone | Workspace, hardware identity, sensor kit, readiness and latest telemetry freshness |
| Mission | Asset/site, assigned drone/operator, task, planned/active/completed/cancelled state |
| Capture | Mission, source/time, sensor, object-storage location, processing state and provenance |
| Finding | Capture/evidence version, geometry or frame reference, severity, annotation and resolution state |
| Review | Inspection/mission, reviewer, evidence version, decision, note and timestamp |

Use stable opaque identifiers. Store physical values in canonical units and convert for display. Record both event time and ingestion time for telemetry. Preserve original captures; processing produces new derived artifacts with version links.

## Primary workflows

1. **Prepare → capture → submit.** Choose site and asset, inspect drone readiness, open the viewer, complete the capture, check coverage, then submit evidence for review.
2. **Triage → inspect → decide.** Open the review queue, filter by urgency or assignment, inspect the finding in its capture, add a note, then approve or request follow-up. Return to the same filtered queue.
3. **Compare → explain → act.** Scope analytics to a site and period, select a chart segment, inspect the underlying inspections, and export the same scoped data.
4. **Configure → reuse.** Select a chart or meter, adjust data/palette/pattern, save its note or definition, and use the same renderer and state contract on another screen.

## Visual and interaction contract

- One universal VFD optical compositor per assembled page. Draw charts through `canvas.vfdDraw` on the page's integer framebuffer, then apply the shared shader. Do not add chart-specific bloom, separate pixel grids, SVG text, or scaled screenshots.
- `PIXEL_PITCH = 2 / 1.4` CSS pixels; `UI_CELL = 8 * PIXEL_PITCH`. Snap layout tracks, padding and gaps to whole UI cells. Render graph marks, rules and bitmap glyphs at final display-pixel bounds.
- Use pale mint for primary content, dim mint for context, and restrained blue/amber/red for distinct series or meaningful state. Label status and series so color is not their only meaning.
- Use segmented arcs/bars for meters, integer step lines for time series, repeated dots/hashes for fills, and narrow rules. Reflow on small displays instead of scaling the rendered screen.
- Keep native accessible buttons, inputs and selects as interaction targets. Charts need keyboard selection, explicit labels and a textual selected-value readout. Preserve a readable native fallback without WebGL.
- Reuse chart specifications across screens: chart type, data/series, selected index, unit, bounds/target, palette and display pattern. Separate data/selection state from painting and use cleanup on page changes.

## Architecture and delivery gates

| Stage | Implementation | Acceptance gate |
| --- | --- | --- |
| Local prototype | Native ES modules, deterministic demo fixtures, shared VFD rendering, browser-local changes, reusable chart painters | All six screens usable; filters/drill-downs work; notes/settings survive reload; backup includes new state; keyboard and narrow-layout checks pass |
| Connected pilot | Authenticated sessions; one server-owned workspace; relational records; object storage for original/derived captures; upload validation and asynchronous processing; one telemetry adapter | A real capture can be uploaded, processed, viewed and reviewed end to end; stale/disconnected telemetry is visible; failed processing is retryable; backups can be restored |
| Multi-tenant service | Tenant-scoped queries and object access; role/site grants; invitations; audit events; durable jobs; quotas; observability; retention and export/deletion workflows | Cross-tenant denial tests; server authorization for each read/write; audit trail for review/admin actions; enforced limits; recovery drill; scoped export and deletion verified |
| Operating product | Usage metering and billing integration, organization controls, integrations catalog, support tooling and measured performance budgets | Payment events reconcile idempotently; metering is explainable; service targets use measured behavior; support access is limited and audited |

Keep telemetry ingest separate from the browser's render loop. An adapter converts device-specific messages to canonical position, attitude, sensor and freshness records. The browser subscribes to scoped updates and renders the most recent sample; it does not become the authoritative flight controller. Treat control commands as a separate audited subsystem if added later.

Serve large captures from object storage with progressive or spatially scoped delivery. Keep the hologram spotlight's visual detail policy separate from data availability: darkness must not imply missing evidence. Store a manifest describing source resolution, bounds and available derived levels. Record capture provenance so a reviewer can distinguish original evidence, estimated geometry and simulated feeds.

Track limits in explicit units: members, registered devices, capture bytes, processed bytes and processing jobs. Enforce limits before starting expensive work and make usage visible. Do not add a payment form until the billable unit and service behavior are defined.

## Next implementation priorities

1. Verify narrow layouts and continue keyboard/focus coverage. The seven chart primitives, six screen views, SaaS state, and backward-compatible backup format are registered in the program handoff.
2. Connect an inspection record to the existing 3D viewer with a stable evidence ID and a return path that preserves queue filters.
3. Implement the connected-pilot capture/review path before adding broad device integrations or billing.
4. Add tenant and permission enforcement, then test isolation with separate organizations and roles.
5. Measure data-transfer, processing and rendering cost on representative captures before selecting commercial quotas.

The product is ready for a connected pilot when a reviewer can trace a decision back to the exact original evidence and the UI reports failures, stale data and storage limits plainly.
