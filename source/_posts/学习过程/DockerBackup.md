---
title: Docker重要数据备份
date: 2023-08-08 15:02:50
categories: 学习过程
tags:
  - Docker
---

生产环境中，免不了会出现一些误操作，导致Docker开发重要文件或者数据的丢失，那么做好重要数据的备份是免不了的。主要就是重要的配置文件，甚至已经生成的重要的容器，后者更简单粗暴。

### 拷贝容器的配置文件

```bash
docker cp 容器ID:/tmp/a.txt /home/admin
```

例子：

<!-- more -->

将nginx-1容器的NGINX配置文件拷贝到当前目录下

```bash
root@knight:/docker/nginx# ls
root@knight:/docker/nginx# docker ps
CONTAINER ID   IMAGE          COMMAND                  CREATED          STATUS          PORTS     NAMES
c2dbddec15d3   mynginx:0.1    "/bin/bash"              44 minutes ago   Up 25 minutes             nginx-1
root@knight:/docker/nginx# docker cp nginx-1:/etc/nginx/nginx.conf ./
root@knight:/docker/nginx# ls
nginx.conf
root@knight:/docker/nginx# 
```

### 容器的导入与导出

导出容器（默认是导出到当前目录下）：

```bash
docker export 容器ID > xxx.tar
```

例子：

```bash
root@knight:/docker# ls
root@knight:/docker# docker ps
CONTAINER ID   IMAGE          COMMAND                  CREATED          STATUS          PORTS     NAMES
c2dbddec15d3   mynginx:0.1    "/bin/bash"              51 minutes ago   Up 31 minutes             nginx-1
root@knight:/docker# docker export nginx-1 > nginx-1.tar
root@knight:/docker# ls
nginx-1.tar
root@knight:/docker# 
```

导入容器：

```bash
cat xxx.tar | docker import - [用户名/]镜像名:版本号
```

例子：

导入nginx-1.tar这个容器

```bash
root@knight:/docker# ls
nginx-1.tar
root@knight:/docker# docker images
REPOSITORY    TAG       IMAGE ID       CREATED         SIZE
root@knight:/docker# cat nginx-1.tar | docker import - knight/nginx-1:0.1
sha256:f82cc108516521700a6d74e03e26be639131a5d361c66b50f923ba00a1df8fe3
root@knight:/docker# docker images
REPOSITORY       TAG       IMAGE ID       CREATED         SIZE
knight/nginx-1   0.1       f82cc1085165   4 seconds ago   140MB
root@knight:/docker# 
```