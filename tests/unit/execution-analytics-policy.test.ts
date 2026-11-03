import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  MesExecutionAttendance,
  MesExecutionEvent,
  MesExecutionPerson,
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

test('shift exceptions keep event order per task and work date across multiple allocations', () => {
  assert.deepEqual(
    buildShiftAchievementRows(
      [],
      [],
      [{ taskId: 'task-1', kind: 'exception', occurredAt: '2026-09-20' } as MesExecutionEvent],
      ['2026-09-20', '2026-09-20']
    ),
    []
  )
  const first = {
    ...task,
    workCenter: { code: 'A', name: 'A 产线' },
    allocations: [
      {
        id: 'a-day',
        workCenterId: 'center-1',
        shiftNameSnapshot: '白班',
        quantity: 4,
        plannedStartDate: '2026-09-20'
      },
      {
        id: 'a-night',
        workCenterId: 'center-1',
        shiftNameSnapshot: '晚班',
        quantity: 6,
        plannedStartDate: '2026-09-20'
      },
      {
        id: 'a-next',
        workCenterId: 'center-1',
        shiftNameSnapshot: '白班',
        quantity: 3,
        plannedStartDate: '2026-09-21'
      },
      {
        id: 'a-invalid',
        workCenterId: 'center-1',
        shiftNameSnapshot: '白班',
        quantity: 9,
        plannedStartDate: 'invalid',
        plannedEndDate: '2026-09-20'
      },
      {
        id: 'a-empty',
        workCenterId: 'center-1',
        shiftNameSnapshot: '白班',
        quantity: 9,
        plannedStartDate: '',
        plannedEndDate: ''
      }
    ]
  } as MesExecutionTask
  const second = {
    ...task,
    id: 'task-2',
    taskNo: 'MO-002',
    workCenter: { code: 'B', name: 'B 产线' },
    allocations: [
      {
        id: 'b-day',
        workCenterId: 'center-2',
        shiftNameSnapshot: '白班',
        quantity: 5,
        plannedStartDate: '2026-09-20'
      }
    ]
  } as MesExecutionTask
  const event = (
    taskId: string | null,
    kind: MesExecutionEvent['kind'],
    occurredAt: string,
    title: string
  ) => ({ taskId, kind, occurredAt, title }) as MesExecutionEvent
  const events = [
    event(first.id, 'exception', '2026-09-20', '首项异常'),
    event(second.id, 'exception', '2026-09-20', '其他任务异常'),
    event('task-outside', 'exception', '2026-09-20', '非当前任务不显示'),
    event(first.id, 'andon', '2026-09-20', '安灯提醒'),
    event(first.id, 'misc_report', '2026-09-20', '普通事件不显示'),
    event(first.id, 'exception', '2026-09-21', '次日异常'),
    event(first.id, 'exception', '2026-09-20', '末项异常'),
    event(first.id, 'exception', 'invalid', '非法日期不显示'),
    event(first.id, 'exception', '', '空日期不显示'),
    event(null, 'exception', '2026-09-20', '无任务不显示')
  ]
  const rows = buildShiftAchievementRows(
    [second, first],
    [
      { ...report, task: first, taskId: first.id, goodQuantity: 2 },
      { ...report, task: first, taskId: first.id, status: 'pending', goodQuantity: 99 },
      { ...report, task: second, taskId: second.id, workCenterId: 'center-2', goodQuantity: 3 }
    ],
    events,
    ['2026-09-20', '2026-09-21']
  )
  assert.deepEqual(
    rows.map((row) => [row.date, row.shift, row.task.id]),
    [
      ['2026-09-21', '白班', first.id],
      ['2026-09-20', '白班', first.id],
      ['2026-09-20', '晚班', first.id],
      ['2026-09-20', '白班', second.id]
    ]
  )
  assert.deepEqual(
    rows.map((row) => row.exceptionRemark),
    ['次日异常', '首项异常；安灯提醒；末项异常', '首项异常；安灯提醒；末项异常', '其他任务异常']
  )
  assert.deepEqual(
    rows.map((row) => row.achievedQuantity),
    [0, 2, 0, 3]
  )
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

test('person efficiency indexes task and person attendance without mixing records', () => {
  const secondTask = { ...task, id: 'task-2', taskNo: 'MO-002' }
  const reports = [
    { ...report, operatorPersonIds: ['person-1', 'person-2'] },
    {
      ...report,
      taskId: secondTask.id,
      task: secondTask,
      goodQuantity: 10,
      startedAt: '2026-09-20T09:00:00+08:00',
      reportedAt: '2026-09-20T10:00:00+08:00'
    },
    {
      ...report,
      task: { ...task, workOrder: null },
      goodQuantity: 2,
      startedAt: '2026-09-20T08:30:00+08:00',
      reportedAt: '2026-09-20T09:30:00+08:00'
    }
  ] as MesProductionReport[]
  const attendanceRow = (
    taskId: string,
    personnelId: string,
    clockInAt: string,
    clockOutAt: string | null
  ): MesExecutionAttendance => ({
    id: `${taskId}-${personnelId}-${clockInAt}`,
    tenantId: 'tenant-1',
    taskId,
    workCenterId: 'center-1',
    personnelId,
    clockInAt,
    clockOutAt
  })
  const attendance = [
    attendanceRow(task.id, 'person-1', '2026-09-20T08:00:00+08:00', '2026-09-20T08:45:00+08:00'),
    attendanceRow(task.id, 'person-1', '2026-09-20T08:30:00+08:00', '2026-09-20T09:15:00+08:00'),
    attendanceRow(task.id, 'person-2', '2026-09-20T08:15:00+08:00', '2026-09-20T08:45:00+08:00'),
    attendanceRow(secondTask.id, 'person-1', '2026-09-20T09:00:00+08:00', null),
    attendanceRow(
      secondTask.id,
      'person-2',
      '2026-09-20T08:00:00+08:00',
      '2026-09-20T10:00:00+08:00'
    )
  ]
  const firstPerson = {
    id: 'person-1',
    tenantId: 'tenant-1',
    departmentId: 'department-1',
    name: '首位员工',
    employeeNo: 'P001',
    enabled: true
  }
  const people: MesExecutionPerson[] = [
    firstPerson,
    { ...firstPerson, name: '重复编号的后位员工' },
    { ...firstPerson, id: 'person-2', name: '次位员工', employeeNo: 'P002' }
  ]
  for (const input of [...reports, ...attendance, ...people]) Object.freeze(input)
  for (const item of reports) Object.freeze(item.operatorPersonIds)
  Object.freeze(reports)
  Object.freeze(attendance)
  Object.freeze(people)

  assert.deepEqual(buildPersonEfficiencyRows([], attendance, people), [])
  const rows = buildPersonEfficiencyRows(reports, attendance, people)
  const byPerson = new Map(rows.map((row) => [row.personId, row]))
  assert.equal(rows.length, 2)
  assert.equal(byPerson.get('person-1')?.personName, '首位员工')
  assert.equal(byPerson.get('person-1')?.outputHours, null)
  assert.equal(byPerson.get('person-1')?.onPostHours, 2)
  assert.equal(byPerson.get('person-2')?.outputHours, 0.4)
  assert.equal(byPerson.get('person-2')?.onPostHours, 0.5)
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
