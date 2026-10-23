import { computed, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantScopeStore } from '@/store/modules/tenant-scope'
import TreeUtils from '@/utils/tree'
import { getDepartmentsWithWorkCenters } from '@/utils/business/production-scope'
import { fetchOperationTaskScope, type MesProductionScope } from '@mes/api'
import type { ProductionScopeWorkshopOption } from '@/components/business/production-work-center-navigator/index.vue'

const tree = new TreeUtils({ parentKey: 'parentId', deepClone: false })

export function useExecutionScope() {
  const { effectiveTenantId } = storeToRefs(useTenantScopeStore())
  const scope = reactive<
    MesProductionScope & {
      selectedWorkshopId: string
      selectedWorkCenterId: string
      loading: boolean
      error: string
    }
  >({
    departments: [],
    workCenters: [],
    selectedWorkshopId: '',
    selectedWorkCenterId: '',
    loading: false,
    error: ''
  })

  const departmentTree = computed(() => tree.listToTree(scope.departments))
  const departmentPaths = computed(() =>
    tree.getLabelPathIndex(departmentTree.value, (department) => department.name)
  )
  const departmentsWithWorkCenters = computed(() =>
    getDepartmentsWithWorkCenters(scope.departments, scope.workCenters)
  )
  const descendantIds = (id: string) =>
    tree.getDescendants(departmentTree.value, id, true).map((item) => String(item.id))
  const selectedWorkshop = computed(() =>
    scope.departments.find((item) => item.id === scope.selectedWorkshopId)
  )
  const departmentIds = computed(() =>
    selectedWorkshop.value ? descendantIds(selectedWorkshop.value.id) : []
  )
  const workshopOptions = computed<ProductionScopeWorkshopOption[]>(() =>
    scope.departments
      .filter(
        (department) => department.enabled && departmentsWithWorkCenters.value.has(department.id)
      )
      .map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        path: departmentPaths.value.get(department.id) || department.name
      }))
  )
  const visibleCenters = computed(() => {
    if (!selectedWorkshop.value) return scope.workCenters
    return scope.workCenters.filter(
      (center) =>
        center.tenantId === selectedWorkshop.value?.tenantId &&
        departmentIds.value.includes(center.departmentId)
    )
  })
  const selectedCenter = computed(() =>
    scope.workCenters.find((center) => center.id === scope.selectedWorkCenterId)
  )

  let loadVersion = 0
  async function loadScope() {
    const version = ++loadVersion
    scope.loading = true
    scope.error = ''
    try {
      const result = await fetchOperationTaskScope(effectiveTenantId.value)
      if (version !== loadVersion) return
      scope.departments = result.departments
      scope.workCenters = result.workCenters
      if (!scope.departments.some((item) => item.id === scope.selectedWorkshopId)) {
        scope.selectedWorkshopId = ''
      }
      if (!scope.workCenters.some((item) => item.id === scope.selectedWorkCenterId)) {
        scope.selectedWorkCenterId = ''
      }
    } catch {
      if (version === loadVersion) scope.error = '生产范围加载失败，请重试'
    } finally {
      if (version === loadVersion) scope.loading = false
    }
  }
  function selectWorkshop(id: string) {
    scope.selectedWorkshopId = id
    scope.selectedWorkCenterId = ''
  }
  function selectWorkCenter(id: string) {
    scope.selectedWorkCenterId = id
  }

  watch(
    effectiveTenantId,
    () => {
      scope.selectedWorkshopId = ''
      scope.selectedWorkCenterId = ''
      void loadScope()
    },
    { immediate: true }
  )

  return {
    scope,
    effectiveTenantId,
    workshopOptions,
    visibleCenters,
    selectedCenter,
    departmentIds,
    loadScope,
    selectWorkshop,
    selectWorkCenter
  }
}
