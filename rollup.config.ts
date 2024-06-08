import path from 'node:path'
import { fileURLToPath } from 'node:url'
import typescript from 'rollup-plugin-typescript2' // 处理typescript
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { RollupOptions } from 'rollup'

import pkg from './package.json' assert { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  {
    input: path.join(__dirname, 'src/index.ts'),
    plugins: [
      resolve(),
      commonjs(),
      typescript(),
      babel({ babelHelpers: 'runtime', exclude: 'node_modules/**', extensions: ['.js', '.jsx', '.ts', '.tsx'] }),
    ],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' },
    ],
  },
] as RollupOptions
