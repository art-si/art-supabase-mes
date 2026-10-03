<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="shift-plan-dialog">
      <ArtEntitySummary
        icon="ri:calendar-schedule-line"
        eyebrow="SHIFT CAPACITY"
        :title="
          task
            ? `${task.workOrder?.workOrderNo || task.taskNo} · ${task.operationName}`
            : '班次排产'
        "
        :description="summaryDescription"
        compact
      />

      <dl class="shift-plan-dialog__due-date">
        <dt>工序要求完工日期</dt>
        <dd>{{ task?.requiredCompletionDate || '未设置' }}</dd>
      </dl>

      <ArtForm
        ref="formRef"
        v-model="form.data"
        :items="formItems"
        :rules="form.rules"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      />

      <div class="shift-plan-dialog__balance" aria-live="polite">
        <span>本次排产</span>
        <strong>{{ previewQuantity }}</strong>
        <span
          >/ 可排上限 {{ openData?.assignedQuantity || 0 }} {{ task?.operationUnit || '' }}</span
        >
      </div>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { computed, reactive, ref, shallowRef } from 'vue'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import {
    replaceOperationTaskShiftPlan,
    type MesOperationTask,
    type MesOperationTaskShiftPlanItem
  } from '@mes/api'
  import type { GanttShiftSlot } from './gantt-schedule-policy'
  import { theoreticalShiftQuantity } from './gantt-schedule-policy'

  type DialogMode = 'cell' | 'specified'

  export interface ShiftPlanDialogOpenData {
    mode: DialogMode
    task: MesOperationTask
    workCenterId: string
    currentPlan: MesOperationTaskShiftPlanItem[]
    assignedQuantity: number
    availableSlots: GanttShiftSlot[]
    targetSlot?: GanttShiftSlot
  }

  interface ShiftPlanFormModel {
    quantity: number | undefined
    totalQuantity: number | undefined
    perShiftQuantity: number | undefined
    startSlotKey: string
  }

  interface ShiftPlanFormGroup {
    data: ShiftPlanFormModel
    rules: FormRules<ShiftPlanFormModel>
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ShiftPlanDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const task = shallowRef<MesOperationTask>()
  const openData = shallowRef<ShiftPlanDialogOpenData>()
  const formItems = ref<FormItem[]>([])
  const form = reactive<ShiftPlanFormGroup>({
    data: {
      quantity: undefined,
      totalQuantity: undefined,
      perShiftQuantity: undefined,
      startSlotKey: ''
    },
    rules: {
      quantity: [{ required: true, message: '请输入班次计划生产数量', trigger: 'change' }],
      totalQuantity: [{ required: true, message: '请输入本次排产数量', trigger: 'change' }],
      perShiftQuantity: [{ required: true, message: '请输入每班数量', trigger: 'change' }],
      startSlotKey: [{ required: true, message: '请选择开始班次', trigger: 'change' }]
    }
  })

  const scheduledQuantity = computed(() =>
    (openData.value?.currentPlan || []).reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    )
  )
  const availableQuantity = computed(() =>
    Math.max(Number(openData.value?.assignedQuantity || 0) - scheduledQuantity.value, 0)
  )
  const previewQuantity = computed(() =>
    Number(
      (openData.value?.mode === 'cell'
        ? Number(form.data.quantity || 0)
        : Number(form.data.totalQuantity || 0)
      ).toFixed(2)
    )
  )
  const summaryDescription = computed(() => {
    const data = openData.value
    if (!data) return ''
    if (data.mode === 'cell' && data.targetSlot) {
      return `${data.targetSlot.workDate} · ${data.targetSlot.name} ${data.targetSlot.startTime}-${data.targetSlot.endTime}`
    }
    return '按每班数量从指定班次开始，依次填充当前计划期间。'
  })

  function slotLabel(slot: GanttShiftSlot): string {
    return `${slot.workDate} · ${slot.name} ${slot.startTime}-${slot.endTime}`
  }

  function createItems(data: ShiftPlanDialogOpenData): FormItem[] {
    if (data.mode === 'cell') {
      const existingQuantity = data.currentPlan.find(
        (item) =>
          item.workDate === data.targetSlot?.workDate && item.shiftIndex === data.targetSlot?.index
      )?.quantity
      return [
        {
          key: 'quantity',
          label: '班次计划生产数量',
          type: 'number',
          span: 24,
          props: {
            min: 0,
            max: Number((availableQuantity.value + Number(existingQuantity || 0)).toFixed(2)),
            precision: 2,
            controlsPosition: 'right',
            class: '!w-full',
            placeholder: '输入 0 可撤销当前班次排产'
          },
          help: `理论班次产能约 ${theoreticalShiftQuantity(data.task, data.targetSlot?.workMinutes || 0)} ${data.task.operationUnit || ''}`
        }
      ]
    }
    return [
      {
        key: 'totalQuantity',
        label: '本次排产数量',
        type: 'number',
        span: 12,
        props: {
          min: 0.01,
          max: availableQuantity.value,
          precision: 2,
          controlsPosition: 'right',
          class: '!w-full'
        }
      },
      {
        key: 'perShiftQuantity',
        label: '每班数量',
        type: 'number',
        span: 12,
        props: {
          min: 0.01,
          max: availableQuantity.value,
          precision: 2,
          controlsPosition: 'right',
          class: '!w-full'
        }
      },
      {
        key: 'startSlotKey',
        label: '开始班次',
        type: 'select',
        span: 24,
        options: data.availableSlots.map((slot) => ({ label: slotLabel(slot), value: slot.key })),
        props: { filterable: true, placeholder: '选择开始日期与班次' }
      }
    ]
  }

  function buildPlan(data: ShiftPlanDialogOpenData): MesOperationTaskShiftPlanItem[] | null {
    const plan = data.currentPlan.map((item) => ({ ...item }))
    if (data.mode === 'cell' && data.targetSlot) {
      const quantity = Number(form.data.quantity || 0)
      const index = plan.findIndex(
        (item) =>
          item.workDate === data.targetSlot?.workDate && item.shiftIndex === data.targetSlot?.index
      )
      if (quantity > 0) {
        const item = {
          workDate: data.targetSlot.workDate,
          shiftIndex: data.targetSlot.index,
          shiftName: data.targetSlot.name,
          quantity
        }
        if (index >= 0) plan[index] = item
        else plan.push(item)
      } else if (index >= 0) {
        plan.splice(index, 1)
      }
      return plan
    }

    const startIndex = data.availableSlots.findIndex((slot) => slot.key === form.data.startSlotKey)
    if (startIndex < 0) return null
    let remaining = Number(form.data.totalQuantity || 0)
    const perShift = Number(form.data.perShiftQuantity || 0)
    const used = new Set(plan.map((item) => `${item.workDate}:${item.shiftIndex}`))
    for (const slot of data.availableSlots.slice(startIndex)) {
      if (remaining <= 0) break
      if (used.has(slot.key)) continue
      const quantity = Number(Math.min(remaining, perShift).toFixed(2))
      plan.push({
        workDate: slot.workDate,
        shiftIndex: slot.index,
        shiftName: slot.name,
        quantity
      })
      remaining = Number((remaining - quantity).toFixed(2))
    }
    if (remaining > 0) {
      ElMessage.warning('当前计划期间的可用班次不足，请延长计划期间或降低排产数量')
      return null
    }
    return plan
  }

  async function handleOpen(data: ShiftPlanDialogOpenData): Promise<void> {
    task.value = data.task
    openData.value = data
    const existing = data.targetSlot
      ? data.currentPlan.find(
          (item) =>
            item.workDate === data.targetSlot?.workDate &&
            item.shiftIndex === data.targetSlot?.index
        )
      : undefined
    const firstSlot = data.availableSlots[0]
    Object.assign(form.data, {
      quantity: existing?.quantity,
      totalQuantity: availableQuantity.value || undefined,
      perShiftQuantity: firstSlot
        ? Math.min(
            theoreticalShiftQuantity(data.task, firstSlot.workMinutes),
            availableQuantity.value
          ) || undefined
        : undefined,
      startSlotKey: firstSlot?.key || ''
    })
    formItems.value = createItems(data)
    await dialogRef.value?.handleOpen(data, {
      title: data.mode === 'cell' ? '调整班次排产数量' : '指定排产',
      subtitle: data.task.workCenter
        ? `${data.task.workCenter.code} · ${data.task.workCenter.name}`
        : data.task.taskNo,
      confirmText: data.mode === 'cell' ? '保存班次数量' : '生成班次计划',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          const items = buildPlan(data)
          if (!items) return false
          const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
          if (total > Number(data.assignedQuantity || 0)) {
            ElMessage.warning('已排数量不能超过分配数量')
            return false
          }
          await replaceOperationTaskShiftPlan({
            id: data.task.id,
            workCenterId: data.workCenterId,
            expectedVersion: data.task.scheduleVersion,
            keepAssignment: true,
            items
          })
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '班次计划提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .shift-plan-dialog {
    display: grid;
    gap: var(--art-space-4);

    &__due-date {
      display: flex;
      flex-wrap: wrap;
      gap: var(--art-space-2);
      align-items: baseline;
      justify-content: space-between;
      margin: 0;
      color: var(--el-text-color-secondary);

      dd {
        margin: 0;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-primary);
      }
    }

    &__balance {
      display: flex;
      gap: var(--art-space-2);
      align-items: baseline;
      justify-content: flex-end;
      padding: 10px 12px;
      color: var(--el-text-color-secondary);
      background: var(--art-gray-100);
      border-radius: var(--art-control-radius);

      strong {
        font-size: 20px;
        font-variant-numeric: tabular-nums;
        color: var(--theme-color);
      }
    }
  }
</style>
