<template>
  <ArtSectionCard
    class="work-order-details"
    title="生产单明细"
    :subtitle="`${rows.length} 行 · 延米、面积按毫米尺寸自动计算，面积可人工覆盖`"
    preserve-content-structure
  >
    <template v-if="!readonly" #actions>
      <div class="work-order-details__actions">
        <ElButton v-auth="actionPermission" type="primary" plain @click="addRow">
          <template #icon><ArtSvgIcon icon="ri:add-line" /></template>
          新增明细
        </ElButton>
        <span v-auth="actionPermission">
          <ArtExcelImport
            icon="ri:file-upload-line"
            :button-props="{ plain: true, type: 'primary' }"
            @import-success="importRows"
            @import-error="handleImportError"
            >导入明细</ArtExcelImport
          >
        </span>
        <ElButton v-auth="'MesWorkOrder:Export'" @click="exportRows(false)">
          <template #icon><ArtSvgIcon icon="ri:download-2-line" /></template>
          导出
        </ElButton>
        <ElButton @click="exportRows(true)">
          <template #icon><ArtSvgIcon icon="ri:file-download-line" /></template>
          下载模板
        </ElButton>
      </div>
    </template>
    <ArtTable
      :data="rows"
      :columns="columns"
      :row-class-name="detailRowClass"
      row-key="clientId"
      :pagination="false"
      table-layout="fixed"
      scrollbar-always-on
      :height="rows.length > 6 ? 360 : 'auto'"
      empty-text="暂无生产单明细"
      empty-description="点击新增明细，或下载模板后批量导入。"
    />
    <div v-if="rows.length" class="work-order-details__summary">
      <span
        >合计块数 <strong>{{ totalPieces }}</strong></span
      >
      <span
        >延米 <strong>{{ totalLinearMeters }}</strong> m</span
      >
      <span
        >面积 <strong>{{ totalArea }}</strong> ㎡</span
      >
    </div>
  </ArtSectionCard>
</template>

