---
title: 容器中下载软件包
date: 2023-08-09 20:36:43
categories: 学习过程
tags:
  - Docker
---

每个容器都相当于一台单独linux机器。也正因为容器的轻便型，部署好容器后，非常多的软件都是不存在的，需要自己按需下载。

一般的步骤是：

1. 执行命令：

```bash
apt-get update
```

2. 等待软件包缓存更新完毕，执行下载命令，比如：

```bash
apt install -y vim
```