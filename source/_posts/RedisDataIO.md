---
title: Redis集群数据读写演示
date: 2023-08-13 16:32:45
categories: 技术
tags:
  - Docker
---

### 数据读写存储

错误演示：

```bash
root@knight:/data# redis-cli -p 6381
127.0.0.1:6381> keys *
(empty array)
127.0.0.1:6381> set k1 v1
(error) MOVED 12706 192.168.1.42:6383
127.0.0.1:6381> set k2 v2
OK
127.0.0.1:6381> set k3 v3
OK
127.0.0.1:6381> set k4 v4
(error) MOVED 8455 192.168.1.42:6382
127.0.0.1:6381> 
```

<!-- more -->

可以发现使用`redis-cli -p 6381`命令进入单节点的容器，存在部分数据无法存储的情况（k2,k3存储成功，k1,k4存储失败），正确的进入方式应该是进入集群，然后进行数据的存储。

正确演示：

```bash
127.0.0.1:6381> exit
root@knight:/data# redis-cli -p 6381 -c
127.0.0.1:6381> FLUSHALL
OK
127.0.0.1:6381> set k1 v1
-> Redirected to slot [12706] located at 192.168.1.42:6383
OK
192.168.1.42:6383> set k4 v4
-> Redirected to slot [8455] located at 192.168.1.42:6382
OK
192.168.1.42:6382> 
```

退出后重新进入，清空所有的数据，重新插入之前插入失败的数据，可以插入了，并且可以发现之所以可以成功插入数据，是因为系统将数据重定向到了应该插入的机器上（注意端口号的变化）。

