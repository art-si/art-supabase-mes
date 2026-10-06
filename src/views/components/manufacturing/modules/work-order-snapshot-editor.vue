<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <div class="snapshot-editor">
      <ArtEntitySummary
        icon="ri:edit-box-line"
        eyebrow="WORK ORDER ONLY"
        :title="row?.workOrderNo || '生产工单'"
        description="修改仅写入当前工单的生产资料快照；工单下达后不可继续修改。"
      />
      <ArtForm
        ref="formRef"
        :model-value="model"
        @update:model-value="replaceReactiveModel(model, $event)"
        :items="items"
        :rules="rules"
        :span="12"
        :gutter="20"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { ElMessage } from 'element-plus'
  import { cloneDeep } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveWorkOrderSnapshot,
    type MesWorkOrder,
    type MesWorkOrderBomItemSnapshot,
    type MesWorkOrderBomSnapshot,
    type MesWorkOrderRouteSnapshot,
    type MesWorkOrderRouteStepSnapshot,
    type MesWorkOrderSnapshotReferences
  } from '@mes/api'

  export interface WorkOrderSnapshotEditorOpenData {
    row: MesWorkOrder
    mode: 'bom' | 'route'
    target: 'item' | 'header'
    item?: MesWorkOrderBomItemSnapshot | MesWorkOrderRouteStepSnapshot
    references: MesWorkOrderSnapshotReferences
  }

  const emit = defineEmits<{ success: [row: MesWorkOrder] }>()
  const dialogRef = ref<ArtDialogExpose<WorkOrderSnapshotEditorOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const row = shallowRef<MesWorkOrder>()
  const mode = ref<'bom' | 'route'>('bom')
  const target = ref<'item' | 'header'>('item')
  const itemId = ref<string>()
  const references = shallowRef<MesWorkOrderSnapshotReferences>({
    componentTypes: [],
    materials: [],
    units: [],
    warehouses: [],
    departments: [],
    workCenters: []
  })
  const model = reactive<Record<string, unknown>>({})
  const option = (rows: Array<{ id: string; name: string; code?: string }>) =>
    rows.map((entry) => ({
      value: entry.id,
      label: entry.code ? `${entry.code} · ${entry.name}` : entry.name,
      disabled: 'disabled' in entry && entry.disabled === true
    }))
  const optionalSelect = (
    key: string,
    label: string,
    values: Array<{ id: string; name: string; code?: string }>
  ): FormItem => ({
    key,
    label,
    type: 'select',
    options: option(values),
    props: { filterable: true, clearable: true }
  })
  const dictionarySelect = (key: string, label: string, dictCode: string): FormItem => ({
    key,
    label,
    type: 'select',
    options: getDictMap.value[dictCode] ?? [],
    props: { filterable: true, clearable: true }
  })
  const numberItem = (key: string, label: string, min = 0, precision = 6): FormItem => ({
    key,
    label,
    type: 'number',
    props: { min, precision, class: '!w-full' }
  })
  const divider = (label: string): FormItem => ({
    key: `divider-${label}`,
    label,
    type: 'divider',
    span: 24
  })
  const jsonItem = (key: string, label: string): FormItem => ({
    key: `${key}Json`,
    label,
    type: 'textarea',
    span: 24,
    help: 'JSON 格式，保留工艺维护中的完整配置结构。',
    props: { rows: 4 }
  })

  const items = computed<FormItem[]>(() => {
    if (target.value === 'header') {
      return [
        { key: 'code', label: '路线编码', props: { maxlength: 60 } },
        { key: 'name', label: '路线名称', props: { maxlength: 120 } },
        { key: 'version', label: '工艺版本', props: { maxlength: 40 } },
        { key: 'routeType', label: '路线类型' },
        { key: 'allocationMode', label: '分配模式' },
        optionalSelect('departmentId', '生产车间', references.value.departments),
        optionalSelect('productionUnitId', '生产单位', references.value.units),
        numberItem('batchFrom', '起始批量'),
        numberItem('batchTo', '截止批量'),
        {
          key: 'effectiveDate',
          label: '生效日期',
          type: 'date',
          props: { valueFormat: 'YYYY-MM-DD' }
        },
        {
          key: 'expiryDate',
          label: '失效日期',
          type: 'date',
          props: { valueFormat: 'YYYY-MM-DD' }
        },
        { key: 'isDefault', label: '默认路线', type: 'switch' },
        { key: 'remark', label: '路线备注', type: 'textarea', span: 24, props: { rows: 3 } }
      ]
    }
    if (mode.value === 'bom') {
      return [
        divider('组件信息'),
        optionalSelect('componentMaterialId', '组件物料', references.value.materials),
        optionalSelect('componentTypeId', '组件类型', references.value.componentTypes),
        numberItem('sequenceNo', '组件序号', 1, 0),
        numberItem('basicQuantity', '基本数量（单台）', 0.000001),
        optionalSelect('unitId', '计量单位', references.value.units),
        numberItem('scrapRate', '损耗率 %', 0, 2),
        { key: 'mrpEnabled', label: '参与 MRP 运算', type: 'switch' },
        optionalSelect('defaultIssueWarehouseId', '默认发料仓库', references.value.warehouses),
        dictionarySelect('issueMethod', '领送料方式', 'mdmMaterialIssueMethod'),
        dictionarySelect('backflushMethod', '倒冲方式', 'mdmMaterialBackflushMethod'),
        dictionarySelect('overIssueControlMethod', '超发控制方式', 'mdmMaterialOverIssueControl'),
        { key: 'positionNo', label: '位号', props: { maxlength: 100 } },
        { key: 'projectText', label: '项目文本', props: { maxlength: 200 } },
        optionalSelect(
          'assignedRouteStepId',
          '分配工序',
          (row.value?.routeSnapshot?.steps ?? []).map((step) => ({
            id: step.id,
            code: step.code,
            name: step.name
          }))
        ),
        optionalSelect(
          'processRouteStepId',
          '来源工序',
          (row.value?.routeSnapshot?.steps ?? []).map((step) => ({
            id: step.id,
            code: step.code,
            name: step.name
          }))
        ),
        { key: 'operationName', label: '工序名称', props: { maxlength: 120 } },
        {
          key: 'effectiveFrom',
          label: '生效日期',
          type: 'date',
          props: { valueFormat: 'YYYY-MM-DD' }
        },
        {
          key: 'effectiveTo',
          label: '失效日期',
          type: 'date',
          props: { valueFormat: 'YYYY-MM-DD' }
        },
        { key: 'remark', label: '备注', type: 'textarea', span: 24, props: { rows: 3 } }
      ]
    }
    return [
      divider('工序与序列'),
      numberItem('sequenceNo', '工序序列', 1, 0),
      dictionarySelect('sequenceType', '序列类型', 'mdmProcessRouteSequenceType'),
      { key: 'code', label: '工序号', props: { maxlength: 40 } },
      { key: 'name', label: '工序名称', props: { maxlength: 120 } },
      { key: 'operationCode', label: '工序编码', props: { maxlength: 80 } },
      optionalSelect('departmentId', '生产车间', references.value.departments),
      optionalSelect('workCenterId', '主工作中心', references.value.workCenters),
      {
        key: 'workCenterIds',
        label: '可用工作中心',
        type: 'select',
        options: option(references.value.workCenters),
        props: { multiple: true, filterable: true, clearable: true }
      },
      optionalSelect('unitId', '工序单位', references.value.units),
      { key: 'description', label: '工序说明', type: 'textarea', span: 24, props: { rows: 2 } },
      divider('产能与时间'),
      numberItem('basicBatch', '基本批量', 0.000001),
      numberItem('runOutputQuantity', '单趟产出数量', 0.000001),
      numberItem('runProcessingMinutes', '单趟加工时长（分钟）'),
      numberItem('runGreenMinutes', '单趟绿灯时长（分钟）'),
      numberItem('setupMinutes', '调机时长（分钟）'),
      numberItem('queueMinutes', '排队时长（分钟）'),
      numberItem('transferMinutes', '转运时长（分钟）'),
      numberItem('minimumTransferQuantity', '最小转移批量'),
      numberItem('operatorCount', '操作人数', 0, 0),
      numberItem('machineCount', '设备数量', 0, 0),
      { key: 'overlapEnabled', label: '允许重叠加工', type: 'switch' },
      divider('执行、质检与控制'),
      dictionarySelect('operationMode', '工序模式', 'mdmProcessOperationMode'),
      dictionarySelect('processingMode', '加工方式', 'mdmProcessingMode'),
      dictionarySelect('reportMode', '汇报方式', 'mdmReportMode'),
      dictionarySelect('inspectionMode', '检验方式', 'mdmInspectionMode'),
      dictionarySelect('sequenceControl', '序列控制', 'mdmSequenceControl'),
      dictionarySelect('reworkMode', '返工方式', 'mdmReworkMode'),
      { key: 'controlCode', label: '工序控制码' },
      dictionarySelect('firstInspectionControl', '首检控制方式', 'mdmProcessSequenceControlMode'),
      { key: 'needInspection', label: '工序质检', type: 'switch' },
      { key: 'firstInspection', label: '首检', type: 'switch' },
      { key: 'isFirst', label: '首序', type: 'switch' },
      { key: 'isLast', label: '末序', type: 'switch' },
      { key: 'critical', label: '关键工序', type: 'switch' },
      divider('工艺扩展参数'),
      jsonItem('unitConversion', '单位换算'),
      jsonItem('activities', '作业活动'),
      jsonItem('outsourcing', '委外参数'),
      jsonItem('inspection', '检验参数'),
      jsonItem('sopDocuments', 'SOP 文档')
    ]
  })
  const rules = computed(() =>
    target.value === 'header'
      ? { name: [{ required: true, message: '请输入路线名称', trigger: 'blur' }] }
      : mode.value === 'bom'
        ? {
            componentMaterialId: [{ required: true, message: '请选择组件物料', trigger: 'change' }],
            unitId: [{ required: true, message: '请选择计量单位', trigger: 'change' }],
            basicQuantity: [{ required: true, message: '请输入基本数量', trigger: 'blur' }]
          }
        : {
            code: [{ required: true, message: '请输入工序号', trigger: 'blur' }],
            name: [{ required: true, message: '请输入工序名称', trigger: 'blur' }]
          }
  )

  const jsonKeys = [
    'unitConversion',
    'activities',
    'outsourcing',
    'inspection',
    'sopDocuments'
  ] as const
  const jsonDefaults: Record<(typeof jsonKeys)[number], unknown> = {
    unitConversion: {},
    activities: [],
    outsourcing: {},
    inspection: {},
    sopDocuments: []
  }
  function createBomItem(): MesWorkOrderBomItemSnapshot {
    return {
      id: crypto.randomUUID(),
      componentMaterialId: '',
      componentMaterialCode: '',
      componentMaterialName: '',
      componentTypeId: null,
      componentSpecification: '',
      sequenceNo: (row.value?.bomSnapshot?.[0]?.items?.length ?? 0) + 1,
      quantity: 1,
      basicQuantity: 1,
      requiredQuantity: row.value?.orderQuantity ?? 1,
      unitId: '',
      unitName: '',
      positionNo: null,
      operationName: null,
      assignedRouteStepId: null,
      assignedOperationCode: null,
      assignedOperationName: null,
      assignmentSource: 'unassigned',
      sourcePath: [],
      virtualUnexpanded: false,
      scrapRate: 0,
      mrpEnabled: true,
      defaultIssueWarehouseId: null,
      issueMethod: '',
      backflushMethod: '',
      overIssueControlMethod: null,
      projectText: null,
      processRouteStepId: null,
      effectiveFrom: null,
      effectiveTo: null,
      remark: null
    }
  }
  function createRouteStep(): MesWorkOrderRouteStepSnapshot {
    const steps = row.value?.routeSnapshot?.steps ?? []
    return {
      id: crypto.randomUUID(),
      code: String((steps.length + 1) * 10),
      name: '',
      operationCode: '',
      sort: (steps.length + 1) * 10,
      sequenceNo: 1,
      sequenceType: 'main',
      workCenterId: null,
      workCenterIds: [],
      workCenterNames: [],
      departmentId: null,
      departmentName: '',
      unitId: null,
      unitName: '',
      basicBatch: 1,
      runOutputQuantity: 1,
      runProcessingMinutes: 0,
      runGreenMinutes: 0,
      setupMinutes: 0,
      queueMinutes: 0,
      transferMinutes: 0,
      minimumTransferQuantity: 1,
      overlapEnabled: false,
      operatorCount: 1,
      machineCount: 1,
      controlCode: '',
      controlCodeName: '',
      operationMode: '',
      processingMode: '',
      reportMode: '',
      inspectionMode: '',
      sequenceControl: '',
      reworkMode: '',
      firstInspectionControl: '',
      needInspection: false,
      firstInspection: false,
      isFirst: steps.length === 0,
      isLast: true,
      critical: false,
      description: '',
      unitConversion: {},
      activities: [],
      outsourcing: {},
      inspection: {},
      sopDocuments: []
    }
  }
  async function handleOpen(data: WorkOrderSnapshotEditorOpenData): Promise<void> {
    row.value = data.row
    mode.value = data.mode
    target.value = data.target
    itemId.value = data.item?.id
    references.value = data.references
    const initial =
      data.target === 'header'
        ? data.row.routeSnapshot
        : (data.item ?? (data.mode === 'bom' ? createBomItem() : createRouteStep()))
    for (const key of Object.keys(model)) delete model[key]
    Object.assign(
      model,
      data.target === 'item' ? (data.mode === 'bom' ? createBomItem() : createRouteStep()) : {},
      cloneDeep(initial)
    )
    if (data.target === 'item' && data.mode === 'route') {
      for (const key of jsonKeys)
        model[`${key}Json`] = JSON.stringify(model[key] ?? jsonDefaults[key], null, 2)
    }
    await dialogRef.value?.handleOpen(data, {
      title:
        data.target === 'header'
          ? '编辑工单路线信息'
          : `${data.item ? '编辑' : '新增'}${data.mode === 'bom' ? ' BOM 组件' : '工序'}`,
      subtitle: data.row.workOrderNo,
      confirmText: '保存到工单',
      contentMaxHeight: '70vh',
      loading: data.mode === 'bom',
      loadingText: '正在加载物料控制选项…',
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        if (data.mode !== 'bom') return
        try {
          await Promise.all(
            [
              'mdmMaterialIssueMethod',
              'mdmMaterialBackflushMethod',
              'mdmMaterialOverIssueControl'
            ].map((code) => userStore.ensureDictLoaded(code))
          )
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: async () => {
        try {
          await formRef.value?.validate()
          if (!row.value) return false
          const next = cloneDeep(model) as Record<string, unknown>
          if (data.target === 'item' && data.mode === 'route') {
            for (const key of jsonKeys) {
              next[key] = JSON.parse(String(next[`${key}Json`] || 'null'))
              delete next[`${key}Json`]
            }
          }
          let updated: MesWorkOrder | undefined
          if (data.mode === 'bom') {
            const snapshots = cloneDeep(row.value.bomSnapshot ?? [])
            const bom: MesWorkOrderBomSnapshot = snapshots[0] ?? {
              id: crypto.randomUUID(),
              bomCode: `${row.value.workOrderNo}-BOM`,
              version: '工单调整',
              status: 'draft',
              items: []
            }
            const nextItem: MesWorkOrderBomItemSnapshot = { ...createBomItem(), ...next }
            const step = row.value.routeSnapshot?.steps?.find(
              (entry) => entry.id === nextItem.assignedRouteStepId
            )
            nextItem.assignedOperationCode = step?.code ?? null
            nextItem.assignedOperationName = step?.name ?? null
            nextItem.assignmentSource = step ? 'configured' : 'unassigned'
            if (
              !itemId.value ||
              (data.item as MesWorkOrderBomItemSnapshot | undefined)?.componentMaterialId !==
                nextItem.componentMaterialId
            ) {
              const material = references.value.materials.find(
                (entry) => entry.id === nextItem.componentMaterialId
              )
              nextItem.sourcePath = material?.code ? [material.code] : []
            }
            bom.items = itemId.value
              ? bom.items.map((entry) => (entry.id === itemId.value ? nextItem : entry))
              : [...bom.items, nextItem]
            updated = await saveWorkOrderSnapshot(row.value.id, 'bom', [bom])
          } else {
            const route: MesWorkOrderRouteSnapshot = cloneDeep(row.value.routeSnapshot ?? {})
            if (data.target === 'header') {
              Object.assign(route, next)
              delete (route as Record<string, unknown>).steps
              route.steps = cloneDeep(row.value.routeSnapshot?.steps ?? [])
            } else {
              const nextStep: MesWorkOrderRouteStepSnapshot = { ...createRouteStep(), ...next }
              nextStep.departmentName =
                references.value.departments.find((entry) => entry.id === nextStep.departmentId)
                  ?.name ?? ''
              nextStep.workCenterNames = (nextStep.workCenterIds ?? []).map(
                (id) => references.value.workCenters.find((entry) => entry.id === id)?.name ?? id
              )
              nextStep.unitName =
                references.value.units.find((entry) => entry.id === nextStep.unitId)?.name ?? ''
              route.steps = itemId.value
                ? (route.steps ?? []).map((entry) => (entry.id === itemId.value ? nextStep : entry))
                : [...(route.steps ?? []), nextStep]
            }
            updated = await saveWorkOrderSnapshot(row.value.id, 'route', route)
          }
          if (updated) emit('success', updated)
          return Boolean(updated)
        } catch (error) {
          if (error instanceof SyntaxError) {
            ElMessage.error('工艺扩展参数不是有效的 JSON，请检查后重试')
          }
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .snapshot-editor {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
</style>
