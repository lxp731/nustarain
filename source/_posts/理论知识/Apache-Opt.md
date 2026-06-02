---
title: Apache 优化着手点
date: 2023-10-06 14:09:32
categories: 理论知识
tags:
  - 面试
  - Linux
---

* 利用Apache自带的 rotatelogs 工具进行日志切割，保证单个日志文件不过大。

```bash
CustomLog "| /bin/rotatelogs -l /wwwlogs/access %Y%m%d.log 86400" combined
```

<!-- more -->

* 美化错误页面

* 屏蔽Apache版本信息等敏感信息

主要是为了防止对应版本的恶意攻击。

* 配置静态缓存

* 禁止解析 PHP 文件

* 配置 CDN。