---
title: Docker安装及镜像加速
date: 2023-10-30 20:36:19
categories: 技术
tags:
  - Docker
---

### Docker 安装

官方提供了一键安装脚本，直接执行，耐心等待脚本执行完毕即可。

```bash
curl -fsSL https://get.docker.com | bash -s docker
```

<!-- more -->

### 镜像加速

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.conf <<-'EOF'
{
  "registry-mirrors": ["https://az7a5oso.mirror.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```