<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="space-y-4">
      <ArtEntitySummary
        icon="ri:archive-stack-line"
        eyebrow="PACKED RECEIPTS"
        :title="workOrderNo || '生产工单'"
        description="查看已过账包号的入库、退库与净入库数量。"
      />
      <ArtSectionCard
        title="排包入库明细"
        subtitle="点击入库单号可查看原单据。"
        :loading="loading"
        :error="loadError"
        :empty="!rows.length"
        empty-title="暂无排包入库明细"
        empty-description="该工单尚未按包号办理完工入库。"
        @retry="loadRows"
      >
        <ArtTable
          v-if="rows.length"
          :data="rows"
          :columns="columns"
          row-key="lineId"
          :pagination="false"
          :scrollbar-always-on="false"
        />
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { ElButton } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { WMS_FINISHED_INBOUND_PATH } from '@/router/business-paths'
  import type { ColumnOption } from '@/types'
  import {
    fetchWorkOrderPackInboundDetails,
    type MesWorkOrder,
    type WorkOrderPackInboundDetail
  } from '@mes/api'

  const router = useRouter()
  const { hasAuth } = useAuth()
  const dialogRef = ref<ArtDialogExpose<MesWorkOrder>>()
  const workOrderId = ref('')
  const workOrderNo = ref('')
  const rows = ref<WorkOrderPackInboundDetail[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  let requestId = 0

  const columns: ColumnOption<WorkOrderPackInboundDetail>[] = [
    { prop: 'packNo', label: '包号', minWidth: 140 },
    {
      prop: 'documentNo',
      label: '完工入库单',
      minWidth: 175,
      formatter: (row) =>
        h(
          ElButton,
          {
            link: true,
            type: 'primary',
            onClick: () => openDocument(row.documentId)
          },
          () => row.documentNo
        )
    },
    { prop: 'lineNo', label: '行号', width: 80 },
    { prop: 'businessDate', label: '业务日期', minWidth: 115 },
    { prop: 'inboundQuantity', label: '入库数量', width: 115, align: 'right' },
    { prop: 'returnedQuantity', label: '退库数量', width: 115, align: 'right' },
    { prop: 'netQuantity', label: '净入库数量', width: 125, align: 'right' }
  ]

  function openDocument(documentId: string): void {
    if (!hasAuth('WmsFinishedInbound:View')) return
    void router.push({ path: WMS_FINISHED_INBOUND_PATH, query: { documentId } })
  }

  async function loadRows(): Promise<void> {
    if (!workOrderId.value) return
    const current = ++requestId
    loading.value = true
    loadError.value = null
    try {
      const data = await fetchWorkOrderPackInboundDetails(workOrderId.value)
      if (current === requestId) rows.value = data
    } catch {
      if (current === requestId) loadError.value = '排包入库明细加载失败，请重试'
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  async function handleOpen(order: MesWorkOrder): Promise<void> {
    workOrderId.value = order.id
    workOrderNo.value = order.workOrderNo
    rows.value = []
    loadError.value = null
    await dialogRef.value?.handleOpen(order, {
      title: '排包入库明细',
      subtitle: order.workOrderNo,
      showFooter: false,
      contentMaxHeight: '72vh'
    })
    void loadRows()
  }

  onBeforeUnmount(() => requestId++)
  defineExpose({ handleOpen })
</script>
