<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="rule-dialog">
      <ArtEntitySummary
        icon="ri:calendar-check-line"
        eyebrow="SCHEDULING POLICY"
        :title="model.name || '新排产规则'"
        description="统一维护排产方向、产能约束、时间组成与冲突处理口径。"
      />
      <ArtForm
        ref="formRef"
        v-model="model"
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
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { cloneDeep } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { saveSchedulingRule, type MesSchedulingRule, type MesSchedulingRuleInput } from '@mes/api'

  const mesSchedulingConflictPolicyOptions = useDictionaryOptions('mesSchedulingConflictPolicy')
  const mesSchedulingDirectionOptions = useDictionaryOptions('mesSchedulingDirection')
  const mesSchedulingPriorityRuleOptions = useDictionaryOptions('mesSchedulingPriorityRule')
  const mesSchedulingWorkCenterRuleOptions = useDictionaryOptions('mesSchedulingWorkCenterRule')

  export interface RuleDialogOpenData {
    tenantId: string
    row?: MesSchedulingRule
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<RuleDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const editId = ref('')
  const createModel = (tenantId = ''): MesSchedulingRuleInput => ({
    tenantId,
    code: '',
    name: '',
    enabled: true,
    isDefault: false,
    direction: 'forward',
    dispatchingRule: 'priority',
    finiteCapacity: true,
    respectCalendar: true,
    includeSetupTime: true,
    includeQueueTime: true,
    includeTransferTime: true,
    preserveLockedTasks: true,
    allowOvertime: false,
    frozenHorizonDays: 0,
    planningHorizonDays: 90,
    priorityWeight: 50,
    dueDateWeight: 30,
    criticalOperationWeight: 20,
    resourceSelectionStrategy: 'earliest_available',
    conflictStrategy: 'reject',
    remark: ''
  })
  const model = reactive(createModel())
  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '规则身份', type: 'divider', span: 24 },
    { key: 'code', label: '规则编码', type: 'input', props: { maxlength: 40 } },
    { key: 'name', label: '规则名称', type: 'input', props: { maxlength: 100 } },
    { key: 'enabled', label: '启用', type: 'switch' },
    { key: 'isDefault', label: '默认规则', type: 'switch' },
    { key: 'engine', label: '排程引擎', type: 'divider', span: 24 },
    {
      key: 'direction',
      label: '排产方向',
      type: 'select',
      options: mesSchedulingDirectionOptions
    },
    {
      key: 'dispatchingRule',
      label: '派工顺序',
      type: 'select',
      options: mesSchedulingPriorityRuleOptions
    },
    {
      key: 'resourceSelectionStrategy',
      label: '资源选择',
      type: 'select',
      options: mesSchedulingWorkCenterRuleOptions
    },
    {
      key: 'conflictStrategy',
      label: '冲突策略',
      type: 'select',
      options: mesSchedulingConflictPolicyOptions
    },
    { key: 'finiteCapacity', label: '启用有限产能', type: 'switch' },
    { key: 'respectCalendar', label: '遵循生产日历', type: 'switch' },
    { key: 'preserveLockedTasks', label: '保留锁定任务', type: 'switch' },
    { key: 'allowOvertime', label: '允许加班产能', type: 'switch' },
    { key: 'time', label: '时间组成与范围', type: 'divider', span: 24 },
    { key: 'includeSetupTime', label: '计入调机时间', type: 'switch' },
    { key: 'includeQueueTime', label: '计入排队时间', type: 'switch' },
    { key: 'includeTransferTime', label: '计入转运时间', type: 'switch' },
    {
      key: 'frozenHorizonDays',
      label: '冻结期(天)',
      type: 'number',
      props: { min: 0, max: 365, precision: 0 }
    },
    {
      key: 'planningHorizonDays',
      label: '展望期(天)',
      type: 'number',
      props: { min: 1, max: 730, precision: 0 }
    },
    { key: 'weight', label: '优先级权重（合计 100）', type: 'divider', span: 24 },
    {
      key: 'priorityWeight',
      label: '物料/工单优先级',
      type: 'number',
      props: { min: 0, max: 100, precision: 0 }
    },
    {
      key: 'dueDateWeight',
      label: '交期权重',
      type: 'number',
      props: { min: 0, max: 100, precision: 0 }
    },
    {
      key: 'criticalOperationWeight',
      label: '关键工序权重',
      type: 'number',
      props: { min: 0, max: 100, precision: 0 }
    },
    {
      key: 'remark',
      label: '规则说明',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000, showWordLimit: true }
    }
  ])
  const rules = {
    code: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
    name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }]
  }

  async function handleOpen(data: RuleDialogOpenData): Promise<void> {
    editId.value = data.row?.id || ''
    Object.assign(model, data.row ? cloneDeep(data.row) : createModel(data.tenantId))
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑排产规则' : '新增排产规则',
      subtitle: '规则保存后可在排产工作台预演，确认后再应用。',
      confirmText: '保存规则',
      contentMaxHeight: '70vh',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          if (model.priorityWeight + model.dueDateWeight + model.criticalOperationWeight !== 100) {
            ElMessage.warning('三项优先级权重合计必须为 100')
            return false
          }
          await saveSchedulingRule(
            {
              ...cloneDeep(model),
              code: model.code.trim().toUpperCase(),
              name: model.name.trim(),
              remark: model.remark.trim()
            },
            editId.value || undefined
          )
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '排程规则提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .rule-dialog {
    display: grid;
    gap: var(--art-space-4);
  }
</style>
