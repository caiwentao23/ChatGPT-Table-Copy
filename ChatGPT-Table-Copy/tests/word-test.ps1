$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Add()
    $document.Content.Paste()
    if ($document.Tables.Count -ne 1) { throw "Word 未识别为一张表格。" }
    $table = $document.Tables.Item(1)
    if ($table.Rows.Count -ne 4 -or $table.Columns.Count -ne 3) { throw "Word 粘贴行列数不正确。" }
    if ($table.Cell(2, 1).Range.Text -notlike '*基础版*') { throw "Word 中文内容不正确。" }
    if ($table.Cell(2, 1).Range.Characters.Item(1).Font.Bold -ne -1) { throw "Word 未保留粗体。" }
    if ($document.Hyperlinks.Count -lt 1) { throw "Word 未保留链接。" }
    [pscustomobject]@{ application='Microsoft Word'; version=$word.Version; tables=$document.Tables.Count; rows=$table.Rows.Count; columns=$table.Columns.Count; bold=$true; links=$document.Hyperlinks.Count } | ConvertTo-Json -Compress
} finally {
    if ($document) { $document.Close([ref]0) }
    if ($word) { $word.Quit([ref]0)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
}
