<template>
  <div class="flex w-full min-w-0 flex-col gap-3">
    <ArtEmptyState
      v-if="!record"
      :title="mode === 'issues' ? '保存工单后查看领用流水' : '保存工单后生成生产资料'"
      :description="
        mode === 'issues'
          ? '领用流水记录仓库实际过账的领料与退料；新工单尚无领用记录。'
          : '先在“产品与计划”中选择物料并保存工单，系统将自动集成 BOM 组件与工艺路线。'
      "
    />
    <WorkOrderIssueHistory v-else-if="mode === 'issues'" :row="record" />
    <template v-else>
      <p class="text-xs leading-5 text-g-700">
        以下为当前工单已保存的{{ mode === 'bom' ? 'BOM 组件' : '工艺路线' }}快照<span
          v-if="!isReadOnly"
          >；本次表单修改保存后生效</span
        >。
      </p>
      <WorkOrderSnapshotPanel :row="record" :mode="mode" :can-edit="false" :show-summary="false" />
    </template>
  </div>
</template>

<script setup lang="ts">
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import type { MesWorkOrder } from '@mes/api'
  import WorkOrderSnapshotPanel from './work-order-snapshot-panel.vue'
  import WorkOrderIssueHistory from './work-order-issue-history.vue'

  export type WorkOrderRelatedMode = 'bom' | 'route' | 'issues'

  defineProps<{
    record?: MesWorkOrder
    mode: WorkOrderRelatedMode
    isReadOnly?: boolean
  }>()
</script>
