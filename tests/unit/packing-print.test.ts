import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPackingPrintLabels,
  packingLabelPageCss,
  type PackingPrintInput
} from '../../src/views/production-plan/packing/modules/packing-print'

test('自定义标签纸支持 105 mm 宽度上限，并拒绝超限及无效尺寸', () => {
  assert.match(packingLabelPageCss({ paperWidthMm: 105, paperHeightMm: 80 }), /size: 105mm 80mm/)
  assert.match(packingLabelPageCss({ paperWidthMm: 80.5, paperHeightMm: 120 }), /80.5mm 120mm/)
  for (const width of [0, -1, 105.1, NaN, Infinity]) {
    assert.throws(() => packingLabelPageCss({ paperWidthMm: width, paperHeightMm: 80 }), /1–105/)
  }
  for (const height of [0, -1, NaN, Infinity]) {
    assert.throws(() => packingLabelPageCss({ paperWidthMm: 105, paperHeightMm: height }), /高度/)
  }
})

function input(): PackingPrintInput {
  const boards = Array.from({ length: 10 }, (_, index) => ({
    id: `board-${index}`,
    tenantId: 'tenant',
    workOrderId: 'order',
    area: 'A区',
    axis: 'A轴',
    boardNo: `A-${index}`,
    lengthMm: 6000 + index * 100,
    widthMm: 1000,
    pieces: 20,
    packedPieces: 7,
    thicknessMm: 50,
    areaSqm: 120,
    unitWeightKg: null,
    remark: ''
  }))
  const packs = [
    {
      id: 'pack-1',
      packNo: 'PK-0001',
      manuallyAdjusted: false,
      confirmed: false,
      remark: '',
      items: [{ boardId: 'board-0', pieces: 3, remark: '' }]
    },
    {
      id: 'pack-2',
      packNo: 'PK-0002',
      manuallyAdjusted: false,
      confirmed: false,
      remark: '',
      items: boards.map((board) => ({ boardId: board.id, pieces: 2, remark: '' }))
    }
  ]
  return {
    mode: 'label',
    order: {
      id: 'order',
      tenantId: 'tenant',
      workOrderNo: 'MO-001',
      materialCodeSnapshot: 'MAT-001',
      materialNameSnapshot: '聚氨酯板',
      materialDescription: '聚氨酯墙面板 · 1000 × 50 · 方波',
      specificationSnapshot: '1000 × 50',
      projectNameSnapshot: '测试项目'
    },
    boards,
    packs,
    selectedPacks: [packs[1]]
  }
}

test('部分行选中仍打印整包，续页保持原包序号并完整保留每块板材', () => {
  const data = input()
  data.selectedPacks = [{ ...data.packs[1], items: [data.packs[1].items[0]] }]
  const labels = buildPackingPrintLabels(data)
  assert.equal(labels.length, 2)
  assert.equal(labels[0].ordinal, 2)
  assert.equal(labels[0].total, 2)
  assert.equal(
    labels[0].areaAndNumber,
    data.boards.map((board) => `A区/${board.boardNo}`).join('、')
  )
  assert.equal(labels[1].part, 2)
  assert.deepEqual(
    labels.flatMap((label) => label.lines.map((line) => line.boardId)),
    data.boards.map((board) => board.id)
  )
  assert.equal(
    labels.flatMap((label) => label.lines).reduce((sum, line) => sum + line.pieces, 0),
    20
  )
  assert.deepEqual(JSON.parse(labels[0].qrValue), {
    type: 'mes-work-order-pack',
    workOrderId: 'order',
    packId: 'pack-2',
    packNo: 'PK-0002'
  })
  const single = input()
  Object.assign(single.boards[0], { area: 'B区', boardNo: '2轴-1' })
  single.selectedPacks = [single.packs[0]]
  assert.equal(buildPackingPrintLabels(single)[0].areaAndNumber, 'B区/2轴-1')
})

test('阻止未保存包、过期选择、跨租户、跨工单和失效板材进入打印', () => {
  const unsaved = input()
  unsaved.selectedPacks[0] = { ...unsaved.selectedPacks[0], id: undefined }
  assert.throws(() => buildPackingPrintLabels(unsaved), /先保存/)
  const stale = input()
  stale.selectedPacks[0] = { ...stale.selectedPacks[0], id: 'gone' }
  assert.throws(() => buildPackingPrintLabels(stale), /已变化/)
  for (const patch of [{ tenantId: 'other' }, { workOrderId: 'other' }, { id: 'gone' }]) {
    const invalid = input()
    Object.assign(invalid.boards[0], patch)
    assert.throws(() => buildPackingPrintLabels(invalid), /数据不完整/)
  }
})
