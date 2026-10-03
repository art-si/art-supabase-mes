<template>
  <ArtPermissionGuard permission="MesPackRule:View" resource-name="排包规则">
    <ElScrollbar class="pack-rules-page-scrollbar art-full-height">
      <div class="pack-rules-page business-workspace-page">
        <BusinessWorkspaceHeader
          eyebrow="PACKING POLICY"
          title="排包规则"
          description="按板材类型和板厚配置装包上限、同编号约束与尾数处理，供排包单生成方案。"
          icon="ri:archive-stack-line"
          :metrics="metrics"
          density="compact"
          refreshable
          :refresh-loading="loading"
          @refresh="load"
        >
          <template #actions>
            <ElButton v-auth="'MesPackRule:Add'" type="primary" @click="open()">
              <ArtSvgIcon icon="ri:add-line" />新增规则
            </ElButton>
          </template>
        </BusinessWorkspaceHeader>
        <ArtSectionCard
          title="按成品类型配置"
          subtitle="自动排包读取当前启用的规则；已保存的包和人工调整不会因修改规则而变化。"
          :loading="loading"
          :error="error"
          :empty="!loading && !error && !rules.length"
          empty-title="尚未配置排包规则"
          empty-description="先按岩棉板、聚氨酯板分别配置规则，再到排包单生成方案。"
          @retry="load"
        >
          <div class="pack-rules-page__grid">
            <article v-for="rule in rules" :key="rule.id" class="pack-rules-page__rule">
              <header class="pack-rules-page__rule-head">
                <div class="pack-rules-page__rule-identity">
                  <span class="pack-rules-page__rule-icon" aria-hidden="true">
                    <ArtSvgIcon icon="ri:stack-line" />
                  </span>
                  <div class="min-w-0">
                    <h2>{{ rule.ruleName }}</h2>
                    <p>
                      {{ rule.ruleCode === 'ROCK_BOARD' ? '岩棉夹芯板' : '聚氨酯夹芯板' }}
                      <template v-if="!effectiveTenantId">
                        · {{ tenantLabel(rule.tenantId) }}</template
                      >
                    </p>
                  </div>
                </div>
                <ElTag :type="rule.enabled ? 'success' : 'info'" effect="plain">
                  {{ rule.enabled ? '启用中' : '已停用' }}
                </ElTag>
              </header>

              <dl class="pack-rules-page__limits">
                <div
                  ><dt>单包最多</dt><dd>{{ rule.maxPieces }} <small>块</small></dd></div
                >
                <div
                  ><dt>堆叠上限</dt><dd>{{ rule.maxStackHeight }} <small>mm</small></dd></div
                >
                <div
                  ><dt>适用板厚</dt
                  ><dd
                    >{{ rule.boardThicknessMm ?? '通用' }}
                    <small v-if="rule.boardThicknessMm">mm</small></dd
                  ></div
                >
                <div v-if="rule.maxWeight"
                  ><dt>重量上限</dt><dd>{{ rule.maxWeight }} <small>kg</small></dd></div
                >
                <div v-if="rule.maxLength"
                  ><dt>板材最长</dt><dd>{{ rule.maxLength }} <small>mm</small></dd></div
                >
              </dl>

              <div class="pack-rules-page__policy">
                <div
                  ><span>聚合方式</span
                  ><strong
                    >同区域{{ rule.sameNumber ? '、同编号' : ''
                    }}{{ rule.sameWidth ? '，同宽优先' : ''
                    }}{{ rule.allowMixLength ? '，允许混长' : '，不可混长' }}</strong
                  ></div
                >
                <div
                  ><span>尾数处理</span
                  ><strong>{{ remainderLabel(rule.remainderPolicy) }}</strong></div
                >
              </div>

              <footer class="pack-rules-page__rule-foot">
                <span>更新于 {{ dayjs(rule.updateTime).format('YYYY-MM-DD HH:mm') }}</span>
                <ElButton v-auth="'MesPackRule:Edit'" link type="primary" @click="open(rule)">
                  编辑规则 <ArtSvgIcon icon="ri:arrow-right-s-line" />
                </ElButton>
              </footer>
            </article>
          </div>
        </ArtSectionCard>
        <PackRuleDialog ref="dialogRef" @success="load" />
      </div>
    </ElScrollbar>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import { storeToRefs } from 'pinia'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { fetchPackRules, type PackRule, type RemainderPolicy } from '@mes/api'
  import PackRuleDialog from './modules/pack-rule-dialog.vue'

  defineOptions({ name: 'MesPackRule' })
  const declaredPermissions = ['MesPackRule:View', 'MesPackRule:Add', 'MesPackRule:Edit'] as const
  void declaredPermissions
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, tenantOptions } = storeToRefs(tenantScopeStore)
  const dialogRef = ref<{
    handleOpen: (data: { tenantId: string; row?: PackRule }) => Promise<void>
  }>()
  const rules = ref<PackRule[]>([])
  const loading = ref(false)
  const error = ref('')
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '已配置',
      value: rules.value.length,
      description: '当前范围',
      icon: 'ri:settings-3-line'
    },
    {
      label: '启用中',
      value: rules.value.filter((rule) => rule.enabled).length,
      description: '可用于自动排包',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const tenantLabel = (id: string): string =>
    tenantOptions.value.find((tenant) => tenant.id === id)?.tenantName || '当前租户'
  const remainderLabel = (policy: RemainderPolicy): string =>
    ({ separate: '独立小包', merge: '尝试并包', manual: '人工处理' })[policy]
  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await tenantScopeStore.loadTenantOptions()
      rules.value = await fetchPackRules(effectiveTenantId.value)
    } catch {
      error.value = '排包规则加载失败，请重试。'
    } finally {
      loading.value = false
    }
  }
  function open(row?: PackRule): void {
    const tenantId = row?.tenantId || effectiveTenantId.value
    if (!tenantId) {
      ElMessage.warning('请先选择具体租户')
      return
    }
    void dialogRef.value?.handleOpen({ tenantId, row })
  }
  watch(effectiveTenantId, load, { immediate: true })
