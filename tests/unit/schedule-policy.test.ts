import assert from 'node:assert/strict'
import test from 'node:test'
import type { MesOperationTask } from '../../src/api/manufacturing.types'
import {
  conflictTaskIds,
  scheduleRisk,
  taskEndDate,
  taskStartDate
} from '../../src/views/production-plan/scheduling/modules/schedule-policy'

function task(overrides: Partial<MesOperationTask>): MesOperationTask {
  return {
    id: overrides.id || crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    taskNo: 'OT202609140001',
    workOrderId: crypto.randomUUID(),
    routeStepId: null,
    sequenceNo: 10,
    sequenceType: 'standard',
    operationCode: 'OP10',
    operationName: '下料',
    controlCodeId: null,
    controlCodeSnapshot: '',
    controlCodeNameSnapshot: '',
    plannedQuantity: 10,
    operationUnit: '件',
    scheduledQuantity: 10,
    pendingScheduleQuantity: 0,
    completedQuantity: 0,
    cumulativeCompletedQuantity: 0,
    qualifiedQuantity: 0,
    cumulativeQualifiedQuantity: 0,
    unqualifiedQuantity: 0,
    cumulativeUnqualifiedQuantity: 0,
    scrapQuantity: 0,
    cumulativeScrapQuantity: 0,
    pendingReworkQuantity: 0,
    pendingInspectionQuantity: 0,
    plannedStartDate: '2026-09-14',
    plannedEndDate: '2026-09-15',
    requiredStartDate: '2026-09-14',
    requiredCompletionDate: '2026-09-15',
    departmentId: null,
    workCenterId: '11111111-1111-4111-8111-111111111111',
    eligibleWorkCenterIds: [],
    setupMinutes: 0,
    processingMinutes: 60,
    queueMinutes: 0,
    transferMinutes: 0,
    estimatedWorkMinutes: 60,
    minimumTransferQuantity: 1,
    overlapEnabled: false,
    scheduleLocked: false,
    scheduleSource: 'manual',
    schedulingRuleId: null,
    scheduledAt: null,
    scheduleVersion: 1,
    status: 'scheduled',
    schedulingStatus: 'scheduled',
    operationStatus: 'released',
    urgency: 'normal',
    reportedGoodQuantity: 0,
    reportedBadQuantity: 0,
    processContent: null,
    remark: '',
    annotation: '',
    barcodeValue: 'OT202609140001',
    qrCodeValue: 'OT202609140001',
    createTime: '2026-09-14T00:00:00Z',
    closedAt: null,
    deletedAt: null,
    updateTime: '2026-09-14T00:00:00Z',
    ...overrides
  }
}

test('uses work-order dates as a fallback for an operation task', () => {
  const row = task({
    plannedStartDate: null,
    plannedEndDate: null,
    workOrder: {
      workOrderNo: 'MO-001',
      workOrderTypeNameSnapshot: '标准工单',
      projectNameSnapshot: null,
      constructionNo: null,
      plannerNameSnapshot: '',
      dispatcherNameSnapshot: '',
      materialCodeSnapshot: 'MAT-001',
      materialNameSnapshot: '组件',
      specificationSnapshot: '',
      unitSnapshot: '件',
      plannedStartDate: '2026-09-20',
      plannedEndDate: '2026-09-22',
      urgency: 'normal',
      source: 'manual',
      remark: '',
      specialRequirement: null,
      trackingNo: null,
      followNo: null,
      salesOrderNo: null,
      customerCode: null
    }
  })
  assert.equal(taskStartDate(row), '2026-09-20')
  assert.equal(taskEndDate(row), '2026-09-22')
})

test('marks overlapping tasks in the same work center as conflicts', () => {
  const first = task({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  const second = task({
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    plannedStartDate: '2026-09-15',
    plannedEndDate: '2026-09-16'
  })
  const separateCenter = task({
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    workCenterId: '22222222-2222-4222-8222-222222222222'
  })
  const conflicts = conflictTaskIds([first, second, separateCenter])
  assert.deepEqual([...conflicts].sort(), [first.id, second.id].sort())
  assert.equal(scheduleRisk(first, conflicts), 'conflict')
})

test('unassigned tasks take precedence over date risk', () => {
  const row = task({
    workCenterId: null,
    status: 'unscheduled',
    schedulingStatus: 'pending',
    plannedEndDate: '2020-01-01'
  })
  assert.equal(scheduleRisk(row, new Set()), 'unassigned')
})
