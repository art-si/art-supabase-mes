import assert from 'node:assert/strict'
import test from 'node:test'
import type { PackDraft, PackRule, WorkOrderBoard } from '../../src/api/packing'
import {
  packTotals,
  nextPackNo,
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

test('不同生产工单均从 PK-0001 排包，包号只在工单内唯一', () => {
  const boards = [board('a', 10)]
  const first = suggestPacks(boards, [], rule, true)
  const second = suggestPacks(
    boards.map((row) => ({ ...row, workOrderId: 'other-order' })),
    [],
    rule,
    true
  )
  assert.deepEqual(
    first.map((pack) => pack.packNo),
    ['PK-0001', 'PK-0002']
  )
  assert.deepEqual(
    second.map((pack) => pack.packNo),
    ['PK-0001', 'PK-0002']
  )
  assert.equal(new Set(first.map((pack) => pack.packNo)).size, first.length)
  assert.equal(new Set(second.map((pack) => pack.packNo)).size, second.length)
  assert.equal(validatePlan(boards, first, rule), null)
})

test('续排和拆包在当前工单内续号，不重用已有流水', () => {
  const existing = [{ packNo: 'PK-0002' }, { packNo: 'PK-0005' }]
  assert.equal(nextPackNo(existing), 'PK-0006')
  assert.deepEqual(
    existing.map((pack) => pack.packNo),
    ['PK-0002', 'PK-0005']
  )
  assert.equal(nextPackNo([{ packNo: 'PK-9999' }]), 'PK-10000')
  assert.equal(nextPackNo([]), 'PK-0001')
})

test('保留人工包时续号，重新排包和所选明细排包均使用短包号', () => {
  const boards = [board('a', 10)]
  const manual = [
    {
      id: 'legacy-pack',
      packNo: 'PK-0003',
      manuallyAdjusted: true,
      confirmed: false,
      remark: '',
      items: [{ boardId: 'a', pieces: 3, remark: '' }]
    }
  ]
  const preserved = suggestPacks(boards, manual, rule, true)
  assert.equal(preserved[0].packNo, 'PK-0003')
  assert.equal(preserved[0].id, 'legacy-pack')
  assert.equal(preserved[1].packNo, 'PK-0004')
  const reset = suggestPacks(boards, manual, rule, false)
  assert.equal(reset[0].packNo, 'PK-0001')
  const selected = suggestPacks(boards, manual, rule, true, new Set(['a']))
  assert.equal(selected[1].packNo, 'PK-0004')
  assert.equal(validatePlan(boards, selected, rule), null)
})

test('空包继续阻止保存并给出修复操作，包号仍需满足长度和工单内唯一性校验', () => {
  const boards = [board('a', 2)]
  const packs = suggestPacks(boards, [], rule, true)
  assert.match(validatePlan(boards, [{ ...packs[0], items: [] }], rule) || '', /选定该空包/)
  assert.match(validatePlan(boards, [packs[0], packs[0]], rule) || '', /重复/)
  assert.match(
    validatePlan(boards, [{ ...packs[0], packNo: 'x'.repeat(61) }], rule) || '',
    /超过 60/
  )
})

test('部分入库后重新计算始终保留已入库包，剩余板材继续生成新包', () => {
  const boards = [board('a', 10), board('b', 4)]
  const received: PackDraft = {
    id: 'received',
    packNo: 'PK-0004',
    manuallyAdjusted: false,
    confirmed: false,
    remark: '',
    inboundAt: '2026-10-26T00:00:00Z',
    inboundQuantity: 24,
    inboundAreaSqm: 24,
    items: [{ boardId: 'a', pieces: 3, remark: '' }]
  }
  const packs = suggestPacks(boards, [received], rule, false)
  assert.equal(packs[0].id, received.id)
  assert.equal(packs[0].items[0].pieces, 3)
  assert.equal(packs[0].inboundAt, received.inboundAt)
  assert.equal(packs[1].packNo, 'PK-0005')
  assert.equal(remainingPieces(boards[0], packs), 0)
  assert.equal(remainingPieces(boards[1], packs), 0)
  assert.equal(received.items[0].pieces, 3)
})

test('已入库包保留历史规则，新规则只校验未入库包，工单总块数仍不能超排', () => {
  const boards = [board('a', 5)]
  const received: PackDraft = {
    id: 'received',
    packNo: 'PK-0001',
    manuallyAdjusted: false,
    confirmed: false,
    remark: '',
    inboundAt: '2026-10-26T00:00:00Z',
    items: [{ boardId: 'a', pieces: 3, remark: '' }]
  }
  const pending: PackDraft = {
    packNo: 'PK-0002',
    manuallyAdjusted: true,
    confirmed: false,
    remark: '',
    items: [{ boardId: 'a', pieces: 2, remark: '' }]
  }
  const updatedRule = { ...rule, maxPieces: 2, maxStackHeight: 200 }
  assert.equal(validatePlan(boards, [received, pending], updatedRule), null)
  pending.items[0].pieces = 3
  assert.match(
    validatePlan(boards, [received, pending], { ...rule, maxPieces: 8 }) || '',
    /超出工单块数/
  )
})
