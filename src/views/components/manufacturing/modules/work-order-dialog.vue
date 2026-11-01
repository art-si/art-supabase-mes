<template>
  <ArtDialog ref="dialogRef" size="xl" content-height="min(620px, 70vh)" @close="handleDialogClose">
    <div class="work-order-dialog">
      <ArtEntitySummary
        class="mb-4"
        icon="ri:file-list-3-line"
        compact
        :title="selectedMaterial?.description || selectedMaterial?.materialName || '生产工单'"
        description="分项维护工单信息，保存后集成 BOM 与工艺路线。"
      >
        <template #aside>
          <WorkOrderStatusTag v-if="detailRecord" :status="detailRecord.orderStatus" />
        </template>
      </ArtEntitySummary>
      <WorkOrderDetail
        v-if="readonly && detailRecord"
        v-model:active-tab="activeFormTab"
        :record="detailRecord"
        :references="references"
        :tenant-options="tenantOptions"
      >
        <template
          v-if="detailRecord.packingEnabledSnapshot && detailRecord.extensionSchemaSnapshot?.length"
          #parameters
        >
          <p class="mb-4 text-xs text-g-700">按创建或最近编辑时的单据类型配置固化。</p>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="field in detailRecord.extensionSchemaSnapshot"
              :key="field.key"
              class="grid gap-1"
            >
              <small class="text-gray-500">{{ field.label }}</small>
              <strong>{{
                extensionDisplayValue(field, detailRecord.extensionValues?.[field.key])
              }}</strong>
            </div>
          </div>
        </template>
        <template #details>
          <WorkOrderDetails
            v-model:rows="detailRows"
            readonly
            :action-permission="currentId ? 'MesWorkOrder:Edit' : 'MesWorkOrder:Add'"
            :default-width-mm="selectedMaterial?.widthMm"
          />
        </template>
      </WorkOrderDetail>
      <ArtForm
        v-if="!readonly"
        ref="formRef"
        class="px-0! pt-0!"
        v-model:active-tab="activeFormTab"
        v-model="model"
        :items="formItems"
        :rules="rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #materialId>
          <div class="flex w-full min-w-0 flex-col gap-3">
            <ArtMaterialSelect
              v-model="model.materialId"
              :selected-data="selectedMaterial ? [selectedMaterial] : []"
              :api-fn="fetchMaterialOptions"
              :categories="materialCategories"
              :label-key="materialDescriptionLabel"
              reset-draft-on-open
              subtitle="按物料分类筛选；选择后自动带入生产单位、计划员与生产提前期"
              placeholder="请选择物料描述"
              empty-description="请先维护物料编码后再创建生产工单。"
              :disabled="locked"
              @change="handleMaterialChange"
            />
            <ElAlert
              v-if="selectedMaterial?.materialType === 'FERT' && !model.inboundWarehouseName"
              title="暂无可用成品仓；请先启用成品仓并设置业务应用范围。"
              type="warning"
              show-icon
              :closable="false"
            />
          </div>
        </template>
        <template #urgency>
          <WorkOrderUrgencySegmented v-model="model.urgency" :disabled="locked" />
        </template>
        <template #materialSummary>
          <ArtDescriptions
            :data="model"
            :items="materialSummaryItems"
            :columns="3"
            :tablet-columns="3"
            :border="false"
            size="small"
            empty-text="—"
            class="rounded-lg bg-g-100 p-3"
          />
        </template>

        <template #productionDetails>
          <WorkOrderDetails
            ref="detailsRef"
            v-model:rows="detailRows"
            :readonly="false"
            :action-permission="currentId ? 'MesWorkOrder:Edit' : 'MesWorkOrder:Add'"
            :default-width-mm="selectedMaterial?.widthMm"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toNameCodeOption } from '@/utils/form/option'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { ElButton, ElMessage } from 'element-plus'
  import { h } from 'vue'
  import dayjs from 'dayjs'
  import { cloneDeep, pick } from 'lodash-es'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtMaterialSelect from '@/components/business/art-material-select/index.vue'
  import type {
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import type {
    WorkOrderExtensionField,
    WorkOrderExtensionValues
  } from '@/types/business/work-order-extension'
  import { useUserStore } from '@/store/modules/user'
  import WorkOrderDetail from './work-order-detail.vue'
  import WorkOrderUrgencySegmented from './work-order-urgency-segmented.vue'
  import WorkOrderStatusTag from './work-order-status-tag.vue'
  import WorkOrderDetails, { type WorkOrderDetailDraft } from './work-order-details.vue'
  import {
    calculatePlanFromEnd,
    calculatePlanFromStart,
    calculateProductionDays
  } from './work-order-plan'
  import {
    fetchMesBomComponentOptions,
    fetchMesConfirmedProjectBom,
    fetchMesProjectSections,
    fetchMesMaterialCategories,
    fetchMesMaterialOptions,
    fetchMesMaterialDetailsById,
    fetchMesReferences,
    saveWorkOrder,
    type MesMaterialCategory,
    type MesMaterialOption,
    type MesReferences,
    type MesWorkOrder,
    type MesWorkOrderInput
  } from '@mes/api'

  export interface WorkOrderDialogOpenData {
    tenantId: string
    tenantOptions: Array<{ label: string; value: string }>
    row?: MesWorkOrder
    readonly?: boolean
  }

  interface WorkOrderFormModel extends MesWorkOrderInput {
    extensionValues: WorkOrderExtensionValues
    materialCode: string
    specificationModel: string
    drawingNo: string
    productionUnitName: string
    plannerName: string
    dispatcherName: string
    inboundWarehouseName: string
    productionFixedLeadDays: number
    productionPreprocessDays: number
    selfMadeProductionDays: number
    productionPostprocessDays: number
    productionDays: number
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<WorkOrderDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const activeFormTab = ref('identity')
  const references = ref<MesReferences>({
    materials: [],
    customers: [],
    projects: [],
    documentTypes: [],
    employees: [],
    workCenters: []
  })
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])
  const projectSections = ref<
    Array<{ constructionNo: string; sectionName: string; status: 'active' | 'closed' }>
  >([])
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const readonly = ref(false)
  const detailRecord = ref<MesWorkOrder>()
  const detailsRef = ref<InstanceType<typeof WorkOrderDetails>>()
  const detailRows = ref<WorkOrderDetailDraft[]>([])
  const quantityOverridden = ref(false)
  const initializing = ref(false)
  const detailAreaTotal = computed(() =>
    Number(detailRows.value.reduce((total, row) => total + Number(row.areaSqm || 0), 0).toFixed(2))
  )
  const extensionValues = reactive<WorkOrderExtensionValues>({})
  let bomOptionsRequestId = 0
  let dialogRequestId = 0
  const model = ref<WorkOrderFormModel>({
    extensionValues,
    tenantId: '',
    workOrderNo: '',
    workOrderTypeId: null,
    projectId: null,
    constructionNo: null,
    materialId: '',
    materialCode: '',
    specificationModel: '',
    drawingNo: '',
    productionUnitName: '',
    plannerName: '',
    dispatcherName: '',
    inboundWarehouseName: '',
    productionFixedLeadDays: 0,
    productionPreprocessDays: 0,
    selfMadeProductionDays: 0,
    productionPostprocessDays: 0,
    productionDays: 0,
    orderQuantity: 1,
    isInitialDocument: false,
    plannedStartDate: null,
    plannedEndDate: '',
    source: 'manual',
    urgency: 'normal',
    remark: '',
    specialRequirement: null,
    trackingNo: null,
    followNo: null,
    merchandiserId: null,
    salespersonId: null,
    customerCode: null,
    customProcessCode: null,
    specificationQuantity: null,
    salesOrderNo: null,
    salesOrderQuantity: null
  })
  const selectedMaterial = shallowRef<MesMaterialOption>()
  const materialDescriptionLabel = (row: DataSelectRecord): string => {
    const material = row as MesMaterialOption
    return material.description?.trim() || material.materialName || '未维护物料描述'
  }
  const materialCategories = ref<MesMaterialCategory[]>([])
  const currentId = ref('')
  const heading = computed(() =>
    readonly.value ? '工单详情' : currentId.value ? '编辑工单' : '新增工单'
  )

  const locked = computed(() => readonly.value)
  const selectedWorkOrderType = computed(() =>
    references.value.documentTypes.find((item) => item.id === model.value.workOrderTypeId)
  )
  const projectRequired = computed(() => selectedWorkOrderType.value?.projectRequired ?? false)
  const activeExtensionFields = computed<WorkOrderExtensionField[]>(() =>
    selectedWorkOrderType.value?.packingEnabled
      ? (selectedWorkOrderType.value.extensionFields ?? [])
      : []
  )
  watch(detailAreaTotal, (total) => {
    if (!initializing.value && !quantityOverridden.value && detailRows.value.length) {
      model.value.orderQuantity = total
    }
  })
  function resetQuantityFromDetails(): void {
    model.value.orderQuantity = detailAreaTotal.value
    quantityOverridden.value = false
  }
  const extensionDisplayValue = (field: WorkOrderExtensionField, value: unknown) => {
    if (value === null || value === undefined || value === '') return '—'
    if (field.valueType !== 'material') return String(value)
    const material = references.value.materials.find((item) => item.id === value)
    return material ? `${material.code} · ${material.name}` : String(value)
  }
  const extensionItems = computed<FormItem[]>(() => [
    ...activeExtensionFields.value.map((field) => ({
      key: `extensionValues.${field.key}`,
      label: field.label,
      span: 8,
      type:
        field.valueType === 'number'
          ? ('number' as const)
          : field.valueType === 'material'
            ? ('select' as const)
            : ('input' as const),
      options:
        field.valueType === 'material'
          ? references.value.materials.map(toNameCodeOption)
          : undefined,
      props:
        field.valueType === 'number'
          ? { class: 'w-full!', precision: 4 }
          : field.valueType === 'material'
            ? {
                class: 'w-full!',
                filterable: true,
                clearable: true,
                placeholder: `请选择${field.label}`
              }
            : {
                maxlength: 200,
                placeholder: field.sourceComponentTypeId
                  ? '从 BOM 自动带入，可修改'
                  : `请输入${field.label}`
              },
      help: field.sourceComponentTypeId ? '按 BOM 组件类型自动带入，允许人工调整。' : undefined
    }))
  ])
  const dictionaryOptions = (code: string) => getDictMap.value[code] ?? []
  const employeeSelection = (id?: string | null): EmployeeIntegrationItem[] => {
    const item = references.value.employees.find((employee) => employee.id === id)
    return item
      ? [
          {
            id: item.id,
            tenantId: model.value.tenantId,
            employeeNo: item.code,
            employeeName: item.name,
            employmentStatus: 'active'
          }
        ]
      : []
  }
  const materialSummaryItems: ArtDescriptionItem<WorkOrderFormModel>[] = [
    { key: 'materialCode', label: '物料编码', field: 'materialCode' },
    { key: 'specificationModel', label: '规格型号', field: 'specificationModel' },
    { key: 'drawingNo', label: '图号', field: 'drawingNo' },
    { key: 'productionUnitName', label: '生产单位', field: 'productionUnitName' },
    { key: 'plannerName', label: '计划员', field: 'plannerName' },
    { key: 'dispatcherName', label: '调度员', field: 'dispatcherName' },
    { key: 'inboundWarehouseName', label: '入库仓库', field: 'inboundWarehouseName', span: 3 }
  ]
  const formItems = computed<FormItem[]>(() => [
    {
      key: 'identity',
      label: '基本信息',
      type: 'tab',
      description: '先确定工单类型、项目与业务属性。'
    },
    {
      key: 'tenantId',
      label: '所属租户',
      type: 'select',
      span: 24,
      options: tenantOptions.value,
      props: {
        disabled: locked.value || !!currentId.value,
        filterable: true,
        onChange: handleTenantChange
      },
      help: '全部租户视图下新增时，必须明确数据归属。'
    },
    {
      key: 'workOrderNo',
      label: '工单编号',
      props: { disabled: locked.value, placeholder: '留空后按月自动生成' }
    },
    {
      key: 'workOrderTypeId',
      label: '工单类型',
      type: 'select',
      options: references.value.documentTypes.map(toNameCodeOption),
      props: {
        disabled: locked.value,
        clearable: true,
        filterable: true,
        onChange: handleWorkOrderTypeChange
      },
      help: selectedWorkOrderType.value?.packingEnabled
        ? '该类型已启用排包，专用参数随类型显示；板厚用于排包单。'
        : '仅板材或需要排包的类型显示专用参数；可在 MDM主数据 → 单据类型中配置。'
    },
    {
      key: 'projectId',
      label: projectRequired.value ? '项目 *' : '项目',
      type: 'select',
      options: references.value.projects.map(toNameCodeOption),
      props: {
        disabled: locked.value,
        clearable: true,
        filterable: true,
        onChange: handleProjectChange
      },
      help: projectRequired.value
        ? '工程项目工单必须指定项目；施工号可选填。'
        : '非项目工单可留空。'
    },
    {
      key: 'constructionNo',
      label: '施工号',
      type: 'select',
      options: projectSections.value.map((section) => ({
        label: `${section.constructionNo} · ${section.sectionName}`,
        value: section.constructionNo,
        disabled: section.status !== 'active'
      })),
      props: {
        disabled: locked.value || !model.value.projectId,
        clearable: true,
        filterable: true,
        placeholder: model.value.projectId ? '选择项目施工号' : '请先选择项目'
      },
      help: model.value.projectId
        ? '可选填当前项目已启用的施工号；下达时空值仅提醒。'
        : '关联项目后可选填施工号。'
    },
    {
      key: 'source',
      label: '工单来源',
      type: 'select',
      options: dictionaryOptions('mesWorkOrderSource'),
      props: { disabled: locked.value }
    },
    { key: 'urgency', label: '紧急程度', type: 'slot' },
    {
      key: 'isInitialDocument',
      label: '初始化单据',
      type: 'switch',
      span: 24,
      props: { disabled: locked.value, activeText: '是', inactiveText: '否' },
      help: '默认关闭；开启后用于标识初始化导入或期初生产单据。'
    },
    {
      key: 'plan',
      label: '产品与计划',
      type: 'tab',
      description: '选择产品，维护数量与计划日期。'
    },
    {
      key: 'materialId',
      label: '物料描述',
      type: 'slot',
      span: 24
    },
    { key: 'materialSummary', label: '', type: 'slot', span: 24 },
    {
      key: 'orderQuantity',
      label: '工单数量',
      type: 'number',
      props: {
        min: 0.01,
        precision: 2,
        disabled: locked.value,
        class: 'w-full!',
        'aria-label': '工单数量',
        onChange: () => {
          quantityOverridden.value = true
        }
      },
      description: () =>
        h(
          ElButton,
          { disabled: locked.value || !detailRows.value.length, onClick: resetQuantityFromDetails },
          () => '按面积重算'
        ),
      span: 12,
      help: `按生产单明细面积自动汇总，当前合计 ${detailAreaTotal.value.toFixed(2)} ㎡；可手动修改。`
    },
    {
      key: 'productionDays',
      label: '生产天数',
      type: 'number',
      props: { disabled: true, min: 0, precision: 0, class: '!w-full' },
      help: `固定 ${model.value.productionFixedLeadDays} 天 + 前处理 ${model.value.productionPreprocessDays} 天 + 自制 ${model.value.selfMadeProductionDays} 天 + 后处理 ${model.value.productionPostprocessDays} 天`
    },
    {
      key: 'plannedStartDate',
      label: '计划开始日期',
      type: 'date',
      props: {
        disabled: locked.value,
        valueFormat: 'YYYY-MM-DD',
        class: '!w-full',
        onChange: handlePlannedStartChange
      },
      help: '修改后按生产天数自动推算计划完工日期。'
    },
    {
      key: 'plannedEndDate',
      label: '计划完工日期',
      type: 'date',
      props: {
        disabled: locked.value,
        valueFormat: 'YYYY-MM-DD',
        class: '!w-full',
        onChange: handlePlannedEndChange
      },
      help: '修改后反推计划开始日期；若反推日期已过期，则从今天重新计算。'
    },
    {
      key: 'sales',
      label: '销售协同',
      type: 'tab',
      description: '关联客户、销售订单与跟单信息，补充特殊要求。'
    },
    {
      key: 'customerCode',
      span: 8,
      label: '客户',
      type: 'select',
      options: references.value.customers.map((item) => ({
        label: `${item.name} · ${item.code}`,
        value: item.code
      })),
      props: {
        disabled: locked.value,
        clearable: true,
        filterable: true,
        placeholder: '请选择客户'
      }
    },
    { key: 'salesOrderNo', label: '销售订单号', span: 8, props: { disabled: locked.value } },
    {
      key: 'salesOrderQuantity',
      span: 8,
      label: '销售数量',
      type: 'number',
      props: { disabled: locked.value, min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'merchandiserId',
      label: '跟单员',
      type: 'employeeSelect',
      span: 8,
      props: {
        selectedData: employeeSelection(model.value.merchandiserId),
        tenantId: model.value.tenantId,
        placeholder: '选择跟单员',
        onChange: (value: string | string[] | undefined) => {
          model.value.merchandiserId = typeof value === 'string' ? value : null
        }
      }
    },
    {
      key: 'salespersonId',
      label: '业务员',
      type: 'employeeSelect',
      span: 8,
      props: {
        selectedData: employeeSelection(model.value.salespersonId),
        tenantId: model.value.tenantId,
        placeholder: '选择业务员',
        onChange: (value: string | string[] | undefined) => {
          model.value.salespersonId = typeof value === 'string' ? value : null
        }
      }
    },
    { key: 'trackingNo', label: '跟踪号', span: 8, props: { disabled: locked.value } },
    { key: 'followNo', label: '跟随号', span: 8, props: { disabled: locked.value } },
    { key: 'customProcessCode', label: '定制工艺编号', span: 8, props: { disabled: locked.value } },
    {
      key: 'specificationQuantity',
      span: 8,
      label: '规格数量',
      type: 'number',
      props: { disabled: locked.value, min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'specialRequirement',
      label: '特殊要求',
      type: 'textarea',
      span: 12,
      props: { disabled: locked.value, rows: 3, maxlength: 1000, showWordLimit: true }
    },
    {
      key: 'remark',
      label: '备注',
      type: 'textarea',
      span: 12,
      props: { disabled: locked.value, rows: 3, maxlength: 1000, showWordLimit: true }
    },
    {
      key: 'parameters',
      label: '专用参数',
      type: 'tab',
      hidden: !activeExtensionFields.value.length,
      description: '尺寸、芯材和面板按物料及 BOM 带入，允许人工调整。'
    },
    ...extensionItems.value,
    {
      key: 'details',
      label: '生产明细',
      type: 'tab',
      description: '按区域维护尺寸与块数，面积自动汇总到工单数量。'
    },
    { key: 'productionDetails', label: '', type: 'slot', span: 24 }
  ])
  const rules = {
    tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
    workOrderTypeId: [{ required: true, message: '请选择工单类型', trigger: 'change' }],
    materialId: [{ required: true, message: '请选择物料描述', trigger: 'change' }],
    orderQuantity: [{ required: true, message: '请输入工单数量', trigger: 'blur' }],
    plannedStartDate: [{ required: true, message: '请选择计划开始日期', trigger: 'change' }],
    plannedEndDate: [{ required: true, message: '请选择计划完工日期', trigger: 'change' }]
  }

  async function loadReferences() {
    const tenantId = model.value.tenantId
    const [nextReferences, nextMaterialCategories] = await Promise.all([
      fetchMesReferences(tenantId),
      fetchMesMaterialCategories(tenantId)
    ])
    if (model.value.tenantId !== tenantId) return
    references.value = nextReferences
    materialCategories.value = nextMaterialCategories
    if (
      !currentId.value &&
      !nextReferences.documentTypes.some((item) => item.id === model.value.workOrderTypeId)
    ) {
      model.value.workOrderTypeId =
        nextReferences.documentTypes.find((item) => item.isDefault)?.id ?? null
    }
  }
  async function handleTenantChange(): Promise<void> {
    bomOptionsRequestId++
    applyMaterial()
    model.value.workOrderTypeId = null
    for (const key of Object.keys(extensionValues)) delete extensionValues[key]
    model.value.projectId = null
    model.value.constructionNo = null
    projectSections.value = []
    await loadReferences()
  }
  async function fetchMaterialOptions(params: DataSelectFetchParams) {
    if (!model.value.tenantId) return { data: [], total: 0 }
    return fetchMesMaterialOptions({
      tenantId: model.value.tenantId,
      keyword: params.keyword,
      categoryId: String(params.filters.categoryId || '') || undefined,
      current: params.page,
      size: params.pageSize
    })
  }
  function applyPlanFromStart(value: string): void {
    const plan = calculatePlanFromStart(value, model.value.productionDays)
    if (plan) Object.assign(model.value, plan)
  }
  function applyPlanFromEnd(value: string): void {
    const plan = calculatePlanFromEnd(value, model.value.productionDays)
    if (plan) Object.assign(model.value, plan)
  }
  function handlePlannedStartChange(value: unknown): void {
    if (typeof value === 'string') applyPlanFromStart(value)
  }
  function handlePlannedEndChange(value: unknown): void {
    if (typeof value === 'string') applyPlanFromEnd(value)
  }
  function applyMaterial(
    material?: MesMaterialOption,
    recalculatePlan = true,
    overwriteDimensions = true
  ): void {
    const productionFixedLeadDays = material?.productionFixedLeadDays ?? 0
    const productionPreprocessDays = material?.productionPreprocessDays ?? 0
    const selfMadeProductionDays = material?.selfMadeProductionDays ?? 0
    const productionPostprocessDays = material?.productionPostprocessDays ?? 0
    const productionDays =
      material?.productionDays ??
      calculateProductionDays({
        productionFixedLeadDays,
        productionPreprocessDays,
        selfMadeProductionDays,
        productionPostprocessDays
      })
    selectedMaterial.value = material
    Object.assign(model.value, {
      materialId: material?.id || '',
      materialCode: material?.materialCode || material?.code || '',
      specificationModel: material?.specificationModel || material?.specification || '',
      drawingNo: material?.drawingNo || '',
      productionUnitName: material?.productionUnitName || material?.unit || '',
      plannerName: material?.plannerName || '',
      dispatcherName: material?.dispatcherName || '',
      inboundWarehouseName: material?.inboundWarehouseName || '',
      productionFixedLeadDays,
      productionPreprocessDays,
      selfMadeProductionDays,
      productionPostprocessDays,
      productionDays
    })
    applyMaterialDimensions(material, overwriteDimensions)
    if (!material || !recalculatePlan) return
    if (model.value.plannedStartDate) applyPlanFromStart(model.value.plannedStartDate)
    else if (model.value.plannedEndDate) applyPlanFromEnd(model.value.plannedEndDate)
    else applyPlanFromStart(dayjs().format('YYYY-MM-DD'))
  }
  function handleMaterialChange(_value: unknown, rows: DataSelectRecord[]): void {
    applyMaterial(rows[0] as MesMaterialOption | undefined)
    void populateExtensionFromBom()
  }
  async function handleProjectChange(value: unknown): Promise<void> {
    const projectId = typeof value === 'string' ? value : ''
    model.value.constructionNo = null
    projectSections.value = []
    if (!projectId || !model.value.tenantId) return
    const tenantId = model.value.tenantId
    try {
      const [bom, sections] = await Promise.all([
        fetchMesConfirmedProjectBom(tenantId, projectId),
        fetchMesProjectSections(tenantId, projectId)
      ])
      if (model.value.projectId !== projectId || model.value.tenantId !== tenantId) return
      projectSections.value = sections
      const activeSections = sections.filter((section) => section.status === 'active')
      if (activeSections.length === 1) model.value.constructionNo = activeSections[0].constructionNo
      if (!bom?.material?.materialCode) return
      const materials = await fetchMesMaterialOptions({
        tenantId,
        keyword: bom.material.materialCode,
        current: 1,
        size: 20
      })
      if (model.value.projectId !== projectId || model.value.tenantId !== tenantId) return
      const material = materials.data.find((item) => item.id === bom.materialId)
      if (material) {
        applyMaterial(material)
        void populateExtensionFromBom()
      }
    } catch {
      ElMessage.warning('项目交付物或施工号加载失败，请重试')
    }
  }
  function applyMaterialDimensions(material?: MesMaterialOption, overwrite = true): void {
    for (const [key, value] of [
      ['width', material?.widthMm],
      ['thickness', material?.thicknessMm]
    ] as const) {
      if (!activeExtensionFields.value.some((field) => field.key === key)) continue
      if (overwrite || extensionValues[key] == null || extensionValues[key] === '') {
        extensionValues[key] = value ?? null
      }
    }
  }
  async function populateExtensionFromBom(onlyMissing = false): Promise<void> {
    const requestId = ++bomOptionsRequestId
    const tenantId = model.value.tenantId
    const materialId = model.value.materialId
    const workOrderTypeId = model.value.workOrderTypeId
    const sourcedFields = activeExtensionFields.value.filter(
      (field) =>
        field.sourceComponentTypeId &&
        (!onlyMissing || extensionValues[field.key] == null || extensionValues[field.key] === '')
    )
    if (readonly.value || !tenantId || !materialId || !sourcedFields.length) return
    const previousValues = pick(
      extensionValues,
      sourcedFields.map((field) => field.key)
    )
    const isCurrent = () =>
      requestId === bomOptionsRequestId &&
      tenantId === model.value.tenantId &&
      materialId === model.value.materialId &&
      workOrderTypeId === model.value.workOrderTypeId &&
      !readonly.value
    try {
      const items = await fetchMesBomComponentOptions(
        tenantId,
        materialId,
        model.value.plannedStartDate || dayjs().format('YYYY-MM-DD')
      )
      if (!isCurrent()) return
      for (const field of sourcedFields) {
        // A user selection made while the BOM request was pending wins over the default.
        if ((extensionValues[field.key] ?? '') !== (previousValues[field.key] ?? '')) continue
        const component = items.find(
          (item) => item.componentTypeId === field.sourceComponentTypeId
        )?.component
        extensionValues[field.key] = component?.id ?? null
      }
    } catch {
      if (!isCurrent()) return
      ElMessage.warning('BOM 组件带入失败，请手动填写工单专用参数')
    }
  }
  function handleDialogClose(): void {
    dialogRequestId++
    bomOptionsRequestId++
  }
  function handleWorkOrderTypeChange(): void {
    for (const key of Object.keys(extensionValues)) delete extensionValues[key]
    applyMaterialDimensions(selectedMaterial.value)
    void populateExtensionFromBom()
  }
  const workOrderInputKeys = [
    'tenantId',
    'workOrderNo',
    'workOrderTypeId',
    'projectId',
    'constructionNo',
    'materialId',
    'orderQuantity',
    'isInitialDocument',
    'plannedStartDate',
    'plannedEndDate',
    'source',
    'urgency',
    'remark',
    'specialRequirement',
    'trackingNo',
    'followNo',
    'merchandiserId',
    'salespersonId',
    'customerCode',
    'customProcessCode',
    'specificationQuantity',
    'salesOrderNo',
    'salesOrderQuantity'
  ] as const satisfies readonly (keyof MesWorkOrderInput)[]
  function buildPayload(): MesWorkOrderInput {
    const payload = pick(model.value, workOrderInputKeys)
    return {
      ...payload,
      orderQuantity: Number(Number(payload.orderQuantity).toFixed(2)),
      extensionValues: cloneDeep(
        pick(
          extensionValues,
          activeExtensionFields.value.map((field) => field.key)
        )
      ),
      details: detailRows.value.map((row, index) => ({
        area: row.area.trim(),
        number: row.number.trim(),
        lengthMm: Number(row.lengthMm),
        pieces: Number(row.pieces),
        widthMm: Number(row.widthMm),
        areaSqm: Number(row.areaSqm),
        areaOverridden: row.areaOverridden,
        remark: row.remark.trim(),
        sortOrder: (index + 1) * 10
      })),
      workOrderNo: payload.workOrderNo.trim(),
      constructionNo: normalizeNullableText(payload.constructionNo),
      remark: payload.remark.trim(),
      specialRequirement: normalizeNullableText(payload.specialRequirement),
      trackingNo: normalizeNullableText(payload.trackingNo),
      followNo: normalizeNullableText(payload.followNo),
      customerCode: normalizeNullableText(payload.customerCode),
      customProcessCode: normalizeNullableText(payload.customProcessCode),
      salesOrderNo: normalizeNullableText(payload.salesOrderNo)
    }
  }
  const handleOpen = async (data: WorkOrderDialogOpenData) => {
    activeFormTab.value = 'identity'
    const openRequestId = ++dialogRequestId
    initializing.value = true
    bomOptionsRequestId++
    projectSections.value = []
    detailRows.value.splice(
      0,
      detailRows.value.length,
      ...(data.row?.details ?? []).map((row) => ({
        clientId: row.id || crypto.randomUUID(),
        area: row.area,
        number: row.number,
        lengthMm: row.lengthMm,
        pieces: row.pieces,
        packedPieces: row.packedPieces ?? 0,
        widthMm: row.widthMm,
        areaSqm: row.areaSqm,
        areaOverridden: row.areaOverridden,
        remark: row.remark,
        sortOrder: row.sortOrder
      }))
    )
    for (const key of Object.keys(extensionValues)) delete extensionValues[key]
    Object.assign(extensionValues, data.row?.extensionValues ?? {})
    tenantOptions.value = data.tenantOptions
    detailRecord.value = data.row
    readonly.value =
      !!data.readonly ||
      !!(data.row && (data.row.confirmedAt || !['pending', 'abnormal'].includes(data.row.status)))
    currentId.value = data.row?.id || ''
    selectedMaterial.value = data.row
      ? {
          id: data.row.materialId,
          tenantId: data.row.tenantId,
          code: data.row.materialCodeSnapshot,
          name: data.row.materialNameSnapshot,
          specification: data.row.specificationSnapshot,
          categoryId: '',
          materialCode: data.row.materialCodeSnapshot,
          materialName: data.row.materialNameSnapshot,
          specificationModel: data.row.specificationSnapshot,
          drawingNo: data.row.drawingNoSnapshot,
          unit: data.row.unitSnapshot,
          productionUnitId: data.row.productionUnitId || undefined,
          productionUnitName: data.row.unitSnapshot,
          plannerId: data.row.plannerId || undefined,
          plannerName: data.row.plannerNameSnapshot,
          dispatcherId: data.row.dispatcherId || undefined,
          dispatcherName: data.row.dispatcherNameSnapshot,
          inboundWarehouseId: data.row.inboundWarehouseId || undefined,
          inboundWarehouseName: data.row.inboundWarehouseNameSnapshot,
          productionFixedLeadDays: data.row.productionFixedLeadDaysSnapshot,
          productionPreprocessDays: data.row.productionPreprocessDaysSnapshot,
          selfMadeProductionDays: data.row.selfMadeProductionDaysSnapshot,
          productionPostprocessDays: data.row.productionPostprocessDaysSnapshot,
          productionDays: data.row.productionDaysSnapshot
        }
      : undefined
    Object.assign(
      model.value,
      data.row
        ? cloneDeep(data.row)
        : {
            tenantId: data.tenantId,
            workOrderNo: '',
            workOrderTypeId: null,
            projectId: null,
            constructionNo: null,
            materialId: '',
            materialCode: '',
            specificationModel: '',
            drawingNo: '',
            productionUnitName: '',
            plannerName: '',
            dispatcherName: '',
            inboundWarehouseName: '',
            productionFixedLeadDays: 0,
            productionPreprocessDays: 0,
            selfMadeProductionDays: 0,
            productionPostprocessDays: 0,
            productionDays: 0,
            orderQuantity: 1,
            isInitialDocument: false,
            plannedStartDate: null,
            plannedEndDate: '',
            source: 'manual',
            urgency: 'normal',
            remark: '',
            specialRequirement: null,
            trackingNo: null,
            followNo: null,
            merchandiserId: null,
            salespersonId: null,
            customerCode: null,
            customProcessCode: null,
            specificationQuantity: null,
            salesOrderNo: null,
            salesOrderQuantity: null
          }
    )
    model.value.extensionValues = extensionValues
    quantityOverridden.value = Boolean(
      data.row && Math.abs(Number(data.row.orderQuantity) - detailAreaTotal.value) > 0.01
    )
    if (!data.row && detailRows.value.length) resetQuantityFromDetails()
    initializing.value = false
    if (selectedMaterial.value) applyMaterial(selectedMaterial.value, false, false)
    await dialogRef.value?.handleOpen(data, {
      title: heading.value,
      subtitle: data.row?.workOrderNo || '计划工单',
      showFooter: !readonly.value,
      confirmText: currentId.value ? '保存更改' : '创建工单',
      contentMaxHeight: '72vh',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await Promise.all(
            [
              'mesWorkOrderSource',
              'mesWorkOrderUrgency',
              'mesWorkOrderStatus',
              'mdmMaterialSource',
              'mdmMaterialSpecialPurchaseType'
            ].map((code) => userStore.ensureDictLoaded(code))
          )
          await loadReferences()
          if (openRequestId !== dialogRequestId) return
          if (model.value.projectId && model.value.tenantId) {
            const sections = await fetchMesProjectSections(
              model.value.tenantId,
              model.value.projectId
            )
            if (openRequestId !== dialogRequestId) return
            projectSections.value = sections
          }
          if (selectedMaterial.value) {
            const details = await fetchMesMaterialDetailsById(
              model.value.tenantId,
              model.value.materialId
            )
            if (openRequestId !== dialogRequestId) return
            if (details && selectedMaterial.value?.id === model.value.materialId) {
              selectedMaterial.value = { ...selectedMaterial.value, ...details }
              applyMaterialDimensions(selectedMaterial.value, false)
            }
          }
          await populateExtensionFromBom(true)
          if (openRequestId !== dialogRequestId) return
          formRef.value?.clearValidate()
        } finally {
          if (openRequestId === dialogRequestId) api.setLoading(false)
        }
      },
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          if (projectRequired.value && !model.value.projectId) {
            await formRef.value?.focusField('projectId')
            ElMessage.warning('工程项目工单必须选择项目')
            return false
          }
          if (!(await detailsRef.value?.validate({ focus: false }))) {
            activeFormTab.value = 'details'
            await nextTick()
            await detailsRef.value?.focusFirstInvalidField()
            return false
          }
          const payload = buildPayload()
          await saveWorkOrder(payload, currentId.value || undefined)
          emit('success', currentId.value ? 'edit' : 'add')
          return true
        } catch (error) {
          notifyFriendlyError(error, '生产工单提交失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
