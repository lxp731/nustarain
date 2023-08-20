---
title: Docker镜像推送到私有仓库
date: 2023-08-09 23:15:50
categories: 学习过程
tags:
  - Docker
---

在实际的生产条件中，公司会用到涉及公司内部的资料，并不希望将镜像挂在公共的仓库，那就需要一个私有的容器仓库来存放打包的镜像，本节记录如何创建本地私有镜像仓库，并上传下载镜像。

1. 拉取镜像

执行以下命令：

```bash
docker pull registry
```

<!-- more -->

2. 运行容器

下载完镜像之后同样需要先把镜像运行起来，执行下面的命令：

```bash
docker run -d -p 5000:5000 -v /docker/registry/:/tmp/registry --privileged=true --name registry-1 registry
```

* -d 守护进程运行（后台运行）

* -v 数据卷映射，把本地的`/docker/registry/`映射为容器的`/tmp/registry`。

* --privileged=true，container内的root拥有真正的root权限。具体解释参考[这篇文章](https://blog.csdn.net/wangxuelei036/article/details/107457712)。

* --name 指定容器的名字，不设置会由系统随机分配一个。

3. 测试仓库可用性

当前我电脑的IP为：192.168.1.42。

```bash
curl -XGET http://192.168.1.42:5000/v2/_catalog
```

下面的例子可以看到当前本地私有仓库中并没有任何的镜像，出现`{"repositories":[]}`,表示本地私有仓库可用。

```bash
root@knight:/# curl -XGET http://192.168.1.42:5000/v2/_catalog
{"repositories":[]}
```

4. 生成镜像

更新一个镜像，并重新commit生成一个镜像，具体生成镜像的方法可以参考[这篇文章](https://nustarain.gitee.io/2023/08/09/ContainerCommit/)

比如，我利用mynginx:1.0重新生成了版本号为1.1的mynginx镜像：

```bash
root@knight:/# docker commit -m "add net-tools package" -a "lxp" nginx-1 mynginx:1.1
sha256:f35ce030ad1119c6fe4a1398386048ad51471e80a672c55912b46f157d1554c2
root@knight:/# docker images
REPOSITORY       TAG       IMAGE ID       CREATED          SIZE
mynginx          1.1       f35ce030ad11   11 seconds ago   198MB
mynginx          1.0       ff65638c821e   5 hours ago      196MB
```

5. 更改镜像名称

上传到本地私有仓库需要满足一定的镜像名称上传规范，需要对mynginx:1.1进行改名：

当前我电脑的IP为：192.168.1.42。

```bash
docker tag mynginx:1.1 192.168.1.42:5000/mynginx:1.1
```

效果如下：

```bash
root@knight:/# docker tag mynginx:1.1 192.168.1.42:5000/mynginx:1.1 
root@knight:/# docker images
REPOSITORY                  TAG       IMAGE ID       CREATED          SIZE
192.168.1.42:5000/mynginx   1.1       f35ce030ad11   13 minutes ago   198MB
mynginx                     1.1       f35ce030ad11   13 minutes ago   198MB
mynginx                     1.0       ff65638c821e   5 hours ago      196MB
```

可以看出，修改tag之后，并不是将原来的镜像直接更名，而是克隆出一个更名的镜像。

6. 修改配置文件

在docker中默认不支持http协议，所以需要我们手动修改配置文件，以支持http协议。

例：

```bash
root@knight:/# cat /etc/docker/daemon.json 
{
  "registry-mirrors": ["https://az7a5oso.mirror.aliyuncs.com"],
  "insecure-registries": ["192.168.1.42:5000"]
}
```

* registry-mirrors 是加速用的。

* insecure-registries 是开启http协议的。

配置完成后如果不生效，尝试`systemctl daemon-reload`。

如果还是不行，尝试`systemctl restart docker`，实际生产环境中，很少会直接重启docker，因为重启后，所有的容器都会停止，所以这条命令一定要放在最后。

如果重启了docker，不要忘记步骤2，重新运行容器。

7. 上传到私有仓库

```bash
docker push 192.168.1.42:5000/mynginx:1.1 
```

例子：

```bash
root@knight:/# docker push 192.168.1.42:5000/mynginx:1.1 
The push refers to repository [192.168.1.42:5000/mynginx]
0033c6e89448: Pushed 
d874fd2bc83b: Pushed 
32ce5f6a5106: Pushed 
f1db227348d0: Pushed 
b8d6e692a25e: Pushed 
e379e8aedd4d: Pushed 
2edcec3590a4: Pushed 
1.1: digest: sha256:e8c89fef743b31184833c6e08d0415c3e5cdd38770dcb584b1ad6173c64df4a4 size: 1782
```

8. 验证仓库镜像

```bash
root@knight:/# curl -XGET http://192.168.1.42:5000/v2/_catalog
{"repositories":["mynginx"]}
```

可以看到现在仓库中已经存在“mynginx”的镜像了。

9. PULL到本地使用

```
docker pull 192.168.1.42:5000/mynginx:1.1
```

例子：

```bash
root@knight:/# docker images
REPOSITORY                  TAG       IMAGE ID       CREATED             SIZE
192.168.1.42:5000/mynginx   1.1       f35ce030ad11   About an hour ago   198MB
mynginx                     1.1       f35ce030ad11   About an hour ago   198MB
nginx                       latest    605c77e624dd   19 months ago       141MB
registry                    latest    b8604a3fe854   21 months ago       26.2MB
root@knight:/# docker rmi 192.168.1.42:5000/mynginx:1.1 
Untagged: 192.168.1.42:5000/mynginx:1.1
Untagged: 192.168.1.42:5000/mynginx@sha256:e8c89fef743b31184833c6e08d0415c3e5cdd38770dcb584b1ad6173c64df4a4
root@knight:/# docker images
REPOSITORY   TAG       IMAGE ID       CREATED             SIZE
mynginx      1.1       f35ce030ad11   About an hour ago   198MB
nginx        latest    605c77e624dd   19 months ago       141MB
registry     latest    b8604a3fe854   21 months ago       26.2MB
root@knight:/# docker pull 192.168.1.42:5000/mynginx:1.1
1.1: Pulling from mynginx
Digest: sha256:e8c89fef743b31184833c6e08d0415c3e5cdd38770dcb584b1ad6173c64df4a4
Status: Downloaded newer image for 192.168.1.42:5000/mynginx:1.1
192.168.1.42:5000/mynginx:1.1
root@knight:/# docker images
REPOSITORY                  TAG       IMAGE ID       CREATED             SIZE
192.168.1.42:5000/mynginx   1.1       f35ce030ad11   About an hour ago   198MB
mynginx                     1.1       f35ce030ad11   About an hour ago   198MB
nginx                       latest    605c77e624dd   19 months ago       141MB
registry                    latest    b8604a3fe854   21 months ago       26.2MB
```