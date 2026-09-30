import { useSupabase } from '@/hooks'
import { normalizeNullableText } from '@/utils/form/normalize'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { fetchAllRangePages } from '@/utils/supabase/pagination'
import type {
  MesListQuery,
  MesBatchResult,
  MesAutoScheduleResult,
  MesGanttCalendarDay,
  MesMaterialCategory,
  MesMaterialOption,
  MesMaterialOptionQuery,
  MesOperationTask,
  MesOperationTaskAllocationInput,
  MesOperationTaskAllocationResult,
  MesOperationTaskShiftPlanInput,
  MesOperationTaskShiftPlanResult,
  MesOperationTaskScheduleInput,
  MesProductionDepartment,
  MesProductionScope,
  MesProductionScopeCenter,
  MesReferenceOption,
  MesSnapshotReference,
  MesReferences,
  MesSchedulingRule,
  MesSchedulingRuleInput,
  MesSchedulingContext,
  MesWorkOrder,
  MesWorkOrderBomSnapshot,
  MesWorkOrderRouteSnapshot,
  MesWorkOrderSnapshotReferences,
  MesWorkOrderInput
} from './manufacturing.types'

export * from './manufacturing.types'

const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: true,
  errorMessage: '制造执行数据加载失败，请稍后重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  requireAffected: true,
  showMessage: true,
  message: '保存成功',
  errorMessage: '保存失败，请检查必填项、业务状态和当前权限'
}

