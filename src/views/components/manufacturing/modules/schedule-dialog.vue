<template>
  <ArtDialog ref="dialogRef" size="sm"
    ><ArtForm
      ref="formRef"
      :model-value="model"
      @update:model-value="replaceReactiveModel(model, $event)"
      :items="items"
      :rules="rules"
      label-position="top"
      :show-reset="false"
      :show-submit="false"
  /></ArtDialog>
</template>
<script setup lang="ts">
  import { toNameCodeOption } from '@/utils/form/option'

  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { computed, reactive, ref } from 'vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { MesOperationTask, MesReferenceOption } from '@mes/api'
  import dayjs from 'dayjs'
  import { scheduleOperationTask } from '@mes/api'
  export interface ScheduleDialogOpenData {
    row: MesOperationTask
    workCenters: MesReferenceOption[]
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ScheduleDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const model = reactive({
    workCenterId: '',
    plannedDates: [] as string[]
  })
  const centers = ref<MesReferenceOption[]>([])
  const items = computed<FormItem[]>(() => [
    {
      key: 'workCenterId',
      label: '目标工作中心',
      type: 'select',
      span: 24,
      options: centers.value.map(toNameCodeOption),
      props: { filterable: true, placeholder: '选择承接本工序的工作中心' },
      help: '排程后任务进入“已排程”，可继续现场执行。'
    },
    {
      key: 'plannedDates',
      label: '计划周期',
      type: 'daterange',
      span: 24,
      props: {
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '计划开始',
        endPlaceholder: '计划结束',
        unlinkPanels: true,
        class: '!w-full'
      },
      help: '计划周期用于排产看板与甘特图展示；结束日期不得早于开始日期。'
    }
  ])
  const rules = {
    workCenterId: [{ required: true, message: '请选择工作中心', trigger: 'change' }],
    plannedDates: [{ required: true, message: '请选择计划周期', trigger: 'change' }]
  }
  const handleOpen = async (data: ScheduleDialogOpenData) => {
    centers.value = data.row.eligibleWorkCenterIds.length
      ? data.workCenters.filter((item) => data.row.eligibleWorkCenterIds.includes(item.id))
      : data.workCenters
    model.workCenterId = data.row.workCenterId || ''
    model.plannedDates = [
      data.row.plannedStartDate ||
        data.row.workOrder?.plannedStartDate ||
        dayjs().format('YYYY-MM-DD'),
      data.row.plannedEndDate || data.row.workOrder?.plannedEndDate || dayjs().format('YYYY-MM-DD')
    ]
    await dialogRef.value?.handleOpen(data, {
      title: '工序任务排程',
      subtitle: `${data.row.operationCode} · ${data.row.operationName}`,
      confirmText: '确认排程',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          await scheduleOperationTask({
            id: data.row.id,
            workCenterId: model.workCenterId,
            plannedStartDate: model.plannedDates[0],
            plannedEndDate: model.plannedDates[1]
          })
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '生产排程提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
