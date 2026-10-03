<template>
  <ElTag
    :type="workOrderStatusMeta[status].type"
    effect="light"
    :class="`work-order-status--${status.toLowerCase()}`"
  >
    {{ workOrderStatusMeta[status].label }}
  </ElTag>
</template>

<script setup lang="ts">
  import { ElTag } from 'element-plus'
  import type { WorkOrderDisplayStatus } from '@mes/api'
  import { workOrderStatusMeta } from './work-order-status'

  defineProps<{ status: WorkOrderDisplayStatus }>()
</script>

<style scoped lang="scss">
  .work-order-status {
    &--pdlv {
      --el-tag-bg-color: color-mix(in srgb, #0d9488 10%, var(--el-bg-color));
      --el-tag-border-color: color-mix(in srgb, #0d9488 24%, transparent);
      --el-tag-text-color: #0d9488;
    }

    &--teco {
      --el-tag-bg-color: color-mix(in srgb, #7c3aed 10%, var(--el-bg-color));
      --el-tag-border-color: color-mix(in srgb, #7c3aed 24%, transparent);
      --el-tag-text-color: #7c3aed;
    }

    &--clsd {
      --el-tag-bg-color: color-mix(in srgb, var(--art-gray-900) 10%, var(--el-bg-color));
      --el-tag-border-color: color-mix(in srgb, var(--art-gray-900) 24%, transparent);
      --el-tag-text-color: var(--art-gray-900);
    }
  }
</style>
