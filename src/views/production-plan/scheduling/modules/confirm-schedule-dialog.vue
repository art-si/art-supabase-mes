<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="min-w-0">
      <ArtEntitySummary
        icon="ri:calendar-check-line"
        eyebrow="OPERATION SCHEDULING"
        :title="task ? `${task.taskNo} · ${task.operationName}` : '工序排产'"
        :description="`待排产 ${availableQuantity} ${task?.operationUnit || ''} · ${task?.workOrder?.workOrderNo || '生产工单'}`"
      />
      <ArtForm
        ref="formRef"
        v-model="form"
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
  import dayjs from 'dayjs'
  import { computed, ref, shallowRef, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import {
    confirmOperationTaskSchedule,
    type MesOperationTask,
    type MesProductionScopeCenter,
    type MesSchedulingShift
  } from '@mes/api'

  export interface ConfirmScheduleDialogOpenData {
    row: MesOperationTask
    workCenters: MesProductionScopeCenter[]
    shifts: MesSchedulingShift[]
    quantity: number | undefined
    workCenterId: string
    shiftScheduleId?: string
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ConfirmScheduleDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const task = shallowRef<MesOperationTask>()
  const centers = ref<MesProductionScopeCenter[]>([])
  const shifts = ref<MesSchedulingShift[]>([])
  const form = ref({
    quantity: undefined as number | undefined,
    workCenterId: '',
    requiredStartDate: '',
    requiredCompletionDate: '',
    shiftScheduleId: ''
  })
  const availableQuantity = computed(() =>
    Math.max(Number(task.value?.pendingScheduleQuantity || 0), 0)
  )
  const availableShifts = computed(() => {
    const center = centers.value.find((item) => item.id === form.value.workCenterId)
    if (!center) return []
    return shifts.value.filter(
      (shift) =>
        shift.tenantId === center.tenantId &&
        shift.departmentId === center.departmentId &&
        (shift.name === '白班' || shift.name === '夜班')
    )
  })
  watch(
    () => form.value.workCenterId,
    () => {
      if (!availableShifts.value.some((shift) => shift.id === form.value.shiftScheduleId)) {
        form.value.shiftScheduleId = availableShifts.value[0]?.id || ''
      }
    }
  )
  const items = computed<FormItem[]>(() => [
    {
      key: 'quantity',
      label: '排产建议数量',
      type: 'number',
      span: 12,
      props: {
        min: 0.01,
        max: availableQuantity.value,
        precision: 2,
        controls: false,
        class: 'w-full!'
      }
    },
    {
      key: 'workCenterId',
      label: '排产建议工作中心',
      type: 'select',
      span: 12,
      options: centers.value.map((center) => ({
        label: `${center.code} ${center.name}`,
        value: center.id
      })),
      props: { filterable: true, placeholder: '选择承接工作中心', class: 'w-full!' }
    },
    {
      key: 'requiredStartDate',
      label: '工序要求开工日期',
      type: 'date',
      span: 12,
      props: { valueFormat: 'YYYY-MM-DD', class: 'w-full!' },
      help: '以工序要求日期作为默认值，可调整本次排产的计划开工日期。'
    },
    {
      key: 'requiredCompletionDate',
      label: '工序要求完工日期',
      type: 'date',
      span: 12,
      props: { valueFormat: 'YYYY-MM-DD', class: 'w-full!' },
      help: '此处调整本次排产的计划完工日期，不修改工序任务的原始要求日期。'
    },
    {
      key: 'shiftScheduleId',
      label: '班次',
      type: 'radioGroup',
      span: 24,
      options: availableShifts.value.map((shift) => ({
        label: `${shift.name} ${shift.startTime}-${shift.endTime}`,
        value: shift.id
      })),
      props: { optionType: 'button' },
      description: availableShifts.value.length
        ? '选择本工作中心所属车间的班次。'
        : '该工作中心暂无有效白班或夜班，请先配置班次。'
    }
  ])
  const rules = {
    quantity: [{ required: true, message: '请输入排产建议数量', trigger: 'change' }],
    workCenterId: [{ required: true, message: '请选择排产建议工作中心', trigger: 'change' }],
    requiredStartDate: [{ required: true, message: '请选择工序要求开工日期', trigger: 'change' }],
    requiredCompletionDate: [
      { required: true, message: '请选择工序要求完工日期', trigger: 'change' }
    ],
    shiftScheduleId: [{ required: true, message: '请选择白班或夜班', trigger: 'change' }]
  }

  async function handleOpen(data: ConfirmScheduleDialogOpenData): Promise<void> {
    task.value = data.row
    centers.value = data.row.eligibleWorkCenterIds.length
      ? data.workCenters.filter((center) => data.row.eligibleWorkCenterIds.includes(center.id))
      : data.workCenters.filter((center) => center.tenantId === data.row.tenantId)
    shifts.value = data.shifts
    const startDate =
      data.row.requiredStartDate ||
      data.row.plannedStartDate ||
      data.row.workOrder?.plannedStartDate ||
      dayjs().format('YYYY-MM-DD')
    Object.assign(form.value, {
      quantity: data.quantity,
      workCenterId: data.workCenterId,
      requiredStartDate: startDate,
      requiredCompletionDate:
        data.row.requiredCompletionDate ||
        data.row.plannedEndDate ||
        data.row.workOrder?.plannedEndDate ||
        startDate,
      shiftScheduleId: data.shiftScheduleId || ''
    })
    if (!availableShifts.value.some((shift) => shift.id === form.value.shiftScheduleId))
      form.value.shiftScheduleId = availableShifts.value[0]?.id || ''

    await dialogRef.value?.handleOpen(data, {
      title: '排产',
      subtitle: data.row.workOrder?.workOrderNo || data.row.taskNo,
      confirmText: '确认排产',
      contentMaxHeight: '70vh',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          if (
            !Number.isFinite(form.value.quantity) ||
            Number(form.value.quantity) <= 0 ||
            Number(form.value.quantity) > availableQuantity.value
          ) {
            ElMessage.warning('排产建议数量须大于 0 且不能超过待排产数量')
            return false
          }
          if (form.value.requiredCompletionDate < form.value.requiredStartDate) {
            ElMessage.warning('工序要求完工日期不能早于开工日期')
            return false
          }
          if (!availableShifts.value.some((shift) => shift.id === form.value.shiftScheduleId)) {
            ElMessage.warning('请选择当前工作中心可用的白班或夜班')
            return false
          }
          await confirmOperationTaskSchedule({
            id: data.row.id,
            quantity: Number(form.value.quantity),
            workCenterId: form.value.workCenterId,
            plannedStartDate: form.value.requiredStartDate,
            plannedEndDate: form.value.requiredCompletionDate,
            shiftScheduleId: form.value.shiftScheduleId
          })
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '排程确认提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>
