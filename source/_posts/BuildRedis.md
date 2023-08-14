---
title: 搭建Redis集群
date: 2023-08-13 15:19:35
categories: 技术
tags:
  - Docker
---

### 操作步骤

1. 下载镜像

```bash
docker pull redis:6.0.8
```

<!-- more -->

2. 生成容器

```bash
docker run -d --name redis-node-1 --net host --privileged=true -v /docker/redis/share/redis-node-1:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6381
docker run -d --name redis-node-2 --net host --privileged=true -v /docker/redis/share/redis-node-2:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6382
docker run -d --name redis-node-3 --net host --privileged=true -v /docker/redis/share/redis-node-3:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6383
docker run -d --name redis-node-4 --net host --privileged=true -v /docker/redis/share/redis-node-4:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6384
docker run -d --name redis-node-5 --net host --privileged=true -v /docker/redis/share/redis-node-5:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6385
docker run -d --name redis-node-6 --net host --privileged=true -v /docker/redis/share/redis-node-6:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6386
```

效果展示：

```bash
root@knight:/docker# docker ps
CONTAINER ID   IMAGE         COMMAND                  CREATED              STATUS              PORTS     NAMES
61d59245db3d   redis:6.0.8   "docker-entrypoint.s…"   About a minute ago   Up About a minute             redis-node-6
223fad42e069   redis:6.0.8   "docker-entrypoint.s…"   About a minute ago   Up About a minute             redis-node-5
f0055941fe3f   redis:6.0.8   "docker-entrypoint.s…"   About a minute ago   Up About a minute             redis-node-4
e361d9695a0c   redis:6.0.8   "docker-entrypoint.s…"   About a minute ago   Up About a minute             redis-node-3
400119c3015c   redis:6.0.8   "docker-entrypoint.s…"   About a minute ago   Up About a minute             redis-node-2
61e2e38927c4   redis:6.0.8   "docker-entrypoint.s…"   4 minutes ago        Up 4 minutes                  redis-node-1
```

3. 构建主从关系

随便进入一台容器，在这里使用1号机进行演示。

* 进入容器

```bash
docker exec -it redis-node-1 bash
```

* 建立集群

```bash
redis-cli --cluster create 192.168.1.42:6381 192.168.1.42:6382 192.168.1.42:6383 192.168.1.42:6384 192.168.1.42:6385 192.168.1.42:6386 --cluster-replicas 1
```

--cluster-replicas 1 一个主服务器配置一个从服务器。

之后出现下面这行提示，按要求输入`yes`

```bash
Can I set the above configuration? (type 'yes' to accept): yes
```

出现下面的提示代表集群建立完成：

```bash
[OK] All nodes agree about slots configuration.
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.
```

4. 查看集群信息

```bash
redis-cli -p 6381
cluster info
cluster nodes
```

效果展示：

```bash
root@knight:/data# redis-cli -p 6381
127.0.0.1:6381> cluster info
cluster_state:ok
cluster_slots_assigned:16384
cluster_slots_ok:16384
cluster_slots_pfail:0
cluster_slots_fail:0
cluster_known_nodes:6
cluster_size:3
cluster_current_epoch:6
cluster_my_epoch:1
cluster_stats_messages_ping_sent:335
cluster_stats_messages_pong_sent:315
cluster_stats_messages_sent:650
cluster_stats_messages_ping_received:310
cluster_stats_messages_pong_received:335
cluster_stats_messages_meet_received:5
cluster_stats_messages_received:650

127.0.0.1:6381> cluster nodes
41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383@16383 master - 0 1691914813226 3 connected 10923-16383
849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386@16386 slave f999e35136ec2e61fcceebf182f5c38ef4a4354d 0 1691914812223 1 connected
6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382@16382 master - 0 1691914811000 2 connected 5461-10922
8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384@16384 slave 6dca84998e245ce4cc6c92882fb7ac94d501efda 0 1691914812000 2 connected
9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385@16385 slave 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 0 1691914812000 3 connected
f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381@16381 myself,master - 0 1691914809000 1 connected 0-5460
127.0.0.1:6381> 
```

```bash
redis-cli --cluster check 192.168.1.42:6381
```

换成自己主机的IP，端口号随便是集群的任何一个容器的都可以。

效果展示：

```bash
root@knight:/data# redis-cli --cluster check 192.168.1.42:6381
192.168.1.42:6381 (f999e351...) -> 0 keys | 5461 slots | 1 slaves.
192.168.1.42:6383 (41f99f51...) -> 1 keys | 5461 slots | 1 slaves.
192.168.1.42:6382 (6dca8499...) -> 1 keys | 5462 slots | 1 slaves.
[OK] 2 keys in 3 masters.
0.00 keys per slot on average.
>>> Performing Cluster Check (using node 192.168.1.42:6381)
M: f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381
   slots:[0-5460] (5461 slots) master
   1 additional replica(s)
M: 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383
   slots:[10923-16383] (5461 slots) master
   1 additional replica(s)
S: 849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386
   slots: (0 slots) slave
   replicates f999e35136ec2e61fcceebf182f5c38ef4a4354d
S: 9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385
   slots: (0 slots) slave
   replicates 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40
S: 8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384
   slots: (0 slots) slave
   replicates 6dca84998e245ce4cc6c92882fb7ac94d501efda
M: 6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382
   slots:[5461-10922] (5462 slots) master
   1 additional replica(s)
[OK] All nodes agree about slots configuration.
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.
root@knight:/data# 
```