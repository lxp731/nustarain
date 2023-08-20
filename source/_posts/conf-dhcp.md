---
title: Linux配置DHCP服务器
date: 2023-07-27 13:47:58
categories: 技术
tags:
  - Linux
---

关于DHCP的配置是在很久之前学习配置的，并没有整理成册，今天闲下心来再把关于DHCP配置的方法回顾一下。

### DHCP配置流程

1. 下载软件包

```bash
yum install -y dhcp-server
```

从Centos8开始，关于DHCP的配置，软件包就变成了“dhcp-server”这是服务器端的软件包，与此相对应的还有客户端使用的“dhcp-client”。

<!-- more -->

2. 复制配置文件

dhcp的配置文件是`/etc/dhcp/dhcpd.conf`，但是比较鸡肋的是，这个配置文件是空的，只有三行注释，但是dhcp提供了一个模板文件`/usr/share/doc/dhcp-server/dhcpd.conf.example`，可以直接拷贝过去使用。

因为配置文件有很多注释，看起来非常杂乱，所以执行以下这条命令，直接带走所有注释。

```bash
egrep -v "^#|^$" /usr/share/doc/dhcp-server/dhcpd.conf.example > /etc/dhcp/dhcpd.conf
```

3. 配置文件内容及含义

```bash
# 定义全局参数：默认搜索域
option domain-name "blog.nustarain.com";
# 定义全局参数：域名服务器（若是多个域名服务器使用逗号间隔）
option domain-name-servers ns1.nustarain.com;
# 定义全局参数：默认租期
default-lease-time 600;
# 定义全局参数。最大租期
max-lease-time 7200;
log-facility local7;
# 定义网络号为10.8.7.0子网掩码为255.255.255.0的子网
subnet 10.8.7.0 netmask 255.255.255.0 {
  # 子网IP地址池的范围
  range 10.8.7.10 10.8.7.253;
  # 设置子网的默认网关
  option routers 10.8.7.254;
  # 设置子网的广播地址
  option broadcast-address 10.8.7.255;
  default-lease-time 600;
  max-lease-time 7200;
}
# 向特殊主机分配特定的IP，当要给多个特殊的主机分配IP时，host 后的名称要求必须唯一
host fantasia {
  # 指定主机的MAC地址
  hardware ethernet 00:0c:29:af:33:58;
  # 指定要分配的IP地址
  fixed-address 10.8.7.68;
}
```

在整个DHCP的配置中，要注意DHCP配置文件的语法规则，尤其是分号的使用，稍不留神就会报错。
配置完配置文件之后，可以使用`dhcpd -t`来进行语法检查，出现下面的语句表示没有错误，反之就要检查错误了。

```bash
Internet Systems Consortium DHCP Server 4.3.6
Copyright 2004-2017 Internet Systems Consortium.
All rights reserved.
For info, please visit https://www.isc.org/software/dhcp/
ldap_gssapi_principal is not set,GSSAPI Authentication for LDAP will not be used
Not searching LDAP since ldap-server, ldap-port and ldap-base-dn were not specified in the config file
Config file: /etc/dhcp/dhcpd.conf
Database file: /var/lib/dhcpd/dhcpd.leases
PID file: /var/run/dhcpd.pid
Source compiled to use binary-leases
```

Please remember：Practice makes perfect.

### 客户机获取IP地址

相比服务器端的配置，客户机的操作就比较简单一点。

1. 下载软件包。

```bash
yum install -y dhcp-client
```

2. （可选），如果当前网卡已经是动态获取的模式，那么就不需要改配置文件了，如果网卡是静态指定的，那么就需要修改一下。网卡配置文件路径`/etc/sysconfig/network-scripts/ifcfg-ens160`，修改里面的`BOOTPROTO=dhcp`，保存退出。

3. 执行命令更新重启网卡。

```bash
systemctl restart NetworkManager
nmcli c d ens160
nmcli c up ens160
```

4. 相关命令。

```bash
dhclient ens160    # 自动获取IP地址
dhclient -r ens160    # 释放当前IP
```