export async function fetchWorkOrders(params: MesListQuery, options?: { signal?: AbortSignal }) {
  let query = supabase
    .from('mes_work_order')
    .select(
      '*,details:mes_work_order_detail(id,area,number,length_mm,pieces,packed_pieces,linear_meters,width_mm,area_sqm,area_overridden,remark,sort_order)',
      { count: 'exact' }
    )
    .order('update_time', { ascending: false })
    .range((params.current - 1) * params.size, params.current * params.size - 1)
  if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
  if (params.recordId) query = query.eq('id', params.recordId)
  const statuses = (Array.isArray(params.status) ? params.status : [params.status]).filter(
    (status): status is string => Boolean(status)
  )
  const includesDeleted = statuses.includes('__deleted')
  const allowedStatuses = new Set([
    'CRTD',
    'ABNORMAL',
    'REL',
    'PCNF',
    'CNF',
    'PDLV',
    'DLV',
    'TECO',
    'CLSD'
  ])
  const activeStatuses = statuses.filter((status) => allowedStatuses.has(status))
  if (includesDeleted && activeStatuses.length) {
    query = query.or(
      `deleted_at.not.is.null,and(deleted_at.is.null,order_status.in.(${activeStatuses.join(',')}))`
    )
  } else if (includesDeleted) {
    query = query.not('deleted_at', 'is', null)
  } else {
    if (!params.includeDeleted) query = query.is('deleted_at', null)
    if (activeStatuses.length) query = query.in('order_status', activeStatuses)
  }
  if (params.plannedDates?.[0]) query = query.gte('planned_end_date', params.plannedDates[0])
  if (params.plannedDates?.[1]) query = query.lte('planned_end_date', params.plannedDates[1])
  if (params.keyword?.trim()) {
    query = query.or(
      buildOrIlikeFilter(
        ['work_order_no', 'material_code_snapshot', 'material_name_snapshot', 'sales_order_no'],
        params.keyword.trim()
      )
    )
  }
  const { data, total } = await responseHandle<MesWorkOrder[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    readOptions
  )
  const rows = data ?? []
  const detailsByTenant = await Promise.all(
    [...new Set(rows.map((row) => row.tenantId))].map(async (tenantId) => ({
      tenantId,
      details: await fetchMesMaterialDetails(tenantId, [
        ...new Set(rows.filter((row) => row.tenantId === tenantId).map((row) => row.materialId))
      ])
    }))
  )
  const materialDetails = new Map(
    detailsByTenant.map(({ tenantId, details }) => [tenantId, details])
  )
  return {
    data: rows.map((row) => ({
      ...row,
      materialDescription:
        materialDetails.get(row.tenantId)?.get(row.materialId)?.description?.trim() ||
        row.materialNameSnapshot,
      details: [...(row.details ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    })),
    total: total ?? 0
  }
}

export async function saveWorkOrder(input: MesWorkOrderInput, id?: string) {
  const { details = [], ...header } = input
  const { extensionValues, ...standardHeader } = header
  const { data } = await responseHandle<string>(
    () =>
      supabase.rpc('mes_save_work_order_with_details', {
        p_id: id || null,
        p_header: {
          ...keysToSnakeDeep(standardHeader),
          extension_values: extensionValues ?? {}
        },
        p_details: keysToSnakeDeep(details)
      }),
    { ...writeOptions, requireAffected: false }
  )
  return data ?? ''
}

export async function importWorkOrders(rows: MesWorkOrderInput[]) {
  await responseHandle(
    () =>
      supabase
        .from('mes_work_order')
        .insert(keysToSnakeDeep(rows), { count: 'exact' })
        .select('id'),
    { ...writeOptions, message: `已导入 ${rows.length} 条工单` }
  )
}

export async function transitionWorkOrder(id: string, action: string) {
  const { data } = await responseHandle<{ status?: string; message?: string }>(
    () => supabase.rpc('mes_transition_work_order', { p_id: id, p_action: action }),
    { ...writeOptions, requireAffected: false, message: '工单状态已更新' }
  )
  return data
}

export interface MesWorkOrderReleaseWarning {
  id: string
  workOrderNo: string
  warnings: string[]
}

export async function fetchWorkOrderReleaseWarnings(
  ids: string[]
): Promise<MesWorkOrderReleaseWarning[]> {
  const warnings: MesWorkOrderReleaseWarning[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data } = await responseHandle<MesWorkOrderReleaseWarning[]>(
      () =>
        supabase.rpc('mes_work_order_release_warnings', { p_ids: ids.slice(offset, offset + 100) }),
      {
        ...readOptions,
        errorMessage: '下达前检查失败，请刷新工单后重试'
      }
    )
    warnings.push(...(data ?? []))
  }
  return warnings
}

export async function reloadWorkOrderSnapshot(id: string) {
  const { data } = await responseHandle<{
    id: string
    bomCount: number
    routeStepCount: number
  }>(() => supabase.rpc('mes_reload_work_order_snapshot', { p_id: id }), {
    ...writeOptions,
    requireAffected: false,
    message: '已重读最新 BOM 与工艺路线'
  })
  return data
}

export async function saveWorkOrderSnapshot(
  id: string,
  mode: 'bom' | 'route',
  snapshot: MesWorkOrderBomSnapshot[] | MesWorkOrderRouteSnapshot
) {
  const { data } = await responseHandle<MesWorkOrder>(
    () =>
      supabase.rpc('mes_save_work_order_snapshot', {
        p_id: id,
        p_mode: mode,
        p_snapshot: keysToSnakeDeep(snapshot)
      }),
    { ...writeOptions, requireAffected: false, message: '工单生产资料已更新' }
  )
  return data ?? undefined
}

export async function recordWorkOrderProgress(id: string, quantity: number) {
  const { data } = await responseHandle<MesWorkOrder>(
    () =>
      supabase.rpc('mes_record_work_order_progress', {
        p_id: id,
        p_action: 'report',
        p_quantity: quantity
      }),
    {
      ...writeOptions,
      requireAffected: false,
      message: '报工成功'
    }
  )
  return data ?? undefined
}

export async function markWorkOrderAbnormal(id: string, reason: string) {
  const { data } = await responseHandle<{ status: string; message: string }>(
    () => supabase.rpc('mes_mark_work_order_abnormal', { p_id: id, p_reason: reason }),
    { ...writeOptions, requireAffected: false, message: '工单已标记异常' }
  )
  return data
}

export async function fetchWorkOrderSnapshotReferences(
  tenantId: string
): Promise<MesWorkOrderSnapshotReferences> {
  const [materials, units, warehouses, departments, workCenters] = await Promise.all([
    fetchAllRangePages<{ id: string; materialCode: string; materialName: string }>(({ from, to }) =>
      responseHandle(
        () =>
          supabase
            .from('mdm_material')
            .select('id,material_code,material_name')
            .eq('tenant_id', tenantId)
            .order('material_code')
            .range(from, to),
        readOptions
      )
    ),
    fetchAllRangePages<{ id: string; unitCode: string; unitName: string }>(({ from, to }) =>
      responseHandle(
        () =>
          supabase
            .from('mdm_unit_of_measure')
            .select('id,unit_code,unit_name')
            .eq('tenant_id', tenantId)
            .order('unit_code')
            .range(from, to),
        readOptions
      )
    ),
    fetchAllRangePages<{ id: string; warehouseCode: string; warehouseName: string }>(
      ({ from, to }) =>
        responseHandle(
          () =>
            supabase
              .from('mdm_warehouse')
              .select('id,warehouse_code,warehouse_name')
              .eq('tenant_id', tenantId)
              .order('warehouse_code')
              .range(from, to),
          readOptions
        )
    ),
    fetchAllRangePages<{ id: string; code: string; name: string }>(({ from, to }) =>
      responseHandle(
        () =>
          supabase
            .from('mdm_production_department')
            .select('id,code,name')
            .eq('tenant_id', tenantId)
            .order('code')
            .range(from, to),
        readOptions
      )
    ),
    fetchAllRangePages<{ id: string; code: string; name: string }>(({ from, to }) =>
      responseHandle(
        () =>
          supabase
            .from('mdm_work_center')
            .select('id,code,name')
            .eq('tenant_id', tenantId)
            .order('code')
            .range(from, to),
        readOptions
      )
    )
  ])
  return {
    componentTypes: [],
    materials: (materials.data ?? []).map((item) => ({
      id: item.id,
      code: item.materialCode,
      name: item.materialName
    })),
    units: (units.data ?? []).map((item) => ({
      id: item.id,
      code: item.unitCode,
      name: item.unitName
    })),
    warehouses: (warehouses.data ?? []).map((item) => ({
      id: item.id,
      code: item.warehouseCode,
      name: item.warehouseName
    })),
    departments: departments.data ?? [],
    workCenters: workCenters.data ?? []
  }
}

export async function fetchWorkOrderComponentTypes(
  tenantId: string
): Promise<MesSnapshotReference[]> {
  const { data } = await fetchAllRangePages<{
    id: string
    componentTypeCode: string
    componentTypeName: string
    enabled: boolean
  }>(({ from, to }) =>
    responseHandle(
      () =>
        supabase
          .from('mdm_component_type')
          .select('id,component_type_code,component_type_name,enabled')
          .eq('tenant_id', tenantId)
          .order('sort_order')
          .range(from, to),
      readOptions
    )
  )
  return (data ?? []).map((item) => ({
    id: item.id,
    code: item.componentTypeCode,
    name: item.componentTypeName,
    disabled: !item.enabled
  }))
}

export async function batchTransitionWorkOrders(ids: string[], action: string) {
  const { data } = await responseHandle<MesBatchResult>(
    () => supabase.rpc('mes_batch_transition_work_orders', { p_ids: ids, p_action: action }),
    {
      ...writeOptions,
      requireAffected: false,
      showMessage: false,
      message: ''
    }
  )
  return data ?? { successIds: [], failures: [] }
}

export async function copyWorkOrders(ids: string[]) {
  const { data } = await responseHandle<MesBatchResult>(
    () => supabase.rpc('mes_copy_work_orders', { p_ids: ids }),
    {
      ...writeOptions,
      requireAffected: false,
      showMessage: false,
      message: ''
    }
  )
  return data ?? { successIds: [], failures: [] }
}

export async function updateWorkOrderDueDates(ids: string[], plannedEndDate: string) {
  const { data } = await responseHandle<MesBatchResult>(
    () =>
      supabase.rpc('mes_batch_update_due_date', {
        p_ids: ids,
        p_planned_end_date: plannedEndDate
      }),
    {
      ...writeOptions,
      requireAffected: false,
      showMessage: false,
      message: ''
    }
  )
  return data ?? { successIds: [], failures: [] }
}

export async function annotateWorkOrder(
  id: string,
  urgency: MesWorkOrder['urgency'],
  specialRequirement: string | null
) {
  const { data } = await responseHandle<{
    id: string
    urgency: MesWorkOrder['urgency']
    specialRequirement: string | null
  }>(
    () =>
      supabase.rpc('mes_annotate_work_order', {
        p_id: id,
        p_urgency: urgency,
        p_special_requirement: specialRequirement
      }),
    { ...writeOptions, requireAffected: false, message: '工单批注已更新' }
  )
  return data
}

export async function fetchOperationTasks(
  params: MesListQuery,
  options?: { signal?: AbortSignal }
) {
  let query = supabase
    .from('mes_operation_task')
    .select(
      '*,workOrder:mes_work_order!mes_operation_task_order_fk!inner(work_order_no,work_order_type_name_snapshot,project_name_snapshot,construction_no,planner_name_snapshot,dispatcher_name_snapshot,material_code_snapshot,material_name_snapshot,specification_snapshot,unit_snapshot,planned_start_date,planned_end_date,urgency,source,remark,special_requirement,tracking_no,follow_no,sales_order_no,customer_code,route_snapshot),department:mdm_production_department!mes_operation_task_department_fk(code,name),workCenter:mdm_work_center!mes_operation_task_center_fk(code,name),allocations:mes_operation_task_allocation(id,task_id,work_center_id,shift_schedule_id,shift_index,shift_name_snapshot,quantity,planned_start_date,planned_end_date,status)',
      { count: 'exact' }
    )
    .range((params.current - 1) * params.size, params.current * params.size - 1)
  if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
  if (!params.includeDeleted) query = query.is('deleted_at', null)
  const schedulingStatuses = (
    Array.isArray(params.schedulingStatus) ? params.schedulingStatus : [params.schedulingStatus]
  ).filter((status): status is string => Boolean(status))
  const operationStatuses = (
    Array.isArray(params.operationStatus) ? params.operationStatus : [params.operationStatus]
  ).filter((status): status is string => Boolean(status))
  if (schedulingStatuses.length) query = query.in('scheduling_status', schedulingStatuses)
  if (operationStatuses.length) query = query.in('operation_status', operationStatuses)
  if (params.workCenterId) query = query.eq('work_center_id', params.workCenterId)
  else if (params.departmentIds?.length) query = query.in('department_id', params.departmentIds)
  if (params.plannedDates?.[0]) query = query.gte('planned_end_date', params.plannedDates[0])
  if (params.plannedDates?.[1]) query = query.lte('planned_start_date', params.plannedDates[1])
  if (params.workOrderStartDates?.[0]) {
    query = query.gte('workOrder.planned_start_date', params.workOrderStartDates[0])
  }
  if (params.workOrderStartDates?.[1]) {
    query = query.lte('workOrder.planned_start_date', params.workOrderStartDates[1])
  }
  if (params.keyword?.trim()) {
    query = query.or(
      buildOrIlikeFilter(
        ['task_no', 'operation_code', 'operation_name', 'process_content', 'barcode_value'],
        params.keyword.trim()
      )
    )
  }
  const sortColumnMap = {
    sequenceNo: 'sequence_no',
    operationCode: 'operation_code',
    workOrderNo: 'workOrder(work_order_no)',
    taskNo: 'task_no'
  } as const
  const sortColumn = params.sortBy ? sortColumnMap[params.sortBy] : undefined
  query = sortColumn
    ? query.order(sortColumn, { ascending: params.sortOrder !== 'descending' })
    : query.order('update_time', { ascending: false })
  const { data, total } = await responseHandle<MesOperationTask[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    readOptions
  )
  return { data: data ?? [], total: total ?? 0 }
}

export async function scheduleOperationTask(input: MesOperationTaskScheduleInput) {
  const { data } = await responseHandle<{
    id: string
    status: string
    workCenterId: string
    plannedStartDate: string
    plannedEndDate: string
  }>(
    () =>
      supabase.rpc('mes_schedule_operation_task', {
        p_id: input.id,
        p_work_center_id: input.workCenterId,
        p_planned_start_date: input.plannedStartDate,
        p_planned_end_date: input.plannedEndDate
      }),
    { ...writeOptions, requireAffected: false, message: '排程已更新' }
  )
  return data
}

export async function confirmOperationTaskSchedule(
  input: MesOperationTaskScheduleInput & { quantity: number; shiftScheduleId?: string | null },
  options?: { showMessage?: boolean }
) {
  const { data } = await responseHandle<MesOperationTaskAllocationResult>(
    () =>
      supabase.rpc('mes_confirm_operation_task_schedule', {
        p_id: input.id,
        p_work_center_id: input.workCenterId,
        p_quantity: input.quantity,
        p_planned_start_date: input.plannedStartDate,
        p_planned_end_date: input.plannedEndDate,
        p_shift_schedule_id: input.shiftScheduleId || null
      }),
    {
      ...writeOptions,
      requireAffected: false,
      showMessage: options?.showMessage ?? true,
      message: '排产已确认'
    }
  )
  return data
}

export async function allocateOperationTask(input: {
  id: string
  allocations: MesOperationTaskAllocationInput[]
  plannedStartDate: string
  plannedEndDate: string
  shiftScheduleId?: string | null
}) {
  const { data } = await responseHandle<MesOperationTaskAllocationResult>(
    () =>
      supabase.rpc('mes_allocate_operation_task', {
        p_id: input.id,
        p_allocations: input.allocations,
        p_planned_start_date: input.plannedStartDate,
        p_planned_end_date: input.plannedEndDate,
        p_shift_schedule_id: input.shiftScheduleId || null
      }),
    { ...writeOptions, requireAffected: false, message: '多工作中心排产已保存' }
  )
  return data
}

export async function fetchSchedulingContext(): Promise<MesSchedulingContext> {
  const { data } = await responseHandle<MesSchedulingContext>(
    () => supabase.rpc('mes_scheduling_context'),
    readOptions
  )
  return data ?? { shifts: [] }
}

export async function fetchGanttCalendar(
  startDate: string,
  endDate: string
): Promise<MesGanttCalendarDay[]> {
  const { data } = await responseHandle<MesGanttCalendarDay[]>(
    () =>
      supabase.rpc('mes_gantt_calendar_v2', {
        p_start_date: startDate,
        p_end_date: endDate
      }),
    readOptions
  )
  return data ?? []
}

export async function replaceOperationTaskShiftPlan(
  input: MesOperationTaskShiftPlanInput
): Promise<MesOperationTaskShiftPlanResult> {
  const { data } = await responseHandle<MesOperationTaskShiftPlanResult>(
    () =>
      supabase.rpc('mes_replace_operation_task_shift_plan_v2', {
        p_id: input.id,
        p_work_center_id: input.workCenterId,
        p_expected_version: input.expectedVersion,
        p_keep_assignment: input.keepAssignment,
        p_items: input.items
      }),
    { ...writeOptions, requireAffected: false, message: '班次排产已更新' }
  )
  if (!data) throw new Error('班次排产未返回结果')
  return data
}

export function subscribeMesSchedulingChanges(
  tenantId: string | null | undefined,
  onChange: () => void
): () => void {
  const channel = supabase.channel(`mes-scheduling-${tenantId || 'all'}-${crypto.randomUUID()}`)
  const tables = ['mes_operation_task', 'mes_operation_task_allocation', 'mes_work_order'] as const
  tables.forEach((table) => {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {})
      },
      onChange
    )
  })
  channel.subscribe()
  return () => void supabase.removeChannel(channel)
}

