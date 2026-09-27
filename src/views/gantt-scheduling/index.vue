<template>
  <ArtPermissionGuard permission="MesScheduling:View" resource-name="甘特图排产">
    <div
      class="gantt-page business-workspace-page art-full-height"
      :class="{ 'is-focus-mode': focusMode, 'is-scope-collapsed': scope.collapsed }"
    >
      <BusinessWorkspaceHeader
        v-show="!focusMode"
        eyebrow="SHIFT SCHEDULING"
        title="甘特图排产"
        description="按车间与工作中心，把工序任务量化到每日班次，并在产能边界内完成可视化微调。"
        icon="ri:calendar-schedule-line"
        :tags="workspaceTags"
        :metrics="metrics"
        density="compact"
        refreshable
        :refresh-loading="state.loading"
        @refresh="loadWorkspace"
      >
        <template #actions>
          <BusinessWorkspaceFocusToggle v-model="focusMode" />
        </template>
      </BusinessWorkspaceHeader>

      <div class="gantt-page__workspace business-workspace-content">
        <ProductionWorkCenterNavigator
          v-if="!scope.collapsed"
          class="gantt-page__scope"
          :workshops="workshopOptions"
          :work-centers="workCentersForWorkshop"
          :selected-workshop-id="scope.selectedWorkshopId"
          :selected-work-center-id="scope.selectedWorkCenterId"
          :loading="state.scopeLoading"
          :error="state.scopeError"
          collapsible
          allow-all-workshops
          show-all-work-centers
          select-id="gantt-production-scope"
          @refresh="loadProductionScope"
          @collapse="scope.collapsed = true"
          @select-workshop="selectWorkshop"
          @select-work-center="selectWorkCenter"
        />

        <ArtSectionCard
          class="gantt-page__board"
          title="班次排产工作台"
          :subtitle="`${rangeLabel} · ${visibleTasks.length} 道工序 · ${visibleGroups.length} 个工作中心`"
          :loading="state.loading"
          :error="state.error"
          :empty="!state.loading && !state.error && !visibleTasks.length"
          empty-title="当前范围暂无工序任务"
          empty-description="请切换车间、工作中心或计划期间；已确认并分配到工作中心的工序任务会显示在此处。"
          :min-height="0"
          body-class="gantt-page__board-body"
          retryable
          @retry="loadWorkspace"
        >
          <template #actions>
            <ArtTooltip v-if="scope.collapsed" content="展开生产范围" placement="bottom">
              <ArtIconButton
                icon="ri:side-bar-line"
                label="展开生产范围"
                @click="scope.collapsed = false"
              />
            </ArtTooltip>
            <BusinessWorkspaceFocusToggle v-if="focusMode" v-model="focusMode" />
            <ArtTooltip content="刷新排产数据" placement="bottom">
              <ArtIconButton
                icon="ri:refresh-line"
                label="刷新排产数据"
                :loading="state.loading"
                @click="loadWorkspace"
              />
            </ArtTooltip>
          </template>

          <template #empty-action>
            <ElButton type="primary" @click="goToTaskAssignment">前往待排产工单分配</ElButton>
            <ElButton @click="resetFilters">清除筛选</ElButton>
          </template>

          <template v-if="visibleTasks.length">
            <div class="gantt-page__filters art-card-xs">
              <ElInput
                v-model="filters.keyword"
                clearable
                placeholder="工单号 / 物料名称 / 规格型号 / 项目名称"
                aria-label="组合模糊查询"
              >
                <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
              </ElInput>

              <label class="gantt-page__filter-field">
                <span>计划期间</span>
                <ElSelect v-model="filters.periodPreset" @change="applyPeriodPreset">
                  <ElOption
                    v-for="option in periodPresetOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </ElSelect>
              </label>

              <ElDatePicker
                v-if="filters.periodPreset === 'custom'"
                v-model="filters.range"
                type="daterange"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                unlink-panels
                :clearable="false"
                aria-label="自定义计划期间"
              />

              <label class="gantt-page__filter-field">
                <span>排产模式</span>
                <ElSegmented
                  v-model="filters.direction"
                  :options="directionOptions"
                  size="small"
                  aria-label="排产模式"
                />
              </label>

              <ElCheckboxGroup v-model="filters.completionStatuses" aria-label="任务完成状态">
                <ElCheckbox value="unfinished">未完成</ElCheckbox>
                <ElCheckbox value="partial">部分完成</ElCheckbox>
                <ElCheckbox value="completed">已完成</ElCheckbox>
              </ElCheckboxGroup>

              <ElCheckbox v-model="filters.showQuantities">显示数量</ElCheckbox>

              <div class="gantt-page__period-actions">
                <ArtTooltip content="上一计划期间" placement="bottom">
                  <ArtIconButton
                    icon="ri:arrow-left-s-line"
                    label="上一计划期间"
                    @click="shiftPeriod(-1)"
                  />
                </ArtTooltip>
                <ArtTooltip content="回到今天" placement="bottom">
                  <ArtIconButton
                    icon="ri:calendar-check-line"
                    label="回到今天"
                    @click="focusToday"
                  />
                </ArtTooltip>
                <ArtTooltip content="下一计划期间" placement="bottom">
                  <ArtIconButton
                    icon="ri:arrow-right-s-line"
                    label="下一计划期间"
                    @click="shiftPeriod(1)"
                  />
                </ArtTooltip>
              </div>
            </div>

            <div class="gantt-page__legend" aria-label="排产状态与完工图示">
              <div class="gantt-page__legend-group">
                <strong>任务状态</strong>
                <span><i class="is-processing" />生产中</span>
                <span><i class="is-adjusting" />调整中</span>
                <span><i class="is-excluded" />无需排产</span>
                <span><i class="is-pending" />待生产</span>
                <span><i class="is-over-capacity" />超产能</span>
              </div>
              <div class="gantt-page__legend-group">
                <strong>完工图示</strong>
                <span class="is-achieved"><ArtSvgIcon icon="ri:check-line" />达产</span>
                <span class="is-shortfall"><ArtSvgIcon icon="ri:subtract-line" />欠产</span>
                <span class="is-excess"><ArtSvgIcon icon="ri:add-line" />超产</span>
              </div>
              <small>双击班次录入数量，拖动已排班次可微调计划</small>
            </div>

            <ElScrollbar class="gantt-page__viewport" always>
              <GanttScheduleBoard
                :groups="visibleGroups"
                :dates="timelineDates"
                :calendar-days="state.calendarDays"
                :show-quantities="filters.showQuantities"
                :can-schedule="hasAuth('MesOperationTask:Schedule')"
                :can-auto-schedule="
                  hasAuth('MesOperationTask:Schedule') && hasAuth('MesScheduling:AutoSchedule')
                "
                @edit-cell="openCellPlan"
                @move-allocation="moveAllocation"
                @action="handleTaskAction"
              />
            </ElScrollbar>
          </template>
        </ArtSectionCard>
      </div>

      <ShiftPlanDialog ref="shiftPlanDialogRef" @success="loadWorkspace" />
      <TaskDueDateDialog ref="taskDueDateDialogRef" @success="handleTaskDueDateSuccess" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { computed, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { storeToRefs } from 'pinia'
  import { ElMessage } from 'element-plus'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessWorkspaceFocusToggle from '@/components/business/business-workspace-focus-toggle/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import ProductionWorkCenterNavigator, {
    type ProductionScopeWorkshopOption
  } from '@/components/business/production-work-center-navigator/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useWorkspaceFocus } from '@/hooks/core/useWorkspaceFocus'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import TreeUtils from '@/utils/tree'
  import {
    fetchGanttCalendar,
    fetchOperationTaskScope,
    fetchOperationTasks,
    replaceOperationTaskShiftPlan,
    transitionOperationTask,
    type MesGanttCalendarDay,
    type MesOperationTask,
    type MesBatchResult,
    type MesOperationTaskShiftPlanItem,
    type MesProductionDepartment,
    type MesProductionScopeCenter,
    type SchedulingDirection
  } from '@mes/api'
  import GanttScheduleBoard, { type GanttWorkCenterGroup } from './modules/gantt-schedule-board.vue'
  import ShiftPlanDialog, { type ShiftPlanDialogOpenData } from './modules/shift-plan-dialog.vue'
  import TaskDueDateDialog from '../manufacturing/modules/task-due-date-dialog.vue'
  import {
    allocationsForCenter,
    defaultWorkCenterIdForTask,
    buildCalendarDayMap,
    buildTimelineDates,
    createAutomaticShiftPlan,
    taskQuantitySummary,
    taskTone,
    type GanttShiftSlot
  } from './modules/gantt-schedule-policy'

  const periodPresetOptions = useDictionaryOptions('mesGanttPeriodPreset')

  defineOptions({ name: 'MesSchedulingGantt' })

  const declaredPermissions = [
    'MesSchedulingGantt:View',
    'MesScheduling:View',
    'MesScheduling:AutoSchedule',
    'MesOperationTask:Schedule',
    'MesOperationTask:MaintainDueDate',
    'MesOperationTask:Close'
  ] as const
  void declaredPermissions

  type CompletionStatus = 'unfinished' | 'partial' | 'completed'

  interface PageState {
    loading: boolean
    scopeLoading: boolean
    error: string
    scopeError: string
    tasks: MesOperationTask[]
    departments: MesProductionDepartment[]
    workCenters: MesProductionScopeCenter[]
    calendarDays: MesGanttCalendarDay[]
  }

  interface ScopeState {
    collapsed: boolean
    selectedWorkshopId: string
    selectedWorkCenterId: string
  }

  interface FilterState {
    keyword: string
    periodPreset: '7' | '14' | '30' | 'custom'
    range: [string, string]
    direction: SchedulingDirection
    completionStatuses: CompletionStatus[]
    showQuantities: boolean
  }

  const router = useRouter()
  const { hasAuth } = useAuth()
  const { confirmAction } = useArtFeedback()
  const { focusMode } = useWorkspaceFocus()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, tenantOptions } = storeToRefs(tenantScopeStore)
  const productionTree = new TreeUtils({ deepClone: false })
  const shiftPlanDialogRef = ref<{ handleOpen: (data: ShiftPlanDialogOpenData) => Promise<void> }>()
  const taskDueDateDialogRef = ref<InstanceType<typeof TaskDueDateDialog>>()
  const state = reactive<PageState>({
    loading: false,
    scopeLoading: false,
    error: '',
    scopeError: '',
    tasks: [],
    departments: [],
    workCenters: [],
    calendarDays: []
  })
  const scope = reactive<ScopeState>({
    collapsed: false,
    selectedWorkshopId: '',
    selectedWorkCenterId: ''
  })
  const filters = reactive<FilterState>({
    keyword: '',
    periodPreset: '7',
    range: [dayjs().format('YYYY-MM-DD'), dayjs().add(6, 'day').format('YYYY-MM-DD')],
    direction: 'forward',
    completionStatuses: ['unfinished', 'partial', 'completed'],
    showQuantities: false
  })
  const directionOptions = [
    { label: '顺排', value: 'forward' },
    { label: '倒排', value: 'backward' }
  ]
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '车间级联', type: 'primary' },
    { label: '班次产能', type: 'warning' },
    { label: '拖拽微调', type: 'success' }
  ]

  const departmentTree = computed(() => productionTree.listToTree(state.departments))
  const selectedWorkshop = computed(() =>
    state.departments.find((department) => department.id === scope.selectedWorkshopId)
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
    state.departments
      .filter((department) => {
        if (!department.enabled || !department.parentId) return false
        const departmentIds = descendantDepartmentIds(department.id)
        return state.workCenters.some(
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
    if (!selectedWorkshop.value) return state.workCenters
    const departmentIds = descendantDepartmentIds(selectedWorkshop.value.id)
    return state.workCenters.filter(
      (center) =>
        center.tenantId === selectedWorkshop.value?.tenantId &&
        departmentIds.includes(center.departmentId)
    )
  })
  const centersInScope = computed(() =>
    scope.selectedWorkCenterId
      ? workCentersForWorkshop.value.filter((center) => center.id === scope.selectedWorkCenterId)
      : workCentersForWorkshop.value
  )
  const centerIdSet = computed(() => new Set(centersInScope.value.map((center) => center.id)))
  const timelineDates = computed(() =>
    buildTimelineDates(state.calendarDays, filters.range[0], filters.range[1], [
      ...new Set(centersInScope.value.map((center) => center.departmentId))
    ])
  )
  const flatSlots = computed(() => timelineDates.value.flatMap((date) => date.shifts))
  const calendarDayMap = computed(() => buildCalendarDayMap(state.calendarDays))

  function taskCompletionStatus(task: MesOperationTask): CompletionStatus {
    const planned = Number(task.plannedQuantity || 0)
    const completed = Number(task.cumulativeCompletedQuantity || task.completedQuantity || 0)
    if (
      task.operationStatus === 'completed' ||
      task.operationStatus === 'closed' ||
      completed >= planned
    ) {
      return 'completed'
    }
    if (completed > 0) return 'partial'
    return 'unfinished'
  }

  function taskMatchesKeyword(task: MesOperationTask): boolean {
    const keyword = filters.keyword.trim().toLocaleLowerCase()
    if (!keyword) return true
    const order = task.workOrder
    const matchesTask = [
      order?.workOrderNo,
      order?.materialNameSnapshot,
      order?.materialCodeSnapshot,
      order?.specificationSnapshot,
      order?.projectNameSnapshot,
      task.operationName,
      task.operationCode
    ].some((value) => value?.toLocaleLowerCase().includes(keyword))
    if (matchesTask) return true
    return state.workCenters.some(
      (center) =>
        taskBelongsToCenter(task, center.id) &&
        [center.code, center.name].some((value) => value.toLocaleLowerCase().includes(keyword))
    )
  }

  function taskBelongsToCenter(task: MesOperationTask, centerId: string): boolean {
    return (
      defaultWorkCenterIdForTask(task) === centerId ||
      (task.allocations || []).some(
        (allocation) => allocation.workCenterId === centerId && allocation.status !== 'closed'
      )
    )
  }

  const visibleTasks = computed(() =>
    state.tasks.filter(
      (task) =>
        [...centerIdSet.value].some((centerId) => taskBelongsToCenter(task, centerId)) &&
        taskMatchesKeyword(task) &&
        (!filters.completionStatuses.length ||
          filters.completionStatuses.includes(taskCompletionStatus(task)))
    )
  )
  const visibleGroups = computed<GanttWorkCenterGroup[]>(() =>
    centersInScope.value.map((center) => ({
      center,
      tasks: visibleTasks.value
        .filter((task) => taskBelongsToCenter(task, center.id))
        .sort(
          (left, right) =>
            (left.plannedStartDate || '').localeCompare(right.plannedStartDate || '') ||
            left.sequenceNo - right.sequenceNo
        )
    }))
  )
  const rangeLabel = computed(() => `${filters.range[0]} 至 ${filters.range[1]}`)
  const metrics = computed<BusinessWorkspaceMetric[]>(() => {
    const unscheduled = visibleGroups.value.reduce(
      (total, group) =>
        total +
        group.tasks.reduce(
          (sum, task) => sum + taskQuantitySummary(task, group.center.id).unscheduled,
          0
        ),
      0
    )
    const overCapacity = visibleGroups.value.reduce(
      (total, group) =>
        total +
        group.tasks.filter(
          (task) => taskTone(task, group.center.id, timelineDates.value) === 'over-capacity'
        ).length,
      0
    )
    return [
      {
        label: '工序任务',
        value: visibleTasks.value.length,
        description: '当前筛选范围',
        icon: 'ri:git-merge-line'
      },
      {
        label: '工作中心',
        value: visibleGroups.value.length,
        description: '当前展示范围',
        icon: 'ri:dashboard-3-line'
      },
      {
        label: '未排数量',
        value: Number(unscheduled.toFixed(2)),
        description: '待落到具体班次',
        icon: 'ri:inbox-unarchive-line',
        tone: unscheduled > 0 ? 'warning' : 'success'
      },
      {
        label: '超产能任务',
        value: overCapacity,
        description: '超过理论班次产能',
        icon: 'ri:alarm-warning-line',
        tone: overCapacity ? 'danger' : 'success'
      }
    ]
  })

  function applyPeriodPreset(value: string | number | boolean): void {
    if (value === 'custom') return
    const days = Number(value)
    const start = dayjs()
    filters.range = [start.format('YYYY-MM-DD'), start.add(days - 1, 'day').format('YYYY-MM-DD')]
  }

  function shiftPeriod(direction: -1 | 1): void {
    const span = Math.max(dayjs(filters.range[1]).diff(filters.range[0], 'day') + 1, 1)
    filters.range = [
      dayjs(filters.range[0])
        .add(direction * span, 'day')
        .format('YYYY-MM-DD'),
      dayjs(filters.range[1])
        .add(direction * span, 'day')
        .format('YYYY-MM-DD')
    ]
    filters.periodPreset = 'custom'
  }

  function focusToday(): void {
    const days = filters.periodPreset === 'custom' ? 7 : Number(filters.periodPreset)
    const start = dayjs()
    filters.range = [start.format('YYYY-MM-DD'), start.add(days - 1, 'day').format('YYYY-MM-DD')]
    if (filters.periodPreset === 'custom') filters.periodPreset = '7'
  }

  function selectWorkshop(id: string): void {
    scope.selectedWorkshopId = id
    scope.selectedWorkCenterId = ''
  }

  function selectWorkCenter(id: string): void {
    scope.selectedWorkCenterId = id
  }

  function resetFilters(): void {
    Object.assign(filters, {
      keyword: '',
      periodPreset: '7',
      range: [dayjs().format('YYYY-MM-DD'), dayjs().add(6, 'day').format('YYYY-MM-DD')],
      direction: 'forward',
      completionStatuses: ['unfinished', 'partial', 'completed'],
      showQuantities: false
    })
    Object.assign(scope, { selectedWorkshopId: '', selectedWorkCenterId: '' })
  }

  function planForCenter(
    task: MesOperationTask,
    centerId: string
  ): MesOperationTaskShiftPlanItem[] {
    return allocationsForCenter(task, centerId)
      .filter((allocation) => allocation.shiftIndex)
      .map((allocation) => ({
        workDate: allocation.plannedStartDate,
        shiftIndex: Number(allocation.shiftIndex),
        shiftName: allocation.shiftNameSnapshot || `第 ${allocation.shiftIndex} 班`,
        quantity: Number(allocation.quantity)
      }))
  }

  function availableSlots(center: MesProductionScopeCenter): GanttShiftSlot[] {
    return flatSlots.value.filter(
      (slot) =>
        slot.index > 0 &&
        calendarDayMap.value
          .get(`${center.departmentId}:${slot.workDate}`)
          ?.shifts.some((shift) => shift.index === slot.index)
    )
  }

  function openCellPlan(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ): void {
    void shiftPlanDialogRef.value?.handleOpen({
      mode: 'cell',
      task,
      workCenterId: center.id,
      currentPlan: planForCenter(task, center.id),
      assignedQuantity: taskQuantitySummary(task, center.id).assigned,
      availableSlots: availableSlots(center),
      targetSlot: slot
    })
  }

  async function replacePlan(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    items: MesOperationTaskShiftPlanItem[],
    keepAssignment = true
  ): Promise<void> {
    await replaceOperationTaskShiftPlan({
      id: task.id,
      workCenterId: center.id,
      expectedVersion: task.scheduleVersion,
      keepAssignment,
      items
    })
    await loadWorkspace()
  }

  async function moveAllocation(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    source: GanttShiftSlot,
    target: GanttShiftSlot
  ): Promise<void> {
    const plan = planForCenter(task, center.id)
    const sourceIndex = plan.findIndex(
      (item) => item.workDate === source.workDate && item.shiftIndex === source.index
    )
    if (sourceIndex < 0) return
    const sourceItem = plan[sourceIndex]!
    plan.splice(sourceIndex, 1)
    const targetItem = plan.find(
      (item) => item.workDate === target.workDate && item.shiftIndex === target.index
    )
    if (targetItem)
      targetItem.quantity = Number((targetItem.quantity + sourceItem.quantity).toFixed(2))
    else {
      plan.push({
        workDate: target.workDate,
        shiftIndex: target.index,
        shiftName: target.name,
        quantity: sourceItem.quantity
      })
    }
    try {
      await replacePlan(task, center, plan)
    } catch {
      await loadWorkspace()
    }
  }

  async function handleTaskAction(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    key: string
  ): Promise<void> {
    if (key === 'due-date') {
      await taskDueDateDialogRef.value?.handleOpen({ rows: [task] })
      return
    }
    if (key === 'specified') {
      await shiftPlanDialogRef.value?.handleOpen({
        mode: 'specified',
        task,
        workCenterId: center.id,
        currentPlan: planForCenter(task, center.id),
        assignedQuantity: taskQuantitySummary(task, center.id).assigned,
        availableSlots: availableSlots(center)
      })
      return
    }
    if (key === 'auto') {
      const items = createAutomaticShiftPlan(
        task,
        center.id,
        center.departmentId,
        timelineDates.value,
        calendarDayMap.value,
        filters.direction
      )
      const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      const assigned = taskQuantitySummary(task, center.id).assigned
      if (total < assigned) {
        ElMessage.warning('当前计划期间产能不足，请延长计划期间后再自动排产')
        return
      }
      await confirmAction(
        `将 ${task.operationName} 的未排数量按理论班次产能自动填充，是否继续？`,
        '自动排产',
        { confirmButtonText: '执行自动排产', cancelButtonText: '取消', type: 'warning' }
      )
      await replacePlan(task, center, items)
      return
    }
    if (key === 'undo' || key === 'remove') {
      const removeAssignment = key === 'remove'
      await confirmAction(
        removeAssignment
          ? `将 ${task.operationName} 从 ${center.code} · ${center.name} 移除，是否继续？`
          : `撤销 ${task.operationName} 在当前工作中心的全部班次排产，是否继续？`,
        removeAssignment ? '移除分配' : '撤销排产',
        {
          confirmButtonText: removeAssignment ? '确认移除' : '确认撤销',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      await replacePlan(task, center, [], !removeAssignment)
      return
    }
    if (key === 'close') {
      await confirmAction(
        `结案后，该工序任务在其他工作中心的排产也会一并关闭。是否继续？`,
        '结案关单',
        { confirmButtonText: '确认结案', cancelButtonText: '取消', type: 'warning' }
      )
      await transitionOperationTask(task.id, 'close')
      await loadWorkspace()
    }
  }

  async function handleTaskDueDateSuccess(result: MesBatchResult): Promise<void> {
    if (result.successIds.length) {
      ElMessage.success('要求完工日期已更新')
      await loadWorkspace()
    } else {
      ElMessage.warning(result.failures[0]?.message || '要求完工日期未更新，请刷新后重试')
    }
  }

  function goToTaskAssignment(): void {
    void router.push({ name: 'MesOperationTask' })
  }

  let scopeRequestId = 0
  async function loadProductionScope(): Promise<void> {
    const request = ++scopeRequestId
    state.scopeLoading = true
    state.scopeError = ''
    try {
      const result = await fetchOperationTaskScope(effectiveTenantId.value)
      if (request !== scopeRequestId) return
      state.departments = result.departments
      state.workCenters = result.workCenters
      if (!workshopOptions.value.some((item) => item.id === scope.selectedWorkshopId)) {
        scope.selectedWorkshopId = ''
      }
      if (!workCentersForWorkshop.value.some((item) => item.id === scope.selectedWorkCenterId)) {
        scope.selectedWorkCenterId = ''
      }
    } catch {
      if (request === scopeRequestId) state.scopeError = '车间与工作中心加载失败，请重试'
    } finally {
      if (request === scopeRequestId) state.scopeLoading = false
    }
  }

  let workspaceRequestId = 0
  async function loadWorkspace(): Promise<void> {
    const request = ++workspaceRequestId
    state.loading = true
    state.scopeLoading = true
    state.error = ''
    try {
      await tenantScopeStore.loadTenantOptions()
      const tenantId = effectiveTenantId.value || undefined
      const [scopeResult, tasks, calendarDays] = await Promise.all([
        fetchOperationTaskScope(tenantId),
        fetchOperationTasks({ current: 1, size: 1200, tenantId }),
        fetchGanttCalendar(filters.range[0], filters.range[1])
      ])
      if (request !== workspaceRequestId) return
      state.departments = scopeResult.departments
      state.workCenters = scopeResult.workCenters
      state.tasks = tasks.data
      state.calendarDays = calendarDays
      state.scopeError = ''
    } catch {
      if (request === workspaceRequestId) {
        state.error = '甘特图排产数据加载失败，请检查生产日历后重试。'
      }
    } finally {
      if (request === workspaceRequestId) {
        state.loading = false
        state.scopeLoading = false
      }
    }
  }

  watch(
    [effectiveTenantId, () => filters.range[0], () => filters.range[1]],
    () => void loadWorkspace(),
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .gantt-page {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-3);
    min-width: 0;
    min-height: 0;

    &.is-focus-mode {
      gap: 0;
    }

    &__workspace {
      display: grid;
      flex: 1;
      grid-template-columns: 292px minmax(0, 1fr);
      gap: var(--art-space-3);
      min-width: 0;
      min-height: 0;
    }

    &.is-scope-collapsed &__workspace {
      grid-template-columns: minmax(0, 1fr);
    }

    &__scope,
    &__board {
      min-width: 0;
      min-height: 0;
    }

    &__board {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;

      :deep(.gantt-page__board-body) {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
      }

      :deep(.art-async-state__empty) {
        flex: 1;
      }
    }

    &__filters {
      display: flex;
      flex: none;
      flex-wrap: wrap;
      gap: var(--art-space-2) var(--art-space-3);
      align-items: center;
      padding: 10px 12px;
      margin-bottom: var(--art-space-2);

      > .el-input {
        width: 310px;
      }

      > .el-date-editor {
        width: 250px;
      }

      :deep(.el-checkbox-group) {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 2px 12px;

        .el-checkbox {
          margin-right: 0;
        }
      }
    }

    &__filter-field {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;

      .el-select {
        width: 118px;
      }
    }

    &__period-actions {
      display: flex;
      gap: 4px;
      align-items: center;
      margin-left: auto;
    }

    &__legend {
      display: flex;
      flex: none;
      flex-wrap: wrap;
      gap: 8px 20px;
      align-items: center;
      padding: 8px 12px;
      margin-bottom: var(--art-space-2);
      font-size: 11px;
      color: var(--el-text-color-secondary);
      background: var(--art-gray-100);
      border-radius: var(--art-control-radius);

      > small {
        margin-left: auto;
        color: var(--el-text-color-placeholder);
      }
    }

    &__legend-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      align-items: center;

      strong {
        color: var(--el-text-color-primary);
      }

      span {
        display: inline-flex;
        gap: 5px;
        align-items: center;
      }

      i {
        width: 12px;
        height: 12px;
        border-radius: var(--el-border-radius-small);

        &.is-processing {
          background: var(--el-color-success);
        }

        &.is-adjusting {
          background: var(--el-color-warning-light-5);
        }

        &.is-excluded {
          background: var(--art-gray-200);
          border: 1px solid var(--el-text-color-placeholder);
        }

        &.is-pending {
          background: var(--el-text-color-placeholder);
        }

        &.is-over-capacity {
          background: var(--el-color-danger-light-5);
        }
      }

      .is-achieved {
        color: var(--el-color-success);
      }

      .is-shortfall {
        color: var(--el-color-danger);
      }

      .is-excess {
        color: var(--el-color-warning-dark-2);
      }
    }

    &__viewport {
      flex: 1;
      min-width: 0;
      min-height: 0;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-control-radius);

      :deep(.el-scrollbar__view) {
        min-height: 100%;
      }
    }

    @media (width <= 1280px) {
      &__workspace {
        grid-template-columns: 252px minmax(0, 1fr);
      }

      &__filters > .el-input {
        width: 260px;
      }

      &__legend > small {
        width: 100%;
        margin-left: 0;
      }
    }

    @media (width <= 920px) {
      &__workspace {
        grid-template-columns: minmax(0, 1fr);
      }

      &__scope {
        display: none;
      }

      &__board {
        height: auto;
        min-height: 640px;
      }

      &__filters > .el-input,
      &__filters > .el-date-editor {
        width: 100%;
      }

      &__period-actions {
        margin-left: 0;
      }
    }
  }
</style>
