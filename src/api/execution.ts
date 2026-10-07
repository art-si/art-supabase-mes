import { useSupabase } from '@/hooks'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { buildSupabasePageRange, fetchAllRangePages } from '@/utils/supabase/pagination'
import type { ApiRequestOptions } from '@/types/api/request'
import { uniq } from 'lodash-es'
import type {
  MesDefectReason,
  MesExecutionAttendance,
  MesExecutionEvent,
  MesExecutionEventInput,
  MesExecutionEventKind,
  MesExecutionEsopDocument,
  MesExecutionListQuery,
  MesExecutionPerson,
  MesExecutionTask,
  MesExecutionCalendarShift,
  MesProductionReport,
  MesReportInput
} from './execution.types'

export * from './execution.types'

const { supabase, responseHandle } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: '生产执行数据加载失败，请稍后重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  requireAffected: false,
  showMessage: true,
  message: '操作已完成',
  errorMessage: '操作失败，请检查业务状态和当前权限'
}

const taskSelect =
  'id,tenant_id,task_no,work_order_id,route_step_snapshot_id,sequence_no,sequence_type,operation_code,operation_name,process_content,planned_quantity,completed_quantity,reported_good_quantity,reported_bad_quantity,required_start_date,required_completion_date,department_id,work_center_id,equipment_id,equipment_locked,equipment_code_snapshot,equipment_name_snapshot,operation_status,scheduling_status,started_at,workOrder:mes_work_order!mes_operation_task_order_fk(work_order_no,work_order_type_name_snapshot,project_name_snapshot,material_code_snapshot,material_name_snapshot,specification_snapshot,drawing_no_snapshot,order_quantity,unit_snapshot,order_status,planned_end_date,route_snapshot,bom_snapshot),department:mdm_production_department!mes_operation_task_department_fk(code,name),workCenter:mdm_work_center!mes_operation_task_center_fk(code,name,department_id),allocations:mes_operation_task_allocation(id,work_center_id,shift_name_snapshot,quantity,planned_start_date,planned_end_date,status)'

export async function fetchExecutionCalendarShifts(
  tenantId: string,
  departmentId: string,
  workDate: string
): Promise<MesExecutionCalendarShift[]> {
  const { data } = await responseHandle<Array<{ pattern: { shifts: unknown } | null }>>(
    () =>
      supabase
        .from('mdm_production_calendar')
        .select(
          'pattern:mdm_production_shift_pattern!mdm_production_calendar_tenant_id_department_id_pattern_id_fkey(shifts)'
        )
        .eq('tenant_id', tenantId)
        .eq('department_id', departmentId)
        .eq('work_date', workDate)
        .limit(1),
    readOptions
  )
  const raw = data?.[0]?.pattern?.shifts
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is MesExecutionCalendarShift =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.name === 'string' &&
      item.name.trim().length > 0 &&
      typeof item.startTime === 'string' &&
      typeof item.endTime === 'string'
  )
}

