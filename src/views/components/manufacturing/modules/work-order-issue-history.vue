<template>
  <ArtSectionCard
    title="领用流水"
    subtitle="按实际过账时间追溯工单发料与退料。"
    :loading="loading"
    :error="error"
    :empty="!rows.length"
    empty-title="暂无领退料流水"
    empty-description="工单的领料或退料过账后，流水会显示在这里。"
    :show-scrollbar="false"
    @retry="loadRows"
  >
    <template #actions>
      <ElButton link type="primary" :loading="loading" @click="loadRows">
        <template #icon><ArtSvgIcon icon="ri:refresh-line" /></template>
        刷新
      </ElButton>
    </template>
    <ArtTable
      v-if="rows.length"
      :data="rows"
      :columns="columns"
      row-key="id"
      table-layout="fixed"
      :pagination="{ current: page, size, total }"
      :pagination-options="{ pageSizes: [10, 20, 30], hideOnSinglePage: true }"
      :loading="loading"
      @pagination:current-change="page = $event"
      @pagination:size-change="changeSize"
    />
  </ArtSectionCard>
</template>

<script setup lang="tsx">
  import { ElButton, ElTag } from 'element-plus'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import type { ColumnOption } from '@/types'
  import { formatDateTimeValue, formatNumberValue } from '@/utils/ui'
  import { withTimeout } from '@/utils/async'
  import {
    fetchWorkOrderIssueHistory,
    type MesWorkOrder,
    type MesWorkOrderIssueHistoryItem
  } from '@mes/api'

  const props = withDefaults(defineProps<{ row: MesWorkOrder; active?: boolean }>(), {
    active: true
  })
  const rows = shallowRef<MesWorkOrderIssueHistoryItem[]>([])
  const page = ref(1)
  const size = ref(10)
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  let requestId = 0
  let activeRequest: AbortController | undefined

  const columns: ColumnOption<MesWorkOrderIssueHistoryItem>[] = [
    {
      prop: 'occurredAt',
      label: '过账时间',
      width: 164,
      formatter: (row) => formatDateTimeValue(row.occurredAt)
    },
    { prop: 'documentNo', label: '单据编号', minWidth: 170 },
    {
      prop: 'kind',
      label: '类型',
      width: 135,
      formatter: (row) => (
        <ElTag type={row.kind === 'issue' ? 'primary' : 'success'} effect="plain" size="small">
          {row.kind === 'issue' ? (
            '领料'
          ) : (
            <ArtDictDisplay
              dictCode="wmsProductionReturnType"
              value={row.returnType}
              display="text"
              emptyText="退料"
              unknownText="退料"
            />
          )}
        </ElTag>
      )
    },
    { prop: 'materialCode', label: '物料编码', minWidth: 135 },
    { prop: 'materialName', label: '物料名称', minWidth: 180, showOverflowTooltip: true },
    { prop: 'batchNo', label: '批次', minWidth: 130, formatter: (row) => row.batchNo || '—' },
    { prop: 'warehouseName', label: '仓库', minWidth: 145 },
    { prop: 'binName', label: '库位', minWidth: 125, formatter: (row) => row.binName || '—' },
    {
      prop: 'quantity',
      label: '实发 / 实退',
      width: 130,
      align: 'right',
      formatter: (row) => formatNumberValue(row.quantity)
    },
    { prop: 'unitName', label: '单位', width: 85 },
    { prop: 'remark', label: '备注', minWidth: 170, showOverflowTooltip: true }
  ]

  function changeSize(value: number): void {
    size.value = value
    page.value = 1
  }

  async function loadRows(): Promise<void> {
    const currentRequest = ++requestId
    activeRequest?.abort()
    if (!props.active) return
    const controller = new AbortController()
    activeRequest = controller
    loading.value = true
    error.value = ''
    rows.value = []
    total.value = 0
    try {
      const result = await withTimeout(
        fetchWorkOrderIssueHistory({
          tenantId: props.row.tenantId,
          workOrderId: props.row.id,
          current: page.value,
          size: size.value,
          signal: controller.signal
        }),
        10_000,
        '领用流水读取超时，请重试'
      )
      if (currentRequest !== requestId) return
      rows.value = result.data
      total.value = result.total
    } catch {
      if (currentRequest !== requestId) return
      error.value = '领用流水加载失败，请检查网络和查看权限后重试。'
    } finally {
      if (currentRequest === requestId) {
        controller.abort()
        activeRequest = undefined
        loading.value = false
      }
    }
  }

  watch(
    () => [props.row.id, props.row.tenantId],
    () => {
      page.value = 1
      void loadRows()
    },
    { immediate: true }
  )
  watch([page, size, () => props.active], () => void loadRows())
  onBeforeUnmount(() => {
    requestId += 1
    activeRequest?.abort()
  })
</script>
