<template>
  <div
    ref="documentRef"
    class="packing-print-document"
    :class="[`packing-print-document--${mode}`, { 'is-print-layout': printLayout }]"
    :style="paperStyle"
  >
    <template v-if="mode === 'label'">
      <article v-for="label in labels" :key="label.id" class="packing-print-document__label">
        <div class="packing-print-document__label-content">
          <header>
            <QrcodeVue :value="label.qrValue" :size="56" render-as="svg" level="M" />
            <h1>合 格 证</h1>
          </header>
          <table>
            <tbody>
              <tr
                ><th>合格证号</th><td>{{ order.workOrderNo }} / {{ label.packNo }}</td></tr
              >
              <tr
                ><th>包号</th
                ><td
                  >{{ label.packNo }} · 第 {{ label.ordinal }} 包 / 共 {{ label.total }} 包<span
                    v-if="label.parts > 1"
                  >
                    · 续 {{ label.part }}/{{ label.parts }}</span
                  ></td
                ></tr
              >
              <tr
                ><th>执行标准</th><td>{{ options.standard || '—' }}</td></tr
              >
              <tr
                ><th>工程名称</th><td>{{ order.projectNameSnapshot || '—' }}</td></tr
              >
              <tr
                ><th>区域/编号</th><td>{{ label.areaAndNumber }}</td></tr
              >
              <tr
                ><th>产品名称</th><td>{{ order.materialDescription || '—' }}</td></tr
              >
              <tr
                ><th>板型</th><td>{{ options.boardType || '—' }}</td></tr
              >
              <tr
                ><th>颜色</th><td>{{ options.color || '—' }}</td></tr
              >
              <tr
                ><th>规格数量</th
                ><td
                  ><div v-for="line in label.lines" :key="line.boardId"
                    >{{ line.boardNo }} · {{ line.lengthMm }} × {{ line.widthMm }} mm ×
                    {{ line.pieces }} 块</div
                  ></td
                ></tr
              >
            </tbody>
          </table>
          <footer
            ><span>质检员：{{ options.inspector || '______' }}</span
            ><span>生产日期：{{ options.productionDate || '______' }}</span></footer
          >
        </div>
      </article>
    </template>
    <article v-else class="packing-print-document__form">
      <h1>排包单</h1>
      <dl>
        <div
          ><dt>生产工单</dt><dd>{{ order.workOrderNo }}</dd></div
        >
        <div
          ><dt>工程名称</dt><dd>{{ order.projectNameSnapshot || '—' }}</dd></div
        >
        <div
          ><dt>产品名称</dt><dd>{{ order.materialDescription || '—' }}</dd></div
        >
        <div
          ><dt>规格型号</dt><dd>{{ order.specificationSnapshot || '—' }}</dd></div
        >
      </dl>
      <table>
        <thead
          ><tr
            ><th>包号</th><th>区域</th><th>编号</th><th>长度 mm</th><th>宽度 mm</th
            ><th>块数</th></tr
          ></thead
        >
        <tbody
          ><template v-for="label in labels" :key="label.id"
            ><tr v-for="line in label.lines" :key="line.boardId"
              ><td>{{ label.packNo }}</td
              ><td>{{ line.area || '—' }}</td
              ><td>{{ line.boardNo || '—' }}</td
              ><td>{{ line.lengthMm }}</td
              ><td>{{ line.widthMm }}</td
              ><td>{{ line.pieces }}</td></tr
            ></template
          ></tbody
        >
        <tfoot
          ><tr
            ><th colspan="5">合计 {{ packCount }} 包</th><td>{{ totalPieces }} 块</td></tr
          ></tfoot
        >
      </table>
      <footer
        ><span>制单：____________</span><span>复核：____________</span
        ><span>签收：____________</span></footer
      >
    </article>
  </div>
</template>