export async function fetchExecutionTasks(query: MesExecutionListQuery) {
  const pageRange = buildSupabasePageRange(query)
  const keyword = query.keyword?.trim()
  const keywordFilter = keyword
    ? `${buildOrIlikeFilter(['task_no', 'operation_code', 'operation_name'], keyword)},orderSearch.not.is.null`
    : ''
  let statusFilter = ''
  const select = query.shiftName
    ? `${taskSelect},shiftFilter:mes_operation_task_allocation()`
    : taskSelect
  let request = supabase
    .from('mes_operation_task')
    .select(
      keyword ? `${select},orderSearch:mes_work_order!mes_operation_task_order_fk()` : select,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .in('scheduling_status', ['scheduled', 'no_schedule'])
    .order('required_completion_date', { ascending: true, nullsFirst: false })
    .order('id')
    .range(pageRange.from, pageRange.to)
  if (query.tenantId) request = request.eq('tenant_id', query.tenantId)
  if (query.workCenterId) request = request.eq('work_center_id', query.workCenterId)
  else if (query.departmentIds?.length) request = request.in('department_id', query.departmentIds)
  if (query.shiftName) {
    request = request
      .eq('shiftFilter.shift_name_snapshot', query.shiftName)
      .not('shiftFilter', 'is', null)
    if (query.tenantId) request = request.eq('shiftFilter.tenant_id', query.tenantId)
  }
  if (keyword) {
    request = request
      .is('orderSearch.deleted_at', null)
      .or(
        buildOrIlikeFilter(
          [
            'work_order_no',
            'material_code_snapshot',
            'material_name_snapshot',
            'project_name_snapshot',
            'specification_snapshot'
          ],
          keyword
        ),
        { referencedTable: 'orderSearch' }
      )
      .or(
        `${buildOrIlikeFilter(['task_no', 'operation_code', 'operation_name'], keyword)},orderSearch.not.is.null`
      )
    if (query.tenantId) request = request.eq('orderSearch.tenant_id', query.tenantId)
  }
  if (query.statuses?.length) {
    const statuses = new Set(query.statuses)
    if (statuses.has('unfinished')) {
      statuses.add('unreported')
      statuses.add('partial')
    }
    if (statuses.has('finished')) statuses.add('reported')
    const unreported = statuses.has('unreported')
    const partial = statuses.has('partial')
    const reported = statuses.has('reported')
    if (unreported && partial && !reported)
      request = request.not('operation_status', 'in', '(completed,closed)')
    else if (unreported && !partial && !reported)
      request = request
        .not('operation_status', 'in', '(completed,closed)')
        .eq('completed_quantity', 0)
    else if (!unreported && partial && !reported)
      request = request
        .not('operation_status', 'in', '(completed,closed)')
        .gt('completed_quantity', 0)
    else if (!unreported && !partial && reported)
      request = request.in('operation_status', ['completed', 'closed'])
    else if (unreported && !partial && reported)
      statusFilter = 'completed_quantity.eq.0,operation_status.in.(completed,closed)'
    else if (!unreported && partial && reported) request = request.gt('completed_quantity', 0)
  }
  if (statusFilter)
    request = request.or(
      keywordFilter ? `and(or(${keywordFilter}),or(${statusFilter}))` : statusFilter
    )
  if (query.dateRange?.[0]) request = request.gte('required_completion_date', query.dateRange[0])
  if (query.dateRange?.[1]) request = request.lte('required_completion_date', query.dateRange[1])
  const { data, total } = await responseHandle<MesExecutionTask[]>(() => request, readOptions)
  return { data: data ?? [], total: total ?? 0 }
}

export async function fetchExecutionShiftNames(tenantId?: string | null) {
  const { data, error } = await fetchAllRangePages<{ shiftNameSnapshot: string }>(
    async ({ from, to }) => {
      let request = supabase
        .from('mes_operation_task_allocation')
        .select('shift_name_snapshot')
        .not('shift_name_snapshot', 'is', null)
        .order('id')
        .range(from, to)
      if (tenantId) request = request.eq('tenant_id', tenantId)
      return await responseHandle<Array<{ shiftNameSnapshot: string }>>(() => request, readOptions)
    }
  )
  if (error) throw error
  return uniq((data ?? []).map((item) => item.shiftNameSnapshot).filter(Boolean))
}

export async function fetchProductionReportShiftNames(
  tenantId?: string | null,
  dateRange?: [string, string] | null
) {
  const { data, error } = await fetchAllRangePages<{ shiftName: string }>(async ({ from, to }) => {
    let request = supabase
      .from('mes_production_report')
      .select('shift_name')
      .neq('shift_name', '')
      .order('reported_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
    if (tenantId) request = request.eq('tenant_id', tenantId)
    if (dateRange?.[0]) request = request.gte('reported_at', `${dateRange[0]}T00:00:00+08:00`)
    if (dateRange?.[1]) request = request.lte('reported_at', `${dateRange[1]}T23:59:59+08:00`)
    return await responseHandle<Array<{ shiftName: string }>>(() => request, readOptions)
  })
  if (error) throw error
  return uniq((data ?? []).map((row) => row.shiftName).filter(Boolean))
}

export interface MesWorkCenterEquipmentOption {
  id: string
  equipmentCode: string
  equipmentName: string
}

export async function fetchExecutionWorkCenterEquipment(
  workCenterId: string,
  tenantId?: string | null
) {
  const { data } = await responseHandle<MesWorkCenterEquipmentOption[]>(
    () =>
      supabase.rpc('mes_list_work_center_equipment', {
        p_work_center_id: workCenterId,
        p_tenant_id: tenantId || null
      }),
    readOptions
  )
  return data ?? []
}

export async function fetchExecutionPeople(
  tenantId?: string | null
): Promise<MesExecutionPerson[]> {
  let query = supabase
    .from('mdm_production_personnel')
    .select('id,tenant_id,department_id,name,employee_no,enabled')
    .eq('enabled', true)
    .order('name')
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data } = await responseHandle<MesExecutionPerson[]>(() => query, readOptions)
  return data ?? []
}

export async function fetchExecutionAttendance(taskId: string) {
  const { data } = await responseHandle<MesExecutionAttendance[]>(
    () =>
      supabase
        .from('mes_execution_attendance')
        .select(
          '*,person:mdm_production_personnel!mes_execution_attendance_personnel_id_fkey(name,employee_no)'
        )
        .eq('task_id', taskId)
        .order('clock_in_at', { ascending: false }),
    readOptions
  )
  return data ?? []
}

export async function fetchExecutionAttendanceRange(
  query: MesExecutionListQuery,
  options?: ApiRequestOptions
) {
  const { data, error } = await fetchAllRangePages<MesExecutionAttendance>(async ({ from, to }) => {
    let request = supabase
      .from('mes_execution_attendance')
      .select(
        '*,person:mdm_production_personnel!mes_execution_attendance_personnel_id_fkey(name,employee_no)'
      )
      .gte('clock_in_at', `${query.dateRange?.[0] || '1900-01-01'}T00:00:00+08:00`)
      .lte('clock_in_at', `${query.dateRange?.[1] || '9999-12-31'}T23:59:59+08:00`)
      .order('clock_in_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
    if (query.tenantId) request = request.eq('tenant_id', query.tenantId)
    if (query.workCenterId) request = request.eq('work_center_id', query.workCenterId)
    else if (query.workCenterIds?.length)
      request = request.in('work_center_id', query.workCenterIds)
    return await responseHandle<MesExecutionAttendance[]>(
      () => (options?.signal ? request.abortSignal(options.signal) : request),
      readOptions
    )
  })
  if (error) throw error
  return data ?? []
}

export async function startExecution(taskId: string, workCenterId: string) {
  const { data } = await responseHandle<{ taskId: string; startedAt: string; status: string }>(
    () =>
      supabase.rpc('mes_start_execution', { p_task_id: taskId, p_work_center_id: workCenterId }),
    { ...writeOptions, message: '已开始加工' }
  )
  return data
}

export async function clockExecution(taskId: string, personIds: string[], direction: 'in' | 'out') {
  await responseHandle(
    () =>
      supabase.rpc('mes_clock_execution', {
        p_task_id: taskId,
        p_person_ids: personIds,
        p_direction: direction
      }),
    { ...writeOptions, message: direction === 'in' ? '上机打卡成功' : '下机打卡成功' }
  )
}

export async function submitProductionReport(
  taskId: string,
  workCenterId: string,
  input: MesReportInput
) {
  await responseHandle(
    () =>
      supabase.rpc('mes_submit_production_report', {
        p_task_id: taskId,
        p_work_center_id: workCenterId,
        p_payload: input
      }),
    { ...writeOptions, message: '报工已提交，等待审批' }
  )
}

export async function reviewProductionReport(
  id: string,
  action: 'edit' | 'approve' | 'reject' | 'resubmit',
  payload: Record<string, unknown> = {}
) {
  await responseHandle(
    () =>
      supabase.rpc('mes_review_production_report', {
        p_report_id: id,
        p_action: action,
        p_payload: payload
      }),
    {
      ...writeOptions,
      message: {
        edit: '报工已修改',
        approve: '报工已审批',
        reject: '报工已驳回',
        resubmit: '报工已重新提交'
      }[action]
    }
  )
}

export async function fetchProductionReports(query: MesExecutionListQuery) {
  const pageRange = buildSupabasePageRange(query)
  const keyword = query.keyword?.trim()
  let request = supabase
    .from('mes_production_report')
    .select(
      `*,task:mes_operation_task!mes_production_report_task_id_fkey(${taskSelect}),workCenter:mdm_work_center!mes_production_report_work_center_id_fkey(code,name),defects:mes_report_defect(id,reason_id,category,quantity,remark,reason:mes_defect_reason!mes_report_defect_reason_id_fkey(code,name))${keyword ? ',taskSearch:mes_operation_task!mes_production_report_task_id_fkey(orderSearch:mes_work_order!mes_operation_task_order_fk())' : ''}`,
      { count: 'exact' }
    )
    .order('reported_at', { ascending: false })
    .order('id')
    .range(pageRange.from, pageRange.to)
  if (query.tenantId) request = request.eq('tenant_id', query.tenantId)
  if (query.taskId) request = request.eq('task_id', query.taskId)
  if (query.workCenterId) request = request.eq('work_center_id', query.workCenterId)
  else if (query.workCenterIds?.length) request = request.in('work_center_id', query.workCenterIds)
  if (query.statuses?.length) request = request.in('status', query.statuses)
  if (query.shiftName) request = request.eq('shift_name', query.shiftName)
  if (query.dateRange?.[0])
    request = request.gte('reported_at', `${query.dateRange[0]}T00:00:00+08:00`)
  if (query.dateRange?.[1])
    request = request.lte('reported_at', `${query.dateRange[1]}T23:59:59+08:00`)
  if (keyword) {
    request = request
      .is('taskSearch.deleted_at', null)
      .is('taskSearch.orderSearch.deleted_at', null)
      .or(
        buildOrIlikeFilter(
          [
            'work_order_no',
            'material_code_snapshot',
            'material_name_snapshot',
            'project_name_snapshot',
            'specification_snapshot'
          ],
          keyword
        ),
        { referencedTable: 'taskSearch.orderSearch' }
      )
      .or(
        `${buildOrIlikeFilter(['task_no', 'operation_code', 'operation_name'], keyword)},orderSearch.not.is.null`,
        { referencedTable: 'taskSearch' }
      )
      .or(`${buildOrIlikeFilter(['reporter_name'], keyword)},taskSearch.not.is.null`)
    if (query.tenantId)
      request = request
        .eq('taskSearch.tenant_id', query.tenantId)
        .eq('taskSearch.orderSearch.tenant_id', query.tenantId)
  }
  const { data, total } = await responseHandle<MesProductionReport[]>(() => request, readOptions)
  return { data: data ?? [], total: total ?? 0 }
}

export async function fetchExecutionEvents(query: MesExecutionListQuery) {
  const pageRange = buildSupabasePageRange(query)
  const keyword = query.keyword?.trim()
  let request = supabase
    .from('mes_execution_event')
    .select(
      `*,task:mes_operation_task!mes_execution_event_task_id_fkey(${taskSelect}),workCenter:mdm_work_center!mes_execution_event_work_center_id_fkey(code,name),handler:mdm_production_personnel!mes_execution_event_handler_person_id_fkey(name,employee_no)${keyword ? ',taskSearch:mes_operation_task!mes_execution_event_task_id_fkey(orderSearch:mes_work_order!mes_operation_task_order_fk())' : ''}`,
      { count: 'exact' }
    )
    .order('occurred_at', { ascending: false })
    .order('id')
    .range(pageRange.from, pageRange.to)
  if (query.tenantId) request = request.eq('tenant_id', query.tenantId)
  if (query.kinds?.length) request = request.in('kind', query.kinds)
  if (query.taskId) request = request.eq('task_id', query.taskId)
  if (query.workCenterId) request = request.eq('work_center_id', query.workCenterId)
  else if (query.workCenterIds?.length) request = request.in('work_center_id', query.workCenterIds)
  if (query.statuses?.length) request = request.in('status', query.statuses)
  if (query.dateRange?.[0])
    request = request.gte('occurred_at', `${query.dateRange[0]}T00:00:00+08:00`)
  if (query.dateRange?.[1])
    request = request.lte('occurred_at', `${query.dateRange[1]}T23:59:59+08:00`)
  if (keyword) {
    request = request
      .is('taskSearch.deleted_at', null)
      .is('taskSearch.orderSearch.deleted_at', null)
      .or(
        buildOrIlikeFilter(
          [
            'work_order_no',
            'material_code_snapshot',
            'material_name_snapshot',
            'project_name_snapshot',
            'specification_snapshot'
          ],
          keyword
        ),
        { referencedTable: 'taskSearch.orderSearch' }
      )
      .or(
        `${buildOrIlikeFilter(['task_no', 'operation_code', 'operation_name'], keyword)},orderSearch.not.is.null`,
        { referencedTable: 'taskSearch' }
      )
      .or(
        `${buildOrIlikeFilter(['title', 'remark', 'actor_name'], keyword)},taskSearch.not.is.null`
      )
    if (query.tenantId)
      request = request
        .eq('taskSearch.tenant_id', query.tenantId)
        .eq('taskSearch.orderSearch.tenant_id', query.tenantId)
  }
  const { data, total } = await responseHandle<MesExecutionEvent[]>(() => request, readOptions)
  return { data: data ?? [], total: total ?? 0 }
}

export async function saveExecutionEvent(input: {
  id?: string | null
  kind: MesExecutionEventKind
  taskId?: string | null
  workCenterId?: string | null
  action: 'create' | 'update' | 'accept' | 'close' | 'delete'
  payload: Partial<MesExecutionEventInput>
}) {
  await responseHandle(
    () =>
      supabase.rpc('mes_save_execution_event', {
        p_event_id: input.id || null,
        p_kind: input.kind,
        p_task_id: input.taskId || null,
        p_work_center_id: input.workCenterId || null,
        p_action: input.action,
        p_payload: input.payload
      }),
    { ...writeOptions, message: '生产记录已更新' }
  )
}

export async function fetchDefectReasons(tenantId?: string | null) {
  let query = supabase.from('mes_defect_reason').select('*').order('category').order('code')
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data } = await responseHandle<MesDefectReason[]>(() => query, readOptions)
  return data ?? []
}

export async function fetchExecutionEsopDocuments(ids: string[], tenantId: string) {
  if (!ids.length) return []
  const { data } = await responseHandle<MesExecutionEsopDocument[]>(
    () =>
      supabase
        .from('mdm_esop_document')
        .select('id,tenant_id,document_code,document_name,version_no,attachment_url,status')
        .eq('tenant_id', tenantId)
        .in('id', ids),
    readOptions
  )
  return data ?? []
}

export async function saveDefectReason(
  id: string | null,
  action: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>
) {
  await responseHandle(
    () =>
      supabase.rpc('mes_save_defect_reason', { p_id: id, p_action: action, p_payload: payload }),
    { ...writeOptions, message: '不良原因已更新' }
  )
}