export async function fetchSchedulingRules(tenantId?: string | null) {
  let query = supabase
    .from('mes_scheduling_rule')
    .select('*')
    .order('is_default', { ascending: false })
    .order('update_time', { ascending: false })
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data } = await responseHandle<MesSchedulingRule[]>(() => query, readOptions)
  return data ?? []
}

export async function saveSchedulingRule(input: MesSchedulingRuleInput, id?: string) {
  const payload = keysToSnakeDeep(input)
  await responseHandle(
    () => supabase.rpc('mes_save_scheduling_rule', { p_id: id || null, p_payload: payload }),
    {
      ...writeOptions,
      requireAffected: false,
      message: id ? '排产规则已更新' : '排产规则已创建'
    }
  )
}

export async function setOperationTaskScheduleLock(id: string, locked: boolean) {
  await responseHandle(
    () => supabase.rpc('mes_set_operation_task_schedule_lock', { p_id: id, p_locked: locked }),
    {
      ...writeOptions,
      requireAffected: false,
      message: locked ? '工序排产已锁定' : '工序排产已解锁'
    }
  )
}

export async function deleteSchedulingRule(id: string) {
  await responseHandle(
    () => supabase.from('mes_scheduling_rule').delete().eq('id', id).select('id'),
    { ...writeOptions, message: '排产规则已删除' }
  )
}

