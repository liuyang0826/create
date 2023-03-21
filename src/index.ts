import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execa } from 'execa'
import minimist from 'minimist'
import { rimraf } from 'rimraf'

async function main() {
  const argv = minimist(process.argv.slice(2), { string: ['_'] })
  const [, origin, subDir] = /^(https?:\/\/[^\s:]+(?::\d+)?[^\s:]+)(?::(\S+))?$/.exec(argv._[0]) ?? []
  const dest = argv._[1] ?? subDir?.split('/').at(-1) ?? subDir ?? origin?.split('/').at(-1)?.split('.')[0]
  if (!dest) throw new Error('no dest')
  const root = join(process.cwd(), dest)
  if (existsSync(root)) throw new Error(`${root} already exists`)
  const temp = join(root, '.temp')
  mkdirSync(root)
  mkdirSync(temp)

  await execa('git', ['init'], { stdio: 'inherit', cwd: temp })

  if (subDir) {
    await execa('git', ['sparse-checkout', 'init'], { stdio: 'inherit', cwd: temp })
    await execa('git', ['sparse-checkout', 'set', subDir], { stdio: 'inherit', cwd: temp })
  }

  await execa('git', ['remote', 'add', 'origin', origin], { stdio: 'inherit', cwd: temp })
  await execa('git', ['pull', '--depth', '1', 'origin', 'master'], { stdio: 'inherit', cwd: temp })

  if (subDir) {
    copy(join(temp, subDir), root)
  } else {
    copy(temp, root)
  }

  await Promise.all([rimraf(temp), rimraf(join(root, '.git'))])
  await execa('git', ['init'], { stdio: 'inherit', cwd: root })
}

function copy(src: string, dest: string) {
  const stat = statSync(src)

  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    copyFileSync(src, dest)
  }
}

function copyDir(srcDir: string, destDir: string) {
  mkdirSync(destDir, { recursive: true })

  for (const file of readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

main()
