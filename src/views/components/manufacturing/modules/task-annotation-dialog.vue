<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="task-annotation">
      <ArtEntitySummary
        class="task-annotation__context"
        icon="ri:sticky-note-add-line"
        eyebrow="OPERATION NOTE"
        :title="taskTitle"
        :description="`${taskNo} · 批注仅影响现场提示，不改变工艺路线与报工数据。`"
      />
      <ArtForm
        ref="formRef"
        v-model="model"
        :items="items"
        :rules="rules"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #urgency>
          <WorkOrderUrgencySegmented v-model="model.urgency" />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { annotateOperationTask, type MesOperationTask } from '@mes/api'
  import WorkOrderUrgencySegmented from './work-order-urgency-segmented.vue'

  export interface TaskAnnotationDialogOpenData {
    row: MesOperationTask
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<TaskAnnotationDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const taskId = ref('')
  const taskNo = ref('')
  const taskTitle = ref('工序任务')
  const model = reactive<Pick<MesOperationTask, 'urgency' | 'annotation'>>({
    urgency: 'normal',
    annotation: ''
  })
  const items: FormItem[] = [
    {
      key: 'urgency',
      label: '加急状态',
      type: 'slot',
      span: 24,
      help: '四级状态直接展示，便于现场快速辨识优先级。'
    },
    {
      key: 'annotation',
      label: '工序批注',
      type: 'textarea',
      span: 24,
      props: {
        rows: 5,
        maxlength: 1000,
        showWordLimit: true,
        placeholder: '填写现场注意事项、特殊工艺要求或交接说明'
      }
    }
  ]
  const rules = {
    urgency: [{ required: true, message: '请选择加急状态', trigger: 'change' }]
  }

  async function handleOpen(data: TaskAnnotationDialogOpenData): Promise<void> {
    taskId.value = data.row.id
    taskNo.value = data.row.taskNo
    taskTitle.value = data.row.operationName || '工序任务'
    model.urgency = data.row.urgency
    model.annotation = data.row.annotation || ''
    await dialogRef.value?.handleOpen(data, {
      title: '工序批注',
      subtitle: data.row.workOrder?.workOrderNo || data.row.taskNo,
      confirmText: '保存批注',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          await annotateOperationTask(
            taskId.value,
            model.urgency,
            normalizeNullableText(model.annotation)
          )
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '生产任务批注提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .task-annotation__context {
    margin-bottom: 18px;
  }
</style>
