<template>
  <ArtDrawer ref="drawerRef" size="sm">
    <div class="scheduling-filter-drawer">
      <div class="scheduling-filter-drawer__intro">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:filter-3-line" /></span>
        <div>
          <strong>组合筛选待排产任务</strong>
          <p>多个条件可叠加使用；留空的条件不会限制查询结果。</p>
        </div>
      </div>

      <ArtForm
        v-model="formData"
        :items="formItems"
        :span="24"
        :show-reset="false"
        :show-submit="false"
        label-position="top"
      />
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  const mesOperationTaskScheduleStatusOptions = useDictionaryOptions(
    'mesOperationTaskScheduleStatus'
  )

  defineOptions({ name: 'SchedulingAdvancedFilterDrawer' })

  export interface SchedulingAdvancedFilters {
    workOrderNo: string
    materialKeyword: string
    specProjectKeyword: string
    trackingCustomerKeyword: string
    schedulingStatus: string
  }

  const emit = defineEmits<{ apply: [filters: SchedulingAdvancedFilters] }>()
  const drawerRef = ref<ArtDrawerExpose<SchedulingAdvancedFilters>>()
  const formData = ref<SchedulingAdvancedFilters>(createInitialFilters())
  const formItems: FormItem[] = [
    {
      key: 'workOrderNo',
      label: '工单号',
      type: 'input',
      span: 24,
      props: { clearable: true, placeholder: '输入工单号进行模糊查询' }
    },
    {
      key: 'materialKeyword',
      label: '物料',
      type: 'input',
      span: 24,
      props: { clearable: true, placeholder: '物料编码或物料名称' }
    },
    {
      key: 'specProjectKeyword',
      label: '规格 / 项目',
      type: 'input',
      span: 24,
      props: { clearable: true, placeholder: '规格型号或项目名称' }
    },
    {
      key: 'trackingCustomerKeyword',
      label: '跟踪 / 客户',
      type: 'input',
      span: 24,
      props: { clearable: true, placeholder: '计划跟踪单号或客户代码' }
    },
    {
      key: 'schedulingStatus',
      label: '排产状态',
      type: 'select',
      span: 24,
      props: { clearable: true, placeholder: '全部排产状态' },
      options: mesOperationTaskScheduleStatusOptions
    }
  ]

  function createInitialFilters(): SchedulingAdvancedFilters {
    return {
      workOrderNo: '',
      materialKeyword: '',
      specProjectKeyword: '',
      trackingCustomerKeyword: '',
      schedulingStatus: ''
    }
  }

  async function handleOpen(filters: SchedulingAdvancedFilters): Promise<void> {
    formData.value = { ...filters }
    await drawerRef.value?.handleOpen(formData.value, {
      title: '更多查询条件',
      subtitle: '按工单、物料、项目与排产状态进一步缩小任务范围',
      confirmText: '应用条件',
      onConfirm: () => {
        emit('apply', { ...formData.value })
        return true
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .scheduling-filter-drawer {
    &__intro {
      display: flex;
      gap: var(--art-space-3);
      align-items: flex-start;
      padding: 14px;
      margin: 0 16px 4px;
      background: var(--art-gray-100);
      border-radius: var(--art-control-radius);

      > span {
        display: grid;
        flex: none;
        place-items: center;
        width: 34px;
        height: 34px;
        font-size: 18px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
        border-radius: var(--art-control-radius);
      }

      > div {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      strong {
        font-size: 14px;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
