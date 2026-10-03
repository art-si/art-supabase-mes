import dayjs from 'dayjs'
import type {
  MesGanttCalendarDay,
  MesGanttCalendarShift,
  MesOperationTask,
  MesOperationTaskAllocation,
  MesOperationTaskShiftPlanItem,
  MesWorkOrderRouteStepSnapshot,
  SchedulingDirection
} from '@mes/api'

export interface GanttShiftSlot extends MesGanttCalendarShift {
  key: string
  workDate: string
}

export interface GanttDateColumn {
  date: string
  label: string
  weekday: string
  isToday: boolean
  isWeekend: boolean
  shifts: GanttShiftSlot[]
}

export interface TaskQuantitySummary {
  assigned: number
  completed: number
  scheduled: number
  pendingProcessing: number
  unscheduled: number
}

export type GanttTaskTone = 'processing' | 'adjusting' | 'pending' | 'over-capacity' | 'excluded'

const roundQuantity = (value: number): number => Number(Math.max(value, 0).toFixed(2))

export const shiftSlotKey = (workDate: string, shiftIndex: number): string =>
  `${workDate}:${shiftIndex}`

export function buildCalendarDayMap(days: MesGanttCalendarDay[]): Map<string, MesGanttCalendarDay> {
  return new Map(days.map((day) => [`${day.departmentId}:${day.workDate}`, day]))
}

export function buildTimelineDates(
  days: MesGanttCalendarDay[],
  startDate: string,
  endDate: string,
  departmentIds: string[]
): GanttDateColumn[] {
  const start = dayjs(startDate)
  const count = Math.max(dayjs(endDate).diff(start, 'day') + 1, 1)
  const departmentSet = new Set(departmentIds)
  return Array.from({ length: count }, (_, dateIndex) => {
    const current = start.add(dateIndex, 'day')
    const date = current.format('YYYY-MM-DD')
    const shiftMap = new Map<string, MesGanttCalendarShift>()
    days
      .filter(
        (day) =>
          day.workDate === date && (!departmentSet.size || departmentSet.has(day.departmentId))
      )
      .flatMap((day) => day.shifts)
      .forEach((shift) => {
        const key = `${shift.index}:${shift.name}`
        if (!shiftMap.has(key)) shiftMap.set(key, shift)
      })
    const shifts = [...shiftMap.values()]
      .sort(
        (left, right) => left.index - right.index || left.startTime.localeCompare(right.startTime)
      )
      .map((shift) => ({ ...shift, key: shiftSlotKey(date, shift.index), workDate: date }))
    return {
      date,
      label: current.format('MM/DD'),
      weekday: `周${'日一二三四五六'[current.day()]}`,
      isToday: current.isSame(dayjs(), 'day'),
      isWeekend: [0, 6].includes(current.day()),
      shifts: shifts.length
        ? shifts
        : [
            {
              key: shiftSlotKey(date, 0),
              workDate: date,
              index: 0,
              name: '休息',
              startTime: '',
              endTime: '',
              workMinutes: 0
            }
          ]
    }
  })
}

export function allocationsForCenter(
  task: MesOperationTask,
  workCenterId: string
): MesOperationTaskAllocation[] {
  return (task.allocations || []).filter(
    (allocation) => allocation.workCenterId === workCenterId && allocation.status !== 'closed'
  )
}

