---
title: 分布式存储之哈希槽算法
date: 2023-08-13 15:08:20
categories: 理论知识
tags:
  - Docker
  - Redis
---

### 基本思想

哈希槽(Hash Slot)算法是Redis集群实现分布式存储的核心算法。其基本思路是:

1. 将整个键空间(0-2^16-1)划分为固定数目(比如1024)的槽(slot)。 

2. 根据键值的哈希值对槽数取模,计算该键应该映射到哪个槽。

<!-- more -->

3. 将槽均匀分配给不同的节点。

4. 节点只负责处理映射到自己槽位上的键值操作。

例如,节点A负责0-511槽,节点B负责512-1023槽。

对键值foo计算哈希值,如果余数为100,则该键值属于第100个槽,由节点A处理。

这种方式可将大量键值均匀地分布在不同节点上,实现扩展。

增加节点时,可以平移部分槽到新节点,不需要重定向键值,方便扩容。

相比一致性哈希,哈希槽算法实现更简单,数据分布更均匀,是Redis集群首选的分布式存储算法。

### 缺点

哈希槽算法虽是目前最好的解决方案，但是也并不是最完美的，主要存在一下几个缺点：

1. 键空间分片粒度大

哈希槽算法将整个键空间划分为固定数目的槽,典型的槽位数是1024个。这导致单个槽所能存储的键值上限很大,分片粒度较粗。

2. 热点键问题

由于哈希冲突,可能有大量访问热点的键值都映射到同一个槽,导致访问压力集中在单个节点。

3. 不均衡

随着时间推移,不同槽所存储的键值数量可能出现不平衡,导致不同节点负载不均。

4. 节点扩容缩容代价大

扩容时需要平移部分槽到新节点;缩容时需要复制槽内数据到其他节点。数据量大时代价高。

5. 只适合键值型数据库

哈希槽算法依赖键值哈希映射,不适合用于关系型数据库等其他数据类型。

总体来说,这些缺点限制了哈希槽算法在更大规模和更复杂场景下的适用性。需要与其他技术相结合来获取更好的分布式效果。