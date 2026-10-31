# ChatGPT 表格复制助手

在 ChatGPT 对话表格的右上方添加“复制表格”按钮。点击后，在 Word 中粘贴为可编辑的表格。

## 安装（只需要一次）

1. 将下载的 ZIP 文件完整解压到一个固定位置。不要直接在压缩包里操作。
2. 在 Chrome 地址栏输入 `chrome://extensions`，按回车。
3. 打开页面右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后的 **ChatGPT-Table-Copy** 文件夹。这个文件夹中可以直接看到 `manifest.json`。
6. 看到“ChatGPT 表格复制助手”后，刷新已打开的 ChatGPT 页面。

Chrome 从这个文件夹加载扩展，请保留该文件夹。无需打包 CRX、安装 Node.js、购买服务或配置 API Key。

## 使用

1. 打开 `https://chatgpt.com/` 的对话，找到 ChatGPT 生成的表格。
2. 点击该表格右上方的 **复制表格**。按钮显示 **已复制**。
3. 切换到 Word，在正文中按 **Ctrl + V**。
4. 在 Word 的粘贴选项中选择 **保留源格式**。这样可保留表头、边框和文字格式。

粘贴后是 Word 可编辑表格，可以增删行列和修改文字。建议等待 ChatGPT 生成完毕再复制；复制的是点击时已经生成的内容。

如果表格太宽，可在 Word 中选中表格，使用“表格布局 → 自动调整 → 根据窗口自动调整表格”。不同 Word 版本的菜单名称可能略有不同。

## 已支持

- 每张表格各自复制；新生成的表格自动添加按钮。
- 切换会话、刷新页面和重新生成表格后自动识别。
- 宽表格横向滚动时，按钮仍位于表格上方右侧。
- 深色和浅色界面、Tab 聚焦、Enter / 空格触发。
- 保留行列、表头、合并单元格、中文、粗体、斜体、链接和单元格内换行。
- 为 Word 使用白色单元格、黑色文字、浅灰表头和细边框，不复制聊天界面的深色背景。
- 剪贴板同时提供表格格式和制表符分隔的文本，方便不同编辑器选择合适格式。
- 支持 `https://chatgpt.com/*` 和旧入口 `https://chat.openai.com/*`。

## 常见情况

**没有出现按钮**

先到扩展管理页确认已启用，再刷新 ChatGPT 页面。扩展只处理网页中真实的表格；代码块里的 Markdown、表格图片和 Canvas 文档不属于此版本的支持范围。用户输入区域的表格不会添加按钮。若浏览器由单位管理，单位策略可能禁止加载本地扩展。

**粘贴到 Word 后只有文字**

重新点击本扩展的“复制表格”，然后在 Word 正文中正常粘贴，选择“保留源格式”。不要使用“仅保留文本”或纯文本粘贴快捷键。表格外的普通复制按钮与本扩展的按钮不是同一个操作。

**出现“复制失败，重试”**

保持 ChatGPT 标签页在前台并重新点击。若浏览器或单位策略禁止写入剪贴板，需要在浏览器的站点设置或扩展权限中允许该操作。

**更新与卸载**

更新时替换原文件夹里的文件，在扩展管理页点击刷新图标，再刷新 ChatGPT 页面。卸载时点击扩展卡片中的“移除”。

## 隐私与权限

本扩展仅在上述 ChatGPT 页面运行。复制时只处理你点击的表格，不向服务器发送内容，不保存聊天记录，不含遥测或远程代码。仅申请 `clipboardWrite`（写入剪贴板）权限，不申请读取剪贴板权限。Chrome 显示对 ChatGPT 网站的访问提示，是内容脚本为表格添加按钮所需。

这是独立开发的辅助工具，与 OpenAI 或 Microsoft 没有关联。ChatGPT 网页结构变化可能需要更新识别逻辑；不同 Word 版本的粘贴样式可能略有差异。

## 源代码与验证

所有扩展源代码均在本目录，无编译步骤。`table-export.js` 负责表格格式和复制，`content.js` / `content.css` 负责页面按钮，`popup.html` / `popup.css` 是使用说明面板。

`tests/` 包含自动化测试和本地测试页面，`docs/` 包含设计与实施记录。测试需要 Node.js 和 Playwright，仅开发者运行测试时需要安装依赖：

```text
npm install --no-save playwright
```

Windows 中如已安装新版 Chrome，可在 PowerShell 运行：

```powershell
$env:TEST_BROWSER_CHANNEL = 'chrome'
node tests/run.cjs all
```

测试使用独立浏览器配置，页面内容由本地测试样本提供，不访问真实聊天。测试会将样例表格写入系统剪贴板。Chrome 的自动加载使用官方测试接口；普通安装按上面的“加载已解压的扩展程序”步骤操作。

本机验证结果见 `验证报告.md`。

## 参考

- [Chrome 官方：加载已解压的扩展程序](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
- [Chrome 官方：内容脚本](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [MDN：写入多种剪贴板格式](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write)

## 许可

MIT。可自由使用、修改和分发，详见 LICENSE。
