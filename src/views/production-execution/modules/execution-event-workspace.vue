<template>
  <ArtPermissionGuard :permission="`${routeName}:View`" :resource-name="title">
    <div class="execution-event-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        v-if="!embedded"
        :title="title"
        :description="description"
        :icon="icon"
        density="compact"
        refreshable
        :refresh-loading="loading || pmisLoading"
        @refresh="reloadWorkspace"
      >
        <template #actions><BusinessTableWorkspaceActions :table="activeTableRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtWorkspaceSplitter
        class="execution-event-page__body"
        :class="{ 'is-embedded': embedded }"
        primary-size="288px"
        primary-min="240px"
        primary-max="360px"
        :primary-collapsed="embedded"
        :breakpoint="900"
        :narrow-mode="embedded ? 'none' : 'stack'"
      >
        <template #primary>
          <aside v-if="!embedded" class="execution-event-page__scope">
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

        <div class="execution-event-page__main">
          <div v-if="embedded" class="execution-event-page__embedded-heading">
            <div>
              <h3>{{ title }}</h3>
              <p>{{ description }}</p>
            </div>
            <ElButton v-auth="createPermission" type="primary" @click="openCreate">
              <ArtSvgIcon icon="ri:add-line" />新增记录
            </ElButton>
          </div>

          <ElTabs
            v-if="mode === 'equipment'"
            v-model="equipmentView"
            class="execution-event-page__equipment-tabs"
          >
            <ElTabPane
              v-for="item in kindOptions"
              :key="item.value"
              :label="item.label"
              :name="item.value"
            />
            <ElTabPane label="现场记录" name="supplement" />
          </ElTabs>

          <div v-if="mode === 'inspection'" class="execution-event-page__toolbar art-card-xs">
            <ElSegmented v-model="selectedKind" :options="kindOptions" />
          </div>

          <PmisEquipmentTasks
            v-if="mode === 'equipment' && !showSupplement"
            ref="pmisTasksRef"
            :header-actions="embedded ? [] : headerActions"
            :kind="selectedPmisKind"
            :tenant-id="effectiveTenantId"
            :department-ids="scope.selectedWorkshopId ? departmentIds : undefined"
            :work-center-id="activeWorkCenterId || undefined"
            :date-range="null"
            status=""
            keyword=""
            @loading-change="pmisLoading = $event"
            @open-task="openPmisPage('task')"
          />

          <div
            v-if="mode !== 'equipment' || showSupplement"
            class="execution-event-page__table-card"
          >
            <ElAlert v-if="error" :title="error" type="error" show-icon :closable="false" />
            <ArtTableQuery
              ref="tableRef"
              class="execution-event-page__table-query"
              v-model="searchModel"
              :search-items="searchItems"
              :header-actions="embedded ? [] : headerActions"
              header-actions-placement="workspace"
              :table-header-props="{ layout: 'search,size,fullscreen,columns,settings' }"
              :search-bar-props="{
                span: 6,
                defaultExpanded: true,
                resetLoading: resetting,
                labelWidth: 76,
                showExpand: false
              }"
              :data="rows"
              :loading="loading"
              :pagination="{ current: page, size, total }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyHeight: '100%',
                emptyText: '当前条件下暂无记录',
                emptyDescription: '可调整生产范围与日期，或在当前工作中心新增记录。'
              }"
              focus-scope-selector=".execution-event-page__body"
              :focusable="!embedded"
              @search="applySearch"
              @reset="resetFilters"
              @pagination:current-change="page = $event"
              @pagination:size-change="size = $event"
            >
              <ElTableColumn type="index" label="序号" width="62" :index="rowIndex" />
              <ElTableColumn v-if="mode === 'equipment'" label="记录类型" min-width="106">
                <template #default="{ row }">{{ kindLabel(row.kind) }}</template>
              </ElTableColumn>
              <ElTableColumn
                :label="mode === 'misc_piece' ? '杂项类型' : '记录'"
                :min-width="mode === 'misc_piece' ? 220 : 240"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  <BusinessTableIdentityCell
                    :primary="row.title"
                    :secondary="`${row.task?.workOrder?.workOrderNo || '工作中心记录'} · ${row.task?.taskNo || row.workCenter?.code || '—'}`"
                    :icon="icon"
                    :icon-tone="mode === 'andon' || mode === 'exception' ? 'warning' : 'primary'"
                  />
                </template>
              </ElTableColumn>
              <ElTableColumn
                prop="workCenter.name"
                label="工作中心"
                min-width="130"
                show-overflow-tooltip
              />
              <ElTableColumn
                v-if="mode === 'misc_piece'"
                label="所属车间 / 产线"
                min-width="144"
                show-overflow-tooltip
              >
                <template #default="{ row }">{{ workshopName(row.workCenterId) }}</template>
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'inspection'"
                label="工序 / 物料"
                min-width="220"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ row.task?.operationCode || '—' }} · {{ row.task?.operationName || '—' }}<br />
                  {{ row.task?.workOrder?.materialCodeSnapshot || '—' }} ·
                  {{ row.task?.workOrder?.materialNameSnapshot || '—' }}
                </template>
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'inspection'"
                label="序列 / 类型"
                min-width="130"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ row.task?.sequenceNo ?? '—' }} / {{ row.task?.sequenceType || '—' }}
                </template>
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'inspection'"
                label="项目 / 规格"
                min-width="190"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ row.task?.workOrder?.projectNameSnapshot || '—' }} /<br />
                  {{ row.task?.workOrder?.specificationSnapshot || '—' }}
                </template>
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'inspection'"
                label="检验批号"
                min-width="168"
                show-overflow-tooltip
              >
                <template #default="{ row }">{{ row.details.batchNo || '—' }}</template>
              </ElTableColumn>
              <ElTableColumn v-if="mode === 'inspection'" label="计划 / 抽检" min-width="110">
                <template #default="{ row }"
                  >{{ row.details.plannedQuantity ?? '—' }} /
                  {{ row.details.sampleCount ?? '—' }}</template
                >
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'andon' || mode === 'exception'"
                label="类别 / 班次"
                min-width="145"
                show-overflow-tooltip
              >
                <template #default="{ row }"
                  >{{ row.details.category || '—' }} / {{ row.details.shiftName || '—' }}</template
                >
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'mold' || mode === 'equipment'"
                label="对象编号"
                min-width="150"
                show-overflow-tooltip
              >
                <template #default="{ row }"
                  >{{ row.details.moldCode || row.details.equipmentCode || '—' }} ·
                  {{ row.details.moldName || row.details.equipmentName || '—' }}</template
                >
              </ElTableColumn>
              <ElTableColumn label="发生时间" min-width="152">
                <template #default="{ row }">{{ formatDateTime(row.occurredAt) }}</template>
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'andon' || mode === 'exception' || mode === 'mold'"
                label="响应 / 完成"
                min-width="190"
              >
                <template #default="{ row }"
                  >{{ formatDateTime(row.respondedAt) }} /
                  {{ formatDateTime(row.completedAt) }}</template
                >
              </ElTableColumn>
              <ElTableColumn
                v-if="mode === 'exception' || mode === 'mold'"
                label="持续时长"
                min-width="100"
              >
                <template #default="{ row }">{{
                  durationHours(row.occurredAt, row.completedAt)
                }}</template>
              </ElTableColumn>
              <ElTableColumn
                :label="mode === 'inspection' ? '录入 / 检验人员' : '发起 / 处理'"
                min-width="132"
                show-overflow-tooltip
              >
                <template #default="{ row }"
                  >{{ row.actorName || '—' }} / {{ row.handler?.name || '—' }}</template
                >
              </ElTableColumn>
              <ElTableColumn v-if="mode === 'inspection'" label="判定 / 不良" min-width="130">
                <template #default="{ row }">
                  <ElButton link type="primary" @click="openDetail(row)">{{
                    judgmentLabel(row.details.judgment)
                  }}</ElButton>
                  / {{ row.details.badCount ?? 0 }}
                </template>
              </ElTableColumn>
              <ElTableColumn v-if="mode === 'inspection'" label="合格 / 不合格次数" min-width="142">
                <template #default="{ row }"
                  >{{ row.details.passCount ?? 0 }} /
                  <ElButton link type="primary" @click="openDetail(row)">{{
                    row.details.failCount ?? 0
                  }}</ElButton></template
                >
              </ElTableColumn>
              <ElTableColumn v-if="mode === 'misc_report'" label="工时" min-width="120">
                <template #default="{ row }">{{ row.quantity }} h</template>
              </ElTableColumn>
              <ElTableColumn v-if="mode === 'misc_piece'" label="计件单位" width="92">
                <template #default="{ row }">{{ row.details.unit || '—' }}</template>
              </ElTableColumn>
              <ElTableColumn v-if="mode === 'misc_piece'" label="单价（元）" width="98">
                <template #default="{ row }">{{
                  Number(row.details.unitPrice || 0).toFixed(2)
                }}</template>
              </ElTableColumn>
              <ElTableColumn
                v-if="mode !== 'misc_piece'"
                label="备注"
                min-width="160"
                show-overflow-tooltip
                prop="remark"
              />
              <ElTableColumn v-if="mode !== 'misc_piece'" label="附件" width="76">
                <template #default="{ row }">{{ row.media?.length || 0 }}</template>
              </ElTableColumn>
              <ElTableColumn label="状态" width="100">
                <template #default="{ row }">
                  <ElTag size="small" :type="statusTone(row.status)" effect="plain">{{
                    statusLabel(row.status)
                  }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn
                label="操作"
                fixed="right"
                :min-width="
                  mode === 'andon' || mode === 'mold'
                    ? 176
                    : mode === 'exception'
                      ? 144
                      : mode === 'misc_report'
                        ? 72
                        : 104
                "
              >
                <template #default="{ row }">
                  <BusinessTableRowActions>
                    <ArtButtonTable type="view" @click="openDetail(row)" />
                    <ArtButtonTable
                      v-if="row.kind === 'andon' && row.status === 'open'"
                      type="sign"
                      label="接收"
                      icon="ri:check-line"
                      permission="MesAndon:Handle"
                      @click="openAction(row, 'accept')"
                    />
                    <ArtButtonTable
                      v-if="
                        ['andon', 'exception', 'mold'].includes(row.kind) &&
                        ['open', 'responding'].includes(row.status)
                      "
                      type="sign"
                      :label="row.kind === 'mold' ? '下模' : '关闭'"
                      :icon="row.kind === 'mold' ? 'ri:tools-line' : 'ri:checkbox-circle-line'"
                      :permission="handlePermission"
                      @click="openAction(row, 'close')"
                    />
                    <ArtButtonTable
                      v-if="row.status !== 'closed' && editPermission"
                      type="edit"
                      :label="row.kind === 'mold' ? '维修' : '编辑'"
                      :permission="editPermission"
                      @click="openEdit(row)"
                    />
                    <ArtButtonTable
                      v-if="row.kind === 'mold' && row.status === 'open'"
                      type="delete"
                      permission="MesMold:Delete"
                      @click="removeEvent(row)"
                    />
                  </BusinessTableRowActions>
                </template>
              </ElTableColumn>
            </ArtTableQuery>
          </div>
        </div>
      </ArtWorkspaceSplitter>

      <ArtDialog ref="formDialogRef" size="lg" :show-fullscreen-button="false">
        <div class="execution-event-page__form">
          <div class="execution-event-page__form-intro">
            <ArtSvgIcon :icon="icon" />
            <div
              ><strong>归属与追溯</strong
              ><span>记录会归属到所选工作中心与工序任务，便于后续追溯。</span></div
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
            <div class="execution-event-page__form-grid">
              <ArtSectionTitle class="execution-event-page__form-section"
                >归属与记录</ArtSectionTitle
              >
              <ElFormItem v-if="mode === 'equipment'" label="记录类型" required>
                <ElSelect v-model="formKind" :disabled="formMode === 'update'">
                  <ElOption
                    v-for="item in kindOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="工作中心" prop="workCenterId" required>
                <ElSelect
                  v-model="form.workCenterId"
                  filterable
                  placeholder="请选择工作中心"
                  :disabled="Boolean(taskId)"
                >
                  <ElOption
                    v-for="center in visibleCenters"
                    :key="center.id"
                    :label="`${center.code} · ${center.name}`"
                    :value="center.id"
                  />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="工序任务" prop="taskId" :required="mode === 'inspection'">
                <ElSelect
                  v-model="form.taskId"
                  filterable
                  clearable
                  placeholder="选择关联任务"
                  :disabled="Boolean(taskId)"
                >
                  <ElOption
                    v-for="task in taskOptions"
                    :key="task.id"
                    :label="`${task.taskNo} · ${task.operationName}`"
                    :value="task.id"
                  />
                </ElSelect>
              </ElFormItem>
              <ElFormItem
                prop="title"
                :label="titleLabel"
                required
                class="execution-event-page__form-wide"
              >
                <ElInput
                  v-model="form.title"
                  maxlength="120"
                  show-word-limit
                  :placeholder="`请输入${titleLabel}`"
                />
              </ElFormItem>
              <ArtSectionTitle class="execution-event-page__form-section">业务内容</ArtSectionTitle>
              <template v-if="mode === 'misc_piece'">
                <ElFormItem label="计件单位" prop="unit" required
                  ><ElInput v-model="form.unit" placeholder="例如：件、次"
                /></ElFormItem>
                <ElFormItem label="单价（元）" prop="unitPrice" required
                  ><ElInputNumber
                    v-model="form.unitPrice"
                    :min="0"
                    :precision="2"
                    controls-position="right"
                /></ElFormItem>
              </template>
              <template v-if="mode === 'misc_report'">
                <ElFormItem label="杂项工时（h）" prop="quantity" required
                  ><ElInputNumber
                    v-model="form.quantity"
                    :min="0.01"
                    :precision="2"
                    controls-position="right"
                /></ElFormItem>
                <ElFormItem label="在岗时长（h）"
                  ><ElInputNumber
                    v-model="form.onPostHours"
                    :min="0"
                    :precision="2"
                    controls-position="right"
                /></ElFormItem>
                <ElFormItem label="班次"
                  ><ElInput v-model="form.shiftName" placeholder="请输入班次"
                /></ElFormItem>
              </template>
              <template v-if="mode === 'inspection'">
                <ElFormItem label="检验人员" prop="personId" required>
                  <ArtUserSelect
                    v-model="form.personId"
                    :options="userOptions"
                    :clearable="false"
                    placeholder="选择检验人员"
                  />
                </ElFormItem>
                <ElFormItem label="抽检次数" prop="sampleCount" required
                  ><ElInputNumber
                    v-model="form.sampleCount"
                    :min="1"
                    :precision="0"
                    controls-position="right"
                /></ElFormItem>
                <ElFormItem label="不良数量" prop="badCount" required
                  ><ElInputNumber
                    v-model="form.badCount"
                    :min="0"
                    :precision="0"
                    controls-position="right"
                /></ElFormItem>
                <ElFormItem label="合格次数" prop="passCount" required
                  ><ElInputNumber
                    v-model="form.passCount"
                    :min="0"
                    :precision="0"
                    controls-position="right"
                /></ElFormItem>
                <ElFormItem label="不合格次数" prop="failCount" required
                  ><ElInputNumber
                    v-model="form.failCount"
                    :min="0"
                    :precision="0"
                    controls-position="right"
                /></ElFormItem>
                <ElFormItem label="判定结果" prop="judgment" required>
                  <ElSegmented
                    v-model="form.judgment"
                    :options="[
                      { label: '合格', value: 'pass' },
                      { label: '不合格', value: 'fail' },
                      { label: '特采', value: 'concession' }
                    ]"
                  />
                </ElFormItem>
                <ElFormItem label="计划数量"
                  ><ElInput :model-value="selectedFormTask?.plannedQuantity ?? '—'" disabled
                /></ElFormItem>
              </template>
              <template v-if="mode === 'mold'">
                <ElFormItem label="模具编号" prop="moldCode" required
                  ><ElInput v-model="form.moldCode" placeholder="请输入模具编号"
                /></ElFormItem>
                <ElFormItem label="模具名称"
                  ><ElInput v-model="form.moldName" placeholder="请输入模具名称"
                /></ElFormItem>
                <ElFormItem label="库位"
                  ><ElInput v-model="form.location" placeholder="请输入库位"
                /></ElFormItem>
                <ElFormItem label="装夹方式"
                  ><ElInput v-model="form.clamping" placeholder="例如：快速装夹"
                /></ElFormItem>
                <ElFormItem label="上模人员">
                  <ArtUserSelect
                    v-model="form.personId"
                    :options="userOptions"
                    placeholder="选择上模人员"
                  />
                </ElFormItem>
                <template v-if="formMode === 'update'">
                  <ElFormItem label="维修日期" prop="repairDate" required>
                    <ElDatePicker
                      v-model="form.repairDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="选择维修日期"
                    />
                  </ElFormItem>
                  <ElFormItem label="维修类型" prop="repairType" required>
                    <ElSelect v-model="form.repairType" filterable placeholder="选择维修类型">
                      <ElOption
                        v-for="item in repairTypeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </ElSelect>
                    <small>维修类型可在系统管理的数据字典中配置。</small>
                  </ElFormItem>
                  <ElFormItem label="维修人员">
                    <ArtUserSelect
                      v-model="form.repairPersonId"
                      :options="userOptions"
                      placeholder="选择维修人员"
                    />
                  </ElFormItem>
                  <ElFormItem label="要求完成日期"
                    ><ElDatePicker
                      v-model="form.requiredCompletionDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="选择日期"
                  /></ElFormItem>
                  <ElFormItem label="计划完成日期"
                    ><ElDatePicker
                      v-model="form.plannedCompletionDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="选择日期"
                  /></ElFormItem>
                  <ElFormItem label="问题描述" class="execution-event-page__form-wide"
                    ><ElInput
                      v-model="form.problemDescription"
                      type="textarea"
                      :rows="2"
                      maxlength="500"
                  /></ElFormItem>
                  <ElFormItem label="关联质检批号（可选）" class="execution-event-page__form-wide">
                    <ElInput
                      v-model="form.inspectionBatchNo"
                      placeholder="填写对应检验记录的批号"
                    />
                  </ElFormItem>
                </template>
              </template>
              <template v-if="mode === 'equipment'">
                <ElFormItem label="设备编号" prop="equipmentCode" required
                  ><ElInput v-model="form.equipmentCode" placeholder="请输入设备编号"
                /></ElFormItem>
                <ElFormItem label="设备名称"
                  ><ElInput v-model="form.equipmentName" placeholder="请输入设备名称"
                /></ElFormItem>
                <ElFormItem label="检查结果" required
                  ><ElSegmented
                    v-model="form.judgment"
                    :options="[
                      { label: '正常', value: 'pass' },
                      { label: '异常', value: 'fail' }
                    ]"
                /></ElFormItem>
                <ElFormItem label="负责人">
                  <ArtUserSelect
                    v-model="form.personId"
                    :options="userOptions"
                    placeholder="选择负责人"
                  />
                </ElFormItem>
              </template>
              <template v-if="mode === 'andon' || mode === 'exception'">
                <ElFormItem label="异常分类">
                  <ElSelect v-model="form.category" clearable placeholder="选择分类">
                    <ElOption
                      v-for="option in exceptionCategories"
                      :key="option"
                      :label="option"
                      :value="option"
                    />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="处理人员">
                  <ArtUserSelect
                    v-model="form.personId"
                    :options="userOptions"
                    placeholder="选择处理人"
                  />
                </ElFormItem>
                <ElFormItem v-if="mode === 'exception'" label="班次"
                  ><ElInput v-model="form.shiftName" placeholder="请输入班次"
                /></ElFormItem>
                <ElFormItem v-if="mode === 'exception'" label="不计考核"
                  ><ElSwitch v-model="form.excludedFromAssessment"
                /></ElFormItem>
              </template>
              <ArtSectionTitle class="execution-event-page__form-section"
                >现场说明与附件</ArtSectionTitle
              >
              <ElFormItem label="备注" class="execution-event-page__form-wide">
                <ElInput
                  v-model="form.remark"
                  type="textarea"
                  :rows="3"
                  maxlength="500"
                  show-word-limit
                  placeholder="补充现场说明、处理背景或结论"
                />
              </ElFormItem>
              <ElFormItem label="图片 / 视频" class="execution-event-page__form-wide">
                <ArtUploadFile
                  v-model="form.media"
                  multiple
                  :limit="10"
                  title="上传现场附件"
                  tip="支持图片、视频或相关文档；上传完成后随记录保存。"
                />
              </ElFormItem>
            </div>
          </ArtForm>
        </div>
      </ArtDialog>

      <ArtDialog ref="actionDialogRef" size="sm" :show-fullscreen-button="false">
        <ArtForm
          ref="actionFormRef"
          :model-value="actionForm"
          @update:model-value="replaceReactiveModel(actionForm, $event)"
          :items="[]"
          :rules="actionRules"
          :validate-on-rule-change="false"
          custom-layout
          scroll-to-error
          :show-reset="false"
          :show-submit="false"
          root-class="p-0! md:p-0!"
        >
          <ElFormItem v-if="actionType === 'accept'" label="处理人" prop="personId" required>
            <ArtUserSelect
              v-model="actionForm.personId"
              :options="userOptions"
              :clearable="false"
              placeholder="请选择处理人"
            />
          </ElFormItem>
          <ElFormItem
            v-else
            :label="actionEvent?.kind === 'mold' ? '下模记录' : '处理记录'"
            prop="resolution"
            required
          >
            <ElInput
              v-model="actionForm.resolution"
              type="textarea"
              :rows="4"
              maxlength="500"
              show-word-limit
              placeholder="请记录处理过程与结果"
            />
          </ElFormItem>
          <template v-if="actionType === 'close' && actionEvent?.kind === 'mold'">
            <ElFormItem label="下模人员" prop="personId" required>
              <ArtUserSelect
                v-model="actionForm.personId"
                :options="userOptions"
                :clearable="false"
                placeholder="选择下模人员"
              />
            </ElFormItem>
            <ElFormItem label="下模库位"
              ><ElInput v-model="actionForm.location" placeholder="请输入库位"
            /></ElFormItem>
          </template>
        </ArtForm>
      </ArtDialog>

      <ArtDrawer ref="detailDrawerRef" size="lg" :show-footer="false">
        <div v-if="detailEvent" class="execution-event-page__detail">
          <div class="execution-event-page__detail-intro">
            <span class="execution-event-page__detail-icon" aria-hidden="true">
              <ArtSvgIcon :icon="icon" />
            </span>
            <div>
              <small>{{ detailEvent.task?.workOrder?.workOrderNo || '工作中心记录' }}</small>
              <h3>{{ detailEvent.title }}</h3>
              <p>{{ detailEvent.task?.taskNo || detailEvent.workCenter?.name || '—' }}</p>
            </div>
            <ElTag :type="statusTone(detailEvent.status)" effect="plain">
              {{ statusLabel(detailEvent.status) }}
            </ElTag>
          </div>
          <ArtSectionTitle>记录概况</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem label="发生时间">{{
              formatDateTime(detailEvent.occurredAt)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="发起人">{{
              detailEvent.actorName || '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="处理人">{{
              detailEvent.handler?.name || '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="响应时间">{{
              formatDateTime(detailEvent.respondedAt)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="结束时间">{{
              formatDateTime(detailEvent.completedAt)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="数量">{{ detailEvent.quantity }}</ElDescriptionsItem>
            <ElDescriptionsItem label="工作中心">{{
              detailEvent.workCenter?.name || '—'
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="备注" :span="detailColumns">{{
              detailEvent.remark || '—'
            }}</ElDescriptionsItem>
          </ElDescriptions>
          <ArtSectionTitle>业务明细</ArtSectionTitle>
          <ElDescriptions :column="detailColumns" border>
            <ElDescriptionsItem
              v-for="[key, value] in detailEntries(detailEvent.details)"
              :key="key"
              :label="detailLabel(key)"
              >{{ value }}</ElDescriptionsItem
            >
          </ElDescriptions>
          <ArtSectionTitle v-if="detailEvent.media?.length">现场附件</ArtSectionTitle>
          <div v-if="detailEvent.media?.length" class="execution-event-page__media">
            <a
              v-for="(url, index) in detailEvent.media"
              :key="url"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              ><ArtSvgIcon icon="ri:attachment-2" />附件 {{ index + 1 }}</a
            >
          </div>
        </div>
      </ArtDrawer>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import { useRouter } from 'vue-router'
  import { storeToRefs } from 'pinia'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtTableQuery from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtTableQueryHeaderAction } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtUserSelect from '@/components/core/forms/art-user-select/index.vue'
  import ProductionWorkCenterNavigator from '@/components/business/production-work-center-navigator/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { useUserStore } from '@/store/modules/user'
  import { exportExcel } from '@/utils/file'
  import {
    fetchExecutionEvents,
    fetchExecutionPeople,
    fetchExecutionTasks,
    saveExecutionEvent,
    type MesExecutionEvent,
    type MesExecutionEventKind,
    type MesExecutionPerson,
    type MesExecutionTask,
    type MesPmisEquipmentKind
  } from '@mes/api'
  import { useExecutionScope } from './use-execution-scope'
  import { buildExecutionUserOptions } from './execution-user-options'
  import PmisEquipmentTasks from './pmis-equipment-tasks.vue'

  const mesExecutionEventStatusOptions = useDictionaryOptions('mesExecutionEventStatus')

  type Mode =
    'andon' | 'exception' | 'misc_piece' | 'misc_report' | 'inspection' | 'mold' | 'equipment'
  const props = withDefaults(
    defineProps<{
      mode: Mode
      embedded?: boolean
      taskId?: string
      workCenterId?: string
      initialKind?: MesExecutionEventKind
    }>(),
    { embedded: false, taskId: '', workCenterId: '', initialKind: undefined }
  )
  const compactDetail = useMediaQuery('(max-width: 640px)')
  const detailColumns = computed(() => (compactDetail.value ? 1 : 2))
  const { confirmDelete } = useArtFeedback()
  const router = useRouter()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const repairTypeOptions = computed(() => getDictMap.value.mesMoldRepairType ?? [])
  const config = {
    andon: {
      title: '安灯请求',
      description: '从发起、接收到关闭，完整记录现场响应时间与处理结果。',
      icon: 'ri:alarm-warning-line',
      routeName: 'MesAndon'
    },
    exception: {
      title: '异常上报',
      description: '登记生产异常的原因、班次、时段和考核属性。',
      icon: 'ri:error-warning-line',
      routeName: 'MesException'
    },
    misc_piece: {
      title: '杂项计件',
      description: '维护换模及其他杂项计件项目、单位与计价依据。',
      icon: 'ri:coins-line',
      routeName: 'MesMiscPiecework'
    },
    misc_report: {
      title: '杂项报工',
      description: '登记非工序作业的工时、人员与现场说明。',
      icon: 'ri:time-line',
      routeName: 'MesMiscReport'
    },
    inspection: {
      title: '检验记录',
      description: '首检、自检巡检与末检使用同一台账，保留批号和判定证据。',
      icon: 'ri:shield-check-line',
      routeName: 'MesInspection'
    },
    mold: {
      title: '上下模',
      description: '跟踪模具上模、下模和维修过程。',
      icon: 'ri:tools-line',
      routeName: 'MesMold'
    },
    equipment: {
      title: '设备管理',
      description: '集中查看设备点检、巡检、保养任务及现场补充记录。',
      icon: 'ri:settings-3-line',
      routeName: 'MesEquipment'
    }
  } satisfies Record<Mode, { title: string; description: string; icon: string; routeName: string }>
  const title = computed(() => config[props.mode].title)
  const description = computed(() => config[props.mode].description)
  const icon = computed(() => config[props.mode].icon)
  const routeName = computed(() => config[props.mode].routeName)
  const createPermission = computed(
    () =>
      `${routeName.value}:${['misc_piece', 'misc_report', 'mold', 'equipment', 'inspection'].includes(props.mode) ? 'Add' : 'Create'}`
  )
  const editPermission = computed(
    () =>
      ({
        andon: 'MesAndon:Handle',
        exception: 'MesException:Handle',
        misc_piece: 'MesMiscPiecework:Edit',
        misc_report: '',
        inspection: 'MesInspection:Edit',
        mold: 'MesMold:Repair',
        equipment: 'MesEquipment:Edit'
      })[props.mode]
  )
  const handlePermission = computed(
    () =>
      (
        ({
          andon: 'MesAndon:Handle',
          exception: 'MesException:Handle',
          mold: 'MesMold:Unload'
        }) as Partial<Record<Mode, string>>
      )[props.mode] || ''
  )
  const kindOptions = computed(() =>
    props.mode === 'inspection'
      ? [
          { label: '首检', value: 'inspection_first' },
          { label: '自检 / 巡检', value: 'inspection_patrol' },
          { label: '末检', value: 'inspection_final' }
        ]
      : [
          { label: '设备点检', value: 'equipment_check' },
          { label: '设备巡检', value: 'equipment_patrol' },
          { label: '设备保养', value: 'equipment_maintenance' }
        ]
  )
  const pmisPages = {
    equipment_check: { task: 'PmisInspectionSheet', report: 'PmisInspectionReport' },
    equipment_patrol: { task: 'PmisPatrolTask', report: 'PmisPatrolReport' },
    equipment_maintenance: { task: 'PmisMaintenanceTask', report: 'PmisMaintenanceReport' }
  } as const
  const selectedKind = ref<MesExecutionEventKind>(
    props.initialKind ||
      (props.mode === 'inspection'
        ? 'inspection_first'
        : props.mode === 'equipment'
          ? 'equipment_check'
          : props.mode)
  )
  const formKind = ref<MesExecutionEventKind>(selectedKind.value)
  const equipmentView = ref<
    'equipment_check' | 'equipment_patrol' | 'equipment_maintenance' | 'supplement'
  >(
    props.initialKind === 'equipment_patrol' || props.initialKind === 'equipment_maintenance'
      ? props.initialKind
      : 'equipment_check'
  )
  const selectedPmisKind = computed<MesPmisEquipmentKind>(() =>
    selectedKind.value === 'equipment_patrol'
      ? 'patrol'
      : selectedKind.value === 'equipment_maintenance'
        ? 'maintenance'
        : 'inspection'
  )
  const tableTitle = computed(() =>
    props.mode === 'inspection' || props.mode === 'equipment'
      ? kindOptions.value.find((item) => item.value === selectedKind.value)?.label || title.value
      : title.value
  )
  const kindLabel = (kind: MesExecutionEventKind) =>
    kindOptions.value.find((item) => item.value === kind)?.label || kind
  function openPmisPage(page: 'task' | 'report') {
    if (!(selectedKind.value in pmisPages)) return
    const routeName = pmisPages[selectedKind.value as keyof typeof pmisPages][page]
    if (!router.hasRoute(routeName)) {
      ElMessage.warning('当前账号尚未开通对应的 PMIS 页面权限')
      return
    }
    void router.push({ name: routeName })
  }
  const titleLabel = computed(() => {
    if (props.mode === 'equipment')
      return (
        {
          equipment_check: '点检项目',
          equipment_patrol: '巡检项目',
          equipment_maintenance: '保养项目'
        } as const
      )[formKind.value as 'equipment_check' | 'equipment_patrol' | 'equipment_maintenance']
    return {
      andon: '安灯类型',
      exception: '异常原因',
      misc_piece: '杂项类型',
      misc_report: '杂项说明',
      inspection: '检验项目',
      mold: '模具操作',
      equipment: '检查项目'
    }[props.mode]
  })
  const exceptionCategories = ['设备', '质量', '物料', '工艺', '安全', '其他']
  const {
    scope,
    effectiveTenantId,
    workshopOptions,
    visibleCenters,
    departmentIds,
    loadScope,
    selectWorkshop,
    selectWorkCenter
  } = useExecutionScope()
  const activeWorkCenterId = computed(() => props.workCenterId || scope.selectedWorkCenterId)
  function workshopName(workCenterId: string | null) {
    const center = scope.workCenters.find((item) => item.id === workCenterId)
    return scope.departments.find((item) => item.id === center?.departmentId)?.name || '—'
  }
  const keyword = ref('')
  const dateRange = ref<[string, string] | null>(null)
  const selectedStatuses = ref<string[]>([])
  const tableRef = ref<ArtTableQueryExpose>()
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    ...(props.mode === 'equipment'
      ? [
          {
            key: 'pmis-task',
            label: `PMIS ${tableTitle.value}任务`,
            icon: 'ri:external-link-line',
            buttonProps: { link: true, type: 'primary' as const },
            onClick: () => openPmisPage('task')
          },
          {
            key: 'pmis-report',
            label: 'PMIS 记录',
            buttonProps: { link: true },
            onClick: () => openPmisPage('report')
          }
        ]
      : []),
    {
      type: 'export',
      label: props.mode === 'equipment' ? '导出现场记录' : '导出',
      permission: `${routeName.value}:Export`,
      onClick: () => exportRows()
    },
    {
      type: 'add',
      label: props.mode === 'equipment' ? '新增现场记录' : `新增${title.value}`,
      permission: createPermission.value,
      disabled: !activeWorkCenterId.value,
      onClick: () => openCreate()
    }
  ])
  const searchModel = ref<Record<string, unknown>>({ keyword: '', dateRange: null, statuses: [] })
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'dateRange',
      label: '发生日期',
      type: 'daterange',
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      key: 'statuses',
      label: '状态',
      type: 'select',
      props: {
        clearable: true,
        multiple: true,
        collapseTags: true,
        placeholder: '全部状态',
        options: mesExecutionEventStatusOptions
      }
    },
    {
      key: 'keyword',
      label: '关键字',
      type: 'input',
      props: {
        clearable: true,
        placeholder:
          props.mode === 'equipment' ? '记录名称、设备编号或发起人' : '名称、原因或发起人'
      }
    }
  ])
  function applySearch(params: Record<string, unknown>) {
    dateRange.value =
      Array.isArray(params.dateRange) && params.dateRange.length === 2
        ? [String(params.dateRange[0]), String(params.dateRange[1])]
        : null
    selectedStatuses.value = Array.isArray(params.statuses) ? params.statuses.map(String) : []
    keyword.value = String(params.keyword || '')
    if (page.value !== 1) page.value = 1
    else void loadRows()
  }
  const pmisLoading = ref(false)
  const showSupplement = computed(() => equipmentView.value === 'supplement')
  const pmisTasksRef = ref<InstanceType<typeof PmisEquipmentTasks>>()
  const activeTableRef = computed(() =>
    props.mode === 'equipment' && !showSupplement.value
      ? pmisTasksRef.value?.tableRef
      : tableRef.value
  )
  watch(equipmentView, (view) => {
    if (view === 'supplement') {
      page.value = 1
      void loadRows()
    } else selectedKind.value = view
  })
  const rows = ref<MesExecutionEvent[]>([])
  const taskOptions = ref<MesExecutionTask[]>([])
  const people = ref<MesExecutionPerson[]>([])
  const userOptions = computed(() => buildExecutionUserOptions(people.value))
  const loading = ref(false)
  const resetting = ref(false)
  const error = ref('')
  const page = ref(1)
  const size = ref(20)
  const total = ref(0)
  const formDialogRef = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const actionDialogRef = ref<ArtDialogExpose>()
  const actionFormRef = ref<InstanceType<typeof ArtForm>>()
  const detailDrawerRef = ref<ArtDrawerExpose<MesExecutionEvent>>()
  const detailEvent = ref<MesExecutionEvent | null>(null)
  const formMode = ref<'create' | 'update'>('create')
  const editingId = ref<string | null>(null)
  const actionEvent = ref<MesExecutionEvent | null>(null)
  const actionType = ref<'accept' | 'close'>('accept')
  const actionForm = reactive({ personId: '', location: '', resolution: '' })
  const actionRules = computed<FormRules>(() => ({
    ...(actionType.value === 'accept' || actionEvent.value?.kind === 'mold'
      ? {
          personId: [
            {
              required: true,
              message: actionType.value === 'accept' ? '请选择处理人' : '请选择下模人员',
              trigger: 'change'
            }
          ]
        }
      : {}),
    ...(actionType.value === 'close'
      ? {
          resolution: [
            { required: true, whitespace: true, message: '请填写处理记录', trigger: 'blur' }
          ]
        }
      : {})
  }))
  const form = ref({
    workCenterId: '',
    taskId: '',
    title: '',
    quantity: 0,
    unit: '',
    unitPrice: 0,
    onPostHours: 0,
    sampleCount: 1,
    passCount: 1,
    failCount: 0,
    badCount: 0,
    judgment: 'pass',
    moldCode: '',
    moldName: '',
    clamping: '',
    repairDate: '',
    inspectionBatchNo: '',
    repairType: '',
    repairPersonId: '',
    requiredCompletionDate: '',
    plannedCompletionDate: '',
    problemDescription: '',
    equipmentCode: '',
    equipmentName: '',
    location: '',
    personId: '',
    category: '',
    shiftName: '',
    excludedFromAssessment: false,
    remark: '',
    media: [] as string[]
  })
  const formRules = computed<FormRules>(() => ({
    workCenterId: [{ required: true, message: '请选择工作中心', trigger: 'change' }],
    title: [
      { required: true, whitespace: true, message: `请填写${titleLabel.value}`, trigger: 'blur' }
    ],
    ...(props.mode === 'misc_piece'
      ? {
          unit: [{ required: true, whitespace: true, message: '请填写计件单位', trigger: 'blur' }],
          unitPrice: [
            { type: 'number' as const, min: 0.01, message: '单价必须大于零', trigger: 'change' }
          ]
        }
      : {}),
    ...(props.mode === 'misc_report'
      ? {
          quantity: [
            { type: 'number' as const, min: 0.01, message: '杂项工时必须大于零', trigger: 'change' }
          ]
        }
      : {}),
    ...(props.mode === 'inspection'
      ? {
          taskId: [{ required: true, message: '请选择工序任务', trigger: 'change' }],
          personId: [{ required: true, message: '请选择检验人员', trigger: 'change' }],
          sampleCount: [
            { type: 'number' as const, min: 1, message: '抽检次数至少为 1', trigger: 'change' }
          ],
          badCount: [
            { type: 'number' as const, min: 0, message: '不良数量不能小于零', trigger: 'change' }
          ],
          passCount: [
            { type: 'number' as const, min: 0, message: '合格次数不能小于零', trigger: 'change' }
          ],
          failCount: [
            {
              validator: (_rule, value, callback) => {
                if (typeof value !== 'number' || value < 0) {
                  callback(new Error('不合格次数不能小于零'))
                } else if (form.value.passCount + value !== form.value.sampleCount) {
                  callback(new Error('合格与不合格次数之和必须等于抽检次数'))
                } else {
                  callback()
                }
              },
              trigger: 'change'
            }
          ],
          judgment: [{ required: true, message: '请选择判定结果', trigger: 'change' }]
        }
      : {}),
    ...(props.mode === 'mold'
      ? {
          moldCode: [
            { required: true, whitespace: true, message: '请填写模具编号', trigger: 'blur' }
          ],
          ...(formMode.value === 'update'
            ? {
                repairDate: [{ required: true, message: '请选择维修日期', trigger: 'change' }],
                repairType: [{ required: true, message: '请选择维修类型', trigger: 'change' }]
              }
            : {})
        }
      : {}),
    ...(props.mode === 'equipment'
      ? {
          equipmentCode: [
            { required: true, whitespace: true, message: '请填写设备编号', trigger: 'blur' }
          ]
        }
      : {})
  }))
  const formTitle = computed(() =>
    formMode.value === 'create'
      ? props.mode === 'equipment'
        ? '新增现场记录'
        : `新增${tableTitle.value}`
      : props.mode === 'mold'
        ? '模具维修记录'
        : props.mode === 'equipment'
          ? '编辑现场记录'
          : `编辑${tableTitle.value}`
  )
  const selectedFormTask = computed(() =>
    taskOptions.value.find((item) => item.id === form.value.taskId)
  )
  const rowIndex = (index: number) => (page.value - 1) * size.value + index + 1
  const formatDateTime = (value: string | null | undefined) =>
    value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
  const durationHours = (from: string, to: string | null) =>
    to ? `${(Math.max(0, dayjs(to).diff(dayjs(from), 'minute')) / 60).toFixed(2)} h` : '—'
  const statusLabel = (value: string) =>
    ({ open: '待处理', responding: '处理中', closed: '已关闭', completed: '已完成' })[value] ||
    value
  const statusTone = (value: string) =>
    value === 'open' ? 'warning' : value === 'responding' ? 'primary' : 'success'
  const judgmentLabel = (value: unknown) =>
    ({ pass: '合格', fail: '不合格', concession: '特采' })[String(value)] || '—'
  const detailLabels: Record<string, string> = {
    batchNo: '检验批号',
    plannedQuantity: '计划数量',
    sampleCount: '抽检次数',
    passCount: '合格次数',
    failCount: '不合格次数',
    badCount: '不良数量',
    judgment: '判定',
    unit: '计件单位',
    unitPrice: '单价（元）',
    onPostHours: '在岗时长（h）',
    shiftName: '班次',
    moldCode: '模具编号',
    moldName: '模具名称',
    location: '库位',
    equipmentCode: '设备编号',
    equipmentName: '设备名称',
    category: '异常分类',
    excludedFromAssessment: '不计考核',
    resolution: '处理记录',
    repairType: '维修类型',
    repairDate: '维修日期',
    clamping: '装夹方式',
    inspectionBatchNo: '关联质检批号',
    repairPersonId: '维修人员',
    requiredCompletionDate: '要求完成日期',
    plannedCompletionDate: '计划完成日期',
    problemDescription: '问题描述',
    unloadPersonId: '下模人员',
    unloadLocation: '下模库位',
    unloadedAt: '下模时间'
  }
  const detailLabel = (key: string) => detailLabels[key]
  const detailValue = (key: string, value: unknown): string => {
    if (value == null || value === '') return '—'
    if (key === 'judgment') {
      if (props.mode === 'equipment') return value === 'pass' ? '正常' : '异常'
      return judgmentLabel(value)
    }
    if (key === 'excludedFromAssessment') return value ? '是' : '否'
    if (key === 'repairType')
      return repairTypeOptions.value.find((item) => item.value === value)?.label || String(value)
    if (key === 'repairPersonId' || key === 'unloadPersonId')
      return userOptions.value.find((item) => item.value === value)?.label || '—'
    if (Array.isArray(value)) return value.map(String).join('、') || '—'
    return typeof value === 'object' ? '—' : String(value)
  }
  const detailEntries = (details: Record<string, unknown>): Array<[string, string]> =>
    Object.entries(details)
      .filter(([key]) => Object.prototype.hasOwnProperty.call(detailLabels, key))
      .map(([key, value]) => [key, detailValue(key, value)])

  let rowVersion = 0
  async function loadRows() {
    const version = ++rowVersion
    loading.value = true
    rows.value = []
    total.value = 0
    error.value = ''
    try {
      const result = await fetchExecutionEvents({
        current: page.value,
        size: size.value,
        tenantId: effectiveTenantId.value,
        kinds:
          props.mode === 'equipment'
            ? kindOptions.value.map((item) => item.value as MesExecutionEventKind)
            : [selectedKind.value],
        workCenterId: activeWorkCenterId.value || undefined,
        workCenterIds:
          scope.selectedWorkshopId && !activeWorkCenterId.value
            ? visibleCenters.value.map((item) => item.id)
            : undefined,
        taskId: props.taskId || undefined,
        dateRange: dateRange.value || undefined,
        keyword: keyword.value,
        statuses: selectedStatuses.value
      })
      if (version !== rowVersion) return
      rows.value = result.data
      total.value = result.total
    } catch {
      if (version === rowVersion) error.value = '记录加载失败，请重试'
    } finally {
      if (version === rowVersion) loading.value = false
    }
  }
  async function reloadWorkspace() {
    await Promise.all([
      loadRows(),
      props.mode === 'equipment' ? pmisTasksRef.value?.refresh() : Promise.resolve()
    ])
  }
  async function loadOptions() {
    try {
      const [personList, taskPage] = await Promise.all([
        fetchExecutionPeople(effectiveTenantId.value),
        fetchExecutionTasks({
          current: 1,
          size: 200,
          tenantId: effectiveTenantId.value,
          workCenterId: activeWorkCenterId.value || undefined,
          departmentIds: departmentIds.value
        })
      ])
      people.value = personList
      taskOptions.value = taskPage.data
    } catch {
      ElMessage.error('人员与任务选项加载失败，请刷新后重试')
    }
  }
  async function resetFilters() {
    if (resetting.value) return
    resetting.value = true
    keyword.value = ''
    dateRange.value = null
    selectedStatuses.value = []
    page.value = 1
    await nextTick()
    try {
      await Promise.all([loadRows(), waitForPmisLoad()])
    } finally {
      resetting.value = false
    }
  }
  async function waitForPmisLoad() {
    if (props.mode !== 'equipment' || !pmisLoading.value) return
    await new Promise<void>((resolve) => {
      const stop = watch(pmisLoading, (value) => {
        if (value) return
        stop()
        resolve()
      })
    })
  }
  function resetForm() {
    Object.assign(form.value, {
      workCenterId: activeWorkCenterId.value,
      taskId: props.taskId || '',
      title: '',
      quantity: props.mode === 'misc_piece' ? 1 : 0,
      unit: '',
      unitPrice: 0,
      onPostHours: 0,
      sampleCount: 1,
      passCount: 1,
      failCount: 0,
      badCount: 0,
      judgment: 'pass',
      moldCode: '',
      moldName: '',
      clamping: '',
      repairDate: '',
      inspectionBatchNo: '',
      equipmentCode: '',
      equipmentName: '',
      location: '',
      personId: '',
      category: '',
      repairType: '',
      repairPersonId: '',
      requiredCompletionDate: '',
      plannedCompletionDate: '',
      problemDescription: '',
      shiftName: '',
      excludedFromAssessment: false,
      remark: '',
      media: []
    })
  }
  function buildPayload() {
    const details: Record<string, unknown> = {}
    if (props.mode === 'misc_piece')
      Object.assign(details, { unit: form.value.unit.trim(), unitPrice: form.value.unitPrice })
    if (props.mode === 'misc_report')
      Object.assign(details, {
        onPostHours: form.value.onPostHours,
        shiftName: form.value.shiftName.trim()
      })
    if (props.mode === 'inspection')
      Object.assign(details, {
        sampleCount: form.value.sampleCount,
        passCount: form.value.passCount,
        failCount: form.value.failCount,
        badCount: form.value.badCount,
        judgment: form.value.judgment,
        plannedQuantity: selectedFormTask.value?.plannedQuantity ?? 0
      })
    if (props.mode === 'mold')
      Object.assign(details, {
        moldCode: form.value.moldCode.trim(),
        moldName: form.value.moldName.trim(),
        clamping: form.value.clamping.trim(),
        location: form.value.location.trim(),
        operatorPersonId: form.value.personId || null,
        repairType: form.value.repairType.trim(),
        repairDate: form.value.repairDate || null,
        inspectionBatchNo: form.value.inspectionBatchNo.trim(),
        repairPersonId: form.value.repairPersonId || null,
        requiredCompletionDate: form.value.requiredCompletionDate || null,
        plannedCompletionDate: form.value.plannedCompletionDate || null,
        problemDescription: form.value.problemDescription.trim()
      })
    if (props.mode === 'equipment')
      Object.assign(details, {
        equipmentCode: form.value.equipmentCode.trim(),
        equipmentName: form.value.equipmentName.trim(),
        judgment: form.value.judgment
      })
    if (props.mode === 'andon' || props.mode === 'exception')
      Object.assign(details, {
        category: form.value.category,
        shiftName: form.value.shiftName.trim(),
        excludedFromAssessment: form.value.excludedFromAssessment
      })
    return {
      title: form.value.title.trim(),
      quantity:
        props.mode === 'misc_report'
          ? form.value.quantity
          : props.mode === 'inspection'
            ? form.value.badCount
            : props.mode === 'misc_piece'
              ? 1
              : 0,
      handlerPersonId: form.value.personId || null,
      details,
      media: form.value.media,
      remark: form.value.remark.trim()
    }
  }
  async function submitForm() {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '执行记录校验失败，请重试')
      return false
    }
    try {
      await saveExecutionEvent({
        id: editingId.value,
        kind: props.mode === 'equipment' ? formKind.value : selectedKind.value,
        taskId: form.value.taskId || null,
        workCenterId: form.value.workCenterId,
        action: formMode.value,
        payload: buildPayload()
      })
    } catch (error) {
      notifyFriendlyError(error, '执行记录保存失败，请检查内容后重试')
      return false
    }
    await loadRows()
    if (props.mode === 'equipment') equipmentView.value = 'supplement'
    return true
  }
  function openCreate() {
    formMode.value = 'create'
    editingId.value = null
    formKind.value = selectedKind.value
    resetForm()
    void nextTick(() => formRef.value?.clearValidate())
    void loadOptions()
    formDialogRef.value?.handleOpen(undefined, { title: formTitle.value, onConfirm: submitForm })
  }
  function openEdit(rawRow: unknown) {
    const row = rawRow as MesExecutionEvent
    formMode.value = 'update'
    editingId.value = row.id
    formKind.value = row.kind
    resetForm()
    Object.assign(form.value, {
      workCenterId: row.workCenterId || '',
      taskId: row.taskId || '',
      title: row.title,
      quantity: row.quantity,
      remark: row.remark,
      media: row.media || [],
      personId: row.handlerPersonId || '',
      category: String(row.details.category || ''),
      shiftName: String(row.details.shiftName || ''),
      unit: String(row.details.unit || ''),
      unitPrice: Number(row.details.unitPrice || 0),
      onPostHours: Number(row.details.onPostHours || 0),
      sampleCount: Number(row.details.sampleCount || 1),
      passCount: Number(row.details.passCount || 0),
      failCount: Number(row.details.failCount || 0),
      badCount: Number(row.details.badCount || 0),
      judgment: String(row.details.judgment || 'pass'),
      moldCode: String(row.details.moldCode || ''),
      moldName: String(row.details.moldName || ''),
      clamping: String(row.details.clamping || ''),
      repairDate: String(row.details.repairDate || dayjs().format('YYYY-MM-DD')),
      inspectionBatchNo: String(row.details.inspectionBatchNo || ''),
      equipmentCode: String(row.details.equipmentCode || ''),
      equipmentName: String(row.details.equipmentName || ''),
      location: String(row.details.location || ''),
      excludedFromAssessment: Boolean(row.details.excludedFromAssessment),
      repairType: String(row.details.repairType || ''),
      repairPersonId: String(row.details.repairPersonId || ''),
      requiredCompletionDate: String(row.details.requiredCompletionDate || ''),
      plannedCompletionDate: String(row.details.plannedCompletionDate || ''),
      problemDescription: String(row.details.problemDescription || '')
    })
    void nextTick(() => formRef.value?.clearValidate())
    void loadOptions()
    formDialogRef.value?.handleOpen(undefined, { title: formTitle.value, onConfirm: submitForm })
  }
  function openAction(rawRow: unknown, action: 'accept' | 'close') {
    const row = rawRow as MesExecutionEvent
    actionEvent.value = row
    actionType.value = action
    Object.assign(actionForm, {
      personId: row.handlerPersonId || '',
      location: String(row.details.location || ''),
      resolution: ''
    })
    void nextTick(() => actionFormRef.value?.clearValidate())
    void loadOptions()
    actionDialogRef.value?.handleOpen(undefined, {
      title: action === 'accept' ? '接收安灯请求' : row.kind === 'mold' ? '下模' : '关闭请求',
      onConfirm: async () => {
        if (!actionEvent.value) return false
        try {
          if (!(await validateArtFormForSubmit(actionFormRef.value))) return false
        } catch (error) {
          notifyFriendlyError(error, '执行操作校验失败，请重试')
          return false
        }
        try {
          await saveExecutionEvent({
            id: actionEvent.value.id,
            kind: actionEvent.value.kind,
            taskId: actionEvent.value.taskId,
            workCenterId: actionEvent.value.workCenterId,
            action,
            payload:
              action === 'accept'
                ? { handlerPersonId: actionForm.personId }
                : {
                    resolution: actionForm.resolution.trim(),
                    details:
                      row.kind === 'mold'
                        ? {
                            unloadedAt: new Date().toISOString(),
                            unloadPersonId: actionForm.personId,
                            unloadLocation: actionForm.location.trim()
                          }
                        : {}
                  }
          })
        } catch (error) {
          notifyFriendlyError(error, '执行操作提交失败，请稍后重试')
          return false
        }
        await loadRows()
        return true
      }
    })
  }
  function openDetail(rawRow: unknown) {
    const row = rawRow as MesExecutionEvent
    detailEvent.value = row
    detailDrawerRef.value?.handleOpen(row, { title: `${title.value}详情` })
  }
  async function removeEvent(rawRow: unknown) {
    const row = rawRow as MesExecutionEvent
    try {
      await confirmDelete(`确定删除模具记录“${row.title}”？`, { title: '删除记录' })
      await saveExecutionEvent({
        id: row.id,
        kind: row.kind,
        taskId: row.taskId,
        workCenterId: row.workCenterId,
        action: 'delete',
        payload: {
          title: row.title,
          quantity: row.quantity,
          details: row.details,
          media: row.media,
          remark: row.remark
        }
      })
      await loadRows()
    } catch {
      /* cancel or shared API error */
    }
  }
  async function exportRows() {
    try {
      const result = await fetchExecutionEvents({
        current: 1,
        size: 10000,
        tenantId: effectiveTenantId.value,
        kinds:
          props.mode === 'equipment'
            ? kindOptions.value.map((item) => item.value as MesExecutionEventKind)
            : [selectedKind.value],
        taskId: props.taskId || undefined,
        workCenterId: activeWorkCenterId.value || undefined,
        workCenterIds:
          scope.selectedWorkshopId && !activeWorkCenterId.value
            ? visibleCenters.value.map((item) => item.id)
            : undefined,
        dateRange: dateRange.value || undefined,
        keyword: keyword.value,
        statuses: selectedStatuses.value
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
          title: row.title,
          taskNo: row.task?.taskNo || '',
          workOrderNo: row.task?.workOrder?.workOrderNo || '',
          workCenter: row.workCenter?.name || '',
          occurredAt: formatDateTime(row.occurredAt),
          actorName: row.actorName,
          handlerName: row.handler?.name || '',
          status: statusLabel(row.status),
          quantity: row.quantity,
          remark: row.remark
        })),
        columns: [
          { key: 'title', title: '记录' },
          { key: 'taskNo', title: '任务单号' },
          { key: 'workOrderNo', title: '生产工单' },
          { key: 'workCenter', title: '工作中心' },
          { key: 'occurredAt', title: '发生时间' },
          { key: 'actorName', title: '发起人' },
          { key: 'handlerName', title: '处理人' },
          { key: 'status', title: '状态' },
          { key: 'quantity', title: '数量' },
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
      selectedKind,
      () => scope.selectedWorkCenterId,
      () => scope.selectedWorkshopId,
      page,
      size,
      effectiveTenantId
    ],
    () => {
      if (!resetting.value) void loadRows()
    },
    { deep: true }
  )
  watch([() => scope.selectedWorkCenterId, () => scope.selectedWorkshopId], () => {
    page.value = 1
    void loadOptions()
  })
  onMounted(() => {
    void Promise.all([loadRows(), loadOptions()])
    if (props.mode === 'mold') void userStore.ensureDictLoaded('mesMoldRepairType')
  })
