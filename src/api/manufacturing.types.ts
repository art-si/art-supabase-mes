export type WorkOrderStatus = 'pending' | 'abnormal' | 'confirmed' | 'closed'
export type WorkOrderDisplayStatus =
  'CRTD' | 'ABNORMAL' | 'REL' | 'PCNF' | 'CNF' | 'PDLV' | 'DLV' | 'TECO' | 'CLSD'
export type WorkOrderUrgency = 'normal' | 'urgent1' | 'urgent2' | 'urgent3'
export type OperationTaskStatus = 'unscheduled' | 'scheduled' | 'processing' | 'closed'
export type OperationSchedulingStatus = 'no_schedule' | 'pending' | 'scheduled' | 'closed'
export type OperationExecutionStatus = 'planned' | 'released' | 'started' | 'completed' | 'closed'
export type SchedulingDirection = 'forward' | 'backward'
export type SchedulingDispatchRule = 'priority' | 'edd' | 'fifo' | 'spt'

export interface MesReferenceOption {
  id: string
  code: string
  name: string
  specification?: string
  unit?: string
  extensionFields?: WorkOrderExtensionField[]
  packingEnabled?: boolean
  packingThicknessFieldKey?: string | null
  projectRequired?: boolean
}

export interface MesWorkOrderDetail {
  id?: string
  area: string
  number: string
  packedPieces?: number
  lengthMm: number
  pieces: number
  linearMeters: number
  widthMm: number
  areaSqm: number
  areaOverridden: boolean
  remark: string
  sortOrder: number
}

export type MesWorkOrderDetailInput = Omit<MesWorkOrderDetail, 'id' | 'linearMeters'>

export interface MesProductionDepartment {
  id: string
  tenantId: string
  parentId: string | null
  name: string
  code: string
  enabled: boolean
  sort: number
}

export interface MesProductionScopeCenter {
  id: string
  tenantId: string
  departmentId: string
  code: string
  name: string
  sort: number
  headcount: number
  dailyCapacityMinutes: number
  efficiencyPercent: number
  utilizationPercent: number
  parallelCapacity: number
}

export interface MesProductionScope {
  departments: MesProductionDepartment[]
  workCenters: MesProductionScopeCenter[]
}

export interface MesSchedulingShift {
  id: string
  tenantId: string
  departmentId: string
  name: string
  startTime: string
  endTime: string
  durationMinutes: number
}

export interface MesSchedulingContext {
  shifts: MesSchedulingShift[]
}

export interface MesMaterialOption extends MesReferenceOption {
  tenantId: string
  categoryId: string
  materialCode: string
  materialName: string
  description?: string | null
  widthMm?: number | null
  thicknessMm?: number | null
  specificationModel?: string
  drawingNo?: string
  materialComposition?: string
  brand?: string
  materialType?: string
  materialSource?: string
  specialPurchaseType?: string
  category?: { id: string; categoryCode: string; categoryName: string } | null
  materialTypeRef?: { id: string; typeCode: string; typeName: string } | null
  productionUnitId?: string
  productionUnitName?: string
  plannerId?: string
  plannerName?: string
  dispatcherId?: string
  dispatcherName?: string
  inboundWarehouseId?: string
  inboundWarehouseName?: string
  productionFixedLeadDays?: number
  productionPreprocessDays?: number
  selfMadeProductionDays?: number
  productionPostprocessDays?: number
  productionDays?: number
  schedulingPriority?: number
  schedulingStrategy?: 'inherit' | SchedulingDirection
  planningTimeFenceDays?: number
  batchRoundingQuantity?: number
}

export interface MesMaterialCategory {
  id: string
  tenantId: string
  parentId: string | null
  categoryCode: string
  categoryName: string
  sort: number
}

export interface MesWorkOrderBomItemSnapshot {
  id: string
  componentMaterialId: string
  componentMaterialCode: string
  componentMaterialName: string
  componentTypeId?: string | null
  componentSpecification: string
  sequenceNo: number
  quantity: number
  basicQuantity: number
  requiredQuantity: number
  unitId: string
  unitName: string
  positionNo: string | null
  operationName: string | null
  assignedRouteStepId: string | null
  assignedOperationCode: string | null
  assignedOperationName: string | null
  assignmentSource: 'configured' | 'first_operation' | 'unassigned'
  sourcePath: string[]
  virtualUnexpanded: boolean
  scrapRate?: number
  mrpEnabled?: boolean
  defaultIssueWarehouseId?: string | null
  issueMethod?: string
  backflushMethod?: string
  overIssueControlMethod?: string | null
  projectText?: string | null
  processRouteStepId?: string | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  remark?: string | null
}

