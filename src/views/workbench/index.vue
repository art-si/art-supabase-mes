<template>
  <div class="mes-workbench business-workspace-page">
    <BusinessWorkspaceHeader
      eyebrow="MANUFACTURING EXECUTION"
      title="制造执行工作台"
      density="compact"
      description="串联计划、工艺、现场执行与质量追溯，按实施路线逐步启用生产业务。"
      icon="ri:tools-line"
      :tags="[
        { label: '现场执行', type: 'primary' },
        { label: '全过程追溯', type: 'success' },
        { label: '首期能力已启用', type: 'success' }
      ]"
      :metrics="metrics"
    />

    <div class="mes-workbench__content">
      <ArtSectionCard
        class="mes-workbench__flow-card"
        title="生产执行闭环"
        subtitle="以生产订单为主线，把排程、派工、报工、质检和完工沉淀为可追溯事件。"
        preserve-content-structure
      >
        <template #actions
          ><ElTag type="success" effect="plain" round>现场记录已启用</ElTag></template
        >
        <div class="production-line" aria-label="生产执行流程">
          <div class="production-line__rail"></div>
          <article v-for="(stage, index) in productionStages" :key="stage.title">
            <span class="production-line__node"><ArtSvgIcon :icon="stage.icon" /></span>
            <small>STEP {{ String(index + 1).padStart(2, '0') }}</small>
            <strong>{{ stage.title }}</strong>
            <p>{{ stage.description }}</p>
          </article>
        </div>
        <div class="traceability-band">
          <span class="traceability-band__icon"><ArtSvgIcon icon="ri:git-branch-line" /></span>
          <div
            ><small>追溯主线</small
            ><strong>批次 / 序列号贯穿物料、设备、人员与质量记录</strong></div
          >
          <ElTag type="info" effect="plain">数据接入后启用</ElTag>
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        class="mes-workbench__readiness-card"
        title="上线准备"
        subtitle="当前接入状态与首个落地里程碑。"
        preserve-content-structure
      >
        <ul class="readiness-list">
          <li v-for="item in readinessItems" :key="item.label">
            <span class="readiness-list__icon"><ArtSvgIcon icon="ri:check-line" /></span>
            <div
              ><strong>{{ item.label }}</strong
              ><small>{{ item.description }}</small></div
            >
            <ElTag size="small" type="success" effect="light" round>已完成</ElTag>
          </li>
        </ul>
        <div class="next-step">
          <span><ArtSvgIcon icon="ri:flag-line" /></span>
          <div
            ><small>后续集成重点</small><strong>设备采集与库存联动</strong
            ><p>接入机台脉冲、灯态和库存流水，形成自动采集与物料扣减。</p></div
          >
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        class="mes-workbench__roadmap-card"
        title="能力实施路线"
        subtitle="从生产标准到现场闭环，再到质量和绩效分析。"
        preserve-content-structure
      >
        <div class="roadmap-grid">
          <article v-for="(phase, index) in roadmap" :key="phase.title">
            <header
              ><span>{{ index + 1 }}</span
              ><div
                ><small>{{ phase.code }}</small
                ><strong>{{ phase.title }}</strong></div
              ></header
            >
            <p>{{ phase.description }}</p>
            <div
              ><ElTag v-for="item in phase.items" :key="item" size="small" effect="plain">{{
                item
              }}</ElTag></div
            >
          </article>
        </div>
      </ArtSectionCard>
    </div>
  </div>
</template>

<script setup lang="ts">
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  defineOptions({ name: 'MesWorkbench' })

  const metrics: BusinessWorkspaceMetric[] = [
    {
      label: '应用运行时',
      value: '已接入',
      description: '制造应用入口已就绪',
      icon: 'ri:links-line',
      tone: 'success'
    },
    {
      label: '菜单与权限',
      value: '已注册',
      description: '按角色授权访问',
      icon: 'ri:shield-keyhole-line',
      tone: 'success'
    },
    {
      label: '工艺主线',
      value: '已接入',
      description: '复用 MDM 路线与工序',
      icon: 'ri:flow-chart',
      tone: 'success'
    },
    {
      label: '生产执行',
      value: '已启用',
      description: '报工、审批与质量记录',
      icon: 'ri:play-circle-line',
      tone: 'success'
    }
  ]

  const productionStages = [
    { title: '计划', description: '生产订单', icon: 'ri:file-list-3-line' },
    { title: '排程', description: '资源约束', icon: 'ri:calendar-schedule-line' },
    { title: '派工', description: '任务下达', icon: 'ri:user-shared-line' },
    { title: '报工', description: '产量工时', icon: 'ri:edit-box-line' },
    { title: '质检', description: '结果判定', icon: 'ri:shield-check-line' },
    { title: '完工', description: '任务完成', icon: 'ri:checkbox-circle-line' }
  ]

  const readinessItems = [
    { label: '应用入口', description: '制造工作台已接入平台' },
    { label: '统一工作空间', description: '共享登录、主题与导航' },
    { label: '访问权限', description: '菜单与角色授权已登记' },
    { label: '生产工单', description: '确认时固化 BOM 与工艺路线快照' },
    { label: '工序任务', description: '支持工作中心排程与受控关闭' },
    { label: '现场执行', description: '报工、审批、安灯与质量记录已接入' }
  ]

  const roadmap = [
    {
      code: 'STANDARD',
      title: '生产标准',
      description: '统一工厂、产线、工艺路线、工序和资源的生产语义。',
      items: ['工艺建模', '资源日历', '版本控制']
    },
    {
      code: 'EXECUTION',
      title: '现场闭环',
      description: '让计划下达到完工入库的每一步可执行、可反馈。',
      items: ['生产计划', '派工报工', '物料配送']
    },
    {
      code: 'QUALITY',
      title: '质量追溯',
      description: '把检验、缺陷和处置结果串联到完整生产履历。',
      items: ['过程检验', '异常处置', '生产追溯']
    }
  ]
