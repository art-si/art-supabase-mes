<template>
  <ArtPermissionGuard permission="MesScheduling:View" resource-name="排产">
    <div
      class="scheduling-page business-workspace-page art-full-height"
      :class="{ 'is-focus-mode': focusMode }"
    >
      <BusinessWorkspaceHeader
        v-show="!focusMode"
        eyebrow="PRODUCTION DISPATCH"
        title="排产工作台"
        description="以工序任务为唯一待排来源，按车间、产线与班次完成数量拆分、工作中心分配和产能校验。"
        icon="ri:calendar-schedule-line"
        :tags="workspaceTags"
        :metrics="metrics"
        density="compact"
        refreshable
        :refresh-loading="state.loading"
        @refresh="loadWorkspace"
      >
        <template #actions>
          <ElButton v-auth="'MesScheduling:ConfigureRule'" plain @click="goToRules">
            <ArtSvgIcon icon="ri:settings-3-line" />排产规则
          </ElButton>
          <BusinessWorkspaceFocusToggle v-model="focusMode" />
        </template>
      </BusinessWorkspaceHeader>

      <section
        v-show="!focusMode"
        class="scheduling-page__filters art-card-xs"
        aria-label="排产查询条件"
      >
        <div class="scheduling-page__filter-grid">
          <label>
            <span>车间 / 产线</span>
            <ElTreeSelect
              v-model="filters.departmentId"
              :data="departmentTree"
              :props="{ label: 'name', children: 'children' }"
              node-key="id"
              check-strictly
              clearable
              filterable
              default-expand-all
              placeholder="全部车间与产线"
              @change="handleScopeChange"
            />
          </label>
          <label>
            <span>工单开工日期</span>
            <ElDatePicker
              v-model="filters.workOrderStartDates"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              unlink-panels
              clearable
              :shortcuts="dateShortcuts"
            />
          </label>
          <label>
            <span>班次</span>
            <ElSelect v-model="filters.shiftScheduleId" clearable filterable placeholder="全部班次">
              <ElOption
                v-for="shift in availableShifts"
                :key="shift.id"
                :label="`${shift.name} ${shift.startTime}-${shift.endTime}`"
                :value="shift.id"
              />
            </ElSelect>
          </label>
          <label class="scheduling-page__filter-keyword">
            <span>组合查询</span>
            <ElInput
              v-model="filters.keyword"
              clearable
              placeholder="任务号、工单号、物料、规格、项目、跟踪号或客户代码"
            >
              <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
            </ElInput>
          </label>
          <div class="scheduling-page__filter-actions">
            <ElButton @click="openAdvancedFilters">
              <ArtSvgIcon icon="ri:filter-3-line" />
              更多条件
            </ElButton>
            <ElButton @click="resetFilters">重置</ElButton>
          </div>
        </div>
      </section>

      <main
        class="scheduling-page__workspace business-workspace-content"
        :class="{ 'is-overview-collapsed': overviewCollapsed }"
      >
        <ArtSectionCard
          :show-scrollbar="false"
          class="scheduling-page__task-card"
          :title="`待排产任务（约 ${totalStandardHours.toFixed(1)} 标准工时 H）`"
          :subtitle="`${pendingTasks.length} 条待排工序任务 · 与工序任务列表共用同一数据源`"
          :loading="state.loading"
          :error="state.error"
          :empty="!state.loading && !state.error && !pendingTasks.length"
          empty-title="当前条件下没有待排产任务"
          empty-description="请调整车间、班次或组合查询条件；已全部排产的任务可在右侧工作中心查看。"
          :min-height="0"
          body-class="scheduling-page__task-body"
          retryable
          @retry="loadWorkspace"
        >
          <template #actions>
            <BusinessWorkspaceFocusToggle v-show="focusMode" v-model="focusMode" />
            <span class="scheduling-page__sync-state" role="status" aria-live="polite">
              <i :class="{ 'is-live': state.realtimeConnected }" />
              {{ state.realtimeConnected ? '实时同步' : '自动刷新' }} ·
              {{ state.lastLoadedAt || '待加载' }}
            </span>
            <ArtTooltip content="批量确认" placement="bottom">
              <ArtIconButton
                icon="ri:checkbox-circle-line"
                label="批量确认"
                permission="MesOperationTask:Schedule"
                :disabled="!selectedRows.length"
                :loading="state.batchBusy"
                @click="confirmSelected"
              />
            </ArtTooltip>
            <ArtTooltip content="批量结案" placement="bottom">
              <ArtIconButton
                icon="ri:inbox-unarchive-line"
                label="批量结案"
                permission="MesOperationTask:Close"
                :disabled="!selectedRows.length || state.batchBusy"
                @click="closeSelected"
              />
            </ArtTooltip>
            <ArtTooltip
              :content="overviewCollapsed ? '展开任务总览' : '收起任务总览'"
              placement="bottom"
            >
              <ArtIconButton
                :icon="overviewCollapsed ? 'ri:side-bar-fill' : 'ri:side-bar-line'"
                :label="overviewCollapsed ? '展开任务总览' : '收起任务总览'"
                @click="overviewCollapsed = !overviewCollapsed"
              />
            </ArtTooltip>
          </template>
          <ArtTable
            v-if="pendingTasks.length"
            ref="taskTableRef"
            class="scheduling-page__table"
            row-key="id"
            :data="pendingTasks"
            :columns="taskColumns"
            :pagination="false"
            :show-table-header="false"
            height="100%"
            empty-height="100%"
            @selection-change="handleSelectionChange"
            @sort-change="handleSortChange"
          />
        </ArtSectionCard>

        <WorkCenterOverview
          v-if="!overviewCollapsed"
          class="scheduling-page__overview"
          :centers="scopedWorkCenters"
          :tasks="filteredTasks"
          :shift="selectedShift"
          :scope-label="selectedDepartment?.name || '全部工作中心'"
          @gantt="goToGantt"
          @daily-plan="goToDailyPlan"
          @batch-close="closeTaskIds"
        >
          <template #import>
            <span v-auth="'MesOperationTask:Schedule'">
              <ArtExcelImport
                icon="ri:file-upload-line"
                :button-props="{ link: true, loading: state.importing }"
                @import-success="handleScheduleImport"
                @import-error="handleImportError"
                >导入</ArtExcelImport
              >
            </span>
          </template>
        </WorkCenterOverview>
      </main>

      <AverageAllocationDialog ref="allocationDialogRef" @success="loadWorkspace" />
      <ConfirmScheduleDialog ref="confirmScheduleDialogRef" @success="loadWorkspace" />
      <SchedulingAdvancedFilterDrawer ref="advancedFilterDrawerRef" @apply="applyAdvancedFilters" />
      <TaskAnnotationDialog ref="annotationDialogRef" @success="loadWorkspace" />
      <TaskDueDateDialog ref="dueDateDialogRef" @success="loadWorkspace" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import { computed, onUnmounted, reactive, ref, watch } from 'vue'
  import { useDebounceFn } from '@vueuse/core'
  import { ElMessage } from 'element-plus'
  import { useRouter } from 'vue-router'
  import { storeToRefs } from 'pinia'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtExcelImport from '@/components/core/forms/art-excel-import/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessWorkspaceFocusToggle from '@/components/business/business-workspace-focus-toggle/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useWorkspaceFocus } from '@/hooks/core/useWorkspaceFocus'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import type { ColumnOption } from '@/types'
  import TreeUtils from '@/utils/tree'
  import {
    batchTransitionOperationTasks,
    confirmOperationTaskSchedule,
    fetchOperationTaskScope,
    fetchOperationTasks,
    fetchSchedulingContext,
    subscribeMesSchedulingChanges,
    transitionOperationTask,
    type MesOperationTask,
    type MesProductionDepartment,
    type MesProductionScopeCenter,
    type MesSchedulingShift
  } from '@mes/api'
  import TaskAnnotationDialog, {
    type TaskAnnotationDialogOpenData
  } from '../../components/manufacturing/modules/task-annotation-dialog.vue'
  import TaskDueDateDialog, {
    type TaskDueDateDialogOpenData
  } from '../../components/manufacturing/modules/task-due-date-dialog.vue'
  import WorkOrderUrgencyLabel from '../../components/manufacturing/modules/work-order-urgency-label.vue'
  import AverageAllocationDialog, {
    type AverageAllocationDialogOpenData
  } from './modules/average-allocation-dialog.vue'
  import ConfirmScheduleDialog, {
    type ConfirmScheduleDialogOpenData
  } from './modules/confirm-schedule-dialog.vue'
  import SchedulingAdvancedFilterDrawer, {
    type SchedulingAdvancedFilters
  } from './modules/scheduling-advanced-filter-drawer.vue'
  import WorkCenterOverview from './modules/work-center-overview.vue'

  defineOptions({ name: 'MesScheduling' })
  const declaredPermissions = [
    'MesScheduling:View',
    'MesScheduling:ConfigureRule',
    'MesOperationTask:View',
    'MesOperationTask:Schedule',
    'MesOperationTask:Close',
    'MesOperationTask:Annotate',
    'MesOperationTask:MaintainDueDate'
  ] as const
  void declaredPermissions

  interface ScheduleDraft {
    quantity: number | undefined
    workCenterId: string
  }
  interface SchedulingFilters {
    departmentId: string
    workOrderStartDates: [string, string] | undefined
    shiftScheduleId: string
    keyword: string
    workOrderNo: string
    materialKeyword: string
    specProjectKeyword: string
    trackingCustomerKeyword: string
    schedulingStatus: string
  }
  type DepartmentTreeNode = MesProductionDepartment & { children?: DepartmentTreeNode[] }

  const router = useRouter()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId } = storeToRefs(tenantScopeStore)
  const { focusMode } = useWorkspaceFocus()
  const { confirmAction } = useArtFeedback()
  const taskTableRef = ref<ArtTableExpose>()
  const allocationDialogRef = ref<{
    handleOpen: (data: AverageAllocationDialogOpenData) => Promise<void>
  }>()
  const confirmScheduleDialogRef = ref<{
    handleOpen: (data: ConfirmScheduleDialogOpenData) => Promise<void>
  }>()
  const advancedFilterDrawerRef = ref<{
    handleOpen: (filters: SchedulingAdvancedFilters) => Promise<void>
  }>()
  const annotationDialogRef = ref<{
    handleOpen: (data: TaskAnnotationDialogOpenData) => Promise<void>
  }>()
  const dueDateDialogRef = ref<{ handleOpen: (data: TaskDueDateDialogOpenData) => Promise<void> }>()
  const state = reactive({
    loading: false,
    batchBusy: false,
    importing: false,
    error: '',
    lastLoadedAt: '',
    realtimeConnected: false,
    tasks: [] as MesOperationTask[],
    departments: [] as MesProductionDepartment[],
    workCenters: [] as MesProductionScopeCenter[],
    shifts: [] as MesSchedulingShift[]
  })
  const filters = reactive<SchedulingFilters>({
    departmentId: '',
    workOrderStartDates: undefined,
    shiftScheduleId: '',
    keyword: '',
    workOrderNo: '',
    materialKeyword: '',
    specProjectKeyword: '',
    trackingCustomerKeyword: '',
    schedulingStatus: ''
  })
  const drafts = reactive<Record<string, ScheduleDraft>>({})
  const selectedRows = ref<MesOperationTask[]>([])
  const taskSort = reactive<{
    prop: 'plannerNameSnapshot' | 'dispatcherNameSnapshot' | ''
    order: 'ascending' | 'descending' | null
  }>({ prop: '', order: null })
  const overviewCollapsed = ref(false)
  const productionTree = new TreeUtils({ deepClone: false })
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '工序任务实时同步', type: 'primary' },
    { label: '班次产能校验', type: 'warning' },
    { label: '多中心分配', type: 'success' }
  ]
  const dateShortcuts = [
    { text: '今天', value: () => [new Date(), new Date()] },
    {
      text: '昨天',
      value: () => [dayjs().subtract(1, 'day').toDate(), dayjs().subtract(1, 'day').toDate()]
    },
    { text: '明天', value: () => [dayjs().add(1, 'day').toDate(), dayjs().add(1, 'day').toDate()] }
  ]

  const departmentTree = computed<DepartmentTreeNode[]>(
    () =>
      productionTree.listToTree(
        state.departments.filter((item) => item.enabled)
      ) as DepartmentTreeNode[]
  )
  const selectedDepartment = computed(() =>
    state.departments.find((item) => item.id === filters.departmentId)
  )
  const selectedDepartmentIds = computed(() => {
    if (!filters.departmentId) return []
    return productionTree
      .getDescendants(departmentTree.value, filters.departmentId, true)
      .map((item) => String(item.id))
  })
  const scopedWorkCenters = computed(() => {
    if (!selectedDepartment.value) return state.workCenters
    return state.workCenters.filter(
      (center) =>
        center.tenantId === selectedDepartment.value?.tenantId &&
        selectedDepartmentIds.value.includes(center.departmentId)
    )
  })
  const availableShifts = computed(() => {
    if (!selectedDepartment.value) return state.shifts
    return state.shifts.filter(
      (shift) =>
        shift.tenantId === selectedDepartment.value?.tenantId &&
        selectedDepartmentIds.value.includes(shift.departmentId)
    )
  })
  const selectedShift = computed(() =>
    state.shifts.find((shift) => shift.id === filters.shiftScheduleId)
  )
  const filteredTasks = computed(() =>
    state.tasks.filter((task) => {
      if (selectedDepartmentIds.value.length) {
        const inDepartment = task.departmentId
          ? selectedDepartmentIds.value.includes(task.departmentId)
          : false
        const inCenter = (task.allocations || []).some((allocation) =>
          scopedWorkCenters.value.some((center) => center.id === allocation.workCenterId)
        )
        if (!inDepartment && !inCenter) return false
      }
      if (
        filters.workOrderStartDates &&
        (!task.workOrder?.plannedStartDate ||
          dayjs(task.workOrder.plannedStartDate).isBefore(filters.workOrderStartDates[0], 'day') ||
          dayjs(task.workOrder.plannedStartDate).isAfter(filters.workOrderStartDates[1], 'day'))
      )
        return false
      if (
        filters.shiftScheduleId &&
        (task.allocations || []).length &&
        !(task.allocations || []).some(
          (allocation) => allocation.shiftScheduleId === filters.shiftScheduleId
        )
      )
        return false
      if (filters.schedulingStatus && task.schedulingStatus !== filters.schedulingStatus)
        return false
      if (!matchesText(task.workOrder?.workOrderNo, filters.workOrderNo)) return false
      if (
        !matchesAny(
          [task.workOrder?.materialCodeSnapshot, task.workOrder?.materialNameSnapshot],
          filters.materialKeyword
        )
      )
        return false
      if (
        !matchesAny(
          [task.workOrder?.specificationSnapshot, task.workOrder?.projectNameSnapshot],
          filters.specProjectKeyword
        )
      )
        return false
      if (
        !matchesAny(
          [task.workOrder?.trackingNo, task.workOrder?.customerCode],
          filters.trackingCustomerKeyword
        )
      )
        return false
      return matchesAny(
        [
          task.taskNo,
          task.operationCode,
          task.operationName,
          task.workOrder?.workOrderNo,
          task.workOrder?.materialCodeSnapshot,
          task.workOrder?.materialNameSnapshot,
          task.workOrder?.specificationSnapshot,
          task.workOrder?.projectNameSnapshot,
          task.workOrder?.trackingNo,
          task.workOrder?.customerCode
        ],
        filters.keyword
      )
    })
  )
  const pendingTasks = computed(() => {
    const tasks = filteredTasks.value.filter(
      (task) =>
        ['pending', 'scheduled'].includes(task.schedulingStatus) &&
        !['completed', 'closed'].includes(task.operationStatus) &&
        availableQuantity(task) > 0
    )
    if (!taskSort.prop || !taskSort.order) return tasks
    const direction = taskSort.order === 'ascending' ? 1 : -1
    const sortKey = taskSort.prop
    return [...tasks].sort(
      (left, right) =>
        direction *
        (left.workOrder?.[sortKey]?.localeCompare(right.workOrder?.[sortKey] || '', 'zh-CN', {
          numeric: true
        }) || 0)
    )
  })
  const totalStandardHours = computed(() =>
    pendingTasks.value.reduce(
      (total, task) =>
        total +
        (Number(task.estimatedWorkMinutes || 0) * availableQuantity(task)) /
          Number(task.plannedQuantity || 1) /
          60,
      0
    )
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => {
    const tasks = filteredTasks.value
    const pending = pendingTasks.value.length
    const scheduledQuantity = tasks.reduce(
      (total, task) => total + Number(task.scheduledQuantity || 0),
      0
    )
    return [
      {
        label: '待排任务',
        value: pending,
        description: '等待确认工作中心',
        icon: 'ri:time-line',
        tone: pending ? 'warning' : 'success'
      },
      {
        label: '标准工时',
        value: `${totalStandardHours.value.toFixed(1)} H`,
        description: '当前任务累计预计用时',
        icon: 'ri:timer-line'
      },
      {
        label: '已排数量',
        value: Number(scheduledQuantity.toFixed(2)),
        description: '已确认进入工作中心',
        icon: 'ri:checkbox-circle-line',
        tone: 'success'
      },
      {
        label: '工作中心',
        value: scopedWorkCenters.value.length,
        description: selectedDepartment.value?.name || '当前租户全部范围',
        icon: 'ri:building-2-line'
      }
    ]
  })

  const taskColumns: ColumnOption<MesOperationTask>[] = [
    { type: 'selection', width: 48, fixed: 'left' },
    { type: 'globalIndex', label: '序号', width: 66, fixed: 'left' },
    { prop: 'taskNo', label: '任务单号', minWidth: 164, fixed: 'left', showOverflowTooltip: true },
    {
      prop: 'workOrderNo',
      label: '生产工单',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.workOrderNo || '—'
    },
    {
      prop: 'workOrderType',
      label: '工单类型',
      minWidth: 130,
      formatter: (row) => (
        <span class="inline-flex min-w-0 items-center gap-1">
          <span>{row.workOrder?.workOrderTypeNameSnapshot || '—'}</span>
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
      prop: 'plannerNameSnapshot',
      label: '计划员',
      minWidth: 112,
      sortable: 'custom',
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.plannerNameSnapshot || '—'
    },
    {
      prop: 'dispatcherNameSnapshot',
      label: '调度员',
      minWidth: 112,
      sortable: 'custom',
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.dispatcherNameSnapshot || '—'
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
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) =>
        [row.workOrder?.materialNameSnapshot, row.workOrder?.specificationSnapshot]
          .filter(Boolean)
          .join(' · ') || '—'
    },
    { prop: 'sequenceNo', label: '工序序列', width: 100, align: 'right' },
    { prop: 'operationCode', label: '工序号', minWidth: 112, showOverflowTooltip: true },
    { prop: 'operationName', label: '工序名称', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'schedulingStatus',
      label: '排产状态',
      width: 104,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay
          dict-code="mesOperationTaskScheduleStatus"
          value={row.schedulingStatus}
          display="tag"
        />
      )
    },
    {
      prop: 'plannedQuantity',
      label: '工序数量',
      minWidth: 112,
      align: 'right',
      formatter: (row) => quantityText(row.plannedQuantity, row.operationUnit)
    },
    {
      prop: 'pendingScheduleQuantity',
      label: '待排产数量',
      minWidth: 118,
      align: 'right',
      formatter: (row) => quantityText(row.pendingScheduleQuantity, row.operationUnit)
    },
    {
      prop: 'scheduledQuantity',
      label: '已排产数量',
      minWidth: 118,
      align: 'right',
      formatter: (row) => quantityText(row.scheduledQuantity, row.operationUnit)
    },
    {
      prop: 'completedQuantity',
      label: '完工数量',
      minWidth: 108,
      align: 'right',
      formatter: (row) => quantityText(row.completedQuantity, row.operationUnit)
    },
    {
      prop: 'standardHours',
      label: '标准工时',
      minWidth: 104,
      align: 'right',
      formatter: (row) => `${(Number(row.estimatedWorkMinutes || 0) / 60).toFixed(2)} H`
    },
    { prop: 'requiredStartDate', label: '工序要求开工日期', width: 140 },
    {
      prop: 'requiredCompletionDate',
      label: '工序要求完工日期',
      width: 158,
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          label={row.requiredCompletionDate || '设置日期'}
          permission="MesOperationTask:MaintainDueDate"
          onClick={() => openDueDate(row)}
        />
      )
    },
    {
      prop: 'trackingNo',
      label: '计划跟踪号',
      minWidth: 128,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.trackingNo || '—'
    },
    {
      prop: 'customerCode',
      label: '客户代码',
      minWidth: 116,
      showOverflowTooltip: true,
      formatter: (row) => row.workOrder?.customerCode || '—'
    },
    {
      prop: 'department',
      label: '生产车间',
      minWidth: 136,
      showOverflowTooltip: true,
      formatter: (row) => row.department?.name || '—'
    },
    {
      prop: 'suggestedQuantity',
      label: '排产建议数量',
      width: 136,
      align: 'right',
      formatter: (row) => quantityText(draftFor(row).quantity, row.operationUnit)
    },
    {
      prop: 'suggestedCenter',
      label: '排产建议工作中心',
      width: 216,
      formatter: (row) => {
        const center = eligibleCenters(row).find((item) => item.id === draftFor(row).workCenterId)
        return center ? (
          <BusinessTableIdentityCell primary={center.name} secondary={center.code} />
        ) : (
          '—'
        )
      }
    },
    {
      prop: 'operation',
      label: '操作',
      width: 130,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="sign"
            icon="ri:calendar-schedule-line"
            label="排产"
            permission="MesOperationTask:Schedule"
            disabled={
              row.scheduleLocked || !['pending', 'scheduled'].includes(row.schedulingStatus)
            }
            onClick={() => openConfirmSchedule(row)}
          />
          <ArtButtonMore
            list={taskMore(row)}
            onClick={(item) => handleTaskMore(row, String(item.key))}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  function matchesText(value: string | null | undefined, keyword: string): boolean {
    const normalized = keyword.trim().toLocaleLowerCase()
    return !normalized || Boolean(value?.toLocaleLowerCase().includes(normalized))
  }
  function matchesAny(values: Array<string | null | undefined>, keyword: string): boolean {
    const normalized = keyword.trim().toLocaleLowerCase()
    return !normalized || values.some((value) => value?.toLocaleLowerCase().includes(normalized))
  }
  function quantityText(value: number | null | undefined, unit: string): string {
    return `${Number(value || 0)}${unit ? ` ${unit}` : ''}`
  }
  function availableQuantity(row: MesOperationTask): number {
    return Math.max(Number(row.pendingScheduleQuantity || 0), 0)
  }
  function eligibleCenters(row: MesOperationTask): MesProductionScopeCenter[] {
    const scoped = scopedWorkCenters.value.length ? scopedWorkCenters.value : state.workCenters
    return row.eligibleWorkCenterIds.length
      ? scoped.filter((center) => row.eligibleWorkCenterIds.includes(center.id))
      : scoped
  }
  function draftFor(row: MesOperationTask): ScheduleDraft {
    if (!drafts[row.id]) {
      const centers = eligibleCenters(row)
      drafts[row.id] = {
        quantity: availableQuantity(row),
        workCenterId: row.allocations?.[0]?.workCenterId || row.workCenterId || centers[0]?.id || ''
      }
    }
    return drafts[row.id]!
  }
  function resetDrafts(): void {
    Object.keys(drafts).forEach((key) => delete drafts[key])
    state.tasks.forEach((row) => void draftFor(row))
  }
  function taskMore(row: MesOperationTask) {
    return [
      {
        key: 'allocate',
        label: '平均分配',
        icon: 'ri:split-cells-horizontal',
        auth: 'MesOperationTask:Schedule',
        disabled: row.scheduleLocked || !['pending', 'scheduled'].includes(row.schedulingStatus)
      },
      {
        key: 'annotate',
        label: '工单批注与加急',
        icon: 'ri:sticky-note-add-line',
        auth: 'MesOperationTask:Annotate'
      },
      {
        key: 'due-date',
        label: '修改要求完工日期',
        icon: 'ri:calendar-check-line',
        auth: 'MesOperationTask:MaintainDueDate'
      },
      {
        key: 'close',
        label: '结案',
        icon: 'ri:archive-line',
        auth: 'MesOperationTask:Close',
        disabled: row.operationStatus === 'started' || row.schedulingStatus === 'closed'
      }
    ]
  }
  function handleSelectionChange(rows: MesOperationTask[]): void {
    selectedRows.value = rows
  }
  function handleSortChange({
    prop,
    order
  }: {
    prop: string
    order: 'ascending' | 'descending' | null
  }): void {
    taskSort.prop =
      order && (prop === 'plannerNameSnapshot' || prop === 'dispatcherNameSnapshot') ? prop : ''
    taskSort.order = order
  }
  function handleScopeChange(): void {
    filters.shiftScheduleId = ''
    taskTableRef.value?.elTableRef?.clearSelection()
    resetDrafts()
  }
  function openAdvancedFilters(): void {
    void advancedFilterDrawerRef.value?.handleOpen({
      workOrderNo: filters.workOrderNo,
      materialKeyword: filters.materialKeyword,
      specProjectKeyword: filters.specProjectKeyword,
      trackingCustomerKeyword: filters.trackingCustomerKeyword,
      schedulingStatus: filters.schedulingStatus
    })
  }
  function applyAdvancedFilters(values: SchedulingAdvancedFilters): void {
    Object.assign(filters, values)
    taskTableRef.value?.elTableRef?.clearSelection()
  }
  function resetFilters(): void {
    Object.assign(filters, {
      departmentId: '',
      workOrderStartDates: undefined,
      shiftScheduleId: '',
      keyword: '',
      workOrderNo: '',
      materialKeyword: '',
      specProjectKeyword: '',
      trackingCustomerKeyword: '',
      schedulingStatus: ''
    })
    taskTableRef.value?.elTableRef?.clearSelection()
    resetDrafts()
  }
  async function confirmTask(row: MesOperationTask, silent = false): Promise<boolean> {
    const draft = draftFor(row)
    const quantity = Number(draft.quantity || 0)
    if (!draft.workCenterId) {
      if (!silent) ElMessage.warning('请选择排产建议工作中心')
      return false
    }
    if (quantity <= 0) {
      if (!silent) ElMessage.warning('排产建议数量必须大于 0')
      return false
    }
    if (quantity > availableQuantity(row)) {
      if (!silent) ElMessage.warning('排产数量大于待排产数量')
      return false
    }
    const plannedStartDate =
      row.requiredStartDate ||
      row.plannedStartDate ||
      row.workOrder?.plannedStartDate ||
      dayjs().format('YYYY-MM-DD')
    const plannedEndDate =
      row.requiredCompletionDate ||
      row.plannedEndDate ||
      row.workOrder?.plannedEndDate ||
      plannedStartDate
    await confirmOperationTaskSchedule(
      {
        id: row.id,
        workCenterId: draft.workCenterId,
        quantity,
        plannedStartDate,
        plannedEndDate,
        shiftScheduleId: filters.shiftScheduleId || null
      },
      { showMessage: !silent }
    )
    return true
  }
  function openConfirmSchedule(row: MesOperationTask): void {
    const draft = draftFor(row)
    void confirmScheduleDialogRef.value?.handleOpen({
      row,
      workCenters: eligibleCenters(row),
      shifts: state.shifts,
      quantity: draft.quantity,
      workCenterId: draft.workCenterId,
      shiftScheduleId: filters.shiftScheduleId
    })
  }
  async function confirmSelected(): Promise<void> {
    if (!selectedRows.value.length) return
    const invalid = selectedRows.value.find((row) => {
      const draft = draftFor(row)
      return (
        !draft.workCenterId ||
        Number(draft.quantity || 0) <= 0 ||
        Number(draft.quantity) > availableQuantity(row)
      )
    })
    if (invalid) {
      if (Number(draftFor(invalid).quantity) > availableQuantity(invalid))
        ElMessage.warning('排产数量大于待排产数量')
      else ElMessage.warning(`请完善任务 ${invalid.taskNo} 的排产建议数量和工作中心`)
      return
    }
    await confirmAction(
      `将确认所选 ${selectedRows.value.length} 条工序任务的排产建议，是否继续？`,
      '批量确认排产',
      { confirmButtonText: '确认排产' }
    )
    state.batchBusy = true
    try {
      const results = await Promise.allSettled(
        selectedRows.value.map((row) => confirmTask(row, true))
      )
      const successCount = results.filter(
        (result) => result.status === 'fulfilled' && result.value
      ).length
      const failedCount = results.length - successCount
      if (failedCount)
        ElMessage.warning(`批量确认完成：成功 ${successCount} 条，失败 ${failedCount} 条`)
      else ElMessage.success(`已确认 ${successCount} 条工序任务`)
      taskTableRef.value?.elTableRef?.clearSelection()
      await loadWorkspace()
    } finally {
      state.batchBusy = false
    }
  }
  async function closeTaskIds(ids: string[]): Promise<void> {
    const rows = state.tasks.filter((task) => ids.includes(task.id))
    if (!rows.length) return
    await confirmAction(`确定结案所选 ${rows.length} 条工序任务吗？`, '批量结案', {
      confirmButtonText: '确认结案'
    })
    state.batchBusy = true
    try {
      const result = await batchTransitionOperationTasks(
        rows.map((row) => row.id),
        'close'
      )
      if (result.failures.length)
        ElMessage.warning(
          `批量结案完成：成功 ${result.successIds.length} 条，失败 ${result.failures.length} 条`
        )
      else ElMessage.success(`已结案 ${result.successIds.length} 条工序任务`)
      taskTableRef.value?.elTableRef?.clearSelection()
      await loadWorkspace()
    } finally {
      state.batchBusy = false
    }
  }
  function closeSelected(): void {
    void closeTaskIds(selectedRows.value.map((row) => row.id))
  }
  function openDueDate(row: MesOperationTask): void {
    void dueDateDialogRef.value?.handleOpen({ rows: [row] })
  }
  function openAllocation(row: MesOperationTask): void {
    void allocationDialogRef.value?.handleOpen({
      row,
      workCenters: scopedWorkCenters.value,
      shifts: availableShifts.value,
      shiftScheduleId: filters.shiftScheduleId
    })
  }
  async function handleTaskMore(row: MesOperationTask, command: string): Promise<void> {
    if (command === 'allocate') {
      openAllocation(row)
      return
    }
    if (command === 'annotate') {
      await annotationDialogRef.value?.handleOpen({ row })
      return
    }
    if (command === 'due-date') {
      openDueDate(row)
      return
    }
    if (command === 'close') {
      await confirmAction(`确定将工序任务“${row.operationName}”结案吗？`, '工序任务结案', {
        confirmButtonText: '确认结案'
      })
      await transitionOperationTask(row.id, 'close')
      await loadWorkspace()
    }
  }
  function readImportCell(row: Record<string, unknown>, keys: string[]): string {
    const key = keys.find((item) => row[item] !== undefined)
    return key ? String(row[key] ?? '').trim() : ''
  }
  async function handleScheduleImport(rows: Array<Record<string, unknown>>): Promise<void> {
    if (!rows.length) {
      ElMessage.warning('导入文件中没有可处理的数据')
      return
    }
    state.importing = true
    try {
      let successCount = 0
      const failures: string[] = []
      for (const [index, imported] of rows.entries()) {
        const taskNo = readImportCell(imported, ['任务单号', 'taskNo'])
        const centerCode = readImportCell(imported, ['工作中心编号', 'workCenterCode'])
        const quantity = Number(readImportCell(imported, ['排产数量', 'quantity']))
        const task = state.tasks.find((item) => item.taskNo === taskNo)
        const center = state.workCenters.find(
          (item) => item.code === centerCode || item.name === centerCode
        )
        if (!task || !center || !Number.isFinite(quantity) || quantity <= 0) {
          failures.push(`第 ${index + 2} 行任务、工作中心或数量无效`)
          continue
        }
        if (quantity > availableQuantity(task)) {
          failures.push(`第 ${index + 2} 行排产数量大于待排产数量`)
          continue
        }
        const startDate =
          readImportCell(imported, ['计划开始日期', 'plannedStartDate']) ||
          task.requiredStartDate ||
          task.workOrder?.plannedStartDate ||
          dayjs().format('YYYY-MM-DD')
        const endDate =
          readImportCell(imported, ['计划结束日期', 'plannedEndDate']) ||
          task.requiredCompletionDate ||
          task.workOrder?.plannedEndDate ||
          startDate
        try {
          await confirmOperationTaskSchedule(
            {
              id: task.id,
              workCenterId: center.id,
              quantity,
              plannedStartDate: startDate,
              plannedEndDate: endDate,
              shiftScheduleId: filters.shiftScheduleId || null
            },
            { showMessage: false }
          )
          successCount += 1
        } catch {
          failures.push(`第 ${index + 2} 行排产失败`)
        }
      }
      if (failures.length)
        ElMessage.warning(
          `导入完成：成功 ${successCount} 条，失败 ${failures.length} 条。${failures[0]}`
        )
      else ElMessage.success(`已导入并确认 ${successCount} 条排产任务`)
      await loadWorkspace()
    } finally {
      state.importing = false
    }
  }
  function handleImportError(): void {
    ElMessage.error('排产文件读取失败，请使用有效的 Excel 文件')
  }
  function goToRules(): void {
    void router.push({ name: 'MesSchedulingRule' })
  }
  function goToGantt(): void {
    void router.push({
      name: 'MesSchedulingGantt',
      query: { shift: filters.shiftScheduleId || undefined }
    })
  }
  function goToDailyPlan(): void {
    void router.push({
      name: 'MesOperationTask',
      query: { view: 'daily', shift: filters.shiftScheduleId || undefined }
    })
  }

  let requestId = 0
  let disposed = false
  async function loadWorkspace(): Promise<void> {
    if (disposed) return
    const request = ++requestId
    state.loading = true
    state.error = ''
    try {
      await tenantScopeStore.loadTenantOptions()
      if (request !== requestId || disposed) return
      const tenantId = effectiveTenantId.value || undefined
      const [tasks, scope, context] = await Promise.all([
        fetchOperationTasks({ current: 1, size: 2000, tenantId }),
        fetchOperationTaskScope(effectiveTenantId.value),
        fetchSchedulingContext()
      ])
      if (request !== requestId) return
      Object.assign(state, {
        tasks: tasks.data,
        departments: scope.departments,
        workCenters: scope.workCenters,
        shifts: context.shifts,
        lastLoadedAt: dayjs().format('HH:mm:ss')
      })
      if (!state.departments.some((item) => item.id === filters.departmentId))
        filters.departmentId = ''
      if (!state.shifts.some((item) => item.id === filters.shiftScheduleId))
        filters.shiftScheduleId = ''
      resetDrafts()
    } catch {
      if (request === requestId) state.error = '排产数据加载失败，请检查网络后重试。'
    } finally {
      if (request === requestId) state.loading = false
    }
  }

  watch(
    effectiveTenantId,
    async (tenantId, _previousTenantId, onCleanup) => {
      let active = true
      let unsubscribeRealtime: (() => void) | undefined
      const refreshFromRealtime = useDebounceFn(() => {
        if (active && !disposed) void loadWorkspace()
      }, 500)
      onCleanup(() => {
        active = false
        requestId += 1
        unsubscribeRealtime?.()
      })
      state.realtimeConnected = false
      await loadWorkspace()
      if (!active || disposed) return
      unsubscribeRealtime = subscribeMesSchedulingChanges(tenantId, () => {
        if (!active || disposed) return
        state.realtimeConnected = true
        refreshFromRealtime()
      })
      state.realtimeConnected = true
    },
    { immediate: true, flush: 'sync' }
  )
  onUnmounted(() => {
    disposed = true
    requestId += 1
  })
</script>

<style scoped lang="scss">
  .scheduling-page {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-3);
    min-width: 0;
    min-height: 0;

    &.is-focus-mode {
      gap: 0;
    }

    &__filters {
      flex: none;
      padding: 12px 14px;
    }

    &__filter-grid {
      display: grid;
      grid-template-columns:
        minmax(190px, 0.9fr) minmax(260px, 1.2fr) minmax(190px, 0.9fr) minmax(320px, 1.8fr)
        auto;
      gap: var(--art-space-3);
      align-items: end;

      label {
        display: grid;
        gap: 5px;
        min-width: 0;

        > span {
          font-size: 11px;
          font-weight: 600;
          color: var(--el-text-color-secondary);
        }

        > .el-select,
        > .el-date-editor {
          width: 100%;
          min-width: 0;
          max-width: 100%;
        }
      }

      :deep(.el-date-editor.el-input__wrapper) {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      :deep(.el-date-editor .el-range-input) {
        min-width: 0;
      }
    }

    &__filter-actions {
      display: flex;
      gap: var(--art-space-2);

      .el-button + .el-button {
        margin-left: 0;
      }
    }

    &__workspace {
      position: relative;
      display: grid;
      flex: 1;
      grid-template-columns: minmax(720px, 1fr) minmax(430px, 36%);
      gap: var(--art-space-3);
      min-height: 0;

      &.is-overview-collapsed {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    &__task-card,
    &__overview {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    &__task-card {
      display: flex;
      flex-direction: column;
      height: 100%;

      :deep(.scheduling-page__task-body) {
        display: flex;
        flex: 1;
        min-height: 0;
        padding: 0;
      }

      :deep(.art-async-state),
      :deep(.art-async-state__content) {
        display: flex;
        flex: 1;
        min-width: 0;
        min-height: 0;
      }
    }

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;

      :deep(.el-table__cell) {
        padding: 7px 0;
      }

      :deep(.el-table__fixed-right) {
        box-shadow: -8px 0 18px color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
      }
    }

    &__sync-state {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-height: 30px;
      padding: 0 9px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-secondary);
      background: var(--art-gray-100);
      border-radius: var(--art-control-radius);

      i {
        width: 7px;
        height: 7px;
        background: var(--el-color-info);
        border-radius: 50%;

        &.is-live {
          background: var(--el-color-success);
          box-shadow: 0 0 0 3px var(--el-color-success-light-8);
        }
      }
    }

    @media (width <= 1380px) {
      &__filter-grid {
        grid-template-columns: repeat(4, minmax(170px, 1fr));
      }

      &__filter-actions {
        grid-column: 4;
        justify-content: flex-end;
      }

      &__workspace {
        grid-template-columns: minmax(0, 1fr) minmax(360px, 34%);
      }
    }

    @media (width <= 1100px) {
      &__filter-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      &__filter-keyword,
      &__filter-actions {
        grid-column: span 2;
      }

      &__workspace {
        grid-template-columns: minmax(0, 1fr) minmax(320px, 38%);
      }
    }
  }
</style>