<script setup lang="ts">
  import QrcodeVue from 'qrcode.vue'
  import { uniq } from 'lodash-es'
  import { useResizeObserver } from '@vueuse/core'
  import type {
    PackingPrintLabel,
    PackingPrintMode,
    PackingPrintOptions,
    PackingPrintOrder
  } from './packing-print'

  const props = defineProps<{
    mode: PackingPrintMode
    order: PackingPrintOrder
    labels: PackingPrintLabel[]
    options: PackingPrintOptions
    printLayout?: boolean
  }>()
  const documentRef = ref<HTMLElement>()
  const paperStyle = computed(() => {
    const width =
      Number.isFinite(props.options.paperWidthMm) &&
      props.options.paperWidthMm >= 1 &&
      props.options.paperWidthMm <= 105
        ? props.options.paperWidthMm
        : 100
    const height =
      Number.isFinite(props.options.paperHeightMm) && props.options.paperHeightMm >= 1
        ? props.options.paperHeightMm
        : 150
    return {
      '--packing-label-width': `${width}mm`,
      '--packing-label-height': `${height}mm`,
      '--packing-label-ratio': `${width} / ${height}`,
      '--packing-label-padding': `${Math.min(3, width / 20, height / 20)}mm`
    }
  })
  // Fit each complete certificate within its physical label without dropping business content.
  function fitLabels(): void {
    documentRef.value
      ?.querySelectorAll<HTMLElement>('.packing-print-document__label')
      .forEach((paper) => {
        const content = paper.querySelector<HTMLElement>('.packing-print-document__label-content')
        if (!content) return
        const style = getComputedStyle(paper)
        const width =
          paper.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight)
        const height =
          paper.clientHeight -
          Number.parseFloat(style.paddingTop) -
          Number.parseFloat(style.paddingBottom)
        const contentWidth = Math.max(content.offsetWidth, content.scrollWidth)
        const scale = Math.min(
          1,
          width / Math.max(1, contentWidth),
          height / Math.max(1, content.offsetHeight)
        )
        content.style.transform = `translateX(${(width - contentWidth * scale) / 2}px) scale(${scale})`
      })
  }
  useResizeObserver(documentRef, fitLabels)
  watch(
    () => [props.options, props.labels],
    () => {
      void nextTick(fitLabels)
    },
    { deep: true, flush: 'post' }
  )
  onMounted(() => {
    void document.fonts.ready.then(fitLabels)
  })
  defineExpose({ fitLabels })
  const packCount = computed(() => uniq(props.labels.map((label) => label.packNo)).length)
  const totalPieces = computed(() =>
    props.labels.reduce(
      (sum, label) => sum + label.lines.reduce((count, line) => count + line.pieces, 0),
      0
    )
  )
</script>

<style lang="scss">
  // Printed business documents deliberately use paper colors in every app theme.
  .packing-print-document {
    font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
    line-height: 1.5;
    color: #111;
    overflow-wrap: anywhere;

    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      text-align: center;
    }

    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 5px 7px;
      vertical-align: top;
      border: 1px solid #555;
    }

    th {
      font-weight: 500;
      text-align: left;
    }

    footer {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      justify-content: space-between;
      margin-top: 12px;
    }

    &__label {
      box-sizing: border-box;
      width: 100%;
      max-width: var(--packing-label-width);
      aspect-ratio: var(--packing-label-ratio);
      padding: var(--packing-label-padding);
      margin: 0 auto 16px;
      overflow: hidden;
      font-size: 12px;
      background: #fff;
      border: 1px solid #555;

      &-content {
        transform-origin: top left;
      }

      header {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
      }

      header svg {
        flex: none;
      }

      h1 {
        flex: 1;
      }

      th {
        width: 72px;
      }
    }

    &.is-print-layout &__label {
      width: var(--packing-label-width);
      max-width: none;
      height: var(--packing-label-height);
      margin: 0;
    }

    &__form {
      padding: 20px;
      font-size: 12px;
      background: #fff;

      dl {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 16px;
        margin: 16px 0;
      }

      dl > div {
        display: flex;
        gap: 8px;
      }

      dt {
        flex: none;
      }

      dd {
        margin: 0;
      }

      thead {
        display: table-header-group;
      }

      tr {
        break-inside: avoid;
      }
    }
  }

  .packing-print-batch {
    position: fixed;
    top: 0;
    left: -100000px;
    visibility: hidden;
  }

  @page packing-form {
    size: a4 portrait;
    margin: 10mm;
  }

  @media print {
    body.is-packing-printing {
      > :not(.packing-print-batch) {
        display: none !important;
      }

      > .packing-print-batch {
        position: static;
        display: block !important;
        visibility: visible;
      }
    }

    .packing-print-batch {
      .packing-print-document__label {
        break-after: page;
        page: packing-label;

        &:last-child {
          break-after: auto;
        }
      }

      .packing-print-document__form {
        page: packing-form;
        padding: 0;
        font-size: 10pt;
      }
    }
  }
</style>
