---
title: Docker演示Redis集群主从切换案例
date: 2023-08-14 14:46:40
categories: 技术
tags:
  - Docker 
  - Redis
---

### 操作步骤

1. 查看当前的集群情况

```bash
root@knight:/data# redis-cli -p 6381 -c
127.0.0.1:6381> cluster nodes
41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383@16383 master - 0 1691996146001 3 connected 10923-16383
849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386@16386 slave f999e35136ec2e61fcceebf182f5c38ef4a4354d 0 1691996144999 1 connected
9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385@16385 slave 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 0 1691996144000 3 connected
f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381@16381 myself,master - 0 1691996145000 1 connected 0-5460
8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384@16384 slave 6dca84998e245ce4cc6c92882fb7ac94d501efda 0 1691996144000 2 connected
6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382@16382 master - 0 1691996144000 2 connected 5461-10922
127.0.0.1:6381> 
```

<!-- more -->

当前登录主机为1号机，6号机是1号机的从服务器，5号机是3号机的从服务器，4号机是2号机的从服务器。

2. 关闭1号机容器，然后再次查看容器的状态

关闭1号容器

```bash
docker stop redis-node-1
```

效果：

```bash 折叠代码
root@knight:/docker# docker stop redis-node-1
redis-node-1
root@knight:/docker# docker ps -a
CONTAINER ID   IMAGE         COMMAND                  CREATED        STATUS                     PORTS     NAMES
61d59245db3d   redis:6.0.8   "docker-entrypoint.s…"   28 hours ago   Up 5 hours                           redis-node-6
223fad42e069   redis:6.0.8   "docker-entrypoint.s…"   28 hours ago   Up 5 hours                           redis-node-5
f0055941fe3f   redis:6.0.8   "docker-entrypoint.s…"   28 hours ago   Up 5 hours                           redis-node-4
e361d9695a0c   redis:6.0.8   "docker-entrypoint.s…"   28 hours ago   Up 5 hours                           redis-node-3
400119c3015c   redis:6.0.8   "docker-entrypoint.s…"   28 hours ago   Up 5 hours                           redis-node-2
61e2e38927c4   redis:6.0.8   "docker-entrypoint.s…"   28 hours ago   Exited (0) 9 seconds ago             redis-node-1
```

可以看到1号容器已经被关掉了。

3. 然后以2号机作为切入点，查看集群的状态。

进入2号容器：

```bash
docker exec -it redis-node-2 bash
```

效果：

```bash
root@knight:/docker# docker exec -it redis-node-2 bash
root@knight:/data# redis-cli -p 6382 -c
127.0.0.1:6382> cluster nodes
8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384@16384 slave 6dca84998e245ce4cc6c92882fb7ac94d501efda 0 1692013667508 2 connected
6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382@16382 myself,master - 0 1692013666000 2 connected 5461-10922
41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383@16383 master - 0 1692013667000 3 connected 10923-16383
f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381@16381 master,fail - 1692013443386 1692013440000 1 disconnected
9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385@16385 slave 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 0 1692013665000 3 connected
849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386@16386 master - 0 1692013665498 7 connected 0-5460
127.0.0.1:6382> 
```

可以看到当前6号机处于master状态，顶替了原来1号机的位置，而1号机现在处于fail状态。

这就完成了redis主从切换的演示，补充一句，如果把1号机重新启动回来的话，也不会影响现在6号机的master状态，1号机会作为6号机的slave机器。

效果如下：

```bash 折叠代码
root@knight:/docker# docker start redis-node-1 
redis-node-1
root@knight:/docker# docker exec -it redis-node-1 bash
root@knight:/data# redis-cli -p 6381 -c
127.0.0.1:6381> cluster nodes
849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386@16386 master - 0 1692013947000 7 connected 0-5460
f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381@16381 myself,slave 849a82f0bd85238762ca7ccf234aa30ba97d93a0 0 1692013947000 7 connected
9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385@16385 slave 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 0 1692013946019 3 connected
8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384@16384 slave 6dca84998e245ce4cc6c92882fb7ac94d501efda 0 1692013949036 2 connected
6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382@16382 master - 0 1692013947022 2 connected 5461-10922
41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383@16383 master - 0 1692013948030 3 connected 10923-16383
127.0.0.1:6381> 
```