<template>
  <section class="center-overview" aria-label="工作中心任务总览">
    <header class="center-overview__header">
      <div>
        <span>任务总览</span>
        <strong>{{
          selectedCenter ? `${selectedCenter.code} · ${selectedCenter.name}` : scopeLabel
        }}</strong>
      </div>
      <div class="center-overview__actions">
        <ArtTooltip content="仅显示空闲工作中心" placement="bottom">
          <ArtIconButton
            icon="ri:filter-3-line"
            label="仅显示空闲工作中心"
            :class="{ 'is-active': idleOnly }"
            :aria-pressed="idleOnly"
            @click="idleOnly = !idleOnly"
          />
        </ArtTooltip>
        <ArtTooltip content="显示物料名称和数量" placement="bottom">
          <ArtIconButton
            icon="ri:stack-line"
            label="显示物料名称和数量"
            :class="{ 'is-active': showMaterial }"
            :aria-pressed="showMaterial"
            @click="showMaterial = !showMaterial"
          />
        </ArtTooltip>
        <ArtTooltip v-if="selectedCenter" content="返回工作中心总览" placement="bottom">
          <ArtIconButton
            icon="ri:arrow-left-line"
            label="返回工作中心总览"
            @click="selectedCenterId = ''"
          />
        </ArtTooltip>
      </div>
    </header>

    <nav class="center-overview__links" aria-label="任务总览快捷操作">
      <slot name="import">
        <button type="button" @click="emit('import')">
          <ArtSvgIcon icon="ri:file-upload-line" />导入
        </button>
      </slot>
      <button type="button" @click="emit('gantt')">
        <ArtSvgIcon icon="ri:bar-chart-horizontal-line" />当班甘特图
      </button>
      <button type="button" @click="emit('daily-plan')">
        <ArtSvgIcon icon="ri:calendar-check-line" />日计划
      </button>
    </nav>

    <ElScrollbar class="center-overview__scrollbar" always>
      <div v-if="!selectedCenter" class="center-overview__grid">
        <button
          v-for="center in visibleCenters"
          :key="center.id"
          type="button"
          class="center-overview__card"
          :class="{ 'is-over-capacity': center.scheduledHours > center.shiftCapacityHours }"
          @click="selectedCenterId = center.id"
        >
          <span class="center-overview__identity">
            <strong>{{ center.code }}</strong>
            <span :title="center.name">{{ center.name }}</span>
          </span>
          <span class="center-overview__metrics">
            <span
              ><b>{{ center.quantity }}</b
              ><small>排产数量</small></span
            >
            <span
              ><b>{{ center.scheduledHours.toFixed(1) }} H</b><small>排产产能</small></span
            >
            <span
              ><b>{{ center.orderCount }}</b
              ><small>工单计数</small></span
            >
            <span
              ><b>{{ center.shiftCapacityHours.toFixed(1) }}</b
              ><small>当班产能</small></span
            >
          </span>
          <span class="center-overview__capacity">
            <span>{{ center.operatorCount }} 人 / {{ center.machineCount }} 机</span>
            <span>{{ center.shiftLabel }}</span>
          </span>
          <span v-if="showMaterial" class="center-overview__material">
            {{ center.materialSummary || '暂无排产物料' }}
          </span>
        </button>
      </div>

      <div v-else class="center-overview__detail">
        <div class="center-overview__detail-search">
          <ElInput v-model="detailKeyword" clearable placeholder="工单号 / 产品编码 / 品名">
            <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
          </ElInput>
          <ArtIconButton
            icon="ri:inbox-unarchive-line"
            label="批量结案"
            permission="MesOperationTask:Close"
            :disabled="!detailSelectedIds.length"
            @click="emit('batch-close', detailSelectedIds)"
          />
        </div>
        <article v-for="task in detailTasks" :key="task.id" class="center-overview__task">
          <ElCheckbox
            :model-value="detailSelectedIds.includes(task.id)"
            :aria-label="`选择${task.taskNo}`"
            @change="toggleDetailTask(task.id, Boolean($event))"
          />
          <div>
            <strong>{{ task.taskNo }}</strong>
            <span>
              {{ task.workOrder?.workOrderTypeNameSnapshot || '生产工单' }} ·
              {{ task.workOrder?.workOrderNo || '—' }}
            </span>
            <small>{{ task.workOrder?.projectNameSnapshot || '无项目名称' }}</small>
          </div>
          <div>
            <strong>{{ task.workOrder?.materialNameSnapshot || '—' }}</strong>
            <span>{{ task.workOrder?.materialCodeSnapshot || '—' }}</span>
            <small
              >{{ task.plannedStartDate || '待定' }} — {{ task.plannedEndDate || '待定' }}</small
            >
          </div>
          <div class="center-overview__task-quantity">
            <strong>{{ quantityForCenter(task) }} / {{ task.completedQuantity }}</strong>
            <span>工序 / 已完成</span>
            <small>预计 {{ hoursForCenter(task).toFixed(2) }} H</small>
          </div>
          <strong class="center-overview__unfinished">
            {{ Math.max(quantityForCenter(task) - Number(task.completedQuantity || 0), 0) }}
            <small>未完成</small>
          </strong>
        </article>
        <ArtEmptyState
          v-if="!detailTasks.length"
          title="当前工作中心暂无匹配任务"
          description="请清除关键字，或返回总览选择其他工作中心。"
          :visual-size="72"
        />
      </div>
    </ElScrollbar>

    <footer class="center-overview__footer">
      <span>未完成</span>
      <strong>{{ footerStats.tasks }} 单</strong>
      <span>{{ footerStats.hours.toFixed(1) }} H</span>
      <span>{{ footerStats.quantity }} PCS</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import type {
    MesOperationTask,
    MesProductionScopeCenter,
    MesSchedulingShift,
    MesWorkOrderRouteStepSnapshot
  } from '@mes/api'

  interface Props {
    centers: MesProductionScopeCenter[]
    tasks: MesOperationTask[]
    shift?: MesSchedulingShift
    scopeLabel: string
  }

  interface CenterOverview extends MesProductionScopeCenter {
    quantity: number
    scheduledHours: number
    orderCount: number
    shiftCapacityHours: number
    operatorCount: number
    machineCount: number
    shiftLabel: string
    materialSummary: string
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    import: []
    gantt: []
    'daily-plan': []
    'batch-close': [ids: string[]]
  }>()
  const selectedCenterId = ref('')
  const idleOnly = ref(false)
  const showMaterial = ref(false)
  const detailKeyword = ref('')
  const detailSelectedIds = ref<string[]>([])

  const selectedCenter = computed(() =>
    props.centers.find((center) => center.id === selectedCenterId.value)
  )
  const centerOverview = computed<CenterOverview[]>(() =>
    props.centers.map((center) => {
      const centerTasks = props.tasks.filter((task) => taskQuantityForCenter(task, center.id) > 0)
      const coefficients = centerTasks.map(routeCoefficient)
      const operatorCount = Math.max(
        center.headcount || 1,
        ...coefficients.map((item) => item.operatorCount)
      )
      const machineCount = Math.max(
        center.parallelCapacity || 1,
        ...coefficients.map((item) => item.machineCount)
      )
      const shiftHours =
        Number(props.shift?.durationMinutes || center.dailyCapacityMinutes || 480) / 60
      const materials = centerTasks
        .map(
          (task) =>
            `${task.workOrder?.materialNameSnapshot || task.operationName} ${taskQuantityForCenter(task, center.id)}`
        )
        .slice(0, 3)
      return {
        ...center,
        quantity: Number(
          centerTasks
            .reduce((total, task) => total + taskQuantityForCenter(task, center.id), 0)
            .toFixed(2)
        ),
        scheduledHours: centerTasks.reduce(
          (total, task) => total + taskHoursForCenter(task, center.id),
          0
        ),
        orderCount: new Set(centerTasks.map((task) => task.workOrderId)).size,
        shiftCapacityHours: machineCount * shiftHours,
        operatorCount,
        machineCount,
        shiftLabel: props.shift
          ? `${props.shift.name} ${props.shift.startTime}-${props.shift.endTime}`
          : '标准班次',
        materialSummary: materials.join('；')
      }
    })
  )
  const visibleCenters = computed(() =>
    idleOnly.value
      ? centerOverview.value.filter((center) => center.quantity === 0)
      : centerOverview.value
  )
  const detailTasks = computed(() => {
    if (!selectedCenterId.value) return []
    const keyword = detailKeyword.value.trim().toLocaleLowerCase()
    return props.tasks
      .filter((task) => taskQuantityForCenter(task, selectedCenterId.value) > 0)
      .filter((task) => {
        if (!keyword) return true
        return [
          task.taskNo,
          task.workOrder?.workOrderNo,
          task.workOrder?.materialCodeSnapshot,
          task.workOrder?.materialNameSnapshot
        ].some((value) => value?.toLocaleLowerCase().includes(keyword))
      })
  })
  const footerStats = computed(() => ({
    tasks: props.tasks.filter((task) => Number(task.pendingScheduleQuantity || 0) > 0).length,
    hours: props.tasks.reduce(
      (total, task) => total + Number(task.estimatedWorkMinutes || 0) / 60,
      0
    ),
    quantity: Number(
      props.tasks
        .reduce((total, task) => total + Number(task.pendingScheduleQuantity || 0), 0)
        .toFixed(2)
    )
  }))

  function routeCoefficient(
    task: MesOperationTask
  ): Pick<MesWorkOrderRouteStepSnapshot, 'operatorCount' | 'machineCount'> {
    const steps = task.workOrder?.routeSnapshot?.steps || []
    const step =
      steps.find((item) => item.id === task.routeStepId) ||
      steps.find((item) => item.operationCode === task.operationCode)
    return {
      operatorCount: Number(step?.operatorCount || 1),
      machineCount: Number(step?.machineCount || 1)
    }
  }

  function taskQuantityForCenter(task: MesOperationTask, centerId: string): number {
    const allocations = task.allocations || []
    if (allocations.length) {
      return allocations
        .filter((allocation) => allocation.workCenterId === centerId)
        .reduce((total, allocation) => total + Number(allocation.quantity || 0), 0)
    }
    return task.workCenterId === centerId ? Number(task.scheduledQuantity || 0) : 0
  }

  function taskHoursForCenter(task: MesOperationTask, centerId: string): number {
    const quantity = taskQuantityForCenter(task, centerId)
    const planned = Number(task.plannedQuantity || 0)
    if (!quantity || !planned) return 0
    return (Number(task.estimatedWorkMinutes || 0) * quantity) / planned / 60
  }

  function quantityForCenter(task: MesOperationTask): number {
    return taskQuantityForCenter(task, selectedCenterId.value)
  }

  function hoursForCenter(task: MesOperationTask): number {
    return taskHoursForCenter(task, selectedCenterId.value)
  }

  function toggleDetailTask(id: string, checked: boolean): void {
    detailSelectedIds.value = checked
      ? [...detailSelectedIds.value, id]
      : detailSelectedIds.value.filter((item) => item !== id)
  }

  watch(selectedCenterId, () => {
    detailKeyword.value = ''
    detailSelectedIds.value = []
  })
