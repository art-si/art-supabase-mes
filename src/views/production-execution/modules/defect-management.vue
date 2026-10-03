<template>
  <ArtPermissionGuard permission="MesDefectManagement:View" resource-name="不良管理">
    <div class="defect-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        :title="tab === 'reasons' ? '产出不良原因配置' : '报工不良明细'"
        :description="
          tab === 'reasons'
            ? '维护加工与来料不良原因，为现场报工提供统一的原因代码。'
            : '按报工记录追溯加工与来料不良的数量、原因及责任工序。'
        "
        icon="ri:shield-flash-line"
        density="compact"
        refreshable
        :refresh-loading="loading"
        @refresh="reload"
      >
        <template #actions>
          <BusinessTableWorkspaceActions :table="tableRef" />
        </template>
      </BusinessWorkspaceHeader>
      <ArtWorkspaceSplitter
        class="defect-page__body"
        primary-size="270px"
        primary-min="240px"
        primary-max="360px"
        :breakpoint="900"
      >
        <template #primary>
          <aside class="defect-page__scope"
            ><ProductionWorkCenterNavigator
              :workshops="workshopOptions"
              :work-centers="visibleCenters"
              :selected-workshop-id="scope.selectedWorkshopId"
              :selected-work-center-id="scope.selectedWorkCenterId"
              :loading="scope.loading"
              :error="scope.error"
              allow-all-workshops
              show-all-work-centers
              @refresh="loadScope"
              @select-workshop="selectWorkshop"
              @select-work-center="selectWorkCenter"
          /></aside>
        </template>
        <div class="defect-page__main"
          ><ElTabs v-model="tab" class="defect-page__tabs">
            <ElTabPane label="不良原因配置" name="reasons" />
            <ElTabPane label="报工不良明细" name="details" />
          </ElTabs>
          <div class="defect-page__card">
            <ElAlert v-if="error" :title="error" type="error" show-icon :closable="false" />
            <div class="defect-page__table"
              ><ArtTableQuery
                v-if="tab === 'reasons'"
                ref="tableRef"
                v-model="searchModel"
                :search-items="searchItems"
                :header-actions="headerActions"
                header-actions-placement="workspace"
                :table-header-props="{ layout: 'search,size,fullscreen,columns,settings' }"
                :search-bar-props="{
                  span: 6,
                  defaultExpanded: true,
                  resetLoading: resetting,
                  labelWidth: 80,
                  showExpand: false
                }"
                :data="filteredReasons"
                :loading="loading"
                :table-props="{
                  rowKey: 'id',
                  emptyHeight: '100%',
                  emptyText: '暂无不良原因'
                }"
                focus-scope-selector=".defect-page__body"
                focusable
                @search="applySearch"
                @reset="resetFilters"
                ><ElTableColumn type="index" label="序号" width="62" /><ElTableColumn
                  label="类别"
                  width="110"
                  ><template #default="{ row }"
                    ><ElTag
                      :type="row.category === 'process' ? 'warning' : 'primary'"
                      effect="plain"
                      >{{ categoryLabel(row.category) }}</ElTag
                    ></template
                  ></ElTableColumn
                ><ElTableColumn label="不良原因 / 代码" min-width="230"
                  ><template #default="{ row }"
                    ><BusinessTableIdentityCell
                      :primary="row.name"
                      :secondary="row.code"
                      icon="ri:shield-flash-line"
                      :icon-tone="row.category === 'process' ? 'warning' : 'primary'"
                    />
                  </template> </ElTableColumn
                ><ElTableColumn label="所属车间" min-width="150"
                  ><template #default="{ row }">{{
                    departmentName(row.departmentId)
                  }}</template></ElTableColumn
                ><ElTableColumn label="启用状态" width="100"
                  ><template #default="{ row }"
                    ><ElTag :type="row.enabled ? 'success' : 'info'" effect="plain">{{
                      row.enabled ? '启用' : '停用'
                    }}</ElTag></template
                  ></ElTableColumn
                ><ElTableColumn
                  prop="remark"
                  label="备注"
                  min-width="160"
                  show-overflow-tooltip /><ElTableColumn label="操作" fixed="right" width="104"
                  ><template #default="{ row }"
                    ><BusinessTableRowActions
                      ><ArtButtonTable
                        type="edit"
                        permission="MesDefectManagement:EditReason"
                        @click="openForm(row)"
                      />
                      <ArtButtonTable
                        type="delete"
                        permission="MesDefectManagement:DeleteReason"
                        @click="removeReason(row)"
                      /> </BusinessTableRowActions></template></ElTableColumn
              ></ArtTableQuery>
              <ArtTableQuery
                v-else
                ref="tableRef"
                v-model="searchModel"
                :search-items="searchItems"
                :header-actions="headerActions"
                header-actions-placement="workspace"
                :table-header-props="{ layout: 'search,size,fullscreen,columns,settings' }"
                :search-bar-props="{
                  span: 6,
                  defaultExpanded: true,
                  resetLoading: resetting,
                  labelWidth: 80,
                  showExpand: false
                }"
                :data="defectRows"
                :loading="loading"
                :table-props="{
                  rowKey: 'id',
                  tableLayout: 'fixed',
                  emptyHeight: '100%',
                  emptyText: '暂无不良明细'
                }"
                focus-scope-selector=".defect-page__body"
                focusable
                @search="applySearch"
                @reset="resetFilters"
                ><ElTableColumn type="index" label="序号" width="62" /><ElTableColumn
                  label="报工时间"
                  width="156"
                  ><template #default="{ row }">{{
                    formatTime(row.report.reportedAt)
                  }}</template></ElTableColumn
                ><ElTableColumn label="工单 / 任务单" min-width="220"
                  ><template #default="{ row }"
                    ><button
                      type="button"
                      class="art-table__cell-link"
                      @click.stop="openDetail(row)"
                    >
                      <BusinessTableIdentityCell
                        :primary="row.report.task?.workOrder?.workOrderNo"
                        :secondary="row.report.task?.taskNo"
                        icon="ri:file-warning-line"
                        icon-tone="danger"
                      /> </button></template></ElTableColumn
                ><ElTableColumn label="工序 / 产品" min-width="200"
                  ><template #default="{ row }"
                    ><BusinessTableIdentityCell
                      :primary="`${row.report.task?.operationCode || '—'} ${row.report.task?.operationName || '—'}`"
                      :secondary="`${row.report.task?.workOrder?.materialCodeSnapshot || '—'} ${row.report.task?.workOrder?.materialNameSnapshot || ''}`"
                    /> </template></ElTableColumn
                ><ElTableColumn label="类别 / 原因" min-width="190"
                  ><template #default="{ row }"
                    >{{ categoryLabel(row.category) }} · {{ row.reason?.name || '—' }}</template
                  ></ElTableColumn
                ><ElTableColumn label="不良数量" width="96" align="right"
                  ><template #default="{ row }"
                    ><strong class="defect-page__bad">{{ row.quantity }}</strong></template
                  ></ElTableColumn
                ><ElTableColumn label="不良率" width="92" align="right"
                  ><template #default="{ row }">{{ defectRate(row) }}%</template></ElTableColumn
                ><ElTableColumn label="操作人员" min-width="140" show-overflow-tooltip
                  ><template #default="{ row }">{{
                    operatorNames(row.report.operatorPersonIds)
                  }}</template></ElTableColumn
                ><ElTableColumn label="报工人" width="100"
                  ><template #default="{ row }">{{
                    row.report.reporterName
                  }}</template></ElTableColumn
                ><ElTableColumn label="操作" fixed="right" width="78"
                  ><template #default="{ row }"
                    ><ArtButtonTable
                      type="view"
                      @click="openDetail(row)" /></template></ElTableColumn></ArtTableQuery
            ></div> </div></div
      ></ArtWorkspaceSplitter>
      <ArtDialog ref="formDialogRef" size="sm" :show-fullscreen-button="false">
        <ArtForm
          ref="formRef"
          v-model="form"
          :items="formItems"
          :rules="formRules"
          :validate-on-rule-change="false"
          :span="12"
          :show-reset="false"
          :show-submit="false"
          root-class="p-0! md:p-0!"
        />
      </ArtDialog>
      <ArtDrawer ref="detailDrawerRef" size="lg" :show-footer="false"
        ><div v-if="detailRow" class="defect-page__detail"
          ><div class="defect-page__detail-intro"
            ><span aria-hidden="true"><ArtSvgIcon icon="ri:shield-flash-line" /></span>
            <div>
              <small>{{ detailRow.reason?.code || '不良原因' }}</small>
              <h3>{{ detailRow.reason?.name || '未匹配原因' }}</h3>
              <p>{{ detailRow.report.task?.taskNo || '未关联任务单' }}</p>
            </div>
            <ElTag :type="detailRow.category === 'process' ? 'warning' : 'primary'" effect="plain">
              {{ categoryLabel(detailRow.category) }}
            </ElTag>
          </div>
          <ArtSectionTitle>不良统计</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border
            ><ElDescriptionsItem label="不良数量">{{ detailRow.quantity }}</ElDescriptionsItem
            ><ElDescriptionsItem label="良品数量">{{
              detailRow.report.goodQuantity
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="不良率"
              >{{ defectRate(detailRow) }}%</ElDescriptionsItem
            ></ElDescriptions
          >
          <ArtSectionTitle>报工来源</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem label="任务单号">{{
              detailRow.report.task?.taskNo
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="工序"
              >{{ detailRow.report.task?.operationCode }}
              {{ detailRow.report.task?.operationName }}</ElDescriptionsItem
            ><ElDescriptionsItem label="报工时间">{{
              formatTime(detailRow.report.reportedAt)
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="报工人">{{
              detailRow.report.reporterName
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="备注" :span="detailColumns">{{
              detailRow.remark || '—'
            }}</ElDescriptionsItem></ElDescriptions
          ></div
        ></ArtDrawer
      >
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { computed, onMounted, reactive, ref, watch } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtTableQuery from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import type { FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import type { ArtTableQueryHeaderAction } from '@/components/core/tables/art-table-query/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ProductionWorkCenterNavigator from '@/components/business/production-work-center-navigator/index.vue'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { exportExcel } from '@/utils/file'
  import {
    fetchDefectReasons,
    fetchExecutionPeople,
    fetchProductionReports,
    saveDefectReason,
    type MesDefectReason,
    type MesExecutionPerson,
    type MesProductionReport,
    type MesReportDefect
  } from '@mes/api'
  import { useExecutionScope } from './use-execution-scope'

  const commonEnabledStatusOptions = useDictionaryOptions(
    'commonEnabledStatus',
    (value) => value === 'enabled'
  )

  const mesDefectSourceOptions = useDictionaryOptions('mesDefectSource')

  type DefectRow = MesReportDefect & { report: MesProductionReport }
  const props = withDefaults(defineProps<{ initialTab?: 'reasons' | 'details' }>(), {
    initialTab: 'reasons'
  })
  const { confirmDelete } = useArtFeedback()
  const {
    scope,
    effectiveTenantId,
    workshopOptions,
    visibleCenters,
    loadScope,
    selectWorkshop,
    selectWorkCenter
  } = useExecutionScope()
  const tab = ref<'reasons' | 'details'>(props.initialTab)
  const category = ref('')
  const keyword = ref('')
  const dateRange = ref<[string, string] | null>([
    dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD')
  ])
  const tableRef = ref<ArtTableQueryExpose>()
  const compactDetail = useMediaQuery('(max-width: 640px)')
  const detailColumns = computed(() => (compactDetail.value ? 1 : 2))
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    { type: 'export', permission: 'MesDefectManagement:Export', onClick: () => exportRows() },
    ...(tab.value === 'reasons'
      ? [
          {
            type: 'add' as const,
            label: '新增原因',
            permission: 'MesDefectManagement:AddReason',
            onClick: () => openForm()
          }
        ]
      : [])
  ])
  const searchModel = ref<Record<string, unknown>>({
    category: '',
    dateRange: dateRange.value,
    keyword: ''
  })
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'category',
      label: '类别',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部类别',
        options: mesDefectSourceOptions
      }
    },
    ...(tab.value === 'details'
      ? [
          {
            key: 'dateRange',
            label: '报工日期',
            type: 'daterange' as const,
            props: {
              valueFormat: 'YYYY-MM-DD',
              startPlaceholder: '开始日期',
              endPlaceholder: '结束日期'
            }
          }
        ]
      : []),
    {
      key: 'keyword',
      label: '关键字',
      type: 'input',
      props: { clearable: true, placeholder: '代码、原因或报工人' }
    }
  ])
  function applySearch(params: Record<string, unknown>) {
    category.value = String(params.category || '')
    dateRange.value =
      Array.isArray(params.dateRange) && params.dateRange.length === 2
        ? [String(params.dateRange[0]), String(params.dateRange[1])]
        : null
    keyword.value = String(params.keyword || '')
    void reload()
  }
  const reasons = ref<MesDefectReason[]>([])
  const defectRows = ref<DefectRow[]>([])
  const people = ref<MesExecutionPerson[]>([])
  const loading = ref(false)
  const resetting = ref(false)
  const error = ref('')
  const formDialogRef = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const detailDrawerRef = ref<ArtDrawerExpose<DefectRow>>()
  const detailRow = ref<DefectRow | null>(null)
  const editingId = ref<string | null>(null)
  const form = reactive({
    category: 'process',
    departmentId: '',
    code: '',
    name: '',
    enabled: true,
    remark: ''
  })
  const formRules: FormRules = {
    category: [{ required: true, message: '请选择不良类别', trigger: 'change' }],
    code: [{ required: true, whitespace: true, message: '请填写原因代码', trigger: 'blur' }],
    name: [{ required: true, whitespace: true, message: '请填写不良原因', trigger: 'blur' }]
  }
  const formItems = computed<FormItem[]>(() => [
    {
      key: 'category',
      label: '不良类别',
      type: 'segment',
      props: {
        options: mesDefectSourceOptions
      }
    },
    {
      key: 'departmentId',
      label: '所属车间 / 产线',
      type: 'select',
      props: {
        clearable: true,
        filterable: true,
        placeholder: '全部车间通用',
        options: scope.departments.map((item) => ({
          label: `${item.code} · ${item.name}`,
          value: item.id
        }))
      }
    },
    { key: 'code', label: '原因代码', type: 'input', props: { maxlength: 40 } },
    { key: 'name', label: '不良原因', type: 'input', props: { maxlength: 120 } },
    {
      key: 'enabled',
      label: '启用状态',
      type: 'segment',
      props: {
        options: commonEnabledStatusOptions
      }
    },
    { key: 'remark', label: '备注', type: 'textarea', span: 24, props: { rows: 3, maxlength: 500 } }
  ])
  const filteredReasons = computed(() =>
    reasons.value.filter(
      (item) =>
        (!category.value || item.category === category.value) &&
        (!scope.selectedWorkshopId ||
          !item.departmentId ||
          visibleCenters.value.some((center) => center.departmentId === item.departmentId)) &&
        (!keyword.value ||
          `${item.code} ${item.name}`.toLowerCase().includes(keyword.value.toLowerCase()))
    )
  )
  const categoryLabel = (value: string) => (value === 'process' ? '加工不良' : '来料不良')
  const departmentName = (id: string | null) =>
    scope.departments.find((item) => item.id === id)?.name || '全部车间'
  const formatTime = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm')
  const operatorNames = (ids: string[]) =>
    ids.map((id) => people.value.find((item) => item.id === id)?.name || id).join('、') || '—'
  const defectRate = (raw: unknown) => {
    const row = raw as DefectRow
    const report = row.report
    const total = report.goodQuantity + report.processBadQuantity + report.materialBadQuantity
    return total ? Math.round((row.quantity / total) * 100) : 0
  }

  let loadVersion = 0
  async function reload() {
    const version = ++loadVersion
    loading.value = true
    if (tab.value === 'reasons') reasons.value = []
    else defectRows.value = []
    error.value = ''
    try {
      if (tab.value === 'reasons') {
        const nextReasons = await fetchDefectReasons(effectiveTenantId.value)
        if (version !== loadVersion) return
        reasons.value = nextReasons
      } else {
        const result = await fetchProductionReports({
          current: 1,
          size: 10000,
          tenantId: effectiveTenantId.value,
          workCenterId: scope.selectedWorkCenterId || undefined,
          workCenterIds:
            scope.selectedWorkshopId && !scope.selectedWorkCenterId
              ? visibleCenters.value.map((item) => item.id)
              : undefined,
          dateRange: dateRange.value || undefined
        })
        if (version !== loadVersion) return
        if (result.total > 10000) ElMessage.warning('不良明细超过 10000 条，请缩小日期范围')
        defectRows.value = result.data
          .flatMap((report) => (report.defects || []).map((defect) => ({ ...defect, report })))
          .filter(
            (row) =>
              (!category.value || row.category === category.value) &&
              (!keyword.value ||
                `${row.reason?.code} ${row.reason?.name} ${row.report.reporterName}`
                  .toLowerCase()
                  .includes(keyword.value.toLowerCase()))
          )
      }
    } catch {
      if (version === loadVersion) error.value = '不良数据加载失败，请重试'
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }
  async function resetFilters() {
    if (resetting.value) return
    resetting.value = true
    category.value = ''
    keyword.value = ''
    dateRange.value = [
      dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD')
    ]
    await nextTick()
    try {
      await reload()
    } finally {
      resetting.value = false
    }
  }
  function openForm(raw?: unknown) {
    const row = raw as MesDefectReason | undefined
    editingId.value = row?.id || null
    Object.assign(form, {
      category: row?.category || 'process',
      departmentId: row?.departmentId || scope.selectedWorkshopId || '',
      code: row?.code || '',
      name: row?.name || '',
      enabled: row?.enabled ?? true,
      remark: row?.remark || ''
    })
    formRef.value?.clearValidate()
    formDialogRef.value?.handleOpen(undefined, {
      title: row ? '编辑不良原因' : '新增不良原因',
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
        } catch (error) {
          notifyFriendlyError(error, '不良原因校验失败，请重试')
          return false
        }
        if (!form.departmentId && !effectiveTenantId.value) {
          ElMessage.warning('请先选择目标租户的车间')
          return false
        }
        try {
          await saveDefectReason(editingId.value, row ? 'update' : 'create', {
            ...form,
            departmentId: form.departmentId || null
          })
        } catch (error) {
          notifyFriendlyError(error, '不良原因保存失败，请重试')
          return false
        }
        await reload()
        return true
      }
    })
  }
  async function removeReason(raw: unknown) {
    const row = raw as MesDefectReason
    try {
      await confirmDelete(`确定删除不良原因“${row.name}”？已有报工引用的原因只能停用。`, {
        title: '删除不良原因'
      })
      await saveDefectReason(row.id, 'delete', {})
      await reload()
    } catch {
      /* cancel or shared API error */
    }
  }
  function openDetail(raw: unknown) {
    detailRow.value = raw as DefectRow
    detailDrawerRef.value?.handleOpen(detailRow.value, { title: '不良明细' })
  }
  async function exportRows() {
    try {
      if (tab.value === 'reasons') {
        if (!filteredReasons.value.length) {
          ElMessage.info('当前条件下没有可导出的原因')
          return
        }
        await exportExcel({
          data: filteredReasons.value.map((row) => ({
            category: categoryLabel(row.category),
            code: row.code,
            name: row.name,
            department: departmentName(row.departmentId),
            enabled: row.enabled ? '启用' : '停用',
            remark: row.remark
          })),
          columns: [
            { key: 'category', title: '不良类别' },
            { key: 'code', title: '原因代码' },
            { key: 'name', title: '不良原因' },
            { key: 'department', title: '所属车间' },
            { key: 'enabled', title: '启用状态' },
            { key: 'remark', title: '备注' }
          ],
          filename: `不良原因-${dayjs().format('YYYYMMDD')}`
        })
      } else {
        if (!defectRows.value.length) {
          ElMessage.info('当前条件下没有可导出的不良记录')
          return
        }
        await exportExcel({
          data: defectRows.value.map((row) => ({
            time: formatTime(row.report.reportedAt),
            workOrder: row.report.task?.workOrder?.workOrderNo || '',
            taskNo: row.report.task?.taskNo || '',
            operation: row.report.task?.operationName || '',
            category: categoryLabel(row.category),
            reason: row.reason?.name || '',
            quantity: row.quantity,
            good: row.report.goodQuantity,
            rate: `${defectRate(row)}%`,
            reporter: row.report.reporterName,
            remark: row.remark
          })),
          columns: [
            { key: 'time', title: '报工时间' },
            { key: 'workOrder', title: '生产工单' },
            { key: 'taskNo', title: '任务单号' },
            { key: 'operation', title: '工序' },
            { key: 'category', title: '不良类别' },
            { key: 'reason', title: '不良原因' },
            { key: 'quantity', title: '不良数量' },
            { key: 'good', title: '良品数' },
            { key: 'rate', title: '不良率' },
            { key: 'reporter', title: '报工人' },
            { key: 'remark', title: '备注' }
          ],
          filename: `报工不良明细-${dayjs().format('YYYYMMDD')}`
        })
      }
    } catch {
      ElMessage.error('导出失败，请重试')
    }
  }
  watch(
    [tab, () => scope.selectedWorkCenterId, () => scope.selectedWorkshopId, effectiveTenantId],
    () => {
      if (!resetting.value) void reload()
    },
    { deep: true }
  )
  watch(
    effectiveTenantId,
    async () => {
      try {
        people.value = await fetchExecutionPeople(effectiveTenantId.value)
      } catch {
        people.value = []
      }
    },
    { immediate: true }
  )
  onMounted(() => {
    void reload()
  })
</script>

<style scoped lang="scss">
  .defect-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .defect-page__body {
    flex: 1;
    min-height: 0;
  }

  .defect-page__scope,
  .defect-page__main {
    min-width: 0;
    min-height: 0;
  }

  .defect-page__main {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .defect-page__tabs {
    flex: none;

    :deep(.el-tabs__header) {
      margin-bottom: 0;
    }
  }

  .defect-page__table {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .defect-page__card {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
  }

  .defect-page__bad {
    color: var(--el-color-danger);
  }

  .defect-page__detail {
    display: grid;
    gap: 16px;
  }

  .defect-page__detail h3 {
    margin: 0;
    color: var(--el-text-color-primary);
  }

  .defect-page__detail-intro {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 14px 16px;
    background: var(--art-gray-100);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--custom-radius);
  }

  .defect-page__detail-intro > span {
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
    border-radius: var(--art-control-radius);
  }

  .defect-page__detail-intro > div {
    min-width: 0;
    margin-right: auto;
  }

  .defect-page__detail-intro small,
  .defect-page__detail-intro p {
    color: var(--el-text-color-secondary);
  }

  .defect-page__detail-intro p {
    margin: 2px 0 0;
  }

  @media (width <= 900px) {
    .defect-page__scope {
      height: 300px;
    }
  }
</style>
