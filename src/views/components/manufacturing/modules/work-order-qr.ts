import type { MesWorkOrder } from '@mes/api'

/** The immutable row ID keeps the QR unique even when different tenants reuse a document number. */
export const workOrderQrValue = (order: Pick<MesWorkOrder, 'id'>): string =>
  `MES_WORK_ORDER:${order.id}`