export async function autoScheduleWorkOrder(workOrderId: string, ruleId: string, apply: boolean) {
  const { data } = await responseHandle<MesAutoScheduleResult>(
    () =>
      supabase.rpc('mes_auto_schedule_work_order', {
        p_work_order_id: workOrderId,
        p_rule_id: ruleId,
        p_apply: apply
      }),
    {
      ...writeOptions,
      requireAffected: false,
      showMessage: apply,
      message: apply ? '自动排产已应用' : ''
    }
  )
  if (!data) throw new Error('自动排产未返回结果')
  return data
}

export async function transitionOperationTask(id: string, action: string, workCenterId?: string) {
  return responseHandle(
    () =>
      supabase.rpc('mes_transition_operation_task', {
        p_id: id,
        p_action: action,
        p_work_center_id: workCenterId || null
      }),
    { ...writeOptions, requireAffected: false, message: '工序任务状态已更新' }
  )
}

export async function batchTransitionOperationTasks(ids: string[], action: 'close' | 'delete') {
  const { data } = await responseHandle<MesBatchResult>(
    () => supabase.rpc('mes_batch_transition_operation_tasks', { p_ids: ids, p_action: action }),
    { ...writeOptions, requireAffected: false, showMessage: false, message: '' }
  )
  return data ?? { successIds: [], failures: [] }
}

