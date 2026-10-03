<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="allocation-dialog">
      <ArtEntitySummary
        icon="ri:split-cells-horizontal"
        eyebrow="MULTI-CENTER SCHEDULING"
        :title="taskLabel"
        :description="`待排产 ${availableQuantity} ${task?.operationUnit || ''}，可拆分到多个工作中心。`"
      />

      <ArtForm
        ref="formRef"
        v-model="form"
        :items="formItems"
        :rules="rules"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      />

      <div class="allocation-dialog__toolbar">
        <ArtSectionTitle title="工作中心分配" :show-line="false" />
        <ElCheckbox v-model="averageEnabled" @change="applyAverageAllocation">
          平均分配
        </ElCheckbox>
      </div>

      <ArtTable
        :data="rows"
        :columns="columns"
        :pagination="false"
        :show-table-header="false"
        height="330px"
        empty-text="暂无可用工作中心"
        empty-description="请检查车间范围或工艺路线允许的工作中心。"
      />

      <div
        class="allocation-dialog__total"
        :class="{ 'is-overflow': allocatedQuantity > availableQuantity }"
      >
        <span>已分配</span>
        <strong>{{ allocatedQuantity }} / {{ availableQuantity }}</strong>
        <span>{{ task?.operationUnit || '' }}</span>
      </div>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import dayjs from 'dayjs'
  import { computed, ref, shallowRef } from 'vue'
  import { ElCheckbox, ElInputNumber, ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    allocateOperationTask,
    type MesOperationTask,
    type MesProductionScopeCenter,
    type MesSchedulingShift
  } from '@mes/api'

  interface AllocationRow extends MesProductionScopeCenter {
    selected: boolean
    quantity: number | undefined
  }

  export interface AverageAllocationDialogOpenData {
    row: MesOperationTask
    workCenters: MesProductionScopeCenter[]
    shifts: MesSchedulingShift[]
    shiftScheduleId?: string
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<AverageAllocationDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const task = shallowRef<MesOperationTask>()
  const rows = ref<AllocationRow[]>([])
  const shifts = ref<MesSchedulingShift[]>([])
  const averageEnabled = ref(false)
  const form = ref({ plannedDates: [] as string[], shiftScheduleId: '' })
  const availableQuantity = computed(() =>
    Math.max(
      Number(task.value?.plannedQuantity || 0) -
        Number(task.value?.cumulativeCompletedQuantity || 0),
      0
    )
  )
  const taskLabel = computed(() =>
    task.value ? `${task.value.taskNo} · ${task.value.operationName}` : '多工作中心排产'
  )
  const allocatedQuantity = computed(() =>
    Number(
      rows.value
        .filter((row) => row.selected)
        .reduce((total, row) => total + Number(row.quantity || 0), 0)
        .toFixed(2)
    )
  )
  const formItems = computed<FormItem[]>(() => [
    {
      key: 'plannedDates',
      label: '计划周期',
      type: 'daterange',
      span: 14,
      props: {
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '计划开始',
        endPlaceholder: '计划结束',
        unlinkPanels: true,
        class: '!w-full'
      }
    },
    {
      key: 'shiftScheduleId',
      label: '生产班次',
      type: 'select',
      span: 10,
      options: shifts.value.map((shift) => ({
        label: `${shift.name} ${shift.startTime}-${shift.endTime}`,
        value: shift.id
      })),
      props: { clearable: true, placeholder: '不限班次' }
    }
  ])
  const rules = {
    plannedDates: [{ required: true, message: '请选择计划周期', trigger: 'change' }]
  }
  const columns: ColumnOption<AllocationRow>[] = [
    {
      prop: 'selected',
      label: '选择',
      width: 72,
      align: 'center',
      formatter: (row) => (
        <ElCheckbox
          v-model={row.selected}
          aria-label={`选择工作中心 ${row.name}`}
          onChange={() => handleSelectionChange(row)}
        />
      )
    },
    { prop: 'code', label: '工作中心编号', minWidth: 140 },
    { prop: 'name', label: '工作中心名称', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'capacity',
      label: '产能',
      width: 110,
      align: 'right',
      formatter: (row) => `${(Number(row.dailyCapacityMinutes || 0) / 60).toFixed(1)} H`
    },
    {
      prop: 'quantity',
      label: '排产数量',
      minWidth: 190,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.quantity}
          min={0}
          max={availableQuantity.value}
          precision={2}
          controls-position="right"
          disabled={!row.selected}
          aria-label={`${row.name}排产数量`}
          class="!w-full"
        />
      )
    }
  ]

  function handleSelectionChange(row: AllocationRow): void {
    if (!row.selected) row.quantity = undefined
    if (averageEnabled.value) applyAverageAllocation()
  }

  function applyAverageAllocation(): void {
    if (!averageEnabled.value) return
    const selected = rows.value.filter((row) => row.selected)
    if (!selected.length) return
    const base = Math.floor((availableQuantity.value / selected.length) * 100) / 100
    let assigned = 0
    selected.forEach((row, index) => {
      const quantity = index === selected.length - 1 ? availableQuantity.value - assigned : base
      row.quantity = Number(quantity.toFixed(2))
      assigned += row.quantity
    })
  }

  async function handleOpen(data: AverageAllocationDialogOpenData): Promise<void> {
    task.value = data.row
    shifts.value = data.shifts
    const eligibleIds = data.row.eligibleWorkCenterIds
    const availableCenters = eligibleIds.length
      ? data.workCenters.filter((center) => eligibleIds.includes(center.id))
      : data.workCenters
    const existingQuantities = new Map(
      (data.row.allocations || []).map((allocation) => [
        allocation.workCenterId,
        allocation.quantity
      ])
    )
    rows.value = availableCenters.map((center) => ({
      ...center,
      selected: existingQuantities.has(center.id),
      quantity: existingQuantities.get(center.id)
    }))
    averageEnabled.value = false
    form.value.shiftScheduleId =
      data.shiftScheduleId || data.row.allocations?.[0]?.shiftScheduleId || ''
    form.value.plannedDates = [
      data.row.plannedStartDate ||
        data.row.workOrder?.plannedStartDate ||
        dayjs().format('YYYY-MM-DD'),
      data.row.plannedEndDate || data.row.workOrder?.plannedEndDate || dayjs().format('YYYY-MM-DD')
    ]
    await dialogRef.value?.handleOpen(data, {
      title: '平均分配 / 多工作中心排产',
      subtitle: data.row.workOrder?.workOrderNo || data.row.taskNo,
      confirmText: '保存排产分配',
      contentHeight: '620px',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          const allocations = rows.value
            .filter((row) => row.selected && Number(row.quantity) > 0)
            .map((row) => ({ workCenterId: row.id, quantity: Number(row.quantity) }))
          if (!allocations.length) {
            ElMessage.warning('请至少选择一个工作中心并填写排产数量')
            return false
          }
          if (allocatedQuantity.value > availableQuantity.value) {
            ElMessage.warning('排产数量大于待排产数量')
            return false
          }
          await allocateOperationTask({
            id: data.row.id,
            allocations,
            plannedStartDate: form.value.plannedDates[0]!,
            plannedEndDate: form.value.plannedDates[1]!,
            shiftScheduleId: form.value.shiftScheduleId || null
          })
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '平均分配方案提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .allocation-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-4);
    min-height: 0;

    &__toolbar,
    &__total {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &__total {
      gap: var(--art-space-2);
      justify-content: flex-end;
      color: var(--el-text-color-secondary);

      strong {
        font-size: 16px;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-primary);
      }

      &.is-overflow,
      &.is-overflow strong {
        color: var(--el-color-danger);
      }
    }
  }
</style>
