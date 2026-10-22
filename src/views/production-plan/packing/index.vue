<template>
  <ArtPermissionGuard permission="MesPacking:View" resource-name="排包单">
    <div class="packing-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="PACKING WORKSPACE"
        title="排包单"
        description="生产工单 → 板材明细 → 排包单 · 单击联动查看，双击快速排包。"
        icon="ri:archive-line"
        density="compact"
        refreshable
        :refresh-loading="loading"
        @refresh="refresh"
      >
        <template #actions>
          <ElButton
            v-auth="'MesPacking:Auto'"
            :disabled="!selectedOrder || !boards.length || busy || isPublished"
            @click="autoPack"
          >
            <ArtSvgIcon icon="ri:magic-line" />自动排包
          </ElButton>
          <ElButton
            v-auth="'MesPacking:Save'"
            type="primary"
            :loading="busy"
            :disabled="!selectedOrder || (!dirty && !needsRuleBinding) || isPublished"
            @click="save"
          >
            <ArtSvgIcon icon="ri:save-line" />保存数据
          </ElButton>
          <ElButton
            v-auth="'MesPacking:Publish'"
            :disabled="
              !selectedOrder ||
              !packs.length ||
              !selectedOrder.packingRuleId ||
              needsRuleBinding ||
              dirty ||
              busy ||
              isPublished
            "
            :title="
              !selectedOrder?.packingRuleId || needsRuleBinding
                ? '请先按所选规则保存排包数据'
                : undefined
            "
            @click="publish"
          >
            <ArtSvgIcon icon="ri:send-plane-line" />发布
          </ElButton>
          <ElButton
            v-auth="'MesPacking:Repack'"
            :disabled="!selectedOrder || busy || !isPublished"
            @click="repack"
          >
            <ArtSvgIcon icon="ri:restart-line" />重排包
          </ElButton>
        </template>
      </BusinessWorkspaceHeader>

      <ArtWorkspaceSplitter
        class="packing-page__content"
        primary-size="260px"
        primary-min="220px"
        primary-max="400px"
        :breakpoint="1000"
      >
        <template #primary>
          <ArtSectionCard
            :show-scrollbar="false"
            class="packing-page__orders"
            title="待排生产工单"
            :subtitle="`需排包工单 · 当前 ${visibleOrders.length} 单`"
            :loading="loading"
            :error="error"
            :empty="!loading && !error && !orders.length"
            empty-title="暂无需排包工单"
            empty-description="请先创建已启用排包配置的生产工单。"
            @retry="loadOrders"
          >
            <div class="packing-page__filters">
              <ElInput
                v-model="keyword"
                clearable
                placeholder="工单、物料、规格、项目或施工号"
                aria-label="组合查询工单"
              >
                <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
              </ElInput>
              <ElDatePicker
                v-model="startDates"
                type="daterange"
                value-format="YYYY-MM-DD"
                start-placeholder="开工起"
                end-placeholder="开工止"
                unlink-panels
                clearable
                aria-label="要求开工日期区间"
              />
              <ElCheckbox v-model="includePacked">包含已排包和已发布</ElCheckbox>
            </div>
            <ElScrollbar class="packing-page__order-scroll" always>
              <div v-if="visibleOrders.length" class="packing-page__order-list">
                <button
                  v-for="order in visibleOrders"
                  :key="order.id"
                  type="button"
                  class="packing-page__order"
                  :class="{ 'is-selected': order.id === orderId }"
                  :aria-pressed="order.id === orderId"
                  :aria-busy="workOrderDetail.openingId === order.id"
                  :title="
                    hasAuth('MesWorkOrder:View')
                      ? '单击查看排包，双击或 Alt+Enter 查看生产工单'
                      : '单击查看排包'
                  "
                  @click="chooseOrder(order.id)"
                  @dblclick="viewWorkOrder(order)"
                  @keydown.alt.enter.prevent="viewWorkOrder(order)"
                >
                  <span class="packing-page__order-top">
                    <strong>{{ order.workOrderNo }}</strong>
                    <ElTag v-if="workOrderDetail.openingId === order.id" size="small" type="info"
                      >加载中</ElTag
                    >
                    <ElTag v-else size="small" :type="orderStatus(order).type" effect="light">{{
                      orderStatus(order).label
                    }}</ElTag>
                  </span>
                  <span class="packing-page__order-name" :title="order.materialNameSnapshot">{{
                    order.materialNameSnapshot
                  }}</span>
                  <span class="packing-page__order-progress"
                    >{{
                      order.id === orderId && !detailLoading ? packedTotal : order.packedPieces
                    }}/{{ order.boardPieces }} 块</span
                  >
                  <span class="packing-page__order-bottom">
                    <span>{{ order.projectNameSnapshot || '未关联项目' }}</span>
                    <time>{{ order.plannedStartDate || '未设开工日' }}</time>
                  </span>
                </button>
              </div>
              <ArtEmptyState
                v-else-if="!loading && !error"
                title="当前条件下没有工单"
                description="可清除日期或勾选已排包后重试。"
                size="compact"
              />
            </ElScrollbar>
            <div class="packing-page__rule-field">
              <span>自动排包规则</span>
              <ElSelect
                v-model="selectedRuleId"
                :disabled="!selectedOrder || isPublished"
                placeholder="选择板材排包规则"
                aria-label="板材排包规则"
              >
                <ElOption
                  v-for="rule in scopedRules"
                  :key="rule.id"
                  :label="rule.ruleName"
                  :value="rule.id"
                />
              </ElSelect>
            </div>
          </ArtSectionCard>
        </template>
        <ArtWorkspaceSplitter
          primary-size="46%"
          primary-min="300px"
          primary-max="75%"
          secondary-min="300px"
          :breakpoint="1000"
          stacked-primary-size="480px"
        >
          <template #primary>
            <div class="packing-page__main">
              <ArtSectionCard
                v-if="selectedOrder && !detailLoading && (!boards.length || detailError)"
                class="packing-page__single-state"
                title="工单板材明细"
                :error="detailError"
                :empty="!detailError"
                empty-title="该工单尚无板材明细"
                empty-description="先在生产工单登记成品板的区域、编号、长宽和块数，再回来排包。"
                @retry="loadDetails"
              >
                <template #empty-action>
                  <ElButton v-auth="'MesWorkOrder:Edit'" type="primary" @click="openWorkOrder">
                    前往维护工单明细
                  </ElButton>
                </template>
              </ArtSectionCard>
              <div
                v-else-if="selectedOrder"
                class="packing-page__workspace business-workspace-content"
              >
                <ArtSectionCard
                  class="packing-page__panel"
                  :show-scrollbar="false"
                  title="工单板材明细"
                  :subtitle="`剩余 ${remainingTotal} 块 · 单击联动，双击排包`"
                  :loading="detailLoading"
                  :error="detailError"
                  :empty="!detailLoading && !detailError && !boards.length"
                  empty-title="工单尚无板材明细"
                  empty-description="先登记成品板的区域、轴线、尺寸和块数。"
                  @retry="loadDetails"
                >
                  <ArtTableHeader
                    layout="size,settings"
                    full-class="packing-page__workspace"
                    :loading="detailLoading"
                    @refresh="refresh"
                  >
                    <template #left>
                      <ElButton
                        v-auth="'MesPacking:Manual'"
                        size="small"
                        :disabled="!selectedBoards.length || !canManual"
                        @click="createPack"
                      >
                        <ArtSvgIcon icon="ri:archive-stack-line" />批量排包
                      </ElButton>
                      <ElButton
                        v-auth="'MesPacking:Manual'"
                        size="small"
                        :disabled="!selectedBoards.length || !selectedPack || !canManual"
                        @click="mergeSelected"
                      >
                        <ArtSvgIcon icon="ri:git-merge-line" />并入选中包
                      </ElButton>
                    </template>
                  </ArtTableHeader>
                  <ArtTable
                    ref="boardTableRef"
                    :fixed-column-min-width="0"
                    :data="boards"
                    :columns="boardColumns"
                    :pagination="false"
                    :row-class-name="boardRowClass"
                    height="100%"
                    :scrollbar-always-on="false"
                    row-key="id"
                    @selection-change="selectedBoards = $event"
                    size="small"
                    highlight-current-row
                    @row-click="linkBoard"
                    @row-dblclick="addBoard"
                  >
                    <template #operation="{ row }">
                      <ElButton
                        v-auth="'MesPacking:Manual'"
                        link
                        size="small"
                        type="primary"
                        :disabled="!canManual"
                        @click.stop="addBoard(row)"
                        >排包</ElButton
                      >
                      <ElButton
                        v-auth="'MesPacking:Spec'"
                        link
                        size="small"
                        :disabled="isPublished"
                        @click.stop="openSpec(row)"
                        >参数</ElButton
                      >
                    </template>
                  </ArtTable>
                </ArtSectionCard>
              </div>
              <ArtSectionCard
                v-else
                class="packing-page__start"
                title="开始排包"
                empty
                empty-title="请选择生产工单"
                empty-description="从左侧需排包工单列表选择一单，查看板材明细并进行排包。"
              />
            </div>
          </template>
          <ArtSectionCard
            class="packing-page__panel packing-page__results"
            :show-scrollbar="false"
            title="排包单"
            :subtitle="
              selectedOrder
                ? `${packs.length} 包 · 已排 ${packedTotal} 块 · 待排 ${remainingTotal} 块`
                : '选择生产工单后查看排包明细'
            "
            :loading="detailLoading"
            :error="detailError"
            @retry="loadDetails"
          >
            <div class="packing-page__toolbar">
              <ElButton
                v-auth="'MesPacking:Manual'"
                size="small"
                :disabled="selectedPacks.length < 2 || !canManual"
                @click="mergePacks"
                ><ArtSvgIcon icon="ri:git-merge-line" />合包</ElButton
              >
              <ElButton
                v-auth="'MesPacking:Manual'"
                size="small"
                :disabled="selectedPacks.length !== 1 || !selectedPackItems.length || !canManual"
                @click="splitPack"
                ><ArtSvgIcon icon="ri:git-branch-line" />拆包</ElButton
              >
              <ElButton v-if="activeBoardId" size="small" @click="clearBoardFilter"
                ><ArtSvgIcon icon="ri:filter-off-line" />全部明细</ElButton
              >
              <ElTag v-if="dirty" size="small" type="warning" effect="light">未保存</ElTag>
              <ElTag
                v-else-if="needsRuleBinding && !isPublished"
                size="small"
                type="warning"
                effect="light"
                >待按规则保存</ElTag
              >
              <div
                v-if="hasAuth('MesPacking:Print')"
                class="ml-auto flex flex-wrap items-center gap-2"
              >
                <ElButton
                  v-auth="'MesPacking:Print'"
                  size="small"
                  :disabled="!canPrint"
                  :title="printHint"
                  @click="openPrint('form')"
                  ><ArtSvgIcon icon="ri:printer-line" />表单打印</ElButton
                >
                <ElButton
                  v-auth="'MesPacking:Print'"
                  size="small"
                  :disabled="!canPrint"
                  :title="printHint"
                  @click="openPrint('label')"
                  ><ArtSvgIcon icon="ri:qr-code-line" />标签打印</ElButton
                >
              </div>
            </div>
            <div class="packing-page__linkage">
              <span>{{
                activeBoard
                  ? `${activeBoard.area} / ${activeBoard.boardNo} · ${activeBoard.lengthMm} mm`
                  : '全部板材'
              }}</span>
              <span>已选 {{ selectedPacks.length }} 包 / {{ selectedResultRows.length }} 行</span>
            </div>
            <ArtTable
              ref="resultTableRef"
              :fixed-column-min-width="0"
              empty-height="100%"
              :empty-text="!selectedOrder ? '请先选择生产工单' : '暂无关联排包'"
              empty-description="单击中间板材查看关联，双击或点击排包生成明细。"
              :data="resultRows"
              :columns="resultColumns"
              :pagination="false"
              height="100%"
              size="small"
              :scrollbar-always-on="false"
              row-key="key"
              @selection-change="selectResultRows"
            >
              <template #packNo="{ row }"
                ><ElButton
                  link
                  size="small"
                  type="primary"
                  :aria-label="`选定 ${row.pack.packNo} 为并入目标`"
                  @click="setTargetPack(row.pack)"
                  >{{ row.pack.packNo }}</ElButton
                ></template
              >
              <template #pieces="{ row }"
                ><ElInputNumber
                  v-model="row.item.pieces"
                  size="small"
                  :controls="false"
                  :min="1"
                  :max="availableForItem(row.item.boardId, row.item.pieces)"
                  :precision="0"
                  :disabled="!canManual"
                  :aria-label="`${row.pack.packNo} 块数`"
                  class="w-full!"
                  @change="markManual(row.pack)"
              /></template>
              <template #operation="{ row }"
                ><ElButton
                  v-auth="'MesPacking:Manual'"
                  link
                  size="small"
                  type="danger"
                  :disabled="!canManual"
                  @click="removeItem(row.pack, row.item.boardId)"
                  >移出</ElButton
                ></template
              >
            </ArtTable>
            <div class="packing-page__result-note">
              {{
                selectedPack ? `并入目标：${selectedPack.packNo} · ` : '点击包号设置并入目标 · '
              }}合包按整包，拆包按勾选明细
              <ElButton
                v-if="selectedPack"
                link
                type="primary"
                size="small"
                @click="selectedPack = null"
                >取消目标</ElButton
              >
            </div>
          </ArtSectionCard>
        </ArtWorkspaceSplitter>
      </ArtWorkspaceSplitter>
      <PackingBoardSpecDialog ref="specDialogRef" @success="loadDetails" />
      <PackingPrintDialog ref="printDialogRef" />
      <component
        :is="workOrderDialogComponent"
        ref="workOrderDialogRef"
        :key="effectiveTenantId || 'all'"
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import type { ColumnOption } from '@/types'
  import PackingPrintDialog from './modules/packing-print-dialog.vue'
  import type { PackingPrintMode } from './modules/packing-print'
  import dayjs from 'dayjs'
  import { cloneDeep, uniq } from 'lodash-es'
  import { storeToRefs } from 'pinia'
  import { useRouter } from 'vue-router'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import ArtTableHeader from '@/components/core/tables/art-table-header/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import { useArtFeedback, notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useLazyComponent } from '@/hooks/core/useLazyComponent'
  import type { WorkOrderDialogOpenData } from '../../components/manufacturing/modules/work-order-dialog.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    fetchPackingOrders,
    fetchWorkOrders,
    fetchPackRules,
    fetchWorkOrderBoards,
    fetchWorkOrderPacks,
    savePackingPlan,
    setPackingPublication,
    type PackDraft,
    type PackRule,
    type WorkOrderBoard
  } from '@mes/api'
  import { packTotals, remainingPieces, suggestPacks, validatePlan } from './modules/packing-plan'
  import PackingBoardSpecDialog from './modules/packing-board-spec-dialog.vue'

  defineOptions({ name: 'MesPacking' })
  const declaredPermissions = [
    'MesPacking:View',
    'MesPacking:Spec',
    'MesPacking:Auto',
    'MesPacking:Manual',
    'MesPacking:Save',
    'MesPacking:Publish',
    'MesPacking:Repack',
    'MesPacking:Print'
  ] as const
  void declaredPermissions
  type Order = Awaited<ReturnType<typeof fetchPackingOrders>>[number]
  const tenantScope = useTenantScopeStore()
  const router = useRouter()
  const { effectiveTenantId } = storeToRefs(tenantScope)
  const { confirm, promptText } = useArtFeedback()
  const { hasAuth } = useAuth()
  const workOrderDetail = reactive({ openingId: '' })
  const { component: workOrderDialogComponent, load: loadWorkOrderDialog } = useLazyComponent(
    () => import('../../components/manufacturing/modules/work-order-dialog.vue')
  )
  const workOrderDialogRef = ref<{ handleOpen: (data: WorkOrderDialogOpenData) => Promise<void> }>()
  const canManual = computed(() => hasAuth('MesPacking:Manual') && !isPublished.value)
  const orders = ref<Order[]>([])
  const rules = ref<PackRule[]>([])
  const selectedRuleId = ref('')
  const orderId = ref('')
  const keyword = ref('')
  const startDates = ref<string[]>([
    dayjs().format('YYYY-MM-DD'),
    dayjs().add(2, 'day').format('YYYY-MM-DD')
  ])
  const includePacked = ref(false)
  const boards = ref<WorkOrderBoard[]>([])
  const packs = ref<PackDraft[]>([])
  const selectedBoards = ref<WorkOrderBoard[]>([])
  const selectedPack = shallowRef<PackDraft | null>(null)
  const selectedPacks = ref<PackDraft[]>([])
  const selectedPackItems = ref<PackDraft['items']>([])
  const boardTableRef = ref<ArtTableExpose>()
  interface PackingResultRow {
    key: string
    pack: PackDraft
    item: PackDraft['items'][number]
    board: WorkOrderBoard | undefined
  }
  const boardColumns: ColumnOption<WorkOrderBoard>[] = [
    { type: 'selection', width: 36 },
    { prop: 'area', label: '区域', width: 62, showOverflowTooltip: true },
    { prop: 'boardNo', label: '编号', width: 76, showOverflowTooltip: true },
    { prop: 'lengthMm', label: '长度 mm', width: 88, align: 'right' },
    { prop: 'pieces', label: '块数', width: 56, align: 'right' },
    { prop: 'packed', label: '已排', width: 56, align: 'right', formatter: (row) => packed(row) },
    {
      prop: 'meters',
      label: '延米 m',
      width: 80,
      align: 'right',
      formatter: (row) => ((row.lengthMm * row.pieces) / 1000).toFixed(2)
    },
    {
      prop: 'areaSqm',
      label: '面积 ㎡',
      width: 80,
      align: 'right',
      formatter: (row) => row.areaSqm.toFixed(2)
    },
    { prop: 'remark', label: '备注', minWidth: 100, showOverflowTooltip: true },
    { prop: 'operation', label: '操作', width: 104, fixed: 'right', useSlot: true }
  ]
  const resultColumns: ColumnOption<PackingResultRow>[] = [
    { type: 'selection', width: 36 },
    { prop: 'packNo', label: '包号', minWidth: 100, useSlot: true },
    {
      prop: 'area',
      label: '区域',
      minWidth: 62,
      formatter: (row) => row.board?.area || '—',
      showOverflowTooltip: true
    },
    {
      prop: 'boardNo',
      label: '编号',
      minWidth: 76,
      formatter: (row) => row.board?.boardNo || '—',
      showOverflowTooltip: true
    },
    {
      prop: 'lengthMm',
      label: '长度 mm',
      minWidth: 88,
      align: 'right',
      formatter: (row) => row.board?.lengthMm || '—'
    },
    { prop: 'pieces', label: '块数', width: 86, useSlot: true },
    {
      prop: 'meters',
      label: '延米 m',
      minWidth: 80,
      align: 'right',
      formatter: (row) => itemMeters(row.item.boardId, row.item.pieces).toFixed(2)
    },
    {
      prop: 'areaSqm',
      label: '面积 ㎡',
      minWidth: 80,
      align: 'right',
      formatter: (row) => itemArea(row.item.boardId, row.item.pieces).toFixed(2)
    },
    { prop: 'operation', label: '操作', width: 60, fixed: 'right', useSlot: true }
  ]
  const activeBoardId = ref('')
  const activeBoard = computed(() => boardById(activeBoardId.value))
  const resultTableRef = ref<ArtTableExpose>()
  const selectedResultRows = ref<PackingResultRow[]>([])
  const resultRows = computed<PackingResultRow[]>(() =>
    packs.value.flatMap((pack) =>
      pack.items
        .filter((item) => !activeBoardId.value || item.boardId === activeBoardId.value)
        .map((item) => ({
          key: `${pack.id || pack.packNo}:${item.boardId}`,
          pack,
          item,
          board: boardById(item.boardId)
        }))
    )
  )
  function clearResultSelection(): void {
    resultTableRef.value?.elTableRef?.clearSelection()
    selectedResultRows.value = []
    selectedPacks.value = []
    selectedPackItems.value = []
  }
  function setTargetPack(pack: PackDraft): void {
    clearResultSelection()
    selectedPack.value = pack
  }
  function selectResultRows(rows: PackingResultRow[]): void {
    selectedResultRows.value = rows
    selectedPacks.value = uniq(rows.map((row) => row.pack))
    selectedPackItems.value = selectedPacks.value.length === 1 ? rows.map((row) => row.item) : []
    if (selectedPacks.value.length === 1) selectedPack.value = selectedPacks.value[0]
  }
  function linkBoard(row: { id?: unknown }, column?: { type?: string }): void {
    if (column?.type === 'selection' || typeof row.id !== 'string') return
    activeBoardId.value = row.id
    clearResultSelection()
  }
  function clearBoardFilter(): void {
    activeBoardId.value = ''
    clearResultSelection()
    boardTableRef.value?.elTableRef?.setCurrentRow()
  }
  function orderStatus(order: Order): { label: string; type: 'success' | 'warning' | 'info' } {
    if (order.packingStatus === 'published') return { label: '已发布', type: 'success' }
    const count =
      order.id === orderId.value && !detailLoading.value ? packedTotal.value : order.packedPieces
    return count > 0 ? { label: '已排包', type: 'warning' } : { label: '未排包', type: 'info' }
  }
  const specDialogRef = ref<{ handleOpen: (row: WorkOrderBoard) => Promise<void> }>()
  const loading = ref(false)
  const detailLoading = ref(false)
  const busy = ref(false)
  const error = ref('')
  const detailError = ref('')
  const dirty = ref(false)
  const printDialogRef = ref<InstanceType<typeof PackingPrintDialog>>()
  const canPrint = computed(
    () =>
      Boolean(selectedOrder.value) &&
      selectedPacks.value.length > 0 &&
      !dirty.value &&
      !busy.value &&
      !detailLoading.value &&
      !detailError.value
  )
  const printHint = computed(() =>
    dirty.value ? '请先保存排包调整后打印' : '勾选包内任一明细即可打印整包'
  )
  async function openPrint(mode: PackingPrintMode): Promise<void> {
    if (!hasAuth('MesPacking:Print') || !canPrint.value || !selectedOrder.value) return
    await printDialogRef.value?.handleOpen({
      mode,
      order: selectedOrder.value,
      boards: boards.value,
      packs: packs.value,
      selectedPacks: selectedPacks.value
    })
  }
  watch([effectiveTenantId, orderId], () => void printDialogRef.value?.handleClose())
  const revision = ref('')
  let detailRequest = 0
  const selectedOrder = computed(() => orders.value.find((order) => order.id === orderId.value))
  const isPublished = computed(() => selectedOrder.value?.packingStatus === 'published')
  const needsRuleBinding = computed(
    () =>
      Boolean(selectedOrder.value && packs.value.length && selectedRuleId.value) &&
      selectedOrder.value?.packingRuleId !== selectedRuleId.value
  )
  const visibleOrders = computed(() => {
    const needle = keyword.value.trim().toLocaleLowerCase()
    const [from, to] = startDates.value || []
    return orders.value.filter((order) => {
      if (!includePacked.value && order.packingStatus !== 'unpacked' && order.id !== orderId.value)
        return false
      if (from && (!order.plannedStartDate || order.plannedStartDate < from)) return false
      if (to && (!order.plannedStartDate || order.plannedStartDate > to)) return false
      if (!needle) return true
      return [
        order.workOrderNo,
        order.materialCodeSnapshot,
        order.materialNameSnapshot,
        order.specificationSnapshot,
        order.projectNameSnapshot,
        order.constructionNo
      ].some((value) => (value || '').toLocaleLowerCase().includes(needle))
    })
  })
  const scopedRules = computed(() =>
    rules.value.filter(
      (rule) =>
        rule.enabled &&
        rule.tenantId === selectedOrder.value?.tenantId &&
        (rule.boardThicknessMm == null ||
          rule.boardThicknessMm === selectedOrder.value?.boardThicknessMm)
    )
  )
  const suggestedRule = computed(() => {
    const name = selectedOrder.value?.materialNameSnapshot || ''
    const code = /岩棉|rock/i.test(name)
      ? 'ROCK_BOARD'
      : /聚氨酯|\bPU\b|PIR/i.test(name)
        ? 'PU_BOARD'
        : ''
    return (
      scopedRules.value.find(
        (rule) =>
          rule.ruleCode === code && rule.boardThicknessMm === selectedOrder.value?.boardThicknessMm
      ) ?? scopedRules.value.find((rule) => rule.ruleCode === code && rule.boardThicknessMm == null)
    )
  })
  const selectedRule = computed(() =>
    scopedRules.value.find((rule) => rule.id === selectedRuleId.value)
  )
  const remaining = (board: WorkOrderBoard): number => remainingPieces(board, packs.value)
  const packed = (board: WorkOrderBoard): number => board.pieces - remaining(board)
  const packedTotal = computed(() => boards.value.reduce((sum, board) => sum + packed(board), 0))
  const remainingTotal = computed(() =>
    boards.value.reduce((sum, board) => sum + remaining(board), 0)
  )
  const boardById = (id: string): WorkOrderBoard | undefined =>
    boards.value.find((board) => board.id === id)
  const availableForItem = (id: string, current: number): number => {
    const board = boardById(id)
    return board ? current + remaining(board) : current
  }
  const itemMeters = (id: string, pieces: number): number =>
    ((boardById(id)?.lengthMm || 0) * pieces) / 1000
  const itemArea = (id: string, pieces: number): number => {
    const board = boardById(id)
    return board ? (board.areaSqm / board.pieces) * pieces : 0
  }
  const boardRowClass = ({ row }: { row: WorkOrderBoard }): string =>
    remaining(row) === 0 ? 'packing-page__complete' : ''

  async function loadOrders(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await tenantScope.loadTenantOptions()
      ;[orders.value, rules.value] = await Promise.all([
        fetchPackingOrders(effectiveTenantId.value),
        fetchPackRules(effectiveTenantId.value)
      ])
      if (orderId.value && !orders.value.some((order) => order.id === orderId.value)) {
        orderId.value = ''
        boards.value = []
        packs.value = []
      }
    } catch {
      error.value = '工单与规则加载失败，请重试。'
    } finally {
      loading.value = false
    }
  }
  async function loadDetails(): Promise<void> {
    if (!orderId.value) return
    clearBoardFilter()
    selectedPack.value = null
    selectedBoards.value = []
    detailLoading.value = true
    detailError.value = ''
    const request = ++detailRequest
    const currentOrderId = orderId.value
    try {
      const [boardRows, packRows] = await Promise.all([
        fetchWorkOrderBoards(currentOrderId),
        fetchWorkOrderPacks(currentOrderId)
      ])
      if (request !== detailRequest || currentOrderId !== orderId.value) return
      boards.value = boardRows
      packs.value = packRows.map((pack) => ({
        id: pack.id,
        packNo: pack.packNo,
        manuallyAdjusted: pack.manuallyAdjusted,
        confirmed: pack.confirmed,
        remark: pack.remark,
        items: pack.items.map((item) => ({
          boardId: item.boardId,
          pieces: item.pieces,
          remark: item.remark
        }))
      }))
      selectedPack.value = null
      selectedPacks.value = []
      selectedPackItems.value = []
      dirty.value = false
      revision.value = selectedOrder.value?.updateTime || ''
    } catch {
      if (request === detailRequest && currentOrderId === orderId.value)
        detailError.value = '板材和排包明细加载失败，请重试。'
    } finally {
      if (request === detailRequest) detailLoading.value = false
    }
  }
  async function selectOrder(): Promise<void> {
    if (dirty.value) {
      try {
        await confirm('切换工单将放弃未保存的排包调整，确认继续？', { title: '切换工单' })
      } catch {
        orderId.value = boards.value[0]?.workOrderId || ''
        return
      }
    }
    boards.value = []
    packs.value = []
    selectedRuleId.value =
      scopedRules.value.find((rule) => rule.id === selectedOrder.value?.packingRuleId)?.id ||
      suggestedRule.value?.id ||
      ''
    if (orderId.value) await loadDetails()
  }
  function chooseOrder(id: string): void {
    if (orderId.value === id) return
    orderId.value = id
    void selectOrder()
  }
  async function refresh(): Promise<void> {
    if (dirty.value) {
      try {
        await confirm('刷新将放弃未保存的排包调整，确认继续？', { title: '刷新排包单' })
      } catch {
        return
      }
    }
    await loadOrders()
    await loadDetails()
  }
  function openWorkOrder(): void {
    void router.push({ name: 'MesWorkOrder' })
  }
  async function viewWorkOrder(order: Order): Promise<void> {
    if (!hasAuth('MesWorkOrder:View') || workOrderDetail.openingId) return
    workOrderDetail.openingId = order.id
    const scope = effectiveTenantId.value
    try {
      const [result] = await Promise.all([
        fetchWorkOrders({ current: 1, size: 1, recordId: order.id, tenantId: order.tenantId }),
        loadWorkOrderDialog()
      ])
      if (scope !== effectiveTenantId.value) return
      const row = result.data[0]
      if (!row) {
        ElMessage.warning('工单已变更或暂无查看权限，请刷新后重试')
        return
      }
      await workOrderDialogRef.value?.handleOpen({
        tenantId: row.tenantId,
        tenantOptions: tenantScope.tenantOptions.map((tenant) => ({
          label: tenant.tenantName,
          value: tenant.id
        })),
        row,
        readonly: true
      })
    } catch (error) {
      notifyFriendlyError(error, '生产工单加载失败，请重试')
    } finally {
      workOrderDetail.openingId = ''
    }
  }
  function openSpec(row: Record<string, unknown>): void {
    if (isPublished.value) return
    if (dirty.value) {
      ElMessage.warning('请先保存当前排包方案，再维护包装参数')
      return
    }
    const board = typeof row.id === 'string' ? boardById(row.id) : undefined
    if (board) void specDialogRef.value?.handleOpen(board)
  }
  function markManual(pack: PackDraft): void {
    pack.manuallyAdjusted = true
    pack.confirmed = false
    dirty.value = true
  }
  function nextPackNo(): string {
    let serial = 1
    let candidate = ''
    do candidate = `PK-${String(serial++).padStart(4, '0')}`
    while (packs.value.some((pack) => pack.packNo === candidate))
    return candidate
  }
  function addPieces(board: WorkOrderBoard, pack: PackDraft, amount = remaining(board)): void {
    if (!canManual.value) return
    const rule = selectedRule.value
    if (!rule) {
      ElMessage.warning('请先选择当前板厚适用的排包规则')
      return
    }
    if (board.thicknessMm <= 0) {
      ElMessage.warning(`请先在生产工单维护板材 ${board.boardNo} 的板厚`)
      return
    }
    if (amount < 1) return
    const first = boardById(pack.items[0]?.boardId)
    if (
      first &&
      (first.area !== board.area ||
        (rule.sameNumber && first.boardNo !== board.boardNo) ||
        (!rule.allowMixLength && first.lengthMm !== board.lengthMm))
    ) {
      ElMessage.warning('所选板材不符合该规则的区域、编号或长度约束')
      return
    }
    if (rule.boardThicknessMm && board.thicknessMm !== rule.boardThicknessMm) {
      ElMessage.warning('板材板厚与所选排包规则不符')
      return
    }
    if (rule.maxLength && board.lengthMm > rule.maxLength) {
      ElMessage.warning('板材长度超过所选排包规则上限')
      return
    }
    if (rule.maxWeight && board.unitWeightKg == null) {
      ElMessage.warning('请先维护板材单块重量')
      return
    }
    const totals = packTotals(pack, boards.value)
    const capacity = Math.min(
      amount,
      rule.maxPieces - totals.pieces,
      Math.floor((rule.maxStackHeight - totals.stackHeightMm) / board.thicknessMm),
      rule.maxWeight && board.unitWeightKg
        ? Math.floor((rule.maxWeight - totals.weightKg) / board.unitWeightKg)
        : amount
    )
    if (capacity < 1) {
      ElMessage.warning('当前包已达到规则上限，请新建包')
      return
    }
    const item = pack.items.find((entry) => entry.boardId === board.id)
    if (item) item.pieces += capacity
    else pack.items.push({ boardId: board.id, pieces: capacity, remark: '' })
    markManual(pack)
    if (capacity < amount) ElMessage.info(`本包排入 ${capacity} 块，其余可继续新建包`)
  }
  function createPack(): void {
    if (!canManual.value) return
    const rows = selectedBoards.value.filter((board) => remaining(board) > 0)
    if (!rows.length) return
    const rule = selectedRule.value
    if (!rule) {
      ElMessage.warning('请先选择当前板厚适用的排包规则')
      return
    }
    if (rows.some((row) => row.thicknessMm <= 0)) {
      ElMessage.warning('请先在生产工单维护所选板材的板厚')
      return
    }
    const existingNos = new Set(packs.value.map((pack) => pack.packNo))
    const proposed = suggestPacks(
      boards.value,
      packs.value,
      rule,
      true,
      new Set(rows.map((row) => row.id))
    )
    const created = proposed.filter((pack) => !existingNos.has(pack.packNo))
    if (!created.length) {
      ElMessage.warning('所选明细未生成新包，请核对板厚、重量及规则上限')
      return
    }
    created.forEach((pack) => (pack.manuallyAdjusted = true))
    clearBoardFilter()
    packs.value = proposed
    selectedPack.value = created[0]
    dirty.value = true
    boardTableRef.value?.elTableRef?.clearSelection()
    if (rows.some((row) => remaining(row) > 0))
      ElMessage.warning('部分明细未能排入，请核对规则上限与包装参数')
    else ElMessage.success(`已按规则生成 ${created.length} 包，请核对后保存`)
  }
  function mergeSelected(): void {
    if (!canManual.value) return
    if (!selectedPack.value) return
    selectedBoards.value.forEach((board) => addPieces(board, selectedPack.value!))
    boardTableRef.value?.elTableRef?.clearSelection()
  }
  function addBoard(row: Record<string, unknown>): void {
    const board = typeof row.id === 'string' ? boardById(row.id) : undefined
    if (!board) return
    if (!canManual.value) {
      ElMessage.warning('当前账号没有手动排包权限')
      return
    }
    if (remaining(board) <= 0) {
      ElMessage.info('该明细已全部排包，可在排包结果中调整')
      linkBoard(board)
      return
    }
    const before = remaining(board)
    if (selectedPack.value) addPieces(board, selectedPack.value)
    else {
      selectedBoards.value = [board]
      createPack()
    }
    if (remaining(board) < before) {
      ElMessage.success(`已排入 ${selectedPack.value?.packNo}，尚未保存`)
      linkBoard(board)
    }
  }
  function removeItem(pack: PackDraft, boardId: string): void {
    if (!canManual.value) return
    clearResultSelection()
    pack.items = pack.items.filter((item) => item.boardId !== boardId)
    if (!pack.items.length) {
      packs.value = packs.value.filter((item) => item !== pack)
      selectedPack.value = null
    } else markManual(pack)
    dirty.value = true
  }
  function mergePacks(): void {
    if (!canManual.value || selectedPacks.value.length < 2) return
    const [target, ...sources] = selectedPacks.value
    const rule = selectedRule.value
    if (!rule) {
      ElMessage.warning('请先选择排包规则')
      return
    }
    const merged = cloneDeep(target)
    for (const source of sources) {
      for (const item of source.items) {
        const existing = merged.items.find((entry) => entry.boardId === item.boardId)
        if (existing) existing.pieces += item.pieces
        else merged.items.push({ ...item })
      }
    }
    const issue = validatePlan(
      boards.value,
      packs.value.filter((pack) => pack !== target && !sources.includes(pack)).concat(merged),
      rule
    )
    if (issue) {
      ElMessage.warning(issue)
      return
    }
    target.items = merged.items
    packs.value = packs.value.filter((pack) => !sources.includes(pack))
    selectedPacks.value = []
    selectedPackItems.value = []
    selectedPack.value = target
    clearResultSelection()
    markManual(target)
  }
  async function splitPack(): Promise<void> {
    if (!canManual.value) return
    const source = selectedPack.value
    if (!source || !selectedPackItems.value.length) return
    const chosen = selectedPackItems.value.filter((item) => source.items.includes(item))
    if (!chosen.length) return
    let moved: PackDraft['items']
    if (chosen.length === source.items.length) {
      if (chosen.length !== 1 || chosen[0].pieces < 2) {
        ElMessage.warning('请只选择包内部分明细；单行明细至少需要 2 块才能拆包')
        return
      }
      let pieces: number
      try {
        pieces = Number(
          await promptText(`本行共 ${chosen[0].pieces} 块，请输入移入新包的块数`, '拆包块数', {
            initialValue: '1',
            maxLength: 8
          })
        )
      } catch {
        return
      }
      if (!Number.isInteger(pieces) || pieces < 1 || pieces >= chosen[0].pieces) {
        ElMessage.warning(`拆包块数应为 1～${chosen[0].pieces - 1} 的整数`)
        return
      }
      chosen[0].pieces -= pieces
      moved = [{ ...chosen[0], pieces }]
    } else {
      moved = chosen.map((item) => ({ ...item }))
      source.items = source.items.filter((item) => !chosen.includes(item))
    }
    const created: PackDraft = {
      packNo: nextPackNo(),
      manuallyAdjusted: true,
      confirmed: false,
      remark: '',
      items: moved
    }
    packs.value.push(created)
    selectedPackItems.value = []
    selectedPack.value = created
    clearResultSelection()
    markManual(source)
  }
  async function autoPack(): Promise<void> {
    if (!hasAuth('MesPacking:Auto') || isPublished.value) return
    const rule = selectedRule.value
    if (!rule) {
      ElMessage.warning('当前租户尚未启用板材排包规则')
      return
    }
    if (boards.value.some((board) => board.thicknessMm <= 0)) {
      ElMessage.warning('请先在生产工单专用参数中维护板厚')
      return
    }
    let preserveManual = true
    if (packs.value.length) {
      try {
        await confirm('保留人工调整包，仅对其余板材重新排包？', { title: '自动排包' })
      } catch {
        try {
          await confirm('清空现有排包结果并重新计算？人工调整也会丢失。', { title: '重新计算全部' })
        } catch {
          return
        }
        preserveManual = false
      }
    }
    const proposed = suggestPacks(boards.value, cloneDeep(packs.value), rule, preserveManual)
    clearBoardFilter()
    packs.value = proposed
    selectedPack.value = null
    dirty.value = true
    if (remainingTotal.value)
      ElMessage.warning(`仍有 ${remainingTotal.value} 块未排包，请检查规则上限和板材数据`)
    else ElMessage.success('自动方案已生成，请核对后保存')
  }
  async function save(): Promise<void> {
    if (
      !selectedOrder.value ||
      busy.value ||
      isPublished.value ||
      !hasAuth('MesPacking:Save') ||
      (!dirty.value && !needsRuleBinding.value)
    )
      return
    const rule = selectedRule.value
    if (!rule) {
      ElMessage.warning('请先选择排包规则')
      return
    }
    const issue = validatePlan(boards.value, packs.value, rule)
    if (issue) {
      ElMessage.warning(issue)
      return
    }
    busy.value = true
    try {
      await savePackingPlan(orderId.value, packs.value, revision.value, rule.id)
      ElMessage.success('排包单已保存')
      await loadOrders()
      await loadDetails()
    } catch {
      /* API boundary displays the business error. */
    } finally {
      busy.value = false
    }
  }
  async function publish(): Promise<void> {
    if (
      !selectedOrder.value ||
      !hasAuth('MesPacking:Publish') ||
      busy.value ||
      dirty.value ||
      isPublished.value ||
      !selectedOrder.value.packingRuleId ||
      needsRuleBinding.value ||
      !packs.value.length
    )
      return
    try {
      await confirm('发布后排包明细将锁定；需要修改时可使用“重排包”。是否发布？', {
        title: '发布排包单'
      })
    } catch {
      return
    }
    busy.value = true
    try {
      await setPackingPublication(orderId.value, revision.value, true)
      ElMessage.success('排包单已发布')
      await loadOrders()
      await loadDetails()
    } catch {
      /* API boundary displays the business error. */
    } finally {
      busy.value = false
    }
  }
  async function repack(): Promise<void> {
    if (!selectedOrder.value || !hasAuth('MesPacking:Repack') || busy.value || !isPublished.value)
      return
    try {
      await confirm('重排包后恢复编辑，已保存的排包明细会保留。是否继续？', {
        title: '重排包'
      })
    } catch {
      return
    }
    busy.value = true
    try {
      await setPackingPublication(orderId.value, revision.value, false)
      ElMessage.success('已恢复排包编辑')
      await loadOrders()
      await loadDetails()
    } catch {
      /* API boundary displays the business error. */
    } finally {
      busy.value = false
    }
  }
  watch(
    effectiveTenantId,
    () => {
      clearBoardFilter()
      selectedPack.value = null
      orderId.value = ''
      boards.value = []
      packs.value = []
      void loadOrders()
    },
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .packing-page {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-3);
    min-width: 0;
    min-height: 0;
  }

  .packing-page__content {
    flex: 1;
    min-height: 0;
  }

  .packing-page__orders,
  .packing-page__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .packing-page__orders :deep(.art-section-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--art-space-3);
    min-height: 0;
  }

  .packing-page__filters,
  .packing-page__rule-field {
    display: grid;
    gap: var(--art-space-2);
    min-width: 0;
  }

  .packing-page__filters .el-date-editor,
  .packing-page__rule-field .el-select {
    width: 100%;
  }

  .packing-page__filters :deep(.el-date-editor) {
    width: 100% !important;
    min-width: 0;
    max-width: 100%;
  }

  .packing-page__rule-field {
    padding-top: var(--art-space-3);
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .packing-page__rule-field > span {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-regular);
  }

  .packing-page__order-scroll {
    flex: 1;
    min-height: 180px;
  }

  .packing-page__order-list {
    display: grid;
    gap: 4px;
    padding-right: 8px;
  }

  .packing-page__order {
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 10px 12px;
    text-align: left;
    cursor: pointer;
    background: var(--default-box-color);
    border: 1px solid transparent;
    border-radius: var(--art-control-radius);
  }

  .packing-page__order:hover {
    background: var(--art-gray-100);
  }

  .packing-page__order.is-selected {
    background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
    border-color: var(--theme-color);
  }

  .packing-page__order:focus-visible {
    outline: 2px solid var(--theme-color);
    outline-offset: 2px;
  }

  .packing-page__order-top,
  .packing-page__order-bottom {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    min-width: 0;
  }

  .packing-page__order-name {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  .packing-page__order-top strong {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
  }

  .packing-page__order-top > span,
  .packing-page__order-bottom {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .packing-page__order-bottom > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .packing-page__single-state,
  .packing-page__start {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;

    :deep(.art-section-card__body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: center;
      min-height: 0;
    }
  }

  .packing-page__workspace {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--art-space-3);
    min-width: 0;
    min-height: 0;
  }

  .packing-page__panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .packing-page__panel :deep(.art-section-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--art-space-3);
    min-height: 0;
  }

  .packing-page__toolbar {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--art-space-2);
    align-items: center;

    :deep(.el-button + .el-button) {
      margin-left: 0;
    }
  }

  .packing-page__panel :deep(.art-table) {
    flex: 1 1 0;
    min-height: 0;
  }

  .packing-page__panel :deep(.el-table) {
    margin-top: 0;
  }

  .packing-page__linkage {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: 4px 12px;
    justify-content: space-between;
    padding: 8px 10px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
    border-radius: var(--art-control-radius);
  }

  .packing-page__result-note,
  .packing-page__order-progress {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .packing-page__result-note {
    flex: none;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .packing-page__panel :deep(.packing-page__complete) {
    background: var(--el-color-warning-light-9);
  }

  @media (width <= 1000px) {
    .packing-page {
      height: auto;
      min-height: 100%;
    }

    .packing-page__results {
      flex: none;
      height: 480px;
    }
  }
</style>
