<template>
  <ArtDialog ref="dialogRef" size="lg" :show-fullscreen-button="false">
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
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="[]"
        :rules="formRules"
        :validate-on-rule-change="false"
        custom-layout
        scroll-to-error
        :show-reset="false"
        :show-submit="false"
        root-class="p-0! md:p-0!"
      >
        <ArtSectionTitle>产量与班次</ArtSectionTitle>
        <div class="report-form__grid">
          <ElFormItem
            label="实际机台"
            prop="equipmentId"
            :required="!editingReport && !task?.equipmentLocked && equipmentOptions.length > 0"
          >
            <ElSelect
              v-model="form.equipmentId"
              filterable
              clearable
              :disabled="
                Boolean(task?.equipmentLocked) || Boolean(editingReport) || !equipmentOptions.length
              "
              :loading="equipmentLoading"
              :placeholder="
                equipmentOptions.length ? '选择实际加工机台' : '当前工作中心未配置可用机台'
              "
            >
              <ElOption
                v-for="equipment in equipmentOptions"
                :key="equipment.id"
                :value="equipment.id"
                :label="`${equipment.equipmentCode} · ${equipment.equipmentName}`"
              />
            </ElSelect>
            <p v-if="editingReport && !editingReport.equipmentId" class="report-form__field-hint">
              该历史报工未记录机台。
            </p>
            <p
              v-else-if="task?.equipmentLocked && !task.equipmentId"
              class="report-form__field-hint"
            >
              此任务首次报工时未配置机台，后续报工保持“未分配机台”。
            </p>
            <p
              v-else-if="equipmentLoaded && !equipmentOptions.length"
              class="report-form__field-hint"
            >
              报工可继续提交，机台统计将归入“未分配机台”。
            </p>
            <p v-else-if="task?.equipmentId" class="report-form__field-hint">
              此工序任务已固定机台，后续报工沿用该设备。
            </p>
          </ElFormItem>
          <ElFormItem label="良品数量" prop="goodQuantity" required
            ><ElInputNumber
              v-model="form.goodQuantity"
              :min="0"
              :max="remainingQuantity"
              :precision="0"
              controls-position="right"
          /></ElFormItem>
          <ElFormItem label="班次" prop="shiftName" required>
            <div class="report-form__shift-field">
              <span class="report-form__field-hint">
                {{
                  editingReport
                    ? '原报工班次（历史记录）'
                    : `工序要求开工日期 ${task?.requiredStartDate || '未设置'} 的工厂日历班次`
                }}
              </span>
              <span v-if="editingReport" class="report-form__shift-history">
                {{ form.shiftName || '未记录班次' }}
              </span>
              <ElSkeleton v-else-if="shiftLoading" :rows="1" animated />
              <div v-else-if="shiftError" class="report-form__shift-feedback" role="alert">
                <span>{{ shiftError }}</span>
                <ElButton link type="primary" @click="retryShifts">重试</ElButton>
              </div>
              <div
                v-else-if="!calendarShifts.length"
                class="report-form__shift-feedback"
                role="status"
              >
                该日期未配置生产班次，请先在工厂日历配置后重试。
                <ElButton link type="primary" @click="retryShifts">重新读取</ElButton>
              </div>
              <ElRadioGroup v-else v-model="form.shiftName" class="report-form__shift-options">
                <ElRadioButton
                  v-for="shift in calendarShifts"
                  :key="`${shift.name}-${shift.startTime}-${shift.endTime}`"
                  :value="shift.name"
                >
                  <span class="report-form__shift-option">
                    <ArtSvgIcon v-if="form.shiftName === shift.name" icon="ri:check-line" />
                    {{ shift.name }} {{ shift.startTime }}—{{ shift.endTime }}
                  </span>
                </ElRadioButton>
              </ElRadioGroup>
            </div>
          </ElFormItem>
          <ElFormItem label="加工不良数" prop="processBadQuantity" required
            ><ElInputNumber
              v-model="form.processBadQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
          /></ElFormItem>
          <ElFormItem label="来料不良数" prop="materialBadQuantity" required
            ><ElInputNumber
              v-model="form.materialBadQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
          /></ElFormItem>
          <ElFormItem label="操作人员" class="report-form__wide">
            <ArtUserSelect
              v-model="form.operatorPersonIds"
              :options="userOptions"
              multiple
              placeholder="选择参与该任务的人员"
            />
          </ElFormItem>
        </div>
        <template v-if="badQuantity">
          <ArtSectionTitle>不良原因明细</ArtSectionTitle>
          <ElFormItem prop="defects" class="report-form__defects-field">
            <div class="report-form__defects-content">
              <p class="report-form__hint"
                >加工不良与来料不良的原因数量需分别等于上方的不良数量。</p
              >
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
              <ElButton plain @click="addDefect"
                ><ArtSvgIcon icon="ri:add-line" />添加原因</ElButton
              >
            </div>
          </ElFormItem>
        </template>
        <ArtSectionTitle>工时与说明</ArtSectionTitle>
        <div class="report-form__grid">
          <ElFormItem label="补偿工时（h）" prop="compensationHours"
            ><ElInputNumber
              v-model="form.compensationHours"
              :min="0"
              :precision="2"
              controls-position="right"
          /></ElFormItem>
          <ElFormItem
            label="补偿原因"
            prop="compensationReason"
            :required="form.compensationHours > 0"
            ><ElInput
              v-model="form.compensationReason"
              maxlength="200"
              placeholder="有补偿工时时必填"
          /></ElFormItem>
          <ElFormItem label="奖惩工时（h）" prop="rewardPenaltyHours"
            ><ElInputNumber
              v-model="form.rewardPenaltyHours"
              :precision="2"
              controls-position="right"
          /></ElFormItem>
          <ElFormItem
            label="奖惩原因"
            prop="rewardPenaltyReason"
            :required="form.rewardPenaltyHours !== 0"
            ><ElInput
              v-model="form.rewardPenaltyReason"
              maxlength="200"
              placeholder="有奖惩工时时必填"
          /></ElFormItem>
          <ElFormItem label="报工备注" class="report-form__wide"
            ><ElInput
              v-model="form.remark"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
          /></ElFormItem>
          <ElFormItem v-if="!editingReport" label="现场附件" class="report-form__wide">
            <ArtUploadFile
              v-model="form.media"
              :resource-tenant-id="task?.tenantId || ''"
              :disabled="!task?.tenantId"
              multiple
              :limit="10"
              title="上传报工附件"
              tip="照片、视频或相关文档将随报工保存。"
            />
          </ElFormItem>
        </div>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, reactive, ref } from 'vue'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtUserSelect from '@/components/core/forms/art-user-select/index.vue'
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
  const task = ref<MesExecutionTask | null>(null)
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
  const form = reactive<MesReportInput>({
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
  const badQuantity = computed(() => form.processBadQuantity + form.materialBadQuantity)
  const enabledReasons = computed(() => reasons.value.filter((item) => item.enabled))
  const formRules = computed<FormRules>(() => ({
    ...(!editingReport.value && !task.value?.equipmentLocked && equipmentOptions.value.length
      ? { equipmentId: [{ required: true, message: '请选择实际机台', trigger: 'change' }] }
      : {}),
    goodQuantity: [
      {
        validator: (_rule, _value, callback) => {
          if (form.goodQuantity < 0) callback(new Error('良品数量不能小于零'))
          else if (form.goodQuantity <= 0 && badQuantity.value <= 0)
            callback(new Error('请填写良品或不良数量'))
          else if (!editingReport.value && form.goodQuantity > remainingQuantity.value)
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
    ...(form.compensationHours > 0
      ? {
          compensationReason: [
            { required: true, whitespace: true, message: '请填写补偿原因', trigger: 'blur' }
          ]
        }
      : {}),
    ...(form.rewardPenaltyHours !== 0
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
          for (const line of form.defects) {
            const reason = reasons.value.find((item) => item.id === line.reasonId)
            if (!reason || !reason.enabled || line.quantity <= 0)
              return callback(new Error('请检查不良原因和数量'))
            sums[reason.category] += line.quantity
          }
          if (
            sums.process !== form.processBadQuantity ||
            sums.material !== form.materialBadQuantity
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
    form.defects.push({ reasonId: '', quantity: 1, remark: '' })
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
      !calendarShifts.value.some((shift) => shift.name === form.shiftName)
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
      const payload = { ...form, defects: form.defects.map((item) => ({ ...item })) }
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
      form.shiftName = ''
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
      form.shiftName = scheduledShift || shifts[0]?.name || ''
    } catch {
      if (request !== shiftRequest) return
      form.shiftName = ''
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
    Object.assign(form, {
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
