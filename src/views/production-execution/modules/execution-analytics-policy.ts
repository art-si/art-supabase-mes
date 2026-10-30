import { createDateTimeFormatter } from '@/utils/ui/format'
import dayjs from 'dayjs'
import { groupBy } from 'lodash-es'
import type {
  MesExecutionAttendance,
  MesExecutionEvent,
  MesExecutionPerson,
  MesExecutionTask,
  MesProductionReport
} from '@mes/api'

export interface ShiftAchievementRow {
  key: string
  date: string
  shift: string
  centerId: string
  centerCode: string
  centerName: string
  departmentName: string
  task: MesExecutionTask
  plannedQuantity: number
  achievedQuantity: number
  exceptionRemark: string
}

export interface CenterAchievementRow {
  key: string
  date: string
  shift: string
  centerId: string
  centerCode: string
  centerName: string
  departmentName: string
  taskCount: number
  achievedTaskCount: number
  plannedQuantity: number
  achievedQuantity: number
}

export interface MachineAchievementRow extends CenterAchievementRow {
  equipmentId: string | null
  equipmentCode: string
  equipmentName: string
}

export interface PersonEfficiencyRow {
  key: string
  date: string
  shift: string
  personId: string
  personName: string
  departmentName: string
  outputHours: number | null
  onPostHours: number
}

const day = createDateTimeFormatter({ format: 'YYYY-MM-DD', emptyText: '', invalidText: '' })
const isInRange = (value: string, range: [string, string]) => value >= range[0] && value <= range[1]
const reportWorkDate = (report: MesProductionReport) => {
  const started = dayjs(report.startedAt)
  const reported = dayjs(report.reportedAt)
  const elapsedHours = reported.diff(started) / 3600000
  return elapsedHours >= 0 && elapsedHours <= 24
    ? started.format('YYYY-MM-DD')
    : reported.format('YYYY-MM-DD')
}

export function buildShiftAchievementRows(
  tasks: MesExecutionTask[],
  reports: MesProductionReport[],
  events: MesExecutionEvent[],
  range: [string, string]
): ShiftAchievementRow[] {
  const rows = new Map<string, ShiftAchievementRow>()
  for (const task of tasks) {
    const allocations = task.allocations?.length
      ? task.allocations
      : [
          {
            id: task.id,
            workCenterId: task.workCenterId || '',
            shiftNameSnapshot: '未指定班次',
            quantity: task.plannedQuantity,
            plannedStartDate: task.requiredCompletionDate,
            plannedEndDate: task.requiredCompletionDate,
            status: task.schedulingStatus
          }
        ]
    for (const allocation of allocations) {
      const date = day(allocation.plannedStartDate || allocation.plannedEndDate)
      if (!date || !isInRange(date, range)) continue
      const shift = allocation.shiftNameSnapshot || '未指定班次'
      const key = `${date}|${shift}|${allocation.workCenterId}|${task.id}`
      const relatedExceptions = events.filter(
        (event) =>
          event.taskId === task.id &&
          ['exception', 'andon'].includes(event.kind) &&
          day(event.occurredAt) === date
      )
      rows.set(key, {
        key,
        date,
        shift,
        centerId: allocation.workCenterId,
        centerCode: task.workCenter?.code || '',
        centerName: task.workCenter?.name || '—',
        departmentName: task.department?.name || '—',
        task,
        plannedQuantity: Number(allocation.quantity || 0),
        achievedQuantity: 0,
        exceptionRemark: relatedExceptions.map((item) => item.title).join('；')
      })
    }
  }
  for (const report of reports) {
    if (report.status !== 'approved' || !report.task) continue
    const date = reportWorkDate(report)
    const shift = report.shiftName || '未指定班次'
    const key = `${date}|${shift}|${report.workCenterId}|${report.taskId}`
    const row = rows.get(key)
    if (row) row.achievedQuantity += Number(report.goodQuantity || 0)
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.centerName.localeCompare(b.centerName) ||
      a.task.taskNo.localeCompare(b.task.taskNo)
  )
}

