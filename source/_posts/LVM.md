---
title: 关于LVM的配置
date: 2023-07-04 21:25:45
categories: 技术
tags:
  - Linux
---

### 概述

LVM里面主要有三个名词，物理卷（PV），卷组（VG），逻辑卷（LV）。

物理卷可以有很多形式，一块单独的磁盘（`/dev/sda`），一个分好的分区（`/dev/sdb2`），甚至一个文件都可以是物理卷的一种形式。

单个物理卷或者多个物理卷都可以组合起来变成一个卷组，这样就把几个单独的存储空间给整合了起来，变成了一个大的存储池。

如果要使用的话，我们可以从这个池子里面分出一部分来作为存储，这个存储就是逻辑卷。

### 物理卷

* 创建物理卷

```bash
pvcreate /dev/sdb
```

<!-- more -->

* 查看物理卷的详细信息

```bash
pvdisplay
```

* 查看物理卷的精简信息

```bash
pvs
```

### 卷组

```bash
pvcreate qavg /dev/sdb
```

利用`/dev/sdb`创建一个叫qavg的卷组。

```bash
pvcreate -s 16M qavg /dev/sdb
```

利用`/dev/sdb`创建一个叫qavg的卷组，并且设置卷组里最小的逻辑存储单位为16M。

* 查看卷组的详细信息

```bash
vgdisplay
```

* 查看卷组的精简信息

```bash
vgs
```

* 扩容卷组

```bash
vgextend qavg /dev/sdb2
```

将物理卷`dev/sdb2`加入卷组qavg

* 删减卷组

```bash
vgreduce qavg /dev/sdb2
```

将物理卷`/dev/sdb2`从卷组qavg中删除

* 删除卷组

```bash
vgremove qavg
```

* 重命名卷组

```bash
vgrename /dev/qavg1 /dev/qavg2
```

重命名卷组`/dev/qavg1`为`/dev/qavg2`。

### 逻辑卷

* 创建逻辑卷

```bash
lvcreate -L 200M qavg -n qa
```

利用`qavg`这个卷组创建一个叫`qa`大小为200M的逻辑卷。这里的**L选项**指定的是平常讲的磁盘的大小。

```bash
lvcreate -l 45 qavg -n qa
```

使用**l选项**是指定的逻辑的块多少，比如上面创建卷组时指定的一个块的大小是16M，这里指定45个，逻辑卷的大小就是720M

* 扩容逻辑卷

```bash
lvextend -L +54 /dev/qavg/qa
```

这个是指在原来逻辑卷的基础上再增加54Mib的存储空间。但增加不能超过卷组的总容量大小。

```bash
lvextend qavg/qa /dev/sdk3
```

使用卷组里`/dev/sdk3`这个物理卷的全部空间为`qavg/qa`扩容。

```bash
lvextend -L+16m qavg/qa /dev/sda:8-9 /dev/sdb:8-9
```

使用卷组里`/dev/sda`的8-9M的空间和`/dev/sdb`的8-9M的空间为逻辑卷`qavg/qa`扩容

```bash
lvextend -l+100%FREE -r qavg/qa
```

使用卷组所有剩余的空间为`qavg/qa`扩容。

* 查看逻辑卷详细信息

```bash
lvdisplay
```

* 查看逻辑卷精简信息

```bash
lvs
```

* 删除逻辑卷

```bash
lvremove qa
```

这块的命令虽然看着挺多，但是3大类都是一个逻辑。创建，查看，删除这都是一样的，无非就是扩容的命令得记一下。加油少年！