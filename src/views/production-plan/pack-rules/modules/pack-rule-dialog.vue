<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="grid gap-4">
      <ArtEntitySummary
        icon="ri:archive-stack-line"
        eyebrow="PACKING POLICY"
        :title="model.ruleName || '排包规则'"
        description="按板材类型和板厚配置装包上限、同编号约束与聚合顺序。"
      />
      <ArtForm
        ref="formRef"
        v-model="model"
        :items="items"
        :rules="formRules"
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
  import { savePackRule, type PackRule, type PackRuleInput } from '@mes/api'

  const mesPackRuleBoardTypeOptions = useDictionaryOptions('mesPackRuleBoardType')
  const mesPackRuleSmallPackModeOptions = useDictionaryOptions('mesPackRuleSmallPackMode')
  const mesPackRuleSortOrderOptions = useDictionaryOptions('mesPackRuleSortOrder')

  interface OpenData {
    tenantId: string
    row?: PackRule
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const editId = ref('')
  const initial = (tenantId = ''): PackRuleInput => ({
    tenantId,
    ruleCode: 'ROCK_BOARD',
    ruleName: '岩棉板排包规则',
    enabled: true,
    maxPieces: 8,
    maxStackHeight: 600,
    boardThicknessMm: null,
    maxWeight: null,
    maxLength: null,
    sameWidth: true,
    sameArea: true,
    sameNumber: true,
    allowMixLength: false,
    remainderPolicy: 'separate',
    sortPriority: 'area,boardNo,width,length',
    remark: ''
  })
  const model = reactive(initial())
  const items: FormItem[] = [
    { key: 'identity', label: '适用成品', type: 'divider', span: 24 },
    {
      key: 'ruleCode',
      label: '板材类型',
      type: 'select',
      options: mesPackRuleBoardTypeOptions
    },
    { key: 'ruleName', label: '规则名称', type: 'input', props: { maxlength: 80 } },
    { key: 'enabled', label: '启用', type: 'switch' },
    { key: 'limits', label: '单包约束', type: 'divider', span: 24 },
    { key: 'maxPieces', label: '最多块数', type: 'number', props: { min: 1, precision: 0 } },
    { key: 'maxStackHeight', label: '最高堆叠 mm', type: 'number', props: { min: 1 } },
    {
      key: 'boardThicknessMm',
      label: '板厚 mm（选填）',
      type: 'number',
      props: { min: 0.01, precision: 4 },
      help: '填写后仅匹配该板厚的生产工单；留空适配全部板厚。'
    },
    { key: 'maxWeight', label: '最大重量 kg（选填）', type: 'number', props: { min: 0 } },
    { key: 'maxLength', label: '最长板材 mm（选填）', type: 'number', props: { min: 0 } },
    { key: 'sameWidth', label: '同宽度优先', type: 'switch' },
    {
      key: 'sameArea',
      label: '同区域打包（不可跨区域）',
      type: 'switch',
      props: { disabled: true }
    },
    { key: 'sameNumber', label: '同编号打包（不可跨编号）', type: 'switch' },
    { key: 'allowMixLength', label: '允许混长', type: 'switch' },
    {
      key: 'remainderPolicy',
      label: '尾数处理',
      type: 'select',
      options: mesPackRuleSmallPackModeOptions
    },
    {
      key: 'sortPriority',
      label: '聚合顺序',
      type: 'select',
      span: 24,
      options: mesPackRuleSortOrderOptions
    },
    { key: 'remark', label: '备注', type: 'textarea', span: 24, props: { rows: 2 } }
  ]
  const formRules = {
    ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
    maxPieces: [{ required: true, message: '请输入单包上限', trigger: 'change' }],
    maxStackHeight: [{ required: true, message: '请输入堆叠上限', trigger: 'change' }]
  }

  async function handleOpen(data: OpenData): Promise<void> {
    editId.value = data.row?.id || ''
    Object.assign(model, data.row ? cloneDeep(data.row) : initial(data.tenantId))
    model.sameArea = true
    await dialogRef.value?.handleOpen(data, {
      title: editId.value ? '编辑排包规则' : '新增排包规则',
      subtitle: '同一板材类型可按板厚维护多套规则；留空板厚作为通用规则。',
      confirmText: '保存规则',
      contentMaxHeight: '70vh',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          await savePackRule(cloneDeep(model), editId.value || undefined)
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '包装规则提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
