<template>
  <div class="pmis-equipment-tasks">
    <ElAlert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <div class="pmis-equipment-tasks__table">
      <ArtTableQuery
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
          labelWidth: 80,
          showExpand: false
        }"
        :data="rows"
        :loading="loading"
        :pagination="{ current: page, size: 20, total }"
        :table-props="{
          rowKey: 'id',
          emptyHeight: '100%',
          tableLayout: 'fixed',
          emptyText: '当前范围暂无设备任务'
        }"
        focus-scope-selector=".execution-event-page__body"
        focusable
        @search="applySearch"
        @reset="resetSearch"
        @pagination:current-change="changePage"
      >
        <ElTableColumn type="index" label="序号" width="62" :index="rowIndex" />
        <ElTableColumn label="计划日期" width="118" prop="plannedDate" />
        <ElTableColumn label="任务单号" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row as MesPmisEquipmentTask)">{{
              row.taskNo
            }}</ElButton>
          </template>
        </ElTableColumn>
        <ElTableColumn label="设备" min-width="230">
          <template #default="{ row }">
            <BusinessTableIdentityCell
              :primary="row.equipmentName"
              :secondary="row.equipmentCode"
              icon="ri:settings-3-line"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="车间 / 产线"
          min-width="144"
          prop="departmentName"
          show-overflow-tooltip
        />
        <ElTableColumn label="方案" min-width="180" prop="planName" show-overflow-tooltip />
        <ElTableColumn label="班次" width="92">
          <template #default="{ row }">{{ row.shiftName || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn
          label="负责人"
          min-width="105"
          prop="responsibleName"
          show-overflow-tooltip
        />
        <ElTableColumn label="状态" width="118">
          <template #default="{ row }">
            <ElTag :type="statusTone(row.displayStatus)" effect="plain" size="small">
              {{ statusLabel(row.displayStatus) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="88" fixed="right">
          <template #default="{ row }"
            ><ArtButtonTable type="view" @click="openDetail(row as MesPmisEquipmentTask)"
          /></template>
        </ElTableColumn>
      </ArtTableQuery>
    </div>
  </div>

  <ArtDrawer ref="detailDrawerRef" :title="`${kindLabel}任务详情`" size="lg" :show-footer="false">
    <div v-if="detailTask" class="pmis-equipment-tasks__detail">
      <div class="pmis-equipment-tasks__detail-heading">
        <div>
          <small>{{ detailTask.taskNo }}</small>
          <h3>{{ detailTask.equipmentName }}</h3>
          <p>{{ detailTask.equipmentCode }} · {{ detailTask.departmentName || '未分配产线' }}</p>
        </div>
        <ElTag :type="statusTone(detailTask.displayStatus)" effect="plain">
          {{ statusLabel(detailTask.displayStatus) }}
        </ElTag>
      </div>
      <ArtSectionTitle>任务信息</ArtSectionTitle>
      <ElDescriptions :column="detailColumns" border>
        <ElDescriptionsItem label="执行方案">{{ detailTask.planName }}</ElDescriptionsItem>
        <ElDescriptionsItem label="负责人">{{
          detailTask.responsibleName || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem label="计划日期">{{ detailTask.plannedDate }}</ElDescriptionsItem>
        <ElDescriptionsItem label="要求完成">{{ detailTask.dueDate || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="班次">{{ detailTask.shiftName || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="完成时间">{{
          formatTime(detailTask.completedAt)
        }}</ElDescriptionsItem>
        <ElDescriptionsItem label="执行说明" :span="detailColumns">
          {{ detailTask.executionSummary || '—' }}
        </ElDescriptionsItem>
      </ElDescriptions>
      <ElButton type="primary" plain @click="$emit('open-task')">
        <ArtSvgIcon icon="ri:external-link-line" />前往 PMIS {{ kindLabel }}任务
      </ElButton>
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { computed, ref, watch } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtTableQuery from '@/components/core/tables/art-table-query/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import {
    fetchMesPmisEquipmentTasks,
    type MesPmisEquipmentKind,
    type MesPmisEquipmentTask
  } from '@mes/api'

  const mesEquipmentTaskStatusOptions = useDictionaryOptions('mesEquipmentTaskStatus')

  defineOptions({ name: 'MesPmisEquipmentTasks' })
  const props = defineProps<{
    headerActions?: ArtTableQueryHeaderAction[]
    kind: MesPmisEquipmentKind
    tenantId: string | null
    departmentIds?: string[]
    workCenterId?: string
    dateRange: [string, string] | null
    status: string
    keyword: string
  }>()
  const emit = defineEmits<{ 'open-task': []; 'loading-change': [loading: boolean] }>()

  const kindLabel = computed(
    () => ({ inspection: '设备点检', patrol: '设备巡检', maintenance: '设备保养' })[props.kind]
  )
  const rows = ref<MesPmisEquipmentTask[]>([])
  const total = ref(0)
  const page = ref(1)
  const loading = ref(false)
  const resetting = ref(false)
  const error = ref('')
  const detailTask = ref<MesPmisEquipmentTask | null>(null)
  const compactDetail = useMediaQuery('(max-width: 640px)')
  const detailColumns = computed(() => (compactDetail.value ? 1 : 2))
  const detailDrawerRef = ref<ArtDrawerExpose<MesPmisEquipmentTask>>()
  const tableRef = ref<ArtTableQueryExpose>()
  const searchModel = ref<Record<string, unknown>>({
    dateRange: props.dateRange,
    status: props.status,
    keyword: props.keyword
  })
  const appliedDateRange = ref<[string, string] | null>(props.dateRange)
  const appliedStatus = ref(props.status)
  const appliedKeyword = ref(props.keyword)
  const searchItems: SearchFormItem[] = [
    {
      key: 'dateRange',
      label: '计划日期',
      type: 'daterange',
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: mesEquipmentTaskStatusOptions
      }
    },
    {
      key: 'keyword',
      label: '关键字',
      type: 'input',
      props: { clearable: true, placeholder: '任务单号、设备或方案' }
    }
  ]
  async function applySearch(params: Record<string, unknown>) {
    appliedDateRange.value =
      Array.isArray(params.dateRange) && params.dateRange.length === 2
        ? [String(params.dateRange[0]), String(params.dateRange[1])]
        : null
    appliedStatus.value = String(params.status || '')
    appliedKeyword.value = String(params.keyword || '')
    page.value = 1
    await load()
  }
  async function resetSearch() {
    if (resetting.value) return
    resetting.value = true
    try {
      await applySearch({
        dateRange: props.dateRange,
        status: props.status,
        keyword: props.keyword
      })
    } finally {
      resetting.value = false
    }
  }
  function changePage(nextPage: number) {
    page.value = nextPage
    void load()
  }
  const formatTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const rowIndex = (index: number) => (page.value - 1) * 20 + index + 1
  const statusLabel = (status: string) =>
    ({
      pending: '待执行',
      overdue: '已逾期',
      pending_confirm: '待确认',
      completed: '已完成',
      completed_overdue: '逾期完成',
      exempt: '已豁免'
    })[status] || status
  const statusTone = (status: string): 'warning' | 'danger' | 'success' | 'info' =>
    status === 'overdue' || status === 'completed_overdue'
      ? 'danger'
      : status === 'pending' || status === 'pending_confirm'
        ? 'warning'
        : status === 'completed'
          ? 'success'
          : 'info'

  let loadVersion = 0
  async function load() {
    const version = ++loadVersion
    loading.value = true
    rows.value = []
    total.value = 0
    emit('loading-change', true)
    error.value = ''
    try {
      const result = await fetchMesPmisEquipmentTasks({
        kind: props.kind,
        tenantId: props.tenantId,
        departmentIds: props.departmentIds,
        workCenterId: props.workCenterId,
        dateRange: appliedDateRange.value,
        status: appliedStatus.value,
        keyword: appliedKeyword.value,
        current: page.value,
        size: 20
      })
      if (version !== loadVersion) return
      rows.value = result.data
      total.value = result.total
      if (detailTask.value)
        detailTask.value = result.data.find((item) => item.id === detailTask.value?.id) || null
    } catch {
      if (version === loadVersion) error.value = 'PMIS 设备任务加载失败，请重试'
    } finally {
      if (version === loadVersion) {
        loading.value = false
        emit('loading-change', false)
      }
    }
  }
  function openDetail(row: MesPmisEquipmentTask) {
    detailTask.value = row
    detailDrawerRef.value?.handleOpen(row, { title: `${kindLabel.value}任务详情` })
  }
  let previousKind = props.kind
  watch(
    () => [
      props.kind,
      props.tenantId,
      props.departmentIds,
      props.workCenterId,
      props.dateRange,
      props.status,
      props.keyword
    ],
    () => {
      appliedDateRange.value = props.dateRange
      appliedStatus.value = props.status
      appliedKeyword.value = props.keyword
      searchModel.value = {
        dateRange: props.dateRange,
        status: props.status,
        keyword: props.keyword
      }
      if (props.kind !== previousKind) {
        previousKind = props.kind
        rows.value = []
        total.value = 0
        detailTask.value = null
      }
      page.value = 1
      void load()
    },
    { deep: true, immediate: true }
  )
  defineExpose({ refresh: load, tableRef })
</script>

<style scoped lang="scss">
  .pmis-equipment-tasks {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;

    &__table {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }

    &__detail {
      display: grid;
      gap: 20px;
    }

    &__detail-heading {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      justify-content: space-between;

      h3 {
        margin: 5px 0;
        font-size: 20px;
      }

      small,
      p {
        color: var(--el-text-color-secondary);
      }

      p {
        margin: 0;
      }
    }

    @media (width <= 600px) {
      &__detail-heading {
        flex-direction: column;
      }
    }
  }
</style>
