import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  MesGanttCalendarDay,
  MesOperationTask,
  MesOperationTaskAllocation
} from '../../src/api/manufacturing.types'
import {
  buildCalendarDayMap,
  buildTimelineDates,
  canAdjustShiftPlan,
  createAutomaticShiftPlan,
  taskQuantitySummary,
  taskTone,
  taskToneLabel
} from '../../src/views/production-plan/gantt-scheduling/modules/gantt-schedule-policy'

const centerId = '11111111-1111-4111-8111-111111111111'
const departmentId = '22222222-2222-4222-8222-222222222222'

function allocation(
  id: string,
  quantity: number,
  shiftIndex: number | null,
  workDate = '2026-09-18'
): MesOperationTaskAllocation {
  return {
    id,
    taskId: '33333333-3333-4333-8333-333333333333',
    workCenterId: centerId,
    shiftScheduleId: null,
    shiftIndex,
    shiftNameSnapshot: shiftIndex ? `第 ${shiftIndex} 班` : null,
    quantity,
    plannedStartDate: workDate,
    plannedEndDate: workDate,
    status: 'scheduled'
  }
}

function task(allocations: MesOperationTaskAllocation[]): MesOperationTask {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    plannedQuantity: 10,
    scheduledQuantity: 10,
    completedQuantity: 0,
    cumulativeCompletedQuantity: 0,
    pendingScheduleQuantity: 0,
    workCenterId: centerId,
    allocations,
    operationStatus: 'released',
    scheduleLocked: false,
    estimatedWorkMinutes: 600,
    processingMinutes: 600,
    workOrder: { routeSnapshot: { steps: [] } }
  } as unknown as MesOperationTask
}

function calendar(): MesGanttCalendarDay[] {
  return [
    {
      departmentId,
      workDate: '2026-09-18',
      patternId: '44444444-4444-4444-8444-444444444444',
      patternName: '两班制',
      shifts: [
        { index: 1, name: '白班', startTime: '07:00', endTime: '16:00', workMinutes: 540 },
        { index: 2, name: '夜班', startTime: '16:00', endTime: '01:00', workMinutes: 540 }
      ]
    }
  ]
}

test('builds a two-level date and shift timeline from the factory calendar', () => {
  const dates = buildTimelineDates(calendar(), '2026-09-18', '2026-09-19', [departmentId])
  assert.equal(dates.length, 2)
  assert.deepEqual(
    dates[0]?.shifts.map((shift) => shift.name),
    ['白班', '夜班']
  )
  assert.equal(dates[1]?.shifts[0]?.name, '休息')
})

test('keeps assigned, shift-scheduled, and unscheduled quantities independently reconcilable', () => {
  const row = task([
    allocation('55555555-5555-4555-8555-555555555555', 3, 1),
    allocation('66666666-6666-4666-8666-666666666666', 7, null)
  ])
  assert.deepEqual(taskQuantitySummary(row, centerId), {
    assigned: 10,
    completed: 0,
    scheduled: 3,
    pendingProcessing: 3,
    unscheduled: 7
  })
})

test('only editable scheduling states allow shift-plan changes', () => {
  const row = task([])
  row.schedulingStatus = 'pending'
  assert.equal(canAdjustShiftPlan(row), true)
  row.schedulingStatus = 'no_schedule'
  assert.equal(canAdjustShiftPlan(row), false)
  assert.equal(taskToneLabel(taskTone(row, centerId, [])), '无需排产')
  assert.deepEqual(taskQuantitySummary(row, centerId), {
    assigned: 0,
    completed: 0,
    scheduled: 0,
    pendingProcessing: 0,
    unscheduled: 0
  })
  row.schedulingStatus = 'scheduled'
  row.operationStatus = 'started'
  assert.equal(canAdjustShiftPlan(row), false)
  row.operationStatus = 'released'
  row.scheduleLocked = true
  assert.equal(canAdjustShiftPlan(row), false)
})

test('automatic scheduling fills only the unplanned part of the work-center assignment', () => {
  const row = task([
    allocation('55555555-5555-4555-8555-555555555555', 3, 1),
    allocation('66666666-6666-4666-8666-666666666666', 7, null)
  ])
  const dates = buildTimelineDates(calendar(), '2026-09-18', '2026-09-18', [departmentId])
  const plan = createAutomaticShiftPlan(
    row,
    centerId,
    departmentId,
    dates,
    buildCalendarDayMap(calendar()),
    'forward'
  )
  assert.deepEqual(
    plan.map((item) => [item.shiftIndex, item.quantity]),
    [
      [1, 3],
      [2, 7]
    ]
  )
})
