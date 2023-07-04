---
title: 源码安装NGINX
date: 2023-07-04 10:09:47
categories: 技术
tags:
  - Linux
---

### 安装NGINX

如果是centos8版本的话，可以直接使用本地yum或者网络yum安装NGINX，对于8版本的就不在做过多赘述。

主要针对Centos7版本做一下说明，因为Centos7的yum是不提供NGINX的，所以需要自己手动使用源码安装的方式进行安装。

<!-- more -->

[nginx源码包下载链接](https://pan.baidu.com/s/1hjUud-D1Du-s-dbFAGJxTQ?pwd=46k1)

提取码：46k1

* 解压源码包

```
tar -zxf nginx-1.17.10.tar.gz
```

* 安装相关的依赖

```
yum install -y gcc make pcre pcre-devel zlib zlib-devel openssl openssl-devel
```

* 执行configure脚本

```
./configure --prefix=/usr/local/nginx --with-http_ssl_module
```

* 再执行两步安装完成

```
make
make install
```

此时NGINX的启动命令是在`/usr/local/nginx/sbin/nginx`里。

直接执行这条命令可以启动NGINX

```
/usr/local/nginx/sbin/nginx
```

但是这个命令是在太长了，很不方便，我们可以拷贝一份到系统命令里面。

```
cp /usr/local/nginx/sbin/nginx /sbin/nginx
```

然后我们就可以愉快地使用一些简单的命令来对NGINX进行管理。

```
nginx # 启动nginx
nginx -s reload # 重启nginx
nginx -s stop # 关闭nginx
```

再补充一点，就是关于NGINX的配置文件，源码安装的NGINX配置文件的路径`cd /usr/local/nginx/conf`里面很多我们不需要的内容，直接一条命令带走他们。

```
egrep -v "^[[:space:]]*#|^$" nginx.conf.default > nginx.conf
```
之后就很清爽了，开始配置吧少年。