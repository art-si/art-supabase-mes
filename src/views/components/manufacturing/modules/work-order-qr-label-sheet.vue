<template>
  <Teleport to="body">
    <div class="work-order-qr-label-batch" aria-hidden="true">
      <article v-for="order in orders" :key="order.id" class="work-order-qr-label">
        <QrcodeVue :value="workOrderQrValue(order)" :size="122" level="M" />
        <div>
          <strong>生产工单</strong>
          <b>{{ order.workOrderNo }}</b>
          <span>{{ order.materialDescription || order.materialNameSnapshot }}</span>
          <small
            >{{ order.materialCodeSnapshot }} · {{ order.orderQuantity }}
            {{ order.unitSnapshot }}</small
          >
        </div>
      </article>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import QrcodeVue from 'qrcode.vue'
  import type { MesWorkOrder } from '@mes/api'
  import { workOrderQrValue } from './work-order-qr'

  const orders = shallowRef<MesWorkOrder[]>([])
  const print = async (rows: MesWorkOrder[]): Promise<void> => {
    orders.value = rows
    document.body.classList.add('is-work-order-qr-label-printing')
    await nextTick()
    const cleanup = () => {
      document.body.classList.remove('is-work-order-qr-label-printing')
      orders.value = []
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }
  defineExpose({ print })
</script>

<style lang="scss">
  .work-order-qr-label-batch {
    display: none;
  }

  @media print {
    body.is-work-order-qr-label-printing {
      color: #111;
      background: #fff;

      > #app,
      > .el-overlay,
      > .el-message {
        display: none !important;
      }

      > .work-order-qr-label-batch {
        display: grid !important;
        grid-template-columns: repeat(2, 1fr);
        gap: 4mm;
      }
    }

    .work-order-qr-label {
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 30mm minmax(0, 1fr);
      gap: 3mm;
      align-items: center;
      width: 100%;
      min-height: 39mm;
      padding: 2mm;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      border: 1px solid #333;
      break-inside: avoid;

      canvas {
        width: 30mm !important;
        height: 30mm !important;
      }

      > div {
        display: grid;
        gap: 1mm;
        min-width: 0;
      }

      strong {
        font-size: 8pt;
      }

      b {
        font-size: 12pt;
      }

      span,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      span {
        font-size: 8pt;
      }

      small {
        font-size: 7pt;
      }
    }
  }
</style>
