<template>
  <ArtPermissionGuard :permission="`${routeName}:View`" :resource-name="title">
    <div class="manufacturing-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="MANUFACTURING EXECUTION"
        :title="title"
        :description="description"
        :icon="icon"
        :tags="workspaceTags"
        :metrics="metrics"
        density="compact"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <div
        class="manufacturing-page__workspace business-workspace-content"
        :class="{ 'is-task-workspace': !isWorkOrder }"
      >
        <ArtWorkspaceSplitter
          primary-size="300px"
          primary-min="256px"
          primary-max="400px"
          :breakpoint="960"
          stacked-primary-size="380px"
          :primary-collapsed="isWorkOrder || productionScope.collapsed"
        >
          <template #primary>
            <ProductionWorkCenterNavigator
              v-if="!isWorkOrder"
              :workshops="workshopOptions"
              :work-centers="workCentersForWorkshop"
              :selected-workshop-id="productionScope.selectedWorkshopId"
              :selected-work-center-id="productionScope.selectedWorkCenterId"
              :loading="productionScope.loading"
              :error="productionScope.error"
              collapsible
              allow-all-workshops
              show-all-work-centers
              select-id="operation-task-workshop-select"
              @refresh="loadProductionScope"
              @collapse="productionScope.collapsed = true"
              @select-workshop="selectWorkshop"
              @select-work-center="selectWorkCenter"
            />
          </template>

          <div class="manufacturing-page__main">
            <div
              v-if="!isWorkOrder && productionScope.collapsed"
              class="manufacturing-page__scope-expand art-card-xs"
            >
              <ArtIconButton
                icon="ri:side-bar-line"
                label="展开生产范围"
                @click="productionScope.collapsed = false"
              />
              <span>展开车间 / 产线</span>
            </div>

            <ArtTableQuery
              :key="routeName"
              ref="tableRef"
              v-model="table.search"
              :api-fn="fetchRows"
              :immediate="false"
              :search-items="searchItems"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              :selection-actions="selectionActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 6, labelWidth: 82, defaultExpanded: !isWorkOrder }"
              :table-props="queryTableProps"
              :focus-scope-selector="isWorkOrder ? undefined : '.manufacturing-page__workspace'"
              focusable
            />
          </div>
        </ArtWorkspaceSplitter>
      </div>

      <component
        :is="workOrderDialogComponent"
        v-if="workOrderDialogComponent"
        ref="workOrderDialogRef"
        @success="refreshAfterSave"
      />
      <component
        :is="annotationDialogComponent"
        v-if="annotationDialogComponent"
        ref="annotationDialogRef"
        @success="refreshAfterSave"
      />
      <component
        :is="snapshotDialogComponent"
        v-if="snapshotDialogComponent"
        ref="snapshotDialogRef"
        @success="handleSnapshotSaved"
      />
      <component :is="printSheetComponent" v-if="printSheetComponent" ref="printSheetRef" />
      <component :is="qrLabelSheetComponent" v-if="qrLabelSheetComponent" ref="qrLabelSheetRef" />
      <component
        :is="dueDateDialogComponent"
        v-if="dueDateDialogComponent"
        ref="dueDateDialogRef"
        @success="handleDueDateSuccess"
      />
      <component
        :is="progressDialogComponent"
        v-if="progressDialogComponent"
        ref="progressDialogRef"
        @success="refreshAfterSave"
      />
      <component
        :is="scheduleDialogComponent"
        v-if="scheduleDialogComponent"
        ref="scheduleDialogRef"
        @success="refreshAfterSave"
      />
      <component
        :is="taskDetailDialogComponent"
        v-if="taskDetailDialogComponent"
        ref="taskDetailDialogRef"
      />
      <component
        :is="taskAnnotationDialogComponent"
        v-if="taskAnnotationDialogComponent"
        ref="taskAnnotationDialogRef"
        @success="refreshAfterSave"
      />
      <component
        :is="taskDueDateDialogComponent"
        v-if="taskDueDateDialogComponent"
        ref="taskDueDateDialogRef"
        @success="handleTaskDueDateSuccess"
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import { ElMessage, ElTag } from 'element-plus'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useLazyComponent } from '@/hooks/core/useLazyComponent'
  import { useTenantScopeAccessPolicy } from '@/hooks/core/useTenantScopeAccessPolicy'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import { useUserStore } from '@/store/modules/user'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ProductionWorkCenterNavigator, {
    type ProductionScopeWorkshopOption
  } from '@/components/business/production-work-center-navigator/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import TreeUtils from '@/utils/tree'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    batchTransitionOperationTasks,
    batchTransitionWorkOrders,
    copyWorkOrders,
    fetchWorkOrderReleaseWarnings,
    fetchMesReferences,
    fetchOperationTaskScope,
    fetchOperationTasks,
    fetchWorkOrders,
    importWorkOrders,
    markWorkOrderAbnormal,
    reloadWorkOrderSnapshot,
    transitionOperationTask,
    transitionWorkOrder,
    type MesOperationTask,
    type MesBatchResult,
    type MesProductionDepartment,
    type MesProductionScopeCenter,
    type MesReferenceOption,
    type MesWorkOrder,
    type MesWorkOrderInput
  } from '@mes/api'
  import type { ScheduleDialogOpenData } from './modules/schedule-dialog.vue'
  import type { WorkOrderAnnotationDialogOpenData } from './modules/work-order-annotation-dialog.vue'
  import type { WorkOrderDialogOpenData } from './modules/work-order-dialog.vue'
  import type { WorkOrderDueDateDialogOpenData } from './modules/work-order-due-date-dialog.vue'
  import type { WorkOrderProgressDialogOpenData } from './modules/work-order-progress-dialog.vue'
  import type {
    WorkOrderSnapshotDialogOpenData,
    WorkOrderSnapshotMode
  } from './modules/work-order-snapshot-dialog.vue'
  import WorkOrderUrgencyLabel from './modules/work-order-urgency-label.vue'
  import WorkOrderStatusTag from './modules/work-order-status-tag.vue'
  import {
    isWorkOrderDisplayStatus,
    workOrderStatusCodes,
    workOrderStatusMeta
  } from './modules/work-order-status'
  import type { TaskDetailDialogOpenData } from './modules/task-detail-dialog.vue'
  import type { TaskAnnotationDialogOpenData } from './modules/task-annotation-dialog.vue'
  import type { TaskDueDateDialogOpenData } from './modules/task-due-date-dialog.vue'

  defineOptions({ name: 'MesManufacturing' })
  const declaredPermissions = [
    'MesWorkOrder:View',
    'MesWorkOrder:Add',
    'MesWorkOrder:Edit',
    'MesWorkOrder:Delete',
    'MesWorkOrder:Import',
    'MesWorkOrder:Export',
    'MesWorkOrder:Print',
    'MesWorkOrder:Annotate',
    'MesWorkOrder:Confirm',
    'MesWorkOrder:MarkAbnormal',
    'MesWorkOrder:Report',
    'MesWorkOrder:Deliver',
    'MesWorkOrder:Close',
    'MesWorkOrder:FinancialClose',
    'MesWorkOrder:Reopen',
    'MesWorkOrder:Restore',
    'MesWorkOrder:Copy',
    'MesWorkOrder:Get',
    'MesWorkOrder:MaintainDueDate',
    'MesWorkOrder:ReloadSnapshot',
    'MesOperationTask:View',
    'MesOperationTask:Export',
    'MesOperationTask:Schedule',
    'MesOperationTask:Close',
    'MesOperationTask:Reopen',
    'MesOperationTask:Delete',
    'MesOperationTask:Annotate',
    'MesOperationTask:MaintainDueDate',
    'WmsIssueRequest:View',
    'WmsIssueRequest:Create'
  ] as const
  void declaredPermissions

  const route = useRoute()
  const router = useRouter()
  const { hasAuth } = useAuth()
  const isWorkOrder = computed(() => route.path.endsWith('/work-order'))
  const routeName = computed(() => (isWorkOrder.value ? 'MesWorkOrder' : 'MesOperationTask'))
  const title = computed(() => (isWorkOrder.value ? '生产工单' : '工序任务'))
  const icon = computed(() => (isWorkOrder.value ? 'ri:file-list-3-line' : 'ri:git-merge-line'))
  const description = computed(() =>
    isWorkOrder.value
      ? '统一创建、下达和跟踪生产工单，保存时集成 BOM 与工艺路线执行基线。'
      : '承接已下达生产工单的工序明细，统一管理排产、执行、质量回填与结案。'
  )
  const emptyDescription = computed(() =>
    isWorkOrder.value
      ? '点击新增工单，建立第一条生产计划。'
      : '下达带有完整工艺路线的工单后，将自动生成工序任务。'
  )
  const tableRef = ref<ArtTableQueryExpose>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { component: workOrderDialogComponent, load: loadWorkOrderDialog } = useLazyComponent(
    () => import('./modules/work-order-dialog.vue')
  )
  const { component: annotationDialogComponent, load: loadAnnotationDialog } = useLazyComponent(
    () => import('./modules/work-order-annotation-dialog.vue')
  )
  const { component: snapshotDialogComponent, load: loadSnapshotDialog } = useLazyComponent(
    () => import('./modules/work-order-snapshot-dialog.vue')
  )
  const { component: printSheetComponent, load: loadPrintSheet } = useLazyComponent(
    () => import('./modules/work-order-print-sheet.vue')
  )
  const { component: qrLabelSheetComponent, load: loadQrLabelSheet } = useLazyComponent(
    () => import('./modules/work-order-qr-label-sheet.vue')
  )
  const { component: dueDateDialogComponent, load: loadDueDateDialog } = useLazyComponent(
    () => import('./modules/work-order-due-date-dialog.vue')
  )
  const { component: progressDialogComponent, load: loadProgressDialog } = useLazyComponent(
    () => import('./modules/work-order-progress-dialog.vue')
  )
  const { component: scheduleDialogComponent, load: loadScheduleDialog } = useLazyComponent(
    () => import('./modules/schedule-dialog.vue')
  )
  const { component: taskDetailDialogComponent, load: loadTaskDetailDialog } = useLazyComponent(
    () => import('./modules/task-detail-dialog.vue')
  )
  const { component: taskAnnotationDialogComponent, load: loadTaskAnnotationDialog } =
    useLazyComponent(() => import('./modules/task-annotation-dialog.vue'))
  const { component: taskDueDateDialogComponent, load: loadTaskDueDateDialog } = useLazyComponent(
    () => import('./modules/task-due-date-dialog.vue')
  )
  const workOrderDialogRef = ref<{ handleOpen: (data: WorkOrderDialogOpenData) => Promise<void> }>()
  const annotationDialogRef = ref<{
    handleOpen: (data: WorkOrderAnnotationDialogOpenData) => Promise<void>
  }>()
  const snapshotDialogRef = ref<{
    handleOpen: (data: WorkOrderSnapshotDialogOpenData) => Promise<void>
  }>()
  const printSheetRef = ref<{ print: (rows: MesWorkOrder[]) => Promise<void> }>()
  const qrLabelSheetRef = ref<{ print: (rows: MesWorkOrder[]) => Promise<void> }>()
  const dueDateDialogRef = ref<{
    handleOpen: (data: WorkOrderDueDateDialogOpenData) => Promise<void>
  }>()
  const progressDialogRef = ref<{
    handleOpen: (data: WorkOrderProgressDialogOpenData) => Promise<void>
  }>()
  const scheduleDialogRef = ref<{ handleOpen: (data: ScheduleDialogOpenData) => Promise<void> }>()
  const taskDetailDialogRef = ref<{
    handleOpen: (data: TaskDetailDialogOpenData) => Promise<void>
  }>()
  const taskAnnotationDialogRef = ref<{
    handleOpen: (data: TaskAnnotationDialogOpenData) => Promise<void>
  }>()
  const taskDueDateDialogRef = ref<{
    handleOpen: (data: TaskDueDateDialogOpenData) => Promise<void>
  }>()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, tenantOptions } = storeToRefs(tenantScopeStore)
  const { isCrossTenantReadOnly } = useTenantScopeAccessPolicy()
  const { confirmAction, confirmDelete, promptReason } = useArtFeedback()
  const batchBusy = ref(false)
  const referenceState = reactive({
    employees: [] as MesReferenceOption[],
    workCenters: [] as MesReferenceOption[]
  })
  const productionScope = reactive({
    departments: [] as MesProductionDepartment[],
    workCenters: [] as MesProductionScopeCenter[],
    selectedWorkshopId: '',
    selectedWorkCenterId: '',
    loading: false,
    error: '',
    collapsed: false
  })
  const productionTree = new TreeUtils({ deepClone: false })
  const overview = reactive({ total: 0, attention: 0, ready: 0 })
  const workspaceTags = computed<BusinessWorkspaceTag[]>(() =>
    isWorkOrder.value
      ? [
          { label: '计划到执行', type: 'primary' },
          { label: '快照留痕', type: 'success' },
          { label: '30 天可恢复', type: 'info' }
        ]
      : [
          { label: '工作中心排产', type: 'primary' },
          { label: '工序级追踪', type: 'success' },
          { label: '状态受控', type: 'info' }
        ]
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前范围',
      value: overview.total,
      description: '符合当前筛选的记录',
      icon: icon.value
    },
    {
      label: isWorkOrder.value ? '待处理' : '待排产',
      value: overview.attention,
      description: isWorkOrder.value ? '待下达与异常工单' : '尚未分配工作中心',
      icon: 'ri:alarm-warning-line',
      tone: overview.attention ? 'warning' : 'success'
    },
    {
      label: isWorkOrder.value ? '已下达' : '已排产',
      value: overview.ready,
      description: '可进入后续生产执行',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const statusOptions = computed(() =>
    isWorkOrder.value
      ? [
          ...workOrderStatusCodes.map((value) => ({
            value,
            label: workOrderStatusMeta[value].label
          })),
          { label: '回收站（30 天内）', value: '__deleted' }
        ]
      : (getDictMap.value.mesOperationTaskScheduleStatus ?? [])
  )
  const statusMeta: Record<
    string,
    { label: string; type: 'info' | 'primary' | 'success' | 'warning' | 'danger' }
  > = {
    pending: { label: '待下达', type: 'info' },
    abnormal: { label: '异常', type: 'danger' },
    confirmed: { label: '已下达', type: 'success' },
    closed: { label: '已结案', type: 'info' },
    unscheduled: { label: '未排程', type: 'warning' },
    scheduled: { label: '已排程', type: 'primary' },
    processing: { label: '加工中', type: 'success' },
    no_schedule: { label: '无需排产', type: 'info' },
    planned: { label: '计划', type: 'info' },
    released: { label: '下达', type: 'primary' },
    started: { label: '开工', type: 'warning' },
    completed: { label: '完工', type: 'success' }
  }
  const table = reactive({
    search: {
      keyword: '',
      status: [] as string[],
      schedulingStatus: [] as string[],
      operationStatus: [] as string[],
      plannedDates: undefined as [string, string] | undefined,
      workOrderStartDates: undefined as [string, string] | undefined,
      includeDeleted: false,
      sortBy: undefined as 'sequenceNo' | 'operationCode' | 'workOrderNo' | 'taskNo' | undefined,
      sortOrder: undefined as 'ascending' | 'descending' | undefined
    }
  })
  const queryTableProps = computed(() => ({
    rowKey: 'id',
    tableLayout: 'fixed' as const,
    emptyText: `暂无${title.value}`,
    emptyDescription: emptyDescription.value,
    onSortChange: handleSortChange
  }))
  const departmentTree = computed(() => productionTree.listToTree(productionScope.departments))
  const selectedWorkshop = computed(() =>
    productionScope.departments.find((item) => item.id === productionScope.selectedWorkshopId)
  )
  const descendantDepartmentIds = (departmentId: string): string[] =>
    productionTree
      .getDescendants(departmentTree.value, departmentId, true)
      .map((item) => String(item.id))
  const departmentPath = (department: MesProductionDepartment): string => {
    const path = productionTree
      .getAncestors(departmentTree.value, department.id)
      .map((item) => String(item.name))
      .join(' / ')
    if (effectiveTenantId.value) return path || department.name
    const tenant = tenantOptions.value.find((item) => item.id === department.tenantId)
    return `${tenant?.tenantName || '当前租户'} / ${path || department.name}`
  }
  const workshopOptions = computed<ProductionScopeWorkshopOption[]>(() =>
    productionScope.departments
      .filter((department) => {
        if (!department.enabled || !department.parentId) return false
        const departmentIds = descendantDepartmentIds(department.id)
        return productionScope.workCenters.some(
          (center) =>
            center.tenantId === department.tenantId && departmentIds.includes(center.departmentId)
        )
      })
      .map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        path: departmentPath(department)
      }))
  )
  const workCentersForWorkshop = computed(() => {
    if (!selectedWorkshop.value) return productionScope.workCenters
    const departmentIds = descendantDepartmentIds(selectedWorkshop.value.id)
    return productionScope.workCenters.filter(
      (center) =>
        center.tenantId === selectedWorkshop.value?.tenantId &&
        departmentIds.includes(center.departmentId)
    )
  })
  const selectedDepartmentIds = computed(() =>
    selectedWorkshop.value ? descendantDepartmentIds(selectedWorkshop.value.id) : []
  )
  const searchItems = computed<SearchFormItem[]>(() => {
    const items: SearchFormItem[] = [
      {
        key: 'keyword',
        label: '关键字',
        type: 'input',
        props: {
          clearable: true,
          placeholder: isWorkOrder.value ? '工单号、物料或销售订单' : '工序编码、名称或内容'
        }
      }
    ]
    if (isWorkOrder.value) {
      items.push({
        key: 'status',
        label: '工单状态',
        type: 'select',
        props: {
          clearable: true,
          multiple: true,
          collapseTags: true,
          collapseTagsTooltip: true,
          options: statusOptions.value,
          placeholder: '全部状态'
        }
      })
      items.push({
        key: 'plannedDates',
        label: '计划结束',
        type: 'daterange',
        props: {
          valueFormat: 'YYYY-MM-DD',
          startPlaceholder: '开始日期',
          endPlaceholder: '结束日期'
        }
      })
    } else {
      items.push({
        key: 'schedulingStatus',
        label: '排产状态',
        type: 'checkboxGroup',
        span: 12,
        props: {
          optionType: 'button',
          options: statusOptions.value,
          onChange: () => {
            tableRef.value?.clearSelection()
            void tableRef.value?.getData()
          }
        }
      })
      items.push({
        key: 'operationStatus',
        label: '工序状态',
        type: 'select',
        props: {
          clearable: true,
          multiple: true,
          collapseTags: true,
          collapseTagsTooltip: true,
          options: getDictMap.value.mesOperationStatus ?? [],
          placeholder: '全部状态'
        }
      })
      items.push({
        key: 'workOrderStartDates',
        label: '工单开工',
        type: 'daterange',
        props: {
          clearable: true,
          valueFormat: 'YYYY-MM-DD',
          startPlaceholder: '开始日期',
          endPlaceholder: '结束日期',
          shortcuts: [
            { text: '今天', value: () => [new Date(), new Date()] },
            {
              text: '昨天',
              value: () => [
                dayjs().subtract(1, 'day').toDate(),
                dayjs().subtract(1, 'day').toDate()
              ]
            },
            {
              text: '明天',
              value: () => [dayjs().add(1, 'day').toDate(), dayjs().add(1, 'day').toDate()]
            }
          ]
        }
      })
    }
    return items
  })

  const taskExportColumns = [
    { key: 'taskNo', title: '任务单号' },
    { key: 'workOrder.workOrderNo', title: '生产工单' },
    { key: 'schedulingStatus', title: '排产状态' },
    { key: 'workOrder.workOrderTypeNameSnapshot', title: '工单类型' },
    { key: 'workOrder.projectNameSnapshot', title: '项目名称' },
    { key: 'workOrder.constructionNo', title: '施工号' },
    { key: 'workOrder.materialCodeSnapshot', title: '产品编码' },
    { key: 'workOrder.materialNameSnapshot', title: '品名' },
    { key: 'workOrder.specificationSnapshot', title: '规格型号' },
    { key: 'sequenceNo', title: '工序序列' },
    { key: 'sequenceType', title: '序列类型' },
    { key: 'operationCode', title: '工序号' },
    { key: 'operationName', title: '工序名称' },
    { key: 'controlCodeSnapshot', title: '工序控制码' },
    { key: 'operationStatus', title: '工序状态' },
    { key: 'plannedQuantity', title: '工序数量' },
    { key: 'operationUnit', title: '工序单位' },
    { key: 'pendingScheduleQuantity', title: '待排产数量' },
    { key: 'scheduledQuantity', title: '已排产数量' },
    { key: 'completedQuantity', title: '完工数量' },
    { key: 'cumulativeCompletedQuantity', title: '累计完工数量' },
    { key: 'qualifiedQuantity', title: '合格数量' },
    { key: 'cumulativeQualifiedQuantity', title: '累计合格数量' },
    { key: 'unqualifiedQuantity', title: '不合格数量' },
    { key: 'cumulativeUnqualifiedQuantity', title: '累计不合格数量' },
    { key: 'scrapQuantity', title: '工废数量' },
    { key: 'cumulativeScrapQuantity', title: '累计工废数量' },
    { key: 'pendingReworkQuantity', title: '待返工数量' },
    { key: 'pendingInspectionQuantity', title: '待检数量' },
    { key: 'createTime', title: '工序创建日期' },
    { key: 'workOrder.plannedStartDate', title: '工单开工日期' },
    { key: 'workOrder.plannedEndDate', title: '工单完工日期' },
    { key: 'requiredStartDate', title: '工序要求开工日期' },
    { key: 'requiredCompletionDate', title: '工序要求完工日期' },
    { key: 'workOrder.source', title: '工单来源' },
    { key: 'workOrder.remark', title: '工单备注' },
    { key: 'workOrder.specialRequirement', title: '客制特殊需求' },
    { key: 'workOrder.trackingNo', title: '计划跟踪号' },
    { key: 'workOrder.followNo', title: '跟单号' },
    { key: 'department.name', title: '生产车间' },
    { key: 'workCenter.name', title: '工作中心' },
    { key: 'workOrder.salesOrderNo', title: '销售单号' },
    { key: 'workOrder.customerCode', title: '客户代码' },
    { key: 'processContent', title: '工艺内容' },
    { key: 'remark', title: '工序备注' },
    { key: 'barcodeValue', title: '工序条码' },
    { key: 'qrCodeValue', title: '工序二维码' },
    { key: 'annotation', title: '工序批注' },
    { key: 'urgency', title: '加急状态' }
  ]

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() =>
    isWorkOrder.value
      ? [
          {
            type: 'add',
            label: '新增工单',
            permission: 'MesWorkOrder:Add',
            onClick: () => openWorkOrder()
          },
          {
            key: 'get',
            label: '获取工单',
            icon: 'ri:download-cloud-2-line',
            permission: 'MesWorkOrder:Get',
            onClick: handleGetWorkOrders
          },
          {
            type: 'import',
            label: '导入',
            permission: 'MesWorkOrder:Import',
            importColumns: [
              { key: 'materialId', title: '产品物料ID', required: true },
              { key: 'orderQuantity', title: '工单数量', required: true },
              { key: 'plannedEndDate', title: '计划结束日期', required: true },
              { key: 'salesOrderNo', title: '销售订单号' }
            ],
            importTransformer: (rows) =>
              rows.map((row) => ({
                ...row,
                tenantId: effectiveTenantId.value || '',
                workOrderNo: '',
                workOrderTypeId: null,
                projectId: null,
                constructionNo: null,
                plannedStartDate: null,
                source: 'manual',
                urgency: 'normal',
                isInitialDocument: false,
                remark: '',
                specialRequirement: null,
                trackingNo: null,
                followNo: null,
                merchandiserId: null,
                salespersonId: null,
                customerCode: null,
                customProcessCode: null,
                specificationQuantity: null,
                salesOrderQuantity: null
              })),
            importApi: async (rows) => {
              if (!effectiveTenantId.value) throw new Error('请先选择目标租户')
              await importWorkOrders(rows as MesWorkOrderInput[])
            }
          },
          {
            type: 'export',
            label: '导出',
            permission: 'MesWorkOrder:Export',
            exportColumns: [
              { key: 'workOrderNo', title: '工单编号' },
              { key: 'materialCodeSnapshot', title: '物料编码' },
              { key: 'materialDescription', title: '物料描述' },
              { key: 'orderQuantity', title: '工单数量' },
              { key: 'plannedEndDate', title: '计划结束' },
              { key: 'status', title: '状态' }
            ]
          }
        ]
      : [
          {
            type: 'export',
            label: '导出',
            permission: 'MesOperationTask:Export',
            exportColumns: taskExportColumns
          }
        ]
  )
  const selectionActions = computed<ArtTableQueryHeaderAction[]>(() => {
    const commonButtonProps = { plain: true, loading: batchBusy.value }
    if (isWorkOrder.value) {
      return [
        {
          key: 'copy',
          label: '复制',
          icon: 'ri:file-copy-2-line',
          permission: 'MesWorkOrder:Copy',
          selectionRequired: true,
          hidden: isCrossTenantReadOnly.value,
          disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
            selectedCount !== 1 || batchBusy.value,
          buttonProps: { type: 'primary', ...commonButtonProps },
          onClick: ({ selectedRows }) => handleCopySelected(selectedRows as MesWorkOrder[])
        },
        {
          key: 'reference',
          label: '批量参考',
          icon: 'ri:file-copy-line',
          permission: 'MesWorkOrder:Copy',
          selectionRequired: true,
          hidden: isCrossTenantReadOnly.value,
          disabled: batchBusy.value,
          confirm: true,
          confirmTitle: '批量参考',
          content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
            `将参照 ${selectedCount} 张工单创建新的待下达工单，是否继续？`,
          buttonProps: commonButtonProps,
          onClick: ({ selectedRows }) =>
            handleBatchCommand('reference', selectedRows as MesWorkOrder[])
        },
        {
          key: 'print',
          label: '批量打印',
          icon: 'ri:printer-line',
          permission: 'MesWorkOrder:Print',
          selectionRequired: true,
          hidden: isCrossTenantReadOnly.value,
          disabled: batchBusy.value,
          buttonProps: commonButtonProps,
          onClick: ({ selectedRows }) => handleBatchCommand('print', selectedRows as MesWorkOrder[])
        },
        {
          key: 'print-qr',
          label: '批量打印二维码标签',
          icon: 'ri:qr-code-line',
          permission: 'MesWorkOrder:Print',
          selectionRequired: true,
          hidden: isCrossTenantReadOnly.value,
          disabled: batchBusy.value,
          buttonProps: commonButtonProps,
          onClick: ({ selectedRows }) =>
            handleBatchCommand('print-qr', selectedRows as MesWorkOrder[])
        },
        {
          key: 'confirm',
          label: '批量下达',
          icon: 'ri:checkbox-circle-line',
          permission: 'MesWorkOrder:Confirm',
          selectionRequired: true,
          hidden: isCrossTenantReadOnly.value,
          disabled: batchBusy.value,
          buttonProps: { type: 'primary', ...commonButtonProps },
          onClick: ({ selectedRows }) =>
            handleBatchCommand('confirm', selectedRows as MesWorkOrder[])
        },
        {
          key: 'due-date',
          label: '交期维护',
          icon: 'ri:calendar-check-line',
          permission: 'MesWorkOrder:MaintainDueDate',
          selectionRequired: true,
          hidden: isCrossTenantReadOnly.value,
          disabled: batchBusy.value,
          buttonProps: commonButtonProps,
          onClick: ({ selectedRows }) => openWorkOrderDueDate(selectedRows as MesWorkOrder[])
        },
        {
          key: 'close',
          label: '批量结案',
          icon: 'ri:archive-line',
          permission: 'MesWorkOrder:Close',
          selectionRequired: true,
          hidden: isCrossTenantReadOnly.value,
          disabled: batchBusy.value,
          confirm: true,
          confirmTitle: '批量结案',
          content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
            `将结案 ${selectedCount} 张工单及其未结案工序任务，是否继续？`,
          buttonProps: commonButtonProps,
          onClick: ({ selectedRows }) => handleBatchCommand('close', selectedRows as MesWorkOrder[])
        },
        {
          key: 'delete',
          type: 'delete',
          label: '批量删除',
          permission: 'MesWorkOrder:Delete',
          hidden: isCrossTenantReadOnly.value,
          disabled: batchBusy.value,
          content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
            `确定删除选中的 ${selectedCount} 张工单吗？30 天内可恢复。`,
          buttonProps: { ...commonButtonProps, type: 'danger' },
          onClick: ({ selectedRows }) =>
            handleBatchCommand('delete', selectedRows as MesWorkOrder[])
        }
      ]
    }
    return [
      {
        key: 'due-date',
        label: '批量完工日期',
        icon: 'ri:calendar-check-line',
        permission: 'MesOperationTask:MaintainDueDate',
        selectionRequired: true,
        hidden: isCrossTenantReadOnly.value,
        disabled: batchBusy.value,
        buttonProps: { type: 'primary', ...commonButtonProps },
        onClick: ({ selectedRows }) => openTaskDueDate(selectedRows as MesOperationTask[], true)
      },
      {
        key: 'close',
        label: '批量结案',
        icon: 'ri:archive-line',
        permission: 'MesOperationTask:Close',
        selectionRequired: true,
        hidden: isCrossTenantReadOnly.value,
        disabled: batchBusy.value,
        confirm: true,
        confirmTitle: '批量结案',
        content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
          `确定结案选中的 ${selectedCount} 条工序任务吗？`,
        buttonProps: commonButtonProps,
        onClick: ({ selectedRows }) => handleTaskBatch(selectedRows as MesOperationTask[], 'close')
      },
      {
        key: 'delete',
        type: 'delete',
        label: '批量删除',
        permission: 'MesOperationTask:Delete',
        hidden: isCrossTenantReadOnly.value,
        disabled: batchBusy.value,
        content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
          `确定删除选中的 ${selectedCount} 条工序任务吗？`,
        buttonProps: { ...commonButtonProps, type: 'danger' },
        onClick: ({ selectedRows }) => handleTaskBatch(selectedRows as MesOperationTask[], 'delete')
      }
    ]
  })
  const statusTag = (status: string, explicitDictCode?: string) => {
    if (isWorkOrder.value && isWorkOrderDisplayStatus(status)) {
      return <WorkOrderStatusTag status={status} />
    }
    const meta = statusMeta[status] || { label: status, type: 'info' as const }
    const dictCode =
      explicitDictCode || (isWorkOrder.value ? 'mesWorkOrderStatus' : 'mesOperationTaskStatus')
    const label =
      getDictMap.value[dictCode]?.find((item) => item.value === status)?.label || meta.label
    return (
      <ElTag type={meta.type} effect="light">
        {label}
      </ElTag>
    )
  }
  const workOrderColumns = (): ColumnOption<MesWorkOrder>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 70 },
    {
      prop: 'workOrderNo',
      label: '工单编号',
      minWidth: 156,
      fixed: 'left',
      link: { permission: 'MesWorkOrder:View', onClick: (row) => openWorkOrder(row, true) },
      showOverflowTooltip: true
    },
    {
      prop: 'status',
      label: '工单状态',
      width: 100,
      align: 'center',
      formatter: (row) => statusTag(row.orderStatus)
    },
    {
      prop: 'workOrderTypeNameSnapshot',
      label: '工单类型',
      minWidth: 138,
      formatter: (row) => (
        <span class="inline-flex max-w-full min-w-0 items-center gap-1.5">
          <span class="min-w-0 truncate">{row.workOrderTypeNameSnapshot || '未分类'}</span>
          <WorkOrderUrgencyLabel urgency={row.urgency} showText={false} />
        </span>
      )
    },
    { prop: 'materialCodeSnapshot', label: '物料编码', minWidth: 140, showOverflowTooltip: true },
    { prop: 'materialDescription', label: '物料描述', minWidth: 220, showOverflowTooltip: true },
    { prop: 'specificationSnapshot', label: '规格型号', minWidth: 140, showOverflowTooltip: true },
    { prop: 'drawingNoSnapshot', label: '图号', minWidth: 130, showOverflowTooltip: true },
    {
      prop: 'projectNameSnapshot',
      label: '项目名称',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.projectNameSnapshot || '—'
    },
    {
      prop: 'constructionNo',
      label: '施工号',
      minWidth: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.constructionNo || '—'
    },
    {
      prop: 'plannerNameSnapshot',
      label: '计划员',
      minWidth: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.plannerNameSnapshot || '—'
    },
    {
      prop: 'dispatcherNameSnapshot',
      label: '调度员',
      minWidth: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.dispatcherNameSnapshot || '—'
    },
    {
      prop: 'inboundWarehouseNameSnapshot',
      label: '入库仓库',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.inboundWarehouseNameSnapshot || '—'
    },
    {
      prop: 'orderQuantity',
      label: '工单数量',
      width: 112,
      align: 'right',
      formatter: (row) => `${Number(row.orderQuantity).toFixed(2)} ${row.unitSnapshot || ''}`
    },
    { prop: 'plannedEndDate', label: '计划结束', width: 116 },
    { prop: 'printCount', label: '打印次数', width: 96, align: 'right' },
    {
      prop: 'urgency',
      label: '紧急程度',
      width: 96,
      align: 'center',
      formatter: (row) => <WorkOrderUrgencyLabel urgency={row.urgency} />
    },
    {
      prop: 'snapshots',
      label: '生产资料',
      width: 344,
      align: 'center',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="MesWorkOrder:View"
            type="view"
            icon="ri:organization-chart"
            label="BOM"
            showLabel
            onClick={() => openSnapshot(row, 'bom')}
          />
          <ArtButtonTable
            permission="MesWorkOrder:View"
            type="view"
            icon="ri:git-branch-line"
            label="工艺路线"
            showLabel
            onClick={() => openSnapshot(row, 'route')}
          />
          {!isCrossTenantReadOnly.value &&
            !row.confirmedAt &&
            ['pending', 'abnormal'].includes(row.status) && (
              <ArtButtonTable
                permission="MesWorkOrder:ReloadSnapshot"
                type="sign"
                icon="ri:refresh-line"
                label="重读 BOM/工艺"
                showLabel
                onClick={() => void handleReloadSnapshot(row)}
              />
            )}
        </BusinessTableRowActions>
      )
    },
    {
      prop: 'statusReason',
      label: '状态说明',
      minWidth: 190,
      showOverflowTooltip: true,
      formatter: (row) => row.statusReason || '—'
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => dayjs(row.updateTime).format('YYYY-MM-DD HH:mm')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 216,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="view"
            permission="MesWorkOrder:View"
            onClick={() => openWorkOrder(row, true)}
          />
          {!row.deletedAt && !row.confirmedAt && ['pending', 'abnormal'].includes(row.status) && (
            <ArtButtonTable
              type="edit"
              permission="MesWorkOrder:Edit"
              onClick={() => openWorkOrder(row)}
            />
          )}
          <ArtButtonMore
            list={workOrderMore(row)}
            onClick={(item) => handleWorkOrderAction(row, String(item.key))}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const taskQuantity = (row: MesOperationTask, key: keyof MesOperationTask) =>
    `${Number(row[key] ?? 0)}${row.operationUnit ? ` ${row.operationUnit}` : ''}`
  const taskColumns = (): ColumnOption<MesOperationTask>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'taskNo',
      label: '任务单号',
      minWidth: 164,
      fixed: 'left',
      link: { permission: 'MesOperationTask:View', onClick: openTaskDetail },
      sortable: 'custom',
      showOverflowTooltip: true
    },
    {
      prop: 'workOrderNo',
      label: '生产工单',
      minWidth: 156,
      sortable: 'custom',
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.workOrderNo || '—'
    },
    {
      prop: 'schedulingStatus',
      label: '排产状态',
      width: 104,
      align: 'center',
      formatter: (row) => statusTag(row.schedulingStatus, 'mesOperationTaskScheduleStatus')
    },
    {
      prop: 'workOrderType',
      label: '工单类型',
      minWidth: 132,
      showOverflowTooltip: true,
      formatter: (row) => (
        <span class="inline-flex max-w-full min-w-0 items-center gap-1.5">
          <span class="min-w-0 truncate">{row.workOrder?.workOrderTypeNameSnapshot || '—'}</span>
          <WorkOrderUrgencyLabel urgency={row.workOrder?.urgency || row.urgency} showText={false} />
        </span>
      )
    },
    {
      prop: 'projectName',
      label: '项目名称',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.projectNameSnapshot || '—'
    },
    {
      prop: 'constructionNo',
      label: '施工号',
      minWidth: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.constructionNo || '—'
    },
    {
      prop: 'materialCode',
      label: '产品编码',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.materialCodeSnapshot || '—'
    },
    {
      prop: 'materialName',
      label: '品名 / 规格型号',
      minWidth: 210,
      showOverflowTooltip: true,
      formatter: (row) =>
        [row.workOrder?.materialNameSnapshot, row.workOrder?.specificationSnapshot]
          .filter(Boolean)
          .join(' · ') || '—'
    },
    {
      prop: 'sequenceNo',
      label: '工序序列',
      width: 112,
      align: 'right',
      sortable: 'custom'
    },
    {
      prop: 'sequenceType',
      label: '序列类型',
      width: 108,
      formatter: (row) => statusTag(row.sequenceType, 'mdmProcessRouteSequenceType')
    },
    {
      prop: 'operationCode',
      label: '工序号',
      minWidth: 112,
      sortable: 'custom',
      showOverflowTooltip: true
    },
    { prop: 'operationName', label: '工序名称', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'controlCodeSnapshot',
      label: '工序控制码',
      minWidth: 130,
      showOverflowTooltip: true,
      formatter: (row) =>
        [row.controlCodeSnapshot, row.controlCodeNameSnapshot].filter(Boolean).join(' · ') || '—'
    },
    {
      prop: 'operationStatus',
      label: '工序状态',
      width: 104,
      align: 'center',
      formatter: (row) => statusTag(row.operationStatus, 'mesOperationStatus')
    },
    {
      prop: 'urgency',
      label: '加急状态',
      width: 96,
      align: 'center',
      formatter: (row) => <WorkOrderUrgencyLabel urgency={row.urgency} />
    },
    {
      prop: 'plannedQuantity',
      label: '工序数量',
      minWidth: 116,
      align: 'right',
      formatter: (row) => taskQuantity(row, 'plannedQuantity')
    },
    { prop: 'operationUnit', label: '工序单位', width: 92 },
    {
      prop: 'pendingScheduleQuantity',
      label: '待排产数量',
      minWidth: 118,
      align: 'right',
      formatter: (row) => taskQuantity(row, 'pendingScheduleQuantity')
    },
    {
      prop: 'scheduledQuantity',
      label: '已排产数量',
      minWidth: 118,
      align: 'right',
      formatter: (row) => taskQuantity(row, 'scheduledQuantity')
    },
    ...(
      [
        ['completedQuantity', '完工数量'],
        ['cumulativeCompletedQuantity', '累计完工数量'],
        ['qualifiedQuantity', '合格数量'],
        ['cumulativeQualifiedQuantity', '累计合格数量'],
        ['unqualifiedQuantity', '不合格数量'],
        ['cumulativeUnqualifiedQuantity', '累计不合格数量'],
        ['scrapQuantity', '工废数量'],
        ['cumulativeScrapQuantity', '累计工废数量'],
        ['pendingReworkQuantity', '待返工数量'],
        ['pendingInspectionQuantity', '待检数量']
      ] as const
    ).map(([prop, label]) => ({
      prop,
      label,
      minWidth: label.startsWith('累计') ? 128 : 112,
      align: 'right' as const,
      formatter: (row: MesOperationTask) => taskQuantity(row, prop)
    })),
    {
      prop: 'createTime',
      label: '工序创建日期',
      width: 164,
      formatter: (row) => dayjs(row.createTime).format('YYYY-MM-DD HH:mm')
    },
    {
      prop: 'workOrderStartDate',
      label: '工单开工日期',
      width: 120,
      formatter: (row) => row.workOrder?.plannedStartDate || '—'
    },
    {
      prop: 'workOrderEndDate',
      label: '工单完工日期',
      width: 120,
      formatter: (row) => row.workOrder?.plannedEndDate || '—'
    },
    { prop: 'requiredStartDate', label: '工序要求开工日期', width: 140 },
    { prop: 'requiredCompletionDate', label: '工序要求完工日期', width: 140 },
    {
      prop: 'source',
      label: '工单来源',
      width: 108,
      formatter: (row) => statusTag(row.workOrder?.source || '', 'mesWorkOrderSource')
    },
    {
      prop: 'workOrderRemark',
      label: '工单备注',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.remark || '—'
    },
    {
      prop: 'specialRequirement',
      label: '客制特殊需求',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.specialRequirement || '—'
    },
    {
      prop: 'trackingNo',
      label: '计划跟踪号',
      minWidth: 128,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.trackingNo || '—'
    },
    {
      prop: 'followNo',
      label: '跟单号',
      minWidth: 116,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.followNo || '—'
    },
    {
      prop: 'department',
      label: '生产车间',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.department?.name || '—'
    },
    {
      prop: 'workCenter',
      label: '工作中心',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.workCenter?.name || '待排产'
    },
    {
      prop: 'salesOrderNo',
      label: '销售单号',
      minWidth: 128,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.salesOrderNo || '—'
    },
    {
      prop: 'customerCode',
      label: '客户代码',
      minWidth: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.customerCode || '—'
    },
    { prop: 'processContent', label: '工艺内容', minWidth: 180, showOverflowTooltip: true },
    { prop: 'remark', label: '工序备注', minWidth: 160, showOverflowTooltip: true },
    { prop: 'annotation', label: '工序批注', minWidth: 180, showOverflowTooltip: true },
    { prop: 'barcodeValue', label: '工序条码', minWidth: 164, showOverflowTooltip: true },
    { prop: 'qrCodeValue', label: '工序二维码', minWidth: 164, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 216,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="view"
            permission="MesOperationTask:View"
            onClick={() => openTaskDetail(row)}
          />
          {!row.deletedAt && ['pending', 'scheduled'].includes(row.schedulingStatus) && (
            <ArtButtonTable
              type="edit"
              label="排产"
              permission="MesOperationTask:Schedule"
              onClick={() => openSchedule(row)}
            />
          )}
          <ArtButtonMore
            list={taskMore(row)}
            onClick={(item) => handleTaskAction(row, String(item.key))}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const columnsFactory = () => (isWorkOrder.value ? workOrderColumns() : taskColumns())

  function workOrderMore(row: MesWorkOrder) {
    if (row.deletedAt)
      return [
        {
          key: 'restore',
          label: '恢复',
          icon: 'ri:arrow-go-back-line',
          auth: 'MesWorkOrder:Restore'
        }
      ]
    return [
      {
        key: 'copy',
        label: '复制',
        icon: 'ri:file-copy-2-line',
        auth: 'MesWorkOrder:Copy'
      },
      { key: 'print', label: '打印', icon: 'ri:printer-line', auth: 'MesWorkOrder:Print' },
      { key: 'print-qr', label: '二维码标签', icon: 'ri:qr-code-line', auth: 'MesWorkOrder:Print' },
      {
        key: 'annotate',
        label: '工单批注',
        icon: 'ri:sticky-note-add-line',
        auth: 'MesWorkOrder:Annotate'
      },
      ...(['pending', 'abnormal'].includes(row.status)
        ? [
            {
              key: 'confirm',
              label: '下达',
              icon: 'ri:checkbox-circle-line',
              auth: 'MesWorkOrder:Confirm'
            }
          ]
        : []),
      ...(row.status === 'confirmed'
        ? [
            ...(hasAuth('WmsIssueRequest:View') && hasAuth('WmsIssueRequest:Create')
              ? [
                  {
                    key: 'issue-request',
                    label: '申请领料',
                    icon: 'ri:logout-box-r-line',
                    auth: 'WmsIssueRequest:Create'
                  }
                ]
              : []),
            {
              key: 'abnormal',
              label: '标记异常',
              icon: 'ri:error-warning-line',
              auth: 'MesWorkOrder:MarkAbnormal'
            },
            ...(Number(row.completedQuantity) < Number(row.orderQuantity)
              ? [
                  {
                    key: 'report',
                    label: '报工',
                    icon: 'ri:checkbox-multiple-line',
                    auth: 'MesWorkOrder:Report'
                  }
                ]
              : []),
            ...(Number(row.warehousedQuantity) < Number(row.completedQuantity) &&
            hasAuth('WmsStockOperation:View') &&
            hasAuth('WmsStockOperation:Receive')
              ? [
                  {
                    key: 'deliver',
                    label: '生产入库',
                    icon: 'ri:inbox-archive-line',
                    auth: 'MesWorkOrder:Deliver'
                  }
                ]
              : []),
            ...(row.orderStatus === 'DLV'
              ? [
                  {
                    key: 'close',
                    label: '结案',
                    icon: 'ri:archive-line',
                    auth: 'MesWorkOrder:Close'
                  }
                ]
              : [])
          ]
        : []),
      ...(row.status === 'closed' && row.orderStatus !== 'CLSD'
        ? [
            {
              key: 'reopen',
              label: '撤销结案',
              icon: 'ri:arrow-go-back-line',
              auth: 'MesWorkOrder:Reopen'
            },
            {
              key: 'financial_close',
              label: '财务关闭',
              icon: 'ri:lock-line',
              auth: 'MesWorkOrder:FinancialClose'
            }
          ]
        : []),
      ...(row.orderStatus === 'CLSD'
        ? []
        : [
            {
              key: 'delete',
              label: '删除',
              icon: 'ri:delete-bin-6-line',
              color: 'var(--el-color-danger)',
              auth: 'MesWorkOrder:Delete'
            }
          ])
    ]
  }
  function taskMore(row: MesOperationTask) {
    if (row.deletedAt) return []
    return [
      {
        key: 'annotate',
        label: '工序批注',
        icon: 'ri:sticky-note-add-line',
        auth: 'MesOperationTask:Annotate'
      },
      ...(row.operationStatus !== 'closed'
        ? [
            {
              key: 'due-date',
              label: '要求完工日期',
              icon: 'ri:calendar-check-line',
              auth: 'MesOperationTask:MaintainDueDate'
            }
          ]
        : []),
      ...(!['started', 'closed'].includes(row.operationStatus)
        ? [
            {
              key: 'close',
              label: '结案',
              icon: 'ri:archive-line',
              auth: 'MesOperationTask:Close'
            }
          ]
        : []),
      ...(row.operationStatus === 'closed'
        ? [
            {
              key: 'reopen',
              label: '重新打开',
              icon: 'ri:arrow-go-back-line',
              auth: 'MesOperationTask:Reopen'
            }
          ]
        : []),
      {
        key: 'delete',
        label: '删除',
        icon: 'ri:delete-bin-6-line',
        color: 'var(--el-color-danger)',
        auth: 'MesOperationTask:Delete'
      }
    ]
  }
  async function fetchRows(
    params: typeof table.search & { current: number; size: number },
    options?: { signal?: AbortSignal }
  ) {
    const result = isWorkOrder.value
      ? await fetchWorkOrders({ ...params, tenantId: effectiveTenantId.value }, options)
      : await fetchOperationTasks(
          {
            ...params,
            tenantId: effectiveTenantId.value,
            workCenterId: productionScope.selectedWorkCenterId || undefined,
            departmentIds:
              !productionScope.selectedWorkCenterId && selectedWorkshop.value
                ? selectedDepartmentIds.value
                : undefined
          },
          options
        )
    overview.total = result.total
    overview.attention = result.data.filter((row) =>
      isWorkOrder.value
        ? ['pending', 'abnormal'].includes((row as MesWorkOrder).status)
        : (row as MesOperationTask).schedulingStatus === 'pending'
    ).length
    overview.ready = result.data.filter((row) =>
      isWorkOrder.value
        ? (row as MesWorkOrder).status === 'confirmed'
        : ['scheduled', 'no_schedule'].includes((row as MesOperationTask).schedulingStatus)
    ).length
    return { records: result.data, total: result.total }
  }
  function handleSortChange({
    prop,
    order
  }: {
    prop: string
    order: 'ascending' | 'descending' | null
  }): void {
    if (isWorkOrder.value) return
    const sortableFields = new Set(['sequenceNo', 'operationCode', 'workOrderNo', 'taskNo'])
    table.search.sortBy =
      order && sortableFields.has(prop) ? (prop as typeof table.search.sortBy) : undefined
    table.search.sortOrder = order || undefined
    void tableRef.value?.getData()
  }
  function tenantChoices() {
    return tenantOptions.value.map((tenant) => ({
      label: `${tenant.tenantName || tenant.tenantCode}（${tenant.tenantCode}）`,
      value: tenant.id
    }))
  }
  async function openWorkOrder(row?: MesWorkOrder, readonly = false): Promise<void> {
    await loadWorkOrderDialog()
    await workOrderDialogRef.value?.handleOpen({
      tenantId: row?.tenantId || effectiveTenantId.value || '',
      tenantOptions: tenantChoices(),
      row,
      readonly
    })
  }
  async function openSchedule(row: MesOperationTask): Promise<void> {
    await loadScheduleDialog()
    await scheduleDialogRef.value?.handleOpen({ row, workCenters: referenceState.workCenters })
  }
  async function openTaskDetail(row: MesOperationTask): Promise<void> {
    await loadTaskDetailDialog()
    await taskDetailDialogRef.value?.handleOpen({
      row,
      workCenters: referenceState.workCenters
    })
  }
  async function openTaskAnnotation(row: MesOperationTask): Promise<void> {
    await loadTaskAnnotationDialog()
    await taskAnnotationDialogRef.value?.handleOpen({ row })
  }
  let taskDueDateFromSelection = false
  async function openTaskDueDate(rows: MesOperationTask[], fromSelection = false): Promise<void> {
    taskDueDateFromSelection = fromSelection
    await loadTaskDueDateDialog()
    await taskDueDateDialogRef.value?.handleOpen({ rows })
  }
  async function openWorkOrderDueDate(rows: MesWorkOrder[]): Promise<void> {
    dueDateClearSelection = () => tableRef.value?.clearSelection()
    const firstDate = rows[0]?.plannedEndDate
    const sharedDate = rows.every((row) => row.plannedEndDate === firstDate) ? firstDate : undefined
    await loadDueDateDialog()
    await dueDateDialogRef.value?.handleOpen({
      ids: rows.map((row) => row.id),
      initialDate: sharedDate
    })
  }
  async function openSnapshot(row: MesWorkOrder, mode: WorkOrderSnapshotMode): Promise<void> {
    await loadSnapshotDialog()
    await snapshotDialogRef.value?.handleOpen({
      row,
      mode,
      canEdit:
        !isCrossTenantReadOnly.value &&
        !row.confirmedAt &&
        ['pending', 'abnormal'].includes(row.status)
    })
  }

  function handleSnapshotSaved(): void {
    void tableRef.value?.getData()
  }
  async function handleGetWorkOrders(): Promise<void> {
    await tableRef.value?.getData()
    ElMessage.success('已获取当前范围的最新生产工单')
  }
  function notifyBatchResult(result: MesBatchResult, actionLabel: string, unit = '张工单'): void {
    const successCount = result.successIds.length
    const failureCount = result.failures.length
    if (!failureCount) {
      ElMessage.success(`${actionLabel}完成，共处理 ${successCount} ${unit}`)
      return
    }
    const firstFailure = result.failures[0]?.message || '部分工单不满足当前操作条件'
    const message = `${actionLabel}完成：成功 ${successCount} 张，失败 ${failureCount} 张。${firstFailure}`
    if (successCount) ElMessage.warning(message)
    else ElMessage.error(message)
  }
  async function confirmRelease(rows: MesWorkOrder[]): Promise<boolean> {
    try {
      const warnings = await fetchWorkOrderReleaseWarnings(rows.map((row) => row.id))
      const lines = warnings.flatMap((item) =>
        item.warnings.map((warning) => `${item.workOrderNo}：${warning}`)
      )
      const summary = lines.length ? (
        <div>
          <p>发现 {warnings.length} 张工单存在提醒：</p>
          <ul style={{ maxHeight: '35vh', overflowY: 'auto', paddingLeft: '1.25rem' }}>
            {lines.slice(0, 6).map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
          {lines.length > 6 && <p>另有 {lines.length - 6} 条提醒。</p>}
          <p>缺料与空施工号不会阻止下达，是否继续？</p>
        </div>
      ) : (
        `将下达 ${rows.length} 张工单，并生成对应工序任务，是否继续？`
      )
      await confirmAction(summary, rows.length > 1 ? '批量下达' : '下达工单', {
        confirmButtonText: rows.length > 1 ? '批量下达' : '下达',
        type: lines.length ? 'warning' : 'info'
      })
      return true
    } catch {
      return false
    }
  }
  async function printWorkOrders(rows: MesWorkOrder[]): Promise<void> {
    const result = await batchTransitionWorkOrders(
      rows.map((row) => row.id),
      'print'
    )
    notifyBatchResult(result, '批量打印')
    if (!result.successIds.length) return
    const printableRows = rows.filter((row) => result.successIds.includes(row.id))
    await loadPrintSheet()
    await printSheetRef.value?.print(printableRows)
  }
  async function printWorkOrderQrLabels(rows: MesWorkOrder[]): Promise<void> {
    const result = await batchTransitionWorkOrders(
      rows.map((row) => row.id),
      'print'
    )
    notifyBatchResult(result, '二维码标签打印')
    if (!result.successIds.length) return
    await loadQrLabelSheet()
    await qrLabelSheetRef.value?.print(rows.filter((row) => result.successIds.includes(row.id)))
  }
  async function handleReloadSnapshot(row: MesWorkOrder): Promise<void> {
    await confirmAction(
      `将使用当前最新版本覆盖工单“${row.workOrderNo}”的 BOM 与工艺路线快照。仅待下达或异常工单可重读，工单下达后将保持执行基线。是否继续？`,
      '重读 BOM/工艺',
      { confirmButtonText: '确认重读', type: 'warning' }
    )
    await reloadWorkOrderSnapshot(row.id)
    await tableRef.value?.refreshUpdate()
  }
  async function handleCopySelected(rows: MesWorkOrder[]): Promise<void> {
    if (rows.length !== 1) return
    batchBusy.value = true
    try {
      const result = await copyWorkOrders([rows[0]!.id])
      notifyBatchResult(result, '复制')
      if (result.successIds.length) {
        tableRef.value?.clearSelection()
        await tableRef.value?.refreshCreate()
      }
    } finally {
      batchBusy.value = false
    }
  }
  let dueDateClearSelection: (() => void) | undefined
  async function handleBatchCommand(command: string, rows: MesWorkOrder[]): Promise<void> {
    if (!rows.length) return
    batchBusy.value = true
    try {
      if (command === 'print') {
        await printWorkOrders(rows)
      } else if (command === 'print-qr') {
        await printWorkOrderQrLabels(rows)
      } else {
        if (command === 'confirm' && !(await confirmRelease(rows))) return
        const result =
          command === 'reference'
            ? await copyWorkOrders(rows.map((row) => row.id))
            : await batchTransitionWorkOrders(
                rows.map((row) => row.id),
                command
              )
        notifyBatchResult(
          result,
          {
            reference: '批量参考',
            confirm: '批量下达',
            close: '批量结案',
            delete: '批量删除'
          }[command] || '批量操作'
        )
      }
      tableRef.value?.clearSelection()
      if (command === 'reference') await tableRef.value?.refreshCreate()
      else if (command === 'delete') await tableRef.value?.refreshRemove()
      else await tableRef.value?.refreshData()
    } finally {
      batchBusy.value = false
    }
  }
  async function handleDueDateSuccess(result: MesBatchResult): Promise<void> {
    notifyBatchResult(result, '交期维护')
    if (result.successIds.length) {
      dueDateClearSelection?.()
      await tableRef.value?.refreshUpdate()
    }
    dueDateClearSelection = undefined
  }
  async function handleTaskDueDateSuccess(result: MesBatchResult): Promise<void> {
    notifyBatchResult(result, '要求完工日期维护', '条任务')
    if (result.successIds.length) {
      if (taskDueDateFromSelection) tableRef.value?.clearSelection()
      await tableRef.value?.refreshUpdate()
    }
    taskDueDateFromSelection = false
  }
  async function handleTaskBatch(
    rows: MesOperationTask[],
    action: 'close' | 'delete'
  ): Promise<void> {
    const title = action === 'close' ? '批量结案' : '批量删除'
    batchBusy.value = true
    try {
      const result = await batchTransitionOperationTasks(
        rows.map((row) => row.id),
        action
      )
      notifyBatchResult(result, title, '条任务')
      tableRef.value?.clearSelection()
      if (action === 'delete') await tableRef.value?.refreshRemove()
      else await tableRef.value?.refreshData()
    } finally {
      batchBusy.value = false
    }
  }
  async function handleWorkOrderAction(row: MesWorkOrder, action: string) {
    if (action === 'issue-request') {
      await router.push({
        path: '/wms/receipt-issue/issue-request',
        query: { workOrderId: row.id }
      })
      return
    }
    if (action === 'financial_close') {
      await confirmAction(`确认工单“${row.workOrderNo}”已完成财务结算并永久关闭吗？`, '财务关闭', {
        confirmButtonText: '确认财务关闭'
      })
    }
    if (action === 'abnormal') {
      const reason = await promptReason(
        `将工单“${row.workOrderNo}”标记为异常，请填写原因。`,
        '工单异常'
      )
      await markWorkOrderAbnormal(row.id, reason)
      await tableRef.value?.refreshData()
      return
    }
    if (action === 'deliver') {
      await router.push({
        path: '/wms/receipt-issue/stock-operation',
        query: {
          movementType: 'production_in',
          workOrderId: row.id,
          ...(row.inboundWarehouseId ? { warehouseId: row.inboundWarehouseId } : {})
        }
      })
      return
    }
    if (action === 'report') {
      await loadProgressDialog()
      await progressDialogRef.value?.handleOpen({ row })
      return
    }
    if (action === 'annotate') {
      await loadAnnotationDialog()
      await annotationDialogRef.value?.handleOpen({ row })
      return
    }
    if (action === 'copy') {
      const result = await copyWorkOrders([row.id])
      notifyBatchResult(result, '复制')
      if (result.successIds.length) await tableRef.value?.refreshCreate()
      return
    }
    if (action === 'print') {
      await printWorkOrders([row])
      await tableRef.value?.refreshData()
      return
    }
    if (action === 'print-qr') {
      await printWorkOrderQrLabels([row])
      await tableRef.value?.refreshData()
      return
    }
    if (action === 'delete')
      await confirmDelete(`确定删除工单“${row.workOrderNo}”吗？30 天内可恢复。`)
    if (action === 'confirm' && !(await confirmRelease([row]))) return
    await transitionWorkOrder(row.id, action)
    await tableRef.value?.refreshData()
  }
  async function handleTaskAction(row: MesOperationTask, action: string) {
    if (action === 'annotate') {
      await openTaskAnnotation(row)
      return
    }
    if (action === 'due-date') {
      await openTaskDueDate([row])
      return
    }
    if (action === 'delete') await confirmDelete(`确定删除工序任务“${row.operationName}”吗？`)
    if (action === 'close')
      await confirmAction(`确定将工序任务“${row.operationName}”结案吗？`, '工序任务结案', {
        confirmButtonText: '确认结案'
      })
    await transitionOperationTask(row.id, action)
    await tableRef.value?.refreshData()
  }
  async function refreshAfterSave() {
    await tableRef.value?.refreshData()
  }
  function selectWorkshop(id: string): void {
    productionScope.selectedWorkshopId = id
    productionScope.selectedWorkCenterId = ''
    tableRef.value?.clearSelection()
    void tableRef.value?.getData()
  }
  function selectWorkCenter(id: string): void {
    productionScope.selectedWorkCenterId = id
    tableRef.value?.clearSelection()
    void tableRef.value?.getData()
  }
  let productionScopeRequestId = 0
  async function loadProductionScope(refreshTable = true): Promise<void> {
    if (isWorkOrder.value) return
    const request = ++productionScopeRequestId
    productionScope.loading = true
    productionScope.error = ''
    try {
      const result = await fetchOperationTaskScope(effectiveTenantId.value)
      if (request !== productionScopeRequestId) return
      Object.assign(productionScope, {
        departments: result.departments,
        workCenters: result.workCenters
      })
      if (!workshopOptions.value.some((item) => item.id === productionScope.selectedWorkshopId)) {
        productionScope.selectedWorkshopId = ''
      }
      if (
        !workCentersForWorkshop.value.some(
          (item) => item.id === productionScope.selectedWorkCenterId
        )
      ) {
        productionScope.selectedWorkCenterId = ''
      }
      if (refreshTable) await tableRef.value?.getData()
    } catch {
      if (request === productionScopeRequestId) {
        productionScope.error = '车间与工作中心加载失败，请重试'
      }
    } finally {
      if (request === productionScopeRequestId) productionScope.loading = false
    }
  }
  let contextRequestId = 0
  async function loadContext() {
    const request = ++contextRequestId
    Object.assign(overview, { total: 0, attention: 0, ready: 0 })
    Object.assign(table.search, {
      keyword: '',
      status: [],
      schedulingStatus: [],
      operationStatus: [],
      plannedDates: undefined,
      workOrderStartDates: undefined,
      includeDeleted: false,
      sortBy: undefined,
      sortOrder: undefined
    })
    Object.assign(productionScope, {
      selectedWorkshopId: '',
      selectedWorkCenterId: ''
    })
    await nextTick()
    await tenantScopeStore.loadTenantOptions()
    await Promise.all(
      [
        'mesWorkOrderSource',
        'mesWorkOrderUrgency',
        'mesWorkOrderStatus',
        'mesOperationTaskStatus',
        'mesOperationTaskScheduleStatus',
        'mesOperationStatus',
        'mdmProcessRouteSequenceType'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
    if (request !== contextRequestId) return
    const [refs] = await Promise.all([
      fetchMesReferences(effectiveTenantId.value || undefined),
      isWorkOrder.value ? Promise.resolve() : loadProductionScope(false)
    ])
    if (request !== contextRequestId) return
    referenceState.employees = refs.employees
    referenceState.workCenters = refs.workCenters
    await nextTick()
    if (request !== contextRequestId) return
    await tableRef.value?.getData()
  }
  watch([() => route.path, effectiveTenantId], () => void loadContext(), { immediate: true })
</script>

<style scoped lang="scss">
  .manufacturing-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    min-height: 0;

    &__workspace {
      min-width: 0;
      overflow: hidden;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      min-height: 0;

      > .art-table-query {
        flex: 1;
        min-height: 0;
      }
    }

    &__scope-expand {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      align-self: flex-start;
      padding: 3px 8px 3px 3px;
      font-size: 12px;
      color: var(--art-gray-700);
    }

    @media (width <= 960px) {
      &__workspace.is-task-workspace {
        min-height: 960px;
        overflow: visible;
      }
    }
  }
</style>