export interface MesWorkOrderBomSnapshot {
  id: string
  bomCode: string
  version: string
  status: string
  items: MesWorkOrderBomItemSnapshot[]
}

export interface MesWorkOrderRouteStepSnapshot {
  id: string
  code: string
  name: string
  operationCode: string
  sort: number
  sequenceNo: number
  sequenceType: string
  workCenterId: string | null
  workCenterIds: string[]
  workCenterNames: string[]
  departmentId: string | null
  departmentName: string
  unitId: string | null
  unitName: string
  basicBatch: number
  runOutputQuantity: number
  runProcessingMinutes: number
  runGreenMinutes: number | null
  setupMinutes: number
  queueMinutes: number
  transferMinutes: number
  minimumTransferQuantity: number
  overlapEnabled: boolean
  operatorCount: number
  machineCount: number
  controlCode: string
  controlCodeName: string
  operationMode: string
  processingMode: string
  reportMode: string
  inspectionMode: string
  sequenceControl: string
  reworkMode: string
  firstInspectionControl: string
  needInspection: boolean
  firstInspection: boolean
  isFirst: boolean
  isLast: boolean
  critical: boolean
  description: string
  sequenceId?: string | null
  sequenceRemark?: string
  operationId?: string | null
  controlCodeId?: string | null
  unitConversion?: Record<string, unknown>
  activities?: Array<Record<string, unknown>>
  outsourcing?: Record<string, unknown>
  inspection?: Record<string, unknown>
  sopDocuments?: Array<Record<string, unknown>>
}

export interface MesWorkOrderRouteSnapshot {
  id?: string
  name?: string
  code?: string
  version?: string
  steps?: MesWorkOrderRouteStepSnapshot[]
}

export interface MesSnapshotReference {
  id: string
  code?: string
  name: string
  disabled?: boolean
}

export interface MesWorkOrderSnapshotReferences {
  componentTypes: MesSnapshotReference[]
  materials: MesSnapshotReference[]
  units: MesSnapshotReference[]
  warehouses: MesSnapshotReference[]
  departments: MesSnapshotReference[]
  workCenters: MesSnapshotReference[]
}

export interface MesReferences {
  materials: MesReferenceOption[]
  customers: MesReferenceOption[]
  projects: MesReferenceOption[]
  documentTypes: MesReferenceOption[]
  employees: MesReferenceOption[]
  workCenters: MesReferenceOption[]
}

export interface MesWorkOrder {
  id: string
  tenantId: string
  workOrderNo: string
  workOrderTypeId: string | null
  extensionValues: WorkOrderExtensionValues
  extensionSchemaSnapshot: WorkOrderExtensionField[]
  packingEnabledSnapshot: boolean
  packingThicknessFieldKeySnapshot: string | null
  packingRuleId: string | null
  details: MesWorkOrderDetail[]
  projectId: string | null
  constructionNo: string | null
  materialId: string
  orderQuantity: number
  productionUnitId: string | null
  isInitialDocument: boolean
  plannedStartDate: string | null
  plannedEndDate: string
  productionFixedLeadDaysSnapshot: number
  productionPreprocessDaysSnapshot: number
  selfMadeProductionDaysSnapshot: number
  productionPostprocessDaysSnapshot: number
  productionDaysSnapshot: number
  schedulingRuleId: string | null
  schedulingPriority: number
  schedulingStrategySnapshot: SchedulingDirection
  planningTimeFenceDaysSnapshot: number
  batchRoundingQuantitySnapshot: number | null
  scheduleLocked: boolean
  lastScheduledAt: string | null
  source: string
  urgency: WorkOrderUrgency
  status: WorkOrderStatus
  orderStatus: WorkOrderDisplayStatus
  statusReason: string | null
  remark: string
  specialRequirement: string | null
  trackingNo: string | null
  followNo: string | null
  merchandiserId: string | null
  salespersonId: string | null
  customerCode: string | null
  customProcessCode: string | null
  specificationQuantity: number | null
  salesOrderNo: string | null
  salesOrderQuantity: number | null
  completedQuantity: number
  warehousedQuantity: number
  printCount: number
  materialCodeSnapshot: string
  materialNameSnapshot: string
  /** Current material description for display; historical name snapshot remains unchanged. */
  materialDescription?: string
  specificationSnapshot: string
  drawingNoSnapshot: string
  unitSnapshot: string
  workOrderTypeNameSnapshot: string
  plannerId: string | null
  plannerNameSnapshot: string
  dispatcherId: string | null
  dispatcherNameSnapshot: string
  inboundWarehouseId: string | null
  inboundWarehouseNameSnapshot: string
  projectNameSnapshot: string | null
  bomSnapshot: MesWorkOrderBomSnapshot[]
  routeSnapshot: MesWorkOrderRouteSnapshot
  confirmedAt: string | null
  closedAt: string | null
  deletedAt: string | null
  updateTime: string
  createBy: string
}

