---
title: 解决Docker搭建MySQL的中文乱码问题
date: 2023-08-10 15:18:43
categories: 技术
tags:
  - Docker
  - MySQL
---

利用Docker搭建的MySQL，如果不进行额外的设置，默认是不支持在表里插入中文字符的，在实际的生产环境中，这是不允许出现的情况，要解决这个问题，主要的一个核心思想是：在容器中的`/etc/mysql/conf.d`目录下添加文件`my.cnf`。

提供以下几种方法：

### 方法一

如果在生成容器时，使用-v 选项指定了容器和主机之间的配置文件的映射，那么直接在主机相应的目录下直接进行操作即可。

<!-- more -->

比如：

```bash
docker run -d -p 3306:3306 --privileged=true -v /docker/mysql/log:/var/log/mysql -v /docker/mysql/data:/var/lib/mysql -v /docker/mysql/conf:/etc/mysql/conf.d -e MYSQL_ROOT_PASSWORD=admin --name mysql-1 mysql:latest 
```

在这个例子中，使用-v 选项将主机/docker/mysql/conf和容器的/etc/mysql/conf.d进行映射，那么直接执行：

```bash
cd /docker/mysql/conf
vim my.cnf
```

在文件中插入：

```bash
[client]
default_character_set = utf8
[mysqld]
collation_server = utf8_general_ci
character_set_server = utf8
```

保存退出后重启容器：

```bash
docker restart mysql-1
```

### 方法二

在生成容器的时候没有进行配置文件目录的映射：

1. 进入容器：

```bash
docker exec -it mysql-1 /bin/bash
```

2. 下载软件包vim

此时，我们的目的是向`/etc/mysql/conf.d`目录下添加`my.cnf`配置文件，但是目前容器中并不存在vim软件包，下载软件包可以参考[这篇文章](https://nustarain.gitee.io/2023/08/09/ContainerDownloadSoft/)。

也可以直接执行下面的命令：

```bash
apt-get update
apt install -y vim
```

3. 等待安装完成后

```bash
cd /etc/mysql/conf.d
vim my.cnf
```

在文件中插入：

```bash
[client]
default_character_set = utf8
[mysqld]
collation_server = utf8_general_ci
character_set_server = utf8
```

4. 重启容器

```bash
docker restart mysql-1
```

### 方法三

1. 在主机本地编辑文件`my.cnf`。

2. 插入内容：

```bash
[client]
default_character_set = utf8
[mysqld]
collation_server = utf8_general_ci
character_set_server = utf8
```

3. 拷贝文件至容器

```bash
docker cp mysql-1 ./my.cnf /etc/mysql/conf.d
```

4. 重启容器

```bash
docker restart mysql-1
```

### 检查配置文件是否生效

进入容器，进入数据库，输入：

```bash
SHOW VARIABLES LIKE 'character%';
```

回车出现以下，修改成功：

```bash
mysql> SHOW VARIABLES LIKE 'character%';
+--------------------------+--------------------------------+
| Variable_name            | Value                          |
+--------------------------+--------------------------------+
| character_set_client     | utf8mb3                        |
| character_set_connection | utf8mb3                        |
| character_set_database   | utf8mb3                        |
| character_set_filesystem | binary                         |
| character_set_results    | utf8mb3                        |
| character_set_server     | utf8mb3                        |
| character_set_system     | utf8mb3                        |
| character_sets_dir       | /usr/share/mysql-8.0/charsets/ |
+--------------------------+--------------------------------+
8 rows in set (0.00 sec)
```