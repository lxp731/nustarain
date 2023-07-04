---
title: 源码安装PHP
date: 2023-07-04 10:54:00
categories: 技术
tags:
  - Linux
---

### 安装PHP

无论是在Centos7还是在Centos8都需要进行源码安装，其实这句话也不对，因为在Centos8里是可以yum安装php和php-fpm的但是，安装之后使用`php-fpm start`启动命令之后是监听不到内容的。有可能是自己还是不太会用Centos8的PHP，自己也没有再去深入研究，做的项目都是用的源码装的，在这里先把源码安装的教程发不出来，后续有时间再去研究。

<!-- more -->

[PHP源码包下载链接](https://pan.baidu.com/s/1njY-HAXimp8635W3pe6JEw?pwd=ba1u)

提取码：ba1u

* 解压源码包

```
tar -zxf php-5.6.17.tar.gz
```

* 安装相关的依赖

```
yum install -y gcc make pcre pcre-devel zlib zlib-devel openssl openssl-devel
yum install -y libxml2 libxml2-devel
```

这里分了两条依赖命令，如果是按照之前我写的源码安装NGINX的博客已经安装NGINX了，那么不需要再执行第一条yum命令，反之则相反，如果你也不确定，那就全部执行一遍吧。

* 执行configure脚本

```
./configure --prefix=/usr/local/php --enable-mbstring --enable-fpm --with-mysql --with-mysqli
```

* 再执行两步安装完成

```
make  # 这里make的时间会相对长一点
make install
```

* 拷贝一份配置文件

```
cp /usr/local/php/etc/php-fpm.conf.default /usr/local/php/etc/php-fpm.conf
```

* 拷贝启动文件

```
cp sapi/fpm/init.d.php-fpm /etc/init.d/php-fpm
```

* 为启动文件添加启动权限

```
chmod +x /etc/init.d/php-fpm
```

* 再拷贝一份到系统的命令里面

```
cp /etc/init.d/php-fpm /sbin/php-fpm
```

然后就可以使用简单的命令对PHP进行管理

```
php-fpm start
php-fpm reload
php-fpm stop
```
* 启动之后可以检查一下监听端口

```
lsof -i:80
```