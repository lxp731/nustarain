---
title: Linux关于iscsi+pacemaker+CLVM+gfs的实现
date: 2023-07-05 07:55:37
categories: 技术
tags:
  - Linux
---

### 基本信息

|||||||
|:-:|:-:|:-:|:-:|:-:|:-:|
|主机名|身份|网络接口|连接模式|IP地址|
|web3|web服务器|ens224|仅主机|10.8.7.82/24|
|web4|web服务器|ens224|仅主机|10.8.7.83/24|
|storage1|iscsi存储服务器|ens224|仅主机|10.8.7.41/24|
|storage2|iscsi存储服务器|ens224|仅主机|10.8.7.42/24|

### 项目说明

在本项目中，主要完成以下任务：

1. 完成gfs1和gfs2关于ISCSI存储服务器的搭建，并且成功挂载到web1和web2主机。

<!-- more -->

2. 建立web1和web2主机的集群关系。

3. 挂载GFS文件系统。

4. 配置集群资源。

5. 创建CLVM。

6. 挂载共享存储。

### 准备环境

* Centos7版本的虚拟机，Centos8版本的没有找到资料，还在自我探索的过程中。等待后期的更新吧。

* 虚拟机关闭SELINUX。

* 虚拟机关闭防火墙。

* 虚拟机关闭NetworkManager。

* 编写`/etc/hosts`文件，这个可选，我是为了后期配置方便，才写这样一个文件。

```bash
127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4
::1         localhost localhost.localdomain localhost6 localhost6.localdomain6
10.8.7.82   web3.liuxp.com
10.8.7.83   web4.liuxp.com
10.8.7.41   storage1.liuxp.com
10.8.7.42   storage2.liuxp.com
```

如果你也打算用这个，编辑完之后可以使用scp命令直接拷贝到别的主机。

```bash
scp /etc/hosts 10.8.7.42:/etc/
```

### 项目实施

* 一定要按照顺序来做。

* 关于ISCSI服务器创建和挂载到客户端的操作，具体搭建过程可以看[搭建并挂载ISCSI存储服务器](https://nustarain.gitee.io/2023/07/04/ISCSI/)这篇文章，本文章不在赘述。对于我这个项目，两台ISCSI存储器都各自提供了一块磁盘，并且在两台web服务器都实现了挂载，storage1提供的ISCSI存储映射到web服务器上是`/dev/sdb`，storage2提供的ISCSI存储映射到web服务器上是`/dev/sdc`。

* 我接下来讲的“两台虚拟机”是指web3和web4，“任意一台虚拟机”是指web3或者web4其中的任意一台。

* 下载软件，两台虚拟机都需要做的

```bash
yum -y install pacemaker pcs
systemctl start pcsd
systemctl enable pcsd
echo "q" | passwd --stdin hacluster
```

这块的意思是下载了pcsd服务，开启并设置自启动，安装这个服务会再系统创建一个`hacluster`用户，后面要用，要先给他改个密码。

* 集群建立免认证，在集群任意一台机器做就可以

说白一点，就是web3生成公钥私钥，然后把公钥发给web4，或者web4生成公钥私钥，然后把公钥发给web3。

```bash
ssh-keygen
ssh-copy-id -i /root/.ssh/id_rsa.pub web4.liuxp.com
```

上面的命令是以web3举的例子。

* 搭建集群，两台虚拟机都需要做的

```bash
pcs cluster auth web3.liuxp.com web4.liuxp.com
Username: hacluster
Password:q
node3: Authorized
node4: Authorized
pcs cluster setup --name nginx_cluster web3.liuxp.com web4.liuxp.com
pcs cluster setup --name nginx_cluster web3.liuxp.com web4.liuxp.com --force # 如果报错就强制执行进行覆盖
pcs cluster start
pcs cluster status
pcs cluster enable --all
pcs status corosync
```

一般情况下如果第一次创建集群，上面命令可以直接创建成功，如果不是第一次创建，就需要加`--force`选项强制覆盖。等到所有信息都success，下面的集群开启，查看状态，设置自启动都不会出现什么问题的。

如果第一次集群出现了什么问题，打算重新做，可以通过下面的这个命令摧毁集群，然后再强制建立集群。

```bash
pcs cluster destroy
```

* 挂载GFS文件系统，两台虚拟机都需要做的

```bash
yum install -y lvm2-cluster gfs2-utils fence-agents-all
lvmconf --enable-cluster
modprobe gfs2
lsmod | grep gfs2 
```

在进行完最后一步之后，如果出现一些看不懂的内容就说明，GFS文件系统已经挂载到这个系统上了，可以使用它进行格式化磁盘了。

* 配置集群资源，在集群任意一台机器做就可以

```bash
pcs property set no-quorum-policy=ignore
pcs property set stonith-enabled=false

pcs resource create dlm ocf:pacemaker:controld allow_stonith_disabled=true op monitor interval=30s clone interleave=true ordered=true

pcs resource create clvmd ocf:heartbeat:clvm op monitor interval=30s clone interleave=true ordered=true

pcs constraint order start dlm-clone then clvmd-clone
pcs constraint colocation add clvmd-clone with dlm-clone
pcs property set no-quorum-policy=freeze
```

这块是没有个性化的，可以直接无脑<kbd>Ctrl</kbd>+<kbd>C</kbd>和<kbd>Ctrl</kbd>+<kbd>V</kbd>

* 创建CLVM，在集群任意一台机器做就可以

```bash
pvcreate /dev/sdb
pvcreate /dev/sdc
vgcreate -cy qavg /dev/sdb /dev/sdc
lvcreate -L 12G -n qa qavg
```

这里命令的具体含义如果不懂，可以看我的[关于LVM的配置](https://nustarain.gitee.io/2023/07/04/LVM/)的文章。

* 挂载实现共享存储

```bash
# 格式化文件系统，在集群任意一台机器做就可以
mkfs.gfs2 -p lock_dlm -t nginx_cluster:gfs2 -j 2 /dev/qavg/qa
# 创建挂载点，两台虚拟机都需要做的
mkdir /mnt/cluster
# 要实现自动挂载，在集群任意一台机器做就可以
pcs resource create fs_gfs2 Filesystem device="/dev/qavg/qa" directory="/mnt/cluster" fstype="gfs2" options="noatime,nodiratime" op monitor interval=10s clone interleave=true

# 给集群资源设置启动顺序
pcs constraint order start clvmd-clone then fs_gfs2-clone
pcs constraint colocation add fs_gfs2-clone with clvmd-clone
pcs constraint show
df
```

最后`df`如果看到自己创建的逻辑卷`/dev/qavg/qa`，就说明挂载成功了，可以通过向挂载点里面写入文件来使用存储了。