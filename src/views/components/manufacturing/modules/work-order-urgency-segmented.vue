<template>
  <ElSegmented
    class="work-order-urgency"
    :model-value="modelValue"
    :options="options"
    :disabled="disabled"
    aria-label="选择紧急程度"
    @update:model-value="emit('update:modelValue', $event as WorkOrderUrgency)"
  >
    <template #default="{ item }">
      <span class="work-order-urgency__label">
        <span>{{ item.label }}</span>
        <span v-if="item.stars" class="work-order-urgency__stars" aria-hidden="true">{{
          item.stars
        }}</span>
      </span>
    </template>
  </ElSegmented>
</template>

<script setup lang="ts">
  import type { WorkOrderUrgency } from '@mes/api'

  withDefaults(
    defineProps<{
      modelValue: WorkOrderUrgency
      disabled?: boolean
    }>(),
    { disabled: false }
  )

  const emit = defineEmits<{ 'update:modelValue': [value: WorkOrderUrgency] }>()
  const options = [
    { label: '常规', value: 'normal', stars: '' },
    { label: '急', value: 'urgent1', stars: '*' },
    { label: '加急', value: 'urgent2', stars: '**' },
    { label: '特急', value: 'urgent3', stars: '***' }
  ]
</script>

<style scoped lang="scss">
  .work-order-urgency {
    max-width: 100%;

    &__label {
      display: inline-flex;
      gap: 2px;
      align-items: baseline;
      white-space: nowrap;
    }

    &__stars {
      font-weight: 700;
      color: var(--el-color-danger);
    }
  }
</style>
