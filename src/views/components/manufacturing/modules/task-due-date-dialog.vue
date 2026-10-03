<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="task-due-date">
      <ArtEntitySummary
        class="task-due-date__context"
        icon="ri:calendar-check-line"
        eyebrow="REQUIRED COMPLETION"
        :title="taskTitle"
        :description="description"
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
  import { updateOperationTaskDueDates, type MesBatchResult, type MesOperationTask } from '@mes/api'

  export interface TaskDueDateDialogOpenData {
    rows: MesOperationTask[]
  }

  const emit = defineEmits<{ success: [result: MesBatchResult] }>()
  const dialogRef = ref<ArtDialogExpose<TaskDueDateDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const selectedIds = ref<string[]>([])
  const selectedRows = shallowRef<MesOperationTask[]>([])
  const taskTitle = ref('工序任务')
  const description = computed(() => {
    const rows = selectedRows.value
    if (rows.length === 1) {
      return `${rows[0]?.taskNo || '工序任务'} · 调整工序要求完工日期，不改变生产工单的计划完工日期。`
    }
    return `将统一调整 ${rows.length} 条工序任务的要求完工日期；已关闭任务会在处理结果中说明。`
  })
  const model = reactive({ requiredCompletionDate: '' })
  const items: FormItem[] = [
    {
      key: 'requiredCompletionDate',
      label: '工序要求完工日期',
      type: 'date',
      span: 24,
      props: {
        valueFormat: 'YYYY-MM-DD',
        class: '!w-full',
        placeholder: '选择工序要求完工日期'
      },
      help: '已关闭工序不可修改；默认继承生产工单计划完工日期。'
    }
  ]
  const rules = {
    requiredCompletionDate: [
      { required: true, message: '请选择工序要求完工日期', trigger: 'change' }
    ]
  }

  async function handleOpen(data: TaskDueDateDialogOpenData): Promise<void> {
    selectedRows.value = [...data.rows]
    selectedIds.value = data.rows.map((row) => row.id)
    taskTitle.value =
      data.rows.length === 1 ? data.rows[0]?.operationName || '工序任务' : '批量维护要求完工日期'
    const firstDate = data.rows[0]?.requiredCompletionDate || ''
    model.requiredCompletionDate = data.rows.every(
      (row) => (row.requiredCompletionDate || '') === firstDate
    )
      ? firstDate
      : ''
    await dialogRef.value?.handleOpen(data, {
      title: data.rows.length === 1 ? '维护要求完工日期' : '批量维护要求完工日期',
      subtitle:
        data.rows.length === 1
          ? data.rows[0]?.workOrder?.workOrderNo || data.rows[0]?.taskNo
          : `已选择 ${data.rows.length} 条任务`,
      confirmText: '更新日期',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          const result = await updateOperationTaskDueDates(
            selectedIds.value,
            model.requiredCompletionDate
          )
          emit('success', result)
          return true
        } catch (error) {
          notifyFriendlyError(error, '生产任务交期提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .task-due-date__context {
    margin-bottom: 18px;
  }
</style>
