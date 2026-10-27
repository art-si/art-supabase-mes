import { orderBy } from 'lodash-es'
import type { MesExecutionTask } from '@mes/api/execution.types'

export function executionRouteStep(task: MesExecutionTask) {
  const steps = task.workOrder?.routeSnapshot?.steps ?? []
  return (
    steps.find((step) => step.id === task.routeStepSnapshotId) ??
    steps.find(
      (step) =>
        step.code === task.operationCode &&
        (step.sequenceNo ?? 1) === task.sequenceNo &&
        (step.sequenceType ?? 'main') === task.sequenceType
    )
  )
}

export function isFirstExecutionTask(task: MesExecutionTask): boolean {
  if (task.executionRules) return task.id === task.executionRules.firstTaskId
  if (task.sequenceType !== 'main') return false
  const first = orderBy(
    (task.workOrder?.routeSnapshot?.steps ?? [])
      .map((step, index) => ({ step, order: step.sort ?? index + 1 }))
      .filter(({ step }) => (step.sequenceType ?? 'main') === 'main'),
    [({ step }) => step.sequenceNo ?? 1, ({ order }) => order],
    ['asc', 'asc']
  )[0]?.step
  return Boolean(first && first.id === executionRouteStep(task)?.id)
}

export function canReportExecutionTask(task: MesExecutionTask | null): boolean {
  return Boolean(
    task &&
    ['scheduled', 'no_schedule'].includes(task.schedulingStatus) &&
    !['completed', 'closed'].includes(task.operationStatus) &&
    (task.executionRules?.reportMode ?? executionRouteStep(task)?.reportMode) !== 'none' &&
    (!isFirstExecutionTask(task) || task.startedAt)
  )
}
