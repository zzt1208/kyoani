# 京都动画作品档案

一个离线浏览的京都动画作品与人物图鉴，收录 62 部作品、115 位主要角色。支持作品搜索/筛选/排序/分页、角色图鉴、角色详情、作品档案（含 TV 作品的 OP/ED）、深链接分享和台词分享卡。

Demo：<https://zzt1208.github.io/kyoani/index.html>

## 使用

直接双击 `index.html` 即可，无需安装依赖或启动服务器。请保持目录结构不变。

深链接示例：

```text
?work=city                              打开作品
?character=164555                       打开角色
?work=city&character=164555             打开作品和角色
```

作品与角色弹窗均可直接复制当前链接分享。

## 文件结构

```text
index.html      页面结构
styles.css      样式
data.js         作品、角色、年表与图片路径数据
app.js          页面交互逻辑
assets/         本地图片资源
```

## 说明

- 作品与角色资料参考 Bangumi。
- 作品海报来自官方公开资料 / Bangumi，角色画像来自 AniList / Bangumi，版权归原权利人所有。
- 台词卡支持编辑台词并保存 PNG；部分浏览器在 `file://` 下会限制 Canvas 导出，建议通过部署后的 HTTPS 地址使用。