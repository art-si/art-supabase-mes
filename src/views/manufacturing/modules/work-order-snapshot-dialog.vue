<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <div class="work-order-snapshot">
      <ArtEntitySummary
        class="work-order-snapshot__context"
        :icon="mode === 'bom' ? 'ri:organization-chart' : 'ri:git-branch-line'"
        eyebrow="WORK ORDER SNAPSHOT"
        :title="record?.workOrderNo || '生产工单'"
        :description="summaryDescription"
      >
        <template #aside>
          <dl class="work-order-snapshot__facts" aria-label="生产资料快照概览">
            <div>
              <dt>{{ mode === 'bom' ? '组件数量' : '工序数量' }}</dt>
              <dd>{{ mode === 'bom' ? bomItems.length : routeSteps.length }}</dd>
            </div>
            <div>
              <dt>快照版本</dt>
              <dd>{{
                mode === 'bom' ? bom?.version || '—' : record?.routeSnapshot?.version || '—'
              }}</dd>
            </div>
            <div>
              <dt>要求周期</dt>
              <dd>{{ record?.plannedStartDate || '—' }} → {{ record?.plannedEndDate || '—' }}</dd>
            </div>
          </dl>
        </template>
      </ArtEntitySummary>

      <ArtSectionCard
        v-if="mode === 'bom'"
        title="BOM 组件"
        :subtitle="bomSubtitle"
        :empty="bomItems.length === 0"
        empty-title="当前工单没有 BOM 组件"
        empty-description="请先维护该物料 BOM，再点击“重读 BOM/工艺”更新工单快照。"
      >
        <template v-if="canEdit" #actions>
          <ElButton v-auth="'MesWorkOrder:Edit'" type="primary" plain @click="openEditor('item')">
            <template #icon><ArtSvgIcon icon="ri:add-line" /></template>
            新增组件
          </ElButton>
        </template>
        <ArtTable
          v-if="bomItems.length"
          :data="bomItems"
          :columns="bomColumns"
          row-key="id"
          table-layout="fixed"
          :pagination="false"
          scrollbar-always-on
        />
      </ArtSectionCard>

      <ArtSectionCard
        v-else
        title="工艺路线"
        :subtitle="routeSubtitle"
        :empty="routeSteps.length === 0"
        empty-title="当前工单没有工艺路线"
        empty-description="请先维护该物料工艺路线，再点击“重读 BOM/工艺”更新工单快照。"
      >
        <template v-if="canEdit" #actions>
          <ElButton v-auth="'MesWorkOrder:Edit'" @click="openEditor('header')">
            <template #icon><ArtSvgIcon icon="ri:edit-line" /></template>
            编辑路线信息
          </ElButton>
          <ElButton v-auth="'MesWorkOrder:Edit'" type="primary" plain @click="openEditor('item')">
            <template #icon><ArtSvgIcon icon="ri:add-line" /></template>
            新增工序
          </ElButton>
        </template>
        <ArtTable
          v-if="routeSteps.length"
          :data="routeSteps"
          :columns="routeColumns"
          row-key="id"
          table-layout="fixed"
          :pagination="false"
          scrollbar-always-on
        />
      </ArtSectionCard>
    </div>
  </ArtDialog>
  <WorkOrderSnapshotEditor ref="editorRef" @success="handleEditorSuccess" />
</template>

