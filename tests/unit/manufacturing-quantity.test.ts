import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePendingInboundQuantity } from '../../src/api/manufacturing-quantity'

test('unwarehoused quantity follows posted finished inbound totals', () => {
  assert.equal(calculatePendingInboundQuantity(120, 0), 120)
  assert.equal(calculatePendingInboundQuantity(120, 42.5), 77.5)
  assert.equal(calculatePendingInboundQuantity(120, 120), 0)
})

test('quantity subtraction preserves the database four-decimal precision', () => {
  assert.equal(calculatePendingInboundQuantity(0.3, 0.1), 0.2)
  assert.equal(calculatePendingInboundQuantity(10.0001, 0.0002), 9.9999)
})
