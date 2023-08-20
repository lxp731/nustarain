---
title: Redis扩容案例
date: 2023-08-14 20:26:42
categories: 技术
tags:
  - Docker
  - Redis
---

### 操作步骤

1. 新建两个容器

```bash
docker run -d --name redis-node-7 --net host --privileged=true -v /docker/redis/share/redis-node-7:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6387
docker run -d --name redis-node-8 --net host --privileged=true -v /docker/redis/share/redis-node-8:/data redis:6.0.8 --cluster-enabled yes --appendonly yes --port 6388
```

<!-- more -->

2. 进入7号容器（新建的容器）

```bash
docker exec -it redis-node-7 bash
```

3. 使7号容器加入集群

```bash
redis-cli --cluster add-node 192.168.1.42:6387 192.168.1.42:6381
```

前面写的是本容器的IP:端口，后面跟着是集群领路人的IP:端口。执行后出现如下的提示信息表示成功：

```bash
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.
>>> Send CLUSTER MEET to node 192.168.1.42:6387 to make it join the cluster.
[OK] New node added correctly.
```

4. 查看集群的节点信息

```bash
redis-cli --cluster check 192.168.1.42:8371
```

效果：

```bash
192.168.1.42:6386 (849a82f0...) -> 0 keys | 5461 slots | 1 slaves.
192.168.1.42:6382 (6dca8499...) -> 1 keys | 5462 slots | 1 slaves.
192.168.1.42:6387 (79117230...) -> 0 keys | 0 slots | 0 slaves.
192.168.1.42:6383 (41f99f51...) -> 1 keys | 5461 slots | 1 slaves.

S: f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381
   slots: (0 slots) slave
   replicates 849a82f0bd85238762ca7ccf234aa30ba97d93a0
M: 849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386
   slots:[0-5460] (5461 slots) master
   1 additional replica(s)
S: 9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385
   slots: (0 slots) slave
   replicates 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40
S: 8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384
   slots: (0 slots) slave
   replicates 6dca84998e245ce4cc6c92882fb7ac94d501efda
M: 6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382
   slots:[5461-10922] (5462 slots) master
   1 additional replica(s)
M: 791172307abf9223425af595e661cec441951170 192.168.1.42:6387
   slots: (0 slots) master
M: 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383
   slots:[10923-16383] (5461 slots) master
   1 additional replica(s)
```

从以上的效果可以看到，端口被6387的节点已经成功添加进来，但是并没有像其他的Master主机一样分配到槽位。所以从实际意义上来说，它还不算正式加入集群。

5. 重新分配槽号

```bash
redis-cli --cluster reshard 192.168.1.42:6381
```

后面接着的IP还是集群的领路人。

执行后，要求我们输入每台分配多少个槽号，简单计算一下，一共16384个槽号，4台机器分，每台4096个槽号。

然后下面输入新加入的机器的节点ID。

输入all，最后输入yes确认。

```bash
How many slots do you want to move (from 1 to 16384)? 4096
What is the receiving node ID? 791172307abf9223425af595e661cec441951170
Please enter all the source node IDs.
  Type 'all' to use all the nodes as source nodes for the hash slots.
  Type 'done' once you entered all the source nodes IDs.
Source node #1: all
```

6. 再次查看集群节点信息

```bash
redis-cli --cluster check 192.168.1.42:6381
```

```bash
192.168.1.42:6386 (849a82f0...) -> 0 keys | 4096 slots | 1 slaves.
192.168.1.42:6382 (6dca8499...) -> 1 keys | 4096 slots | 1 slaves.
192.168.1.42:6387 (79117230...) -> 0 keys | 4096 slots | 0 slaves.
192.168.1.42:6383 (41f99f51...) -> 1 keys | 4096 slots | 1 slaves.

S: f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381
   slots: (0 slots) slave
   replicates 849a82f0bd85238762ca7ccf234aa30ba97d93a0
M: 849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386
   slots:[1365-5460] (4096 slots) master
   1 additional replica(s)
S: 9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385
   slots: (0 slots) slave
   replicates 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40
S: 8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384
   slots: (0 slots) slave
   replicates 6dca84998e245ce4cc6c92882fb7ac94d501efda
M: 6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382
   slots:[6827-10922] (4096 slots) master
   1 additional replica(s)
M: 791172307abf9223425af595e661cec441951170 192.168.1.42:6387
   slots:[0-1364],[5461-6826],[10923-12287] (4096 slots) master
M: 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383
   slots:[12288-16383] (4096 slots) master
   1 additional replica(s)
```

从概略信息可以看到4台机器都分配到了槽号，从下面的详细槽号信息，我们可以观察出，新加入的6387机器分配到的槽号是由其他3台主机各匀过来的。

7. 为新加入的Master主机添加Slave主机

```bash
redis-cli --cluster add-node 192.168.1.42:6388 192.168.1.42:6387 --cluster-slave --cluster-master-id 791172307abf9223425af595e661cec441951170
```

* 192.168.1.42:6388 Slave主机的IP:端口

* 192.168.1.42:6387 Master主机的IP:端口

* 最后加要挂载的Master主机的节点ID

8. 查看节点信息

```bash
root@knight:/data# redis-cli -p 6381
127.0.0.1:6381> cluster nodes
849a82f0bd85238762ca7ccf234aa30ba97d93a0 192.168.1.42:6386@16386 master - 0 1692019970307 7 connected 1365-5460
f999e35136ec2e61fcceebf182f5c38ef4a4354d 192.168.1.42:6381@16381 myself,slave 849a82f0bd85238762ca7ccf234aa30ba97d93a0 0 1692019967000 7 connected
9f55acb1e18b1dfa53ad3a4a506ff2512a92cb46 192.168.1.42:6385@16385 slave 41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 0 1692019968297 3 connected
8e70d538b699c96edc3f6608224aa8ecf55d857b 192.168.1.42:6384@16384 slave 6dca84998e245ce4cc6c92882fb7ac94d501efda 0 1692019965000 2 connected
6dca84998e245ce4cc6c92882fb7ac94d501efda 192.168.1.42:6382@16382 master - 0 1692019968000 2 connected 6827-10922
8758dde1064a8fd6aacbc15dfd90d3ca4545cc73 192.168.1.42:6388@16388 slave 791172307abf9223425af595e661cec441951170 0 1692019967000 8 connected
791172307abf9223425af595e661cec441951170 192.168.1.42:6387@16387 master - 0 1692019967293 8 connected 0-1364 5461-6826 10923-12287
41f99f5142b5c4b7e1e17c8a94e88fc74cda4d40 192.168.1.42:6383@16383 master - 0 1692019970000 3 connected 12288-16383
127.0.0.1:6381> 
```