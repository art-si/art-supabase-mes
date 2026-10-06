import type { Component } from 'vue'
import { bootstrapPlatformApp } from '@/bootstrap'
import { registerApplicationViewModules } from '@/router/core/component-loader'

type RouteComponentModule = { default: Component }

const sourceRoot = './views'
const modules = import.meta.glob<RouteComponentModule>([
  './views/**/*.vue',
  '!./views/**/modules/**/*.vue',
  '!./views/**/components/**/*.vue'
])

registerApplicationViewModules('mes', sourceRoot, modules)
bootstrapPlatformApp()
