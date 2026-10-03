import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateWorkOrderArea,
  calculateWorkOrderLinearMeters
} from './work-order-detail-measures'

test('work-order detail uses millimetres and piece count', () => {
  const row = { lengthMm: 2440, widthMm: 1220, pieces: 1 }
  assert.equal(calculateWorkOrderLinearMeters(row), 2.44)
  assert.equal(calculateWorkOrderArea(row), 2.9768)
  assert.equal(calculateWorkOrderArea({ ...row, pieces: 2 }), 5.9536)
})
