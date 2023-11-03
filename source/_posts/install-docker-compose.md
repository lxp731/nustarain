---
title: 安装 docker-compose
date: 2023-11-03 23:28:03
categories: 探索
tags:
  - Docker
---

### 在线安装

安装命令在github上，下载起来会很慢，可自行尝试。   
如果出现`url: (7) Failed to connect to github.com port 443: 拒绝连接`错误，可以通过在`/etc/hosts`文件里添加`140.82.114.3 github.com`条目解决。

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
```

<!-- more -->

### 离线安装

如果因为网络问题不能安装的话，可以通过离线安装，在这里提供一个 V2.23.0 版本的包。[**docker-compose-linux-x86_64**](https://pan.baidu.com/s/1QB1o3NeihQoWKZ6q0pG6MQ?pwd=hsu3)，提取码：hsu3。

上传到服务器后，执行以下操作：

```bash
mv docker-compose-linux-x86_64 /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker-compose -v
```

如果看到版本号在，即安装成功。