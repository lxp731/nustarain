---
title: 在OpenStack上分发虚拟机实例
date:       2023-04-23 14:23
categories:
  - 探索
tags: 
    - Openstack
---

### 镜像

OpenStack的存放镜像的位置在image目录下，作为演示，我们待会就使用这个cirros镜像。

![镜像](https://lxp731.github.io/img/openstack/images.png)

### 规格

OpenStack分发虚拟机时，可以自定义一个分发的模板，这个模板就在flavors目录下，此时还是空，我们先创建一个flavor。

<!-- more -->

![模板](https://lxp731.github.io/img/openstack/flavors.png)

按照自己的需求，可以创建flavor模板

| | |
|:--|:--|
|VCPU|虚拟CPU的数量|
|ID|默认就好|
|RAM|内存大小|
|ROOT DISK|根磁盘大小|
|其他选项|全部默认|

![flavor](https://lxp731.github.io/img/openstack/create_flavors.png)

创建好之后，就会生成这样的一个flavor。

![flavor](https://lxp731.github.io/img/openstack/succeed_flavors.png)

### 网络

和分发规格一样，我们同时可以自定义网络的模板,默认是会存在一个模板的，我们使用默认的模板，不再进行创建新的模板了，当然你可以按照个人的需求进行创建。

![network](https://lxp731.github.io/img/openstack/network.png)

### 发放虚拟机实例

我们到project的instances目录，这里还没有虚拟机实例，我们来创建一个。

![network](https://lxp731.github.io/img/openstack/instances.png)

1. 点击右上角的```launch instances```。

2. 设置details，名字自己起，描述选填，其他默认就好，然后next。

![network](https://lxp731.github.io/img/openstack/details.png)

3. 设置source，为了节省空间我选择不再创建新的卷，然后将下面的模板直接应用，点旁边的上箭头应用，然后next。

![network](https://lxp731.github.io/img/openstack/source.png)

4. 设置flavor，这里有我们刚刚创建的flavor模板，我们直接点旁边的上箭头。

![network](https://lxp731.github.io/img/openstack/flavor.png)

5. 最后设置network，默认已经选好了。那么，计算资源，存储资源，网络资源我们都配置好了，就可以直接发布虚拟机了，点击右下角的按钮分发实例。

6. 稍作等待，就会出现下面这个页面，等实例处于active时，就大功告成了。

![network](https://lxp731.github.io/img/openstack/finish.png)