export type MesWorkOrderInput = Pick<
  MesWorkOrder,
  | 'tenantId'
  | 'workOrderNo'
  | 'workOrderTypeId'
  | 'projectId'
  | 'constructionNo'
  | 'materialId'
  | 'orderQuantity'
  | 'isInitialDocument'
  | 'plannedStartDate'
  | 'plannedEndDate'
  | 'source'
  | 'urgency'
  | 'remark'
  | 'specialRequirement'
  | 'trackingNo'
  | 'followNo'
  | 'merchandiserId'
  | 'salespersonId'
  | 'customerCode'
  | 'customProcessCode'
  | 'specificationQuantity'
  | 'salesOrderNo'
  | 'salesOrderQuantity'
> & { extensionValues?: WorkOrderExtensionValues; details?: MesWorkOrderDetailInput[] }

export interface MesOperationTask {
  id: string
  tenantId: string
  taskNo: string
  workOrderId: string
  routeStepId: string | null
  routeStepSnapshotId?: string | null
  sequenceNo: number
  sequenceType: string
  operationCode: string
  operationName: string
  controlCodeId: string | null
  controlCodeSnapshot: string
  controlCodeNameSnapshot: string
  plannedQuantity: number
  operationUnit: string
  scheduledQuantity: number
  pendingScheduleQuantity: number
  completedQuantity: number
  cumulativeCompletedQuantity: number
  qualifiedQuantity: number
  cumulativeQualifiedQuantity: number
  unqualifiedQuantity: number
  cumulativeUnqualifiedQuantity: number
  scrapQuantity: number
  cumulativeScrapQuantity: number
  pendingReworkQuantity: number
  pendingInspectionQuantity: number
  plannedStartDate: string | null
  plannedEndDate: string | null
  requiredCompletionDate: string | null
  requiredStartDate: string | null
  departmentId: string | null
  workCenterId: string | null
  eligibleWorkCenterIds: string[]
  setupMinutes: number
  processingMinutes: number
  queueMinutes: number
  transferMinutes: number
  estimatedWorkMinutes: number
  minimumTransferQuantity: number
  overlapEnabled: boolean
  scheduleLocked: boolean
  scheduleSource: 'manual' | 'rule'
  schedulingRuleId: string | null
  scheduledAt: string | null
  scheduleVersion: number
  status: OperationTaskStatus
  schedulingStatus: OperationSchedulingStatus
  operationStatus: OperationExecutionStatus
  urgency: WorkOrderUrgency
  reportedGoodQuantity: number
  reportedBadQuantity: number
  processContent: string | null
  remark: string
  annotation: string
  barcodeValue: string
  qrCodeValue: string
  createTime: string
  closedAt: string | null
  deletedAt: string | null
  updateTime: string
  allocations?: MesOperationTaskAllocation[]
  workOrder?: Pick<
    MesWorkOrder,
    | 'workOrderNo'
    | 'workOrderTypeNameSnapshot'
    | 'projectNameSnapshot'
    | 'constructionNo'
    | 'plannerNameSnapshot'
    | 'dispatcherNameSnapshot'
    | 'materialCodeSnapshot'
    | 'materialNameSnapshot'
    | 'specificationSnapshot'
    | 'unitSnapshot'
    | 'plannedStartDate'
    | 'plannedEndDate'
    | 'urgency'
    | 'source'
    | 'remark'
    | 'specialRequirement'
    | 'trackingNo'
    | 'followNo'
    | 'salesOrderNo'
    | 'customerCode'
  > & { routeSnapshot?: MesWorkOrder['routeSnapshot'] }
  department?: Pick<MesReferenceOption, 'code' | 'name'>
  workCenter?: Pick<MesReferenceOption, 'code' | 'name'>
}

