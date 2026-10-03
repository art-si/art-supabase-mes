<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="task-detail">
      <ArtEntitySummary
        icon="ri:git-merge-line"
        eyebrow="OPERATION TASK"
        :title="record.operationName || '工序任务'"
        :description="`${record.taskNo || '—'} · ${record.workOrder?.workOrderNo || '未关联生产工单'}`"
      />

      <section v-for="section in sections" :key="section.title" class="task-detail__section">
        <ArtSectionTitle :title="section.title" />
        <ArtDescriptions
          :data="record"
          :items="section.items"
          :columns="2"
          :tablet-columns="2"
          :mobile-columns="1"
          empty-text="—"
        />
      </section>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import type { MesOperationTask, MesReferenceOption } from '@mes/api'

  export interface TaskDetailDialogOpenData {
    row: MesOperationTask
    workCenters: MesReferenceOption[]
  }

  const dialogRef = ref<ArtDialogExpose<TaskDetailDialogOpenData>>()
  const record = ref<MesOperationTask>({} as MesOperationTask)
  const workCenters = ref<MesReferenceOption[]>([])
  const sections = computed<
    Array<{ title: string; items: ArtDescriptionItem<MesOperationTask>[] }>
  >(() => [
    {
      title: '任务识别',
      items: [
        {
          key: 'taskNo',
          label: '任务单号',
          field: 'taskNo',
          copyable: true
        },
        {
          key: 'workOrderNo',
          label: '生产工单',
          value: (row: MesOperationTask) => row.workOrder?.workOrderNo,
          copyable: true
        },
        {
          key: 'workOrderType',
          label: '工单类型',
          value: (row: MesOperationTask) => row.workOrder?.workOrderTypeNameSnapshot
        },
        {
          key: 'projectName',
          label: '项目名称',
          value: (row: MesOperationTask) => row.workOrder?.projectNameSnapshot
        },
        {
          key: 'constructionNo',
          label: '施工号',
          value: (row: MesOperationTask) => row.workOrder?.constructionNo
        },
        {
          key: 'material',
          label: '产品编码',
          value: (row: MesOperationTask) => row.workOrder?.materialCodeSnapshot
        },
        {
          key: 'materialName',
          label: '品名 / 规格型号',
          value: (row: MesOperationTask) =>
            [row.workOrder?.materialNameSnapshot, row.workOrder?.specificationSnapshot]
              .filter(Boolean)
              .join(' · '),
          span: 2
        },
        { key: 'sequenceNo', label: '工序序列', field: 'sequenceNo', format: 'number' },
        {
          key: 'sequenceType',
          label: '序列类型',
          field: 'sequenceType',
          dictCode: 'mdmProcessRouteSequenceType',
          dictDisplay: 'text'
        },
        { key: 'operationCode', label: '工序号', field: 'operationCode', copyable: true },
        { key: 'operationName', label: '工序名称', field: 'operationName' },
        {
          key: 'controlCode',
          label: '工序控制码',
          value: (row: MesOperationTask) =>
            [row.controlCodeSnapshot, row.controlCodeNameSnapshot].filter(Boolean).join(' · ')
        },
        {
          key: 'operationStatus',
          label: '工序状态',
          field: 'operationStatus',
          dictCode: 'mesOperationStatus',
          dictDisplay: 'tag'
        },
        {
          key: 'schedulingStatus',
          label: '排产状态',
          field: 'schedulingStatus',
          dictCode: 'mesOperationTaskScheduleStatus',
          dictDisplay: 'tag'
        },
        {
          key: 'urgency',
          label: '加急状态',
          field: 'urgency',
          dictCode: 'mesWorkOrderUrgency',
          dictDisplay: 'tag'
        },
        {
          key: 'workCenterId',
          label: '工作中心',
          field: 'workCenterId',
          formatter: (value) =>
            record.value.workCenter?.name ||
            workCenters.value.find((item) => item.id === value)?.name ||
            '待排产'
        },
        {
          key: 'department',
          label: '生产车间',
          value: (row: MesOperationTask) => row.department?.name
        }
      ]
    },
    {
      title: '排产与数量',
      items: [
        { key: 'plannedQuantity', label: '工序数量', field: 'plannedQuantity', format: 'number' },
        { key: 'operationUnit', label: '工序单位', field: 'operationUnit' },
        {
          key: 'pendingScheduleQuantity',
          label: '待排产数量',
          field: 'pendingScheduleQuantity',
          format: 'number'
        },
        {
          key: 'scheduledQuantity',
          label: '已排产数量',
          field: 'scheduledQuantity',
          format: 'number'
        },
        { key: 'plannedStartDate', label: '计划开始', field: 'plannedStartDate', format: 'date' },
        { key: 'plannedEndDate', label: '计划结束', field: 'plannedEndDate', format: 'date' },
        {
          key: 'requiredStartDate',
          label: '工序要求开工日期',
          field: 'requiredStartDate',
          format: 'date'
        },
        {
          key: 'requiredCompletionDate',
          label: '工序要求完工日期',
          field: 'requiredCompletionDate',
          format: 'date'
        },
        {
          key: 'workOrderDates',
          label: '工单起止日期',
          value: (row: MesOperationTask) =>
            `${row.workOrder?.plannedStartDate || '—'} — ${row.workOrder?.plannedEndDate || '—'}`
        },
        {
          key: 'setupMinutes',
          label: '调机时长',
          field: 'setupMinutes',
          formatter: (value) => `${value ?? 0} 分钟`
        },
        {
          key: 'processingMinutes',
          label: '加工时长',
          field: 'processingMinutes',
          formatter: (value) => `${value ?? 0} 分钟`
        },
        {
          key: 'queueMinutes',
          label: '排队时长',
          field: 'queueMinutes',
          formatter: (value) => `${value ?? 0} 分钟`
        },
        {
          key: 'transferMinutes',
          label: '转运时长',
          field: 'transferMinutes',
          formatter: (value) => `${value ?? 0} 分钟`
        },
        {
          key: 'estimatedWorkMinutes',
          label: '预计总工时',
          field: 'estimatedWorkMinutes',
          formatter: (value) => `${value ?? 0} 分钟`
        },
        {
          key: 'scheduleSource',
          label: '排产来源',
          field: 'scheduleSource',
          formatter: (value) => (value === 'rule' ? '规则自动排产' : '人工排产')
        },
        { key: 'scheduleVersion', label: '排产版本', field: 'scheduleVersion', format: 'number' },
        {
          key: 'scheduleLocked',
          label: '任务锁定',
          field: 'scheduleLocked',
          formatter: (value) => (value ? '已锁定' : '未锁定')
        }
      ]
    },
    {
      title: '执行反馈（后续业务反填）',
      items: [
        {
          key: 'completedQuantity',
          label: '完工数量',
          field: 'completedQuantity',
          format: 'number'
        },
        {
          key: 'cumulativeCompletedQuantity',
          label: '累计完工数量',
          field: 'cumulativeCompletedQuantity',
          format: 'number'
        },
        {
          key: 'qualifiedQuantity',
          label: '合格数量',
          field: 'qualifiedQuantity',
          format: 'number'
        },
        {
          key: 'cumulativeQualifiedQuantity',
          label: '累计合格数量',
          field: 'cumulativeQualifiedQuantity',
          format: 'number'
        },
        {
          key: 'unqualifiedQuantity',
          label: '不合格数量',
          field: 'unqualifiedQuantity',
          format: 'number'
        },
        {
          key: 'cumulativeUnqualifiedQuantity',
          label: '累计不合格数量',
          field: 'cumulativeUnqualifiedQuantity',
          format: 'number'
        },
        { key: 'scrapQuantity', label: '工废数量', field: 'scrapQuantity', format: 'number' },
        {
          key: 'cumulativeScrapQuantity',
          label: '累计工废数量',
          field: 'cumulativeScrapQuantity',
          format: 'number'
        },
        {
          key: 'pendingReworkQuantity',
          label: '待返工数量',
          field: 'pendingReworkQuantity',
          format: 'number'
        },
        {
          key: 'pendingInspectionQuantity',
          label: '待检数量',
          field: 'pendingInspectionQuantity',
          format: 'number'
        }
      ]
    },
    {
      title: '工单来源与业务备注',
      items: [
        {
          key: 'source',
          label: '工单来源',
          value: (row: MesOperationTask) => row.workOrder?.source,
          dictCode: 'mesWorkOrderSource',
          dictDisplay: 'text'
        },
        {
          key: 'trackingNo',
          label: '计划跟踪号',
          value: (row: MesOperationTask) => row.workOrder?.trackingNo
        },
        {
          key: 'followNo',
          label: '跟单号',
          value: (row: MesOperationTask) => row.workOrder?.followNo
        },
        {
          key: 'salesOrderNo',
          label: '销售单号',
          value: (row: MesOperationTask) => row.workOrder?.salesOrderNo
        },
        {
          key: 'customerCode',
          label: '客户代码',
          value: (row: MesOperationTask) => row.workOrder?.customerCode
        },
        {
          key: 'workOrderRemark',
          label: '工单备注',
          value: (row: MesOperationTask) => row.workOrder?.remark,
          span: 2
        },
        {
          key: 'specialRequirement',
          label: '客制特殊需求',
          value: (row: MesOperationTask) => row.workOrder?.specialRequirement,
          span: 2
        },
        { key: 'processContent', label: '工艺内容', field: 'processContent', span: 2 },
        { key: 'remark', label: '工序备注', field: 'remark', span: 2 },
        { key: 'annotation', label: '工序批注', field: 'annotation', span: 2 }
      ]
    },
    {
      title: '追溯标识',
      items: [
        { key: 'barcodeValue', label: '工序条码', field: 'barcodeValue', copyable: true },
        { key: 'qrCodeValue', label: '工序二维码', field: 'qrCodeValue', copyable: true },
        { key: 'createTime', label: '工序创建日期', field: 'createTime', format: 'datetime' },
        { key: 'closedAt', label: '关闭时间', field: 'closedAt', format: 'datetime' },
        { key: 'updateTime', label: '更新时间', field: 'updateTime', format: 'datetime' }
      ]
    }
  ])

  async function handleOpen(data: TaskDetailDialogOpenData): Promise<void> {
    record.value = data.row
    workCenters.value = data.workCenters
    await dialogRef.value?.handleOpen(data, {
      title: '工序任务详情',
      subtitle: data.row.workOrder?.workOrderNo || data.row.operationCode,
      showFooter: false,
      contentMaxHeight: '72vh'
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .task-detail {
    display: grid;
    gap: 22px;

    :deep(.el-descriptions__label) {
      width: 132px;
    }
  }
</style>
