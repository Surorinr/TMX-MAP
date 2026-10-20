#!/usr/bin/env node
/* 依次重新生成 extracted.js 并跑完全部测试；任意一个失败则整体以非 0 退出码结束。 */
const { execFileSync } = require('child_process');
const files = ['extract.js', 'test_tmx.js', 'test_tmx2.js', 'test_algo.js', 'test_algo2.js', 'test_determinism.js'];
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  execFileSync('node', [f], { stdio: 'inherit', cwd: __dirname });
}
console.log('\n=== 全部通过 ===');