export interface MesOperationTaskAllocation {
  id: string
  taskId: string
  workCenterId: string
  shiftScheduleId: string | null
  shiftIndex: number | null
  shiftNameSnapshot: string | null
  quantity: number
  plannedStartDate: string
  plannedEndDate: string
  status: 'scheduled' | 'processing' | 'completed' | 'closed'
}

export interface MesGanttCalendarShift {
  index: number
  name: string
  startTime: string
  endTime: string
  workMinutes: number
}

export interface MesGanttCalendarDay {
  departmentId: string
  workDate: string
  patternId: string
  patternName: string
  shifts: MesGanttCalendarShift[]
}

export interface MesOperationTaskShiftPlanItem {
  workDate: string
  shiftIndex: number
  shiftName: string
  quantity: number
}

export interface MesOperationTaskShiftPlanInput {
  id: string
  workCenterId: string
  expectedVersion: number
  keepAssignment: boolean
  items: MesOperationTaskShiftPlanItem[]
}

export interface MesOperationTaskShiftPlanResult {
  id: string
  schedulingStatus: OperationSchedulingStatus
  scheduledQuantity: number
  pendingScheduleQuantity: number
  allocationCount: number
  scheduleVersion: number
}

export interface MesOperationTaskAllocationInput {
  workCenterId: string
  quantity: number
}

export interface MesOperationTaskAllocationResult {
  id: string
  schedulingStatus: 'scheduled'
  scheduledQuantity: number
  pendingScheduleQuantity: number
  allocationCount: number
}

export interface MesOperationTaskScheduleInput {
  id: string
  workCenterId: string
  plannedStartDate: string
  plannedEndDate: string
}

export interface MesSchedulingRule {
  id: string
  tenantId: string
  code: string
  name: string
  enabled: boolean
  isDefault: boolean
  direction: SchedulingDirection
  dispatchingRule: SchedulingDispatchRule
  finiteCapacity: boolean
  respectCalendar: boolean
  includeSetupTime: boolean
  includeQueueTime: boolean
  includeTransferTime: boolean
  preserveLockedTasks: boolean
  allowOvertime: boolean
  frozenHorizonDays: number
  planningHorizonDays: number
  priorityWeight: number
  dueDateWeight: number
  criticalOperationWeight: number
  resourceSelectionStrategy: 'earliest_available' | 'least_load' | 'preferred'
  conflictStrategy: 'reject' | 'warn' | 'allow'
  remark: string
  createTime: string
  updateTime: string
}

export type MesSchedulingRuleInput = Omit<MesSchedulingRule, 'id' | 'createTime' | 'updateTime'>

export interface MesAutoScheduleProposal {
  taskId: string
  taskNo: string
  operationName: string
  sequenceNo: number
  workCenterId: string
  workCenterCode: string
  workCenterName: string
  plannedStartDate: string
  plannedEndDate: string
  estimatedMinutes: number
  capacityMinutesPerDay: number
  durationDays: number
}

export interface MesAutoScheduleResult {
  workOrderId: string
  ruleId: string
  ruleName: string
  applied: boolean
  scheduledCount: number
  skippedCount: number
  proposals: MesAutoScheduleProposal[]
  warnings: string[]
}

export interface MesListQuery {
  current: number
  size: number
  tenantId?: string | null
  keyword?: string
  status?: string | string[]
  schedulingStatus?: string | string[]
  operationStatus?: string | string[]
  includeDeleted?: boolean
  plannedDates?: [string, string]
  workOrderStartDates?: [string, string]
  workCenterId?: string
  departmentIds?: string[]
  sortBy?: 'sequenceNo' | 'operationCode' | 'workOrderNo' | 'taskNo'
  sortOrder?: 'ascending' | 'descending'
}

export interface MesBatchFailure {
  id: string
  message: string
}

export interface MesBatchResult {
  successIds: string[]
  failures: MesBatchFailure[]
}

export interface MesMaterialOptionQuery {
  tenantId: string
  keyword?: string
  categoryId?: string
  current: number
  size: number
}
import type {
  WorkOrderExtensionField,
  WorkOrderExtensionValues
} from '@/types/business/work-order-extension'
