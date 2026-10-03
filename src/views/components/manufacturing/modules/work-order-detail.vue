<template>
  <div class="work-order-detail">
    <section v-for="section in sections" :key="section.title" class="work-order-detail__section">
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
</template>

<script setup lang="ts">
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import type { MesReferenceOption, MesReferences, MesWorkOrder } from '@mes/api'
  import WorkOrderUrgencyLabel from './work-order-urgency-label.vue'
  import { workOrderStatusMeta } from './work-order-status'

  const props = defineProps<{
    record: MesWorkOrder
    references: MesReferences
    tenantOptions: Array<{ label: string; value: string }>
  }>()

  const referenceName = (items: MesReferenceOption[], id: unknown): string =>
    items.find((item) => item.id === id)?.name || '—'

  const employeeName = (id: unknown): string => referenceName(props.references.employees, id)

  const sections = computed<Array<{ title: string; items: ArtDescriptionItem<MesWorkOrder>[] }>>(
    () => [
      {
        title: '工单识别',
        items: [
          {
            key: 'tenantId',
            label: '所属租户',
            field: 'tenantId',
            formatter: (value) =>
              props.tenantOptions.find((item) => item.value === value)?.label || '当前租户'
          },
          { key: 'workOrderNo', label: '工单编号', field: 'workOrderNo', copyable: true },
          {
            key: 'workOrderTypeId',
            label: '工单类型',
            field: 'workOrderTypeId',
            formatter: (value) => referenceName(props.references.documentTypes, value)
          },
          {
            key: 'projectId',
            label: '项目',
            field: 'projectId',
            formatter: (value, row) => {
              const reference = referenceName(props.references.projects, value)
              return reference === '—' ? row.projectNameSnapshot || '—' : reference
            }
          },
          { key: 'constructionNo', label: '施工编号', field: 'constructionNo' },
          {
            key: 'orderStatus',
            label: '工单状态',
            field: 'orderStatus',
            formatter: (_value, row) => workOrderStatusMeta[row.orderStatus]?.label || '—'
          },
          { key: 'statusReason', label: '状态说明', field: 'statusReason', span: 2 }
        ]
      },
      {
        title: '产品与计划',
        items: [
          { key: 'materialCodeSnapshot', label: '物料编码', field: 'materialCodeSnapshot' },
          { key: 'materialDescription', label: '物料描述', field: 'materialDescription' },
          { key: 'specificationSnapshot', label: '规格型号', field: 'specificationSnapshot' },
          { key: 'drawingNoSnapshot', label: '图号', field: 'drawingNoSnapshot' },
          { key: 'unitSnapshot', label: '生产单位', field: 'unitSnapshot' },
          { key: 'plannerNameSnapshot', label: '计划员', field: 'plannerNameSnapshot' },
          { key: 'dispatcherNameSnapshot', label: '调度员', field: 'dispatcherNameSnapshot' },
          {
            key: 'inboundWarehouseNameSnapshot',
            label: '入库仓库',
            field: 'inboundWarehouseNameSnapshot'
          },
          {
            key: 'isInitialDocument',
            label: '初始化单据',
            field: 'isInitialDocument',
            formatter: (value) => (value ? '是' : '否')
          },
          {
            key: 'orderQuantity',
            label: '工单数量',
            field: 'orderQuantity',
            formatter: (value) => Number(value).toFixed(2)
          },
          {
            key: 'specificationQuantity',
            label: '规格数量',
            field: 'specificationQuantity',
            format: 'number'
          },
          { key: 'plannedStartDate', label: '计划开始', field: 'plannedStartDate', format: 'date' },
          { key: 'plannedEndDate', label: '计划结束', field: 'plannedEndDate', format: 'date' },
          {
            key: 'productionDaysSnapshot',
            label: '生产天数',
            field: 'productionDaysSnapshot',
            formatter: (value, row) =>
              `${value ?? 0} 天（固定 ${row.productionFixedLeadDaysSnapshot ?? 0} + 前处理 ${row.productionPreprocessDaysSnapshot ?? 0} + 自制 ${row.selfMadeProductionDaysSnapshot ?? 0} + 后处理 ${row.productionPostprocessDaysSnapshot ?? 0}）`
          },
          {
            key: 'schedulingPriority',
            label: '排产优先级',
            field: 'schedulingPriority',
            format: 'number'
          },
          {
            key: 'schedulingStrategySnapshot',
            label: '排产方向',
            field: 'schedulingStrategySnapshot',
            formatter: (value) => (value === 'backward' ? '反向排产' : '正向排产')
          },
          {
            key: 'planningTimeFenceDaysSnapshot',
            label: '计划冻结期',
            field: 'planningTimeFenceDaysSnapshot',
            formatter: (value) => `${value ?? 0} 天`
          },
          {
            key: 'scheduleLocked',
            label: '排产锁定',
            field: 'scheduleLocked',
            formatter: (value) => (value ? '已锁定' : '未锁定')
          },
          {
            key: 'lastScheduledAt',
            label: '最近自动排产',
            field: 'lastScheduledAt',
            format: 'datetime'
          },
          {
            key: 'source',
            label: '工单来源',
            field: 'source',
            dictCode: 'mesWorkOrderSource',
            dictDisplay: 'text'
          },
          {
            key: 'urgency',
            label: '紧急程度',
            field: 'urgency',
            render: (_value, row) => h(WorkOrderUrgencyLabel, { urgency: row.urgency })
          },
          {
            key: 'completedQuantity',
            label: '完工数量',
            field: 'completedQuantity',
            format: 'number'
          },
          {
            key: 'warehousedQuantity',
            label: '入库数量',
            field: 'warehousedQuantity',
            format: 'number'
          }
        ]
      },
      {
        title: '销售协同与补充',
        items: [
          {
            key: 'customerCode',
            label: '客户',
            field: 'customerCode',
            formatter: (value) =>
              props.references.customers.find((item) => item.code === value)?.name ||
              String(value || '—')
          },
          { key: 'salesOrderNo', label: '销售订单号', field: 'salesOrderNo' },
          {
            key: 'salesOrderQuantity',
            label: '销售数量',
            field: 'salesOrderQuantity',
            format: 'number'
          },
          {
            key: 'merchandiserId',
            label: '跟单员',
            field: 'merchandiserId',
            formatter: employeeName
          },
          {
            key: 'salespersonId',
            label: '业务员',
            field: 'salespersonId',
            formatter: employeeName
          },
          { key: 'trackingNo', label: '跟踪号', field: 'trackingNo' },
          { key: 'followNo', label: '跟随号', field: 'followNo' },
          { key: 'customProcessCode', label: '定制工艺编号', field: 'customProcessCode' },
          { key: 'specialRequirement', label: '特殊要求', field: 'specialRequirement', span: 2 },
          { key: 'remark', label: '备注', field: 'remark', span: 2 },
          { key: 'confirmedAt', label: '确认时间', field: 'confirmedAt', format: 'datetime' },
          { key: 'closedAt', label: '结案时间', field: 'closedAt', format: 'datetime' },
          { key: 'printCount', label: '打印次数', field: 'printCount', format: 'number' },
          { key: 'updateTime', label: '更新时间', field: 'updateTime', format: 'datetime' }
        ]
      }
    ]
  )
</script>

<style scoped lang="scss">
  .work-order-detail {
    display: grid;
    gap: 22px;

    &__section {
      min-width: 0;
    }

    :deep(.el-descriptions__label) {
      width: 132px;
    }
  }
</style>