export function taskQuantitySummary(
  task: MesOperationTask,
  workCenterId: string
): TaskQuantitySummary {
  const centerAllocations = allocationsForCenter(task, workCenterId)
  const defaultCenterId = defaultWorkCenterIdForTask(task)
  const hasActiveAllocations = (task.allocations || []).some(
    (allocation) => allocation.status !== 'closed'
  )
  const hasImplicitAssignment =
    !hasActiveAllocations &&
    defaultCenterId === workCenterId &&
    task.schedulingStatus !== 'no_schedule'
  const assigned = centerAllocations.length
    ? centerAllocations.reduce((total, allocation) => total + Number(allocation.quantity || 0), 0)
    : hasImplicitAssignment
      ? Math.max(
          Number(task.plannedQuantity || 0) - Number(task.cumulativeCompletedQuantity || 0),
          0
        )
      : 0
  const scheduled = centerAllocations
    .filter((allocation) => allocation.shiftIndex)
    .reduce((total, allocation) => total + Number(allocation.quantity || 0), 0)
  const completionMap = completionForAllocations(task)
  const completed = centerAllocations.length
    ? centerAllocations.reduce(
        (total, allocation) => total + Number(completionMap.get(allocation.id) || 0),
        0
      )
    : hasImplicitAssignment
      ? Number(task.cumulativeCompletedQuantity || task.completedQuantity || 0)
      : 0
  return {
    assigned: roundQuantity(assigned),
    completed: roundQuantity(completed),
    scheduled: roundQuantity(scheduled),
    pendingProcessing: roundQuantity(scheduled - completed),
    unscheduled: roundQuantity(assigned - scheduled)
  }
}

export function routeStepForTask(
  task: MesOperationTask
): MesWorkOrderRouteStepSnapshot | undefined {
  const steps = task.workOrder?.routeSnapshot?.steps || []
  return (
    steps.find((step) => step.id === (task.routeStepSnapshotId || task.routeStepId)) ||
    steps.find((step) => step.operationCode === task.operationCode)
  )
}

export function defaultWorkCenterIdForTask(task: MesOperationTask): string | null {
  if (task.workCenterId) return task.workCenterId
  if (Number(task.scheduleVersion || 0) > 0) return null
  const step = routeStepForTask(task)
  if (step?.workCenterId) return step.workCenterId
  const eligible = task.eligibleWorkCenterIds || []
  return eligible.length === 1 ? eligible[0]! : null
}

export function theoreticalShiftQuantity(task: MesOperationTask, workMinutes: number): number {
  if (workMinutes <= 0) return 0
  const step = routeStepForTask(task)
  const output = Number(step?.runOutputQuantity || 0)
  const processingMinutes = Number(step?.runProcessingMinutes || 0)
  if (output > 0 && processingMinutes > 0) {
    return roundQuantity((output * workMinutes) / processingMinutes)
  }
  const taskMinutes = Number(task.estimatedWorkMinutes || task.processingMinutes || 0)
  const taskQuantity = Number(task.plannedQuantity || 0)
  if (taskMinutes > 0 && taskQuantity > 0) {
    return roundQuantity((taskQuantity * workMinutes) / taskMinutes)
  }
  return roundQuantity(taskQuantity)
}

export function taskTone(
  task: MesOperationTask,
  workCenterId: string,
  dates: GanttDateColumn[]
): GanttTaskTone {
  const allocations = allocationsForCenter(task, workCenterId)
  const slotByKey = new Map(dates.flatMap((date) => date.shifts).map((slot) => [slot.key, slot]))
  const overCapacity = allocations.some((allocation) => {
    const slot = slotByKey.get(
      shiftSlotKey(allocation.plannedStartDate, Number(allocation.shiftIndex || 0))
    )
    return (
      slot && Number(allocation.quantity || 0) > theoreticalShiftQuantity(task, slot.workMinutes)
    )
  })
  if (task.schedulingStatus === 'no_schedule') return 'excluded'
  if (overCapacity) return 'over-capacity'
  if (task.operationStatus === 'started') return 'processing'
  if (task.scheduleLocked || taskQuantitySummary(task, workCenterId).unscheduled > 0)
    return 'adjusting'
  return 'pending'
}

export function taskToneLabel(tone: GanttTaskTone): string {
  return {
    excluded: '无需排产',
    processing: '生产中',
    adjusting: '调整中',
    pending: '待生产',
    'over-capacity': '超产能'
  }[tone]
}

