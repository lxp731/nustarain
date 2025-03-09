---
title: 搭建并挂载ISCSI存储服务器
date: 2023-07-04 15:18:06
categories: 技术
tags:
  - Linux
---

### ISCSI服务器端

比如现在ISCSI服务器端有两块硬盘，我们想把第二块硬盘（sdb）共享出去。

1. 下载软件

```bash
yum install -y targetcli
```

2. 开始进行服务端的配置

* 首先键入`targetcli`进入iscsi配置模式

```bash
targetcli
```

<!-- more -->

* 然后先创建一个后端存储

```bash
cd /backstores/block/
create disk1 /dev/sdb
```

`disk1`代表起的一个名字，`/dev/sdb`是真实机器里存在的设备。

* 创建可以识别的iqn设备

```bash
cd /iscsi/
create iqn.2023-07.com.liuxp:san1
```

`iqn.2023-07.com.liuxp:san1`是可以被客户端的识别到的名字，客户端可以凭这个名字挂载到自身。

* 创建iqn里的卷，刚刚创建的iqn只是一个名字，里面现在还没有存储设备，现在要在里面添加存储设备

```bash
cd iqn.2023-07.com.liuxp:san1/tpg1/luns/
create /backstores/block/disk1
```

* 创建好iqn里的存储设备，然后就该设置iqn设备的访问权限了

```bash
cd ../acls/
create iqn.2023-07.com.liuxp:web1
```

不要奇怪这个新创建的iqn是一个识别秘钥，客户端需要拿着这个秘钥来连接，以此来达到访问控制的目的。具体的操作是将这个`acls`里的`iqn`名字复制下来待会粘贴到客户端的一个配置文件里面。

* 设置门户，这个我也解释不清楚含义，就是想在这里介绍一下删除命令，还有如果要设置的话，要设置为本机的IP

```bash
cd ../portals/
delele 0.0.0.0 3260
create 10.8.7.41 3260
```

* 到这里就设置完成了键入`exit`退出设置。

* 启动服务

```bash
systemctl start target.service 
```

### ISCSI客户端

1. 下载软件

```bash
yum install -y iscsi-initiator-utils
```

2. 修改配置文件`/etc/iscsi/initiatorname.iscsi`

```bash
InitiatorName=iqn.2023-07.com.liuxp:web1
```

把这里的iqn设置为服务器端`acls`里的那个iqn，上面也说过一嘴。

3. 然后开始扫描iqn设备

```bash
iscsiadm -m discovery -t st -p 10.8.7.41
```

**p选项**后面接上服务器端的IP地址。

4. 扫描到之后接着开始最后一步挂载

```bash
iscsiadm -m node -T iqn.2023-07.com.liuxp:san1 -p 10.8.7.41 -l
```

**T选项**后面接上面刚刚扫描出来的iqn设备，**p选项**接ISCSI服务器的IP

5. 可以通过下面的命令查看挂载成功的会话信息

```bash
iscsiadm -m session
```

6. 如果需要的话可以了解一下，卸载本地已挂载的全部ISCSI存储设备

```bash
iscsiadm -m node --logoutall=all
```

7. 写在最后的话

如果遇到第4步无法挂载，一是要检查配置文件的iqn是否和服务器acls设置一致，二是要检查IP地址时候填写正确，客户端如果检查都无误了，因为之前会产生缓存，一般后面几次也不会成功，可以通过删除`/var/lib/iscsi/nodes`及`/var/lib/iscsi/send_targets`下的内容之后再次尝试。如果还是不行，就只能重启了。如果对服务器端进行了修改，一定要记得重启服务生效。