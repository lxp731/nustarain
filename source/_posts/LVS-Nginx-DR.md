---
title: 使用LVS+Nginx配置DR模式的Web集群
date: 2023-05-18 22:13:29
categories: 技术
tags:
  - Linux
---

### 准备工作

需要最少准备三台虚拟机，关闭selinx和防火墙。

||||||||
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|主机名|身份|网络接口|连接模式|IP地址|软件|
|DS|调度服务器|ens160|仅主机|172.21.8.10/24|ipvsadm|
|DS|调度服务器|ens224|仅主机|172.21.8.80/24|ipvsadm|
|web1|真实服务器|ens224|仅主机|172.21.8.20/24|nginx|
|web1|真实服务器|lo(VIP)|-|172.21.8.80/32|nginx|
|web2|真实服务器|ens224|仅主机|172.21.8.30/24|nginx|
|web2|真实服务器|lo(VIP)|-|172.21.8.80/32|nginx|

PS:

1. DS一定是两块网卡，并且用一张网卡去作为真实服务器的网关。
2. DS的两块网卡模式都使用仅主机的。
<!-- more -->
3. web1和web2的loopback网卡都要设置为DS主机的metric值大的那一张网卡。
4. 可以使用```route -n```查看**metric**值。
5. **metric**值可以在网卡配置文件中修改，修改后记得重启网络服务生效。

### DS主机配置

```bash
ipvsadm -A -t 172.21.8.80:80 -s wrr
ipvsadm -a -t 172.21.8.80:80 -r 172.21.8.20:80 -g -w 1
ipvsadm -a -t 172.21.8.80:80 -r 172.21.8.30:80 -g -w 2
ipvsadm --set 1 1 1
```

### Web1主机和Web2主机配置

* 配置回环接口（VIP）

```bash
ip addr add 172.21.8.80/32 dev lo
```

* 修改Web1内核控制系统arp响应

  因为要修改4个文件，设置的值也比较简单。只有在使用LVS+Nginx配置DR模式的时候才会将这4个文件设置为该值，平常使用要使用默认值。为了切换方便一点，建议使用脚本的方式。

```bash
#!/bin/bash
if [ $# -ne 1 ]
then
    echo 'error!'"usage:$0 on|off"
    exit 1
fi
case $1 in
    on)
        echo "1" > /proc/sys/net/ipv4/conf/lo/arp_ignore
        echo "2" > /proc/sys/net/ipv4/conf/lo/arp_announce
        echo "1" > /proc/sys/net/ipv4/conf/all/arp_ignore
        echo "2" > /proc/sys/net/ipv4/conf/all/arp_announce
        ;;
    off)
        echo "0" > /proc/sys/net/ipv4/conf/lo/arp_ignore
        echo "0" > /proc/sys/net/ipv4/conf/lo/arp_announce
        echo "0" > /proc/sys/net/ipv4/conf/all/arp_ignore
        echo "0" > /proc/sys/net/ipv4/conf/all/arp_announce
        ;;
    *)
        echo 'error!'"usage:$0 on|off"
        exit 1
esac
```

* 执行脚本

```bash
chmod +x lvs_dr.sh
./lvs_dr.sh on
```

### 测试

1. 在Web1、Web2启动Nginx。
2. 分别执行```curl 172.21.8.20```，```curl 172.21.8.30```。验证无误后，在客户端（第4台机器）上测试```curl 172.21.8.80```，使用**DR**机器是不好使的。

>版权声明：以上的shell脚本知识产权由私人所有，禁止商用。