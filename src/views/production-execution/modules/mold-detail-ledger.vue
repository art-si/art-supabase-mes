<template>
  <ArtPermissionGuard permission="MesMoldDetail:View" resource-name="调机明细">
    <div class="mold-ledger business-workspace-page art-full-height"
      ><BusinessWorkspaceHeader
        title="调机明细"
        description="追溯换模开始、下模完成、人员、耗时和维修记录。"
        icon="ri:tools-line"
        density="compact"
        refreshable
        :refresh-loading="loading"
        @refresh="loadRows"
        ><template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template
      ></BusinessWorkspaceHeader>
      <ArtWorkspaceSplitter
        class="mold-ledger__body"
        primary-size="270px"
        primary-min="240px"
        primary-max="360px"
        :breakpoint="900"
      >
        <template #primary>
          <aside class="mold-ledger__scope"
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
        <div class="mold-ledger__main">
          <div class="mold-ledger__card">
            <ElAlert v-if="error" :title="error" type="error" show-icon :closable="false" />
            <div class="mold-ledger__table"
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
                :data="rows"
                :loading="loading"
                :pagination="{ current: page, size, total }"
                :table-props="{
                  rowKey: 'id',
                  tableLayout: 'fixed',
                  emptyHeight: '100%',
                  emptyText: '当前条件下暂无换模记录'
                }"
                focus-scope-selector=".mold-ledger__body"
                focusable
                @search="applySearch"
                @reset="resetFilters"
                @pagination:current-change="page = $event"
                @pagination:size-change="size = $event"
                ><ElTableColumn
                  type="index"
                  label="序号"
                  width="62"
                  :index="rowIndex" /><ElTableColumn label="生产工单 / 任务单" min-width="220"
                  ><template #default="{ row }"
                    ><button
                      type="button"
                      class="art-table__cell-link"
                      @click.stop="openDetail(row)"
                    >
                      <BusinessTableIdentityCell
                        :primary="row.task?.workOrder?.workOrderNo"
                        :secondary="row.task?.taskNo"
                        icon="ri:tools-line"
                      /> </button></template></ElTableColumn
                ><ElTableColumn label="序列 / 类型" min-width="116"
                  ><template #default="{ row }"
                    >{{ row.task?.sequenceNo ?? '—' }} /
                    {{ row.task?.sequenceType || '—' }}</template
                  ></ElTableColumn
                ><ElTableColumn label="产品 / 工序" min-width="195"
                  ><template #default="{ row }"
                    ><BusinessTableIdentityCell
                      :primary="`${row.task?.workOrder?.materialCodeSnapshot || '—'} ${row.task?.workOrder?.materialNameSnapshot || ''}`"
                      :secondary="`${row.task?.operationCode || '—'} · ${row.task?.operationName || '—'}`"
                    /> </template></ElTableColumn
                ><ElTableColumn label="项目 / 规格" min-width="180" show-overflow-tooltip
                  ><template #default="{ row }"
                    >{{ row.task?.workOrder?.projectNameSnapshot || '—' }} /<br />
                    {{ row.task?.workOrder?.specificationSnapshot || '—' }}</template
                  ></ElTableColumn
                ><ElTableColumn
                  label="工作中心"
                  prop="workCenter.name"
                  min-width="130" /><ElTableColumn
                  label="工单 / 完工数"
                  min-width="116"
                  align="right"
                  ><template #default="{ row }"
                    >{{ row.task?.workOrder?.orderQuantity ?? '—' }} /
                    {{ row.task?.completedQuantity ?? '—' }}</template
                  ></ElTableColumn
                ><ElTableColumn label="要求完工日" width="116"
                  ><template #default="{ row }">{{
                    row.task?.requiredCompletionDate || '—'
                  }}</template></ElTableColumn
                ><ElTableColumn label="模具" min-width="150"
                  ><template #default="{ row }"
                    >{{ row.details.moldCode || '—' }} ·
                    {{ row.details.moldName || row.title }}</template
                  ></ElTableColumn
                ><ElTableColumn label="上模时间" width="152"
                  ><template #default="{ row }">{{
                    formatTime(row.occurredAt)
                  }}</template></ElTableColumn
                ><ElTableColumn label="下模时间" width="152"
                  ><template #default="{ row }">{{
                    formatTime(row.completedAt)
                  }}</template></ElTableColumn
                ><ElTableColumn label="调模时长" width="104" align="right"
                  ><template #default="{ row }">{{ durationHours(row) }}</template></ElTableColumn
                ><ElTableColumn label="标准调模工时" width="116" align="right"
                  ><template #default="{ row }">{{ setupHours(row) }}</template></ElTableColumn
                ><ElTableColumn label="上模人员" width="110"
                  ><template #default="{ row }">{{
                    personName(String(row.details.operatorPersonId || ''))
                  }}</template></ElTableColumn
                ><ElTableColumn label="装夹" min-width="116" show-overflow-tooltip
                  ><template #default="{ row }">{{
                    row.details.clamping || '—'
                  }}</template></ElTableColumn
                ><ElTableColumn label="状态" width="92"
                  ><template #default="{ row }"
                    ><ElTag
                      :type="row.status === 'closed' ? 'success' : 'warning'"
                      effect="plain"
                      >{{ row.status === 'closed' ? '已下模' : '上模中' }}</ElTag
                    ></template
                  ></ElTableColumn
                ><ElTableColumn label="操作" fixed="right" width="78"
                  ><template #default="{ row }"
                    ><ArtButtonTable
                      type="view"
                      @click="
                        openDetail(row)
                      " /></template></ElTableColumn></ArtTableQuery></div></div></div
      ></ArtWorkspaceSplitter>
      <ArtDrawer ref="detailDrawerRef" size="lg" :show-footer="false"
        ><div v-if="detail" class="mold-ledger__detail"
          ><div class="mes-production-detail-intro">
            <span aria-hidden="true"><ArtSvgIcon icon="ri:tools-line" /></span>
            <div>
              <small>{{ detail.details.moldCode || '模具记录' }}</small>
              <h3>{{ detail.details.moldName || detail.title }}</h3>
              <p>{{ detail.workCenter?.name || '未指定工作中心' }}</p>
            </div>
            <ElTag :type="detail.status === 'closed' ? 'success' : 'warning'" effect="plain">
              {{ detail.status === 'closed' ? '已下模' : '上模中' }}
            </ElTag>
          </div>
          <ArtSectionTitle>关联生产任务</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border
            ><ElDescriptionsItem label="生产工单">{{
              detail.task?.workOrder?.workOrderNo || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="任务单号">{{
              detail.task?.taskNo || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="工序"
              >{{ detail.task?.operationCode }} {{ detail.task?.operationName }}</ElDescriptionsItem
            ><ElDescriptionsItem label="序列 / 类型"
              >{{ detail.task?.sequenceNo ?? '—' }} /
              {{ detail.task?.sequenceType || '—' }}</ElDescriptionsItem
            ><ElDescriptionsItem label="项目名称">{{
              detail.task?.workOrder?.projectNameSnapshot || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="规格型号">{{
              detail.task?.workOrder?.specificationSnapshot || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="工单 / 完工数"
              >{{ detail.task?.workOrder?.orderQuantity ?? '—' }} /
              {{ detail.task?.completedQuantity ?? '—' }}</ElDescriptionsItem
            ><ElDescriptionsItem label="要求完工日">{{
              detail.task?.requiredCompletionDate || '—'
            }}</ElDescriptionsItem>
          </ElDescriptions>
          <ArtSectionTitle>上模与下模</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem label="工作中心">{{
              detail.workCenter?.name || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="上模时间">{{
              formatTime(detail.occurredAt)
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="下模时间">{{
              formatTime(detail.completedAt)
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="调模时长">{{ durationHours(detail) }}</ElDescriptionsItem
            ><ElDescriptionsItem label="标准调模工时">{{ setupHours(detail) }}</ElDescriptionsItem
            ><ElDescriptionsItem label="上模人员">{{
              personName(String(detail.details.operatorPersonId || ''))
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="下模人员">{{
              personName(String(detail.details.unloadPersonId || ''))
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="库位">{{
              detail.details.location || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="下模库位">{{
              detail.details.unloadLocation || '—'
            }}</ElDescriptionsItem>
          </ElDescriptions>
          <ArtSectionTitle>模具维护</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem label="维修类型">{{
              detail.details.repairType || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="维修日期">{{
              detail.details.repairDate || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="装夹方式">{{
              detail.details.clamping || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="关联质检批号">{{
              detail.details.inspectionBatchNo || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="维修人员">{{
              personName(String(detail.details.repairPersonId || ''))
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="问题描述" :span="detailColumns">{{
              detail.details.problemDescription || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="处理记录" :span="detailColumns">{{
              detail.details.resolution || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="备注" :span="detailColumns">{{
              detail.remark || '—'
            }}</ElDescriptionsItem></ElDescriptions
          ><ArtSectionTitle v-if="detail.media?.length">现场附件</ArtSectionTitle>
          <a
            v-for="(url, index) in detail.media"
            :key="url"
            :href="url"
            target="_blank"
            rel="noopener noreferrer"
            ><ArtSvgIcon icon="ri:attachment-2" />现场附件 {{ index + 1 }}</a
          ></div
        ></ArtDrawer
      >
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import './production-detail-intro.scss'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import { ElMessage } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtTableQuery from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import type { ArtTableQueryHeaderAction } from '@/components/core/tables/art-table-query/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ProductionWorkCenterNavigator from '@/components/business/production-work-center-navigator/index.vue'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { exportExcel } from '@/utils/file'
  import {
    fetchExecutionEvents,
    fetchExecutionPeople,
    type MesExecutionEvent,
    type MesExecutionPerson
  } from '@mes/api'
  import { useExecutionScope } from './use-execution-scope'

  const mesMoldMountStatusOptions = useDictionaryOptions('mesMoldMountStatus')

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
  const statuses = ref<string[]>([])
  const keyword = ref('')
  const tableRef = ref<ArtTableQueryExpose>()
  const compactDetail = useMediaQuery('(max-width: 640px)')
  const detailColumns = computed(() => (compactDetail.value ? 1 : 2))
  const headerActions: ArtTableQueryHeaderAction[] = [
    { type: 'export', permission: 'MesMoldDetail:Export', onClick: () => exportRows() }
  ]
  const searchModel = ref<Record<string, unknown>>({
    dateRange: dateRange.value,
    statuses: [],
    keyword: ''
  })
  const searchItems: SearchFormItem[] = [
    {
      key: 'dateRange',
      label: '调机日期',
      type: 'daterange',
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      key: 'statuses',
      label: '状态',
      type: 'select',
      props: {
        clearable: true,
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        placeholder: '全部状态',
        options: mesMoldMountStatusOptions
      }
    },
    {
      key: 'keyword',
      label: '关键字',
      type: 'input',
      props: { clearable: true, placeholder: '模具、任务或工单' }
    }
  ]
  function applySearch(params: Record<string, unknown>) {
    dateRange.value =
      Array.isArray(params.dateRange) && params.dateRange.length === 2
        ? [String(params.dateRange[0]), String(params.dateRange[1])]
        : null
    statuses.value = Array.isArray(params.statuses) ? params.statuses.map(String) : []
    keyword.value = String(params.keyword || '')
    if (page.value !== 1) page.value = 1
    else void loadRows()
  }
  const rows = ref<MesExecutionEvent[]>([])
  const people = ref<MesExecutionPerson[]>([])
  const page = ref(1)
  const size = ref(20)
  const total = ref(0)
  const loading = ref(false)
  const resetting = ref(false)
  const error = ref('')
  const detail = ref<MesExecutionEvent | null>(null)
  const detailDrawerRef = ref<ArtDrawerExpose<MesExecutionEvent>>()
  const rowIndex = (index: number) => (page.value - 1) * size.value + index + 1
  const formatTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const personName = (id: string) => people.value.find((item) => item.id === id)?.name || '—'
  const durationHours = (raw: unknown) => {
    const row = raw as MesExecutionEvent
    return row.completedAt
      ? `${Math.max(0, dayjs(row.completedAt).diff(dayjs(row.occurredAt), 'minute') / 60).toFixed(2)} h`
      : '—'
  }
  const setupHours = (raw: unknown) => {
    const task = (raw as MesExecutionEvent).task
    const step = task?.workOrder?.routeSnapshot?.steps?.find(
      (item) => item.id === task.routeStepSnapshotId || item.code === task.operationCode
    )
    return typeof step?.setupMinutes === 'number' ? `${(step.setupMinutes / 60).toFixed(2)} h` : '—'
  }
  let loadVersion = 0
  async function loadRows() {
    const version = ++loadVersion
    loading.value = true
    rows.value = []
    total.value = 0
    error.value = ''
    try {
      const result = await fetchExecutionEvents({
        current: page.value,
        size: size.value,
        tenantId: effectiveTenantId.value,
        workCenterId: scope.selectedWorkCenterId || undefined,
        workCenterIds:
          scope.selectedWorkshopId && !scope.selectedWorkCenterId
            ? visibleCenters.value.map((item) => item.id)
            : undefined,
        kinds: ['mold'],
        statuses: statuses.value,
        dateRange: dateRange.value || undefined,
        keyword: keyword.value
      })
      if (version !== loadVersion) return
      rows.value = result.data
      total.value = result.total
    } catch {
      if (version === loadVersion) error.value = '换模明细加载失败，请重试'
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
    statuses.value = []
    keyword.value = ''
    page.value = 1
    await nextTick()
    try {
      await loadRows()
    } finally {
      resetting.value = false
    }
  }
  function openDetail(raw: unknown) {
    detail.value = raw as MesExecutionEvent
    detailDrawerRef.value?.handleOpen(detail.value, { title: '调机详情' })
  }
  async function exportRows() {
    try {
      const result = await fetchExecutionEvents({
        current: 1,
        size: 10000,
        tenantId: effectiveTenantId.value,
        workCenterId: scope.selectedWorkCenterId || undefined,
        workCenterIds:
          scope.selectedWorkshopId && !scope.selectedWorkCenterId
            ? visibleCenters.value.map((item) => item.id)
            : undefined,
        kinds: ['mold'],
        statuses: statuses.value,
        dateRange: dateRange.value || undefined,
        keyword: keyword.value
      })
      if (!result.data.length) {
        ElMessage.info('当前条件下没有可导出的记录')
        return
      }
      if (result.total > 10000) {
        ElMessage.warning('记录超过 10000 条，请缩小日期范围')
        return
      }
      await exportExcel({
        data: result.data.map((row) => ({
          workOrder: row.task?.workOrder?.workOrderNo || '',
          taskNo: row.task?.taskNo || '',
          product: row.task?.workOrder?.materialCodeSnapshot || '',
          productName: row.task?.workOrder?.materialNameSnapshot || '',
          specification: row.task?.workOrder?.specificationSnapshot || '',
          project: row.task?.workOrder?.projectNameSnapshot || '',
          sequenceNo: row.task?.sequenceNo ?? '',
          sequenceType: row.task?.sequenceType || '',
          operation: row.task?.operationName || '',
          center: row.workCenter?.name || '',
          orderQuantity: row.task?.workOrder?.orderQuantity ?? '',
          completedQuantity: row.task?.completedQuantity ?? '',
          requiredCompletionDate: row.task?.requiredCompletionDate || '',
          moldCode: String(row.details.moldCode || ''),
          start: formatTime(row.occurredAt),
          end: formatTime(row.completedAt),
          hours: durationHours(row),
          setupHours: setupHours(row),
          operator: personName(String(row.details.operatorPersonId || '')),
          unloadOperator: personName(String(row.details.unloadPersonId || '')),
          clamping: String(row.details.clamping || ''),
          remark: row.remark
        })),
        columns: [
          { key: 'workOrder', title: '生产工单' },
          { key: 'taskNo', title: '任务单号' },
          { key: 'product', title: '物料编码' },
          { key: 'productName', title: '物料描述' },
          { key: 'specification', title: '规格型号' },
          { key: 'project', title: '项目名称' },
          { key: 'sequenceNo', title: '工序序列' },
          { key: 'sequenceType', title: '序列类型' },
          { key: 'operation', title: '工序' },
          { key: 'center', title: '工作中心' },
          { key: 'orderQuantity', title: '工单数量' },
          { key: 'completedQuantity', title: '完工数量' },
          { key: 'requiredCompletionDate', title: '要求完工日期' },
          { key: 'moldCode', title: '模具编号' },
          { key: 'start', title: '开始调模' },
          { key: 'end', title: '结束调模' },
          { key: 'hours', title: '调模时长(h)' },
          { key: 'setupHours', title: '标准调模工时(h)' },
          { key: 'operator', title: '上模人员' },
          { key: 'unloadOperator', title: '下模人员' },
          { key: 'clamping', title: '装夹' },
          { key: 'remark', title: '备注' }
        ],
        filename: `调机明细-${dayjs().format('YYYYMMDD')}`
      })
    } catch {
      ElMessage.error('导出失败，请重试')
    }
  }
  watch(
    [
      () => scope.selectedWorkCenterId,
      () => scope.selectedWorkshopId,
      effectiveTenantId,
      page,
      size
    ],
    () => {
      if (!resetting.value) void loadRows()
    },
    { deep: true }
  )
  watch(
    effectiveTenantId,
    async () => {
      try {
        people.value = await fetchExecutionPeople(effectiveTenantId.value)
      } catch {
        people.value = []
      }
    },
    { immediate: true }
  )
  onMounted(() => {
    void loadRows()
  })
</script>

<style scoped lang="scss">
  .mold-ledger {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .mold-ledger__body {
    flex: 1;
  }

  .mold-ledger__scope,
  .mold-ledger__main {
    min-width: 0;
    min-height: 0;
  }

  .mold-ledger__main {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mold-ledger__table {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .mold-ledger__card {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
  }

  .mold-ledger__table :deep(.art-table-query) {
    flex: 1;
    min-height: 0;
  }

  .mold-ledger__detail {
    display: grid;
    gap: 16px;
  }

  .mold-ledger__detail a {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    width: fit-content;
    padding: 8px 10px;
    color: var(--theme-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--custom-radius);
  }
</style>
