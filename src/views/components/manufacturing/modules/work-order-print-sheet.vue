<template>
  <Teleport to="body">
    <div class="work-order-print-batch" aria-hidden="true">
      <article v-for="order in orders" :key="order.id" class="work-order-print-sheet">
        <header class="work-order-print-sheet__header">
          <img :src="logo" alt="亿企工场" width="92" height="26" />
          <h1>生产作业指令单</h1>
          <div class="work-order-print-sheet__qr">
            <QrcodeVue :value="workOrderQrValue(order)" :size="38" level="M" />
            <span>工单二维码</span>
          </div>
        </header>

        <section class="work-order-print-sheet__meta" aria-label="生产工单信息">
          <dl>
            <div
              ><dt>工单号</dt><dd>{{ order.workOrderNo }}</dd></div
            >
            <div
              ><dt>物料号</dt><dd>{{ order.materialCodeSnapshot }}</dd></div
            >
            <div
              ><dt>物料描述</dt
              ><dd>{{ order.materialDescription || order.materialNameSnapshot }}</dd></div
            >
            <div
              ><dt>数量</dt
              ><dd>{{ quantity(order.orderQuantity) }} {{ order.unitSnapshot }}</dd></div
            >
            <div
              ><dt>计划员</dt><dd>{{ order.plannerNameSnapshot || '—' }}</dd></div
            >
            <div
              ><dt>仓库</dt><dd>{{ order.inboundWarehouseNameSnapshot || '—' }}</dd></div
            >
            <div
              ><dt>说明</dt><dd>{{ order.remark || '—' }}</dd></div
            >
          </dl>
          <dl>
            <div
              ><dt>项目名称</dt><dd>{{ order.projectNameSnapshot || '—' }}</dd></div
            >
            <div
              ><dt>工单类型</dt><dd>{{ order.workOrderTypeNameSnapshot || '—' }}</dd></div
            >
            <div
              ><dt>规格型号</dt><dd>{{ order.specificationSnapshot || '—' }}</dd></div
            >
            <div
              ><dt>跟踪号</dt><dd>{{ order.trackingNo || '—' }}</dd></div
            >
            <div
              ><dt>跟单号</dt><dd>{{ order.followNo || '—' }}</dd></div
            >
            <div
              ><dt>销售订单</dt><dd>{{ order.salesOrderNo || '—' }}</dd></div
            >
            <div
              ><dt>工艺路线</dt><dd>{{ order.routeSnapshot?.name || '—' }}</dd></div
            >
          </dl>
          <dl>
            <div><dt>原件</dt><dd>1/1</dd></div>
            <div
              ><dt>制单人</dt><dd>{{ order.createBy || '—' }}</dd></div
            >
            <div
              ><dt>计划开始</dt><dd>{{ order.plannedStartDate || '—' }}</dd></div
            >
            <div
              ><dt>计划完成</dt><dd>{{ order.plannedEndDate || '—' }}</dd></div
            >
            <div
              ><dt>打印日期</dt><dd>{{ printDate }}</dd></div
            >
            <div
              ><dt>责任人</dt><dd>{{ order.dispatcherNameSnapshot || '—' }}</dd></div
            >
            <div
              ><dt>生产天数</dt><dd>{{ order.productionDaysSnapshot }} 天</dd></div
            >
          </dl>
        </section>

        <table class="work-order-print-sheet__table">
          <thead>
            <tr>
              <th>序号</th><th>工序</th><th>控制码</th><th>工作中心</th><th>工序数量</th>
              <th>准备工时</th><th>运行工时</th><th>操作者</th><th>首检</th><th>合格数</th>
              <th>工废数</th><th>料废数</th><th>接收人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="step in order.routeSnapshot?.steps || []" :key="step.id">
              <td>{{ step.code }}</td>
              <td>{{ step.name }}</td>
              <td>{{ step.controlCode || '—' }}</td>
              <td>{{ step.workCenterNames?.join('、') || '—' }}</td>
              <td>{{ operationQuantity(order, step) }}</td>
              <td>{{ quantity(step.setupMinutes) }}</td>
              <td>{{ quantity(step.runProcessingMinutes) }}</td>
              <td></td>
              <td>{{ step.firstInspection ? '是' : '' }}</td>
              <td></td><td></td><td></td><td></td>
            </tr>
            <tr v-if="!order.routeSnapshot?.steps?.length">
              <td colspan="13" class="work-order-print-sheet__empty">暂无工艺路线数据</td>
            </tr>
          </tbody>
        </table>

        <footer class="work-order-print-sheet__footer">
          <span>定额员：</span><span>检验员：</span><span>接收人/日期：</span><span>打印人：</span>
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import QrcodeVue from 'qrcode.vue'
  import logo from '@/assets/images/common/logo-full-light.png'
  import { formatNumberValue } from '@/utils/ui'
  import type { MesWorkOrder, MesWorkOrderRouteStepSnapshot } from '@mes/api'
  import { calculateOperationQuantity } from './work-order-plan'
  import { workOrderQrValue } from './work-order-qr'

  const orders = shallowRef<MesWorkOrder[]>([])
  const printDate = computed(() => dayjs().format('YYYY-MM-DD'))

  const quantity = (value: number): string => formatNumberValue(value)
  const operationQuantity = (order: MesWorkOrder, step: MesWorkOrderRouteStepSnapshot): string =>
    formatNumberValue(calculateOperationQuantity(order.orderQuantity, step.basicBatch))

  async function print(rows: MesWorkOrder[]): Promise<void> {
    orders.value = rows
    document.body.classList.add('is-work-order-printing')
    await nextTick()

    const cleanup = () => {
      document.body.classList.remove('is-work-order-printing')
      orders.value = []
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  defineExpose({ print })
</script>

<style lang="scss">
  .work-order-print-batch {
    display: none;
  }

  @page {
    size: a5 landscape;
    margin: 5mm;
  }

  @media print {
    body.is-work-order-printing {
      color: #111;
      background: #fff;

      > #app,
      > .el-overlay,
      > .el-message {
        display: none !important;
      }

      > .work-order-print-batch {
        display: block !important;
      }
    }

    .work-order-print-sheet {
      box-sizing: border-box;
      width: 100%;
      min-height: 136mm;
      padding: 0;
      font-family: 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif;
      font-size: 8px;
      line-height: 1.25;
      color: #111;
      break-after: page;

      &:last-child {
        break-after: auto;
      }

      &__header {
        display: grid;
        grid-template-columns: 92px 1fr 58px;
        align-items: start;
        min-height: 28px;
        margin-bottom: 3mm;

        img {
          object-fit: contain;
          object-position: left top;
        }

        h1 {
          margin: 1px 0 0;
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
          text-align: center;
          letter-spacing: 1px;
        }
      }

      &__qr {
        display: grid;
        gap: 1px;
        justify-items: end;

        span {
          font-size: 7px;
        }
      }

      &__meta {
        display: grid;
        grid-template-columns: 1.15fr 1.1fr 0.85fr;
        gap: 5mm;
        margin-bottom: 2.5mm;

        dl {
          display: grid;
          gap: 1.2mm;
          margin: 0;
        }

        div {
          display: grid;
          grid-template-columns: 45px minmax(0, 1fr);
          gap: 3px;
          min-width: 0;
        }

        dt,
        dd {
          min-width: 0;
          margin: 0;
        }

        dt::after {
          content: '：';
        }

        dd {
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
          white-space: nowrap;
        }
      }

      &__table {
        width: 100%;
        font-variant-numeric: tabular-nums;
        table-layout: fixed;
        border-collapse: collapse;

        th,
        td {
          height: 5.6mm;
          padding: 0.7mm 0.8mm;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
          white-space: nowrap;
          border: 0.25mm solid #222;
        }

        th {
          font-weight: 700;
          background: #f3f4f6;
        }

        th:nth-child(1) {
          width: 8%;
        }

        th:nth-child(2) {
          width: 11%;
        }

        th:nth-child(3) {
          width: 8%;
        }

        th:nth-child(4) {
          width: 12%;
        }

        th:nth-child(5) {
          width: 8%;
        }

        th:nth-child(6),
        th:nth-child(7) {
          width: 7%;
        }

        th:nth-child(8) {
          width: 8%;
        }

        th:nth-child(9),
        th:nth-child(10),
        th:nth-child(11),
        th:nth-child(12) {
          width: 5%;
        }

        th:nth-child(13) {
          width: 7%;
        }
      }

      &__empty {
        height: 12mm !important;
        color: #555;
      }

      &__footer {
        display: grid;
        grid-template-columns: 1fr 1fr 1.2fr 1fr;
        gap: 6mm;
        margin-top: 6mm;
        font-size: 8.5px;
      }
    }
  }
</style>
