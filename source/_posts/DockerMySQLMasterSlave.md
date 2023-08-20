---
title: Docker实现MySQL主从复制
date: 2023-08-12 19:57:57
categories: 技术
tags:
  - Docker
  - MySQL
---

### 操作步骤

1. 下载镜像

```bash
docker pull mysql:5.7
```

目前我测试最新的8.0.27是不能测试成功的，不知道原因出在哪里，保守一点使用5.7的版本。

<!-- more -->

实现效果：

```bash
root@knight:/docker# docker images
REPOSITORY   TAG       IMAGE ID       CREATED         SIZE
mysql        latest    3218b38490ce   19 months ago   516MB
```

2. 生成主数据库容器

```bash
docker run -d -p 3307:3306 \
--privileged=true \
-v /docker/mysql-master/log:/var/log/mysql \
-v /docker/mysql-master/data:/var/lib/mysql \
-v /docker/mysql-master/conf:/etc/mysql/conf.d \
-e MYSQL_ROOT_PASSWORD=admin \
--name mysql-master \
mysql:latest
```

具体的参数详解，可以查看[这篇文章](https://nustarain.gitee.io/2023/08/10/DockerMySQL/#more)

实现效果：

```bash
root@knight:/docker# docker ps
CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS         PORTS                                                  NAMES
a1f6f6e03029   mysql:latest   "docker-entrypoint.s…"   6 seconds ago   Up 5 seconds   33060/tcp, 0.0.0.0:3307->3306/tcp, :::3307->3306/tcp   mysql-master
```

3. 添加配置文件

进入`/docker/mysql-master/conf`目录，编辑配置文件`my.cnf`，插入以下内容：

```bash
[mysqld]
## 设置server_id，同一局域网中需要唯一
server_id=101 
## 指定不需要同步的数据库名称
binlog-ignore-db=mysql  
## 开启二进制日志功能
log-bin=com-mysql-bin  
## 设置二进制日志使用内存大小（事务）
binlog_cache_size=1M  
## 设置使用的二进制日志格式（mixed,statement,row）
binlog_format=mixed  
## 二进制日志过期清理时间。默认值为0，表示不自动清理。
expire_logs_days=7  
## 跳过主从复制中遇到的所有错误或指定类型的错误，避免slave端复制中断。
## 如：1062错误是指一些主键重复，1032错误是因为主从数据库数据不一致
slave_skip_errors=1062
```

4. 重启容器

```bash
docker restart mysql-master
```

5. 进入容器

```bash
docker exec -it mysql-master /bin/bash
```

6. 授权用户

进入数据库，添加授权用户。

```sql
CREATE USER 'slave'@'%' IDENTIFIED BY '123456';
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'slave'@'%';
```

实现效果：

```sql
Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> CREATE USER 'slave'@'%' IDENTIFIED BY '123456';
Query OK, 0 rows affected (0.03 sec)

mysql> GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'slave'@'%';
Query OK, 0 rows affected (0.02 sec)
```

7. 查看主数据库的主状态

```sql
mysql> show master status;
+----------------------+----------+--------------+------------------+-------------------+
| File                 | Position | Binlog_Do_DB | Binlog_Ignore_DB | Executed_Gtid_Set |
+----------------------+----------+--------------+------------------+-------------------+
| com-mysql-bin.000001 |      156 |              | mysql            |                   |
+----------------------+----------+--------------+------------------+-------------------+
1 row in set (0.00 sec)
```

8. 创建从数据库容器

```bash
docker run -d -p 3308:3306 \
--privileged=true \
-v /docker/mysql-slave/log:/var/log/mysql \
-v /docker/mysql-slave/data:/var/lib/mysql \
-v /docker/mysql-slave/conf:/etc/mysql/conf.d \
-e MYSQL_ROOT_PASSWORD=admin \
--name mysql-slave \
mysql:latest
```

9. 实现效果：

```bash
root@knight:/docker# docker ps
CONTAINER ID   IMAGE          COMMAND                  CREATED              STATUS              PORTS                                                  NAMES
06a84db29686   mysql:latest   "docker-entrypoint.s…"   3 seconds ago        Up 2 seconds        33060/tcp, 0.0.0.0:3308->3306/tcp, :::3308->3306/tcp   mysql-slave
a1f6f6e03029   mysql:latest   "docker-entrypoint.s…"   About a minute ago   Up About a minute   33060/tcp, 0.0.0.0:3307->3306/tcp, :::3307->3306/tcp   mysql-master
```

10. 添加配置文件

进入`/docker/mysql-slave/conf`目录，编辑配置文件`my.cnf`，插入以下内容：

```bash
[mysqld]
## 设置server_id，同一局域网中需要唯一
server_id=102
## 指定不需要同步的数据库名称
binlog-ignore-db=mysql  
## 开启二进制日志功能，以备Slave作为其它数据库实例的Master时使用
log-bin=com-mysql-slave1-bin  
## 设置二进制日志使用内存大小（事务）
binlog_cache_size=1M  
## 设置使用的二进制日志格式（mixed,statement,row）
binlog_format=mixed  
## 二进制日志过期清理时间。默认值为0，表示不自动清理。
expire_logs_days=7  
## 跳过主从复制中遇到的所有错误或指定类型的错误，避免slave端复制中断。
## 如：1062错误是指一些主键重复，1032错误是因为主从数据库数据不一致
slave_skip_errors=1062  
## relay_log配置中继日志
relay_log=com-mysql-relay-bin  
## log_slave_updates表示slave将复制事件写进自己的二进制日志
log_slave_updates=1  
## slave设置为只读（具有super权限的用户除外）
read_only=1
```

11. 重启容器

```bash
docker restart mysql-slave
```

12. 在从数据库中配置主从复制

进入容器
```bash
docker exec -it mysql-slave /bin/bash
```

进入数据库

```bash
mysql -u root -padmin
```

开启复制功能

```sql
change master to master_host='192.168.1.42', master_user='slave', master_password='123456', master_port=3307, master_log_file='com-mysql-bin.000001', master_log_pos=156, master_connect_retry=30;
```

上面的宿主机ip需要根据实际情况修改。

主从复制参数说明：

* master_host：主数据库的IP地址；
* master_port：主数据库的运行端口；
* master_user：在主数据库创建的用于同步数据的用户账号；
* master_password：在主数据库创建的用于同步数据的用户密码；
* master_log_file：指定从数据库要复制数据的日志文件，通过查看主数据的状态，获取File参数；
* master_log_pos：指定从数据库从哪个位置开始复制数据，通过查看主数据的状态，获取Position参数；
* master_connect_retry：连接失败重试的时间间隔，单位为秒。

13. 在从数据库中开启主从同步

```sql
start slave;
```

14. 查看从数据库状态

```sql
show slave status \G;
```

```sql
mysql> show slave status \G
*************************** 1. row ***************************
               Slave_IO_State: Connecting to source
                  Master_Host: 192.168.1.42
                  Master_User: slave
                  Master_Port: 3307
                Connect_Retry: 30
              Master_Log_File: com-mysql-bin.000001
          Read_Master_Log_Pos: 156
               Relay_Log_File: com-mysql-relay-bin.000001
                Relay_Log_Pos: 4
        Relay_Master_Log_File: com-mysql-bin.000001
             Slave_IO_Running: Yes
            Slave_SQL_Running: Yes
              Replicate_Do_DB: 
          Replicate_Ignore_DB: 
```

15. 主从复制测试

主库新建库、新建表、插入数据：

```sql
create database db108;
use db108;
create table t1 (id int,name varchar(20));
insert into t1 values(1,'liuxp');
select * from t1;
```

从库查看库、查看记录，看主从同步是否成功:

```sql
show databases;
use db108;
select * from t1;
```