export async function annotateOperationTask(
  id: string,
  urgency: MesWorkOrder['urgency'],
  annotation: string | null
) {
  return responseHandle(
    () =>
      supabase.rpc('mes_annotate_operation_task', {
        p_id: id,
        p_urgency: urgency,
        p_annotation: annotation
      }),
    { ...writeOptions, requireAffected: false, message: '工序批注已更新' }
  )
}

export async function updateOperationTaskDueDates(
  ids: string[],
  requiredCompletionDate: string
): Promise<MesBatchResult> {
  const { data } = await responseHandle<MesBatchResult>(
    () =>
      supabase.rpc('mes_batch_update_operation_task_due_date', {
        p_ids: ids,
        p_required_completion_date: requiredCompletionDate
      }),
    { ...writeOptions, requireAffected: false, showMessage: false, message: '' }
  )
  return data ?? { successIds: [], failures: [] }
}

export async function fetchOperationTaskScope(
  tenantId?: string | null
): Promise<MesProductionScope> {
  const [departmentResult, centerResult] = await Promise.all([
    fetchAllRangePages<MesProductionDepartment>(({ from, to }) => {
      let query = supabase
        .from('mdm_production_department')
        .select('id,tenant_id,parent_id,name,code,enabled,sort')
        .order('sort')
        .order('code')
      if (tenantId) query = query.eq('tenant_id', tenantId)
      return responseHandle<MesProductionDepartment[]>(() => query.range(from, to), readOptions)
    }),
    fetchAllRangePages<MesProductionScopeCenter>(({ from, to }) => {
      let query = supabase
        .from('mdm_work_center')
        .select(
          'id,tenant_id,department_id,code,name,sort,headcount,daily_capacity_minutes,efficiency_percent,utilization_percent,parallel_capacity'
        )
        .order('sort')
        .order('code')
      if (tenantId) query = query.eq('tenant_id', tenantId)
      return responseHandle<MesProductionScopeCenter[]>(() => query.range(from, to), readOptions)
    })
  ])
  return {
    departments: departmentResult.data ?? [],
    workCenters: centerResult.data ?? []
  }
}

