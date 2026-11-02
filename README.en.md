<div align="center">
  <h1>Yiqi Workshop MES</h1>
  <p><strong>Production planning, shop-floor execution, packing, and traceability</strong></p>
  <p>Connect work orders, scheduling, reporting, quality events, equipment tasks, and WMS production receipts.</p>

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

## Purpose

MES connects production foundations, orders, schedules, shop-floor records, quality outcomes, and material identities. The repository owns manufacturing pages, APIs, types, and rules. [`art-supabase-pro`](https://gitee.com/art-si/art-supabase-pro) supplies authentication, tenancy, menus, permissions, layout, shared components, and the common Supabase runtime. MDM supplies production foundations, PMIS owns equipment-maintenance tasks, and WMS owns inventory posting.

## Current Capabilities

| Area | Coverage |
| --- | --- |
| Orders and sources | Create/copy/bulk reference, BOM and extension snapshots, details, projects/construction sections, and related-document viewing |
| Planning | Operation tasks, scheduling rules, scheduling and Gantt views, work-center and shift allocations |
| Panel packing | Type/thickness rules, automatic packing, splitting and continuation, validation, publication/repacking, and order-scoped pack identities |
| Printing | Whole-package A4 forms, configurable certificate labels, continuation pages, previews, and unsaved-change protection |
| Execution | Dispatch, personnel/equipment assignments, production/operation reports, allocation, review, details, miscellaneous reports, and piecework |
| Quality and events | Inspections, defect reasons and records, exceptions/andon, molds, and mold details |
| Analytics | Shift, line, and machine achievement and personnel efficiency from tasks, approved reports, and execution events |
| Integration | MDM references, PMIS equipment tasks, and WMS material issue/return and finished receipt |

Machine automation, further shop-floor material integration, and complete cross-system genealogy remain ongoing work. Manual records and existing pages do not imply that automatic machine collection or end-to-end traceability is complete.

## Work Orders, BOMs, and Packing

Order creation snapshots the document type's extension and packing configuration. BOM-linked extension fields derive from the selected root BOM and component types. Copy and bulk-reference flows reload BOM-owned values while retaining compatible non-BOM parameters; ordinary editing does not overwrite explicit manual values.

Release warnings identify missing construction sections and material shortages. A construction section is optional, and shortages do not prevent release; automatic reservation uses available inventory only.

Packing rules can vary by panel type and thickness. Packages always respect region constraints; the optional same-number rule controls whether differing panel numbers may share a package. Server validation covers quantities, stacking, weight, length, rules, and tenant scope.

Pack numbers such as `PK-0001` are unique within an order, rather than globally. Cross-order and WMS references use package IDs. Published plans prevent order/panel/package editing; authorized repacking restores editing while retaining packages.

Printing includes every panel in a selected package. Certificate labels default to 100 × 150 mm, allow custom dimensions, and continue after eight detail rows. Printer paper must match the selected size. Unsaved changes cannot be printed; print-only quality fields do not become inspection results.

The [Chinese README](README.md) retains detailed contracts and historical verification records, including BOM extension, packing identity, and printing. This documentation update does not rerun those checks.

## Execution, Reporting, and WMS

```text
MDM materials / BOMs / calendars / work centers
  → MES order and release
  → scheduling and shop-floor tasks
  → production reports and approval
  → WMS finished receipt and inventory traceability
```

Released orders can create WMS material requests. Issue warehouses must match the order organization, allow picking, and satisfy the configured warehouse type. Approved requests support partial issues. Finished receipts cannot exceed approved completion quantities; WMS owns the stock movement.

Order/task summaries distinguish the full filtered total from current-page status metrics. Loading or failed reads remain unknown rather than showing zero. Exports use the complete filter within the existing limit and retain the work-center/workshop scope selected at export start.

## Local Development

Requirements: Node.js `>= 22.13.0`, pnpm `>= 11.28.2`.

```powershell
pnpm install
pnpm dev
```

Default URL: `http://localhost:3019`. Develop in `modules/art-supabase-mes` or use the pinned platform dependency for a standalone clone. `ART_SUPABASE_PLATFORM_ROOT` can select a local platform checkout. The shared Vite factory merges platform and application environment settings; configure your backend and keep server secrets out of browser variables.

```powershell
pnpm check
pnpm build
pnpm preview
```

`pnpm check` runs boundary/UI audits, types, ESLint, and module unit tests. The build typechecks and writes static output to `docs/`; `VITE_BASE_URL` controls the public base path.

## Collaboration and Security

Push module changes before updating the platform's `modules/art-supabase-mes` gitlink. Reuse platform components, configuration-driven forms, async states, and reference deletion guards. Cross-domain integration uses purpose-specific, minimum-field, tenant-isolated contracts.

Ordinary users remain in their authenticated tenant. Platform-super all/selected-tenant behavior follows the platform contract. Dispatch, reporting, approval, inspection, publication, repacking, completion, and reversal retain separate action permissions and server-state checks. UI visibility never replaces RLS, reference integrity, or business-state validation.

## License

Licensed under [MulanPSL-2.0](LICENSE).
