import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const { descriptor } = parse(readFileSync(new URL('index.vue', import.meta.url), 'utf8'))
assert.ok(descriptor.scriptSetup)
const source = ts.createSourceFile(
  'manufacturing.tsx',
  descriptor.scriptSetup.content,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
)

interface DeleteOptions {
  resources: Array<{ id: string; label: string }>
  permission: string
  remove: () => Promise<void>
  onDeleted: () => Promise<void>
}

for (const kind of ['WorkOrders', 'Tasks'] as const) {
  for (const batch of [false, true]) {
    test(`${kind}: ${batch ? 'batch failures recheck references' : 'single deletion retains its lifecycle API'}`, async () => {
      const declaration = source.statements.find(
        (node): node is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(node) && node.name?.text === `remove${kind}`
      )
      assert.ok(declaration)
      const calls: string[] = []
      const rows = [
        { id: 'first', workOrderNo: 'WO-001', taskNo: 'TASK-001', operationName: '首道工序' },
        { id: 'second', workOrderNo: 'WO-002', taskNo: 'TASK-002', operationName: '后续工序' }
      ]
      const apiName = kind === 'WorkOrders' ? 'WorkOrder' : 'OperationTask'
      const bindings = {
        [`delete${kind}`]: async (options: DeleteOptions) => {
          assert.equal(
            options.permission,
            kind === 'WorkOrders' ? 'MesWorkOrder:Delete' : 'MesOperationTask:Delete'
          )
          assert.equal(options.resources.length, batch ? 2 : 1)
          calls.push('guard')
          await options.remove()
          await options.onDeleted()
        },
        [`transition${apiName}`]: async (id: string, action: string) => {
          assert.equal(id, 'first')
          assert.equal(action, 'delete')
          calls.push('single')
        },
        [`batchTransition${apiName}s`]: async (ids: string[], action: string) => {
          assert.equal(JSON.stringify(ids), JSON.stringify(['first', 'second']))
          assert.equal(action, 'delete')
          calls.push('batch')
          return { successIds: ['first'], failures: [{ id: 'second', message: '新增业务引用' }] }
        },
        [kind === 'WorkOrders' ? 'inspectWorkOrderReferences' : 'inspectTaskReferences']: async (
          resources: Array<{ id: string }>
        ) => {
          assert.equal(JSON.stringify(resources.map((row) => row.id)), JSON.stringify(['second']))
          calls.push('recheck')
          return true
        },
        notifyBatchResult: () => calls.push('summary'),
        ElMessage: { success: () => calls.push('success') },
        tableRef: {
          value: {
            clearSelection: () => {},
            refreshRemove: async () => calls.push('refresh')
          }
        }
      }
      const javascript = ts.transpileModule(`${declaration.getText()}; remove${kind}`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 }
      }).outputText
      const remove = vm.runInNewContext(javascript, bindings) as (
        records: object[]
      ) => Promise<void>
      await remove(batch ? rows : rows.slice(0, 1))
      assert.deepEqual(
        calls,
        batch
          ? ['guard', 'batch', 'recheck', 'summary', 'refresh']
          : ['guard', 'single', 'success', 'refresh']
      )
    })
  }
}
