import assert from 'node:assert/strict'
import test from 'node:test'
import type { PackRule, WorkOrderBoard } from '../../src/api/packing'
import {
  packTotals,
  remainingPieces,
  suggestPacks,
  validatePlan
} from '../../src/views/production-plan/packing/modules/packing-plan'

const rule: PackRule = {
  id: 'rule',
  tenantId: 'tenant',
  ruleCode: 'ROCK_BOARD',
  ruleName: '岩棉板',
  enabled: true,
  maxPieces: 8,
  maxStackHeight: 600,
  boardThicknessMm: null,
  maxWeight: null,
  maxLength: null,
  sameWidth: true,
  sameArea: true,
  sameNumber: true,
  allowMixLength: false,
  remainderPolicy: 'separate',
  sortPriority: 'area,boardNo,width,length',
  remark: '',
  updateTime: ''
}
const board = (
  id: string,
  pieces: number,
  area = '一区',
  axis = 'A轴',
  lengthMm = 8000
): WorkOrderBoard => ({
  id,
  tenantId: 'tenant',
  workOrderId: 'order',
  area,
  axis,
  boardNo: id,
  lengthMm,
  widthMm: 1000,
  areaSqm: 8 * pieces,
  thicknessMm: 100,
  unitWeightKg: 18,
  pieces,
  packedPieces: 0,
  remark: ''
})

test('自动排包按块数和堆叠高度拆包，并保留人工调整的数量', () => {
  const boards = [board('a', 10), board('b', 2)]
  const manual = [
    {
      packNo: 'HAND-1',
      manuallyAdjusted: true,
      confirmed: true,
      remark: '',
      items: [{ boardId: 'a', pieces: 3, remark: '' }]
    }
  ]
  const packs = suggestPacks(boards, manual, rule, true)
  assert.equal(packs[0].packNo, 'HAND-1')
  assert.equal(packs[0].items[0].pieces, 3)
  assert.equal(
    packs.reduce((sum, pack) => sum + packTotals(pack, boards).pieces, 0),
    12
  )
  assert.ok(packs.every((pack) => packTotals(pack, boards).stackHeightMm <= 600))
  assert.equal(remainingPieces(boards[0], packs), 0)
})

test('同编号规则拒绝不同编号混包，超排会被拒绝', () => {
  const boards = [board('a', 2), board('b', 2, '一区', 'B轴')]
  const mixed = [
    {
      packNo: 'P1',
      manuallyAdjusted: true,
      confirmed: false,
      remark: '',
      items: [
        { boardId: 'a', pieces: 2, remark: '' },
        { boardId: 'b', pieces: 2, remark: '' }
      ]
    }
  ]
  assert.match(validatePlan(boards, mixed, rule) || '', /不同编号/)
  mixed[0].items.pop()
  mixed[0].items[0].pieces = 3
  assert.match(validatePlan(boards, mixed, rule) || '', /超出工单块数/)
})

test('尾数独立小包不会并入下一行板材，合并策略可以共包', () => {
  const boards = [board('a', 2), board('b', 2)]
  const limits = { ...rule, maxStackHeight: 1000 }
  const separate = suggestPacks(boards, [], limits, true)
  const merged = suggestPacks(
    boards,
    [],
    { ...limits, sameNumber: false, remainderPolicy: 'merge' },
    true
  )
  assert.equal(separate.length, 2)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].items.length, 2)
})

test('手动排包仅处理所选明细，按规则块数与堆叠上限拆分', () => {
  const boards = [board('a', 10), board('b', 4)]
  const existing = [
    {
      packNo: 'HAND-1',
      manuallyAdjusted: true,
      confirmed: false,
      remark: '',
      items: [{ boardId: 'b', pieces: 2, remark: '' }]
    }
  ]
  const packs = suggestPacks(boards, existing, { ...rule, maxPieces: 5 }, true, new Set(['a']))
  assert.equal(remainingPieces(boards[0], packs), 0)
  assert.equal(remainingPieces(boards[1], packs), 2)
  assert.ok(packs.every((pack) => packTotals(pack, boards).pieces <= 5))
})

test('同编号关闭时允许同区域不同编号，板厚条件仍生效', () => {
  const boards = [board('a', 2), board('b', 2)]
  const mixed = [
    {
      packNo: 'P1',
      manuallyAdjusted: false,
      confirmed: false,
      remark: '',
      items: [
        { boardId: 'a', pieces: 2, remark: '' },
        { boardId: 'b', pieces: 2, remark: '' }
      ]
    }
  ]
  const flexible = { ...rule, sameNumber: false, maxStackHeight: 1000 }
  assert.equal(validatePlan(boards, mixed, flexible), null)
  assert.match(validatePlan(boards, mixed, { ...flexible, boardThicknessMm: 50 }) || '', /板厚/)
})