</script>

<style scoped lang="scss">
  .center-overview {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--default-box-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--art-surface-radius);

    &__header,
    &__links,
    &__footer {
      flex: none;
    }

    &__header {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      justify-content: space-between;
      min-height: 58px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      > div:first-child {
        display: grid;
        min-width: 0;

        span {
          font-size: 11px;
          color: var(--el-text-color-secondary);
        }

        strong {
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 14px;
          white-space: nowrap;
        }
      }
    }

    &__actions,
    &__links {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
    }

    &__actions {
      :deep(.art-icon-button) {
        background: var(--art-gray-100);
        border: 1px solid var(--el-border-color-lighter);

        &.is-active {
          color: var(--theme-color);
          background: color-mix(in srgb, var(--theme-color) 12%, var(--default-box-color));
          border-color: color-mix(in srgb, var(--theme-color) 34%, var(--el-border-color));
        }
      }
    }

    &__links {
      justify-content: flex-end;
      padding: 8px 14px;
      background: var(--art-gray-100);
      border-bottom: 1px solid var(--el-border-color-lighter);

      button {
        display: inline-flex;
        gap: 5px;
        align-items: center;
        min-height: 28px;
        padding: 0 5px;
        font-size: 12px;
        color: var(--theme-color);
        cursor: pointer;
        background: transparent;
        border: 0;
        border-radius: var(--art-control-radius);

        &:hover,
        &:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--theme-color) 35%, transparent);
          outline-offset: 1px;
          background: color-mix(in srgb, var(--theme-color) 9%, transparent);
        }
      }

      :deep(.el-button) {
        min-height: 28px;
        padding: 0 5px;
        margin: 0;
        font-size: 12px;
      }
    }

    &__scrollbar {
      flex: 1;
      min-height: 0;
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      padding: 12px;
    }

    &__card {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 11px;
      color: inherit;
      text-align: left;
      cursor: pointer;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-control-radius);
      clip-path: polygon(
        0 0,
        calc(100% - 12px) 0,
        100% 12px,
        100% 100%,
        12px 100%,
        0 calc(100% - 12px)
      );
      transition:
        border-color var(--el-transition-duration-fast),
        background-color var(--el-transition-duration-fast),
        transform var(--el-transition-duration-fast);

      &:hover,
      &:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--theme-color) 28%, transparent);
        outline-offset: 1px;
        background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--theme-color) 45%, var(--el-border-color));
        transform: translateY(-1px);
      }

      &.is-over-capacity {
        background: var(--el-color-danger-light-9);
        border-color: var(--el-color-danger-light-5);
      }
    }

    &__identity,
    &__capacity {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      justify-content: space-between;
      min-width: 0;
    }

    &__identity {
      flex-direction: column;
      align-items: flex-start;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      strong {
        font-size: 12px;
        color: var(--theme-color);
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
    }

    &__metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      padding: 10px 0;

      > span {
        display: grid;

        b {
          font-size: 13px;
          font-variant-numeric: tabular-nums;
        }

        small {
          font-size: 10px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    &__capacity,
    &__material {
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }

    &__capacity {
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    &__material {
      padding-top: 8px;
      margin-top: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-top: 1px dashed var(--el-border-color);
    }

    &__detail {
      display: grid;
      gap: 0;
      padding: 12px;
    }

    &__detail-search {
      display: flex;
      gap: var(--art-space-2);
      padding-bottom: 10px;

      .el-input {
        flex: 1;
      }
    }

    &__task {
      display: grid;
      grid-template-columns: 28px minmax(150px, 1.2fr) minmax(150px, 1fr) 120px 72px;
      gap: 12px;
      align-items: center;
      padding: 12px 8px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      > div {
        display: grid;
        min-width: 0;

        strong,
        span,
        small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        strong {
          font-size: 12px;
        }

        span,
        small {
          font-size: 10px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    &__task-quantity,
    &__unfinished {
      text-align: right;
    }

    &__unfinished {
      display: grid;
      font-size: 15px;
      font-variant-numeric: tabular-nums;
      color: var(--el-color-danger);

      small {
        font-size: 10px;
        font-weight: 400;
        color: var(--el-text-color-secondary);
      }
    }

    &__footer {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 8px 12px;
      font-size: 11px;
      color: var(--el-color-danger);
      background: var(--art-gray-100);
      border-top: 1px solid var(--el-border-color-lighter);

      strong {
        font-variant-numeric: tabular-nums;
      }
    }

    @media (width <= 1100px) {
      &__grid {
        grid-template-columns: 1fr;
      }

      &__task {
        grid-template-columns: 28px minmax(150px, 1fr) 110px 64px;

        > div:nth-of-type(2) {
          display: none;
        }
      }
    }
  }
</style>
