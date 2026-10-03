import type { MesWorkOrderDetailInput } from '@mes/api'

type Dimensions = Pick<MesWorkOrderDetailInput, 'lengthMm' | 'widthMm' | 'pieces'>

export const calculateWorkOrderLinearMeters = (
  row: Pick<Dimensions, 'lengthMm' | 'pieces'>
): number => Math.round(((Number(row.lengthMm) * Number(row.pieces)) / 1000) * 1000) / 1000

export const calculateWorkOrderArea = (row: Dimensions): number =>
  Math.round(
    ((Number(row.lengthMm) * Number(row.widthMm) * Number(row.pieces)) / 1_000_000) * 10_000
  ) / 10_000
