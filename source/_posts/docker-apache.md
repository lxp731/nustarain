---
title: Docker 如何正确启动 Apache
date: 2023-11-03 21:03:21
categories: 技术
tags:
  - Docker
---

### 问题描述

docker报错：
System has not been booted with systemd as init system (PID 1). Can‘t operate.
Failed to connect to bus: Host is down

<!-- more -->

### 解决办法

```bash
# 运行centos
# docker run -itd --name centos centos /bin/bash

# 替换为：
# 获取systemctl权限
docker run --privileged -itd --name centos centos /usr/sbin/init

# 进入终端
docker exec -it centos /bin/bash
```