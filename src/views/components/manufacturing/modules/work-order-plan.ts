import dayjs from 'dayjs'
import { round } from 'lodash-es'

export interface ProductionLeadTime {
  productionFixedLeadDays?: number | null
  productionPreprocessDays?: number | null
  selfMadeProductionDays?: number | null
  productionPostprocessDays?: number | null
}

export interface WorkOrderPlanDates {
  plannedStartDate: string
  plannedEndDate: string
}

const normalizeDays = (value?: number | null): number =>
  Math.max(0, Math.trunc(Number.isFinite(Number(value)) ? Number(value) : 0))

export function calculateProductionDays(leadTime: ProductionLeadTime): number {
  return (
    normalizeDays(leadTime.productionFixedLeadDays) +
    normalizeDays(leadTime.productionPreprocessDays) +
    normalizeDays(leadTime.selfMadeProductionDays) +
    normalizeDays(leadTime.productionPostprocessDays)
  )
}

export function calculateOperationQuantity(orderQuantity: number, basicBatch: number): number {
  const quantity = Math.max(0, Number.isFinite(Number(orderQuantity)) ? Number(orderQuantity) : 0)
  const batch = Math.max(0, Number.isFinite(Number(basicBatch)) ? Number(basicBatch) : 0)
  return round(quantity * batch, 6)
}

export function calculatePlanFromStart(
  plannedStartDate: string,
  productionDays: number
): WorkOrderPlanDates | null {
  const start = dayjs(plannedStartDate)
  if (!plannedStartDate || !start.isValid()) return null
  return {
    plannedStartDate: start.format('YYYY-MM-DD'),
    plannedEndDate: start.add(normalizeDays(productionDays), 'day').format('YYYY-MM-DD')
  }
}

export function calculatePlanFromEnd(
  plannedEndDate: string,
  productionDays: number,
  today = dayjs().format('YYYY-MM-DD')
): WorkOrderPlanDates | null {
  const end = dayjs(plannedEndDate)
  const currentDay = dayjs(today)
  if (!plannedEndDate || !end.isValid() || !currentDay.isValid()) return null

  const days = normalizeDays(productionDays)
  const inferredStart = end.subtract(days, 'day')
  const start = inferredStart.isBefore(currentDay, 'day') ? currentDay : inferredStart
  return {
    plannedStartDate: start.format('YYYY-MM-DD'),
    plannedEndDate: start.add(days, 'day').format('YYYY-MM-DD')
  }
}
