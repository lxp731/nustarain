---
title: 将更改过的容器导出为镜像
date: 2023-08-09 21:20:05
categories: 学习过程
tags:
  - Docker
---

执行命令：

```bash
docker commit -m "add vim package" -a "liuxp" 容器ID 容器名:版本号
```

* -m 添加提交描述。

* -a 指明提交人。 