</script>

<style scoped lang="scss">
  .pack-rules-page-scrollbar {
    height: 100%;
  }

  .pack-rules-page {
    min-width: 0;
    min-height: 100%;
  }

  .pack-rules-page__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--art-space-3);
  }

  .pack-rules-page__rule {
    display: grid;
    gap: var(--art-space-4);
    min-width: 0;
    padding: var(--art-space-4);
    background: var(--default-box-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--custom-radius);
  }

  .pack-rules-page__rule-head,
  .pack-rules-page__rule-identity,
  .pack-rules-page__rule-foot {
    display: flex;
    gap: var(--art-space-3);
    align-items: center;
    min-width: 0;
  }

  .pack-rules-page__rule-head,
  .pack-rules-page__rule-foot {
    justify-content: space-between;
  }

  .pack-rules-page__rule-head .el-tag {
    flex: none;
  }

  .pack-rules-page__rule-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 36px;
    height: 36px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
    border-radius: var(--art-control-radius);
  }

  .pack-rules-page__rule-identity h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--el-text-color-primary);
    overflow-wrap: anywhere;
  }

  .pack-rules-page__rule-identity p {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .pack-rules-page__limits {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    margin: 0;
    overflow: hidden;
    background: var(--el-border-color-lighter);
    border-radius: var(--art-control-radius);
  }

  .pack-rules-page__limits > div {
    min-width: 0;
    padding: 10px 14px;
    background: var(--art-gray-100);
  }

  .pack-rules-page__limits > div:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .pack-rules-page__limits dt,
  .pack-rules-page__policy span,
  .pack-rules-page__rule-foot > span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .pack-rules-page__limits dd {
    margin: 3px 0 0;
    font-size: 22px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .pack-rules-page__limits small {
    font-size: 12px;
    font-weight: 400;
  }

  .pack-rules-page__policy {
    display: grid;
    gap: 7px;
  }

  .pack-rules-page__policy > div {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: var(--art-space-2);
    align-items: baseline;
  }

  .pack-rules-page__policy strong {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }

  .pack-rules-page__rule-foot {
    padding-top: var(--art-space-2);
    border-top: 1px solid var(--el-border-color-lighter);
  }

  @media (width <= 1100px) {
    .pack-rules-page__grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (width <= 640px) {
    .pack-rules-page__rule {
      padding: var(--art-space-3);
    }

    .pack-rules-page__rule-foot {
      flex-wrap: wrap;
    }
  }
</style>
