<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="report-form">
      <div class="report-form__context">
        <div
          ><small>生产工单 / 任务单</small
          ><strong
            >{{ task?.workOrder?.workOrderNo || '—' }} / {{ task?.taskNo || '—' }}</strong
          ></div
        >
        <div
          ><small>工序 / 工作中心</small
          ><strong
            >{{ task?.operationCode }} {{ task?.operationName }} ·
            {{ task?.workCenter?.name || '—' }}</strong
          ></div
        >
        <div
          ><small>计划 / 已审批 / 可报</small
          ><strong
            >{{ task?.plannedQuantity ?? 0 }} / {{ task?.completedQuantity ?? 0 }} /
            {{ remainingQuantity }}</strong
          ></div
        >
      </div>
      <ElAlert
        v-if="reportControlCode === 'SY06' || reportControlCode === 'SY05'"
        :closable="false"
        type="info"
        show-icon
        :title="
          reportControlCode === 'SY06'
            ? '必须汇报 · 审批后自动补报前道'
            : '末道工序审批后触发完工入库'
        "
        :description="
          reportControlCode === 'SY06'
            ? '按已确认产量补齐同一序列前道工序的未报数量，自动记录注明“系统自报工”；已有报工不重复计量。'
            : '沿用工单已确定的入库模式；未确定模式或缺少仓库、仓位等资料时生成完工入库草稿，补充后确认。'
        "
      />
      <ArtForm
        ref="formRef"
        v-model:active-tab="activeTab"
        v-model="form"
        :items="formItems"
        :rules="formRules"
        :validate-on-rule-change="false"
        :span="12"
        :gutter="16"
        scroll-to-error
        root-class="p-0! md:p-0!"
      >
        <template #defects>
          <div class="report-form__defects-content">
            <p class="report-form__hint">加工不良与来料不良的原因数量需分别等于上方的不良数量。</p>
            <div v-for="(line, index) in form.defects" :key="index" class="report-form__defect">
              <ElSelect v-model="line.reasonId" filterable placeholder="选择不良原因">
                <ElOption
                  v-for="reason in enabledReasons"
                  :key="reason.id"
                  :value="reason.id"
                  :label="`${reason.category === 'process' ? '加工' : '来料'} · ${reason.code} ${reason.name}`"
                />
              </ElSelect>
              <ElInputNumber
                v-model="line.quantity"
                :min="1"
                :precision="0"
                controls-position="right"
              />
              <ElInput v-model="line.remark" placeholder="补充说明" />
              <ElButton type="danger" link @click="form.defects.splice(index, 1)">移除</ElButton>
            </div>
            <ElButton plain @click="addDefect"><ArtSvgIcon icon="ri:add-line" />添加原因</ElButton>
          </div>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { executionRouteStep } from './execution-task-rules'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import { computed, h, nextTick, ref } from 'vue'
  import { ElMessage, ElButton, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import {
    fetchDefectReasons,
    fetchExecutionWorkCenterEquipment,
    fetchExecutionCalendarShifts,
    reviewProductionReport,
    submitProductionReport,
    type MesDefectReason,
    type MesExecutionPerson,
    type MesExecutionTask,
    type MesExecutionCalendarShift,
    type MesProductionReport,
    type MesReportInput,
    type MesWorkCenterEquipmentOption
  } from '@mes/api'
  import { buildExecutionUserOptions } from './execution-user-options'

  const emit = defineEmits<{ saved: [] }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const activeTab = ref('quantity')
  const task = ref<MesExecutionTask | null>(null)
  const reportStep = computed(() => (task.value ? executionRouteStep(task.value) : undefined))
  const reportControlCode = computed(
    () => task.value?.executionRules?.controlCode ?? reportStep.value?.controlCode
  )
  const editingReport = ref<MesProductionReport | null>(null)
  const people = ref<MesExecutionPerson[]>([])
  const userOptions = computed(() => buildExecutionUserOptions(people.value))
  const reasons = ref<MesDefectReason[]>([])
  const equipmentOptions = ref<MesWorkCenterEquipmentOption[]>([])
  const equipmentLoading = ref(false)
  const equipmentLoaded = ref(false)
  const calendarShifts = ref<MesExecutionCalendarShift[]>([])
  const shiftLoading = ref(false)
  const shiftError = ref('')
  let shiftRequest = 0
  const form = ref<MesReportInput>({
    equipmentId: null,
    goodQuantity: 0,
    processBadQuantity: 0,
    materialBadQuantity: 0,
    compensationHours: 0,
    compensationReason: '',
    rewardPenaltyHours: 0,
    rewardPenaltyReason: '',
    shiftName: '',
    operatorPersonIds: [],
    remark: '',
    media: [],
    defects: []
  })
  const remainingQuantity = computed(() =>
    Math.max(
      0,
      Number(task.value?.plannedQuantity || 0) - Number(task.value?.completedQuantity || 0)
    )
  )
  const badQuantity = computed(() => form.value.processBadQuantity + form.value.materialBadQuantity)
  const enabledReasons = computed(() => reasons.value.filter((item) => item.enabled))

  const equipmentDescription = computed(() =>
    editingReport.value && !editingReport.value.equipmentId
      ? '该历史报工未记录机台。'
      : task.value?.equipmentLocked && !task.value.equipmentId
        ? '此任务首次报工时未配置机台，后续报工保持“未分配机台”。'
        : equipmentLoaded.value && !equipmentOptions.value.length
          ? '报工可继续提交，机台统计将归入“未分配机台”。'
          : task.value?.equipmentId
            ? '此工序任务已固定机台，后续报工沿用该设备。'
            : ''
  )
  const shiftDescription = () =>
    h('div', { class: 'report-form__shift-field' }, [
      h(
        'span',
        { class: 'report-form__field-hint' },
        editingReport.value
          ? '原报工班次（历史记录）'
          : `工序要求开工日期 ${task.value?.requiredStartDate || '未设置'} 的工厂日历班次`
      ),
      !editingReport.value && shiftLoading.value
        ? h(ArtAsyncState, { loading: true, minHeight: 96, size: 'compact' })
        : null,
      !editingReport.value &&
      !shiftLoading.value &&
      (shiftError.value || !calendarShifts.value.length)
        ? h(
            'div',
            { class: 'report-form__shift-feedback', role: shiftError.value ? 'alert' : 'status' },
            [
              shiftError.value || '该日期未配置生产班次，请先在工厂日历配置后重试。',
              h(ElButton, { link: true, type: 'primary', onClick: retryShifts }, () =>
                shiftError.value ? '重试' : '重新读取'
              )
            ]
          )
        : null
    ])
  const formItems = computed<FormItem[]>(() => [
    { key: 'quantity', label: '产量与班次', type: 'tab' },
    {
      key: 'equipmentId',
      label: '实际机台',
      type: 'select',
      formItemProps: {
        required:
          !editingReport.value && !task.value?.equipmentLocked && equipmentOptions.value.length > 0
      },
      description: equipmentDescription.value,
      options: equipmentOptions.value.map((equipment) => ({
        value: equipment.id,
        label: `${equipment.equipmentCode} · ${equipment.equipmentName}`
      })),
      props: {
        filterable: true,
        clearable: true,
        disabled:
          Boolean(task.value?.equipmentLocked) ||
          Boolean(editingReport.value) ||
          !equipmentOptions.value.length,
        loading: equipmentLoading.value,
        placeholder: equipmentOptions.value.length
          ? '选择实际加工机台'
          : '当前工作中心未配置可用机台'
      }
    },
    {
      key: 'goodQuantity',
      label: '良品数量',
      type: 'number',
      formItemProps: { required: true },
      props: { min: 0, max: remainingQuantity.value, precision: 0, controlsPosition: 'right' }
    },
    {
      key: 'shiftName',
      label: '班次',
      type: editingReport.value ? 'text' : 'radioGroup',
      formItemProps: { required: true },
      description: shiftDescription,
      props: editingReport.value
        ? { formatter: () => form.value.shiftName || '未记录班次' }
        : {
            optionType: 'button',
            options: calendarShifts.value.map((shift) => ({
              value: shift.name,
              label: `${shift.name} ${shift.startTime}—${shift.endTime}`
            })),
            disabled: shiftLoading.value,
            class: 'report-form__shift-options'
          }
    },
    {
      key: 'processBadQuantity',
      label: '加工不良数',
      type: 'number',
      formItemProps: { required: true },
      props: { min: 0, precision: 0, controlsPosition: 'right' }
    },
    {
      key: 'materialBadQuantity',
      label: '来料不良数',
      type: 'number',
      formItemProps: { required: true },
      props: { min: 0, precision: 0, controlsPosition: 'right' }
    },
    {
      key: 'operatorPersonIds',
      label: '操作人员',
      type: 'userSelect',
      span: 24,
      props: { options: userOptions.value, multiple: true, placeholder: '选择参与该任务的人员' }
    },
    {
      key: 'defects',
      label: '不良原因明细',
      type: 'defectDetails',
      span: 24,
      hidden: !badQuantity.value
    },
    { key: 'hours', label: '工时与附件', type: 'tab' },
    {
      key: 'compensationHours',
      label: '补偿工时（h）',
      type: 'number',
      props: { min: 0, precision: 2, controlsPosition: 'right' }
    },
    {
      key: 'compensationReason',
      label: '补偿原因',
      type: 'input',
      formItemProps: { required: form.value.compensationHours > 0 },
      props: { maxlength: 200, placeholder: '有补偿工时时必填' }
    },
    {
      key: 'rewardPenaltyHours',
      label: '奖惩工时（h）',
      type: 'number',
      props: { precision: 2, controlsPosition: 'right' }
    },
    {
      key: 'rewardPenaltyReason',
      label: '奖惩原因',
      type: 'input',
      formItemProps: { required: form.value.rewardPenaltyHours !== 0 },
      props: { maxlength: 200, placeholder: '有奖惩工时时必填' }
    },
    {
      key: 'remark',
      label: '报工备注',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 500, showWordLimit: true }
    },
    {
      key: 'media',
      label: '现场附件',
      type: 'uploadFile',
      span: 24,
      hidden: Boolean(editingReport.value),
      props: {
        resourceTenantId: task.value?.tenantId || '',
        disabled: !task.value?.tenantId,
        multiple: true,
        limit: 10,
        title: '上传报工附件',
        tip: '照片、视频或相关文档将随报工保存。'
      }
    }
  ])
  const formRules = computed<FormRules>(() => ({
    ...(!editingReport.value && !task.value?.equipmentLocked && equipmentOptions.value.length
      ? { equipmentId: [{ required: true, message: '请选择实际机台', trigger: 'change' }] }
      : {}),
    goodQuantity: [
      {
        validator: (_rule, _value, callback) => {
          if (form.value.goodQuantity < 0) callback(new Error('良品数量不能小于零'))
          else if (form.value.goodQuantity <= 0 && badQuantity.value <= 0)
            callback(new Error('请填写良品或不良数量'))
          else if (!editingReport.value && form.value.goodQuantity > remainingQuantity.value)
            callback(new Error('良品数量超过任务剩余数量'))
          else callback()
        },
        trigger: 'change'
      }
    ],
    shiftName: [{ required: true, whitespace: true, message: '请选择班次', trigger: 'change' }],
    processBadQuantity: [
      { type: 'number', min: 0, message: '加工不良数不能小于零', trigger: 'change' }
    ],
    materialBadQuantity: [
      { type: 'number', min: 0, message: '来料不良数不能小于零', trigger: 'change' }
    ],
    ...(form.value.compensationHours > 0
      ? {
          compensationReason: [
            { required: true, whitespace: true, message: '请填写补偿原因', trigger: 'blur' }
          ]
        }
      : {}),
    ...(form.value.rewardPenaltyHours !== 0
      ? {
          rewardPenaltyReason: [
            { required: true, whitespace: true, message: '请填写奖惩原因', trigger: 'blur' }
          ]
        }
      : {}),
    defects: [
      {
        validator: (_rule, _value, callback) => {
          if (!badQuantity.value) return callback()
          const sums = { process: 0, material: 0 }
          for (const line of form.value.defects) {
            const reason = reasons.value.find((item) => item.id === line.reasonId)
            if (!reason || !reason.enabled || line.quantity <= 0)
              return callback(new Error('请检查不良原因和数量'))
            sums[reason.category] += line.quantity
          }
          if (
            sums.process !== form.value.processBadQuantity ||
            sums.material !== form.value.materialBadQuantity
          ) {
            callback(new Error('不良原因数量与加工、来料不良数量不一致'))
          } else {
            callback()
          }
        },
        trigger: 'change'
      }
    ]
  }))

  function addDefect() {
    form.value.defects.push({ reasonId: '', quantity: 1, remark: '' })
  }
  async function confirm() {
    if (!task.value?.workCenterId) {
      ElMessage.warning('任务未分配工作中心')
      return false
    }
    if (!editingReport.value && !equipmentLoaded.value) {
      ElMessage.warning('机台选项尚未加载，请稍后重试')
      return false
    }
    if (!editingReport.value && shiftLoading.value) {
      ElMessage.warning('班次加载中，请稍后重试')
      return false
    }
    if (
      !editingReport.value &&
      !calendarShifts.value.some((shift) => shift.name === form.value.shiftName)
    ) {
      ElMessage.warning('请先读取工厂日历并选择班次')
      return false
    }
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '报工内容校验失败，请重试')
      return false
    }
    try {
      const payload = { ...form.value, defects: form.value.defects.map((item) => ({ ...item })) }
      if (editingReport.value)
        await reviewProductionReport(
          editingReport.value.id,
          editingReport.value.status === 'rejected' ? 'resubmit' : 'edit',
          payload
        )
      else await submitProductionReport(task.value.id, task.value.workCenterId, payload)
    } catch (error) {
      notifyFriendlyError(error, '报工保存失败，请检查内容后重试')
      return false
    }
    emit('saved')
    return true
  }
  async function loadCalendarShifts(nextTask: MesExecutionTask): Promise<void> {
    const request = ++shiftRequest
    calendarShifts.value = []
    shiftError.value = ''
    if (!nextTask.requiredStartDate || !nextTask.workCenter?.departmentId) {
      form.value.shiftName = ''
      shiftError.value = '工序缺少要求开工日期或工作中心所属生产组织，无法读取班次。'
      return
    }
    shiftLoading.value = true
    try {
      const shifts = await fetchExecutionCalendarShifts(
        nextTask.tenantId,
        nextTask.workCenter.departmentId,
        nextTask.requiredStartDate
      )
      if (request !== shiftRequest) return
      calendarShifts.value = shifts
      const scheduledShift = nextTask.allocations?.find((item) =>
        shifts.some((shift) => shift.name === item.shiftNameSnapshot)
      )?.shiftNameSnapshot
      form.value.shiftName = scheduledShift || shifts[0]?.name || ''
    } catch {
      if (request !== shiftRequest) return
      form.value.shiftName = ''
      shiftError.value = '工厂日历班次加载失败，请重试。'
    } finally {
      if (request === shiftRequest) shiftLoading.value = false
    }
  }
  function retryShifts(): void {
    if (task.value && !editingReport.value) void loadCalendarShifts(task.value)
  }
  async function open(
    nextTask: MesExecutionTask,
    personnel: MesExecutionPerson[],
    report?: MesProductionReport
  ) {
    activeTab.value = 'quantity'
    shiftRequest += 1
    task.value = nextTask
    editingReport.value = report || null
    people.value = personnel
    equipmentLoaded.value = false
    equipmentLoading.value = true
    equipmentOptions.value = []
    calendarShifts.value = []
    shiftError.value = ''
    shiftLoading.value = false
    Object.assign(form.value, {
      equipmentId: report ? report.equipmentId : nextTask.equipmentId,
      goodQuantity: report?.goodQuantity || 0,
      processBadQuantity: report?.processBadQuantity || 0,
      materialBadQuantity: report?.materialBadQuantity || 0,
      compensationHours: report?.compensationHours || 0,
      compensationReason: report?.compensationReason || '',
      rewardPenaltyHours: report?.rewardPenaltyHours || 0,
      rewardPenaltyReason: report?.rewardPenaltyReason || '',
      shiftName: report?.shiftName || '',
      operatorPersonIds: [...(report?.operatorPersonIds || [])],
      remark: report?.remark || '',
      media: [...(report?.media || [])],
      defects:
        report?.defects?.map((item) => ({
          reasonId: item.reasonId,
          quantity: item.quantity,
          remark: item.remark
        })) || []
    })
    void nextTick(() => formRef.value?.clearValidate())
    void dialogRef.value?.handleOpen(undefined, {
      title: report?.status === 'rejected' ? '修改并重新提交' : report ? '修改报工' : '工序报工',
      confirmText: report?.status === 'rejected' ? '重新提交' : report ? '保存修改' : '提交报工',
      onConfirm: confirm
    })
    await Promise.all([
      ...(report ? [] : [loadCalendarShifts(nextTask)]),
      fetchDefectReasons(nextTask.tenantId)
        .then((items) => (reasons.value = items))
        .catch(() => {
          reasons.value = []
          ElMessage.error('不良原因加载失败，请刷新后重试')
        }),
      (report
        ? Promise.resolve(
            report.equipmentId
              ? [
                  {
                    id: report.equipmentId,
                    equipmentCode: nextTask.equipmentCodeSnapshot || '—',
                    equipmentName: nextTask.equipmentNameSnapshot || '已绑定机台'
                  }
                ]
              : []
          )
        : nextTask.equipmentLocked && nextTask.equipmentId
          ? Promise.resolve([
              {
                id: nextTask.equipmentId,
                equipmentCode: nextTask.equipmentCodeSnapshot || '—',
                equipmentName: nextTask.equipmentNameSnapshot || '已绑定机台'
              }
            ])
          : nextTask.equipmentLocked
            ? Promise.resolve([])
            : nextTask.workCenterId
              ? fetchExecutionWorkCenterEquipment(nextTask.workCenterId, nextTask.tenantId)
              : Promise.resolve([])
      )
        .then((items) => {
          equipmentOptions.value = items
          equipmentLoaded.value = true
        })
        .catch(() => {
          ElMessage.error('机台选项加载失败，请稍后重试')
        })
        .finally(() => {
          equipmentLoading.value = false
        })
    ])
  }
  defineExpose({ open })
