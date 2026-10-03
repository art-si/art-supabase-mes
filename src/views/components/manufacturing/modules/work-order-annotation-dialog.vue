<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="work-order-annotation">
      <ArtEntitySummary
        class="work-order-annotation__context"
        icon="ri:sticky-note-add-line"
        eyebrow="WORK ORDER NOTE"
        :title="currentOrderNo"
        description="批注独立于工单状态维护，不会改变已确认的 BOM 与工艺路线执行基线。"
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
  import { annotateWorkOrder, type MesWorkOrder } from '@mes/api'
  import WorkOrderUrgencySegmented from './work-order-urgency-segmented.vue'

  export interface WorkOrderAnnotationDialogOpenData {
    row: MesWorkOrder
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<WorkOrderAnnotationDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const currentOrderNo = ref('')
  const currentId = ref('')
  const model = reactive<{
    urgency: MesWorkOrder['urgency']
    specialRequirement: string
  }>({
    urgency: 'normal',
    specialRequirement: ''
  })
  const items = computed<FormItem[]>(() => [
    {
      key: 'urgency',
      label: '紧急程度',
      type: 'slot',
      span: 24,
      help: '紧急程度会直接显示在工单列表，便于生产人员快速识别。'
    },
    {
      key: 'specialRequirement',
      label: '特别批注',
      type: 'textarea',
      span: 24,
      props: {
        rows: 5,
        maxlength: 1000,
        showWordLimit: true,
        placeholder: '填写需要生产现场重点关注的要求'
      }
    }
  ])
  const rules = {
    urgency: [{ required: true, message: '请选择加急状态', trigger: 'change' }]
  }

  const handleOpen = async (data: WorkOrderAnnotationDialogOpenData) => {
    currentId.value = data.row.id
    currentOrderNo.value = data.row.workOrderNo
    model.urgency = data.row.urgency
    model.specialRequirement = data.row.specialRequirement || ''
    await dialogRef.value?.handleOpen(data, {
      title: '工单批注',
      subtitle: data.row.materialNameSnapshot,
      confirmText: '保存批注',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          await annotateWorkOrder(
            currentId.value,
            model.urgency,
            normalizeNullableText(model.specialRequirement)
          )
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '工单批注提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .work-order-annotation__context {
    margin-bottom: 18px;
  }
</style>
