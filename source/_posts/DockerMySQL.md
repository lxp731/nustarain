---
title: 利用Docker搭建MySQL服务器（实战版）
date: 2023-08-10 14:40:04
categories: 学习过程
tags:
  - Docker
---



### 操作步骤

1. 拉取镜像

```bash
docker pull mysql
```

<!-- more -->

2. 生成容器

```bash
docker run -d -p 3306:3306 --privileged=true -v /docker/mysql/log:/var/log/mysql -v /docker/mysql/data:/var/lib/mysql -v /docker/mysql/conf:/etc/mysql/conf.d -e MYSQL_ROOT_PASSWORD=admin --name mysql-1 mysql:latest 
```

* -d 后台运行

* -p 端口映射，将本机的3306，映射为容器的3306端口，需要注意的是，如果本机已经装了MySQL，本机3306端口已经被占用的话，需要改变监听的端口。

* -v /docker/mysql/log:/var/log/mysql 数据库服务的日志目录映射

* -v /docker/mysql/data:/var/lib/mysql 数据库服务的数据库数据映射

* -v /docker/mysql/conf:/etc/mysql/conf.d 数据库服务的配置文件映射

* -e 指定数据库服务的密码

* --name 指定容器名称

3. 验证生成

```bash
docker ps
```

4. 进入容器

```bash
docker exec -it mysql-1 /bin/bash
```

5. 进入数据库

```bash
mysql -u root -padmin
```

* -p 输入生成容器时设置的密码，-p和密码之间不能有空格