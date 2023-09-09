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
|DS|调度服务器|ens224|仅主机|172.21.8.80/24|ipvsadm|
|web1|真实服务器|ens224|仅主机|172.21.8.20/24|nginx|
|web1|真实服务器|lo(VIP)|-|172.21.8.80/32|nginx|
|web2|真实服务器|ens224|仅主机|172.21.8.30/24|nginx|
|web2|真实服务器|lo(VIP)|-|172.21.8.80/32|nginx|

PS:

1. 建议DS（调度机）的网卡使用仅主机模式的。
2. web1和web2的loopback网卡都要设置为DS主机的metric值大的那一张网卡。
<!-- more -->
3. 可以使用```route -n```查看**metric**值。
4. **metric**值可以在网卡配置文件中修改，修改后记得重启网络服务生效。

### DS主机配置

```bash
ipvsadm -A -t 172.21.8.80:80 -s wrr
ipvsadm -a -t 172.21.8.80:80 -r 172.21.8.20:80 -g -w 1
ipvsadm -a -t 172.21.8.80:80 -r 172.21.8.30:80 -g -w 2
ipvsadm --set 1 1 1
```

调度策略中，前面的这个IP是调度机虚拟出来的VIP，后面的这个IP是真实Web服务器的IP地址。

也可以直接编辑成一个脚本文件，方便后面进行策略的调整

```bash
#!/bin/bash
ipvsadm -C
ipvsadm -A -t 10.8.7.10:80 -s wrr
ipvsadm -a -t 10.8.7.10:80 -r 10.8.7.80:80 -g -w 1
ipvsadm -a -t 10.8.7.10:80 -r 10.8.7.81:80 -g -w 2
ipvsadm -a -t 10.8.7.10:80 -r 10.8.7.82:80 -g -w 1
ipvsadm -a -t 10.8.7.10:80 -r 10.8.7.83:80 -g -w 2
ipvsadm --set 1 1 1
echo "轮巡策略已成功添加！！！"
```

### Web1主机和Web2主机配置

* 配置回环接口（VIP）

```bash
ip addr add 172.21.8.80/32 dev lo
```

因为环回口配置的IP在每次重启之后都会丢失IP，每次配置起来也比较麻烦，同样的把他写成一个脚本

```bash
#!/bin/bash
ip addr add 10.8.7.10/32 dev lo:1
echo "VIP 已经成功添加到loopback口。"
```

* 修改Web1内核控制系统arp响应

  因为要修改4个文件，设置的值也比较简单。只有在使用LVS+Nginx配置DR模式的时候才会将这4个文件设置为该值，平常使用要使用默认值。为了切换方便一点，建议使用脚本的方式。

```bash 折叠代码
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
        echo "LVS DR 模式已开启！"
        ;;
    off)
        echo "0" > /proc/sys/net/ipv4/conf/lo/arp_ignore
        echo "0" > /proc/sys/net/ipv4/conf/lo/arp_announce
        echo "0" > /proc/sys/net/ipv4/conf/all/arp_ignore
        echo "0" > /proc/sys/net/ipv4/conf/all/arp_announce
        echo "LVS DR 模式已关闭！"
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