import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  MesExecutionAttendance,
  MesExecutionTask,
  MesProductionReport
} from '../../src/api/execution.types'
import {
  buildPersonEfficiencyRows,
  buildShiftAchievementRows,
  groupCenterAchievement,
  groupMachineAchievement
} from '../../src/views/production-execution/modules/execution-analytics-policy'

const task = {
  id: 'task-1',
  taskNo: 'MO-001',
  workCenterId: 'center-1',
  plannedQuantity: 10,
  operationCode: 'OP-01',
  routeStepSnapshotId: 'step-1',
  workCenter: { code: 'C-01', name: '一号产线' },
  department: { name: '加工车间' },
  workOrder: {
    routeSnapshot: {
      steps: [
        {
          id: 'step-1',
          code: 'OP-01',
          name: '加工',
          runProcessingMinutes: 60,
          runOutputQuantity: 10
        }
      ]
    }
  },
  allocations: [
    {
      id: 'allocation-1',
      workCenterId: 'center-1',
      shiftNameSnapshot: '白班',
      quantity: 10,
      plannedStartDate: '2026-09-20'
    }
  ]
} as MesExecutionTask

const report = {
  taskId: task.id,
  task,
  workCenterId: task.workCenterId,
  status: 'approved',
  goodQuantity: 8,
  reportedAt: '2026-09-20T10:00:00+08:00',
  startedAt: '2026-09-20T08:00:00+08:00',
  shiftName: '白班',
  operatorPersonIds: ['person-1']
} as MesProductionReport

test('shift achievement counts only approved good output', () => {
  const rows = buildShiftAchievementRows(
    [task],
    [report, { ...report, status: 'pending', goodQuantity: 20 }],
    [],
    ['2026-09-20', '2026-09-20']
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].plannedQuantity, 10)
  assert.equal(rows[0].achievedQuantity, 8)
  const [center] = groupCenterAchievement(rows)
  assert.equal(center.taskCount, 1)
  assert.equal(center.achievedTaskCount, 0)
  assert.equal(center.achievedQuantity, 8)
})

test('person efficiency merges overlapping attendance across reports', () => {
  const attendance = [
    {
      taskId: task.id,
      personnelId: 'person-1',
      clockInAt: '2026-09-20T08:00:00+08:00',
      clockOutAt: '2026-09-20T11:00:00+08:00'
    }
  ] as MesExecutionAttendance[]
  const rows = buildPersonEfficiencyRows(
    [
      report,
      {
        ...report,
        goodQuantity: 2,
        reportedAt: '2026-09-20T11:00:00+08:00'
      }
    ],
    attendance,
    [
      {
        id: 'person-1',
        tenantId: 'tenant-1',
        departmentId: 'department-1',
        name: '张三',
        employeeNo: 'P001',
        enabled: true
      }
    ]
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].outputHours, 1)
  assert.equal(rows[0].onPostHours, 3)
})

test('overnight reports belong to the shift start date', () => {
  const overnight = {
    ...report,
    startedAt: '2026-09-20T23:00:00+08:00',
    reportedAt: '2026-09-21T01:00:00+08:00'
  }
  const shifts = buildShiftAchievementRows([task], [overnight], [], ['2026-09-20', '2026-09-20'])
  assert.equal(shifts[0].achievedQuantity, 8)
  const people = [
    {
      id: 'person-1',
      tenantId: 'tenant-1',
      departmentId: 'department-1',
      name: '张三',
      employeeNo: 'P001',
      enabled: true
    }
  ]
  assert.equal(
    buildPersonEfficiencyRows([overnight], [], people, ['2026-09-20', '2026-09-20']).length,
    1
  )
  assert.equal(
    buildPersonEfficiencyRows([overnight], [], people, ['2026-09-21', '2026-09-21']).length,
    0
  )
})

test('machine achievement keeps devices in one work center separate', () => {
  const first = {
    ...task,
    equipmentId: 'equipment-1',
    equipmentCodeSnapshot: 'E-01',
    equipmentNameSnapshot: '一号机台'
  }
  const second = {
    ...task,
    id: 'task-2',
    taskNo: 'MO-002',
    equipmentId: 'equipment-2',
    equipmentCodeSnapshot: 'E-02',
    equipmentNameSnapshot: '二号机台'
  }
  const unassigned = {
    ...task,
    id: 'task-3',
    taskNo: 'MO-003',
    equipmentId: null,
    equipmentCodeSnapshot: null,
    equipmentNameSnapshot: null
  }
  const rows = buildShiftAchievementRows(
    [first, second, unassigned],
    [
      { ...report, task: first, taskId: first.id },
      { ...report, task: second, taskId: second.id, goodQuantity: 10 }
    ],
    [],
    ['2026-09-20', '2026-09-20']
  )
  const machines = groupMachineAchievement(rows)
  assert.equal(machines.length, 3)
  assert.equal(machines.find((row) => row.equipmentId === 'equipment-1')?.achievedQuantity, 8)
  assert.equal(machines.find((row) => row.equipmentId === 'equipment-2')?.achievedTaskCount, 1)
  assert.equal(machines.find((row) => row.equipmentId === null)?.equipmentName, '未分配机台')
})
