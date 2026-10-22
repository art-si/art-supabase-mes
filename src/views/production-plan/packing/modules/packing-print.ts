import { chunk, uniq } from 'lodash-es'
import type { PackDraft, WorkOrderBoard } from '@mes/api'

export type PackingPrintMode = 'form' | 'label'
export interface PackingPrintOrder {
  id: string
  tenantId: string
  workOrderNo: string
  materialCodeSnapshot: string
  materialNameSnapshot: string
  materialDescription: string
  specificationSnapshot: string
  projectNameSnapshot: string
}
export interface PackingPrintInput {
  mode: PackingPrintMode
  order: PackingPrintOrder
  boards: WorkOrderBoard[]
  packs: PackDraft[]
  selectedPacks: PackDraft[]
}
export interface PackingPrintOptions {
  paperWidthMm: number
  paperHeightMm: number
  standard: string
  boardType: string
  color: string
  inspector: string
  productionDate: string
}

export function packingLabelPageCss(
  paper: Pick<PackingPrintOptions, 'paperWidthMm' | 'paperHeightMm'>
): string {
  if (!Number.isFinite(paper.paperWidthMm) || paper.paperWidthMm < 1 || paper.paperWidthMm > 105)
    throw new Error('标签纸宽度须为 1–105 mm')
  if (!Number.isFinite(paper.paperHeightMm) || paper.paperHeightMm < 1)
    throw new Error('请填写大于或等于 1 mm 的标签纸高度')
  return `@page packing-label { size: ${paper.paperWidthMm}mm ${paper.paperHeightMm}mm; margin: 0; }`
}
export interface PackingPrintLine {
  boardId: string
  area: string
  boardNo: string
  lengthMm: number
  widthMm: number
  pieces: number
}
export interface PackingPrintLabel {
  id: string
  packNo: string
  ordinal: number
  total: number
  part: number
  parts: number
  areaAndNumber: string
  lines: PackingPrintLine[]
  qrValue: string
}

/** Resolve whole saved packs, even when the table selection contains only one of their rows. */
export function buildPackingPrintLabels(input: PackingPrintInput): PackingPrintLabel[] {
  const selectedIds = input.selectedPacks.map((pack) => pack.id)
  if (!selectedIds.length || selectedIds.some((id) => !id))
    throw new Error('请先保存并勾选需要打印的包')
  const selected = input.packs.filter((pack) => selectedIds.includes(pack.id))
  if (selected.length !== uniq(selectedIds).length)
    throw new Error('所选包已变化，请重新勾选后打印')
  return selected.flatMap((pack) => {
    const lines = pack.items.map((item): PackingPrintLine => {
      const board = input.boards.find((row) => row.id === item.boardId)
      if (
        !board ||
        board.tenantId !== input.order.tenantId ||
        board.workOrderId !== input.order.id ||
        !Number.isInteger(item.pieces) ||
        item.pieces <= 0
      )
        throw new Error(`包 ${pack.packNo} 的板材数据不完整，请刷新后重试`)
      return {
        boardId: board.id,
        area: board.area,
        boardNo: board.boardNo,
        lengthMm: board.lengthMm,
        widthMm: board.widthMm,
        pieces: item.pieces
      }
    })
    if (!lines.length) throw new Error(`包 ${pack.packNo} 没有可打印的板材`)
    const pages = chunk(lines, 8)
    return pages.map((page, index) => ({
      id: `${pack.id}:${index}`,
      packNo: pack.packNo,
      ordinal: input.packs.indexOf(pack) + 1,
      total: input.packs.length,
      part: index + 1,
      parts: pages.length,
      areaAndNumber: uniq(lines.map((line) => `${line.area || '—'}/${line.boardNo || '—'}`)).join(
        '、'
      ),
      lines: page,
      qrValue: JSON.stringify({
        type: 'mes-work-order-pack',
        workOrderId: input.order.id,
        packId: pack.id,
        packNo: pack.packNo
      })
    }))
  })
}
