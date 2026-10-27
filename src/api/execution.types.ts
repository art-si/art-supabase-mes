import type { MesOperationTask } from './manufacturing.types'

export type MesExecutionEventKind =
  | 'andon'
  | 'exception'
  | 'misc_piece'
  | 'misc_report'
  | 'inspection_first'
  | 'inspection_patrol'
  | 'inspection_final'
  | 'mold'
  | 'equipment_check'
  | 'equipment_patrol'
  | 'equipment_maintenance'
  | 'material_feed'

export interface MesExecutionEsopDocument {
  id: string
  tenantId: string
  documentCode: string
  documentName: string
  versionNo: string
  attachmentUrl: string
  status: string
}

export type MesReportStatus = 'pending' | 'approved' | 'rejected'
export type MesEventStatus = 'open' | 'responding' | 'closed' | 'completed'

export interface MesExecutionTask extends Pick<
  MesOperationTask,
  | 'id'
  | 'tenantId'
  | 'taskNo'
  | 'workOrderId'
  | 'sequenceNo'
  | 'sequenceType'
  | 'operationCode'
  | 'operationName'
  | 'plannedQuantity'
  | 'completedQuantity'
  | 'reportedGoodQuantity'
  | 'reportedBadQuantity'
  | 'requiredStartDate'
  | 'requiredCompletionDate'
  | 'departmentId'
  | 'workCenterId'
  | 'operationStatus'
  | 'schedulingStatus'
> {
  startedAt: string | null
  equipmentId: string | null
  equipmentLocked: boolean
  equipmentCodeSnapshot: string | null
  equipmentNameSnapshot: string | null
  processContent: string | null
  routeStepSnapshotId: string | null
  executionRules?: MesExecutionTaskRules
  allocations?: Array<{
    id: string
    workCenterId: string
    shiftNameSnapshot: string
    quantity: number
    plannedStartDate: string | null
    plannedEndDate: string | null
    status: string
  }>
  workOrder?: {
    workOrderNo: string
    workOrderTypeNameSnapshot: string
    projectNameSnapshot: string | null
    materialCodeSnapshot: string
    materialNameSnapshot: string
    specificationSnapshot: string
    drawingNoSnapshot: string
    orderQuantity: number
    unitSnapshot: string
    orderStatus: string
    plannedEndDate: string
    routeSnapshot?: {
      steps?: Array<{
        id: string
        code: string
        name: string
        sort?: number
        sequenceNo?: number
        sequenceType?: string
        controlCode?: string
        reportMode?: string
        sequenceControl?: string
        runProcessingMinutes?: number
        runOutputQuantity?: number
        setupMinutes?: number
        sopDocuments?: Array<{ type: string; id: string; name?: string; url?: string }>
      }>
    } | null
    bomSnapshot?: Array<{
      items?: Array<{
        assignedRouteStepId?: string
        assignedOperationCode?: string
        componentMaterialCode?: string
        componentMaterialName?: string
        componentSpecification?: string
        requiredQuantity?: number
        unitName?: string
      }>
    }> | null
  } | null
  department?: { code: string; name: string } | null
  workCenter?: { code: string; name: string; departmentId: string } | null
}

export interface MesExecutionTaskRules {
  taskId: string
  firstTaskId: string | null
  controlCode: string
  reportMode: string
}

export interface MesExecutionPerson {
  id: string
  tenantId: string
  departmentId: string
  name: string
  employeeNo: string
  enabled: boolean
}

export interface MesExecutionAttendance {
  id: string
  tenantId: string
  taskId: string
  workCenterId: string
  personnelId: string
  clockInAt: string
  clockOutAt: string | null
  person?: Pick<MesExecutionPerson, 'name' | 'employeeNo'> | null
}

export interface MesDefectReason {
  id: string
  tenantId: string
  departmentId: string | null
  category: 'process' | 'material'
  code: string
  name: string
  enabled: boolean
  remark: string
  createTime: string
}

export interface MesReportDefect {
  id: string
  reasonId: string
  category: 'process' | 'material'
  quantity: number
  remark: string
  reason?: Pick<MesDefectReason, 'code' | 'name'> | null
}

export interface MesProductionReport {
  id: string
  tenantId: string
  taskId: string
  workCenterId: string | null
  equipmentId: string | null
  startedAt: string | null
  reportedAt: string
  shiftName: string
  goodQuantity: number
  processBadQuantity: number
  materialBadQuantity: number
  compensationHours: number
  compensationReason: string
  rewardPenaltyHours: number
  rewardPenaltyReason: string
  reporterAuthUserId: string
  reporterName: string
  operatorPersonIds: string[]
  remark: string
  media: string[]
  status: MesReportStatus
  rejectReason: string
  reviewedAt: string | null
  reviewerName: string
  systemSourceReportId?: string | null
  task?: MesExecutionTask
  workCenter?: { code: string; name: string } | null
  defects?: MesReportDefect[]
}

export interface MesExecutionEvent {
  id: string
  tenantId: string
  taskId: string | null
  workCenterId: string | null
  kind: MesExecutionEventKind
  title: string
  status: MesEventStatus
  occurredAt: string
  respondedAt: string | null
  completedAt: string | null
  actorAuthUserId: string | null
  actorName: string
  handlerPersonId: string | null
  handlerName: string
  quantity: number
  details: Record<string, unknown>
  media: string[]
  remark: string
  task?: MesExecutionTask | null
  workCenter?: { code: string; name: string } | null
  handler?: Pick<MesExecutionPerson, 'name' | 'employeeNo'> | null
}

export interface MesExecutionListQuery {
  current: number
  size: number
  tenantId?: string | null
  departmentIds?: string[]
  workCenterId?: string
  workCenterIds?: string[]
  taskId?: string
  dateRange?: [string, string]
  keyword?: string
  statuses?: string[]
  kinds?: MesExecutionEventKind[]
  shiftName?: string
}

export interface MesReportInput {
  equipmentId: string | null
  goodQuantity: number
  processBadQuantity: number
  materialBadQuantity: number
  compensationHours: number
  compensationReason: string
  rewardPenaltyHours: number
  rewardPenaltyReason: string
  shiftName: string
  operatorPersonIds: string[]
  remark: string
  media: string[]
  defects: Array<{ reasonId: string; quantity: number; remark: string }>
}

export interface MesExecutionCalendarShift {
  name: string
  startTime: string
  endTime: string
}

export interface MesExecutionEventInput {
  title: string
  quantity: number
  handlerPersonId?: string | null
  details: Record<string, unknown>
  media: string[]
  remark: string
  resolution?: string
}
