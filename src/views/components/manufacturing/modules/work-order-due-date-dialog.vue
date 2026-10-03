<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="work-order-due-date">
      <ArtEntitySummary
        class="work-order-due-date__context"
        icon="ri:calendar-check-line"
        eyebrow="DELIVERY DATE"
        title="交期维护"
        :description="`将统一调整 ${selectedIds.length} 张待确认或异常工单的计划结束日期。`"
      />
      <ArtForm
        ref="formRef"
        v-model="model"
        :items="items"
        :rules="rules"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { updateWorkOrderDueDates, type MesBatchResult } from '@mes/api'

  export interface WorkOrderDueDateDialogOpenData {
    ids: string[]
    initialDate?: string
  }

  const emit = defineEmits<{ success: [result: MesBatchResult] }>()
  const dialogRef = ref<ArtDialogExpose<WorkOrderDueDateDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const selectedIds = ref<string[]>([])
  const model = reactive({ plannedEndDate: '' })
  const items: FormItem[] = [
    {
      key: 'plannedEndDate',
      label: '计划结束日期',
      type: 'date',
      span: 24,
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' },
      help: '已确认或已结案工单不会被修改，并会在处理结果中说明。'
    }
  ]
  const rules = {
    plannedEndDate: [{ required: true, message: '请选择计划结束日期', trigger: 'change' }]
  }

  async function handleOpen(data: WorkOrderDueDateDialogOpenData): Promise<void> {
    selectedIds.value = [...data.ids]
    model.plannedEndDate = data.initialDate || ''
    await dialogRef.value?.handleOpen(data, {
      title: '交期维护',
      subtitle: `已选择 ${data.ids.length} 张工单`,
      confirmText: '更新交期',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          const result = await updateWorkOrderDueDates(selectedIds.value, model.plannedEndDate)
          emit('success', result)
          return true
        } catch (error) {
          notifyFriendlyError(error, '工单交期提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .work-order-due-date__context {
    margin-bottom: 18px;
  }
</style>
