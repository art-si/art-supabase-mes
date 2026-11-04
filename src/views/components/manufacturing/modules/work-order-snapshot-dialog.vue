<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <WorkOrderSnapshotPanel
      v-if="openData"
      :row="openData.row"
      :mode="openData.mode"
      :can-edit="openData.canEdit"
      @success="handlePanelSuccess"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type { MesWorkOrder } from '@mes/api'
  import WorkOrderSnapshotPanel, {
    type WorkOrderSnapshotMode
  } from './work-order-snapshot-panel.vue'

  export type { WorkOrderSnapshotMode } from './work-order-snapshot-panel.vue'

  export interface WorkOrderSnapshotDialogOpenData {
    row: MesWorkOrder
    mode: WorkOrderSnapshotMode
    canEdit: boolean
  }

  const dialogRef = ref<ArtDialogExpose<WorkOrderSnapshotDialogOpenData>>()
  const openData = shallowRef<WorkOrderSnapshotDialogOpenData>()
  const emit = defineEmits<{ success: [row: MesWorkOrder] }>()

  function handlePanelSuccess(updated: MesWorkOrder): void {
    if (openData.value) openData.value = { ...openData.value, row: updated }
    emit('success', updated)
  }

  async function handleOpen(data: WorkOrderSnapshotDialogOpenData): Promise<void> {
    openData.value = data
    await dialogRef.value?.handleOpen(data, {
      title: data.mode === 'bom' ? '工单 BOM' : '工单工艺路线',
      subtitle: data.row.materialNameSnapshot,
      showFooter: false,
      contentMaxHeight: '72vh'
    })
  }

  defineExpose({ handleOpen })
</script>