<script setup lang="tsx">
  import { ElInput, ElInputNumber, ElMessage } from 'element-plus'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtExcelImport from '@/components/core/forms/art-excel-import/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { exportExcel } from '@/utils/file'
  import type { ColumnOption } from '@/types'
  import type { MesWorkOrderDetailInput } from '@mes/api'
  import {
    calculateWorkOrderArea,
    calculateWorkOrderLinearMeters
  } from './work-order-detail-measures'

  export interface WorkOrderDetailDraft extends MesWorkOrderDetailInput {
    clientId: string
  }

  const props = defineProps<{
    readonly: boolean
    actionPermission: 'MesWorkOrder:Add' | 'MesWorkOrder:Edit'
    defaultWidthMm?: number | null
  }>()
  const rows = defineModel<WorkOrderDetailDraft[]>('rows', { required: true })
  const totalPieces = computed(() =>
    rows.value.reduce((total, row) => total + Number(row.pieces || 0), 0)
  )
  const totalLinearMeters = computed(() =>
    rows.value.reduce((total, row) => total + calculateWorkOrderLinearMeters(row), 0).toFixed(3)
  )
  const totalArea = computed(() =>
    rows.value.reduce((total, row) => total + Number(row.areaSqm || 0), 0).toFixed(4)
  )
  const detailRowClass = ({ row }: { row: WorkOrderDetailDraft }): string =>
    row.packedPieces && row.packedPieces >= row.pieces ? 'work-order-detail--packed' : ''
  const newRow = (patch: Partial<WorkOrderDetailDraft> = {}): WorkOrderDetailDraft => ({
    clientId: crypto.randomUUID(),
    area: '',
    number: '',
    lengthMm: 0,
    pieces: 1,
    widthMm: props.defaultWidthMm ?? 0,
    areaSqm: 0,
    areaOverridden: false,
    remark: '',
    sortOrder: rows.value.length * 10 + 10,
    ...patch
  })
  const recalculate = (row: WorkOrderDetailDraft) => {
    if (!row.areaOverridden) row.areaSqm = calculateWorkOrderArea(row)
  }
  watch(
    () => props.defaultWidthMm,
    (width, previousWidth) => {
      if (!width || props.readonly) return
      for (const row of rows.value) {
        if (row.widthMm !== 0 && row.widthMm !== previousWidth) continue
        row.widthMm = width
        recalculate(row)
      }
    }
  )
  const addRow = () => rows.value.push(newRow())
  const removeRow = (row: WorkOrderDetailDraft) => rows.value.splice(rows.value.indexOf(row), 1)
  const columns = computed<ColumnOption<WorkOrderDetailDraft>[]>(() => [
    { type: 'index', label: '#', width: 52 },
    {
      prop: 'area',
      label: '区域',
      width: 100,
      sortable: true,
      formatter: (row) =>
        props.readonly ? (
          row.area || '—'
        ) : (
          <ElInput v-model={row.area} maxlength={80} aria-label="区域" placeholder="如 1轴" />
        )
    },
    {
      prop: 'number',
      label: '编号',
      width: 100,
      sortable: true,
      formatter: (row) =>
        props.readonly ? (
          row.number || '—'
        ) : (
          <ElInput v-model={row.number} maxlength={80} aria-label="编号" placeholder="如 1轴-1" />
        )
    },
    {
      prop: 'lengthMm',
      label: '长度 mm',
      width: 145,
      sortable: true,
      formatter: (row) =>
        props.readonly ? (
          row.lengthMm
        ) : (
          <ElInputNumber
            v-model={row.lengthMm}
            min={0}
            precision={2}
            controls={false}
            aria-label="长度毫米"
            class="w-full!"
            onChange={() => recalculate(row)}
          />
        )
    },
    {
      prop: 'pieces',
      label: '块数',
      width: 90,
      formatter: (row) =>
        props.readonly ? (
          row.pieces
        ) : (
          <ElInputNumber
            v-model={row.pieces}
            min={1}
            precision={0}
            controls={false}
            aria-label="块数"
            class="w-full!"
            onChange={() => recalculate(row)}
          />
        )
    },
    {
      prop: 'packedPieces',
      label: '已排包',
      width: 100,
      align: 'right',
      formatter: (row) => row.packedPieces ?? 0
    },
    {
      prop: 'linearMeters',
      label: '延米 m',
      width: 105,
      align: 'right',
      formatter: (row) => calculateWorkOrderLinearMeters(row).toFixed(3)
    },
    {
      prop: 'widthMm',
      label: '宽度 mm',
      width: 120,
      sortable: true,
      formatter: (row) =>
        props.readonly ? (
          row.widthMm
        ) : (
          <ElInputNumber
            v-model={row.widthMm}
            min={0}
            precision={2}
            controls={false}
            aria-label="宽度毫米"
            class="w-full!"
            onChange={() => recalculate(row)}
          />
        )
    },
    {
      prop: 'areaSqm',
      label: '面积 ㎡',
      width: 165,
      align: 'right',
      formatter: (row) =>
        props.readonly ? (
          Number(row.areaSqm).toFixed(4)
        ) : (
          <div class="flex items-center gap-1">
            <ElInputNumber
              v-model={row.areaSqm}
              min={0}
              precision={4}
              controls={false}
              aria-label="面积平方米"
              class="w-full!"
              onChange={() => {
                row.areaOverridden = true
              }}
            />
            {row.areaOverridden ? (
              <button
                type="button"
                class="text-xs text-blue-500"
                title="恢复自动计算"
                aria-label="恢复面积自动计算"
                onClick={() => {
                  row.areaOverridden = false
                  recalculate(row)
                }}
              >
                自动
              </button>
            ) : null}
          </div>
        )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 180,
      formatter: (row) =>
        props.readonly ? (
          row.remark || '—'
        ) : (
          <ElInput v-model={row.remark} maxlength={500} aria-label="明细备注" />
        )
    },
    ...(!props.readonly
      ? [
          {
            prop: 'operation',
            label: '操作',
            width: 72,
            fixed: 'right' as const,
            formatter: (row: WorkOrderDetailDraft) => (
              <ArtButtonTable
                type="delete"
                permission={props.actionPermission}
                onClick={() => removeRow(row)}
              />
            )
          }
        ]
      : [])
  ])
  const columnsForExcel = [
    { key: 'area', title: '区域' },
    { key: 'number', title: '编号' },
    { key: 'lengthMm', title: '长度mm' },
    { key: 'pieces', title: '块数' },
    { key: 'linearMeters', title: '延米m' },
    { key: 'widthMm', title: '宽度mm' },
    { key: 'areaSqm', title: '面积㎡' },
    { key: 'remark', title: '备注' }
  ]
  const exportRows = async (template: boolean) => {
    if (!template && !rows.value.length) {
      ElMessage.info('暂无可导出的明细')
      return
    }
    const data: Array<Record<string, string | number>> = template
      ? [
          {
            area: '',
            number: '',
            lengthMm: '',
            pieces: '',
            linearMeters: '',
            widthMm: '',
            areaSqm: '',
            remark: ''
          }
        ]
      : rows.value.map((row) => ({
          area: row.area,
          number: row.number,
          lengthMm: row.lengthMm,
          pieces: row.pieces,
          linearMeters: calculateWorkOrderLinearMeters(row),
          widthMm: row.widthMm,
          areaSqm: row.areaSqm,
          remark: row.remark
        }))
    await exportExcel({
      data,
      columns: columnsForExcel,
      filename: template ? '生产单明细导入模板' : '生产单明细',
      sheetName: '生产单明细'
    })
  }
  const importRows = (data: Array<Record<string, unknown>>) => {
    try {
      const parsed = data
        .filter((row) => Object.values(row).some((value) => String(value ?? '').trim()))
        .map((row, index) => {
          const lengthMm = Number(row['长度mm'] ?? row.lengthMm)
          const widthMm = Number(row['宽度mm'] ?? row.widthMm)
          const pieces = Number(row['块数'] ?? row.pieces)
          const givenArea = row['面积㎡'] ?? row.areaSqm
          if (
            !Number.isFinite(lengthMm) ||
            lengthMm <= 0 ||
            !Number.isFinite(widthMm) ||
            widthMm <= 0 ||
            !Number.isInteger(pieces) ||
            pieces <= 0
          )
            throw new Error(`第 ${index + 2} 行的长度、宽度或块数无效`)
          const areaOverridden =
            givenArea !== undefined && givenArea !== null && String(givenArea).trim() !== ''
          const draft = newRow({
            area: String(row['区域'] ?? row.area ?? '').trim(),
            number: String(row['编号'] ?? row.number ?? '').trim(),
            lengthMm,
            widthMm,
            pieces,
            areaOverridden,
            remark: String(row['备注'] ?? row.remark ?? '').trim()
          })
          draft.areaSqm = areaOverridden ? Number(givenArea) : calculateWorkOrderArea(draft)
          if (!Number.isFinite(draft.areaSqm) || draft.areaSqm < 0)
            throw new Error(`第 ${index + 2} 行的面积无效`)
          return draft
        })
      rows.value.push(...parsed)
      ElMessage.success(`已导入 ${parsed.length} 行明细`)
    } catch (error) {
      handleImportError(error instanceof Error ? error : new Error('导入失败，请检查模板格式'))
    }
  }
  const handleImportError = (error: Error) => notifyFriendlyError(error, '导入失败，请检查模板格式')
  const validate = (): boolean => {
    const invalid = rows.value.findIndex(
      (row) =>
        !row.area.trim() ||
        !row.number.trim() ||
        row.lengthMm <= 0 ||
        row.widthMm <= 0 ||
        !Number.isInteger(row.pieces) ||
        row.pieces <= 0 ||
        row.areaSqm < 0
    )
    if (invalid < 0) return true
    ElMessage.warning(`生产单明细第 ${invalid + 1} 行需要填写区域、编号和有效尺寸`)
    return false
  }
  defineExpose({ validate })
</script>

<style scoped>
  .work-order-details {
    padding: 0;
    overflow: hidden;
  }

  .work-order-details :deep(.art-section-card__header) {
    align-items: center;
    padding: 16px 18px;
    margin: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .work-order-details__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .work-order-details__actions :deep(.el-button) {
    margin: 0;
  }

  .work-order-details__summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    justify-content: flex-end;
    padding: 12px 18px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .work-order-details__summary strong {
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
  }

  @media (width <= 760px) {
    .work-order-details :deep(.art-section-card__header) {
      align-items: stretch;
      padding: 14px;
    }

    .work-order-details__actions {
      justify-content: flex-start;
    }
  }

  :deep(.work-order-detail--packed) {
    background: var(--el-color-warning-light-9);
  }
</style>
