import assert from 'node:assert/strict'
import test from 'node:test'
import type { MesOperationTask } from '@mes/api'
import {
  defaultWorkCenterIdForTask,
  routeStepForTask,
  taskQuantitySummary
} from './gantt-schedule-policy'

const centerId = 'edf59b8f-13b6-4d00-93b5-140cf182b13c'

function task(overrides: Partial<MesOperationTask> = {}): MesOperationTask {
  return {
    workCenterId: null,
    routeStepId: null,
    routeStepSnapshotId: '11111111-1111-4111-8111-111111111111',
    operationCode: 'OP-10',
    eligibleWorkCenterIds: [centerId],
    plannedQuantity: 10,
    scheduledQuantity: 0,
    completedQuantity: 2,
    cumulativeCompletedQuantity: 2,
    scheduleVersion: 0,
    allocations: [],
    workOrder: {
      routeSnapshot: {
        steps: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            operationCode: 'OP-10',
            workCenterId: centerId
          }
        ]
      }
    },
    ...overrides
  } as unknown as MesOperationTask
}

test('uses the work-order route snapshot as the default center before allocation', () => {
  const item = task()
  assert.equal(routeStepForTask(item)?.workCenterId, centerId)
  assert.equal(defaultWorkCenterIdForTask(item), centerId)
  assert.deepEqual(taskQuantitySummary(item, centerId), {
    assigned: 8,
    completed: 2,
    scheduled: 0,
    pendingProcessing: 0,
    unscheduled: 8
  })
})

test('does not count unallocated quantity again after another center receives it', () => {
  const item = task({
    allocations: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        workCenterId: '33333333-3333-4333-8333-333333333333',
        quantity: 8,
        shiftIndex: null,
        status: 'scheduled'
      }
    ] as MesOperationTask['allocations']
  })
  assert.equal(taskQuantitySummary(item, centerId).assigned, 0)
})

test('removed assignments do not reappear at the route default center', () => {
  const item = task({ scheduleVersion: 2, workCenterId: null, allocations: [] })
  assert.equal(defaultWorkCenterIdForTask(item), null)
  assert.equal(taskQuantitySummary(item, centerId).assigned, 0)
})
