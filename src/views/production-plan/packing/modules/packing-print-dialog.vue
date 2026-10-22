<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div v-if="dialog.input" class="grid min-w-0 gap-4">
      <ElAlert
        :title="
          dialog.input.mode === 'label'
            ? '自定义标签纸宽度不超过 105 mm，高度按实际标签填写。内容自动缩放适配；打印机驱动请选择相同纸张尺寸。'
            : '打印所选整包的全部板材明细，使用 A4 纵向纸张。'
        "
        type="info"
        :closable="false"
        show-icon
      />
      <div class="packing-print-preview" :class="{ 'is-label': dialog.input.mode === 'label' }">
        <ArtForm
          ref="formRef"
          v-if="dialog.input.mode === 'label'"
          :model-value="form.data"
          :items="form.items"
          :rules="form.rules"
          :span="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
          @update:model-value="replaceReactiveModel(form.data, $event)"
        >
          <template #paperWidthMm>
            <ElInputNumber
              v-model="form.data.paperWidthMm"
              :min="1"
              :max="105"
              :precision="1"
              :step="1"
              controls-position="right"
              aria-label="标签纸宽度 mm"
              class="w-full!"
            />
          </template>
          <template #paperHeightMm>
            <ElInputNumber
              v-model="form.data.paperHeightMm"
              :min="1"
              :precision="1"
              :step="1"
              controls-position="right"
              aria-label="标签纸高度 mm"
              class="w-full!"
            />
          </template>
          <template #standard>
            <ElInput
              v-model="form.data.standard"
              maxlength="80"
              placeholder="按产品实际执行标准填写"
            />
          </template>
          <template #boardType><ElInput v-model="form.data.boardType" maxlength="80" /></template>
          <template #color><ElInput v-model="form.data.color" maxlength="80" /></template>
          <template #inspectorId>
            <ArtEmployeeSelect
              :model-value="form.data.inspectorId || undefined"
              :tenant-id="dialog.input.order.tenantId"
              placeholder="选择质检员，或留空手签"
              @change="selectInspector"
            />
          </template>
          <template #productionDate>
            <ElDatePicker
              v-model="form.data.productionDate"
              type="date"
              value-format="YYYY-MM-DD"
              class="w-full!"
            />
          </template>
        </ArtForm>
        <PackingPrintContent
          :mode="dialog.input.mode"
          :order="dialog.input.order"
          :labels="dialog.labels"
          :options="form.data"
        />
      </div>
    </div>
  </ArtDialog>
  <Teleport to="body">
    <div v-if="dialog.printing && dialog.input" class="packing-print-batch" aria-hidden="true">
      <PackingPrintContent
        ref="printContentRef"
        print-layout
        :mode="dialog.input.mode"
        :order="dialog.input.order"
        :labels="dialog.labels"
        :options="form.data"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { cloneDeep } from 'lodash-es'
  import { useStyleTag } from '@vueuse/core'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { replaceReactiveModel } from '@/utils/form/model'
  import { usePrintSheet } from '@/hooks/core/usePrintSheet'
  import { useAuth } from '@/hooks/core/useAuth'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import PackingPrintContent from './packing-print-content.vue'
  import {
    buildPackingPrintLabels,
    packingLabelPageCss,
    type PackingPrintInput,
    type PackingPrintLabel,
    type PackingPrintOptions
  } from './packing-print'

  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const printContentRef = ref<InstanceType<typeof PackingPrintContent>>()
  const printStyle = useStyleTag('', { immediate: false })
  const { hasAuth } = useAuth()
  const dialog = reactive<{
    input: PackingPrintInput | null
    labels: PackingPrintLabel[]
    printing: boolean
  }>({ input: null, labels: [], printing: false })
  const form = reactive<{
    data: PackingPrintOptions & { inspectorId: string }
    items: FormItem[]
    rules: FormRules
  }>({
    data: {
      paperWidthMm: 100,
      paperHeightMm: 150,
      standard: '',
      boardType: '',
      color: '',
      inspector: '',
      inspectorId: '',
      productionDate: ''
    },
    items: [
      { key: 'paperWidthMm', label: '纸张宽度 mm（最大 105）', type: 'slot', span: 12 },
      { key: 'paperHeightMm', label: '纸张高度 mm', type: 'slot', span: 12 },
      {
        key: 'standard',
        label: '执行标准',
        type: 'slot'
      },
      { key: 'boardType', label: '板型', type: 'slot' },
      { key: 'color', label: '颜色', type: 'slot' },
      { key: 'inspectorId', label: '质检员', type: 'slot' },
      {
        key: 'productionDate',
        label: '生产日期',
        type: 'slot'
      }
    ],
    rules: {
      paperWidthMm: [
        {
          required: true,
          type: 'number',
          min: 1,
          max: 105,
          message: '标签纸宽度须为 1–105 mm',
          trigger: 'change'
        }
      ],
      paperHeightMm: [
        {
          required: true,
          type: 'number',
          min: 1,
          message: '请填写大于或等于 1 mm 的高度',
          trigger: 'change'
        }
      ]
    }
  })
  function selectInspector(
    value: string | string[] | undefined,
    rows: EmployeeIntegrationItem[]
  ): void {
    Object.assign(form.data, {
      inspectorId: typeof value === 'string' ? value : '',
      inspector: rows[0]?.employeeName || ''
    })
  }
  const { print } = usePrintSheet('is-packing-printing', () => {
    dialog.printing = false
    printStyle.unload()
  })

  async function handleOpen(input: PackingPrintInput): Promise<void> {
    if (!hasAuth('MesPacking:Print')) return
    try {
      const snapshot = cloneDeep(input)
      Object.assign(dialog, {
        input: snapshot,
        labels: buildPackingPrintLabels(snapshot),
        printing: false
      })
      Object.assign(form.data, {
        standard: '',
        boardType: input.order.specificationSnapshot,
        color: '',
        inspector: '',
        inspectorId: '',
        productionDate: ''
      })
      await dialogRef.value?.handleOpen(undefined, {
        title: input.mode === 'label' ? '标签打印预览' : '排包单打印预览',
        subtitle: `${input.order.workOrderNo} · 已选 ${input.selectedPacks.length} 包`,
        confirmText: '打印',
        cancelText: '关闭',
        onConfirm: async () => {
          if (!hasAuth('MesPacking:Print') || dialog.printing) return false
          if (dialog.input?.mode === 'label') {
            try {
              await formRef.value?.validate()
            } catch {
              return false
            }
          }
          try {
            if (dialog.input?.mode === 'label') {
              printStyle.css.value = packingLabelPageCss(form.data)
              printStyle.load()
            }
            dialog.printing = true
            await nextTick()
            await document.fonts.ready
            printContentRef.value?.fitLabels()
            await print()
          } catch (error) {
            dialog.printing = false
            printStyle.unload()
            notifyFriendlyError(error, '打印失败，请重试')
          }
          return false
        }
      })
    } catch (error) {
      notifyFriendlyError(error, '打印预览生成失败，请刷新后重试')
    }
  }
  async function handleClose(): Promise<void> {
    await dialogRef.value?.handleClose()
  }
  defineExpose({ handleOpen, handleClose })
</script>

<style scoped lang="scss">
  .packing-print-preview {
    min-width: 0;

    &.is-label {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(280px, 380px);
      gap: var(--art-space-5);
      align-items: start;
    }

    > * {
      min-width: 0;
    }

    @media (width <= 760px) {
      &.is-label {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
