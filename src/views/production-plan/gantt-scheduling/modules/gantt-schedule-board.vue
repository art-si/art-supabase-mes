<template>
  <div class="schedule-board" :style="boardStyle">
    <div class="schedule-board__corner">
      <span>机台 / 工序任务</span>
      <small>数量口径与任务工具</small>
    </div>
    <div class="schedule-board__date-header">
      <div
        v-for="date in dates"
        :key="date.date"
        class="schedule-board__date"
        :class="{ 'is-today': date.isToday, 'is-weekend': date.isWeekend }"
        :style="{ gridColumn: `span ${date.shifts.length}` }"
      >
        <strong>{{ date.label }}</strong
        ><span>{{ date.weekday }}</span>
      </div>
    </div>
    <div class="schedule-board__column-header" aria-hidden="true">
      <span>机台</span>
      <span>生产工单 / 物料</span>
      <span>要求完工时间</span>
      <span>分配</span>
      <span>完工</span>
      <span>待加工</span>
      <span>已排</span>
      <span>未排</span>
      <span>工具</span>
    </div>
    <div class="schedule-board__shift-header">
      <template v-for="date in dates" :key="date.date">
        <div
          v-for="slot in date.shifts"
          :key="slot.key"
          class="schedule-board__shift"
          :class="{ 'is-rest': !slot.index, 'is-today': date.isToday }"
          :title="slot.index ? `${slot.startTime}-${slot.endTime}` : '工厂日历未配置生产班次'"
        >
          <strong>{{ slot.name }}</strong>
          <small v-if="slot.index">{{ slot.startTime }}</small>
        </div>
      </template>
    </div>

    <template v-for="group in groups" :key="group.center.id">
      <button
        type="button"
        class="schedule-board__group-label"
        :aria-expanded="isExpanded(group.center.id)"
        @click="toggleGroup(group.center.id)"
      >
        <ArtSvgIcon
          :icon="isExpanded(group.center.id) ? 'ri:arrow-down-s-line' : 'ri:arrow-right-s-line'"
        />
        <span>
          <strong>{{ group.center.code }} · {{ group.center.name }}</strong>
          <small>{{ group.tasks.length }} 道工序</small>
        </span>
        <b>{{ centerLoad(group) }}%</b>
      </button>
      <div class="schedule-board__group-track">
        <span v-for="slot in flatSlots" :key="slot.key" />
      </div>

      <template v-if="isExpanded(group.center.id)">
        <template v-for="task in group.tasks" :key="`${group.center.id}:${task.id}`">
          <div class="schedule-board__task-info" :class="`is-${toneFor(task, group.center.id)}`">
            <div class="schedule-board__machine">
              <span class="schedule-board__status-dot" />
              <span>
                <strong>{{ group.center.code }} · {{ group.center.name }}</strong>
                <small>{{ toneLabelFor(task, group.center.id) }}</small>
              </span>
            </div>
            <div class="schedule-board__order">
              <strong :title="task.workOrder?.workOrderNo">{{
                task.workOrder?.workOrderNo || '—'
              }}</strong>
              <span :title="materialLabel(task)">{{ materialLabel(task) }}</span>
              <small :title="projectLabel(task)">{{ projectLabel(task) }}</small>
            </div>
            <div class="schedule-board__due-date">
              <time
                v-if="task.requiredCompletionDate"
                :datetime="task.requiredCompletionDate"
                :title="`要求完工时间：${task.requiredCompletionDate}`"
              >
                {{ task.requiredCompletionDate }}
              </time>
              <span v-else>未设置</span>
            </div>
            <template v-for="metric in taskMetrics(task, group.center.id)" :key="metric.key">
              <strong class="schedule-board__quantity" :class="`is-${metric.key}`">
                {{ formatQuantity(metric.value) }}
              </strong>
            </template>
            <div class="schedule-board__actions">
              <ArtButtonMore
                :list="taskActions(task, group.center.id)"
                @click="emit('action', task, group.center, String($event.key))"
              />
            </div>
          </div>

          <div class="schedule-board__task-track" :class="`is-${toneFor(task, group.center.id)}`">
            <template v-for="slot in flatSlots" :key="slot.key">
              <button
                type="button"
                class="schedule-board__cell"
                :class="cellClasses(task, group.center, slot)"
                :disabled="
                  !isSlotAvailable(group.center.departmentId, slot) ||
                  !canSchedule ||
                  !canAdjustShiftPlan(task)
                "
                :draggable="canDrag(task, group.center.id, slot)"
                :aria-label="cellAriaLabel(task, group.center, slot)"
                :title="cellTitle(task, group.center, slot)"
                @dblclick="emitCellEdit(task, group.center, slot)"
                @dragstart="startDrag(task, group.center, slot)"
                @dragend="dragSource = undefined"
                @dragover.prevent="markDragTarget(task, group.center, slot)"
                @dragleave="dragTargetKey = ''"
                @drop.prevent="dropAllocation(task, group.center, slot)"
              >
                <template v-if="allocationAt(task, group.center.id, slot)">
                  <span class="schedule-board__cell-value">
                    {{
                      showQuantities
                        ? formatQuantity(allocationAt(task, group.center.id, slot)?.quantity || 0)
                        : '已排'
                    }}
                  </span>
                  <span
                    v-if="completionMeta(task, group.center.id, slot)"
                    class="schedule-board__completion"
                    :class="`is-${completionMeta(task, group.center.id, slot)?.tone}`"
                  >
                    <ArtSvgIcon :icon="completionMeta(task, group.center.id, slot)?.icon || ''" />
                    <small v-if="showQuantities">
                      {{ completionMeta(task, group.center.id, slot)?.value }}
                    </small>
                  </span>
                </template>
                <span
                  v-else-if="isSlotAvailable(group.center.departmentId, slot)"
                  class="schedule-board__empty-slot"
                >
                  <span>待生产</span>
                </span>
                <span v-else class="schedule-board__rest-slot">—</span>
              </button>
            </template>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import type {
    MesGanttCalendarDay,
    MesOperationTask,
    MesOperationTaskAllocation,
    MesProductionScopeCenter
  } from '@mes/api'
  import {
    allocationsForCenter,
    buildCalendarDayMap,
    completionByAllocation,
    isShiftFinished,
    taskQuantitySummary,
    canAdjustShiftPlan,
    taskTone,
    taskToneLabel,
    theoreticalShiftQuantity,
    type GanttDateColumn,
    type GanttShiftSlot
  } from './gantt-schedule-policy'

  export interface GanttWorkCenterGroup {
    center: MesProductionScopeCenter
    tasks: MesOperationTask[]
  }

  interface DragSource {
    taskId: string
    centerId: string
    slot: GanttShiftSlot
  }

  const props = defineProps<{
    groups: GanttWorkCenterGroup[]
    dates: GanttDateColumn[]
    calendarDays: MesGanttCalendarDay[]
    showQuantities: boolean
    canSchedule: boolean
    canAutoSchedule: boolean
  }>()

  const emit = defineEmits<{
    'edit-cell': [task: MesOperationTask, center: MesProductionScopeCenter, slot: GanttShiftSlot]
    'move-allocation': [
      task: MesOperationTask,
      center: MesProductionScopeCenter,
      source: GanttShiftSlot,
      target: GanttShiftSlot
    ]
    action: [task: MesOperationTask, center: MesProductionScopeCenter, key: string]
  }>()

  const expandedCenterIds = ref<string[]>([])
  const dragSource = ref<DragSource>()
  const dragTargetKey = ref('')
  const calendarDayMap = computed(() => buildCalendarDayMap(props.calendarDays))
  const flatSlots = computed(() => props.dates.flatMap((date) => date.shifts))
  const boardStyle = computed(() => ({
    '--slot-count': flatSlots.value.length,
    '--board-height': `${
      104 +
      props.groups.reduce(
        (height, group) =>
          height + 44 + (isExpanded(group.center.id) ? group.tasks.length * 74 : 0),
        0
      )
    }px`
  }))

  watch(
    () => props.groups.map((group) => group.center.id),
    (ids) => {
      const current = new Set(expandedCenterIds.value)
      expandedCenterIds.value = ids.filter((id) => current.has(id) || !current.size)
    },
    { immediate: true }
  )

  function isExpanded(centerId: string): boolean {
    return expandedCenterIds.value.includes(centerId)
  }

  function toggleGroup(centerId: string): void {
    expandedCenterIds.value = isExpanded(centerId)
      ? expandedCenterIds.value.filter((id) => id !== centerId)
      : [...expandedCenterIds.value, centerId]
  }

  function allocationAt(
    task: MesOperationTask,
    centerId: string,
    slot: GanttShiftSlot
  ): MesOperationTaskAllocation | undefined {
    return allocationsForCenter(task, centerId).find(
      (allocation) =>
        allocation.plannedStartDate === slot.workDate &&
        Number(allocation.shiftIndex || 0) === slot.index
    )
  }

  function isSlotAvailable(departmentId: string, slot: GanttShiftSlot): boolean {
    if (!slot.index) return false
    return Boolean(
      calendarDayMap.value
        .get(`${departmentId}:${slot.workDate}`)
        ?.shifts.some((shift) => shift.index === slot.index)
    )
  }

  function toneFor(task: MesOperationTask, centerId: string) {
    return taskTone(task, centerId, props.dates)
  }

  function toneLabelFor(task: MesOperationTask, centerId: string): string {
    return taskToneLabel(toneFor(task, centerId))
  }

  function materialLabel(task: MesOperationTask): string {
    const order = task.workOrder
    return (
      [order?.materialNameSnapshot, order?.specificationSnapshot].filter(Boolean).join(' · ') ||
      '未维护物料信息'
    )
  }

  function projectLabel(task: MesOperationTask): string {
    return task.workOrder?.projectNameSnapshot || `${task.operationCode} · ${task.operationName}`
  }

  function formatQuantity(value: number): string {
    return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  }

  function taskMetrics(task: MesOperationTask, centerId: string) {
    const summary = taskQuantitySummary(task, centerId)
    return [
      { key: 'assigned', value: summary.assigned },
      { key: 'completed', value: summary.completed },
      { key: 'pending', value: summary.pendingProcessing },
      { key: 'scheduled', value: summary.scheduled },
      { key: 'unscheduled', value: summary.unscheduled }
    ]
  }

  function taskActions(task: MesOperationTask, centerId: string): ButtonMoreItem[] {
    const locked = !canAdjustShiftPlan(task)
    const hasPlan = allocationsForCenter(task, centerId).some((allocation) => allocation.shiftIndex)
    const actions: ButtonMoreItem[] = [
      {
        key: 'auto',
        label: '自动排产',
        icon: 'ri:magic-line',
        auth: 'MesScheduling:AutoSchedule',
        disabled: locked
      },
      {
        key: 'specified',
        label: '指定排产',
        icon: 'ri:calendar-schedule-line',
        auth: 'MesOperationTask:Schedule',
        disabled: locked
      },
      {
        key: 'undo',
        label: '撤销排产',
        icon: 'ri:arrow-go-back-line',
        auth: 'MesOperationTask:Schedule',
        disabled: locked || !hasPlan
      },
      {
        key: 'remove',
        label: '移除分配',
        icon: 'ri:link-unlink-m',
        auth: 'MesOperationTask:Schedule',
        disabled: locked
      },
      {
        key: 'due-date',
        label: '修改要求完工日期',
        icon: 'ri:calendar-check-line',
        auth: 'MesOperationTask:MaintainDueDate',
        disabled: task.operationStatus === 'closed' || task.schedulingStatus === 'closed'
      },
      {
        key: 'close',
        label: '结案关单',
        icon: 'ri:archive-line',
        auth: 'MesOperationTask:Close',
        disabled: task.operationStatus === 'started'
      }
    ]
    return props.canAutoSchedule ? actions : actions.filter((item) => item.key !== 'auto')
  }

  function completionMeta(task: MesOperationTask, centerId: string, slot: GanttShiftSlot) {
    const allocation = allocationAt(task, centerId, slot)
    if (!allocation || !isShiftFinished(slot)) return undefined
    const reported = completionByAllocation(task, centerId).get(allocation.id) || 0
    const delta = Number((reported - Number(allocation.quantity || 0)).toFixed(2))
    if (delta === 0) return { tone: 'achieved', icon: 'ri:check-line', value: 0 }
    if (delta < 0) return { tone: 'shortfall', icon: 'ri:subtract-line', value: delta }
    return { tone: 'excess', icon: 'ri:add-line', value: delta }
  }

  function cellClasses(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ) {
    const allocation = allocationAt(task, center.id, slot)
    const capacity = theoreticalShiftQuantity(task, slot.workMinutes)
    return {
      'is-unavailable': !isSlotAvailable(center.departmentId, slot),
      'has-allocation': Boolean(allocation),
      'is-over-capacity': Boolean(allocation && Number(allocation.quantity) > capacity),
      'is-drag-target': dragTargetKey.value === `${task.id}:${center.id}:${slot.key}`
    }
  }

  function centerLoad(group: GanttWorkCenterGroup): number {
    const scheduled = group.tasks.reduce(
      (total, task) => total + taskQuantitySummary(task, group.center.id).scheduled,
      0
    )
    const capacity = group.tasks.reduce(
      (total, task) =>
        total +
        flatSlots.value.reduce(
          (sum, slot) =>
            sum +
            (isSlotAvailable(group.center.departmentId, slot)
              ? theoreticalShiftQuantity(task, slot.workMinutes)
              : 0),
          0
        ),
      0
    )
    return capacity > 0 ? Math.min(Math.round((scheduled / capacity) * 100), 999) : 0
  }

  function emitCellEdit(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ): void {
    if (!props.canSchedule || !canAdjustShiftPlan(task)) return
    if (!isSlotAvailable(center.departmentId, slot)) return
    emit('edit-cell', task, center, slot)
  }

  function canDrag(task: MesOperationTask, centerId: string, slot: GanttShiftSlot): boolean {
    return Boolean(
      props.canSchedule && canAdjustShiftPlan(task) && allocationAt(task, centerId, slot)
    )
  }

  function startDrag(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ): void {
    if (!canDrag(task, center.id, slot)) return
    dragSource.value = { taskId: task.id, centerId: center.id, slot }
  }

  function markDragTarget(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ): void {
    if (
      dragSource.value?.taskId === task.id &&
      dragSource.value.centerId === center.id &&
      isSlotAvailable(center.departmentId, slot)
    ) {
      dragTargetKey.value = `${task.id}:${center.id}:${slot.key}`
    }
  }

  function dropAllocation(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ): void {
    const source = dragSource.value
    dragTargetKey.value = ''
    dragSource.value = undefined
    if (!source || source.taskId !== task.id || source.centerId !== center.id) return
    if (!isSlotAvailable(center.departmentId, slot) || source.slot.key === slot.key) return
    emit('move-allocation', task, center, source.slot, slot)
  }

  function cellAriaLabel(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ): string {
    const allocation = allocationAt(task, center.id, slot)
    return `${slot.workDate}${slot.name}，${task.operationName}，${
      allocation ? `计划数量 ${formatQuantity(Number(allocation.quantity))}` : '未排产'
    }`
  }

  function cellTitle(
    task: MesOperationTask,
    center: MesProductionScopeCenter,
    slot: GanttShiftSlot
  ): string {
    if (!isSlotAvailable(center.departmentId, slot)) return '当前工作中心在工厂日历中未配置该班次'
    const allocation = allocationAt(task, center.id, slot)
    const capacity = theoreticalShiftQuantity(task, slot.workMinutes)
    const order = task.workOrder
    return [
      `日期：${slot.workDate}`,
      `班次：${slot.name}（${slot.startTime}-${slot.endTime}）`,
      `生产工单：${order?.workOrderNo || '—'}`,
      `任务号：${task.taskNo}`,
      `产品编码：${order?.materialCodeSnapshot || '—'}`,
      `物料名称：${order?.materialNameSnapshot || '—'}`,
      `项目名称：${order?.projectNameSnapshot || '—'}`,
      `工序序列 / 工序号：${task.sequenceNo} / ${task.operationCode}`,
      `工序名称：${task.operationName}`,
      `要求完工日期：${task.requiredCompletionDate || '未设置'}`,
      `数量：${allocation ? formatQuantity(Number(allocation.quantity)) : '未排产'}`,
      `预计加工时间：${formatQuantity(Number(task.estimatedWorkMinutes || 0) / 60)} 小时`,
      `理论班次产能：${formatQuantity(capacity)}`,
      !canAdjustShiftPlan(task)
        ? task.schedulingStatus === 'no_schedule'
          ? '该工序任务为无需排产状态，不可调整班次计划'
          : '当前任务状态不允许调整班次计划'
        : allocation
          ? '双击修改，拖拽可调整班次'
          : '双击录入排产数量'
    ].join('\n')
  }
