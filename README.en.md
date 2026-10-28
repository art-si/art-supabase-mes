<div align="center">
  <h1>Yiqi Workshop MES</h1>
  <p><strong>Manufacturing execution for production planning, shop-floor operations, and end-to-end traceability</strong></p>
  <p>A production-order-centered roadmap for scheduling, dispatching, reporting, inspection, completion, and lot/serial traceability.</p>

  <p>
    <a href="https://gitee.com/art-si/art-supabase-mes">Gitee</a>
    ·
    <a href="https://github.com/art-si/art-supabase-mes">GitHub</a>
    ·
    <a href="https://gitee.com/art-si/art-supabase-pro">Platform</a>
    ·
    <a href="https://art-si.github.io/art-supabase-doc/modules/mes">Documentation</a>
    ·
    <a href="./README.md">简体中文</a>
  </p>
</div>

## Positioning

Yiqi Workshop MES is the manufacturing-execution application for Yiqi Workshop. Its target is a traceable production loop connecting standards, plans, shop-floor tasks, personnel and equipment results, quality outcomes, and material lots.

Authentication, tenancy, navigation, authorization, layout, shared components, stores, and the common Supabase client remain owned by [`art-supabase-pro`](https://gitee.com/art-si/art-supabase-pro). MDM and its authoritative sources provide material, equipment, personnel, production-organization, work-center, and process-route identities.

## Current Status

MES is currently in the business implementation preparation stage. The independent application shell, platform runtime, dynamic menu, role access, and manufacturing workbench are complete. Production orders, scheduling, dispatching, reporting, inspection, and traceability remain planned work; the repository does not present demonstration data as live production results.

| Area | Status | Target |
| --- | --- | --- |
| Application foundation | Complete | Standalone runtime, platform loading, shared theme/navigation, and role access |
| Production standards | Pending integration | Process routes, operation versions, work centers, and resource calendars |
| Planning and scheduling | Planned | Production orders, capacity constraints, schedules, and task release |
| Shop-floor execution | Planned | Dispatch, start, material issue, reporting, pause, changeover, and completion |
| Quality and traceability | Planned | In-process inspection, defect handling, lot/serial identity, and production genealogy |

## Work Order and Operation Task Lists

- The scope total covers all matching records. Pending and ready metrics explicitly describe the current page and follow the rows accepted by the table.
- Metrics remain unknown during initialization, loading, or failure; a successfully loaded empty list shows zero. Reference failures have an inline retry, while list failures use the table retry.
- Exports read the complete filtered result within the existing row limit. Operation task exports retain the work center or workshop scope selected when export starts; changing navigation cannot mix scopes, and the table continues to show the latest selection.

## Target Flow

```text
Production order
  → constrained scheduling
  → task dispatch
  → start / material issue / reporting
  → inspection and exception handling
  → completion and finished-goods receipt
  → lot / serial genealogy
```

## Run Locally

Requirements: Node.js `>= 22.0.0` and pnpm `>= 11.9.0`.

```powershell
pnpm install
pnpm dev
```

The default development URL is `http://localhost:3019`.

```powershell
pnpm check
pnpm build
pnpm preview
```

Production output is written to `docs/` with `/art-supabase-mes/` as the default public base path.

## Platform Collaboration and Security

Commit and push MES changes here, then update the `modules/art-supabase-mes` gitlink in the platform repository. Cross-domain data must use purpose-specific, minimum-field, tenant-isolated API/RPC contracts. Dispatch, reporting, inspection, completion, and reversal actions require explicit permissions and server-side state validation; UI visibility is never the final authorization boundary.

## License

Licensed under [MulanPSL-2.0](LICENSE).
