---
title: OpenStack在windows上安装教程
date:       2023-03-19 14:23
categories: 
  - 探索
tags: 
  - Openstack
---

### 项目准备

1. 安装VirtualBOX

> https://download.virtualbox.org/virtualbox/7.0.6/VirtualBox-7.0.6-155176-Win.exe

2. 下载OpenStack的项目资源

OpenStack https://www.aliyundrive.com/s/3uZc1uBwq24 提取码: m8zf

如果是下载的这个网站提供的OpenStack项目资源，那么可以进行查看一下以下几个文件都应该已经存在了。

<!-- more -->

![](https://lxp731.github.io/img/openstack/1.png)

### 开始安装

1. 接下来修改几个文件的配置文件,全部换成自己电脑中VirtualBOX的绝对安装路径

![](https://lxp731.github.io/img/openstack/modify_config.png)

2. 完成后双击运行create_hostnet.bat脚本，出现succeeded字样安装完成。

![](https://lxp731.github.io/img/openstack/succeeded.png)

3. 打开VirtualBOX---管理---主机网络管理器，发现会多出来以下两个Adapter：

![](https://lxp731.github.io/img/openstack/Adapter.png)

4. 在virtualbox中导入.ova文件的虚拟机

virtualbox---管理---导入虚拟电脑，分别导入第一张图中的computer1.ova文件和controller.ova文件

5. 运行虚拟电脑

鼠标右击之后选择无页面启动就OK。

### 体验OpenStack

接着在浏览器输入```127.0.0.1:8888/horizon```回车

默认OpenStack存在两个用户：


|||
|:--:|:--:|
|user|password|
|admin|admin_user_secret|
|myuser|myuser_user_pass|