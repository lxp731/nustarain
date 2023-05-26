---
title: 使用LVS+Nginx配置NAT模式的Web集群
date: 2023-05-17 19:59:09
categories: 技术
tags:
  - Linux
---

### 准备条件

需要最少准备三台虚拟机，关闭selinx和防火墙。

|||||||||
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|主机名|身份|网络接口|连接模式|IP地址|网关|软件|
|DS|调度服务器|ens160|nat|192.168.20.40/24|192.168.20.254|ipvsadm|
|DS|调度服务器|ens224|仅主机|172.21.8.10/24|-|ipvsadm|
|web1|真实服务器|ens224|仅主机|172.21.8.20/24|172.21.8.10/24|nginx|
|web2|真实服务器|ens224|仅主机|172.21.8.30/24|172.21.8.10/24|nginx|

PS:

1. DS一定是两块网卡，并且用一张网卡去作为真实服务器的网关。
2. DS的两块网卡最好模式是不一样的。

<!-- more -->

### DS的配置

下载ipvsadm

```bash
yum install -y ipvsadm
```

添加一个虚拟服务指定运输层协议为TCP、VIP为192.168.20.40、端口为80、调度算法为加权轮训。

```bash
ipvsadm -A -t 192.168.20.40:80 -s rr
```

为虚拟服务器添加后端真实服务器

```bash
ipvsadm -a -t 192.168.20.40:80 -r 172.21.8.20:80 -m
```

```bash
ipvsadm -a -t 192.168.20.40:80 -r 172.21.8.20:80 -m
```

使用命令查看生成的策略

```bash
ipvsadm -Ln
```

开启路由转发功能

```bash
echo "1" > /proc/sys/net/ipv4/ip_forward
```

使用命令修改轮训的时间

```bash
ipvsadm --set 1 1 1
```

使用命令查看超时时间设置

```bash
ipvsadm -L --timeout
```

### WEB1配置

下载Nginx

```bash
yum install -y nginx
```

nginx的配置文件保存在```/etc/nginx/nginx.conf```

使用命令去掉Nginx配置文件的空行和注释行

```bash
egrep -v "^[[:space:]]*#|^$" nginx.conf.default > nginx.conf
```

修改配置文件

```bash
worker_processes  1;
events {
    worker_connections  1024;
}
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    server {
        listen       80;
        server_name  172.21.8.20;    # 本机IP
        location / {
            root   /web;    # 根目录地址
            index  index.html index.htm;    # 要去寻找的文件
        }
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }
}
```

创建HTML资源文件

```bash
mkdir /web
```

编辑网页入口文件

```bash
touch /web/index.html
echo "web1111" > /web/index.html
```

开启Nginx服务

```bash
nginx
```

验证服务开启

```bash
lsof -i:80
```

### WEB2配置

web2配置基本同web1。

使用命令去掉Nginx配置文件的空行和注释行

```bash
egrep -v "^[[:space:]]*#|^$" nginx.conf.default > nginx.conf
```

修改配置文件

```bash
worker_processes  1;
events {
    worker_connections  1024;
}
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    server {
        listen       80;
        server_name  172.21.8.30;
        location / {
            root   /web;
            index  index.html index.htm;
        }
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }
}
```

创建HTML资源文件

```bash
mkdir /web
```

编辑网页入口文件

```bash
touch /web/index.html
echo "web2222" > /web/index.html
```

开启Nginx服务

```bash
nginx
```

验证服务开启

```bash
lsof -i:80
```

### 测试

先在web1主机

```bash
curl 172.21.8.20
```

然后在web2主机

```bash
curl 172.21.8.30
```

最后在DS主机上

```bash
curl 192.168.20.40
```

如果观察到```web1111```和```web2222```来回显示在页面上则配置成功。

### 其他可能用到的命令

Linux查看路由表

```bash
ip r s
```

重启Nginx的命令

```bash
nginx -s reload
```

关闭Nginx的命令

```bash
nginx -s stop
```