export function groupCenterAchievement(rows: ShiftAchievementRow[]): CenterAchievementRow[] {
  const groups = new Map<string, CenterAchievementRow>()
  for (const row of rows) {
    const key = `${row.date}|${row.shift}|${row.centerId}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        date: row.date,
        shift: row.shift,
        centerId: row.centerId,
        centerCode: row.centerCode,
        centerName: row.centerName,
        departmentName: row.departmentName,
        taskCount: 0,
        achievedTaskCount: 0,
        plannedQuantity: 0,
        achievedQuantity: 0
      }
      groups.set(key, group)
    }
    group.taskCount += 1
    if (row.plannedQuantity > 0 && row.achievedQuantity >= row.plannedQuantity)
      group.achievedTaskCount += 1
    group.plannedQuantity += row.plannedQuantity
    group.achievedQuantity += Math.min(row.achievedQuantity, row.plannedQuantity)
  }
  return [...groups.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.centerName.localeCompare(b.centerName)
  )
}

export function groupMachineAchievement(rows: ShiftAchievementRow[]): MachineAchievementRow[] {
  const groups = new Map<string, MachineAchievementRow>()
  for (const row of rows) {
    const equipmentId = row.task.equipmentId
    const key = `${row.date}|${row.shift}|${row.centerId}|${equipmentId || 'unassigned'}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        date: row.date,
        shift: row.shift,
        centerId: row.centerId,
        centerCode: row.centerCode,
        centerName: row.centerName,
        departmentName: row.departmentName,
        equipmentId,
        equipmentCode: row.task.equipmentCodeSnapshot || '—',
        equipmentName: row.task.equipmentNameSnapshot || '未分配机台',
        taskCount: 0,
        achievedTaskCount: 0,
        plannedQuantity: 0,
        achievedQuantity: 0
      }
      groups.set(key, group)
    }
    group.taskCount += 1
    if (row.plannedQuantity > 0 && row.achievedQuantity >= row.plannedQuantity)
      group.achievedTaskCount += 1
    group.plannedQuantity += row.plannedQuantity
    group.achievedQuantity += Math.min(row.achievedQuantity, row.plannedQuantity)
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.centerName.localeCompare(b.centerName) ||
      a.equipmentName.localeCompare(b.equipmentName)
  )
}

export function buildPersonEfficiencyRows(
  reports: MesProductionReport[],
  attendance: MesExecutionAttendance[],
  people: MesExecutionPerson[],
  range?: [string, string]
): PersonEfficiencyRow[] {
  if (!reports.length) return []
  const rows = new Map<string, PersonEfficiencyRow>()
  const attendanceIntervals = new Map<string, Array<[number, number]>>()
  const peopleById = groupBy(people, 'id')
  const attendanceByTaskAndPerson = new Map(
    Object.entries(groupBy(attendance, 'taskId')).map(
      ([taskId, records]) =>
        [taskId, new Map(Object.entries(groupBy(records, 'personnelId')))] as const
    )
  )
  for (const report of reports) {
    if (report.status !== 'approved' || !report.task) continue
    const date = reportWorkDate(report)
    if (range && !isInRange(date, range)) continue
    const shift = report.shiftName || '未指定班次'
    const step = report.task.workOrder?.routeSnapshot?.steps?.find(
      (item) =>
        item.id === report.task?.routeStepSnapshotId || item.code === report.task?.operationCode
    )
    const minutes = Number(step?.runProcessingMinutes || 0)
    const outputQuantity = Number(step?.runOutputQuantity || 0)
    const standardHours =
      minutes > 0 && outputQuantity > 0
        ? (report.goodQuantity * minutes) / outputQuantity / 60
        : null
    for (const personId of report.operatorPersonIds) {
      const person = peopleById[personId]?.[0]
      const key = `${date}|${shift}|${personId}`
      let row = rows.get(key)
      if (!row) {
        row = {
          key,
          date,
          shift,
          personId,
          personName: person?.name || personId,
          departmentName: report.task.department?.name || '—',
          outputHours: 0,
          onPostHours: 0
        }
        rows.set(key, row)
      }
      if (standardHours === null) row.outputHours = null
      else if (row.outputHours !== null)
        row.outputHours += standardHours / Math.max(1, report.operatorPersonIds.length)
      const start = dayjs(report.startedAt).valueOf()
      const end = dayjs(report.reportedAt).valueOf()
      const intervals = (attendanceByTaskAndPerson.get(report.taskId)?.get(personId) ?? [])
        .map((item): [number, number] => {
          const overlapStart = Math.max(start, dayjs(item.clockInAt).valueOf())
          const overlapEnd = Math.min(end, dayjs(item.clockOutAt || report.reportedAt).valueOf())
          return [overlapStart, overlapEnd]
        })
        .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && to > from)
      if (intervals.length) {
        const current = attendanceIntervals.get(key)
        if (current) for (const interval of intervals) current.push(interval)
        else attendanceIntervals.set(key, intervals)
      }
    }
  }
  for (const [key, intervals] of attendanceIntervals) {
    const row = rows.get(key)
    if (!row) continue
    intervals.sort((a, b) => a[0] - b[0])
    let [from, to] = intervals[0]
    let duration = 0
    for (const [nextFrom, nextTo] of intervals.slice(1)) {
      if (nextFrom <= to) to = Math.max(to, nextTo)
      else {
        duration += to - from
        from = nextFrom
        to = nextTo
      }
    }
    row.onPostHours = (duration + to - from) / 3600000
  }
  return [...rows.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.personName.localeCompare(b.personName)
  )
}
