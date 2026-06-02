---
title: Docker报错 unable to configure the Docker daemon with file /etc/docker/daemon.json
date: 2024-03-04 22:12:28
categories: 技术
tags:
  - Docker
---

莫名遇到一个非常奇怪的问题，Docker报错 unable to configure the Docker daemon with file /etc/docker/daemon.json:EOF，明明什么都没做。

<!-- more -->

### 解决办法

上网查找原因，给出一个非常奇怪的解决方案，就是将创建的daemon.json文件的后缀改为conf，即/etc/docker/daemon.conf。然后重启Docker，问题解决。

```bash
mv /etc/docker/daemon.json /etc/docker/daemon.conf
sudo systemctl daemon-reload
sudo systemctl restart docker
```

在之前的[安装Docker](https://nustarain.gitee.io/2023/10/30/DockerInit/)的博客中，也相应的进行了调整。