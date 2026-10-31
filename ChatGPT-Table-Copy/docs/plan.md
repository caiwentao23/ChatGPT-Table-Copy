# ChatGPT 表格复制 Implementation Plan

**Goal:** 交付可加载的 Chrome 扩展和中文安装说明。

**Architecture:** table-export.js 负责格式转换和剪贴板；content.js 负责按钮和动态页面；content.css 负责工具条样式；popup.html 提供简单使用提示。使用原生 JavaScript，无运行依赖、无服务器。

**Tech Stack:** Chrome Manifest V3、ClipboardItem、MutationObserver、Node.js 内置断言、Playwright Chromium。

## Global Constraints

- 仅支持 chatgpt.com 和 chat.openai.com 的 HTTPS 页面。
- 复制为 HTML 表格和纯文本两种表示，不能悄悄降级为纯文本。
- 不能修改源表格内容；新表格和会话切换应自动处理。
- 生产代码无网络请求、远程依赖、遥测或剪贴板读取。

## Task 1: 表格转换和复制

- [x] 先编写 tests/run.cjs，断言 serializeTable 存在，并验证合并单元格、链接过滤、换行及格式。
- [x] 运行测试，确认在缺少实现时断言失败。
- [x] 实现 table-export.js，接口 serializeTable(table): {html, text} 和 copyTable(table): Promise<void>。
- [x] 运行导出测试验证 HTML 和纯文本；额外覆盖现代 API 失败时的 copy 事件回退。

## Task 2: 页面按钮

- [x] 编写初始表格、动态表格、删除替换、宽表、多表及用户输入区域的测试。
- [x] 确认缺少按钮时测试失败，再实现 content.js、content.css、manifest.json。
- [x] 在独立测试浏览器中加载扩展，点击按钮，验证真实 HTML/纯文本剪贴板和富文本粘贴。
- [x] 覆盖复制失败结果、键盘使用和深浅色样式；补测倒序布局并修复。

## Task 3: 可交付扩展

- [x] 制作 popup.html、popup.css 和图标，编写 README.md 中文安装与使用说明。
- [x] 检查清单引用、生产脚本语法、权限和网络调用。
- [x] 运行全部 13 项测试并保存验证报告；真实 Word 粘贴通过，独立静态审查通过。
- [x] 将可加载目录、源代码及压缩包放入 outputs，检查压缩包内容。

执行：按用户开发请求在当前会话完成，不另开分支或提交当前生成目录。
