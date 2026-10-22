import { useSupabase } from '@/hooks/core/useSupabase'
import { fetchAllRangePages } from '@/utils/supabase/pagination'
import { hydrateMesWorkOrderMaterials } from './manufacturing'

export type BoardKind = 'PU_BOARD' | 'ROCK_BOARD'
export type RemainderPolicy = 'separate' | 'merge' | 'manual'
export type PackingStatus = 'unpacked' | 'packed' | 'published'

export interface PackRule {
  id: string
  tenantId: string
  ruleCode: BoardKind
  ruleName: string
  enabled: boolean
  maxPieces: number
  maxStackHeight: number
  boardThicknessMm: number | null
  maxWeight: number | null
  maxLength: number | null
  sameWidth: boolean
  sameArea: boolean
  sameNumber: boolean
  allowMixLength: boolean
  remainderPolicy: RemainderPolicy
  sortPriority: string
  remark: string
  updateTime: string
}

export type PackRuleInput = Omit<PackRule, 'id' | 'updateTime'>

export interface WorkOrderBoard {
  id: string
  tenantId: string
  workOrderId: string
  area: string
  axis: string
  boardNo: string
  lengthMm: number
  widthMm: number
  areaSqm: number
  thicknessMm: number
  unitWeightKg: number | null
  pieces: number
  packedPieces: number
  remark: string
}

export interface WorkOrderPackItem {
  id: string
  boardId: string
  pieces: number
  remark: string
}

export interface WorkOrderPack {
  id: string
  packNo: string
  area: string
  axis: string
  manuallyAdjusted: boolean
  confirmed: boolean
  remark: string
  items: WorkOrderPackItem[]
}

export interface PackDraft {
  id?: string
  packNo: string
  manuallyAdjusted: boolean
  confirmed: boolean
  remark: string
  items: Array<{ boardId: string; pieces: number; remark: string }>
}

export interface WorkOrderPackInboundDetail {
  lineId: string
  packId: string
  packNo: string
  documentId: string
  documentNo: string
  businessDate: string | null
  lineNo: number
  inboundQuantity: number
  returnedQuantity: number
  netQuantity: number
}

const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: true,
  errorMessage: '排包数据加载失败，请重试'
}

export async function fetchPackRules(tenantId?: string | null): Promise<PackRule[]> {
  let query = supabase.from('mes_pack_rule').select('*').order('rule_code')
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data } = await responseHandle<PackRule[]>(() => query, readOptions)
  return data ?? []
}

export async function savePackRule(input: PackRuleInput, id?: string): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mes_save_pack_rule', { p_id: id || null, p_payload: keysToSnakeDeep(input) }),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: false,
      errorMessage: '排包规则保存失败，请检查规则和权限'
    }
  )
}

export async function fetchPackingOrders(tenantId?: string | null): Promise<
  Array<{
    id: string
    tenantId: string
    workOrderNo: string
    materialCodeSnapshot: string
    materialNameSnapshot: string
    materialId: string
    materialDescription: string
    specificationSnapshot: string
    projectNameSnapshot: string
    constructionNo: string
    plannedStartDate: string | null
    orderQuantity: number
    boardThicknessMm: number | null
    packingRuleId: string | null
    status: string
    packingPublishedAt: string | null
    packingStatus: PackingStatus
    boardPieces: number
    packedPieces: number
    updateTime: string
  }>
> {
  type OrderRow = {
    id: string
    tenantId: string
    workOrderNo: string
    materialCodeSnapshot: string
    materialNameSnapshot: string
    materialId: string
    specificationSnapshot: string
    projectNameSnapshot: string
    constructionNo: string
    plannedStartDate: string | null
    orderQuantity: number
    extensionValues: Record<string, unknown>
    packingThicknessFieldKeySnapshot: string | null
    packingRuleId: string | null
    status: string
    packingPublishedAt: string | null
    updateTime: string
    details: Array<{ pieces: number; packedPieces: number }>
  }
  const result = await fetchAllRangePages<OrderRow>(({ from, to }) => {
    let query = supabase
      .from('mes_work_order')
      .select(
        'id,tenant_id,work_order_no,material_id,material_code_snapshot,material_name_snapshot,specification_snapshot,project_name_snapshot,construction_no,planned_start_date,order_quantity,extension_values,packing_thickness_field_key_snapshot,packing_rule_id,status,packing_published_at,update_time,details:mes_work_order_detail(pieces,packed_pieces)'
      )
      .is('deleted_at', null)
      .neq('status', 'closed')
      .eq('packing_enabled_snapshot', true)
      .order('planned_start_date', { ascending: true })
      .range(from, to)
    if (tenantId) query = query.eq('tenant_id', tenantId)
    return responseHandle<OrderRow[]>(() => query, readOptions)
  })
  if (result.error) throw result.error
  return hydrateMesWorkOrderMaterials(
    (result.data ?? []).map(
      ({ details, extensionValues, packingThicknessFieldKeySnapshot, ...order }) => {
        const boardPieces = details.reduce((total, detail) => total + Number(detail.pieces || 0), 0)
        const packedPieces = details.reduce(
          (total, detail) => total + Number(detail.packedPieces || 0),
          0
        )
        const packingStatus: PackingStatus = order.packingPublishedAt
          ? 'published'
          : packedPieces > 0
            ? 'packed'
            : 'unpacked'
        const thickness = Number(extensionValues?.[packingThicknessFieldKeySnapshot ?? ''])
        return {
          ...order,
          boardPieces,
          packedPieces,
          boardThicknessMm: thickness > 0 ? thickness : null,
          packingStatus
        }
      }
    )
  )
}