</script>

<style scoped lang="scss">
  .schedule-board {
    --info-width: 864px;
    --slot-width: 84px;
    --gantt-processing: #22a06b;
    --gantt-adjusting: #f4bd62;
    --gantt-pending: #636b78;
    --gantt-over-capacity: #f3a7a7;

    display: grid;
    grid-template-columns: var(--info-width) calc(var(--slot-count) * var(--slot-width));
    width: calc(var(--info-width) + var(--slot-count) * var(--slot-width));
    min-height: max(100%, var(--board-height));
    color: var(--el-text-color-primary);
    background: var(--default-box-color);

    &__corner,
    &__column-header,
    &__task-info,
    &__group-label {
      position: sticky;
      left: 0;
      z-index: 4;
      grid-column: 1;
      background: var(--default-box-color);
      border-right: 1px solid var(--el-border-color-lighter);
    }

    &__corner {
      top: 0;
      z-index: 8;
      display: grid;
      align-content: center;
      height: 52px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      span {
        font-size: 13px;
        font-weight: 650;
      }

      small {
        margin-top: 2px;
        font-size: 10px;
        color: var(--el-text-color-secondary);
      }
    }

    &__date-header,
    &__shift-header {
      position: sticky;
      z-index: 7;
      display: grid;
      grid-template-columns: repeat(var(--slot-count), var(--slot-width));
      grid-column: 2;
      background: var(--art-gray-100);
    }

    &__date-header {
      top: 0;
      height: 52px;
    }

    &__date {
      display: flex;
      gap: 5px;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      border-right: 1px solid var(--el-border-color-lighter);
      border-bottom: 1px solid var(--el-border-color-lighter);

      strong {
        font-variant-numeric: tabular-nums;
      }

      span {
        color: var(--el-text-color-secondary);
      }

      &.is-weekend {
        background: color-mix(in srgb, var(--el-color-info) 5%, transparent);
      }

      &.is-today {
        color: var(--theme-color);
        box-shadow: inset 0 2px 0 var(--theme-color);
      }
    }

    &__column-header {
      top: 52px;
      z-index: 8;
      display: grid;
      grid-template-columns: 148px 210px 112px repeat(5, 68px) 54px;
      align-items: center;
      height: 52px;
      color: var(--el-text-color-secondary);
      background: var(--art-gray-100);
      border-bottom: 1px solid var(--el-border-color-lighter);

      span {
        padding: 0 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        font-weight: 600;
        text-align: right;
        white-space: nowrap;

        &:first-child,
        &:nth-child(2) {
          text-align: left;
        }

        &:nth-child(3) {
          text-align: center;
        }
      }
    }

    &__shift-header {
      top: 52px;
      height: 52px;
    }

    &__shift {
      display: grid;
      place-content: center;
      min-width: 0;
      text-align: center;
      border-right: 1px solid var(--el-border-color-lighter);
      border-bottom: 1px solid var(--el-border-color-lighter);

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        white-space: nowrap;
      }

      small {
        margin-top: 2px;
        font-size: 9px;
        color: var(--el-text-color-secondary);
      }

      &.is-rest {
        color: var(--el-text-color-placeholder);
        background: var(--art-gray-200);
      }

      &.is-today {
        background: color-mix(in srgb, var(--theme-color) 6%, var(--art-gray-100));
      }
    }

    &__group-label,
    &__group-track {
      height: 44px;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__group-label {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      width: 100%;
      padding: 0 16px;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
      background: color-mix(in srgb, var(--theme-color) 5%, var(--default-box-color));
      border-top: 0;
      border-bottom: 1px solid var(--el-border-color-lighter);
      border-left: 0;

      > span {
        display: flex;
        gap: 8px;
        align-items: baseline;
        min-width: 0;

        strong {
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 12px;
          white-space: nowrap;
        }

        small {
          flex: none;
          font-size: 10px;
          color: var(--el-text-color-secondary);
        }
      }

      > b {
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--theme-color);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: -2px;
      }
    }

    &__group-track,
    &__task-track {
      display: grid;
      grid-template-columns: repeat(var(--slot-count), var(--slot-width));
      grid-column: 2;
    }

    &__group-track {
      background: color-mix(in srgb, var(--theme-color) 4%, var(--default-box-color));

      span {
        border-right: 1px solid var(--el-border-color-lighter);
      }
    }

    &__task-info,
    &__task-track {
      height: 74px;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__task-info {
      display: grid;
      grid-template-columns: 148px 210px 112px repeat(5, 68px) 54px;
      align-items: center;
      min-width: 0;
      box-shadow: inset 3px 0 0 var(--el-text-color-placeholder);

      &.is-processing {
        box-shadow: inset 3px 0 0 var(--el-color-success);
      }

      &.is-adjusting {
        box-shadow: inset 3px 0 0 var(--el-color-warning);
      }

      &.is-over-capacity {
        box-shadow: inset 3px 0 0 var(--el-color-danger);
      }
    }

    &__machine,
    &__order {
      min-width: 0;
      padding: 0 8px;
    }

    &__machine {
      display: flex;
      gap: 7px;
      align-items: center;

      > span:last-child {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-size: 11px;
      }

      small {
        margin-top: 3px;
        font-size: 9px;
        color: var(--el-text-color-secondary);
      }
    }

    &__status-dot {
      flex: 0 0 8px;
      width: 8px;
      height: 8px;
      background: var(--el-text-color-placeholder);
      border-radius: 50%;

      .is-processing & {
        background: var(--el-color-success);
      }

      .is-adjusting & {
        background: var(--el-color-warning);
      }

      .is-over-capacity & {
        background: var(--el-color-danger);
      }
    }

    &__order {
      display: grid;

      strong,
      span,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-size: 11px;
      }

      span {
        margin-top: 2px;
        font-size: 10px;
        color: var(--el-text-color-regular);
      }

      small {
        margin-top: 2px;
        font-size: 9px;
        color: var(--el-text-color-secondary);
      }
    }

    &__due-date {
      min-width: 0;
      padding: 0 4px;
      overflow: hidden;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-regular);
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;

      span {
        color: var(--el-text-color-placeholder);
      }
    }

    &__quantity {
      padding: 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-align: right;
      white-space: nowrap;

      &.is-assigned {
        font-weight: 700;
      }

      &.is-completed {
        font-weight: 700;
        color: var(--el-color-success);
      }

      &.is-pending {
        font-weight: 700;
        color: var(--el-color-danger-dark-2);
      }

      &.is-scheduled {
        font-weight: 700;
        color: var(--theme-color);
      }

      &.is-unscheduled {
        font-weight: 700;
        color: var(--el-color-warning-dark-2);
      }
    }

    &__actions {
      display: grid;
      place-items: center;
    }

    &__task-track {
      background-image: linear-gradient(
        to right,
        transparent calc(100% - 1px),
        var(--el-border-color-lighter) calc(100% - 1px)
      );
      background-size: var(--slot-width) 100%;
    }

    &__cell {
      position: relative;
      display: grid;
      place-items: center;
      min-width: 0;
      height: 74px;
      padding: 8px 4px;
      font: inherit;
      color: var(--el-text-color-secondary);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-right: 1px solid var(--el-border-color-lighter);

      &::before {
        position: absolute;
        inset: 20px 5px;
        content: '';
        background: var(--art-gray-200);
        border-radius: var(--el-border-radius-base);
      }

      &:hover:not(:disabled)::before,
      &:focus-visible::before {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-color) 36%, transparent);
      }

      &:focus-visible {
        outline: none;
      }

      &.is-unavailable {
        cursor: not-allowed;

        &::before {
          background: color-mix(in srgb, var(--art-gray-100) 60%, transparent);
        }
      }

      &.has-allocation::before {
        background: var(--gantt-pending);
      }

      .is-processing &.has-allocation::before {
        background: var(--gantt-processing);
      }

      .is-adjusting &.has-allocation::before {
        background: var(--gantt-adjusting);
      }

      &.is-over-capacity::before {
        background: var(--gantt-over-capacity);
        box-shadow: inset 0 0 0 1px var(--el-color-danger-light-5);
      }

      &.is-drag-target::before {
        background: color-mix(in srgb, var(--theme-color) 14%, var(--default-box-color));
        box-shadow: inset 0 0 0 2px var(--theme-color);
      }
    }

    &__cell-value,
    &__empty-slot,
    &__rest-slot,
    &__completion {
      position: relative;
      z-index: 1;
    }

    &__cell-value {
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #fff;

      .is-adjusting &,
      .is-over-capacity & {
        color: #4a3822;
      }
    }

    &__empty-slot,
    &__rest-slot {
      font-size: 9px;
      color: var(--el-text-color-placeholder);
    }

    &__completion {
      position: absolute;
      right: 5px;
      bottom: 4px;
      display: inline-flex;
      gap: 1px;
      align-items: center;
      font-size: 10px;

      &.is-achieved {
        color: var(--el-color-success);
      }

      &.is-shortfall {
        color: var(--el-color-danger);
      }

      &.is-excess {
        color: var(--el-color-warning-dark-2);
      }

      small {
        font-size: 8px;
        font-variant-numeric: tabular-nums;
      }
    }

    @media (width <= 1280px) {
      --info-width: 742px;
      --slot-width: 78px;

      &__column-header,
      &__task-info {
        grid-template-columns: 126px 176px 100px repeat(5, 58px) 50px;
      }
    }
  }
</style>
