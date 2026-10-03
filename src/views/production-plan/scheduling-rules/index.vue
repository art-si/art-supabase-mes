<template>
  <ArtPermissionGuard permission="MesSchedulingRule:View" resource-name="排产规则">
    <div class="rule-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="FINITE CAPACITY POLICY"
        title="排产规则"
        description="将产能、日历、时间组成与冲突策略固化为可复用、可审计的生产排产口径。"
        icon="ri:settings-3-line"
        :tags="tags"
        :metrics="metrics"
        refreshable
        :refresh-loading="loading"
        @refresh="loadRules"
      >
        <template #actions>
          <ElButton v-auth="'MesSchedulingRule:Add'" type="primary" @click="openRule()">
            <ArtSvgIcon icon="ri:add-line" />新增规则
          </ElButton>
        </template>
      </BusinessWorkspaceHeader>

      <ArtSectionCard
        class="rule-page__card business-workspace-content"
        title="规则清单"
        subtitle="默认规则唯一；停用规则不会再用于新工单和自动排产。"
        :loading="loading"
        :error="error"
        :empty="!loading && !error && !rules.length"
        empty-title="暂无排产规则"
        empty-description="创建首条规则后即可在排产工作台生成计划建议。"
        retryable
        @retry="loadRules"
      >
        <ArtTable :data="rules" :columns="columns" :pagination="false" row-key="id">
          <template #name="{ row }">
            <div class="rule-page__name">
              <strong>{{ row.name }}</strong
              ><small>{{ row.code }}</small>
            </div>
          </template>
          <template #status="{ row }">
            <div class="rule-page__tags">
              <ElTag :type="row.enabled ? 'success' : 'info'" effect="light">{{
                row.enabled ? '启用' : '停用'
              }}</ElTag>
              <ElTag v-if="row.isDefault" type="primary" effect="plain">默认</ElTag>
            </div>
          </template>
          <template #constraints="{ row }">
            <span
              >{{ row.finiteCapacity ? '有限产能' : '无限产能' }} ·
              {{ row.respectCalendar ? '生产日历' : '自然日历' }} · 冻结
              {{ row.frozenHorizonDays }} 天</span
            >
          </template>
          <template #operation="{ row }">
            <div class="rule-page__actions">
              <ArtButtonTable
                type="edit"
                permission="MesSchedulingRule:Edit"
                @click="openRule(row)"
              />
              <ArtButtonTable
                type="delete"
                permission="MesSchedulingRule:Delete"
                :disabled="row.isDefault"
                @click="removeRule(row)"
              />
            </div>
          </template>
        </ArtTable>
      </ArtSectionCard>
      <RuleDialog ref="dialogRef" @success="loadRules" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { storeToRefs } from 'pinia'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import type { ColumnOption } from '@/types'
  import { deleteSchedulingRule, fetchSchedulingRules, type MesSchedulingRule } from '@mes/api'
  import RuleDialog, { type RuleDialogOpenData } from './modules/rule-dialog.vue'

  defineOptions({ name: 'MesSchedulingRule' })
  const declaredPermissions = [
    'MesSchedulingRule:View',
    'MesSchedulingRule:Add',
    'MesSchedulingRule:Edit',
    'MesSchedulingRule:Delete'
  ] as const
  void declaredPermissions
  const tenantScopeStore = useTenantScopeStore()
  const { confirmDelete } = useArtFeedback()
  const { effectiveTenantId } = storeToRefs(tenantScopeStore)
  const dialogRef = ref<{ handleOpen: (data: RuleDialogOpenData) => Promise<void> }>()
  const loading = ref(false)
  const error = ref('')
  const rules = ref<MesSchedulingRule[]>([])
  const tags: BusinessWorkspaceTag[] = [
    { label: '租户级', type: 'primary' },
    { label: '有限产能', type: 'success' },
    { label: '先预演后应用', type: 'warning' }
  ]
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '规则总数',
      value: rules.value.length,
      description: '当前工作范围',
      icon: 'ri:list-settings-line'
    },
    {
      label: '启用中',
      value: rules.value.filter((item) => item.enabled).length,
      description: '可用于新排程',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '有限产能',
      value: rules.value.filter((item) => item.enabled && item.finiteCapacity).length,
      description: '自动避让资源占用',
      icon: 'ri:dashboard-3-line',
      tone: 'primary'
    }
  ])
  const columns: ColumnOption<MesSchedulingRule>[] = [
    { prop: 'name', label: '规则', minWidth: 220, useSlot: true },
    { prop: 'status', label: '状态', width: 150, useSlot: true },
    {
      prop: 'direction',
      label: '方向',
      width: 110,
      formatter: (row) => (row.direction === 'forward' ? '正向' : '反向')
    },
    {
      prop: 'dispatchingRule',
      label: '派工顺序',
      width: 130,
      formatter: (row) =>
        ({ priority: '综合优先级', edd: '最早交期', fifo: '先进先出', spt: '最短工时' })[
          row.dispatchingRule
        ]
    },
    { prop: 'constraints', label: '约束摘要', minWidth: 300, useSlot: true },
    { prop: 'updateTime', label: '更新时间', width: 170 },
    { prop: 'operation', label: '操作', width: 120, fixed: 'right', align: 'center', useSlot: true }
  ]

  async function loadRules(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await tenantScopeStore.loadTenantOptions()
      rules.value = await fetchSchedulingRules(effectiveTenantId.value)
    } catch {
      error.value = '排产规则加载失败，请稍后重试。'
    } finally {
      loading.value = false
    }
  }
  function openRule(row?: MesSchedulingRule): void {
    const tenantId = effectiveTenantId.value
    if (!tenantId) {
      ElMessage.warning('请先选择租户范围')
      return
    }
    void dialogRef.value?.handleOpen({ tenantId, row })
  }
  async function removeRule(row: MesSchedulingRule): Promise<void> {
    await confirmDelete(`确认删除排产规则“${row.name}”？`, { title: '删除排产规则' })
    await deleteSchedulingRule(row.id)
    await loadRules()
  }
  watch(effectiveTenantId, loadRules, { immediate: true })
</script>

<style scoped lang="scss">
  .rule-page {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-3);
    min-width: 0;
    min-height: 0;
  }
  .rule-page__card {
    flex: 1;
    min-height: 0;
  }
  .rule-page__name {
    display: grid;
    gap: 3px;
  }
  .rule-page__name small {
    color: var(--el-text-color-secondary);
    font-family: var(--art-font-family-mono);
  }
  .rule-page__tags,
  .rule-page__actions {
    display: flex;
    gap: var(--art-space-2);
    align-items: center;
  }
  @media (width <= 768px) {
    .rule-page {
      height: auto;
      min-height: 100%;
    }
  }
</style>