export async function fetchMesReferences(tenantId?: string): Promise<MesReferences> {
  let customerQuery = supabase
    .from('mdm_customer')
    .select('id,code:customer_code,name:customer_name')
    .eq('enabled', true)
    .order('customer_name')
  if (tenantId) customerQuery = customerQuery.eq('tenant_id', tenantId)

  const [referenceResult, customerResult] = await Promise.all([
    responseHandle<Omit<MesReferences, 'customers'>>(
      () => supabase.rpc('mes_work_order_references', { p_tenant_id: tenantId || null }),
      { ...readOptions, showErrorMessage: false }
    ),
    responseHandle<MesReferenceOption[]>(() => customerQuery, {
      ...readOptions,
      showErrorMessage: false
    })
  ])
  return {
    materials: referenceResult.data?.materials ?? [],
    customers: customerResult.data ?? [],
    projects: referenceResult.data?.projects ?? [],
    documentTypes: referenceResult.data?.documentTypes ?? [],
    employees: referenceResult.data?.employees ?? [],
    workCenters: referenceResult.data?.workCenters ?? []
  }
}

export interface MesBomComponentOption {
  id: string
  componentTypeId: string | null
  sequenceNo: number
  component: { id: string; materialCode: string; materialName: string } | null
}

export async function fetchMesBomComponentOptions(
  tenantId: string,
  materialId: string,
  asOfDate?: string
) {
  let query = supabase
    .from('mdm_bom')
    .select(
      'items:mdm_bom_item(id,component_type_id,sequence_no,component:mdm_material!mdm_bom_item_material_fkey(id,material_code,material_name))'
    )
    .eq('tenant_id', tenantId)
    .eq('material_id', materialId)
    .in('status', ['effective', 'review', 'changing', 'design'])
    .or('project_id.is.null,status.eq.effective')
    .order('update_time', { ascending: false })
    .limit(1)
  if (asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    query = query
      .or(`effective_from.is.null,effective_from.lte.${asOfDate}`)
      .or(`effective_to.is.null,effective_to.gte.${asOfDate}`)
  }
  const { data } = await responseHandle<Array<{ items: MesBomComponentOption[] }>>(() => query, {
    ...readOptions,
    showErrorMessage: false
  })
  return [...(data?.[0]?.items ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo)
}

export async function fetchMesConfirmedProjectBom(tenantId: string, projectId: string) {
  const { data } = await responseHandle<
    Array<{
      id: string
      materialId: string
      material: { materialCode: string } | null
    }>
  >(
    () =>
      supabase
        .from('mdm_bom')
        .select('id,material_id,material:mdm_material!mdm_bom_material_fkey(material_code)')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('status', 'effective')
        .order('update_time', { ascending: false })
        .limit(1),
    { ...readOptions, showErrorMessage: false }
  )
  return data?.[0] ?? null
}

export async function fetchMesProjectSections(tenantId: string, projectId: string) {
  const { data } = await responseHandle<
    Array<{ constructionNo: string; sectionName: string; status: 'active' | 'closed' }>
  >(
    () =>
      supabase
        .from('mdm_project_construction')
        .select('construction_no,section_name,status')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .order('construction_no'),
    { ...readOptions, showErrorMessage: false }
  )
  return data ?? []
}

export async function fetchMesMaterialOptions(
  params: MesMaterialOptionQuery
): Promise<{ data: MesMaterialOption[]; total: number }> {
  const { data } = await responseHandle<{ data?: MesMaterialOption[]; total?: number }>(
    () =>
      supabase.rpc('mes_work_order_material_options', {
        p_tenant_id: params.tenantId,
        p_keyword: normalizeNullableText(params.keyword),
        p_category_id: normalizeNullableText(params.categoryId),
        p_page: params.current,
        p_page_size: params.size
      }),
    { ...readOptions, showErrorMessage: false }
  )
  const options = data?.data ?? []
  const details = await fetchMesMaterialDetails(
    params.tenantId,
    options.map((item) => item.id)
  )
  return {
    data: options.map((item) => ({ ...item, ...details.get(item.id) })),
    total: data?.total ?? 0
  }
}

interface MesMaterialDetails {
  description: string | null
  widthMm: number | null
  thicknessMm: number | null
}

async function fetchMesMaterialDetails(tenantId: string, ids: string[]) {
  const details = new Map<string, MesMaterialDetails>()
  if (!ids.length) return details
  const { data } = await responseHandle<
    Array<{
      id: string
      description: string | null
      width: number | null
      thickness: number | null
      attributeGroupId: string | null
      attributeValues: Record<string, string | number | null> | null
    }>
  >(
    () =>
      supabase
        .from('mdm_material')
        .select('id,description,width,thickness,attribute_group_id,attribute_values')
        .eq('tenant_id', tenantId)
        .in('id', ids),
    readOptions
  )
  const groupIds = [...new Set((data ?? []).map((item) => item.attributeGroupId).filter(Boolean))]
  const { data: attributes } = groupIds.length
    ? await responseHandle<Array<{ groupId: string; attributeKey: string; attributeName: string }>>(
        () =>
          supabase
            .from('mdm_material_attribute')
            .select('group_id,attribute_key,attribute_name')
            .eq('tenant_id', tenantId)
            .in('group_id', groupIds)
            .in('attribute_name', ['宽度', '厚度']),
        readOptions
      )
    : { data: [] }
  const dimensionKeys = new Map<string, { width?: string; thickness?: string }>()
  for (const attribute of attributes ?? []) {
    const keys = dimensionKeys.get(attribute.groupId) ?? {}
    if (attribute.attributeName === '宽度') keys.width = attribute.attributeKey
    if (attribute.attributeName === '厚度') keys.thickness = attribute.attributeKey
    dimensionKeys.set(attribute.groupId, keys)
  }
  const dimension = (value: string | number | null | undefined, fallback: number | null) => {
    if (value == null || value === '') return fallback == null ? null : Number(fallback)
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback == null ? null : Number(fallback)
  }
  for (const item of data ?? []) {
    const keys = item.attributeGroupId ? dimensionKeys.get(item.attributeGroupId) : undefined
    details.set(item.id, {
      description: item.description,
      widthMm: dimension(keys?.width ? item.attributeValues?.[keys.width] : null, item.width),
      thicknessMm: dimension(
        keys?.thickness ? item.attributeValues?.[keys.thickness] : null,
        item.thickness
      )
    })
  }
  return details
}

export async function fetchMesMaterialDetailsById(
  tenantId: string,
  materialId: string
): Promise<MesMaterialDetails | undefined> {
  return (await fetchMesMaterialDetails(tenantId, [materialId])).get(materialId)
}

export async function fetchMesMaterialCategories(tenantId: string): Promise<MesMaterialCategory[]> {
  const { data } = await responseHandle<MesMaterialCategory[]>(
    () =>
      supabase
        .from('mdm_material_category')
        .select('id,tenant_id,parent_id,category_code,category_name,sort')
        .eq('tenant_id', tenantId)
        .eq('status', 'enabled')
        .order('sort')
        .order('category_name'),
    readOptions
  )
  return data ?? []
}
