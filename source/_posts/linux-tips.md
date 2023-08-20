---
title: Linux使用小tips
date: 2023-05-18 17:26:10
categories: 小玩意儿
tags:
  - Linux
---

### 常用的一些操作

1. 永久修改SELINUX值。

使用虚拟机进行一些服务的配置的时候，如果SELINX的值不调整为permissive，经常会出现一些稀奇古怪的错误，如果每次都开机设置```setenforce 0```就太麻烦了。所以直接编辑```/etc/selinux/config```文件，设置```SELINUX=permissive```，最后保存退出。

2. 永久修改网卡的IP地址。

在平常的服务器的配置时，总是会涉及到IP的变动，我个人使用最多的方法是直接修改配置文件。

<!-- more -->

网卡配置文件```/etc/sysconfig/network-scripts/ifcfg-ens160```。分成几点来说。

* BOOTPROTO=none，可选值还有static、dhcp、auto。none和static功能一样，dhcp和auto功能一样。

* ONBOOT=yes，设置开机网卡自启的，建议设置为*yes*，可选值还有*no*

* 如果网卡一开始是使用动态获取的，改成手动后，就要通过编辑配置文件来进行IP的设置。只需要在文件的末尾加上

```bash
IPADDR=192.168.20.10    # *设置IP*
GATEWAY=192.168.20.254    # *设置网关*
PREFIX=24    # *设置子网掩码*
```

有的配置文件还可以看到

```bash
DNS1=8.8.8.8
DNS2=114.144.144.114
```

但是我并不建议大家在这里设置DNS，一是根本不会起什么作用，因为使用DNS的还有另一个配置文件（```/etc/resolv.conf```），二就是它会和```/etc/resolv.conf```文件指定的DNS相互冲突。

* 更改完配置文件后，IP并不会马上改变。需要手动进行一下重启。个人总结出来的一些经验，命令执行的顺序建议都不要改变。

```bash
systemctl restart NetworkManager
nmcli c d ens160
nmcli c up ens160
```

这样**3**条命令下来，旧IP再顽固，也会无奈变成配置文件中的IP。