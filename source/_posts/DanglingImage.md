---
title: Docker的虚悬镜像的查看和删除
date: 2023-08-08 01:06:41
categories: 学习过程
tags:
  - Docker
---

### 什么是虚悬镜像

虚悬镜像（dangling image）一言以蔽之：镜像既没有仓库名，也没有标签，均为\<none>

\<none>      \<none>     02385df0ef86    3 days ago   123 MB

<!-- more -->

### 查看虚悬镜像

```bash
docker images -f dangling=true
```

### 删除虚悬镜像

```bash
docker rmi $(docker images -q -f dangling=true)
```