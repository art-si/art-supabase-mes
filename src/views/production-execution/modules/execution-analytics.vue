<template>
  <ArtPermissionGuard :permission="`${config.permission}:View`" :resource-name="config.title">
    <div class="execution-analytics business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        :title="config.title"
        :description="config.description"
        :icon="config.icon"
        density="compact"
        refreshable
        :refresh-loading="loading"
        @refresh="loadData"
        ><template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template
      ></BusinessWorkspaceHeader>
      <ArtWorkspaceSplitter
        class="execution-analytics__body"
        primary-size="270px"
        primary-min="240px"
        primary-max="360px"
        :breakpoint="900"
      >
        <template #primary>
          <aside class="execution-analytics__scope"
            ><ProductionWorkCenterNavigator
              :workshops="workshopOptions"
              :work-centers="visibleCenters"
              :selected-workshop-id="scope.selectedWorkshopId"
              :selected-work-center-id="scope.selectedWorkCenterId"
              :loading="scope.loading"
              :error="scope.error"
              allow-all-workshops
              show-all-work-centers
              @refresh="loadScope"
              @select-workshop="selectWorkshop"
              @select-work-center="selectWorkCenter"
          /></aside>
        </template>
        <div class="execution-analytics__main">
          <div class="execution-analytics__metrics"
            ><article
              ><small>{{
                mode === 'person'
                  ? '参与人员'
                  : mode === 'shift'
                    ? '排产任务'
                    : mode === 'machine'
                      ? '已分配机台'
                      : '工作中心'
              }}</small
              ><strong>{{ metricCount }}</strong
              ><span>当前筛选范围</span></article
            ><article
              ><small>{{
                mode === 'person'
                  ? '标准产出工时'
                  : mode !== 'shift' && dimension === 'task'
                    ? '排产任务'
                    : '计划数量'
              }}</small
              ><strong>{{ metricPlanned }}</strong
              ><span>{{
                mode === 'person'
                  ? '工艺标准换算'
                  : mode !== 'shift' && dimension === 'task'
                    ? '当前筛选任务单数'
                    : '班次排产数量'
              }}</span></article
            ><article
              ><small>{{
                mode === 'person'
                  ? '实际在岗工时'
                  : mode !== 'shift' && dimension === 'task'
                    ? '达成任务'
                    : '审批良品'
              }}</small
              ><strong>{{ metricAchieved }}</strong
              ><span>{{
                mode === 'person'
                  ? '按上机打卡计算'
                  : mode !== 'shift' && dimension === 'task'
                    ? '已达成任务单数'
                    : '只统计已审批报工'
              }}</span></article
            ><article
              ><small>{{ mode === 'person' ? '人工效率' : '达成率' }}</small
              ><strong>{{ metricRate }}</strong
              ><span>{{
                mode === 'person'
                  ? '标准产出 / 在岗工时'
                  : mode !== 'shift' && dimension === 'task'
                    ? '达成任务 / 排产任务'
                    : '审批良品 / 计划数量'
              }}</span></article
            ></div
          >
          <div class="execution-analytics__card">
            <ElAlert v-if="error" :title="error" type="error" show-icon :closable="false" />
            <div class="execution-analytics__table"
              ><ArtTableQuery
                ref="tableRef"
                v-model="searchModel"
                :search-items="searchItems"
                :header-actions="headerActions"
                header-actions-placement="workspace"
                :table-header-props="{ layout: 'search,size,fullscreen,columns,settings' }"
                :search-bar-props="{
                  span: 6,
                  defaultExpanded: true,
                  resetLoading: resetting,
                  labelWidth: 82,
                  showExpand: false
                }"
                :data="visibleRows"
                :loading="loading"
                :table-props="{
                  rowKey: 'key',
                  tableLayout: 'fixed',
                  emptyHeight: '100%',
                  emptyText: '当前条件下暂无统计数据'
                }"
                focus-scope-selector=".execution-analytics__body"
                focusable
                @search="applySearch"
                @reset="resetFilters"
                ><template #dimension-control>
                  <ElSegmented
                    v-model="dimension"
                    :options="[
                      { label: '任务维度', value: 'task' },
                      { label: '数量维度', value: 'quantity' }
                    ]"
                  />
                </template>
                <template #incomplete-control>
                  <ElCheckbox v-model="onlyIncomplete">仅显示未达成</ElCheckbox>
                </template>
                <template #methodology-control>
                  <ElPopover placement="bottom-end" :width="360" trigger="click">
                    <template #reference>
                      <ElButton><ArtSvgIcon icon="ri:information-line" />统计口径</ElButton>
                    </template>
                    <p class="execution-analytics__method-note">{{ methodologyNote }}</p>
                  </ElPopover>
                </template>
                <ElTableColumn type="index" label="序号" width="62" />
                <ElTableColumn prop="date" label="生产日期" width="118" /><ElTableColumn
                  prop="shift"
                  label="班次"
                  width="105"
                />
                <template v-if="mode === 'person'"
                  ><ElTableColumn label="人员 / 车间" min-width="210"
                    ><template #default="{ row }"
                      ><BusinessTableIdentityCell
                        :primary="row.personName"
                        :secondary="row.departmentName"
                        icon="ri:user-star-line"
                      /> </template></ElTableColumn
                  ><ElTableColumn label="产出工时(h)" width="135" align="right"
                    ><template #default="{ row }">{{
                      row.outputHours === null ? '—' : Number(row.outputHours).toFixed(2)
                    }}</template></ElTableColumn
                  ><ElTableColumn label="在岗时长(h)" width="135" align="right"
                    ><template #default="{ row }">{{
                      Number(row.onPostHours).toFixed(2)
                    }}</template></ElTableColumn
                  ><ElTableColumn label="人工效率" min-width="170"
                    ><template #default="{ row }"
                      ><span v-if="row.outputHours === null || !row.onPostHours">—</span
                      ><template v-else
                        ><strong>{{ ratio(row.outputHours, row.onPostHours) }}%</strong
                        ><ElProgress
                          :percentage="Math.min(100, ratio(row.outputHours, row.onPostHours))"
                          :show-text="false"
                          :stroke-width="5" /></template></template></ElTableColumn
                ></template>
                <template v-else-if="mode === 'shift'"
                  ><ElTableColumn
                    prop="centerName"
                    label="工作中心"
                    min-width="140"
                  /><ElTableColumn label="生产工单 / 任务单" min-width="220"
                    ><template #default="{ row }"
                      ><BusinessTableIdentityCell
                        :primary="row.task?.workOrder?.workOrderNo"
                        :secondary="row.task?.taskNo"
                        icon="ri:calendar-check-line"
                      /> </template></ElTableColumn
                  ><ElTableColumn label="工序 / 物料" min-width="210"
                    ><template #default="{ row }"
                      ><BusinessTableIdentityCell
                        :primary="`${row.task?.operationCode || '—'} · ${row.task?.operationName || '—'}`"
                        :secondary="`${row.task?.workOrder?.materialCodeSnapshot || '—'} ${row.task?.workOrder?.materialNameSnapshot || ''}`"
                      /> </template></ElTableColumn
                  ><ElTableColumn
                    prop="plannedQuantity"
                    label="任务数"
                    width="100"
                    align="right"
                  /><ElTableColumn
                    prop="achievedQuantity"
                    label="当班完工"
                    width="100"
                    align="right"
                  /><ElTableColumn
                    prop="exceptionRemark"
                    label="异常备注"
                    min-width="150"
                    show-overflow-tooltip
                  /><ElTableColumn label="状态" width="100"
                    ><template #default="{ row }"
                      ><ElTag
                        :type="row.achievedQuantity >= row.plannedQuantity ? 'success' : 'warning'"
                        effect="plain"
                        >{{
                          row.achievedQuantity >= row.plannedQuantity ? '已达成' : '未达成'
                        }}</ElTag
                      ></template
                    ></ElTableColumn
                  ></template
                >
                <template v-else
                  ><ElTableColumn v-if="mode === 'machine'" label="机台 / 编号" min-width="210"
                    ><template #default="{ row }"
                      ><BusinessTableIdentityCell
                        :primary="row.equipmentName"
                        :secondary="row.equipmentCode"
                        icon="ri:dashboard-line"
                      /> </template></ElTableColumn
                  ><ElTableColumn
                    prop="departmentName"
                    label="车间 / 产线"
                    min-width="150" /><ElTableColumn label="工作中心" min-width="190"
                    ><template #default="{ row }"
                      ><BusinessTableIdentityCell
                        :primary="row.centerName"
                        :secondary="row.centerCode"
                        :icon="mode === 'line' ? 'ri:bar-chart-box-line' : undefined"
                      /> </template></ElTableColumn
                  ><ElTableColumn
                    :label="dimension === 'task' ? '任务单数' : '任务数量'"
                    width="118"
                    align="right"
                    ><template #default="{ row }">{{
                      dimension === 'task' ? row.taskCount : row.plannedQuantity
                    }}</template></ElTableColumn
                  ><ElTableColumn
                    :label="dimension === 'task' ? '达成单数' : '达成数量'"
                    width="118"
                    align="right"
                    ><template #default="{ row }">{{
                      dimension === 'task' ? row.achievedTaskCount : row.achievedQuantity
                    }}</template></ElTableColumn
                  ><ElTableColumn
                    :label="dimension === 'task' ? '未完成单数' : '未完成数量'"
                    width="122"
                    align="right"
                    ><template #default="{ row }">{{
                      dimension === 'task'
                        ? row.taskCount - row.achievedTaskCount
                        : Math.max(0, row.plannedQuantity - row.achievedQuantity)
                    }}</template></ElTableColumn
                  ><ElTableColumn label="达成率" min-width="170"
                    ><template #default="{ row }"
                      ><strong>{{ centerRate(row) }}%</strong
                      ><ElProgress
                        :percentage="Math.min(100, centerRate(row))"
                        :show-text="false"
                        :stroke-width="5" /></template></ElTableColumn
                ></template> </ArtTableQuery></div
          ></div> </div
      ></ArtWorkspaceSplitter>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { uniq } from 'lodash-es'
  import dayjs from 'dayjs'
  import { computed, onMounted, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtTableQuery from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtTableQueryHeaderAction } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ProductionWorkCenterNavigator from '@/components/business/production-work-center-navigator/index.vue'
  import { exportExcel } from '@/utils/file'
  import {
    fetchExecutionAttendanceRange,
    fetchExecutionEvents,
    fetchExecutionPeople,
    fetchExecutionTasks,
    fetchProductionReports,
    type MesExecutionAttendance,
    type MesExecutionEvent,
    type MesExecutionPerson,
    type MesExecutionTask,
    type MesProductionReport
  } from '@mes/api'
  import { useExecutionScope } from './use-execution-scope'
  import {
    buildPersonEfficiencyRows,
    buildShiftAchievementRows,
    groupCenterAchievement,
    groupMachineAchievement,
    type CenterAchievementRow,
    type MachineAchievementRow,
    type PersonEfficiencyRow,
    type ShiftAchievementRow
  } from './execution-analytics-policy'

  type Mode = 'person' | 'shift' | 'line' | 'machine'
  const props = defineProps<{ mode: Mode }>()
  const configs = {
    person: {
      title: '人工效率',
      description: '按人员与班次核算标准产出工时和实际在岗时长。',
      icon: 'ri:user-star-line',
      permission: 'MesLaborEfficiency'
    },
    shift: {
      title: '当班达成',
      description: '对照班次排产任务和已审批报工，定位未达成原因。',
      icon: 'ri:calendar-check-line',
      permission: 'MesShiftAchievement'
    },
    line: {
      title: '产线达成率',
      description: '按生产日期、班次和工作中心查看任务与数量达成。',
      icon: 'ri:bar-chart-box-line',
      permission: 'MesLineAchievement'
    },
    machine: {
      title: '机台达成率',
      description: '按实际报工机台查看任务与数量达成。',
      icon: 'ri:dashboard-line',
      permission: 'MesMachineAchievement'
    }
  }
  const config = computed(() => configs[props.mode])
  const methodologyNote = computed(() => {
    const base = '统计依据为班次排产任务与已审批报工。'
    if (props.mode === 'person')
      return `${base}人工效率需要工艺标准时长和上机打卡记录，数据缺失时显示“—”。`
    if (props.mode === 'machine')
      return `${base}机台按任务首次报工选择的实际设备固定归集，未选择设备的任务列为“未分配机台”。`
    return `${base}达成率按当前所选任务或数量维度计算。`
  })
  const {
    scope,
    effectiveTenantId,
    workshopOptions,
    visibleCenters,
    loadScope,
    selectWorkshop,
    selectWorkCenter
  } = useExecutionScope()
  const dateRange = ref<[string, string] | null>([
    dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD')
  ])
  const shiftName = ref('')
  const dimension = ref<'task' | 'quantity'>('task')
  const onlyIncomplete = ref(false)
  const keyword = ref('')
  const tableRef = ref<ArtTableQueryExpose>()
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    ...(props.mode === 'line' || props.mode === 'machine'
      ? [{ key: 'dimension', slot: 'dimension-control' }]
      : []),
    ...(props.mode === 'shift' ? [{ key: 'incomplete', slot: 'incomplete-control' }] : []),
    { key: 'methodology', slot: 'methodology-control' },
    {
      type: 'export',
      permission: `${config.value.permission}:Export`,
      onClick: () => exportRows()
    }
  ])
  const searchModel = ref<Record<string, unknown>>({
    dateRange: dateRange.value,
    shiftName: '',
    keyword: ''
  })
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'dateRange',
      label: '统计日期',
      type: 'daterange',
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      key: 'shiftName',
      label: '班次',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部班次',
        options: shifts.value.map((value) => ({ label: value, value }))
      }
    },
    ...(props.mode === 'shift'
      ? [
          {
            key: 'keyword',
            label: '关键字',
            type: 'input' as const,
            props: { clearable: true, placeholder: '任务、工单、物料或项目' }
          }
        ]
      : [])
  ])
  function applySearch(params: Record<string, unknown>) {
    dateRange.value =
      Array.isArray(params.dateRange) && params.dateRange.length === 2
        ? [String(params.dateRange[0]), String(params.dateRange[1])]
        : null
    shiftName.value = String(params.shiftName || '')
    keyword.value = String(params.keyword || '')
    void loadData()
  }
  const tasks = ref<MesExecutionTask[]>([])
  const reports = ref<MesProductionReport[]>([])
  const events = ref<MesExecutionEvent[]>([])
  const attendance = ref<MesExecutionAttendance[]>([])
  const people = ref<MesExecutionPerson[]>([])
  const loading = ref(false)
  const resetting = ref(false)
  const error = ref('')
  const effectiveRange = computed<[string, string]>(
    () => dateRange.value || ['1900-01-01', '9999-12-31']
  )
  const shiftRows = computed(() =>
    buildShiftAchievementRows(tasks.value, reports.value, events.value, effectiveRange.value)
  )
  const centerRows = computed(() => groupCenterAchievement(shiftRows.value))
  const machineRows = computed(() => groupMachineAchievement(shiftRows.value))
  const personRows = computed(() =>
    buildPersonEfficiencyRows(reports.value, attendance.value, people.value, effectiveRange.value)
  )
  const allRows = computed(() =>
    props.mode === 'person'
      ? personRows.value
      : props.mode === 'shift'
        ? shiftRows.value
        : props.mode === 'machine'
          ? machineRows.value
          : centerRows.value
  )
  const shifts = computed(() => uniq(allRows.value.map((row) => row.shift)))
  const visibleRows = computed(() =>
    allRows.value.filter((row) => {
      if (shiftName.value && row.shift !== shiftName.value) return false
      if (props.mode === 'shift') {
        const item = row as ShiftAchievementRow
        if (onlyIncomplete.value && item.achievedQuantity >= item.plannedQuantity) return false
        if (
          keyword.value &&
          !`${item.task.taskNo} ${item.task.workOrder?.workOrderNo} ${item.task.workOrder?.materialCodeSnapshot} ${item.task.workOrder?.materialNameSnapshot} ${item.task.workOrder?.projectNameSnapshot}`
            .toLowerCase()
            .includes(keyword.value.toLowerCase())
        )
          return false
      }
      return true
    })
  )
  const ratio = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
  const centerRate = (raw: unknown) => {
    const row = raw as CenterAchievementRow
    return dimension.value === 'task'
      ? ratio(row.achievedTaskCount, row.taskCount)
      : ratio(row.achievedQuantity, row.plannedQuantity)
  }
  const metricCount = computed(() =>
    props.mode === 'person'
      ? new Set((visibleRows.value as PersonEfficiencyRow[]).map((row) => row.personId)).size
      : props.mode === 'shift'
        ? visibleRows.value.length
        : props.mode === 'machine'
          ? new Set(
              (visibleRows.value as MachineAchievementRow[])
                .map((row) => row.equipmentId)
                .filter(Boolean)
            ).size
          : new Set((visibleRows.value as CenterAchievementRow[]).map((row) => row.centerId)).size
  )
  const metricPlanned = computed(() =>
    props.mode === 'person'
      ? (visibleRows.value as PersonEfficiencyRow[])
          .reduce((sum, row) => sum + (row.outputHours || 0), 0)
          .toFixed(1)
      : dimension.value === 'task' && props.mode !== 'shift'
        ? (visibleRows.value as CenterAchievementRow[]).reduce((sum, row) => sum + row.taskCount, 0)
        : (visibleRows.value as Array<ShiftAchievementRow | CenterAchievementRow>).reduce(
            (sum, row) => sum + row.plannedQuantity,
            0
          )
  )
  const metricAchieved = computed(() =>
    props.mode === 'person'
      ? (visibleRows.value as PersonEfficiencyRow[])
          .reduce((sum, row) => sum + row.onPostHours, 0)
          .toFixed(1)
      : dimension.value === 'task' && props.mode !== 'shift'
        ? (visibleRows.value as CenterAchievementRow[]).reduce(
            (sum, row) => sum + row.achievedTaskCount,
            0
          )
        : (visibleRows.value as Array<ShiftAchievementRow | CenterAchievementRow>).reduce(
            (sum, row) => sum + row.achievedQuantity,
            0
          )
  )
  const metricRate = computed(() => {
    const denominator = Number(props.mode === 'person' ? metricAchieved.value : metricPlanned.value)
    if (denominator <= 0) return '—'
    const numerator = Number(props.mode === 'person' ? metricPlanned.value : metricAchieved.value)
    return `${ratio(numerator, denominator)}%`
  })

  async function collectPages<T>(
    fetcher: (current: number, size: number) => Promise<{ data: T[]; total: number }>
  ) {
    const result: T[] = []
    const size = 500
    for (let page = 1; page <= 20; page++) {
      const next = await fetcher(page, size)
      result.push(...next.data)
      if (result.length >= next.total || next.data.length === 0) break
    }
    if (result.length >= 10000) ElMessage.warning('统计记录达到 10000 条，请缩小日期范围')
    return result
  }
  let loadVersion = 0
  async function loadData() {
    const version = ++loadVersion
    loading.value = true
    tasks.value = []
    reports.value = []
    events.value = []
    attendance.value = []
    people.value = []
    error.value = ''
    const scopeQuery = {
      tenantId: effectiveTenantId.value,
      workCenterId: scope.selectedWorkCenterId || undefined,
      workCenterIds:
        scope.selectedWorkshopId && !scope.selectedWorkCenterId
          ? visibleCenters.value.map((item) => item.id)
          : undefined,
      dateRange: effectiveRange.value
    }
    try {
      const [nextTasks, nextReports, nextEvents, nextAttendance, nextPeople] = await Promise.all([
        collectPages((current, size) =>
          fetchExecutionTasks({
            current,
            size,
            ...scopeQuery,
            dateRange: undefined,
            statuses: ['unfinished', 'finished']
          })
        ),
        collectPages((current, size) =>
          fetchProductionReports({
            current,
            size,
            ...scopeQuery,
            dateRange: dateRange.value
              ? [dateRange.value[0], dayjs(dateRange.value[1]).add(1, 'day').format('YYYY-MM-DD')]
              : undefined,
            statuses: ['approved']
          })
        ),
        props.mode === 'person'
          ? Promise.resolve([])
          : collectPages((current, size) =>
              fetchExecutionEvents({ current, size, ...scopeQuery, kinds: ['exception', 'andon'] })
            ),
        props.mode === 'person'
          ? fetchExecutionAttendanceRange({ current: 1, size: 10000, ...scopeQuery })
          : Promise.resolve([]),
        props.mode === 'person'
          ? fetchExecutionPeople(effectiveTenantId.value)
          : Promise.resolve([])
      ])
      if (version !== loadVersion) return
      tasks.value = nextTasks
      reports.value = nextReports
      events.value = nextEvents
      attendance.value = nextAttendance
      people.value = nextPeople
    } catch {
      if (version === loadVersion) error.value = '统计数据加载失败，请重试'
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }
  async function resetFilters() {
    if (resetting.value) return
    resetting.value = true
    dateRange.value = [
      dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD')
    ]
    shiftName.value = ''
    dimension.value = 'task'
    onlyIncomplete.value = false
    keyword.value = ''
    await nextTick()
    try {
      await loadData()
    } finally {
      resetting.value = false
    }
  }
  async function exportRows() {
    if (!visibleRows.value.length) {
      ElMessage.info('当前条件下没有可导出的统计数据')
      return
    }
    try {
      if (props.mode === 'person')
        await exportExcel({
          data: (visibleRows.value as PersonEfficiencyRow[]).map((row) => ({
            date: row.date,
            shift: row.shift,
            department: row.departmentName,
            name: row.personName,
            outputHours: row.outputHours?.toFixed(2) || '',
            onPostHours: row.onPostHours.toFixed(2),
            efficiency:
              row.outputHours !== null && row.onPostHours
                ? `${ratio(row.outputHours, row.onPostHours)}%`
                : ''
          })),
          columns: [
            { key: 'date', title: '日期' },
            { key: 'shift', title: '班次' },
            { key: 'department', title: '车间' },
            { key: 'name', title: '姓名' },
            { key: 'outputHours', title: '产出工时(h)' },
            { key: 'onPostHours', title: '在岗时长(h)' },
            { key: 'efficiency', title: '人工效率' }
          ],
          filename: `人工效率-${dayjs().format('YYYYMMDD')}`
        })
      else if (props.mode === 'shift')
        await exportExcel({
          data: (visibleRows.value as ShiftAchievementRow[]).map((row) => ({
            date: row.date,
            shift: row.shift,
            center: row.centerName,
            taskNo: row.task.taskNo,
            workOrder: row.task.workOrder?.workOrderNo || '',
            operation: row.task.operationName,
            planned: row.plannedQuantity,
            achieved: row.achievedQuantity,
            remark: row.exceptionRemark,
            status: row.achievedQuantity >= row.plannedQuantity ? '已达成' : '未达成'
          })),
          columns: [
            { key: 'date', title: '日期' },
            { key: 'shift', title: '班次' },
            { key: 'center', title: '工作中心' },
            { key: 'taskNo', title: '任务单号' },
            { key: 'workOrder', title: '生产工单' },
            { key: 'operation', title: '工序' },
            { key: 'planned', title: '任务数' },
            { key: 'achieved', title: '当班完工' },
            { key: 'remark', title: '异常备注' },
            { key: 'status', title: '状态' }
          ],
          filename: `当班达成-${dayjs().format('YYYYMMDD')}`
        })
      else
        await exportExcel({
          data: (visibleRows.value as Array<CenterAchievementRow | MachineAchievementRow>).map(
            (row) => ({
              date: row.date,
              shift: row.shift,
              code:
                props.mode === 'machine'
                  ? (row as MachineAchievementRow).equipmentCode
                  : row.centerCode,
              equipment:
                props.mode === 'machine' ? (row as MachineAchievementRow).equipmentName : '',
              center: row.centerName,
              department: row.departmentName,
              planned: dimension.value === 'task' ? row.taskCount : row.plannedQuantity,
              achieved: dimension.value === 'task' ? row.achievedTaskCount : row.achievedQuantity,
              remaining:
                dimension.value === 'task'
                  ? row.taskCount - row.achievedTaskCount
                  : Math.max(0, row.plannedQuantity - row.achievedQuantity),
              rate: `${centerRate(row)}%`
            })
          ),
          columns: [
            { key: 'date', title: '日期' },
            { key: 'shift', title: '班次' },
            { key: 'code', title: props.mode === 'machine' ? '设备编号' : '工作中心编号' },
            ...(props.mode === 'machine' ? [{ key: 'equipment', title: '设备名称' }] : []),
            { key: 'center', title: '工作中心' },
            { key: 'department', title: '车间' },
            { key: 'planned', title: dimension.value === 'task' ? '任务单数' : '任务数量' },
            { key: 'achieved', title: dimension.value === 'task' ? '达成单数' : '达成数量' },
            { key: 'remaining', title: '未完成' },
            { key: 'rate', title: '达成率' }
          ],
          filename: `${config.value.title}-${dayjs().format('YYYYMMDD')}`
        })
    } catch {
      ElMessage.error('导出失败，请重试')
    }
  }
  watch(
    [() => scope.selectedWorkCenterId, () => scope.selectedWorkshopId, effectiveTenantId],
    () => {
      if (!resetting.value) void loadData()
    },
    { deep: true }
  )
  onMounted(() => {
    void loadData()
  })
</script>

<style scoped lang="scss">
  .execution-analytics {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .execution-analytics__body {
    flex: 1;
    min-height: 0;
  }

  .execution-analytics__scope,
  .execution-analytics__main {
    min-width: 0;
    min-height: 0;
  }

  .execution-analytics__main {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .execution-analytics__metrics {
    display: grid;
    flex: none;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .execution-analytics__metrics article {
    display: grid;
    gap: 5px;
    padding: 16px 18px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--custom-radius);
  }

  .execution-analytics__metrics article:last-child {
    background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
    border-color: color-mix(in srgb, var(--theme-color) 18%, var(--el-border-color-lighter));
  }

  .execution-analytics__metrics article:last-child strong {
    color: var(--theme-color);
  }

  .execution-analytics__metrics small,
  .execution-analytics__metrics span {
    color: var(--el-text-color-secondary);
  }

  .execution-analytics__metrics strong {
    font-size: 27px;
    line-height: 1.15;
    color: var(--el-text-color-primary);
  }

  .execution-analytics__metrics span {
    font-size: 11px;
  }

  .execution-analytics__card {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
  }

  .execution-analytics__table {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .execution-analytics__method-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 1000px) {
    .execution-analytics__scope {
      height: 300px;
    }
  }

  @media (width <= 700px) {
    .execution-analytics__metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
