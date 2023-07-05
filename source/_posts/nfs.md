---
title: NFS挂载到服务器
date: 2023-07-04 13:54:37
categories: 技术
tags:
  - Linux
---

||||||||
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|主机名|身份|网络接口|连接模式|IP地址|软件|
|NFS|存储服务器|ens224|仅主机|10.8.7.40/24|nfs-utils|
|Web1|Web服务器|ens224|仅主机|10.8.7.80/24|nginx、nfs-utils|

### NFS服务器部分

1. 下载软件

```bash
yum install -y nfs-utils
```

<!-- more -->

2. 编辑配置文件`vim /etc/exports`

```bash
/www 10.8.7.80(rw)
```

这个配置文件代表将自己主机下的`/www`目录共享给10.8.7.80主机，并且赋予读和写的权限。

3. 要记得把要共享出去的目录赋予相应的权限，要不然访问起来会有问题,在这里我直接给了`777`，不要学我，只是告诉你们如果后期NGINX访问出现404，应该要想到回到这里思考权限的问题。

```bash
chmod 777 /www
```

4. 启动服务

```bash
systemctl start nfs-server
```

5. 导出配置文件

```bash
exportfs -rv
```

### Web服务器的部分

1. 编辑`/etc/fstab`实现永久挂载

```bash
10.8.7.40:/www  /www    nfs     rw,sync 0 0
```
2. 挂载共享目录

```bash
systemctl daemon-reload
mount -a
```