</script>

<style scoped lang="scss">
  .execution-event-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;

    &__equipment-tabs {
      flex: none;

      :deep(.el-tabs__header) {
        margin-bottom: 0;
      }
    }

    &__body {
      flex: 1;
      min-height: 0;
    }

    &__body.is-embedded {
      height: auto;
    }

    &__scope,
    &__main {
      min-width: 0;
      min-height: 0;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    &__toolbar {
      display: flex;
      flex: none;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      padding: 12px 16px;
    }

    &__table-card {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      min-height: 0;
    }

    &__table-query {
      flex: 1;
      min-height: 0;
    }

    &__embedded-heading {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }

    &__embedded-heading h3 {
      margin: 0;
      font-size: 17px;
      color: var(--el-text-color-primary);
    }

    &__embedded-heading p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    &__form-intro {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      margin-bottom: 18px;
      background: var(--art-gray-100);
      border-radius: var(--custom-radius);
    }

    &__form-intro > :first-child {
      flex: none;
      font-size: 20px;
      color: var(--theme-color);
    }

    &__form-intro div {
      display: grid;
      gap: 3px;
    }

    &__form-intro strong {
      color: var(--el-text-color-primary);
    }

    &__form-intro span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2px 16px;
    }

    &__form-wide {
      grid-column: 1 / -1;
    }

    &__form-section {
      grid-column: 1 / -1;
      margin-top: 4px;
    }

    &__form-grid :deep(.el-input-number),
    &__form-grid :deep(.el-select) {
      width: 100%;
    }

    &__detail {
      display: grid;
      gap: 16px;
    }

    &__detail-intro {
      display: flex;
      gap: 12px;
      align-items: center;
      min-width: 0;
      padding: 14px 16px;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--custom-radius);
    }

    &__detail-intro > div {
      min-width: 0;
      margin-right: auto;
    }

    &__detail-icon {
      display: grid;
      flex: none;
      place-items: center;
      width: 40px;
      height: 40px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      border-radius: var(--art-control-radius);
    }

    &__detail-intro small {
      color: var(--el-text-color-secondary);
    }

    &__detail h3 {
      margin: 0;
      color: var(--el-text-color-primary);
    }

    &__detail-intro p {
      margin: 2px 0 0;
      color: var(--el-text-color-secondary);
    }

    &__media {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    &__media a {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 8px 10px;
      color: var(--theme-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--custom-radius);
    }

    @media (width <= 900px) {
      &__form-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
