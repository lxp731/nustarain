---
title: 新的Linux虚拟机快速基本配置
date: 2023-05-18 09:54:34
categories: 小玩意儿
tags:
  - Linux
---

### 配置阿里yum源

1. 首先保证虚拟机可以正常访问网络。
2. 执行命令，下载yum源。(CENTOS-7)

```bash
curl -o /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo
```

CENTOS-8 yum源

```bash
curl -o /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-8.repo
```

<!-- more -->

3. 清除yum缓存，重新生成。

```bash
yum clean all && yum makecache
```

PS:

**CENTOS-7和CENTOS-8的yum源最好不要混着使用，是什么版本就用什么版本。**

### 必备的软件

1. **vim工具**，最小化环境是没有vim的，vim和vi的区别在最小化环境里表现的就是配置文档的高亮显示了，强烈建议安装vim。

```bash
yum install -y vim
```

2. **wget**工具，用来下载一些网络资源，同样最小化是没有的，所以要下载一个。

```bash
yum install -y wget
```

3. **bash-completion**包，从名字就可以看出来，这是用来命令补全的，简直不要太好用，<kbd>Tab</kbd>键爱好者狂喜。

```bash
yum install -y bash-completion
``` 

4. **tree工具**，使用图形的方式展示目录下的文件结构，不用的时候吃灰也不会少，用的时候就知道这个的好处了。

```bash
yum install -y tree
```

6. **net-tools**，这个工具提供了比如`ifconfig`，`netstat`，`arp`，`route`命令，有时候用起来发现没有这个命令的话，记得安装这个包。

```bash
yum install -y net-tools
```

5. **lsof工具**，查看端口监听的常用工具，个人来讲使用频率高于`netstat`，使用也比较方便，可以安装一个。

```bash
yum install -y lsof
```

配置完这些，基础的东西就可以告一段落了。