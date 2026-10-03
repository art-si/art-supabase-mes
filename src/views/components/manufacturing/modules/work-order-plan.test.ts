import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateOperationQuantity,
  calculatePlanFromEnd,
  calculatePlanFromStart,
  calculateProductionDays
} from './work-order-plan'

test('operation quantity multiplies the work-order quantity by the route basic batch', () => {
  assert.equal(calculateOperationQuantity(8, 1.25), 10)
})

test('production days sum the four material production lead-time fields', () => {
  assert.equal(
    calculateProductionDays({
      productionFixedLeadDays: 2,
      productionPreprocessDays: 3,
      selfMadeProductionDays: 15,
      productionPostprocessDays: 1
    }),
    21
  )
})

test('planning from start adds production days', () => {
  assert.deepEqual(calculatePlanFromStart('2026-09-16', 17), {
    plannedStartDate: '2026-09-16',
    plannedEndDate: '2026-10-03'
  })
})

test('planning backwards clamps an expired start to today and recalculates the end', () => {
  assert.deepEqual(calculatePlanFromEnd('2026-09-20', 17, '2026-09-16'), {
    plannedStartDate: '2026-09-16',
    plannedEndDate: '2026-10-03'
  })
})

test('planning backwards keeps a future inferred start', () => {
  assert.deepEqual(calculatePlanFromEnd('2026-10-20', 17, '2026-09-16'), {
    plannedStartDate: '2026-10-03',
    plannedEndDate: '2026-10-20'
  })
})
