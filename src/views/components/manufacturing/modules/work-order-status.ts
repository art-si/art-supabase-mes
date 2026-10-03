import type { WorkOrderDisplayStatus } from '@mes/api'

export const workOrderStatusCodes: WorkOrderDisplayStatus[] = [
  'CRTD',
  'ABNORMAL',
  'REL',
  'PCNF',
  'CNF',
  'PDLV',
  'DLV',
  'TECO',
  'CLSD'
]

export const workOrderStatusMeta: Record<
  WorkOrderDisplayStatus,
  { label: string; type: 'info' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  CRTD: { label: 'CRTD 创建', type: 'info' },
  ABNORMAL: { label: '异常', type: 'danger' },
  REL: { label: 'REL 下达', type: 'primary' },
  PCNF: { label: 'PCNF 部分报工', type: 'warning' },
  CNF: { label: 'CNF 已报工', type: 'success' },
  PDLV: { label: 'PDLV 部分交货', type: 'primary' },
  DLV: { label: 'DLV 已交货', type: 'success' },
  TECO: { label: 'TECO 结案', type: 'info' },
  CLSD: { label: 'CLSD 关闭', type: 'info' }
}

export const isWorkOrderDisplayStatus = (value: string): value is WorkOrderDisplayStatus =>
  workOrderStatusCodes.some((status) => status === value)
