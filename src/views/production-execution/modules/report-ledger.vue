<template>
  <ArtPermissionGuard :permission="viewPermission" :resource-name="title">
    <div class="report-ledger business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        :title="title"
        :description="description"
        :icon="icon"
        density="compact"
        refreshable
        :refresh-loading="loading"
        @refresh="loadRows"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtWorkspaceSplitter
        class="report-ledger__body"
        primary-size="270px"
        primary-min="240px"
        primary-max="360px"
        :breakpoint="900"
      >
        <template #primary>
          <aside class="report-ledger__scope"
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
        <div class="report-ledger__main">
          <div class="report-ledger__card">
            <ElAlert v-if="error" :title="error" type="error" show-icon :closable="false" />
            <div class="report-ledger__table"
              ><ArtTableQuery
                ref="tableRef"
                v-model="searchModel"
                :search-items="searchItems"
                :header-actions="headerActions"
                header-actions-placement="workspace"
                :table-header-props="{ layout: 'search,size,fullscreen,columns,settings' }"
                :search-bar-props="{
                  span: 5,
                  defaultExpanded: true,
                  resetLoading: resetting,
                  labelWidth: 66,
                  showExpand: false
                }"
                :data="visibleRows"
                :loading="loading"
                :pagination="{ current: page, size, total }"
                :table-props="{
                  rowKey: 'id',
                  tableLayout: 'fixed',
                  emptyHeight: '100%',
                  emptyText: '当前条件下暂无报工记录'
                }"
                focus-scope-selector=".report-ledger__body"
                focusable
                @search="applySearch"
                @reset="resetFilters"
                @pagination:current-change="page = $event"
                @pagination:size-change="size = $event"
              >
                <ElTableColumn type="index" label="序号" width="62" :index="rowIndex" />
                <ElTableColumn label="报工时间" width="158"
                  ><template #default="{ row }">{{
                    formatTime(row.reportedAt)
                  }}</template></ElTableColumn
                >
                <ElTableColumn label="开始加工" width="158"
                  ><template #default="{ row }">{{
                    formatTime(row.startedAt)
                  }}</template></ElTableColumn
                >
                <ElTableColumn label="生产工单 / 任务单" min-width="230"
                  ><template #default="{ row }"
                    ><button
                      type="button"
                      class="art-table__cell-link"
                      @click.stop="openDetail(row)"
                    >
                      <BusinessTableIdentityCell
                        :primary="row.task?.workOrder?.workOrderNo"
                        :secondary="row.task?.taskNo"
                        icon="ri:file-list-3-line"
                      /> </button></template
                ></ElTableColumn>
                <ElTableColumn label="工序 / 产品" min-width="210" show-overflow-tooltip
                  ><template #default="{ row }"
                    ><BusinessTableIdentityCell
                      :primary="`${row.task?.operationCode || '—'} · ${row.task?.operationName || '—'}`"
                      :secondary="`${row.task?.workOrder?.materialCodeSnapshot || '—'} ${row.task?.workOrder?.materialNameSnapshot || ''}`"
                    /> </template
                ></ElTableColumn>
                <ElTableColumn label="序列 / 类型" min-width="110">
                  <template #default="{ row }"
                    >{{ row.task?.sequenceNo ?? '—' }} /
                    {{ row.task?.sequenceType || '—' }}</template
                  >
                </ElTableColumn>
                <ElTableColumn label="规格 / 项目" min-width="190" show-overflow-tooltip>
                  <template #default="{ row }"
                    >{{ row.task?.workOrder?.specificationSnapshot || '—' }} /
                    {{ row.task?.workOrder?.projectNameSnapshot || '—' }}</template
                  >
                </ElTableColumn>
                <ElTableColumn
                  prop="workCenter.name"
                  label="工作中心"
                  min-width="126"
                  show-overflow-tooltip
                />
                <ElTableColumn label="实际机台" min-width="156" show-overflow-tooltip>
                  <template #default="{ row }">{{
                    row.equipmentId
                      ? row.task?.equipmentNameSnapshot || row.task?.equipmentCodeSnapshot || '—'
                      : '未分配机台'
                  }}</template>
                </ElTableColumn>
                <ElTableColumn prop="shiftName" label="班次" width="84" />
                <ElTableColumn label="工序计划" width="100" align="right">
                  <template #default="{ row }">{{ row.task?.plannedQuantity ?? '—' }}</template>
                </ElTableColumn>
                <ElTableColumn
                  v-if="mode === 'allocation'"
                  label="操作人员"
                  min-width="132"
                  show-overflow-tooltip
                  ><template #default="{ row }">{{
                    operatorNames(row.operatorPersonIds)
                  }}</template></ElTableColumn
                >
                <ElTableColumn v-if="mode === 'allocation'" label="人工用时" width="106"
                  ><template #default="{ row }"
                    >{{ laborHours(row).toFixed(2) }} h</template
                  ></ElTableColumn
                >
                <ElTableColumn label="良品" width="88" align="right"
                  ><template #default="{ row }">{{ row.goodQuantity }}</template></ElTableColumn
                >
                <ElTableColumn label="不良" width="88" align="right"
                  ><template #default="{ row }"
                    ><span class="report-ledger__bad">{{
                      row.processBadQuantity + row.materialBadQuantity
                    }}</span></template
                  ></ElTableColumn
                >
                <ElTableColumn v-if="mode === 'detail'" label="机器用时" width="108" align="right">
                  <template #default="{ row }">{{ machineHours(row).toFixed(2) }} h</template>
                </ElTableColumn>
                <ElTableColumn v-if="mode === 'detail'" label="良品率" width="88" align="right">
                  <template #default="{ row }">{{ goodRate(row) }}%</template>
                </ElTableColumn>
                <ElTableColumn
                  v-if="mode === 'allocation'"
                  label="备注"
                  min-width="150"
                  prop="remark"
                  show-overflow-tooltip
                />
                <ElTableColumn
                  label="报工人"
                  width="104"
                  prop="reporterName"
                  show-overflow-tooltip
                />
                <ElTableColumn label="状态" width="106"
                  ><template #default="{ row }"
                    ><ElTag size="small" :type="statusTone(row.status)" effect="plain">{{
                      statusLabel(row.status)
                    }}</ElTag></template
                  ></ElTableColumn
                >
                <ElTableColumn label="操作" fixed="right" :width="mode === 'approval' ? 188 : 104"
                  ><template #default="{ row }"
                    ><BusinessTableRowActions
                      ><ArtButtonTable type="view" @click="openDetail(row)" /><template
                        v-if="mode === 'approval' && row.status === 'pending'"
                        ><ArtButtonTable
                          type="edit"
                          label="修改"
                          permission="MesReportApproval:Edit"
                          @click="openEdit(row)"
                        />
                        <ArtButtonTable
                          type="delete"
                          label="驳回"
                          icon="ri:close-circle-line"
                          permission="MesReportApproval:Reject"
                          @click="reject(row)"
                        />
                        <ArtButtonTable
                          type="sign"
                          label="审批"
                          permission="MesReportApproval:Approve"
                          @click="approve(row)"
                        /> </template
                      ><ArtButtonTable
                        v-if="row.status === 'rejected'"
                        type="edit"
                        label="修改并提交"
                        icon="ri:send-plane-line"
                        permission="MesProductionReport:Report"
                        @click="resubmit(row)"
                      /> </BusinessTableRowActions></template
                ></ElTableColumn> </ArtTableQuery
            ></div>
          </div>
        </div>
      </ArtWorkspaceSplitter>
      <ArtDrawer ref="detailDrawerRef" size="lg" :show-footer="false"
        ><div v-if="detailReport" class="report-ledger__detail"
          ><div class="report-ledger__detail-intro"
            ><small
              >{{ detailReport.task?.workOrder?.workOrderNo }} /
              {{ detailReport.task?.taskNo }}</small
            ><h3>{{ detailReport.task?.operationCode }} · {{ detailReport.task?.operationName }}</h3
            ><ElTag :type="statusTone(detailReport.status)" effect="plain">{{
              statusLabel(detailReport.status)
            }}</ElTag></div
          ><ArtSectionTitle>生产任务</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem label="开始加工">{{
              formatTime(detailReport.startedAt)
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="报工时间">{{
              formatTime(detailReport.reportedAt)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="工作中心">{{
              detailReport.workCenter?.name || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="实际机台">{{
              detailReport.equipmentId
                ? `${detailReport.task?.equipmentCodeSnapshot || '—'} · ${detailReport.task?.equipmentNameSnapshot || '—'}`
                : '未分配机台'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="班次">{{
              detailReport.shiftName || '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="产品"
              >{{ detailReport.task?.workOrder?.materialCodeSnapshot }} ·
              {{ detailReport.task?.workOrder?.materialNameSnapshot }}</ElDescriptionsItem
            ><ElDescriptionsItem label="规格">{{
              detailReport.task?.workOrder?.specificationSnapshot || '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="项目">{{
              detailReport.task?.workOrder?.projectNameSnapshot || '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="图号">{{
              detailReport.task?.workOrder?.drawingNoSnapshot || '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="工序序列 / 类型"
              >{{ detailReport.task?.sequenceNo ?? '—' }} /
              {{ detailReport.task?.sequenceType || '—' }}</ElDescriptionsItem
            >
            <ElDescriptionsItem label="工单数量">{{
              detailReport.task?.workOrder?.orderQuantity ?? '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="要求完工日期">{{
              detailReport.task?.requiredCompletionDate || '—'
            }}</ElDescriptionsItem>
          </ElDescriptions>
          <ArtSectionTitle>产量与工时</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem label="标准时产能">{{
              formatCapacity(detailReport)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="计划数量">{{
              detailReport.task?.plannedQuantity ?? '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="良品数量">{{
              detailReport.goodQuantity
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="加工不良">{{
              detailReport.processBadQuantity
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="来料不良">{{
              detailReport.materialBadQuantity
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="机器用时"
              >{{ machineHours(detailReport).toFixed(2) }} h</ElDescriptionsItem
            ><ElDescriptionsItem label="人工用时"
              >{{ laborHours(detailReport).toFixed(2) }} h</ElDescriptionsItem
            >
            <ElDescriptionsItem label="机器计数">待接入设备采集</ElDescriptionsItem>
            <ElDescriptionsItem label="灯态 / OEE">待接入设备采集</ElDescriptionsItem>
            <ElDescriptionsItem label="良品率">{{ goodRate(detailReport) }}%</ElDescriptionsItem
            ><ElDescriptionsItem label="计划达成率"
              >{{ planRate(detailReport) }}%</ElDescriptionsItem
            >
          </ElDescriptions>
          <ArtSectionTitle>补偿与审批</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem label="补偿工时 / 原因" :span="detailColumns"
              >{{ detailReport.compensationHours }} h ·
              {{ detailReport.compensationReason || '—' }}</ElDescriptionsItem
            >
            <ElDescriptionsItem label="奖惩工时 / 原因" :span="detailColumns"
              >{{ detailReport.rewardPenaltyHours }} h ·
              {{ detailReport.rewardPenaltyReason || '—' }}</ElDescriptionsItem
            >
            <ElDescriptionsItem label="报工人">{{
              detailReport.reporterName || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="操作人员">{{
              operatorNames(detailReport.operatorPersonIds)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="审批人">{{
              detailReport.reviewerName || '—'
            }}</ElDescriptionsItem
            ><ElDescriptionsItem label="审批时间">{{
              formatTime(detailReport.reviewedAt)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem
              v-if="detailReport.rejectReason"
              label="驳回原因"
              :span="detailColumns"
              >{{ detailReport.rejectReason }}</ElDescriptionsItem
            >
            <ElDescriptionsItem label="备注" :span="detailColumns">{{
              detailReport.remark || '—'
            }}</ElDescriptionsItem> </ElDescriptions
          ><ArtSectionTitle v-if="detailReport.defects?.length">不良原因</ArtSectionTitle
          ><div
            v-for="defect in detailReport.defects"
            :key="defect.id"
            class="report-ledger__defect"
            ><span
              >{{ defect.category === 'process' ? '加工不良' : '来料不良' }} ·
              {{ defect.reason?.code }} {{ defect.reason?.name }}</span
            ><strong>{{ defect.quantity }}</strong></div
          ><ArtSectionTitle v-if="detailReport.media?.length">现场附件</ArtSectionTitle
          ><div v-if="detailReport.media?.length" class="report-ledger__media"
            ><a
              v-for="(url, index) in detailReport.media"
              :key="url"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              ><ArtSvgIcon icon="ri:attachment-2" />附件 {{ index + 1 }}</a
            ></div
          ></div
        ></ArtDrawer
      >
      <ProductionReportForm ref="formRef" @saved="loadRows" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { uniq } from 'lodash-es'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import { ElMessage } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtTableQuery from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import type { ArtTableQueryHeaderAction } from '@/components/core/tables/art-table-query/index.vue'
  import ProductionWorkCenterNavigator from '@/components/business/production-work-center-navigator/index.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { exportExcel } from '@/utils/file'
  import {
    fetchExecutionPeople,
    fetchProductionReports,
    fetchProductionReportShiftNames,
    reviewProductionReport,
    type MesExecutionPerson,
    type MesProductionReport
  } from '@mes/api'
  import { useExecutionScope } from './use-execution-scope'
  import ProductionReportForm from './production-report-form.vue'

  const mesReportApprovalStatusOptions = useDictionaryOptions('mesReportApprovalStatus')

  type Mode = 'detail' | 'allocation' | 'approval'
  const { confirmAction, promptReason } = useArtFeedback()
  const props = defineProps<{ mode: Mode }>()
  const config = {
    detail: {
      title: '报工明细',
      description: '查看工序产量、人员、工时与审批结果。',
      icon: 'ri:file-list-3-line',
      permission: 'MesReportDetail'
    },
    allocation: {
      title: '报工分配',
      description: '按报工记录查看参与人员与人工用时分配。',
      icon: 'ri:group-line',
      permission: 'MesReportAllocation'
    },
    approval: {
      title: '报工审批',
      description: '核对、修改、驳回或批准待审报工。',
      icon: 'ri:checkbox-circle-line',
      permission: 'MesReportApproval'
    }
  }
  const title = computed(() => config[props.mode].title)
  const description = computed(() => config[props.mode].description)
  const icon = computed(() => config[props.mode].icon)
  const viewPermission = computed(() => `${config[props.mode].permission}:View`)
  const exportPermission = computed(() => `${config[props.mode].permission}:Export`)
  const {
    scope,
    effectiveTenantId,
    workshopOptions,
    visibleCenters,
    loadScope,
    selectWorkshop,
    selectWorkCenter
  } = useExecutionScope()
  const dateRange = ref<[string, string] | null>([
    dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD')
  ])
  const statuses = ref<string[]>([])
  const shiftName = ref('')
  const keyword = ref('')
  const tableRef = ref<ArtTableQueryExpose>()
  const compactDetail = useMediaQuery('(max-width: 640px)')
  const detailColumns = computed(() => (compactDetail.value ? 1 : 2))
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    { type: 'export', permission: exportPermission.value, onClick: () => exportRows() }
  ])
  const searchModel = ref<Record<string, unknown>>({
    dateRange: dateRange.value,
    shiftName: '',
    statuses: [],
    keyword: ''
  })
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'dateRange',
      label: '日期',
      type: 'daterange',
      span: 6,
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      key: 'shiftName',
      label: '班次',
      type: 'select',
      span: 4,
      props: {
        clearable: true,
        placeholder: '全部班次',
        options: shifts.value.map((value) => ({ label: value, value }))
      }
    },
    {
      key: 'statuses',
      label: '状态',
      type: 'select',
      span: 4,
      props: {
        clearable: true,
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        placeholder: '全部状态',
        options: mesReportApprovalStatusOptions
      }
    },
    {
      key: 'keyword',
      label: '关键字',
      type: 'input',
      span: 6,
      props: { clearable: true, placeholder: '任务、工单、物料、项目或报工人' }
    }
  ])
  function applySearch(params: Record<string, unknown>) {
    dateRange.value =
      Array.isArray(params.dateRange) && params.dateRange.length === 2
        ? [String(params.dateRange[0]), String(params.dateRange[1])]
        : null
    shiftName.value = String(params.shiftName || '')
    statuses.value = Array.isArray(params.statuses) ? params.statuses.map(String) : []
    keyword.value = String(params.keyword || '')
    if (page.value !== 1) page.value = 1
    else void loadRows()
  }
  const rows = ref<MesProductionReport[]>([])
  const people = ref<MesExecutionPerson[]>([])
  const shiftOptions = ref<string[]>([])
  const page = ref(1)
  const size = ref(20)
  const total = ref(0)
  const loading = ref(false)
  const resetting = ref(false)
  const error = ref('')
  const detailReport = ref<MesProductionReport | null>(null)
  const detailDrawerRef = ref<ArtDrawerExpose<MesProductionReport>>()
  const formRef = ref<InstanceType<typeof ProductionReportForm>>()
  const shifts = computed(() =>
    uniq([...shiftOptions.value, ...rows.value.map((row) => row.shiftName)].filter(Boolean))
  )
  const visibleRows = computed(() => rows.value)
  const rowIndex = (index: number) => (page.value - 1) * size.value + index + 1
  const formatTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const statusLabel = (value: string) =>
    (({ pending: '待审批', approved: '已审批', rejected: '已驳回' }) as Record<string, string>)[
      value
    ] || value
  const statusTone = (value: string) =>
    value === 'approved' ? 'success' : value === 'rejected' ? 'danger' : 'warning'
  const operatorNames = (ids: string[]) =>
    ids.map((id) => people.value.find((person) => person.id === id)?.name || id).join('、') || '—'
  const machineHours = (raw: unknown) => {
    const row = raw as MesProductionReport
    return Math.max(0, dayjs(row.reportedAt).diff(dayjs(row.startedAt)) / 3600000)
  }
  const laborHours = (raw: unknown) => {
    const row = raw as MesProductionReport
    return machineHours(row) * row.operatorPersonIds.length
  }
  const goodRate = (raw: unknown) => {
    const row = raw as MesProductionReport
    const total = row.goodQuantity + row.processBadQuantity + row.materialBadQuantity
    return total ? Math.round((row.goodQuantity / total) * 100) : 0
  }
  const planRate = (raw: unknown) => {
    const row = raw as MesProductionReport
    return row.task?.plannedQuantity
      ? Math.round((row.goodQuantity / row.task.plannedQuantity) * 100)
      : 0
  }
  const standardHourlyCapacity = (row: MesProductionReport) => {
    const step = row.task?.workOrder?.routeSnapshot?.steps?.find(
      (item) => item.id === row.task?.routeStepSnapshotId || item.code === row.task?.operationCode
    )
    const minutes = Number(step?.run_processing_minutes || 0)
    const quantity = Number(step?.run_output_quantity || 0)
    return minutes > 0 && quantity > 0 ? (quantity * 60) / minutes : null
  }
  const formatCapacity = (raw: unknown) => {
    const row = raw as MesProductionReport
    const value = standardHourlyCapacity(row)
    return value === null
      ? '—'
      : `${value.toFixed(2)} ${row.task?.workOrder?.unitSnapshot || '单位'}/h`
  }

  let loadVersion = 0
  async function loadRows() {
    const version = ++loadVersion
    loading.value = true
    rows.value = []
    total.value = 0
    error.value = ''
    try {
      const result = await fetchProductionReports({
        current: page.value,
        size: size.value,
        tenantId: effectiveTenantId.value,
        workCenterId: scope.selectedWorkCenterId || undefined,
        workCenterIds:
          scope.selectedWorkshopId && !scope.selectedWorkCenterId
            ? visibleCenters.value.map((item) => item.id)
            : undefined,
        dateRange: dateRange.value || undefined,
        statuses: statuses.value,
        keyword: keyword.value,
        shiftName: shiftName.value
      })
      if (version !== loadVersion) return
      rows.value = result.data
      total.value = result.total
      if (detailReport.value)
        detailReport.value =
          result.data.find((item) => item.id === detailReport.value?.id) || detailReport.value
    } catch {
      if (version === loadVersion) error.value = '报工记录加载失败，请重试'
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }
  async function resetFilters() {
    if (resetting.value) return
    resetting.value = true
    dateRange.value = [
      dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD')
    ]
    statuses.value = []
    shiftName.value = ''
    keyword.value = ''
    page.value = 1
    await nextTick()
    try {
      await loadRows()
    } finally {
      resetting.value = false
    }
  }
  function openDetail(raw: unknown) {
    detailReport.value = raw as MesProductionReport
    detailDrawerRef.value?.handleOpen(detailReport.value, { title: '报工详情' })
  }
  function openEdit(raw: unknown) {
    const report = raw as MesProductionReport
    if (report.task) formRef.value?.open(report.task, people.value, report)
  }
  async function approve(raw: unknown) {
    const report = raw as MesProductionReport
    try {
      await confirmAction(`确认审批报工 ${report.task?.taskNo || ''}？审批后计入工序完成数量。`, {
        title: '审批报工'
      })
      await reviewProductionReport(report.id, 'approve')
      await loadRows()
    } catch {
      /* cancel or shared API error */
    }
  }
  async function reject(raw: unknown) {
    const report = raw as MesProductionReport
    try {
      const reason = await promptReason('请填写驳回原因，报工人可修改后重新提交。', '驳回报工', {
        emptyMessage: '请填写驳回原因'
      })
      await reviewProductionReport(report.id, 'reject', { reason })
      await loadRows()
    } catch {
      /* cancel or shared API error */
    }
  }
  function resubmit(raw: unknown) {
    const report = raw as MesProductionReport
    if (report.task) formRef.value?.open(report.task, people.value, report)
  }
  async function exportRows() {
    try {
      const result = await fetchProductionReports({
        current: 1,
        size: 10000,
        tenantId: effectiveTenantId.value,
        workCenterId: scope.selectedWorkCenterId || undefined,
        workCenterIds:
          scope.selectedWorkshopId && !scope.selectedWorkCenterId
            ? visibleCenters.value.map((item) => item.id)
            : undefined,
        dateRange: dateRange.value || undefined,
        statuses: statuses.value,
        keyword: keyword.value,
        shiftName: shiftName.value
      })
      if (!result.data.length) {
        ElMessage.info('当前条件下没有可导出的记录')
        return
      }
      if (result.total > 10000) {
        ElMessage.warning('记录超过 10000 条，请缩小筛选范围')
        return
      }
      await exportExcel({
        data: result.data.map((row) => ({
          reportedAt: formatTime(row.reportedAt),
          startedAt: formatTime(row.startedAt),
          workOrder: row.task?.workOrder?.workOrderNo || '',
          taskNo: row.task?.taskNo || '',
          sequenceNo: row.task?.sequenceNo ?? '',
          sequenceType: row.task?.sequenceType || '',
          operation: `${row.task?.operationCode || ''} ${row.task?.operationName || ''}`,
          material: row.task?.workOrder?.materialCodeSnapshot || '',
          materialName: row.task?.workOrder?.materialNameSnapshot || '',
          specification: row.task?.workOrder?.specificationSnapshot || '',
          project: row.task?.workOrder?.projectNameSnapshot || '',
          workCenter: row.workCenter?.name || '',
          equipment: row.equipmentId
            ? `${row.task?.equipmentCodeSnapshot || ''} ${row.task?.equipmentNameSnapshot || ''}`.trim()
            : '未分配机台',
          shift: row.shiftName,
          orderQuantity: row.task?.workOrder?.orderQuantity ?? '',
          plannedQuantity: row.task?.plannedQuantity ?? '',
          good: row.goodQuantity,
          processBad: row.processBadQuantity,
          materialBad: row.materialBadQuantity,
          machineHours: machineHours(row).toFixed(2),
          laborHours: laborHours(row).toFixed(2),
          standardHourlyCapacity: standardHourlyCapacity(row)?.toFixed(2) ?? '',
          goodRate: `${goodRate(row)}%`,
          planRate: `${planRate(row)}%`,
          compensationHours: row.compensationHours,
          compensationReason: row.compensationReason,
          rewardPenaltyHours: row.rewardPenaltyHours,
          rewardPenaltyReason: row.rewardPenaltyReason,
          operators: operatorNames(row.operatorPersonIds),
          reporter: row.reporterName,
          status: statusLabel(row.status),
          mediaCount: row.media?.length || 0,
          remark: row.remark
        })),
        columns: [
          { key: 'reportedAt', title: '报工时间' },
          { key: 'startedAt', title: '开始时间' },
          { key: 'workOrder', title: '生产工单' },
          { key: 'taskNo', title: '任务单号' },
          { key: 'sequenceNo', title: '工序序列' },
          { key: 'sequenceType', title: '序列类型' },
          { key: 'operation', title: '工序' },
          { key: 'material', title: '物料编码' },
          { key: 'materialName', title: '物料描述' },
          { key: 'specification', title: '规格型号' },
          { key: 'project', title: '项目名称' },
          { key: 'workCenter', title: '工作中心' },
          { key: 'equipment', title: '实际机台' },
          { key: 'shift', title: '班次' },
          { key: 'orderQuantity', title: '工单数量' },
          { key: 'plannedQuantity', title: '工序计划数量' },
          { key: 'good', title: '良品数量' },
          { key: 'processBad', title: '加工不良' },
          { key: 'materialBad', title: '来料不良' },
          { key: 'machineHours', title: '机器用时(h)' },
          { key: 'laborHours', title: '人工用时(h)' },
          { key: 'standardHourlyCapacity', title: '标准时产能(件/h)' },
          { key: 'goodRate', title: '良品率' },
          { key: 'planRate', title: '计划达成率' },
          { key: 'compensationHours', title: '补偿工时(h)' },
          { key: 'compensationReason', title: '补偿原因' },
          { key: 'rewardPenaltyHours', title: '奖惩工时(h)' },
          { key: 'rewardPenaltyReason', title: '奖惩原因' },
          { key: 'operators', title: '操作人员' },
          { key: 'reporter', title: '报工人' },
          { key: 'status', title: '审批状态' },
          { key: 'mediaCount', title: '附件数量' },
          { key: 'remark', title: '备注' }
        ],
        filename: `${title.value}-${dayjs().format('YYYYMMDD')}`
      })
    } catch {
      ElMessage.error('导出失败，请缩小筛选范围后重试')
    }
  }
  watch(
    [
      () => scope.selectedWorkCenterId,
      () => scope.selectedWorkshopId,
      effectiveTenantId,
      page,
      size
    ],
    () => {
      if (!resetting.value) void loadRows()
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
  let shiftVersion = 0
  watch(
    [effectiveTenantId, dateRange],
    async () => {
      const version = ++shiftVersion
      try {
        const next = await fetchProductionReportShiftNames(effectiveTenantId.value, dateRange.value)
        if (version === shiftVersion) shiftOptions.value = next
      } catch {
        if (version === shiftVersion) shiftOptions.value = []
      }
    },
    { immediate: true, deep: true }
  )
  onMounted(() => {
    void loadRows()
  })
</script>

<style scoped lang="scss">
  .report-ledger {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .report-ledger__body {
    flex: 1;
  }

  .report-ledger__scope,
  .report-ledger__main {
    min-width: 0;
    min-height: 0;
  }

  .report-ledger__main {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .report-ledger__card {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
  }

  .report-ledger__table {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .report-ledger__table :deep(.art-table-query) {
    flex: 1;
    min-height: 0;
  }

  .report-ledger__bad {
    font-weight: 700;
    color: var(--el-color-danger);
  }

  .report-ledger__detail {
    display: grid;
    gap: 16px;
  }

  .report-ledger__detail-intro {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 15px;
    background: var(--art-gray-100);
    border-radius: var(--custom-radius);
  }

  .report-ledger__detail-intro small {
    color: var(--el-text-color-secondary);
  }

  .report-ledger__detail-intro h3 {
    margin: 0 auto 0 0;
    color: var(--el-text-color-primary);
  }

  .report-ledger__defect {
    display: flex;
    justify-content: space-between;
    padding: 9px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .report-ledger__defect strong {
    color: var(--el-color-danger);
  }

  .report-ledger__media {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .report-ledger__media a {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 8px 10px;
    color: var(--theme-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--custom-radius);
  }
</style>