export async function fetchWorkOrderBoards(workOrderId: string): Promise<WorkOrderBoard[]> {
  const [details, order] = await Promise.all([
    responseHandle<
      Array<{
        id: string
        tenantId: string
        workOrderId: string
        area: string
        axis: string
        number: string
        lengthMm: number
        widthMm: number
        areaSqm: number
        thicknessMm: number
        unitWeightKg: number | null
        pieces: number
        packedPieces: number
        remark: string
      }>
    >(
      () =>
        supabase
          .from('mes_work_order_detail')
          .select('*')
          .eq('work_order_id', workOrderId)
          .order('area')
          .order('number'),
      readOptions
    ),
    responseHandle<{
      extensionValues: Record<string, unknown>
      packingThicknessFieldKeySnapshot: string | null
    }>(
      () =>
        supabase
          .from('mes_work_order')
          .select('extension_values,packing_thickness_field_key_snapshot')
          .eq('id', workOrderId)
          .single(),
      readOptions
    )
  ])
  const orderThickness = Number(
    order.data?.extensionValues?.[order.data.packingThicknessFieldKeySnapshot ?? '']
  )
  return (details.data ?? []).map((row) => ({
    ...row,
    axis: row.number,
    boardNo: row.number,
    thicknessMm: orderThickness > 0 ? orderThickness : row.thicknessMm
  }))
}

export async function savePackingBoardSpec(
  boardId: string,
  axis: string,
  thicknessMm: number,
  unitWeightKg: number | null
): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mes_save_packing_board_spec', {
        p_board_id: boardId,
        p_axis: axis,
        p_thickness_mm: thicknessMm,
        p_unit_weight_kg: unitWeightKg
      }),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: false,
      errorMessage: '包装参数保存失败，请检查板材和排包权限'
    }
  )
}

export async function fetchWorkOrderPacks(workOrderId: string): Promise<WorkOrderPack[]> {
  const { data } = await responseHandle<WorkOrderPack[]>(
    () =>
      supabase
        .from('mes_work_order_pack')
        .select(
          'id,pack_no,area,axis,manually_adjusted,confirmed,remark,items:mes_work_order_pack_item(id,board_id,pieces,remark)'
        )
        .eq('work_order_id', workOrderId)
        .order('pack_no'),
    readOptions
  )
  return data ?? []
}

export async function fetchWorkOrderPackInboundDetails(
  workOrderId: string
): Promise<WorkOrderPackInboundDetail[]> {
  const { data } = await responseHandle<WorkOrderPackInboundDetail[]>(
    () =>
      supabase.rpc('wms_work_order_pack_inbound_secure', {
        p_work_order_id: workOrderId
      }),
    {
      breakReturn: true,
      showErrorMessage: false,
      errorMessage: '排包入库明细加载失败，请重试'
    }
  )
  return data ?? []
}

export async function savePackingPlan(
  workOrderId: string,
  packs: PackDraft[],
  revision: string,
  ruleId: string
): Promise<string> {
  const { data } = await responseHandle<{ revision: string }>(
    () =>
      supabase.rpc('mes_save_packing_plan_v2', {
        p_work_order_id: workOrderId,
        p_revision: revision,
        p_packs: keysToSnakeDeep(packs),
        p_rule_id: ruleId
      }),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: false,
      errorMessage: '排包保存失败，请刷新工单后核对数量与包号'
    }
  )
  if (!data?.revision) throw new Error('排包保存未返回版本，请刷新工单核对')
  return data.revision
}

export async function setPackingPublication(
  workOrderId: string,
  revision: string,
  publish: boolean
): Promise<string> {
  const { data } = await responseHandle<{ revision: string }>(
    () =>
      supabase.rpc('mes_set_packing_publication', {
        p_work_order_id: workOrderId,
        p_revision: revision,
        p_publish: publish
      }),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: false,
      errorMessage: publish ? '排包发布失败，请刷新后重试' : '重排包失败，请刷新后重试'
    }
  )
  if (!data?.revision) throw new Error('排包状态更新未返回版本，请刷新后核对')
  return data.revision
}
