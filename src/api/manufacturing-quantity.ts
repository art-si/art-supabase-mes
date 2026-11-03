import Decimal from 'decimal.js-light'

/** The posted finished inbound total is owned by WMS; the remainder is read-only. */
export function calculatePendingInboundQuantity(
  orderQuantity: number,
  warehousedQuantity: number
): number {
  return new Decimal(orderQuantity).minus(warehousedQuantity).toNumber()
}