</script>

<style scoped lang="scss">
  .report-form {
    display: grid;
    gap: 18px;
  }

  .report-form__context {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 16px;
    background: var(--art-gray-100);
    border-radius: var(--custom-radius);
  }

  .report-form__context > div {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .report-form__context small {
    color: var(--el-text-color-secondary);
  }

  .report-form__context strong {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  .report-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  .report-form__wide {
    grid-column: 1 / -1;
  }

  .report-form :deep(.el-input-number),
  .report-form :deep(.el-select) {
    width: 100%;
  }

  .report-form__hint {
    margin: -8px 0 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .report-form__field-hint {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .report-form__shift-field {
    display: grid;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .report-form__shift-field .report-form__field-hint {
    margin: 0;
  }

  .report-form__shift-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: fit-content;
    max-width: 100%;
  }

  .report-form__shift-options :deep(.el-radio-button__inner) {
    border-radius: var(--art-control-radius);
  }

  .report-form__shift-option {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  .report-form__shift-history,
  .report-form__shift-feedback {
    color: var(--el-text-color-regular);
  }

  .report-form__defect {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 110px minmax(0, 1.4fr) auto;
    gap: 8px;
    margin-bottom: 8px;
  }

  .report-form__defects-content {
    width: 100%;
  }

  @media (width <= 760px) {
    .report-form__context,
    .report-form__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .report-form__defect {
      grid-template-columns: minmax(0, 1fr) 100px;
    }
  }
</style>