<script setup lang="tsx">
  import { ElButton, ElTag } from 'element-plus'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { formatNumberValue } from '@/utils/ui'
  import type { ColumnOption } from '@/types'
  import type {
    MesWorkOrder,
    MesWorkOrderBomItemSnapshot,
    MesWorkOrderRouteStepSnapshot,
    MesWorkOrderSnapshotReferences
  } from '@mes/api'
  import {
    fetchWorkOrderComponentTypes,
    fetchWorkOrderSnapshotReferences,
    saveWorkOrderSnapshot
  } from '@mes/api'
  import { calculateOperationQuantity } from './work-order-plan'
  import WorkOrderSnapshotEditor, {
    type WorkOrderSnapshotEditorOpenData
  } from './work-order-snapshot-editor.vue'

  export type WorkOrderSnapshotMode = 'bom' | 'route'
  export interface WorkOrderSnapshotDialogOpenData {
    row: MesWorkOrder
    mode: WorkOrderSnapshotMode
    canEdit: boolean
  }

  interface WorkOrderBomDisplayItem extends MesWorkOrderBomItemSnapshot {
    assignedOperationSequenceNo: number | null
    assignedOperationSequenceType: string
  }

  interface WorkOrderRouteDisplayStep extends MesWorkOrderRouteStepSnapshot {
    operationQuantity: number
    requiredStartDate: string
    requiredCompletionDate: string
  }

  const dialogRef = ref<ArtDialogExpose<WorkOrderSnapshotDialogOpenData>>()
  const emit = defineEmits<{ success: [row: MesWorkOrder] }>()
  const editorRef = ref<{ handleOpen: (data: WorkOrderSnapshotEditorOpenData) => Promise<void> }>()
  const userStore = useUserStore()
  const { confirmDelete } = useArtFeedback()
  const record = shallowRef<MesWorkOrder>()
  const mode = ref<WorkOrderSnapshotMode>('bom')
  const canEdit = ref(false)
  const references = shallowRef<MesWorkOrderSnapshotReferences>({
    componentTypes: [],
    materials: [],
    units: [],
    warehouses: [],
    departments: [],
    workCenters: []
  })
  const bom = computed(() => record.value?.bomSnapshot?.[0])
  const routeSteps = computed<WorkOrderRouteDisplayStep[]>(() =>
    (record.value?.routeSnapshot?.steps ?? []).map((step) => ({
      ...step,
      operationQuantity: calculateOperationQuantity(
        record.value?.orderQuantity ?? 0,
        step.basicBatch
      ),
      requiredStartDate: record.value?.plannedStartDate || '',
      requiredCompletionDate: record.value?.plannedEndDate || ''
    }))
  )
  const routeStepById = computed(
    () => new Map(routeSteps.value.map((routeStep) => [routeStep.id, routeStep]))
  )
  const bomItems = computed<WorkOrderBomDisplayItem[]>(() =>
    (bom.value?.items ?? []).map((item) => {
      const assignedRouteStep = item.assignedRouteStepId
        ? routeStepById.value.get(item.assignedRouteStepId)
        : undefined

      return {
        ...item,
        assignedOperationSequenceNo: assignedRouteStep?.sequenceNo ?? null,
        assignedOperationSequenceType: assignedRouteStep?.sequenceType ?? ''
      }
    })
  )
  const summaryDescription = computed(() =>
    mode.value === 'bom'
      ? '展示工单保存时集成的装配层 BOM；虚拟件自动穿透到下一层，未配置组件工序时默认分配到第一道工序。'
      : '展示工单保存时集成的完整工艺路线与工序参数；生产工序任务只会在工单确认后生成。'
  )
  const bomSubtitle = computed(() =>
    bom.value
      ? `${bom.value.bomCode || '未编号'} · 版本 ${bom.value.version || '—'} · ${bomItems.value.length} 个组件`
      : '尚未集成 BOM'
  )
  const routeSubtitle = computed(() => {
    const route = record.value?.routeSnapshot
    return route?.id
      ? `${route.name || route.code || '未命名路线'} · ${routeSteps.value.length} 道工序`
      : '尚未集成工艺路线'
  })

  const bomColumns: ColumnOption<WorkOrderBomDisplayItem>[] = [
    { type: 'index', label: '序号', width: 70 },
    { prop: 'componentMaterialCode', label: '组件编码', minWidth: 150 },
    {
      prop: 'componentTypeId',
      label: '组件类型',
      minWidth: 130,
      formatter: (row) =>
        references.value.componentTypes.find((entry) => entry.id === row.componentTypeId)?.name ||
        '—'
    },
    {
      prop: 'componentMaterialName',
      label: '组件名称',
      minWidth: 200,
      formatter: (row) => (
        <span class="work-order-snapshot__assignment">
          <span>{row.componentMaterialName}</span>
          {row.virtualUnexpanded && (
            <ElTag size="small" type="warning" effect="plain">
              虚拟件未展开
            </ElTag>
          )}
        </span>
      )
    },
    { prop: 'componentSpecification', label: '规格型号', minWidth: 130 },
    { prop: 'basicQuantity', label: '基本数量（单台）', width: 150, align: 'right' },
    { prop: 'requiredQuantity', label: '需求数量', width: 120, align: 'right' },
    { prop: 'unitName', label: '单位', width: 90 },
    {
      prop: 'sourcePath',
      label: '展开路径',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => row.sourcePath?.join(' → ') || row.componentMaterialCode
    },
    { prop: 'positionNo', label: '位号', minWidth: 100 },
    { prop: 'sequenceNo', label: '组件序号', width: 100, align: 'right' },
    {
      prop: 'scrapRate',
      label: '损耗率 %',
      width: 100,
      align: 'right',
      formatter: (row) => row.scrapRate ?? 0
    },
    {
      prop: 'mrpEnabled',
      label: 'MRP 运算',
      width: 100,
      formatter: (row) => (row.mrpEnabled === false ? '否' : '是')
    },
    {
      prop: 'defaultIssueWarehouseId',
      label: '默认发料仓库',
      minWidth: 150,
      formatter: (row) =>
        references.value.warehouses.find((entry) => entry.id === row.defaultIssueWarehouseId)
          ?.name || '—'
    },
    {
      prop: 'issueMethod',
      label: '领送料方式',
      width: 120,
      formatter: (row) =>
        row.issueMethod ? (
          <ArtDictDisplay
            dictCode="mdmMaterialIssueMethod"
            value={row.issueMethod}
            display="text"
          />
        ) : (
          '—'
        )
    },
    {
      prop: 'backflushMethod',
      label: '倒冲方式',
      width: 120,
      formatter: (row) =>
        row.backflushMethod ? (
          <ArtDictDisplay
            dictCode="mdmMaterialBackflushMethod"
            value={row.backflushMethod}
            display="text"
          />
        ) : (
          '—'
        )
    },
    { prop: 'overIssueControlMethod', label: '超发控制方式', width: 140 },
    { prop: 'projectText', label: '项目文本', minWidth: 140, showOverflowTooltip: true },
    { prop: 'operationName', label: '工序名称', minWidth: 130 },
    { prop: 'effectiveFrom', label: '生效日期', width: 120 },
    { prop: 'effectiveTo', label: '失效日期', width: 120 },
    { prop: 'remark', label: '备注', minWidth: 160, showOverflowTooltip: true },
    {
      prop: 'assignedOperationSequenceNo',
      label: '工序序列',
      width: 100,
      align: 'right',
      formatter: (row) => row.assignedOperationSequenceNo ?? '—'
    },
    {
      prop: 'assignedOperationSequenceType',
      label: '序列类型',
      width: 110,
      formatter: (row) =>
        row.assignedOperationSequenceType ? (
          <ArtDictDisplay
            dictCode="mdmProcessRouteSequenceType"
            value={row.assignedOperationSequenceType}
            display="text"
          />
        ) : (
          '—'
        )
    },
    {
      prop: 'assignedOperationName',
      label: '分配工序',
      minWidth: 180,
      formatter: (row) => (
        <span class="work-order-snapshot__assignment">
          <span>{row.assignedOperationName || '未分配'}</span>
          {row.assignmentSource === 'first_operation' && (
            <ElTag size="small" type="info" effect="plain">
              默认首工序
            </ElTag>
          )}
        </span>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) =>
        canEdit.value ? (
          <>
            <ArtButtonTable
              permission="MesWorkOrder:Edit"
              type="edit"
              label="编辑组件"
              onClick={() => openEditor('item', row)}
            />
            <ArtButtonTable
              permission="MesWorkOrder:Edit"
              type="delete"
              label="删除组件"
              onClick={() => void deleteItem(row.id)}
            />
          </>
        ) : (
          '—'
        )
    }
  ]
  const routeColumns: ColumnOption<WorkOrderRouteDisplayStep>[] = [
    { type: 'index', label: '顺序', width: 70 },
    { prop: 'sequenceNo', label: '工序序列', width: 96, align: 'right' },
    {
      prop: 'sequenceType',
      label: '序列类型',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="mdmProcessRouteSequenceType"
          value={row.sequenceType}
          display="text"
        />
      )
    },
    { prop: 'code', label: '工序号', minWidth: 110 },
    { prop: 'name', label: '工序名称', minWidth: 180 },
    {
      prop: 'operationCode',
      label: '工序编码',
      minWidth: 130,
      formatter: (row) => row.operationCode || '自定义'
    },
    { prop: 'basicBatch', label: '基本批量', width: 100, align: 'right' },
    {
      prop: 'operationQuantity',
      label: '工序数量',
      width: 110,
      align: 'right',
      formatter: (row) => formatNumberValue(row.operationQuantity)
    },
    { prop: 'requiredStartDate', label: '工序要求开工时间', width: 150 },
    { prop: 'requiredCompletionDate', label: '工序要求完工时间', width: 150 },
    { prop: 'departmentName', label: '生产车间', minWidth: 130 },
    {
      prop: 'workCenterNames',
      label: '工作中心',
      minWidth: 180,
      formatter: (row) => row.workCenterNames?.join('、') || '全部工作中心'
    },
    { prop: 'runOutputQuantity', label: '单趟产出', width: 110, align: 'right' },
    { prop: 'runProcessingMinutes', label: '单趟加工(分)', width: 126, align: 'right' },
    {
      prop: 'runGreenMinutes',
      label: '单趟绿灯(分)',
      width: 126,
      align: 'right',
      formatter: (row) => row.runGreenMinutes ?? 0
    },
    { prop: 'setupMinutes', label: '调机时长(分)', width: 118, align: 'right' },
    { prop: 'queueMinutes', label: '排队时长(分)', width: 118, align: 'right' },
    { prop: 'transferMinutes', label: '转移时长(分)', width: 118, align: 'right' },
    {
      prop: 'minimumTransferQuantity',
      label: '最小转移批量',
      width: 126,
      align: 'right'
    },
    {
      prop: 'overlapEnabled',
      label: '允许重叠',
      width: 96,
      align: 'center',
      formatter: (row) => (row.overlapEnabled ? '是' : '否')
    },
    {
      prop: 'humanMachineRatio',
      label: '人机系数',
      width: 96,
      formatter: (row) => `${row.operatorCount}:${row.machineCount}`
    },
    { prop: 'unitName', label: '工序单位', width: 100 },
    {
      prop: 'controlCodeName',
      label: '工序控制码',
      minWidth: 150,
      formatter: (row) =>
        row.controlCode || row.controlCodeName ? (
          <BusinessTableIdentityCell primary={row.controlCodeName} secondary={row.controlCode} />
        ) : (
          '—'
        )
    },
    {
      prop: 'operationMode',
      label: '工序模式',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="mdmProcessOperationMode"
          value={row.operationMode}
          display="text"
        />
      )
    },
    {
      prop: 'processingMode',
      label: '加工方式',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay dictCode="mdmProcessingMode" value={row.processingMode} display="text" />
      )
    },
    {
      prop: 'reportMode',
      label: '汇报方式',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay dictCode="mdmReportMode" value={row.reportMode} display="text" />
      )
    },
    {
      prop: 'inspectionMode',
      label: '检验方式',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay dictCode="mdmInspectionMode" value={row.inspectionMode} display="text" />
      )
    },
    {
      prop: 'sequenceControl',
      label: '序列控制',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay dictCode="mdmSequenceControl" value={row.sequenceControl} display="text" />
      )
    },
    {
      prop: 'reworkMode',
      label: '返工方式',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay dictCode="mdmReworkMode" value={row.reworkMode} display="text" />
      )
    },
    {
      prop: 'needInspection',
      label: '工序质检',
      width: 92,
      align: 'center',
      formatter: (row) => (row.needInspection ? '是' : '否')
    },
    {
      prop: 'firstInspection',
      label: '首检',
      width: 72,
      align: 'center',
      formatter: (row) => (row.firstInspection ? '是' : '否')
    },
    {
      prop: 'firstInspectionControl',
      label: '首检控制方式',
      width: 130,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="mdmProcessSequenceControlMode"
          value={row.firstInspectionControl}
          display="text"
        />
      )
    },
    {
      prop: 'isFirst',
      label: '首序',
      width: 72,
      align: 'center',
      formatter: (row) => (row.isFirst ? '是' : '否')
    },
    {
      prop: 'isLast',
      label: '末序',
      width: 72,
      align: 'center',
      formatter: (row) => (row.isLast ? '是' : '否')
    },
    {
      prop: 'critical',
      label: '关键',
      width: 80,
      align: 'center',
      formatter: (row) => (row.critical ? '是' : '否')
    },
    { prop: 'description', label: '工序说明', minWidth: 220, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) =>
        canEdit.value ? (
          <>
            <ArtButtonTable
              permission="MesWorkOrder:Edit"
              type="edit"
              label="编辑工序"
              onClick={() => openEditor('item', row)}
            />
            <ArtButtonTable
              permission="MesWorkOrder:Edit"
              type="delete"
              label="删除工序"
              onClick={() => void deleteItem(row.id)}
            />
          </>
        ) : (
          '—'
        )
    }
  ]

  async function openEditor(
    target: 'item' | 'header',
    item?: MesWorkOrderBomItemSnapshot | MesWorkOrderRouteStepSnapshot
  ): Promise<void> {
    if (!record.value || !canEdit.value) return
    await editorRef.value?.handleOpen({
      row: record.value,
      mode: mode.value,
      target,
      item,
      references: references.value
    })
  }

  function handleEditorSuccess(updated: MesWorkOrder): void {
    record.value = updated
    emit('success', updated)
  }

  async function deleteItem(id: string): Promise<void> {
    if (!record.value || !canEdit.value) return
    try {
      await confirmDelete(
        mode.value === 'bom'
          ? '确定删除当前工单的这条 BOM 组件吗？'
          : '确定删除当前工单的这道工序吗？',
        { title: '删除生产资料' }
      )
      let updated: MesWorkOrder | undefined
      if (mode.value === 'bom') {
        const snapshots = structuredClone(record.value.bomSnapshot ?? [])
        if (!snapshots[0]) return
        snapshots[0].items = snapshots[0].items.filter((item) => item.id !== id)
        updated = await saveWorkOrderSnapshot(record.value.id, 'bom', snapshots)
      } else {
        const route = structuredClone(record.value.routeSnapshot ?? {})
        route.steps = (route.steps ?? []).filter((step) => step.id !== id)
        updated = await saveWorkOrderSnapshot(record.value.id, 'route', route)
      }
      if (updated) handleEditorSuccess(updated)
    } catch {
      // 取消删除或接口反馈已由组件处理。
    }
  }

  async function handleOpen(data: WorkOrderSnapshotDialogOpenData): Promise<void> {
    record.value = data.row
    mode.value = data.mode
    canEdit.value = data.canEdit
    await dialogRef.value?.handleOpen(data, {
      title: data.mode === 'bom' ? '工单 BOM' : '工单工艺路线',
      subtitle: data.row.materialNameSnapshot,
      showFooter: false,
      contentMaxHeight: '72vh',
      loading: true,
      loadingText: '正在加载工单快照…',
      onOpen: async (_openData, api) => {
        try {
          const [snapshotReferences, componentTypes] = await Promise.all([
            data.canEdit
              ? fetchWorkOrderSnapshotReferences(data.row.tenantId)
              : Promise.resolve({
                  componentTypes: [],
                  materials: [],
                  units: [],
                  warehouses: [],
                  departments: [],
                  workCenters: []
                }),
            data.mode === 'bom'
              ? fetchWorkOrderComponentTypes(data.row.tenantId)
              : Promise.resolve([])
          ])
          references.value = { ...snapshotReferences, componentTypes }
          const dictionaryCodes =
            data.mode === 'route'
              ? [
                  'mdmProcessRouteSequenceType',
                  'mdmProcessOperationMode',
                  'mdmProcessingMode',
                  'mdmReportMode',
                  'mdmInspectionMode',
                  'mdmSequenceControl',
                  'mdmReworkMode',
                  'mdmProcessSequenceControlMode'
                ]
              : [
                  'mdmProcessRouteSequenceType',
                  'mdmMaterialIssueMethod',
                  'mdmMaterialBackflushMethod'
                ]
          await Promise.all(dictionaryCodes.map((code) => userStore.ensureDictLoaded(code)))
        } finally {
          api.setLoading(false)
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .work-order-snapshot {
    display: grid;
    gap: 18px;
    min-width: 0;

    &__context {
      min-width: 0;
    }

    &__facts {
      display: grid;
      grid-template-columns: repeat(3, auto);
      gap: 20px;
      margin: 0;

      div {
        display: grid;
        gap: 2px;
      }

      dt,
      dd {
        margin: 0;
      }

      dt {
        font-size: 12px;
        color: var(--art-gray-600);
      }

      dd {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--art-gray-900);
      }
    }

    :deep(.work-order-snapshot__assignment) {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
  }

  @media (width <= 960px) {
    .work-order-snapshot {
      &__facts {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }
  }
</style>
