import assert from 'node:assert/strict'
import test from 'node:test'
import type { MesExecutionTask } from '../../src/api/execution.types'
import {
  canReportExecutionTask,
  executionRouteStep,
  isFirstExecutionTask
} from '../../src/views/production-execution/modules/execution-task-rules'

const steps = [
  {
    id: 'later',
    code: '20',
    name: '后道',
    sort: 20,
    sequenceNo: 1,
    sequenceType: 'main',
    reportMode: 'required'
  },
  {
    id: 'parallel',
    code: '10',
    name: '并行',
    sort: 1,
    sequenceNo: 2,
    sequenceType: 'parallel',
    reportMode: 'optional'
  },
  {
    id: 'first',
    code: '10',
    name: '首道',
    sort: 10,
    sequenceNo: 1,
    sequenceType: 'main',
    reportMode: 'optional'
  }
]
function task(step: (typeof steps)[number]): MesExecutionTask {
  return {
    id: step.id,
    tenantId: 'tenant',
    workOrderId: 'order',
    taskNo: step.id,
    routeStepSnapshotId: step.id,
    sequenceNo: step.sequenceNo,
    sequenceType: step.sequenceType,
    operationCode: step.code,
    operationName: step.name,
    plannedQuantity: 10,
    completedQuantity: 0,
    reportedGoodQuantity: 0,
    reportedBadQuantity: 0,
    requiredStartDate: null,
    requiredCompletionDate: null,
    departmentId: null,
    workCenterId: 'center',
    operationStatus: 'released',
    schedulingStatus: 'scheduled',
    startedAt: null,
    equipmentId: null,
    equipmentLocked: false,
    equipmentCodeSnapshot: null,
    equipmentNameSnapshot: null,
    processContent: null,
    workOrder: {
      workOrderNo: 'MO-1',
      workOrderTypeNameSnapshot: '生产工单',
      projectNameSnapshot: null,
      materialCodeSnapshot: 'M-1',
      materialNameSnapshot: '成品',
      specificationSnapshot: '',
      drawingNoSnapshot: '',
      orderQuantity: 10,
      unitSnapshot: '件',
      orderStatus: 'released',
      plannedEndDate: '',
      routeSnapshot: { steps }
    }
  }
}
test('route order identifies only the first main operation, independently of task-list pagination', () => {
  assert.equal(isFirstExecutionTask(task(steps[2])), true)
  assert.equal(isFirstExecutionTask(task(steps[0])), false)
  assert.equal(isFirstExecutionTask(task(steps[1])), false)
  assert.equal(executionRouteStep(task(steps[1]))?.id, 'parallel')
})
test('only first operation requires start; downstream tasks report directly', () => {
  const first = task(steps[2])
  assert.equal(canReportExecutionTask(first), false)
  assert.equal(canReportExecutionTask({ ...first, startedAt: '2026-10-27T01:00:00Z' }), true)
  assert.equal(canReportExecutionTask(task(steps[0])), true)
  assert.equal(canReportExecutionTask(task(steps[1])), true)
})
test('closed, completed, unscheduled and no-report operations cannot report', () => {
  const later = task(steps[0])
  assert.equal(canReportExecutionTask({ ...later, operationStatus: 'completed' }), false)
  assert.equal(canReportExecutionTask({ ...later, operationStatus: 'closed' }), false)
  assert.equal(canReportExecutionTask({ ...later, schedulingStatus: 'pending' }), false)
  const disabled = task({ ...steps[0], reportMode: 'none' })
  disabled.workOrder = {
    ...disabled.workOrder!,
    routeSnapshot: { steps: [{ ...steps[0], reportMode: 'none' }] }
  }
  assert.equal(canReportExecutionTask(disabled), false)
})

test('scoped execution rules keep reporting usable without full work-order read permission', () => {
  const first = {
    ...task(steps[2]),
    workOrder: null,
    executionRules: {
      taskId: 'first',
      firstTaskId: 'first',
      controlCode: 'SY01',
      reportMode: 'optional'
    }
  }
  const later = {
    ...task(steps[0]),
    workOrder: null,
    executionRules: {
      taskId: 'later',
      firstTaskId: 'first',
      controlCode: 'SY06',
      reportMode: 'required'
    }
  }
  assert.equal(isFirstExecutionTask(first), true)
  assert.equal(canReportExecutionTask(first), false)
  assert.equal(canReportExecutionTask(later), true)
})
