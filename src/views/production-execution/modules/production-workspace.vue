<template>
  <ArtPermissionGuard permission="MesProductionReport:View" resource-name="生产报工">
    <div class="production-workspace business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        :title="entry === 'report' ? '工序报工' : '生产报工'"
        description="以工作中心和工序任务为主线，完成开工、人员打卡、报工及现场记录。"
        icon="ri:play-list-2-line"
        density="compact"
        refreshable
        :refresh-loading="loading"
        @refresh="reload"
        ><template #actions
          ><ElButton
            v-if="entry === 'report'"
            v-auth="'MesProductionReport:Report'"
            type="primary"
            :disabled="!selectedTask?.startedAt"
            @click="chooseAction('report')"
            ><ArtSvgIcon icon="ri:edit-box-line" />提交工序报工</ElButton
          ></template
        ></BusinessWorkspaceHeader
      >
      <ArtWorkspaceSplitter
        class="production-workspace__layout"
        primary-size="270px"
        primary-min="240px"
        primary-max="360px"
        :breakpoint="1000"
      >
        <template #primary>
          <aside class="production-workspace__scope">
            <ProductionWorkCenterNavigator
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
            />
          </aside>
        </template>
        <div class="production-workspace__content">
          <div class="production-workspace__filters art-card-xs">
            <ElDatePicker
              v-model="dueStartDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="要求完工起始日"
              clearable
              aria-label="要求完工起始日"
            />
            <ElDatePicker
              v-model="dueEndDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="要求完工截至日"
              clearable
              aria-label="要求完工截至日"
            />
            <ElSelect v-model="shiftName" clearable placeholder="全部班次"
              ><ElOption v-for="shift in shifts" :key="shift" :value="shift" :label="shift"
            /></ElSelect>
            <ElSelect
              v-model="completionFilter"
              multiple
              collapse-tags
              clearable
              placeholder="工序状态"
            >
              <ElOption
                v-for="option in completionOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </ElSelect>
            <ElInput
              v-model="keyword"
              clearable
              placeholder="任务、工单、物料或项目"
              aria-label="组合查询"
              ><template #prefix><ArtSvgIcon icon="ri:search-line" /></template
            ></ElInput>
            <ElButton :loading="resetting" @click="resetFilters">重置</ElButton>
            <span class="production-workspace__result">共 {{ total }} 项任务</span>
          </div>
          <div class="production-workspace__three">
            <ArtSectionCard
              :show-scrollbar="false"
              class="production-workspace__task-card"
              title="工序任务一览"
              :subtitle="
                scope.selectedWorkCenterId ? selectedCenter?.name || '当前工作中心' : '全部工作中心'
              "
              :loading="loading"
              :error="error"
              :empty="hasLoaded && !error && tasks.length === 0"
              empty-title="当前条件下暂无工序任务"
              empty-description="调整工作中心或查询条件后重试。"
              retryable
              :min-height="480"
              @retry="loadTasks"
            >
              <ElScrollbar class="production-workspace__task-list">
                <div class="production-workspace__task-list-inner">
                  <button
                    v-for="item in tasks"
                    :key="item.id"
                    type="button"
                    class="production-workspace__task"
                    :class="{ 'is-active': item.id === selectedTask?.id }"
                    :aria-pressed="item.id === selectedTask?.id"
                    @click="selectTask(item)"
                  >
                    <span class="production-workspace__task-top"
                      ><strong>{{ item.workOrder?.workOrderNo || '—' }}</strong
                      ><ElTag
                        size="small"
                        :type="item.operationStatus === 'completed' ? 'success' : 'primary'"
                        effect="plain"
                        >{{ taskStatus(item) }}</ElTag
                      ></span
                    >
                    <span
                      class="production-workspace__task-no"
                      :title="`${item.taskNo} · ${item.workOrder?.workOrderTypeNameSnapshot || '生产任务'} · ${item.workOrder?.projectNameSnapshot || '无项目'}`"
                      >{{ item.taskNo }} ·
                      {{ item.workOrder?.workOrderTypeNameSnapshot || '生产任务' }} ·
                      {{ item.workOrder?.projectNameSnapshot || '无项目' }}</span
                    >
                    <span class="production-workspace__task-name"
                      >{{ item.sequenceNo }} / {{ item.operationCode }}
                      {{ item.operationName }}</span
                    >
                    <span
                      class="production-workspace__task-product"
                      :title="`${item.workOrder?.materialCodeSnapshot || '—'} · ${item.workOrder?.materialNameSnapshot || '—'}`"
                      >{{ item.workOrder?.materialCodeSnapshot }} ·
                      {{ item.workOrder?.materialNameSnapshot }}</span
                    >
                    <span class="production-workspace__task-bottom"
                      ><span
                        >{{ item.completedQuantity }} / {{ item.plannedQuantity }} ·
                        {{ taskPlannedHours(item) }}</span
                      ><span>{{ taskPercent(item) }}%</span></span
                    >
                    <ElProgress
                      :percentage="taskPercent(item)"
                      :show-text="false"
                      :stroke-width="5"
                    />
                  </button>
                </div>
              </ElScrollbar>
              <ElPagination
                v-model:current-page="page"
                small
                background
                layout="prev, pager, next"
                :page-size="20"
                :total="total"
                class="production-workspace__pager"
              />
            </ArtSectionCard>
            <ElScrollbar class="production-workspace__detail-scroll">
              <div class="production-workspace__detail-column">
                <ArtSectionCard
                  title="任务详情"
                  subtitle="当前任务的生产与工序信息"
                  :empty="!selectedTask"
                  empty-title="请选择一项工序任务"
                  empty-description="从左侧任务列表选择后查看生产进度与可执行操作。"
                  :min-height="290"
                >
                  <template v-if="selectedTask">
                    <div class="production-workspace__hero"
                      ><span>任务单号</span><strong>{{ selectedTask.taskNo }}</strong
                      ><ElTag :type="selectedTask.startedAt ? 'success' : 'info'" effect="plain">{{
                        selectedTask.startedAt ? '已开工' : '待开工'
                      }}</ElTag></div
                    >
                    <div class="production-workspace__primary-actions">
                      <ElButton
                        v-auth="'MesProductionReport:Start'"
                        :type="selectedTask.startedAt ? 'default' : 'primary'"
                        :disabled="Boolean(selectedTask.startedAt) || starting"
                        :loading="starting"
                        @click="chooseAction('start')"
                      >
                        <ArtSvgIcon icon="ri:play-circle-line" />{{
                          selectedTask.startedAt ? '已开工' : '开始加工'
                        }}
                      </ElButton>
                      <ElButton
                        v-auth="'MesProductionReport:Report'"
                        :type="selectedTask.startedAt ? 'primary' : 'default'"
                        :disabled="!selectedTask.startedAt"
                        @click="chooseAction('report')"
                      >
                        <ArtSvgIcon icon="ri:edit-box-line" />工序报工
                      </ElButton>
                      <ElButton
                        v-auth="'MesProductionReport:Feed'"
                        :disabled="!selectedTask.startedAt || !materials.length"
                        @click="openConsoleAction('feeding')"
                      >
                        <ArtSvgIcon icon="ri:archive-line" />记录投料
                      </ElButton>
                    </div>
                    <div class="production-workspace__facts">
                      <div
                        ><span>工序</span
                        ><strong
                          >{{ selectedTask.operationCode }} ·
                          {{ selectedTask.operationName }}</strong
                        ></div
                      >
                      <div
                        ><span>序列</span
                        ><strong
                          >{{ selectedTask.sequenceNo }} / {{ selectedTask.sequenceType }}</strong
                        ></div
                      >
                      <div
                        ><span>工作中心</span
                        ><strong
                          >{{ selectedTask.workCenter?.code }} ·
                          {{ selectedTask.workCenter?.name }}</strong
                        ></div
                      >
                      <div
                        ><span>要求完工</span
                        ><strong>{{ selectedTask.requiredCompletionDate || '—' }}</strong></div
                      >
                      <div
                        ><span>计划 / 已审批</span
                        ><strong
                          >{{ selectedTask.plannedQuantity }} /
                          {{ selectedTask.completedQuantity }}</strong
                        ></div
                      >
                      <div
                        ><span>开始加工</span
                        ><strong>{{ formatDateTime(selectedTask.startedAt) }}</strong></div
                      >
                    </div>
                    <ElProgress :percentage="taskPercent(selectedTask)" :stroke-width="8" />
                  </template>
                </ArtSectionCard>
                <ArtSectionCard
                  title="任务信息"
                  subtitle="生产工单与产品快照"
                  :empty="!selectedTask"
                  empty-title="请选择一项工序任务"
                  empty-description="从左侧选择任务后查看工单与产品信息。"
                  :min-height="240"
                >
                  <template v-if="selectedTask">
                    <div class="production-workspace__order-flow"
                      ><span
                        v-for="step in orderSteps"
                        :key="step"
                        :class="{ 'is-current': step === orderStep }"
                        >{{ step }}</span
                      ></div
                    >
                    <div class="production-workspace__facts">
                      <div
                        ><span>生产工单</span
                        ><strong>{{ selectedTask.workOrder?.workOrderNo || '—' }}</strong></div
                      >
                      <div
                        ><span>项目名称</span
                        ><strong>{{
                          selectedTask.workOrder?.projectNameSnapshot || '—'
                        }}</strong></div
                      >
                      <div
                        ><span>物料</span
                        ><strong
                          >{{ selectedTask.workOrder?.materialCodeSnapshot }}
                          {{ selectedTask.workOrder?.materialNameSnapshot }}</strong
                        ></div
                      >
                      <div
                        ><span>规格 / 图号</span
                        ><strong
                          >{{ selectedTask.workOrder?.specificationSnapshot || '—' }} /
                          {{ selectedTask.workOrder?.drawingNoSnapshot || '—' }}</strong
                        ></div
                      >
                    </div>
                  </template>
                </ArtSectionCard>
              </div>
            </ElScrollbar>
            <ArtSectionCard
              :show-scrollbar="false"
              class="production-workspace__attendance"
              title="出勤记录"
              subtitle="上机、下机时间与现场人员"
              :empty="!selectedTask"
              empty-title="请选择一项工序任务"
              empty-description="从左侧选择任务后查看现场人员出勤。"
              :min-height="400"
            >
              <template #actions
                ><ElButton
                  v-if="selectedTask"
                  v-auth="'MesProductionReport:Clock'"
                  link
                  type="primary"
                  @click="openClock('in')"
                  ><template #icon><ArtSvgIcon icon="ri:time-line" /></template>上机打卡</ElButton
                ></template
              >
              <template v-if="selectedTask">
                <div class="production-workspace__attendance-summary"
                  ><strong>{{ activeAttendance.length }}</strong
                  ><span>当前在岗人员</span></div
                >
                <ElScrollbar v-if="attendance.length" class="production-workspace__attendance-list">
                  <div class="production-workspace__attendance-list-inner">
                    <article v-for="item in attendance" :key="item.id"
                      ><span class="production-workspace__avatar">{{
                        item.person?.name?.slice(0, 1) || '人'
                      }}</span
                      ><div
                        ><strong>{{ item.person?.name || '—' }}</strong
                        ><small>上机 {{ formatDateTime(item.clockInAt) }}</small
                        ><small>下机 {{ formatDateTime(item.clockOutAt) }}</small></div
                      ><ElButton
                        v-if="!item.clockOutAt"
                        v-auth="'MesProductionReport:Clock'"
                        link
                        @click="clockOut(item.personnelId)"
                        >下机</ElButton
                      ></article
                    >
                  </div>
                </ElScrollbar>
                <ArtEmptyState
                  v-else
                  title="暂无打卡记录"
                  description="人员上下机打卡后，可在此查看记录。"
                  size="compact"
                  :visual-size="64"
                />
              </template>
            </ArtSectionCard>
          </div>
        </div>
      </ArtWorkspaceSplitter>
      <ElButton
        v-if="selectedTask"
        class="production-workspace__console-button"
        type="primary"
        size="large"
        round
        @click="openConsole"
        ><ArtSvgIcon icon="ri:apps-2-line" />操作台</ElButton
      >
      <ArtDrawer ref="consoleRef" size="lg" :show-footer="false">
        <div v-if="selectedTask" class="production-workspace__console">
          <div class="production-workspace__console-intro"
            ><small>{{ selectedTask.workCenter?.name }} · {{ selectedTask.taskNo }}</small
            ><h3>{{ consoleTitle }}</h3
            ><p>所有现场操作均关联当前工作中心与工序任务。</p></div
          >
          <div v-if="consoleMode === 'menu'" class="production-workspace__console-grid">
            <button
              v-for="action in consoleActions"
              :key="action.id"
              v-auth="action.permission"
              type="button"
              @click="chooseAction(action.id)"
              ><ArtSvgIcon :icon="action.icon" /><span>{{ action.label }}</span></button
            >
          </div>
          <div v-else class="production-workspace__console-panel"
            ><ElButton link @click="consoleMode = 'menu'"
              ><ArtSvgIcon icon="ri:arrow-left-line" />返回操作台</ElButton
            >
            <ExecutionEventWorkspace
              v-if="selectedEventMode"
              :key="consoleMode"
              :mode="selectedEventMode"
              embedded
              :task-id="selectedTask.id"
              :work-center-id="selectedTask.workCenterId || ''"
              :initial-kind="eventKinds[consoleMode]"
            />
            <template v-else-if="consoleMode === 'esop'"
              ><ArtSectionTitle>工序作业要求</ArtSectionTitle
              ><p>{{ selectedTask.processContent || '当前工序暂未维护作业内容。' }}</p
              ><div v-if="sopDocuments.length" class="production-workspace__sop-list"
                ><div v-for="document in sopDocuments" :key="document.id"
                  ><a
                    v-if="document.url"
                    :href="document.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ document.name || document.id }}</a
                  ><span v-else>{{ document.name || document.id }} · 附件未配置</span></div
                ></div
              ><ArtEmptyState
                v-else
                title="当前工序没有关联 ESOP 文档"
                description="关联作业指导文件后，可在此查看。"
                size="compact"
                :visual-size="72"
            /></template>
            <template v-else-if="consoleMode === 'feeding'"
              ><div class="production-workspace__feed-heading"
                ><ArtSectionTitle>本工序投料清单</ArtSectionTitle
                ><ElButton
                  v-auth="'MesProductionReport:Feed'"
                  type="primary"
                  :disabled="!materials.length"
                  @click="openFeed"
                  ><ArtSvgIcon icon="ri:add-line" />记录投料</ElButton
                ></div
              ><ArtTableQuery
                :data="materials"
                :table-columns="feedColumns"
                :table-props="{
                  rowKey: 'component_material_code',
                  height: 'auto',
                  emptyText: '当前工序未分配投料物料'
                }"
                :table-header-props="{
                  layout: 'size,fullscreen,columns,settings'
                }" /><ArtSectionTitle>投料记录</ArtSectionTitle
              ><div v-if="feedRows.length" class="production-workspace__feed-list"
                ><article v-for="row in feedRows" :key="row.id"
                  ><strong>{{ row.details.materialCode }} · {{ row.details.materialName }}</strong
                  ><span
                    >{{ row.quantity }} {{ row.details.unitName }} ·
                    {{ formatDateTime(row.occurredAt) }}</span
                  ><small
                    >批次 {{ row.details.batchNo || '—' }} · {{ row.actorName || '—' }}</small
                  ></article
                ></div
              ><ArtEmptyState
                v-else
                title="当前任务暂无投料记录"
                description="记录投料后，可在此追溯批次与数量。"
                size="compact"
                :visual-size="64"
            /></template>
            <template v-else-if="consoleMode === 'task'"
              ><ElDescriptions :column="detailColumns" border
                ><ElDescriptionsItem label="任务单号">{{ selectedTask.taskNo }}</ElDescriptionsItem
                ><ElDescriptionsItem label="生产工单">{{
                  selectedTask.workOrder?.workOrderNo
                }}</ElDescriptionsItem
                ><ElDescriptionsItem label="工序"
                  >{{ selectedTask.operationCode }}
                  {{ selectedTask.operationName }}</ElDescriptionsItem
                ><ElDescriptionsItem label="计划数量">{{
                  selectedTask.plannedQuantity
                }}</ElDescriptionsItem
                ><ElDescriptionsItem label="已审批良品">{{
                  selectedTask.completedQuantity
                }}</ElDescriptionsItem
                ><ElDescriptionsItem label="工作中心">{{
                  selectedTask.workCenter?.name
                }}</ElDescriptionsItem></ElDescriptions
              ></template
            >
          </div>
        </div>
      </ArtDrawer>
      <ArtDialog ref="clockDialogRef" size="sm" :show-fullscreen-button="false"
        ><ArtForm
          ref="clockFormRef"
          :model-value="clockForm"
          @update:model-value="replaceReactiveModel(clockForm, $event)"
          :items="[]"
          :rules="clockRules"
          custom-layout
          :show-reset="false"
          :show-submit="false"
          root-class="p-0! md:p-0!"
          ><ElFormItem label="上机人员" prop="personIds" required
            ><ArtUserSelect
              v-model="clockForm.personIds"
              :options="userOptions"
              :clearable="false"
              multiple
              placeholder="请选择上机人员" /></ElFormItem></ArtForm
      ></ArtDialog>
      <ArtDialog ref="feedDialogRef" size="md" :show-fullscreen-button="false"
        ><ArtForm
          ref="feedFormRef"
          :model-value="feedForm"
          @update:model-value="replaceReactiveModel(feedForm, $event)"
          :items="[]"
          :rules="feedRules"
          custom-layout
          :show-reset="false"
          :show-submit="false"
          root-class="p-0! md:p-0!"
          ><ElFormItem label="投料物料" prop="materialCode" required
            ><ElSelect v-model="feedForm.materialCode" filterable placeholder="选择本工序物料"
              ><ElOption
                v-for="item in materials"
                :key="item.component_material_code"
                :value="item.component_material_code || ''"
                :label="`${item.component_material_code} · ${item.component_material_name}`" /></ElSelect></ElFormItem
          ><ElFormItem label="投料数量" prop="quantity" required
            ><ElInputNumber
              v-model="feedForm.quantity"
              :min="0.01"
              :precision="2"
              controls-position="right" /></ElFormItem
          ><ElFormItem label="批次号"
            ><ElInput v-model="feedForm.batchNo" maxlength="80" /></ElFormItem
          ><ElFormItem label="投料人员"
            ><ArtUserSelect
              v-model="feedForm.personId"
              :options="userOptions"
              placeholder="选择投料人员" /></ElFormItem
          ><ElFormItem label="备注"
            ><ElInput
              v-model="feedForm.remark"
              type="textarea"
              :rows="2"
              maxlength="500" /></ElFormItem></ArtForm
      ></ArtDialog>
      <ProductionReportForm ref="reportFormRef" @saved="reload" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import { ElMessage, type FormRules } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTableQuery from '@/components/core/tables/art-table-query/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import ArtUserSelect from '@/components/core/forms/art-user-select/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import ProductionWorkCenterNavigator from '@/components/business/production-work-center-navigator/index.vue'
  import {
    clockExecution,
    fetchExecutionAttendance,
    fetchExecutionEsopDocuments,
    fetchExecutionEvents,
    fetchExecutionPeople,
    fetchExecutionShiftNames,
    fetchExecutionTasks,
    saveExecutionEvent,
    startExecution,
    type MesExecutionAttendance,
    type MesExecutionEsopDocument,
    type MesExecutionEvent,
    type MesExecutionEventKind,
    type MesExecutionPerson,
    type MesExecutionTask
  } from '@mes/api'
  import { useExecutionScope } from './use-execution-scope'
  import { buildExecutionUserOptions } from './execution-user-options'
  import ExecutionEventWorkspace from './execution-event-workspace.vue'
  import ProductionReportForm from './production-report-form.vue'

  const completionOptions = useDictionaryOptions('mesProductionCompletionFilter')

  type ConsoleMode =
    | 'menu'
    | 'esop'
    | 'feeding'
    | 'task'
    | 'andon'
    | 'exception'
    | 'misc_piece'
    | 'misc_report'
    | 'inspection_first'
    | 'inspection_patrol'
    | 'inspection_final'
    | 'inspection_detail'
    | 'mold'
    | 'equipment'
  withDefaults(defineProps<{ entry?: 'workspace' | 'report' }>(), { entry: 'workspace' })
  const {
    scope,
    effectiveTenantId,
    workshopOptions,
    visibleCenters,
    selectedCenter,
    departmentIds,
    loadScope,
    selectWorkshop,
    selectWorkCenter
  } = useExecutionScope()
  const dueStartDate = ref('')
  const dueEndDate = ref(dayjs().add(3, 'day').format('YYYY-MM-DD'))
  const completionFilter = ref(['unreported', 'partial'])
  const keyword = ref('')
  const shiftName = ref('')
  const shifts = ref<string[]>([])
  const tasks = ref<MesExecutionTask[]>([])
  const total = ref(0)
  const page = ref(1)
  const selectedTask = ref<MesExecutionTask | null>(null)
  const attendance = ref<MesExecutionAttendance[]>([])
  const people = ref<MesExecutionPerson[]>([])
  const userOptions = computed(() => buildExecutionUserOptions(people.value))
  const loading = ref(false)
  const starting = ref(false)
  const hasLoaded = ref(false)
  const resetting = ref(false)
  const error = ref('')
  const consoleRef = ref<ArtDrawerExpose>()
  const clockDialogRef = ref<ArtDialogExpose>()
  const clockFormRef = ref<InstanceType<typeof ArtForm>>()
  const feedDialogRef = ref<ArtDialogExpose>()
  const feedFormRef = ref<InstanceType<typeof ArtForm>>()
  const reportFormRef = ref<InstanceType<typeof ProductionReportForm>>()
  const compactDetail = useMediaQuery('(max-width: 640px)')
  const detailColumns = computed(() => (compactDetail.value ? 1 : 2))
  const clockForm = reactive({ personIds: [] as string[] })
  const clockRules: FormRules = {
    personIds: [
      { type: 'array', required: true, min: 1, message: '请选择上机人员', trigger: 'change' }
    ]
  }
  const feedRows = ref<MesExecutionEvent[]>([])
  const esopDocuments = ref<MesExecutionEsopDocument[]>([])
  const feedForm = reactive({
    materialCode: '',
    quantity: 1,
    batchNo: '',
    personId: '',
    remark: ''
  })
  const feedRules: FormRules = {
    materialCode: [{ required: true, message: '请选择投料物料', trigger: 'change' }],
    quantity: [{ type: 'number', min: 0.01, message: '投料数量必须大于零', trigger: 'change' }]
  }
  const consoleMode = ref<ConsoleMode>('menu')
  const activeAttendance = computed(() => attendance.value.filter((item) => !item.clockOutAt))
  const orderSteps = ['创建', '下达', '部分报工', '已报工', '部分交货', '已交货', '结案', '关闭']
  const orderStep = computed(() => {
    const status = selectedTask.value?.workOrder?.orderStatus || ''
    return (
      (
        {
          draft: '创建',
          released: '下达',
          partially_reported: '部分报工',
          reported: '已报工',
          partially_delivered: '部分交货',
          delivered: '已交货',
          settled: '结案',
          closed: '关闭'
        } as Record<string, string>
      )[status] || '下达'
    )
  })
  const eventModes: Partial<
    Record<
      ConsoleMode,
      'andon' | 'exception' | 'misc_piece' | 'misc_report' | 'inspection' | 'mold' | 'equipment'
    >
  > = {
    andon: 'andon',
    exception: 'exception',
    misc_piece: 'misc_piece',
    misc_report: 'misc_report',
    inspection_first: 'inspection',
    inspection_patrol: 'inspection',
    inspection_final: 'inspection',
    inspection_detail: 'inspection',
    mold: 'mold',
    equipment: 'equipment'
  }
  const selectedEventMode = computed(() => eventModes[consoleMode.value])
  const eventKinds: Partial<Record<ConsoleMode, MesExecutionEventKind>> = {
    inspection_first: 'inspection_first',
    inspection_patrol: 'inspection_patrol',
    inspection_final: 'inspection_final',
    inspection_detail: 'inspection_first'
  }
  const consoleActions: Array<{
    id: ConsoleMode | 'start' | 'report'
    label: string
    icon: string
    permission: string
  }> = [
    {
      id: 'start',
      label: '开始加工',
      icon: 'ri:play-circle-line',
      permission: 'MesProductionReport:Start'
    },
    {
      id: 'report',
      label: '工序报工',
      icon: 'ri:edit-box-line',
      permission: 'MesProductionReport:Report'
    },
    { id: 'andon', label: '安灯请求', icon: 'ri:alarm-warning-line', permission: 'MesAndon:View' },
    {
      id: 'exception',
      label: '异常上报',
      icon: 'ri:error-warning-line',
      permission: 'MesException:View'
    },
    {
      id: 'misc_piece',
      label: '杂项计件',
      icon: 'ri:coins-line',
      permission: 'MesMiscPiecework:View'
    },
    {
      id: 'misc_report',
      label: '杂项报工',
      icon: 'ri:time-line',
      permission: 'MesMiscReport:View'
    },
    {
      id: 'inspection_first',
      label: '首检',
      icon: 'ri:shield-check-line',
      permission: 'MesInspection:View'
    },
    {
      id: 'inspection_patrol',
      label: '自检 / 巡检',
      icon: 'ri:search-eye-line',
      permission: 'MesInspection:View'
    },
    {
      id: 'inspection_final',
      label: '末检',
      icon: 'ri:checkbox-circle-line',
      permission: 'MesInspection:View'
    },
    {
      id: 'inspection_detail',
      label: '检验详情',
      icon: 'ri:file-search-line',
      permission: 'MesInspection:View'
    },
    { id: 'mold', label: '上下模', icon: 'ri:tools-line', permission: 'MesMold:View' },
    {
      id: 'esop',
      label: 'ESOP',
      icon: 'ri:file-text-line',
      permission: 'MesProductionReport:View'
    },
    {
      id: 'feeding',
      label: '投料',
      icon: 'ri:archive-line',
      permission: 'MesProductionReport:Feed'
    },
    {
      id: 'equipment',
      label: '设备管理',
      icon: 'ri:settings-3-line',
      permission: 'MesEquipment:View'
    },
    {
      id: 'task',
      label: '任务详情',
      icon: 'ri:list-check-3',
      permission: 'MesProductionReport:View'
    }
  ]
  const consoleTitle = computed(() =>
    consoleMode.value === 'menu'
      ? '现场操作台'
      : consoleActions.find((item) => item.id === consoleMode.value)?.label || '现场操作'
  )
  const routeStepFor = (task: MesExecutionTask) =>
    task.workOrder?.routeSnapshot?.steps?.find(
      (step) => step.id === task.routeStepSnapshotId || step.code === task.operationCode
    )
  const currentStep = computed(() =>
    selectedTask.value ? routeStepFor(selectedTask.value) : undefined
  )
  const taskPlannedHours = (task: MesExecutionTask) => {
    const step = routeStepFor(task)
    const minutes = Number(step?.run_processing_minutes || 0)
    const perRun = Number(step?.run_output_quantity || 0)
    return minutes > 0 && perRun > 0
      ? `标准 ${((task.plannedQuantity * minutes) / perRun / 60).toFixed(1)} h`
      : '标准工时待配置'
  }
  const sopDocuments = computed(() =>
    (currentStep.value?.sop_documents || []).map((item) => {
      const document = esopDocuments.value.find((entry) => entry.id === item.id)
      return {
        id: item.id,
        name: document?.documentName || item.name || item.id,
        url: document?.attachmentUrl || item.url || ''
      }
    })
  )
  const materials = computed(
    () =>
      selectedTask.value?.workOrder?.bomSnapshot
        ?.flatMap((bom) => bom.items || [])
        .filter(
          (item) =>
            item.assigned_route_step_id === selectedTask.value?.routeStepSnapshotId ||
            (!item.assigned_route_step_id &&
              item.assigned_operation_code === selectedTask.value?.operationCode)
        ) || []
  )
  const feedColumns: ColumnOption[] = [
    { prop: 'component_material_code', label: '物料编码', minWidth: 150 },
    { prop: 'component_material_name', label: '物料名称', minWidth: 160 },
    { prop: 'component_specification', label: '规格', minWidth: 120 },
    { prop: 'required_quantity', label: '需求数量', minWidth: 100 },
    { prop: 'unit_name', label: '单位', minWidth: 80 }
  ]
  const taskPercent = (item: MesExecutionTask) =>
    item.plannedQuantity > 0
      ? Math.min(100, Math.round((item.completedQuantity / item.plannedQuantity) * 100))
      : 0
  const taskStatus = (item: MesExecutionTask) =>
    ['completed', 'closed'].includes(item.operationStatus)
      ? '已报工'
      : item.completedQuantity > 0
        ? '部分报工'
        : '未报工'
  const formatDateTime = (value: string | null | undefined) =>
    value ? dayjs(value).format('MM-DD HH:mm') : '—'

  let taskVersion = 0
  async function loadTasks() {
    const version = ++taskVersion
    loading.value = true
    hasLoaded.value = false
    tasks.value = []
    total.value = 0
    error.value = ''
    try {
      const result = await fetchExecutionTasks({
        current: page.value,
        size: 20,
        tenantId: effectiveTenantId.value,
        workCenterId: scope.selectedWorkCenterId || undefined,
        departmentIds: departmentIds.value,
        dateRange:
          dueStartDate.value || dueEndDate.value
            ? [dueStartDate.value, dueEndDate.value]
            : undefined,
        keyword: keyword.value,
        statuses: completionFilter.value,
        shiftName: shiftName.value
      })
      if (version !== taskVersion) return
      tasks.value = result.data
      total.value = result.total
      hasLoaded.value = true
      selectedTask.value =
        result.data.find((item) => item.id === selectedTask.value?.id) || result.data[0] || null
      void loadAttendance()
    } catch {
      if (version === taskVersion) error.value = '任务加载失败，请重试'
    } finally {
      if (version === taskVersion) loading.value = false
    }
  }
  async function loadAttendance() {
    if (!selectedTask.value) {
      attendance.value = []
      return
    }
    try {
      attendance.value = await fetchExecutionAttendance(selectedTask.value.id)
    } catch {
      attendance.value = []
      ElMessage.error('出勤记录加载失败')
    }
  }
  async function loadFeedRows() {
    if (!selectedTask.value) {
      feedRows.value = []
      return
    }
    try {
      feedRows.value = (
        await fetchExecutionEvents({
          current: 1,
          size: 100,
          taskId: selectedTask.value.id,
          kinds: ['material_feed']
        })
      ).data
    } catch {
      feedRows.value = []
      ElMessage.error('投料记录加载失败')
    }
  }
  async function loadEsopDocuments() {
    const task = selectedTask.value
    if (!task) {
      esopDocuments.value = []
      return
    }
    const ids = (currentStep.value?.sop_documents || [])
      .filter((item) => item.type === 'esop')
      .map((item) => item.id)
    try {
      esopDocuments.value = await fetchExecutionEsopDocuments(ids, task.tenantId)
    } catch {
      esopDocuments.value = []
      ElMessage.error('ESOP 文档加载失败')
    }
  }
  async function reload() {
    await Promise.all([loadTasks(), loadAttendance()])
  }
  function selectTask(item: MesExecutionTask) {
    selectedTask.value = item
    void Promise.all([loadAttendance(), loadFeedRows(), loadEsopDocuments()])
  }
  async function resetFilters() {
    if (resetting.value) return
    resetting.value = true
    dueStartDate.value = ''
    dueEndDate.value = dayjs().add(3, 'day').format('YYYY-MM-DD')
    completionFilter.value = ['unreported', 'partial']
    keyword.value = ''
    shiftName.value = ''
    page.value = 1
    await nextTick()
    try {
      await loadTasks()
    } finally {
      resetting.value = false
    }
  }
  function openConsole() {
    consoleMode.value = 'menu'
    consoleRef.value?.handleOpen(undefined, { title: '生产操作台' })
  }
  function openConsoleAction(id: ConsoleMode) {
    openConsole()
    void chooseAction(id)
  }
  async function chooseAction(id: ConsoleMode | 'start' | 'report') {
    const task = selectedTask.value
    if (!task) return
    if (id === 'start') {
      if (starting.value || task.startedAt) return
      if (!task.workCenterId) {
        ElMessage.warning('请先为任务分配工作中心')
        return
      }
      starting.value = true
      try {
        await startExecution(task.id, task.workCenterId)
        await loadTasks()
      } catch {
        /* shared API displays the error */
      } finally {
        starting.value = false
      }
      return
    }
    if (id === 'report') {
      if (!task.startedAt) {
        ElMessage.warning('请先开始加工')
        return
      }
      reportFormRef.value?.open(task, people.value)
      return
    }
    consoleMode.value = id
    if (id === 'feeding') void loadFeedRows()
    if (id === 'esop') void loadEsopDocuments()
  }
  function openFeed() {
    const task = selectedTask.value
    if (!task?.workCenterId || !materials.value.length) return
    Object.assign(feedForm, {
      materialCode: materials.value[0]?.component_material_code || '',
      quantity: 1,
      batchNo: '',
      personId: '',
      remark: ''
    })
    void nextTick(() => feedFormRef.value?.clearValidate())
    feedDialogRef.value?.handleOpen(undefined, {
      title: '记录投料',
      onConfirm: async () => {
        const material = materials.value.find(
          (item) => item.component_material_code === feedForm.materialCode
        )
        try {
          if (!(await validateArtFormForSubmit(feedFormRef.value))) return false
        } catch (error) {
          notifyFriendlyError(error, '投料内容校验失败，请重试')
          return false
        }
        if (!material) {
          ElMessage.warning('所选物料已不可用，请重新选择')
          return false
        }
        try {
          await saveExecutionEvent({
            kind: 'material_feed',
            taskId: task.id,
            workCenterId: task.workCenterId,
            action: 'create',
            payload: {
              title: `投料 ${material.component_material_code}`,
              quantity: feedForm.quantity,
              handlerPersonId: feedForm.personId || null,
              details: {
                materialCode: material.component_material_code,
                materialName: material.component_material_name,
                unitName: material.unit_name,
                batchNo: feedForm.batchNo.trim()
              },
              media: [],
              remark: feedForm.remark.trim()
            }
          })
        } catch (error) {
          notifyFriendlyError(error, '投料记录保存失败，请检查内容后重试')
          return false
        }
        await loadFeedRows()
        return true
      }
    })
  }
  function openClock(direction: 'in' | 'out') {
    if (!selectedTask.value) return
    if (direction === 'out') return
    clockForm.personIds = []
    void nextTick(() => clockFormRef.value?.clearValidate())
    clockDialogRef.value?.handleOpen(undefined, {
      title: '上机打卡',
      onConfirm: async () => {
        if (!selectedTask.value) return false
        try {
          if (!(await validateArtFormForSubmit(clockFormRef.value))) return false
        } catch (error) {
          notifyFriendlyError(error, '上机打卡人员校验失败，请重试')
          return false
        }
        try {
          await clockExecution(selectedTask.value.id, clockForm.personIds, 'in')
        } catch (error) {
          notifyFriendlyError(error, '上机打卡失败，请稍后重试')
          return false
        }
        await loadAttendance()
        return true
      }
    })
  }
  async function clockOut(personId: string) {
    if (!selectedTask.value) return
    try {
      await clockExecution(selectedTask.value.id, [personId], 'out')
      await loadAttendance()
    } catch {
      /* shared API displays the error */
    }
  }
  watch(
    [
      () => scope.selectedWorkCenterId,
      () => scope.selectedWorkshopId,
      effectiveTenantId,
      page,
      dueStartDate,
      dueEndDate,
      completionFilter,
      keyword,
      shiftName
    ],
    () => {
      if (!resetting.value) void loadTasks()
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
  watch(
    effectiveTenantId,
    async () => {
      try {
        shifts.value = await fetchExecutionShiftNames(effectiveTenantId.value)
      } catch {
        shifts.value = []
      }
    },
    { immediate: true }
  )
  onMounted(() => {
    void loadTasks()
  })
</script>

<style scoped lang="scss">
  .production-workspace {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .production-workspace__layout {
    flex: 1;
    min-height: 0;
  }

  .production-workspace__scope,
  .production-workspace__content {
    min-width: 0;
    min-height: 0;
  }

  .production-workspace__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .production-workspace__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 12px 16px;
  }

  .production-workspace__filters .el-input {
    width: min(260px, 100%);
  }

  .production-workspace__filters .el-select {
    width: 180px;
  }

  .production-workspace__result {
    margin-left: auto;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .production-workspace__three {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(250px, 0.9fr) minmax(340px, 1.35fr) minmax(240px, 0.8fr);
    gap: 12px;
    min-height: 0;
  }

  .production-workspace__task-card,
  .production-workspace__detail-scroll,
  .production-workspace__attendance {
    min-width: 0;
    min-height: 0;
  }

  .production-workspace__task-card,
  .production-workspace__attendance {
    display: flex;
    flex-direction: column;
  }

  .production-workspace__task-card :deep(.art-section-card__body),
  .production-workspace__attendance :deep(.art-section-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .production-workspace__detail-scroll {
    height: 100%;
  }

  .production-workspace__detail-column {
    display: grid;
    gap: 12px;
  }

  .production-workspace__task-list {
    flex: 1;
    min-height: 0;
  }

  .production-workspace__task-list :deep(.el-scrollbar__wrap) {
    scroll-snap-type: y proximity;
  }

  .production-workspace__task-list-inner {
    display: grid;
    gap: 8px;
    align-content: start;
    padding-bottom: 4px;
  }

  .production-workspace__task {
    display: grid;
    gap: 6px;
    width: 100%;
    padding: 12px;
    text-align: left;
    cursor: pointer;
    scroll-snap-align: start;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--custom-radius);
    transition:
      border-color 0.2s,
      background 0.2s;
  }

  .production-workspace__task:hover,
  .production-workspace__task.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--theme-color);
  }

  .production-workspace__task:focus-visible,
  .production-workspace__console-grid button:focus-visible {
    outline: 2px solid var(--theme-color);
    outline-offset: 2px;
  }

  .production-workspace__task-top,
  .production-workspace__task-bottom {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .production-workspace__task-top strong {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  .production-workspace__task-no,
  .production-workspace__task-product {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .production-workspace__task-name {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .production-workspace__task-bottom {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .production-workspace__pager {
    justify-content: center;
    margin-top: 12px;
  }

  .production-workspace__hero {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    margin-bottom: 14px;
    background: var(--art-gray-100);
    border-radius: var(--custom-radius);
  }

  .production-workspace__hero span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .production-workspace__hero strong {
    margin-right: auto;
    color: var(--el-text-color-primary);
  }

  .production-workspace__primary-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .production-workspace__primary-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .production-workspace__facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .production-workspace__facts > div {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .production-workspace__facts span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .production-workspace__facts strong {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  .production-workspace__detail-column :deep(.el-progress) {
    margin-top: 18px;
  }

  .production-workspace__order-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 18px;
  }

  .production-workspace__order-flow span {
    padding: 5px 7px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    background: var(--art-gray-100);
    border-radius: var(--art-control-radius-small);
  }

  .production-workspace__order-flow span.is-current {
    font-weight: 700;
    color: var(--theme-color);
    background: var(--el-color-primary-light-8);
  }

  .production-workspace__attendance-summary {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 14px;
    margin-bottom: 12px;
    background: var(--el-color-success-light-9);
    border-radius: var(--custom-radius);
  }

  .production-workspace__attendance-summary strong {
    font-size: 27px;
    color: var(--el-color-success);
  }

  .production-workspace__attendance-summary span {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .production-workspace__attendance-list {
    flex: 1;
    min-height: 0;
  }

  .production-workspace__attendance-list-inner {
    display: grid;
    gap: 10px;
    padding-right: 8px;
    padding-bottom: 72px;
  }

  .production-workspace__attendance-list article {
    display: flex;
    gap: 8px;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .production-workspace__attendance-list article > div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .production-workspace__attendance-list strong {
    color: var(--el-text-color-primary);
  }

  .production-workspace__attendance-list small {
    color: var(--el-text-color-secondary);
  }

  .production-workspace__avatar {
    display: grid;
    flex: none;
    place-items: center;
    width: 34px;
    height: 34px;
    color: var(--theme-color);
    background: var(--el-color-primary-light-8);
    border-radius: 50%;
  }

  .production-workspace__console-button {
    position: absolute;
    right: 20px;
    bottom: 20px;
    z-index: 9;
    box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  }

  .production-workspace__console {
    display: grid;
    gap: 18px;
  }

  .production-workspace__console-intro {
    padding: 18px;
    background: var(--art-gray-100);
    border-radius: var(--custom-radius);
  }

  .production-workspace__console-intro small,
  .production-workspace__console-intro p {
    color: var(--el-text-color-secondary);
  }

  .production-workspace__console-intro h3 {
    margin: 5px 0;
    color: var(--el-text-color-primary);
  }

  .production-workspace__console-intro p {
    margin: 0;
    font-size: 12px;
  }

  .production-workspace__console-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .production-workspace__console-grid button {
    display: grid;
    gap: 9px;
    justify-items: center;
    padding: 18px 8px;
    color: var(--el-text-color-primary);
    cursor: pointer;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--custom-radius);
  }

  .production-workspace__console-grid button:hover {
    background: var(--el-color-primary-light-9);
    border-color: var(--theme-color);
  }

  .production-workspace__console-grid button :deep(.art-svg-icon) {
    font-size: 22px;
    color: var(--theme-color);
  }

  .production-workspace__console-panel {
    display: grid;
    gap: 14px;
  }

  .production-workspace__sop-list,
  .production-workspace__feed-list {
    display: grid;
    gap: 8px;
  }

  .production-workspace__sop-list a {
    color: var(--theme-color);
  }

  .production-workspace__feed-heading {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }

  .production-workspace__feed-list article {
    display: grid;
    gap: 3px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--custom-radius);
  }

  .production-workspace__feed-list article span,
  .production-workspace__feed-list article small {
    color: var(--el-text-color-secondary);
  }

  @media (width <= 1500px) {
    .production-workspace {
      height: auto;
      min-height: var(--art-full-height);
      padding-bottom: 72px;
    }

    .production-workspace__console-button {
      position: fixed;
    }

    .production-workspace__layout {
      flex: none;
      height: 1012px;
    }

    .production-workspace__three {
      flex: none;
      grid-template-rows: 560px 320px;
      grid-template-columns: minmax(240px, 0.8fr) minmax(330px, 1.3fr);
      height: 892px;
    }

    .production-workspace__attendance {
      grid-column: 1 / -1;
      min-height: 0;
    }
  }

  @media (width <= 1000px) {
    .production-workspace__layout {
      height: auto;
    }

    .production-workspace__scope {
      height: 300px;
    }

    .production-workspace__three {
      grid-template-rows: 560px 380px 320px;
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }

    .production-workspace__task-card,
    .production-workspace__detail-scroll {
      min-height: 380px;
    }
  }

  @media (height <= 700px) and (width >= 1001px) {
    .production-workspace {
      height: auto;
      min-height: 760px;
    }

    .production-workspace__three {
      min-height: 460px;
    }
  }

  @media (width <= 600px) {
    .production-workspace__facts {
      grid-template-columns: minmax(0, 1fr);
    }

    .production-workspace__console-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .production-workspace__console-button {
      right: 16px;
      bottom: 16px;
    }
  }
</style>
