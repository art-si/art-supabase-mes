<template>
  <span
    v-if="showText || meta.stars"
    class="work-order-urgency-label"
    :aria-label="accessibleLabel"
  >
    <span v-if="showText">{{ meta.label }}</span>
    <span v-if="meta.stars" class="work-order-urgency-label__stars" aria-hidden="true">{{
      meta.stars
    }}</span>
  </span>
</template>

<script setup lang="ts">
  import type { WorkOrderUrgency } from '@mes/api'

  const props = withDefaults(
    defineProps<{
      urgency: WorkOrderUrgency
      showText?: boolean
    }>(),
    { showText: true }
  )

  const urgencyMeta: Record<WorkOrderUrgency, { label: string; stars: string }> = {
    normal: { label: '常规', stars: '' },
    urgent1: { label: '急', stars: '*' },
    urgent2: { label: '加急', stars: '**' },
    urgent3: { label: '特急', stars: '***' }
  }
  const meta = computed(() => urgencyMeta[props.urgency])
  const accessibleLabel = computed(() => `${meta.value.label}${meta.value.stars}`)
</script>

<style scoped lang="scss">
  .work-order-urgency-label {
    display: inline-flex;
    gap: 2px;
    align-items: baseline;
    min-width: 0;

    &__stars {
      font-weight: 700;
      color: var(--el-color-danger);
    }
  }
</style>