</script>

<style scoped lang="scss">
  .mes-workbench {
    &__content {
      display: grid;
      flex: 0 0 auto;
      grid-template-columns: minmax(0, 1.8fr) minmax(300px, 0.8fr);
      gap: 16px;
      align-content: start;
      min-height: 0;
    }

    &__flow-card,
    &__readiness-card,
    &__roadmap-card {
      padding: 18px;
    }

    &__roadmap-card {
      grid-column: 1 / -1;
    }
  }

  .production-line {
    position: relative;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    padding: 20px 8px 18px;

    &__rail {
      position: absolute;
      top: 46px;
      right: 8%;
      left: 8%;
      height: 2px;
      background: linear-gradient(
        90deg,
        var(--el-color-primary-light-7),
        var(--el-color-success-light-5)
      );
    }

    article {
      z-index: 1;
      display: grid;
      justify-items: center;
      min-width: 0;
      text-align: center;
    }

    &__node {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      margin-bottom: 10px;
      font-size: 21px;
      color: var(--el-color-primary);
      background: var(--el-bg-color);
      border: 2px solid var(--el-color-primary-light-7);
      border-radius: 50%;
      box-shadow: 0 0 0 6px var(--el-bg-color);
    }

    article:last-child .production-line__node {
      color: var(--el-color-success);
      border-color: var(--el-color-success-light-5);
    }

    small {
      font-size: 9px;
      color: var(--el-text-color-placeholder);
      letter-spacing: 0.08em;
    }

    strong {
      margin-top: 3px;
      font-size: 13px;
    }

    p {
      margin: 3px 0 0;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .traceability-band {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 13px 16px;
    background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
    border: 1px solid color-mix(in srgb, var(--theme-color) 20%, var(--el-border-color-lighter));
    border-radius: var(--el-border-radius-base);

    &__icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--el-color-primary);
      background: var(--el-bg-color);
      border-radius: var(--art-surface-radius);
    }

    small,
    strong {
      display: block;
    }

    small {
      font-size: 9px;
      color: var(--el-color-primary);
      letter-spacing: 0.1em;
    }

    strong {
      margin-top: 3px;
      font-size: 12px;
    }
  }

  .readiness-list {
    display: grid;
    gap: 2px;
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 0;
    }

    li + li {
      border-top: 1px solid var(--el-border-color-lighter);
    }

    &__icon {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      color: var(--el-color-success);
      background: var(--el-color-success-light-9);
      border-radius: var(--art-surface-radius);
    }

    li > div {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    :deep(.el-tag) {
      justify-self: end;
      min-width: 60px;
      white-space: nowrap;
    }

    strong,
    small {
      display: block;
    }

    strong {
      font-size: 13px;
    }

    small {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .next-step {
    display: flex;
    gap: 12px;
    padding: 14px;
    margin-top: 12px;
    background: color-mix(in srgb, var(--el-color-warning) 8%, var(--el-bg-color));
    border: 1px solid var(--el-color-warning-light-7);
    border-radius: var(--el-border-radius-base);

    > span {
      display: grid;
      flex: 0 0 34px;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--el-color-warning-dark-2);
      background: var(--el-color-warning-light-9);
      border-radius: var(--art-surface-radius);
    }

    small,
    strong {
      display: block;
    }

    small {
      font-size: 9px;
      font-weight: 700;
      color: var(--el-color-warning-dark-2);
      letter-spacing: 0.1em;
    }

    strong {
      margin-top: 3px;
      font-size: 13px;
    }

    p {
      margin: 4px 0 0;
      font-size: 11px;
      line-height: 1.55;
      color: var(--el-text-color-secondary);
    }
  }

  .roadmap-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);

    article {
      min-width: 0;
      padding: 16px 18px;
    }

    article + article {
      border-left: 1px solid var(--el-border-color-lighter);
    }

    header {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    header > span {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      font-size: 12px;
      font-weight: 700;
      color: var(--el-color-primary);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: var(--art-surface-radius);
    }

    header small,
    header strong {
      display: block;
    }

    header small {
      font-size: 9px;
      color: var(--el-text-color-placeholder);
      letter-spacing: 0.08em;
    }

    header strong {
      margin-top: 2px;
      font-size: 14px;
    }

    article p {
      min-height: 38px;
      margin: 10px 0 12px;
      font-size: 12px;
      line-height: 1.6;
      color: var(--el-text-color-secondary);
    }

    article > div {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  }

  @media (width <= 1024px) {
    .mes-workbench__content {
      grid-template-columns: 1fr;
    }

    .mes-workbench__roadmap-card {
      grid-column: auto;
    }
  }

  @media (width <= 720px) {
    .production-line {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px 8px;
    }

    .production-line__rail {
      display: none;
    }

    .traceability-band {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .traceability-band .el-tag {
      grid-column: 2;
      width: fit-content;
    }

    .roadmap-grid {
      grid-template-columns: 1fr;
    }

    .roadmap-grid article + article {
      border-top: 1px solid var(--el-border-color-lighter);
      border-left: 0;
    }
  }
</style>
