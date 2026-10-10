import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'

export type MesPmisEquipmentKind = 'inspection' | 'patrol' | 'maintenance'

export interface MesPmisEquipmentTask {
  id: string
  tenantId: string
  taskNo: string
  plannedDate: string
  shiftName: string | null
  status: string
  displayStatus: string
  completedAt: string | null
  dueDate: string | null
  executionSummary: string | null
  planName: string
  equipmentCode: string
  equipmentName: string
  departmentName: string
  responsibleName: string
  workCenterId: string | null
  totalCount: number
}

export interface MesPmisEquipmentTaskQuery {
  kind: MesPmisEquipmentKind
  tenantId?: string | null
  departmentIds?: string[]
  workCenterId?: string
  dateRange?: [string, string] | null
  status?: string
  keyword?: string
  current: number
  size: number
}

const { supabase, responseHandle } = useSupabase()

export async function fetchMesPmisEquipmentTasks(query: MesPmisEquipmentTaskQuery) {
  const { data } = await responseHandle<MesPmisEquipmentTask[]>(
    () =>
      supabase.rpc('mes_list_pmis_equipment_tasks', {
        p_kind: query.kind,
        p_tenant_id: query.tenantId || null,
        p_department_ids: query.departmentIds?.length ? query.departmentIds : null,
        p_work_center_id: query.workCenterId || null,
        p_date_from: query.dateRange?.[0] || null,
        p_date_to: query.dateRange?.[1] || null,
        p_status: query.status || null,
        p_keyword: normalizeNullableText(query.keyword),
        p_limit: query.size,
        p_offset: (query.current - 1) * query.size
      }),
    {
      breakReturn: true,
      showErrorMessage: false,
      errorMessage: 'PMIS 设备任务加载失败，请稍后重试'
    }
  )
  return { data: data ?? [], total: Number(data?.[0]?.totalCount ?? 0) }
}