export function canAdjustShiftPlan(task: MesOperationTask): boolean {
  return (
    !task.deletedAt &&
    !task.scheduleLocked &&
    ['pending', 'scheduled'].includes(task.schedulingStatus) &&
    !['started', 'completed', 'closed'].includes(task.operationStatus)
  )
}

export function isShiftFinished(slot: GanttShiftSlot): boolean {
  if (!slot.endTime) return true
  const end = dayjs(`${slot.workDate} ${slot.endTime}`)
  const crossesMidnight = slot.endTime <= slot.startTime
  return (crossesMidnight ? end.add(1, 'day') : end).isBefore(dayjs())
}

export function completionByAllocation(
  task: MesOperationTask,
  workCenterId: string
): Map<string, number> {
  const result = completionForAllocations(task)
  return new Map(
    allocationsForCenter(task, workCenterId)
      .filter((allocation) => allocation.shiftIndex)
      .map((allocation) => [allocation.id, result.get(allocation.id) || 0])
  )
}

function completionForAllocations(task: MesOperationTask): Map<string, number> {
  let completed = Number(task.cumulativeCompletedQuantity || task.completedQuantity || 0)
  const result = new Map<string, number>()
  ;(task.allocations || [])
    .filter((allocation) => allocation.status !== 'closed')
    .slice()
    .sort(
      (left, right) =>
        left.plannedStartDate.localeCompare(right.plannedStartDate) ||
        (left.shiftIndex === null ? 99 : Number(left.shiftIndex)) -
          (right.shiftIndex === null ? 99 : Number(right.shiftIndex))
    )
    .forEach((allocation) => {
      const reported = Math.min(Number(allocation.quantity || 0), Math.max(completed, 0))
      result.set(allocation.id, roundQuantity(reported))
      completed -= reported
    })
  return result
}

export function createAutomaticShiftPlan(
  task: MesOperationTask,
  workCenterId: string,
  departmentId: string,
  dates: GanttDateColumn[],
  calendarDayMap: Map<string, MesGanttCalendarDay>,
  direction: SchedulingDirection
): MesOperationTaskShiftPlanItem[] {
  const existing = allocationsForCenter(task, workCenterId)
    .filter((allocation) => allocation.shiftIndex)
    .map((allocation) => ({
      workDate: allocation.plannedStartDate,
      shiftIndex: Number(allocation.shiftIndex),
      shiftName: allocation.shiftNameSnapshot || `第 ${allocation.shiftIndex} 班`,
      quantity: Number(allocation.quantity)
    }))
  const existingKeys = new Set(existing.map((item) => shiftSlotKey(item.workDate, item.shiftIndex)))
  let remaining = Math.max(
    taskQuantitySummary(task, workCenterId).assigned -
      existing.reduce((total, item) => total + Number(item.quantity || 0), 0),
    0
  )
  const slots = dates
    .flatMap((date) => date.shifts)
    .filter((slot) => {
      if (!slot.index || existingKeys.has(slot.key)) return false
      return Boolean(
        calendarDayMap
          .get(`${departmentId}:${slot.workDate}`)
          ?.shifts.some((shift) => shift.index === slot.index)
      )
    })
  if (direction === 'backward') slots.reverse()
  const generated: MesOperationTaskShiftPlanItem[] = []
  for (const slot of slots) {
    if (remaining <= 0) break
    const capacity = theoreticalShiftQuantity(task, slot.workMinutes)
    if (capacity <= 0) continue
    const quantity = roundQuantity(Math.min(remaining, capacity))
    generated.push({
      workDate: slot.workDate,
      shiftIndex: slot.index,
      shiftName: slot.name,
      quantity
    })
    remaining = roundQuantity(remaining - quantity)
  }
  return [...existing, ...generated].sort(
    (left, right) =>
      left.workDate.localeCompare(right.workDate) || left.shiftIndex - right.shiftIndex
  )
}
