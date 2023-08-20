---
title: Docker数据卷详解
date: 2023-08-10 14:39:46
categories: 学习过程
tags:
  - Docker
---

### 数据卷介绍

容器数据卷(Container Volumes)是Docker用于持久化和共享容器数据的一种机制。它允许您在容器之间共享文件/文件夹,并且对容器生命周期之外的数据进行持久化存储。

主要特点包括:

- 数据共享 - 容器之间可以通过数据卷来共享数据。多个容器可以同时挂载一个数据卷,实现数据共享。

<!-- more -->

- 数据持久化 - 数据卷的生命周期独立于容器,即使容器被删除,数据卷中的数据也不会丢失。

- 数据加密 - 可以对 Docker 数据卷内容进行加密,保证数据安全性。

- 性能优势 - 容器绕过 Union File System,可以直接操作数据卷,提高IO性能。

- 挂载宿主目录 - 可以将宿主机上的目录作为数据卷挂载到容器中,实现容器访问宿主机文件。

使用数据卷的场景包括需要保存容器数据、需要在容器之间共享文件、需要备份、恢复或迁移数据等。总之,容器数据卷为容器提供了持久化存储和数据共享能力。

### 简单使用

```bash
docker run -d -p 6603:3306 -v /home/mysql/conf:/etc/mysql/conf.d -v /home/mysql/data:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=123456 --name mysql01 mysql:5.7
```

使用-v选项来对主机目录和容器内的目录进行映射，使用冒号间隔。

映射后，从无论是主机部分新建的文件，还是容器内新建的文件，都可以实时在映射对方实现互通有无。

### 常用命令

1. 删除数据卷

```bash
docker volume create my-vol
```

2. 查看所有的数据卷

```bash
docker volume ls
```

3. 查看指定数据卷的信息

```bash
docker volume inspect my-vol
```

4. 删除数据卷

```bash
docker volume rm my-vol
```

5. 清理无主的数据卷

```bash
docker volume prune
```

6. 使用 --mount创建数据卷

挂载一个主机目录作为数据卷。使用 --mount 标记可以指定挂载一个本地主机的目录到容器中去。

```bash
docker run -d --name test \
    --mount type=bind,source=/host/path,target=/container/path \
    nginx:latest
```

这个例子中,会将主机路径 /host/path 挂载到容器内的 /container/path,实现在主机和容器之间共享这个目录。

另一个例子:

```bash
docker run -d --name test \
   --mount type=bind,source=$(pwd)/config.json,target=/app/config.json \
   myapp:latest
```

这将主机当前目录下的 config.json 文件挂载到容器的 /app/config.json。挂载单个文件作为数据卷,提供一种配置注入的方式。

总之,--mount 参数提供了一个在 docker run 时直接挂载主机目录的简便方法,避免了使用额外的 docker volume 命令。

### 具名挂载和匿名挂载

具名挂载(Named Volumes)和匿名挂载(Anonymous Volumes)是Docker中的两种数据卷方式。

具名挂载:

需要通过docker volume create命令显式地创建。
卷的名称可以被用户自定义。
生命周期独立于容器,容器删除后卷仍然存在。
可以被多个容器同时挂载使用。

匿名挂载:

在docker run命令中通过-v参数隐式创建。
名称随机生成,用户不可自定义。
生命周期依赖于容器,容器删除后匿名卷也会被删除。
仅供一个容器专有使用。

具名挂载(Named Volumes)和匿名挂载(Anonymous Volumes)都是Docker的数据卷,主要区别如下:

1. 定义方式不同

具名挂载需要通过docker volume create命令显式创建。
匿名挂载可以通过docker run命令隐式创建。

2. 生命周期不同

具名挂载的生命周期独立于容器,容器删除后卷仍然存在。
匿名挂载的生命周期和容器一致,容器删除后匿名卷也会被删除。

3. 使用方式不同

具名挂载可以被多个容器同时挂载使用。
匿名挂载仅供一个容器专有使用。

例子：

具名挂载:

```bash
docker volume create my-vol
docker run -v my-vol:/opt container
```

匿名挂载:

```bash
docker run -v /opt container
```

上面在运行容器时分别使用了具名挂载my-vol和匿名挂载/opt,它们的生命周期和作用范围不同。

### 数据卷的共享

--volumes-from参数可以实现Docker容器之间的数据卷共享。

其作用是将指定容器挂载的数据卷,挂载到当前容器中,实现多容器间的卷共享。

例如:

1. 创建一个命名为 vol1 的数据卷

```bash
# 容器dbdata挂载名为dbvol的数据卷 
docker run -d --name dbdata -v dbvol:/dbdata mysql

# 容器webapp使用--volumes-from来挂载dbdata中的数据卷
docker run -d --name webapp --volumes-from dbdata nginx
```

上面通过--volumes-from dbdata,实现了容器webapp继承容器dbdata的卷挂载配置。webapp也可以访问dbvol的数据卷了。

需要注意的是,--volumes-from Parameters会继承前容器所有卷的挂载配置,包括匿名和具名的。

如果仅想共享指定的命名卷,可以用--volumes-from加上容器名称和卷名的组合实现,例如:

```bash
--volumes-from dbdata:dbvol
```