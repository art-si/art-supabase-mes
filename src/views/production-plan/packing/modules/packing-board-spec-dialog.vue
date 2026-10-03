<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="grid gap-4">
      <ArtEntitySummary
        icon="ri:layout-grid-line"
        eyebrow="BOARD PACKING SPEC"
        :title="board?.boardNo || '包装参数'"
        description="轴线取生产单明细编号，板厚取生产工单专用参数；单块重量可补充。"
      />
      <ElAlert
        v-if="board && board.thicknessMm <= 0"
        title="工单尚未填写板厚，请先到生产工单维护专用参数。"
        type="warning"
        :closable="false"
        show-icon
      />
      <ArtForm
        v-model="model"
        :items="items"
        :span="12"
        :gutter="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { savePackingBoardSpec, type WorkOrderBoard } from '@mes/api'

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<WorkOrderBoard>>()
  const board = ref<WorkOrderBoard>()
  const model = reactive({ axis: '', thicknessMm: 0, unitWeightKg: null as number | null })
  const items: FormItem[] = [
    { key: 'axis', label: '轴线（明细编号）', type: 'text' },
    { key: 'thicknessMm', label: '成品厚度 mm（工单板厚）', type: 'text' },
    { key: 'unitWeightKg', label: '单块重量 kg（选填）', type: 'number', props: { min: 0 } }
  ]
  async function handleOpen(row: WorkOrderBoard): Promise<void> {
    board.value = row
    Object.assign(model, {
      axis: row.boardNo,
      thicknessMm: row.thicknessMm,
      unitWeightKg: row.unitWeightKg
    })
    await dialogRef.value?.handleOpen(row, {
      title: '包装参数',
      subtitle: `${row.area} · ${row.boardNo}`,
      confirmText: '保存参数',
      onConfirm: async () => {
        try {
          if (model.thicknessMm <= 0) {
            ElMessage.warning('请先在生产工单专用参数中填写有效板厚')
            return false
          }
          await savePackingBoardSpec(
            row.id,
            model.axis.trim(),
            model.thicknessMm,
            model.unitWeightKg
          )
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '包装参数保存失败，请检查内容后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
