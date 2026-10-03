import dayjs from 'dayjs'
import type { MesOperationTask } from '@mes/api'

export type ScheduleRisk = 'conflict' | 'overdue' | 'unassigned' | 'healthy'

export function taskStartDate(task: MesOperationTask): string | null {
  return task.plannedStartDate || task.workOrder?.plannedStartDate || null
}

export function taskEndDate(task: MesOperationTask): string | null {
  return task.plannedEndDate || task.workOrder?.plannedEndDate || null
}

export function tasksOverlap(left: MesOperationTask, right: MesOperationTask): boolean {
  const leftStart = taskStartDate(left)
  const leftEnd = taskEndDate(left)
  const rightStart = taskStartDate(right)
  const rightEnd = taskEndDate(right)
  if (!left.workCenterId || left.workCenterId !== right.workCenterId) return false
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false
  return !dayjs(leftEnd).isBefore(rightStart, 'day') && !dayjs(rightEnd).isBefore(leftStart, 'day')
}

export function conflictTaskIds(tasks: MesOperationTask[]): Set<string> {
  const ids = new Set<string>()
  for (let index = 0; index < tasks.length; index += 1) {
    const left = tasks[index]
    if (!left || left.schedulingStatus === 'closed') continue
    for (let compareIndex = index + 1; compareIndex < tasks.length; compareIndex += 1) {
      const right = tasks[compareIndex]
      if (!right || right.schedulingStatus === 'closed') continue
      if (tasksOverlap(left, right)) {
        ids.add(left.id)
        ids.add(right.id)
      }
    }
  }
  return ids
}

export function scheduleRisk(task: MesOperationTask, conflicts: Set<string>): ScheduleRisk {
  if (!task.workCenterId || task.schedulingStatus === 'pending') return 'unassigned'
  if (conflicts.has(task.id)) return 'conflict'
  const endDate = taskEndDate(task)
  if (endDate && dayjs(endDate).isBefore(dayjs(), 'day') && task.schedulingStatus !== 'closed')
    return 'overdue'
  return 'healthy'
}

export function scheduleRiskLabel(risk: ScheduleRisk): string {
  return {
    conflict: '资源冲突',
    overdue: '计划逾期',
    unassigned: '待排程',
    healthy: '计划正常'
  }[risk]
}
